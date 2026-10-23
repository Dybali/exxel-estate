import {listingExpired} from '@/lib/listing-policy';
import {officeDB} from '@/lib/office-verification-server';
import {scheduleListingTranslations} from '@/lib/translation-runtime';
import {reportsDB} from '@/lib/reports-server';
import { body, currentUser, db, error, isAdmin, now, ok, parseListing, sameOrigin, str } from "@/lib/server";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user?.email_verified || !isAdmin(user)) return error("Yönetici yetkisi gerekli.", 403);
  await reportsDB();
  if(new URL(request.url).searchParams.get('audit')==='1'){const entries=await db().prepare('SELECT id,actor_name,action,target_id,summary,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 100').all();return ok({entries:entries.results},{headers:{'Cache-Control':'private, no-store'}});}
  const listingId = str(new URL(request.url).searchParams.get("listingId"), 80);
  if (listingId) {
    const row = await db().prepare(
      "SELECT l.*,u.name AS owner_name,u.email AS owner_email,u.role AS owner_role,u.company AS owner_company FROM listings l JOIN users u ON u.id=l.owner_id WHERE l.id=?"
    ).bind(listingId).first<Record<string, unknown>>();
    if (!row) return error("İlan bulunamadı.", 404);
    return ok({
      listing: parseListing(row),
      owner: { name: row.owner_name, email: row.owner_email, role: row.owner_role, company: row.owner_company },
    }, { headers: { "Cache-Control": "no-store" } });
  }
  const requestedPage = Number(new URL(request.url).searchParams.get("page") || 1);
  const page = Number.isInteger(requestedPage) ? Math.min(1000, Math.max(1, requestedPage)) : 1;
  const pageSize = 50;
  const [users, listings, listingCounts, messages, countries] = await Promise.all([
    db().prepare("SELECT id,email,name,role,agent_status,company,created_at FROM users ORDER BY created_at DESC LIMIT 200").all(),
    db().prepare("SELECT l.id,l.title,l.city,l.district,l.neighborhood,l.price,l.currency,l.status,l.owner_id,l.created_at,u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id ORDER BY CASE l.status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,l.created_at DESC LIMIT ? OFFSET ?").bind(pageSize, (page - 1) * pageSize).all(),
    db().prepare("SELECT count(*) AS total,sum(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM listings").first<{ total: number; pending: number | null }>(),
    db().prepare("SELECT id,listing_id,sender_id,body,created_at FROM messages WHERE recipient_id IS NULL ORDER BY created_at DESC LIMIT 100").all(),
    db().prepare("SELECT country_code,locale,legal_text,payment_provider,enabled FROM country_settings ORDER BY country_code").all(),
  ]);
  return ok({ users: users.results || [], listings: listings.results || [], listingTotal: Number(listingCounts?.total || 0), pendingTotal: Number(listingCounts?.pending || 0), page, pageSize, messages: messages.results || [], countries: countries.results || [] },
    { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user?.email_verified || !isAdmin(user)) return error("Yönetici yetkisi gerekli.", 403);
  await reportsDB();
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  const audit=(action:string,target:string,summary:string)=>db().prepare('INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),user!.id,user!.name,action,target,summary,now());
  const kind = str(data.kind, 20), id = str(data.id, 80), status = str(data.status, 20);
  if (kind === "listing" && ["published", "rejected", "pending"].includes(status)) {
    await reportsDB();
    const note = str(data.note, 1000);
    if (status === "rejected" && note.length < 5) return error("Ret nedenini en az 5 karakterle yazın.");
    const current = await db().prepare("SELECT status,expires_at FROM listings WHERE id=?").bind(id).first<{ status: string; expires_at?:string }>();
    if (!current) return error("İlan bulunamadı.", 404);
    if(status==='published'&&listingExpired(current.expires_at))return error('Bu ilanın 20 günlük yayın süresi doldu. Yeni ilan hakkınızı hesabınızdan kontrol edin.',409);
    if(status==='published'){
      await officeDB();const owner=await db().prepare('SELECT u.id,u.role,u.company FROM users u JOIN listings l ON l.owner_id=u.id WHERE l.id=?').bind(id).first<{id:string;role:string;company:string}>();
      if(owner?.role==='agent'){const verification=await db().prepare("SELECT state FROM office_verifications WHERE user_id=? AND company_snapshot=?").bind(owner.id,owner.company||'').first<{state:string}>();if(verification?.state!=='approved')return error('İlanı yayımlamadan önce emlakçının ofis yetki belgesini onaylayın.',403);}
    }
    if (current.status === status) return error("İlan zaten bu durumda.", 409);
    await db().batch([db().prepare("UPDATE listings SET status=?,review_note=?,reviewed_by=?,reviewed_at=?,updated_at=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,?) ELSE published_at END WHERE id=?")
      .bind(status, status === "pending" ? null : note || null, user!.id, now(), now(),status,now(), id),audit("listing",id,status+(note?" · "+note:"")),...(status==="published"?[db().prepare("UPDATE listing_moderation_holds SET active=0,released_at=? WHERE listing_id=?").bind(now(),id)]:[])]);
    if(status==='published')scheduleListingTranslations(id);
    return ok({ success: true, status });
  }
  if (kind === "agent" && ["approved", "rejected", "pending"].includes(status)) {
    if(!/^[a-f0-9-]{36}$/i.test(id))return error("Geçersiz emlakçı.");
    const agent=await db().prepare("SELECT id FROM users WHERE id=? AND role='agent'").bind(id).first();if(!agent)return error("Emlakçı bulunamadı.",404);
    if (status === "approved") {
      await officeDB();const verification=await db().prepare("SELECT state FROM office_verifications WHERE user_id=? AND company_snapshot=(SELECT company FROM users WHERE id=?)").bind(id,id).first<{state:string}>();
      if(verification?.state!=='approved')return error('Önce Ofis yetki belgeleri bölümünden belgeyi inceleyip onaylayın.',403);
      const applicant = await db().prepare("SELECT company FROM users WHERE id=? AND role='agent'").bind(id).first<{ company: string | null }>();
      if (!applicant?.company?.trim()) return error("Emlakçı onayı için ofis veya şirket adı gerekli.");
    }
    await db().batch([
      db().prepare("UPDATE users SET agent_status=? WHERE id=? AND role='agent'").bind(status, id),
      db().prepare("UPDATE agencies SET status=? WHERE owner_id=?").bind(status, id),
      audit("agent",id,status),
    ]);
    return ok({ success: true });
  }
  if (kind === "country") {
    const countryCode = str(data.countryCode, 2).toUpperCase(), locale = str(data.locale, 10), legalText = str(data.legalText, 10000), paymentProvider = str(data.paymentProvider, 80);
    if (!/^[A-Z]{2}$/.test(countryCode) || !/^[a-z]{2}(-[A-Z]{2})?$/.test(locale)) return error("Ülke ve dil kodlarını kontrol edin.");
    await db().batch([db().prepare("INSERT INTO country_settings(country_code,locale,legal_text,payment_provider,enabled) VALUES(?,?,?,?,?) ON CONFLICT(country_code) DO UPDATE SET locale=excluded.locale,legal_text=excluded.legal_text,payment_provider=excluded.payment_provider,enabled=excluded.enabled")
      .bind(countryCode, locale, legalText, paymentProvider || null, data.enabled ? 1 : 0),audit("country",countryCode,locale+" · "+(data.enabled?"enabled":"disabled"))]);
    return ok({ success: true });
  }
  return error("Geçersiz yönetim işlemi.");
}
