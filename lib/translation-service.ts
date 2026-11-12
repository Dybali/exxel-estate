type Database={prepare(sql:string):{bind(...args:(string|number|null)[]):{first<T>():Promise<T|null>;run():Promise<unknown>}}};
const ready=new WeakMap<object,Promise<unknown>>();
export async function translationServiceDB(database:Database){let promise=ready.get(database);if(!promise){promise=database.prepare('CREATE TABLE IF NOT EXISTS translation_service_state(id TEXT PRIMARY KEY,blocked_until BIGINT NOT NULL,last_error TEXT NOT NULL)').bind().run();ready.set(database,promise);promise.catch(()=>ready.delete(database));}await promise;}
export async function translationServicePause(database:Database,at=Date.now()){await translationServiceDB(database);const state=await database.prepare("SELECT blocked_until,last_error FROM translation_service_state WHERE id='deepl'").bind().first<{blocked_until:number;last_error:string}>();return state&&Number(state.blocked_until)>at?{reason:state.last_error,retryAt:Number(state.blocked_until)}:null;}
export async function pauseTranslationService(database:Database,code:string,at=Date.now()){
 const duration=code==='provider_auth'||code==='provider_config'?3600000:code==='provider_quota'?1800000:code==='provider_busy'?60000:code==='provider_unavailable'?30000:0;if(!duration)return;
 await translationServiceDB(database);await database.prepare("INSERT INTO translation_service_state(id,blocked_until,last_error) VALUES('deepl',?,?) ON CONFLICT(id) DO UPDATE SET blocked_until=excluded.blocked_until,last_error=excluded.last_error").bind(at+duration,code).run();
}
