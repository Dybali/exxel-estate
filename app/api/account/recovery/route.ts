import {waitUntil} from '@/lib/runtime';
import {body,clientIp,currentUser,db,error,ok,passwordHash,sameOrigin,sessionCookie,sha256} from '@/lib/server';
import {consumeRecoveryLimit,RecoveryError,validateRecoveryInput} from '@/lib/recovery-service';
import {consumeEmailCode,EmailCodeError,issueEmailCode,revokeEmailCode,type EmailCodePurpose} from '@/lib/email-codes';
import {authCodeSecret,emailCodeDB,emailCodesReady,sendCodeEmail} from '@/lib/email-codes-server';
import {authEmailLocale} from '@/lib/auth-email';
// E-mail verification and password reset with our own one-time codes (docs/auth.md).
// Always rendered per request (live data); the standard Next.js build must not prerender it.
export const dynamic = "force-dynamic";
const privateHeaders={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
// Same answer whether or not an account exists for the address (no account enumeration).
const SENT_MESSAGE='E-posta adresinizi kontrol edin. Kod gelmezse adresi ve spam klasörünü kontrol edin.';
export async function GET(){return ok({enabled:emailCodesReady()},{headers:privateHeaders});}
export async function POST(request:Request){
 if(!sameOrigin(request))return error('Geçersiz kaynak.',403);
 const secret=authCodeSecret();if(!secret||!emailCodesReady())return error('E-posta doğrulama hizmeti henüz hazır değil.',503);
 try{
  const data=await body(request),verification=data.purpose==='verify';const actor=verification?await currentUser(request):null;
  if(verification&&!actor)throw new RecoveryError('E-postanızı doğrulamak için giriş yapın.',401);
  const purpose:EmailCodePurpose=verification?'verify':'reset';
  const input=validateRecoveryInput({...data,email:verification?actor!.email:data.email});
  const database=db(),codes=emailCodeDB(),ip=clientIp(request);
  await consumeRecoveryLimit(database,await sha256('email-code:'+input.action+':ip:'+ip),input.action==='send'?10:24);
  await consumeRecoveryLimit(database,await sha256('email-code:'+input.action+':email:'+input.email),input.action==='send'?3:8);
  if(input.action==='send'){
   const locale=authEmailLocale(data.locale);
   if(verification){
    if(actor!.email_verified)return ok({success:true,message:SENT_MESSAGE},{headers:privateHeaders});
    const issued=await issueEmailCode(codes,{email:input.email,purpose,userId:String(actor!.id),secret});
    try{await sendCodeEmail(input.email,purpose,issued.code,locale);}catch{await revokeEmailCode(codes,issued.id);throw new RecoveryError('E-posta şu anda gönderilemiyor. Lütfen tekrar deneyin.',503);}
    return ok({success:true,message:SENT_MESSAGE},{headers:privateHeaders});
   }
   // Password reset: a code is only issued and mailed for an existing account, in the background, and a
   // resend within the cooldown is silently skipped, so the response does not reveal whether it exists.
   const user=await database.prepare('SELECT id FROM users WHERE LOWER(email)=?').bind(input.email).first<{id:string}>();
   if(user){
    let issued:{id:string;code:string}|null=null;
    try{issued=await issueEmailCode(codes,{email:input.email,purpose,userId:String(user.id),secret});}catch(cause){if(!(cause instanceof EmailCodeError&&cause.status===429))throw cause;}
    if(issued){const sent=issued;waitUntil(sendCodeEmail(input.email,purpose,sent.code,locale).catch(()=>revokeEmailCode(codes,sent.id)));}
   }
   return ok({success:true,message:SENT_MESSAGE},{headers:privateHeaders});
  }
  const password=typeof data.password==='string'?data.password:'';
  if(!verification&&(password.length<10||password.length>128||password!==data.passwordConfirmation))throw new RecoveryError('En az 10 karakterli bir şifre girin ve iki şifrenin aynı olduğundan emin olun.');
  const {userId}=await consumeEmailCode(codes,{email:input.email,purpose,code:input.otp,secret});
  const user=userId?await database.prepare('SELECT id,email FROM users WHERE id=?').bind(userId).first<{id:string;email:string}>():null;
  if(!user||String(user.email).toLowerCase()!==input.email||verification&&String(user.id)!==String(actor!.id))throw new RecoveryError('Bu e-posta adresiyle kayıtlı hesabınıza ulaşılamadı.',400);
  if(verification){await database.prepare('UPDATE users SET email_verified=1 WHERE id=?').bind(String(user.id)).run();return ok({success:true},{headers:privateHeaders});}
  // New password; every existing session of the account (including this browser's) is closed.
  await database.batch([database.prepare('UPDATE users SET password_hash=?,email_verified=1 WHERE id=?').bind(await passwordHash(password),String(user.id)),database.prepare('DELETE FROM sessions WHERE user_id=?').bind(String(user.id))]);
  return ok({success:true,message:'Şifreniz yenilendi. Yeni şifrenizle giriş yapabilirsiniz.'},{headers:{...privateHeaders,'Set-Cookie':sessionCookie('',true)}});
 }catch(cause){
  if(cause instanceof EmailCodeError){const headers:Record<string,string>={...privateHeaders};if(cause.retryAfter)headers['Retry-After']=String(cause.retryAfter);return Response.json({error:cause.message,...(cause.retryAfter?{retryAfter:cause.retryAfter}:{})},{status:cause.status,headers});}
  if(cause instanceof RecoveryError)return error(cause.message,cause.status);
  return error('İşlem tamamlanamadı. Lütfen tekrar deneyin.',500);
 }
}
