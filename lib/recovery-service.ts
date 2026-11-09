import type {ChatDatabase} from './messaging-service';
export class RecoveryError extends Error{constructor(message:string,public status=400){super(message);}}
export const normalizeRecoveryEmail=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():'';
export function validateRecoveryInput(data:Record<string,unknown>){
 const email=normalizeRecoveryEmail(data.email);if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new RecoveryError('Geçerli bir e-posta adresi girin.');
 if(data.action!=='send'&&data.action!=='confirm')throw new RecoveryError('Geçersiz işlem.');
 const otp=typeof data.otp==='string'?data.otp.trim():'';
 if(data.action==='confirm'&&!/^\d{6}$/.test(otp))throw new RecoveryError('E-postanızdaki 6 haneli kodu girin.');
 return {email,otp,action:data.action as 'send'|'confirm'};
}
// One atomic UPSERT avoids parallel requests bypassing the per-mailbox/IP limits.
export async function consumeRecoveryLimit(database:ChatDatabase,key:string,limit:number,at=new Date()){
 await consumeRateLimit(database,key,limit,15*60000,at);
}
// The same shared auth_limits counter with a caller-chosen window (a fixed window from the first hit)
// and message. Keys should already be hashed (sha256) so no raw IP address or e-mail is stored.
export async function consumeRateLimit(database:ChatDatabase,key:string,limit:number,windowMs:number,at=new Date(),message='Çok fazla deneme. 15 dakika sonra tekrar deneyin.'){
 const now=at.toISOString(),cutoff=new Date(at.getTime()-windowMs).toISOString();
 const row=await database.prepare(`INSERT INTO auth_limits(key,failures,window_started_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN auth_limits.window_started_at>? THEN auth_limits.failures+1 ELSE 1 END,window_started_at=CASE WHEN auth_limits.window_started_at>? THEN auth_limits.window_started_at ELSE excluded.window_started_at END RETURNING failures`).bind(key,now,cutoff,cutoff).first<{failures:number}>();
 if(!row||Number(row.failures)>limit)throw new RecoveryError(message,429);
}
