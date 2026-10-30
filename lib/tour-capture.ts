import {env} from './runtime';
import {bucket,db,sha256} from './server';
import {CAPTURE_LIMITS as L} from './capture-rules';
export type CaptureJob={id:string;owner_id:string;name:string;state:string;expected:number;files:string;hfov:number|null;progress:number;message:string;lease:string|null;lease_until:number;attempts:number;created:number;expires:number;result_key:string|null;public_id:string};
export const captureToken=()=>String((env as unknown as Record<string,unknown>).CAPTURE_WORKER_TOKEN||'');
export const captureMode=()=>String((env as unknown as Record<string,unknown>).CAPTURE_WORKER_MODE||'pilot');
let initialized:Promise<unknown>|undefined;
export async function captureDB(){
 if(!initialized)initialized=(async()=>{
 await db().prepare('CREATE TABLE IF NOT EXISTS tour_capture_jobs (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,state TEXT NOT NULL,expected INTEGER NOT NULL,files TEXT NOT NULL,hfov REAL,progress INTEGER NOT NULL,message TEXT NOT NULL,lease TEXT,lease_until BIGINT NOT NULL,attempts INTEGER NOT NULL,created BIGINT NOT NULL,expires BIGINT NOT NULL,result_key TEXT,public_id TEXT NOT NULL)').run();
 await db().prepare('CREATE INDEX IF NOT EXISTS tour_capture_owner ON tour_capture_jobs(owner_id,created)').run();
 await db().prepare('CREATE TABLE IF NOT EXISTS tour_capture_workers (id TEXT PRIMARY KEY,seen BIGINT NOT NULL)').run();
 })().catch(e=>{initialized=undefined;throw e;});await initialized;return db();
}
export async function workerAuthorized(request:Request){const token=captureToken();if(token.length<32)return false;const supplied=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';const a=await sha256(token),b=await sha256(supplied);let different=0;for(let i=0;i<a.length;i++)different|=a.charCodeAt(i)^b.charCodeAt(i);return different===0;}
export async function workerOnline(){if(captureToken().length<32)return false;const row=await (await captureDB()).prepare('SELECT seen FROM tour_capture_workers WHERE id=?').bind('primary').first<{seen:number}>();return !!row&&Date.now()-Number(row.seen)<90_000;}
export const filesOf=(job:CaptureJob):string[]=>JSON.parse(job.files);
export const publicJob=(job:CaptureJob)=>({id:job.id,name:job.name,state:job.state,uploaded:filesOf(job).length,expected:job.expected,progress:Number(job.progress),message:job.message,created:Number(job.created),expires:Number(job.expires),preview:job.state==='ready'?`/api/tour-capture/${job.id}/preview`:null});
export async function cleanupFiles(job:CaptureJob,includeResult=false){const keys=[...filesOf(job),...(includeResult&&job.result_key?[job.result_key]:[])];if(keys.length)await captureBucket().delete(keys);}
export async function cleanupExpired(){const database=await captureDB();const rows=await database.prepare('SELECT * FROM tour_capture_jobs WHERE expires<? LIMIT 8').bind(Date.now()).all<CaptureJob>();for(const job of rows.results){await cleanupFiles(job,true);await database.prepare('DELETE FROM tour_capture_jobs WHERE id=? AND expires<?').bind(job.id,Date.now()).run();}}

export function captureBucket(){const storage=bucket();if(!storage)throw Error('Private capture storage unavailable');return storage;}
