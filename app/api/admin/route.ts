import { body, currentUser, db, error, isAdmin, ok, sameOrigin, str } from "@/lib/server";
export async function GET(request:Request) {
  const user=await currentUser(request);if(!isAdmin(user))return error("Yönetici yetkisi gerekli.",403);
  const [users,listings,messages,countries]=await Promise.all([
    db().prepare("SELECT id,email,name,role,agent_status,company,created_at FROM users ORDER BY created_at DESC LIMIT 200").all(),
    db().prepare("SELECT id,title,city,district,price,status,owner_id,created_at FROM listings ORDER BY created_at DESC LIMIT 200").all(),
    db().prepare("SELECT id,listing_id,sender_id,body,created_at FROM messages WHERE recipient_id IS NULL ORDER BY created_at DESC LIMIT 100").all(),
    db().prepare("SELECT country_code,locale,legal_text,payment_provider,enabled FROM country_settings ORDER BY country_code").all()
  ]);
  return ok({users:users.results||[],listings:listings.results||[],messages:messages.results||[],countries:countries.results||[]});
}
export async function POST(request:Request) {
  if(!sameOrigin(request))return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);if(!isAdmin(user))return error("Yönetici yetkisi gerekli.",403);
  let data;try{data=await body(request);}catch{return error("Geçersiz istek.");}
  const kind=str(data.kind,20),id=str(data.id,80),status=str(data.status,20);
  if(kind==="listing"&&["published","rejected","pending"].includes(status)) {
    await db().prepare("UPDATE listings SET status=?,updated_at=? WHERE id=?").bind(status,new Date().toISOString(),id).run();return ok({success:true});
  }
  if(kind==="agent"&&["approved","rejected","pending"].includes(status)) {
    if(status==="approved") {
      const applicant=await db().prepare("SELECT company FROM users WHERE id=? AND role='agent'").bind(id).first<{company:string|null}>();
      if(!applicant?.company?.trim()) return error("Emlakçı onayı için ofis veya şirket adı gerekli.");
    }
    await db().prepare("UPDATE users SET agent_status=? WHERE id=? AND role='agent'").bind(status,id).run();return ok({success:true});
  }
  if(kind==="country") {
    const countryCode=str(data.countryCode,2).toUpperCase(),locale=str(data.locale,10),legalText=str(data.legalText,10000),paymentProvider=str(data.paymentProvider,80);
    if(!/^[A-Z]{2}$/.test(countryCode)||!/^[a-z]{2}(-[A-Z]{2})?$/.test(locale))return error("Ülke ve dil kodlarını kontrol edin.");
    await db().prepare("INSERT INTO country_settings(country_code,locale,legal_text,payment_provider,enabled) VALUES(?,?,?,?,?) ON CONFLICT(country_code) DO UPDATE SET locale=excluded.locale,legal_text=excluded.legal_text,payment_provider=excluded.payment_provider,enabled=excluded.enabled").bind(countryCode,locale,legalText,paymentProvider||null,data.enabled?1:0).run();
    return ok({success:true});
  }
  return error("Geçersiz yönetim işlemi.");
}
