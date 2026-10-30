import {env} from '@/lib/runtime';
import {body,currentUser,db,error,now,ok,passwordHash,sameOrigin,sessionCookie,sha256} from '@/lib/server';
import {neonMailAuth} from '@/lib/neon-mail-auth';
import {linkNeonAccount,NeonIdentityError} from '@/lib/neon-identities';
import {consumeRecoveryLimit,RecoveryError,validateRecoveryInput} from '@/lib/recovery-service';
type AuthEnv=Cloudflare.Env&{NEON_AUTH_BASE_URL?:string;NEON_AUTH_COOKIE_SECRET?:string};
function settings(){const values=env as AuthEnv;return values.NEON_AUTH_BASE_URL&&(values.NEON_AUTH_COOKIE_SECRET?.length||0)>=32?{baseUrl:values.NEON_AUTH_BASE_URL,cookieSecret:values.NEON_AUTH_COOKIE_SECRET!}:null;}
const privateHeaders={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
export async function GET(){return ok({enabled:Boolean(settings())},{headers:privateHeaders});}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const config=settings();if(!config)return error('E-posta doğrulama hizmeti henüz hazır değil.',503);
 try{
  const data=await body(request),verification=data.purpose==='verify';const actor=verification?await currentUser(request):null;
  if(verification&&!actor)throw new RecoveryError('E-postanızı doğrulamak için giriş yapın.',401);
  const input=validateRecoveryInput({...data,email:verification?actor!.email:data.email});
  const database=db(),ip=request.headers.get('CF-Connecting-IP')||'local';
  await consumeRecoveryLimit(database,await sha256('neon-mail:'+input.action+':ip:'+ip),input.action==='send'?10:24);
  await consumeRecoveryLimit(database,await sha256('neon-mail:'+input.action+':email:'+input.email),input.action==='send'?3:8);
  const auth=await neonMailAuth({...config,origin:new URL(request.url).origin});
  if(input.action==='send'){
   try{await auth.send(input.email);}catch{throw new RecoveryError('E-posta şu anda gönderilemiyor. Lütfen tekrar deneyin.',503);}
   return ok({success:true,message:'E-posta adresinizi kontrol edin. Kod gelmezse adresi ve spam klasörünü kontrol edin.'},{headers:privateHeaders});
  }
  const password=typeof data.password==='string'?data.password:'';
  if(!verification&&(password.length<10||password.length>128||password!==data.passwordConfirmation))throw new RecoveryError('En az 10 karakterli bir şifre girin ve iki şifrenin aynı olduğundan emin olun.');
  let identity;try{identity=await auth.verify(input.email,input.otp);}catch{throw new RecoveryError('Kod geçersiz veya süresi dolmuş. Yeni bir kod isteyin.');}
  const result=await linkNeonAccount(database,identity);const user=result.user;
  if(!user||verification&&user.id!==actor!.id)throw new RecoveryError('Bu e-posta adresiyle kayıtlı hesabınıza ulaşılamadı.',400);
  if(verification){await database.prepare('UPDATE users SET email_verified=1 WHERE id=?').bind(String(user.id)).run();return ok({success:true},{headers:privateHeaders});}
  await database.batch([database.prepare('UPDATE users SET password_hash=?,email_verified=1 WHERE id=?').bind(await passwordHash(password),String(user.id)),database.prepare('DELETE FROM sessions WHERE user_id=?').bind(String(user.id))]);
  return ok({success:true,message:'Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz.'},{headers:{...privateHeaders,'Set-Cookie':sessionCookie('',true)}});
 }catch(cause){if(cause instanceof RecoveryError||cause instanceof NeonIdentityError)return error(cause.message,cause.status);return error('İşlem tamamlanamadı. Lütfen tekrar deneyin.',500);}
}
