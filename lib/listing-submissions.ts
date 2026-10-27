interface Statement {bind(...values:(string|number|null)[]):Statement;first<T=Record<string,unknown>>():Promise<T|null>;run():Promise<unknown>}
type Database={prepare(sql:string):Statement};
export const SUBMISSION_SCHEMA=`CREATE TABLE IF NOT EXISTS listing_submissions(user_id TEXT NOT NULL,request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,listing_id TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,request_id))`;
export class SubmissionError extends Error {constructor(message:string,public status=409){super(message);}}
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value;}
export async function submissionTicket(database:Database,userId:string,data:Record<string,unknown>){
 if(data.submissionId==null)return null; // Older clients remain compatible.
 if(typeof data.submissionId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.submissionId))throw new SubmissionError('İlan gönderim bilgisi geçersiz. Sayfayı yenileyin.',400);
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(data))));
 const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 await database.prepare(SUBMISSION_SCHEMA).run();
 return {userId,requestId:data.submissionId,hash};
}
export type SubmissionTicket=NonNullable<Awaited<ReturnType<typeof submissionTicket>>>;
export async function submittedListing(database:Database,ticket:SubmissionTicket){
 const row=await database.prepare('SELECT s.payload_hash,s.listing_id,l.status FROM listing_submissions s LEFT JOIN listings l ON l.id=s.listing_id AND CAST(l.owner_id AS TEXT)=s.user_id WHERE s.user_id=? AND s.request_id=?').bind(ticket.userId,ticket.requestId).first() as {payload_hash:string;listing_id:string;status:string|null}|null;
 if(!row)return null;
 if(row.payload_hash!==ticket.hash)throw new SubmissionError('Önceki gönderiminiz kaydedilmiş. İlanlarım bölümünden mevcut ilanı düzenleyin.');
 if(!row.status)throw new SubmissionError('Bu gönderime ait ilan artık mevcut değil. Yeni bir taslak oluşturun.',410);
 return {id:row.listing_id,status:row.status,replayed:true};
}
export function submissionStatement<T extends Database>(database:T,ticket:SubmissionTicket,listingId:string,stamp:string){return database.prepare('INSERT INTO listing_submissions(user_id,request_id,payload_hash,listing_id,created_at) VALUES(?,?,?,?,?)').bind(ticket.userId,ticket.requestId,ticket.hash,listingId,stamp) as ReturnType<T['prepare']>;}
