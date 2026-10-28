import {db} from './server';
import {OFFICE_SCHEMA} from './office-verification';
let initialized:Promise<unknown>|undefined;
export async function officeDB(){if(!initialized)initialized=(async()=>{for(const sql of OFFICE_SCHEMA)await db().prepare(sql).run();})().catch(e=>{initialized=undefined;throw e;});await initialized;return db();}
export async function officePublicationAllowed(userId:string){const database=await officeDB();return Boolean(await database.prepare("SELECT u.id FROM users u JOIN office_verifications v ON v.user_id=CAST(u.id AS TEXT) WHERE u.id=? AND u.role='agent' AND u.agent_status='approved' AND v.state='approved' AND v.company_snapshot=u.company").bind(userId).first());}

// Approved Taşınmaz Ticareti Yetki Belgesi number shown on listings: the owner's own,
// or the company owner's for team listings. Returns null when none is approved.
export async function listingAuthorityNumber(listingId:string){
 try{
  const own=await db().prepare("SELECT o.document_number FROM office_verifications o JOIN listings l ON o.user_id=CAST(l.owner_id AS TEXT) WHERE CAST(l.id AS TEXT)=? AND o.state='approved' LIMIT 1").bind(listingId).first<{document_number:string}>();
  if(own?.document_number)return own.document_number;
  const company=await db().prepare("SELECT o.document_number FROM listings l JOIN agencies a ON a.id=l.agency_id JOIN office_verifications o ON o.user_id=CAST(a.owner_id AS TEXT) WHERE CAST(l.id AS TEXT)=? AND o.state='approved' LIMIT 1").bind(listingId).first<{document_number:string}>();
  return company?.document_number||null;
 }catch{return null;}
}
export async function userAuthorityNumber(userId:string){
 try{return (await db().prepare("SELECT document_number FROM office_verifications WHERE user_id=? AND state='approved'").bind(userId).first<{document_number:string}>())?.document_number||null;}catch{return null;}
}
