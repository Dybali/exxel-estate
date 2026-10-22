import {db} from './server';
import {COMPANY_PROFILE_SCHEMA} from './company-membership';
let ready:Promise<unknown>|undefined;
export async function companyProfileDB(){if(!ready)ready=db().prepare(COMPANY_PROFILE_SCHEMA).run().catch(e=>{ready=undefined;throw e;});await ready;return db();}
