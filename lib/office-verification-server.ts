import {db} from './server';
import {OFFICE_SCHEMA} from './office-verification';
let initialized:Promise<unknown>|undefined;
export async function officeDB(){if(!initialized)initialized=(async()=>{for(const sql of OFFICE_SCHEMA)await db().prepare(sql).run();})().catch(e=>{initialized=undefined;throw e;});await initialized;return db();}
export async function officePublicationAllowed(userId:string){const database=await officeDB();return Boolean(await database.prepare("SELECT u.id FROM users u JOIN office_verifications v ON v.user_id=CAST(u.id AS TEXT) WHERE u.id=? AND u.role='agent' AND u.agent_status='approved' AND v.state='approved' AND v.company_snapshot=u.company").bind(userId).first());}
