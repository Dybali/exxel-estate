import {db} from './server';
import {REPORT_SCHEMA} from './report-service';
let initialized:Promise<unknown>|undefined;
export async function reportsDB(){if(!initialized)initialized=(async()=>{for(const sql of REPORT_SCHEMA)await db().prepare(sql).run();})().catch(e=>{initialized=undefined;throw e;});await initialized;return db();}
