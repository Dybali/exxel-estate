import { body, createSession, currentUser, db, error, isAdmin, now, ok, passwordHash, sameOrigin, sessionCookie, sha256, str, verifyPassword } from "@/lib/server";

export async function GET(request:Request) {
  const user=await currentUser(request);
  return ok({user:user?{...user,isAdmin:isAdmin(user)}:null});
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
  const email=str(data.email,254).toLowerCase();
  const password=typeof data.password==="string"?data.password:"";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<10 || password.length>128) return error("Geçerli e-posta ve en az 10 karakterli şifre girin.");
  if (action==="register") {
    const name=str(data.name,100), role=str(data.role,20);
    if (name.length<2 || !["buyer","individual","agent"].includes(role)) return error("Ad ve hesap türünü kontrol edin.");
    const existing=await db().prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(existing) return error("Bu e-posta ile kayıtlı bir hesap var.",409);
    const id=crypto.randomUUID();
    await db().prepare("INSERT INTO users(id,email,password_hash,name,role,agent_status,company,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,email,await passwordHash(password),name,role,role==="agent"?"pending":"none",str(data.company,120)||null,now()).run();
    const token=await createSession(id);
    return ok({user:{id,email,name,role,agent_status:role==="agent"?"pending":"none",isAdmin:false}},{status:201,headers:{"Set-Cookie":sessionCookie(token)}});
  }
  if(action==="login") {
    const row=await db().prepare("SELECT id,email,password_hash,name,role,agent_status,phone,company FROM users WHERE email=?").bind(email).first<Record<string,unknown>>();
    if(!row || !(await verifyPassword(password,String(row.password_hash)))) return error("E-posta veya şifre hatalı.",401);
    const token=await createSession(String(row.id));
    const user={id:row.id,email:row.email,name:row.name,role:row.role,agent_status:row.agent_status,phone:row.phone,company:row.company};
    return ok({user:{...user,isAdmin:isAdmin(user as Parameters<typeof isAdmin>[0])}},{headers:{"Set-Cookie":sessionCookie(token)}});
  }
  return error("Geçersiz işlem.");
}
