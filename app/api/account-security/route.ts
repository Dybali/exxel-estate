import {body,bucket,currentUser,db,error,now,ok,passwordHash,verifyPassword,sameOrigin,sessionCookie,sha256} from '@/lib/server';
import {consumeRecoveryLimit,RecoveryError} from '@/lib/recovery-service';
import {AccountDeletionError,deleteAccount,type AccountDatabase} from '@/lib/account-deletion';
import {deleteExternalImage} from '@/lib/external-r2';
import {listingMediaKeys,removeListingMedia} from '@/lib/listing-media';
import {type VideoDatabase} from '@/lib/listing-video-store';
import {removeVideoById,videoFeatureEnabled} from '@/lib/listing-video-server';
const removeMedia=async(key:string)=>{await deleteExternalImage(key);await bucket()?.delete(key);};
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
 // Self-service account deletion: current password, explicit confirmation, then listings with their
 // photos are removed and the account anonymised (lib/account-deletion.ts).
 if(data.action==='delete_account'){
  const current=typeof data.currentPassword==='string'?data.currentPassword:'';
  if(!current||current.length>128||data.confirm!==true)return error('Hesabınızı silmek için şifrenizi girin ve onay kutusunu işaretleyin.');
  try{await consumeRecoveryLimit(db(),await sha256('delete-account:'+user.id),5);}catch(cause){if(cause instanceof RecoveryError)return error(cause.message,cause.status);throw cause;}
  const row=await db().prepare('SELECT password_hash FROM users WHERE id=?').bind(user.id).first<{password_hash:string}>();
  if(!row?.password_hash||!await verifyPassword(current,row.password_hash))return error('Mevcut şifreniz doğru değil.',400);
  try{
   await deleteAccount(db() as unknown as AccountDatabase,user,async listing=>{
    await db().prepare('DELETE FROM listings WHERE id=?').bind(listing.id).run();
    const shown=JSON.parse(listing.presentation||'{}'),video=String(shown.videoId||'');
    if(video&&videoFeatureEnabled())await removeVideoById(db() as unknown as VideoDatabase,video).catch(()=>{});
    await removeListingMedia(listingMediaKeys(JSON.parse(listing.images||'[]'),shown),removeMedia).catch(()=>{});
   },async url=>{const key=url.replace(/^\/api\/media\//,'');if(key.startsWith('listings/'+user.id+'/'))await removeMedia(key);},await passwordHash(crypto.randomUUID()+crypto.randomUUID()));
  }catch(cause){if(cause instanceof AccountDeletionError)return error(cause.message,cause.status);throw cause;}
  return ok({success:true},{headers:{...headers,'Set-Cookie':sessionCookie('',true)}});
 }
 if(data.action==='logout_others'){const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)excell_session=([^;]+)/)?.[1];if(!token)return error('Giriş gerekli.',401);await db().prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').bind(user.id,await sha256(token)).run();return ok({success:true},{headers});}
 if(data.action==='logout_all'){await db().prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();return ok({success:true},{headers:{...headers,'Set-Cookie':sessionCookie('',true)}});}
 return error('Geçersiz işlem.');
}
