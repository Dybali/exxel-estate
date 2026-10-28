import {translationServicePause,pauseTranslationService} from './translation-service';
import {translateDeepL,translationSegments,translationHash,TranslationError,type TranslationDocument,type TranslationLocale,type TranslationSettings} from './translation';
type Database={prepare(sql:string):{bind(...values:(string|number|null)[]):{all<T>():Promise<{results:T[]}>;first<T>():Promise<T|null>;run():Promise<unknown>}};batch(statements:unknown[]):Promise<unknown>};
export async function readTranslations(database:Database,doc:TranslationDocument,locale:TranslationLocale){
 const segments=await translationSegments(doc,locale);if(!segments.length)return {fields:{},complete:true,segments};
 const keys=[...new Set(segments.map(s=>s.key))];const rows=await database.prepare(`SELECT key,translated_text FROM content_translations WHERE key IN (${keys.map(()=>'?').join(',')})`).bind(...keys).all<{key:string;translated_text:string}>();
 const values=new Map(rows.results.map(r=>[r.key,r.translated_text]));
 return {fields:Object.fromEntries(segments.filter(s=>values.has(s.key)).map(s=>[s.field,values.get(s.key)!])),complete:segments.every(s=>values.has(s.key)),segments};
}
function limit(raw:string|undefined,fallback:number,max:number){const n=Number(raw);return Number.isSafeInteger(n)&&n>=0?Math.min(n,max):fallback;}
export async function prepareTranslations(database:Database,settings:TranslationSettings,doc:TranslationDocument,locale:TranslationLocale){
 if(!settings.DEEPL_API_KEY)throw new TranslationError('not_configured');
 let cached=await readTranslations(database,doc,locale);if(cached.complete)return {status:'cached',fields:cached.fields};
 const pause=await translationServicePause(database);if(pause)return {status:'pending',fields:cached.fields,reason:pause.reason,retryAt:pause.retryAt};
 const lock=await translationHash(doc.kind+':'+doc.id+':'+locale),token=crypto.randomUUID(),time=Date.now();
 const acquired=await database.prepare('INSERT INTO translation_leases(key,token,lease_until) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET token=excluded.token,lease_until=excluded.lease_until,last_error=NULL WHERE translation_leases.lease_until<? RETURNING token').bind(lock,token,time+90000,time).first<{token:string}>();
 if(!acquired)return {status:'pending',fields:{}};
 try{
  cached=await readTranslations(database,doc,locale);if(cached.complete)return {status:'cached',fields:cached.fields};
  const missing=[...new Map(cached.segments.filter(s=>!Object.hasOwn(cached.fields,s.field)).map(s=>[s.key,s])).values()];
  const characters=missing.reduce((n,s)=>n+Array.from(s.text).length,0),stamp=new Date().toISOString();
  for(const [key,cap] of [['day:'+stamp.slice(0,10),limit(settings.DEEPL_DAILY_CHAR_LIMIT,50000,500000)],['month:'+stamp.slice(0,7),limit(settings.DEEPL_MONTHLY_CHAR_LIMIT,300000,5000000)]] as const){
   // These counters are advisory only. Provider/account limits still apply.
   await database.prepare('INSERT INTO translation_usage(key,characters) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET characters=translation_usage.characters+excluded.characters').bind(key,characters).run();
  }
  const translated=await translateDeepL(settings,locale,missing.map(s=>s.text));
  await database.batch(missing.map((s,i)=>database.prepare('INSERT INTO content_translations(key,translated_text,detected_language,created_at) VALUES(?,?,?,?) ON CONFLICT(key) DO NOTHING').bind(s.key,translated[i].text,translated[i].language,stamp)));
  return {status:'ready',fields:(await readTranslations(database,doc,locale)).fields};
 }catch(e){if(e instanceof TranslationError)await pauseTranslationService(database,e.code);await database.prepare('UPDATE translation_leases SET lease_until=?,last_error=? WHERE key=? AND token=?').bind(Date.now()+300000,e instanceof TranslationError?e.code:'storage_error',lock,token).run();throw e;}
 finally{await database.prepare('UPDATE translation_leases SET lease_until=0 WHERE key=? AND token=? AND last_error IS NULL').bind(lock,token).run();}
}
