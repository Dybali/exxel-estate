import {body,currentUser,db,error,now,ok,passwordHash,verifyPassword,sameOrigin,sessionCookie,sha256} from '@/lib/server';
import {consumeRecoveryLimit,RecoveryError} from '@/lib/recovery-service';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);const row=await db().prepare('SELECT count(*) AS count FROM sessions WHERE user_id=? AND expires_at>?').bind(user.id,now()).first<{count:number}>();return ok({activeSessions:Number(row?.count||0)},{headers});}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const user=await currentUser(request);if(!user)return error('Giriş gerekli.',401);
 let data:Record<string,unknown>;try{data=await body(request);}catch{return error('Geçersiz istek.');}
 if(data.action==='change_password'){
  const current=typeof data.currentPassword==='string'?data.currentPassword:'',password=typeof data.password==='string'?data.password:'';
  if(!current||current.length>128||password.length<10||password.length>128||password!==data.passwordConfirmation)return error('Mevcut şifrenizi ve en az 10 karakterli, birbiriyle aynı iki yeni şifreyi girin.');
  try{await consumeRecoveryLimit(db(),await sha256('change-password:'+user.id),8);}catch(cause){if(cause instanceof RecoveryError)return error(cause.message,cause.status);throw cause;}
  const row=await db().prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first<{password_hash:string}>();
  if(!row?.password_hash||!await verifyPassword(current,row.password_hash))return error('Mevcut şifreniz doğru değil.',400);
  if(current===password)return error('Yeni şifreniz mevcut şifrenizden farklı olmalıdır.');
  await db().batch([db().prepare('UPDATE users SET password_hash=? WHERE id=?').bind(await passwordHash(password),user.id),db().prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id)]);
  return ok({success:true},{headers:{...headers,'Set-Cookie':sessionCookie('',true)}});
 }
 if(data.action==='logout_others'){const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)excell_session=([^;]+)/)?.[1];if(!token)return error('Giriş gerekli.',401);await db().prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(user.id,await sha256(token)).run();return ok({success:true},{headers});}
 if(data.action==='logout_all'){await db().prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();return ok({success:true},{headers:{...headers,'Set-Cookie':sessionCookie('',true)}});}
 return error('Geçersiz işlem.');
}
