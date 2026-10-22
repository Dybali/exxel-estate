import { ensureProfiles, validProfileImage } from '@/lib/seller-profiles';
import { headExternalImage } from '@/lib/external-r2';
import { body, createSession, currentUser, db, error, isAdmin, now, ok, passwordHash, sameOrigin, sessionCookie, sha256, str, verifyPassword } from "@/lib/server";
import { normalizeContactPhone } from "@/lib/phone";
import {consumeRecoveryLimit,RecoveryError} from '@/lib/recovery-service';

export async function GET(request:Request) {
  const user=await currentUser(request);
  const database=db();let bio='';if(user){await ensureProfiles(database);bio=(await database.prepare('SELECT bio FROM seller_profiles WHERE user_id=?').bind(user.id).first<{bio:string}>())?.bio||'';}
  return ok({user:user?{...user,bio,isAdmin:isAdmin(user)}:null},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  let data:Record<string,unknown>;
  try {data=await body(request);} catch {return error("Geçersiz istek.");}
  const action=str(data.action,20);
  if (action==="logout") {
    const token=(request.headers.get("cookie")||"").match(/(?:^|;\s*)excell_session=([^;]+)/)?.[1];
    if(token) await db().prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
    return ok({success:true},{headers:{"Set-Cookie":sessionCookie("",true)}});
  }
  if (action==="update_profile") {
    const user=await currentUser(request);
    if(!user) return error("Önce giriş yapın.",401);
    const name=Object.hasOwn(data,"name")?str(data.name,100):user.name;
    const phoneInput=Object.hasOwn(data,"phone")?str(data.phone,32):user.phone||"";
    const phone=phoneInput?normalizeContactPhone(phoneInput):null;
    const whatsappEnabled=Object.hasOwn(data,"whatsappEnabled")?data.whatsappEnabled===true:Boolean(user.whatsapp_enabled);
    if(name.length<2) return error("Ad soyad en az 2 karakter olmalıdır.");
    if(phoneInput&&!phone) return error("Telefonu ülke koduyla girin. Örnek: +905551112233.");
    if(whatsappEnabled&&!phone) return error("WhatsApp iletişimi için geçerli bir telefon numarası ekleyin.");
    const database=db();await ensureProfiles(database);
    const previous=await database.prepare('SELECT bio FROM seller_profiles WHERE user_id=?').bind(user.id).first<{bio:string}>();
    const bio=Object.hasOwn(data,'bio')?str(data.bio,2001):previous?.bio||'';
    if(bio.length>2000)return error('Tanıtım yazısı en fazla 2000 karakter olabilir.');
    const avatarUrl=Object.hasOwn(data,'avatarUrl')?str(data.avatarUrl,500):user.avatar_url||null;
    if(avatarUrl&&avatarUrl!==user.avatar_url){if(!validProfileImage(avatarUrl,user.id))return error('Kendi yüklediğiniz profil fotoğrafını kullanın.',403);if(!await headExternalImage(avatarUrl.slice('/api/media/'.length)))return error('Profil fotoğrafı depoda bulunamadı.');}
    await database.batch([database.prepare('UPDATE users SET name=?,phone=?,whatsapp_enabled=?,avatar_url=? WHERE id=?').bind(name,phone,whatsappEnabled?1:0,avatarUrl||null,user.id),database.prepare('INSERT INTO seller_profiles(user_id,bio,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET bio=excluded.bio,updated_at=excluded.updated_at').bind(user.id,bio,now())]);
    return ok({success:true,user:{...user,name,phone,bio,avatar_url:avatarUrl||null,whatsapp_enabled:whatsappEnabled?1:0,isAdmin:isAdmin(user)}},{headers:{"Cache-Control":"private, no-store"}});
  }
  if (action==="request_seller_role") {
    const user=await currentUser(request);
    if(!user) return error("Önce giriş yapın.",401);
    if(user.role==="admin") return error("Yönetici hesabı değiştirilemez.",403);
    const role=str(data.role,20);
    if(!["individual","agent"].includes(role)) return error("Geçerli bir ilan veren türü seçin.");
    if(user.role==="agent" && user.agent_status==="approved") return error("Emlakçı hesabınız zaten onaylı.");
    if(user.role==="individual" && role==="individual") return error("Hesabınız zaten bireysel ilan veren türünde.");
    const company=str(data.company,120);
    const category=data.companyCategory==="developer"?"developer":"agency";
    if(role==="agent" && company.length<2) return error("Emlak ofisi veya şirket adını girin.");
    const statements=[db().prepare("UPDATE users SET role=?,agent_status=?,company=? WHERE id=?")
      .bind(role,role==="agent"?"pending":"none",role==="agent"?company:null,user.id)];
    if(role==="agent") statements.push(db().prepare("INSERT INTO agencies(id,owner_id,name,category,status,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,category=excluded.category,status=excluded.status")
      .bind(crypto.randomUUID(),user.id,company,category,"pending",now()));
    else statements.push(db().prepare("UPDATE agencies SET status='inactive' WHERE owner_id=?").bind(user.id));
    await db().batch(statements);
    return ok({success:true,role,agent_status:role==="agent"?"pending":"none"});
  }
  const email=str(data.email,254).toLowerCase();
  const password=typeof data.password==="string"?data.password:"";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<10 || password.length>128) return error("Geçerli e-posta ve en az 10 karakterli şifre girin.");
  if (action==="register") {
    try{await consumeRecoveryLimit(db(),await sha256('registration:'+ (request.headers.get('CF-Connecting-IP')||'local')),5);}catch(cause){if(cause instanceof RecoveryError)return error(cause.message,cause.status);throw cause;}
    const name=str(data.name,100), role=str(data.role,20);
    if (name.length<2 || !["buyer","individual","agent"].includes(role)) return error("Ad ve hesap türünü kontrol edin.");
    const existing=await db().prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(existing) return error("Bu e-posta ile kayıtlı bir hesap var.",409);
    const id=crypto.randomUUID();
    if(role==="agent" && str(data.company,120).length<2) return error("Emlak ofisi veya şirket adını girin.");
    const company=str(data.company,120)||null,category=data.companyCategory==="developer"?"developer":"agency",createdAt=now();
    const statements=[db().prepare("INSERT INTO users(id,email,password_hash,email_verified,name,role,agent_status,company,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(id,email,await passwordHash(password),0,name,role,role==="agent"?"pending":"none",company,createdAt)];
    if(role==="agent") statements.push(db().prepare("INSERT INTO agencies(id,owner_id,name,category,status,created_at) VALUES(?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),id,company!,category,"pending",createdAt));
    await db().batch(statements);
    const token=await createSession(id);
    return ok({user:{id,email,name,role,agent_status:role==="agent"?"pending":"none",isAdmin:false}},{status:201,headers:{"Set-Cookie":sessionCookie(token)}});
  }
  if(action==="login") {
    const ip=request.headers.get("CF-Connecting-IP")||"local";
    const limitKey=await sha256(`login:${email}:${ip}`);
    // Count before verification with atomic UPSERTs. A shared IP budget also
    // bounds attempts spread over many e-mail addresses; successful logins do
    // not reset this aggregate budget.
    try{
      await consumeRecoveryLimit(db(),await sha256(`login-ip:${ip}`),100);
      await consumeRecoveryLimit(db(),limitKey,10);
    }catch(cause){if(cause instanceof RecoveryError)return error(cause.message,cause.status);throw cause;}
    const row=await db().prepare("SELECT id,email,password_hash,email_verified,name,role,agent_status,phone,whatsapp_enabled,company FROM users WHERE email=?").bind(email).first<Record<string,unknown>>();
    if(!row || !(await verifyPassword(password,String(row.password_hash)))) {
      return error("E-posta veya şifre hatalı.",401);
    }
    await db().prepare("DELETE FROM auth_limits WHERE key=?").bind(limitKey).run();
    const token=await createSession(String(row.id));
    const user={id:row.id,email:row.email,email_verified:row.email_verified,name:row.name,role:row.role,agent_status:row.agent_status,phone:row.phone,whatsapp_enabled:row.whatsapp_enabled,company:row.company};
    return ok({user:{...user,isAdmin:isAdmin(user as Parameters<typeof isAdmin>[0])}},{headers:{"Set-Cookie":sessionCookie(token)}});
  }
  return error("Geçersiz işlem.");
}
