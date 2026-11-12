import {ensureMonth,ensureOps} from './operations';
import {translationServicePause,pauseTranslationService} from './translation-service';
import {translateText,translationCaps,translationConfigured,translationSegments,translationHash,TranslationError,type TranslationDocument,type ContentLocale,type TranslationSettings} from './translation';
type Database={prepare(sql:string):{bind(...values:(string|number|null)[]):{all<T>():Promise<{results:T[]}>;first<T>():Promise<T|null>;run():Promise<unknown>}};batch(statements:unknown[]):Promise<unknown>};
export async function readTranslations(database:Database,doc:TranslationDocument,locale:ContentLocale){
 const segments=await translationSegments(doc,locale);if(!segments.length)return {fields:{},complete:true,segments};
 await ensureOps(database as never);
 const keys=[...new Set(segments.map(s=>s.key))];const rows=await database.prepare(`SELECT key,translated_text FROM content_translations WHERE key IN (${keys.map(()=>'?').join(',')})`).bind(...keys).all<{key:string;translated_text:string}>();
 const values=new Map(rows.results.map(r=>[r.key,r.translated_text]));
 return {fields:Object.fromEntries(segments.filter(s=>values.has(s.key)).map(s=>[s.field,values.get(s.key)!])),complete:segments.every(s=>values.has(s.key)),segments};
}
// Gemini tokens of translations, added to the monthly Gemini totals shown in Yönetim › Sistem durumu (cost overview).
// OpenAI translations are not added there (other prices); their cost is estimated from the translated characters.
export async function recordTranslationTokens(database:Database,usage:{input:number;output:number;provider?:string},at=new Date()){
 if(usage.provider==='openai')return;
 try{const month=await ensureMonth(database as never,at);await database.prepare('UPDATE ai_monthly_usage SET input_tokens=input_tokens+?,output_tokens=output_tokens+? WHERE month=?').bind(Math.max(0,Math.ceil(usage.input)),Math.max(0,Math.ceil(usage.output)),month).run();}catch{/* Statistics never block a translation. */}
}
/** 'daily_limit' or 'monthly_limit' when translating `characters` more would pass a cap (lib/translation.ts translationCaps), else null. */
export async function translationBudget(database:Database,settings:TranslationSettings,characters:number,stamp=new Date().toISOString()){
 await ensureOps(database as never);
 const caps=translationCaps(settings),rows=await database.prepare('SELECT key,characters FROM translation_usage WHERE key IN (?,?)').bind('day:'+stamp.slice(0,10),'month:'+stamp.slice(0,7)).all<{key:string;characters:number}>();
 const used=(key:string)=>Number(rows.results.find(row=>row.key===key)?.characters||0);
 if(used('day:'+stamp.slice(0,10))+characters>caps.daily)return 'daily_limit';
 if(used('month:'+stamp.slice(0,7))+characters>caps.monthly)return 'monthly_limit';
 return null;
}
// Usage counters per UTC day and month; translationBudget() enforces the caps before a provider call.
export async function recordTranslationUsage(database:Database,characters:number,stamp=new Date().toISOString()){
 await ensureOps(database as never);
 for(const key of ['day:'+stamp.slice(0,10),'month:'+stamp.slice(0,7)])await database.prepare('INSERT INTO translation_usage(key,characters) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET characters=translation_usage.characters+excluded.characters').bind(key,characters).run();
}
export async function prepareTranslations(database:Database,settings:TranslationSettings,doc:TranslationDocument,locale:ContentLocale){
 if(!translationConfigured(settings))throw new TranslationError('not_configured');
 let cached=await readTranslations(database,doc,locale);if(cached.complete)return {status:'cached',fields:cached.fields};
 const pause=await translationServicePause(database);if(pause)return {status:'pending',fields:cached.fields,reason:pause.reason,retryAt:pause.retryAt};
 const lock=await translationHash(doc.kind+':'+doc.id+':'+locale),token=crypto.randomUUID(),time=Date.now();
 const acquired=await database.prepare('INSERT INTO translation_leases(key,token,lease_until) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET token=excluded.token,lease_until=excluded.lease_until,last_error=NULL WHERE translation_leases.lease_until<? RETURNING token').bind(lock,token,time+90000,time).first<{token:string}>();
 if(!acquired)return {status:'pending',fields:{}};
 try{
  cached=await readTranslations(database,doc,locale);if(cached.complete)return {status:'cached',fields:cached.fields};
  const missing=[...new Map(cached.segments.filter(s=>!Object.hasOwn(cached.fields,s.field)).map(s=>[s.key,s])).values()];
  const characters=missing.reduce((n,s)=>n+Array.from(s.text).length,0),stamp=new Date().toISOString();
  const over=await translationBudget(database,settings,characters,stamp);if(over)return {status:'pending',fields:cached.fields,reason:over};
  await recordTranslationUsage(database,characters,stamp);
  const {results:translated,usage}=await translateText(settings,locale,missing.map(s=>s.text));
  await recordTranslationTokens(database,usage);
  await database.batch(missing.map((s,i)=>database.prepare('INSERT INTO content_translations(key,translated_text,detected_language,created_at) VALUES(?,?,?,?) ON CONFLICT(key) DO NOTHING').bind(s.key,translated[i].text,translated[i].language,stamp)));
  return {status:'ready',fields:(await readTranslations(database,doc,locale)).fields};
 }catch(e){if(e instanceof TranslationError)await pauseTranslationService(database,e.code);await database.prepare('UPDATE translation_leases SET lease_until=?,last_error=? WHERE key=? AND token=?').bind(Date.now()+300000,e instanceof TranslationError?e.code:'storage_error',lock,token).run();throw e;}
 finally{await database.prepare('UPDATE translation_leases SET lease_until=0 WHERE key=? AND token=? AND last_error IS NULL').bind(lock,token).run();}
}
