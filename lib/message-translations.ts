// Private message translation for the reader. Only messages the actor received are sent to DeepL,
// and each (message, language) pair is translated once; the stored copy is removed with the message.
import {translateDeepL,TranslationError,type TranslationSettings} from './translation';
import {recordTranslationUsage} from './translation-cache';
import {pauseTranslationService,translationServicePause} from './translation-service';
export const messageLocales=['tr','de','fr','en','ar','fa','ru','nl'] as const;
export type MessageLocale=typeof messageLocales[number];
type Statement={bind(...values:(string|number|null)[]):Statement;all<T>():Promise<{results:T[]}>;first<T>():Promise<T|null>;run():Promise<unknown>};
type Database={prepare(sql:string):Statement};
type UsageDatabase=Database&{batch(statements:unknown[]):Promise<unknown>};
export type MessageTranslation={text:string;source:string};
export class MessageTranslationError extends Error{constructor(message:string,public status=400){super(message);}}
export const MESSAGE_TRANSLATIONS_SCHEMA=`CREATE TABLE IF NOT EXISTS message_translations (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  locale text NOT NULL, translated_text text NOT NULL, source_language text NOT NULL, created_at text NOT NULL,
  PRIMARY KEY(message_id,locale))`;
export const MESSAGE_TRANSLATION_BATCH=20;
const context='Private chat between a property buyer and a seller or estate agent about a real estate listing in Türkiye. Keep names, places, prices and units unchanged.';
const uuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const initialized=new WeakMap<Database,Promise<unknown>>();
async function ensureSchema(database:Database){
 if(!initialized.has(database))initialized.set(database,database.prepare(MESSAGE_TRANSLATIONS_SCHEMA).bind().run().catch(error=>{initialized.delete(database);throw error;}));
 await initialized.get(database);
}
// Skip the provider for text that is obviously already in the reader's language.
export function alreadyInLocale(text:string,locale:MessageLocale){
 if(locale==='tr')return /[ğışĞİŞ]/.test(text);
 if(locale==='ru'){const letters=text.match(/\p{L}/gu)||[];return letters.length>0&&letters.filter(c=>/\p{Script=Cyrillic}/u.test(c)).length/letters.length>0.6;}
 return false;
}
export async function translateMessages(database:Database,usage:UsageDatabase|undefined,settings:TranslationSettings,actorId:string,rawIds:unknown,rawLocale:unknown):Promise<{status:'ready'|'pending'|'unavailable';translations:Record<string,MessageTranslation>}>{
 if(typeof rawLocale!=='string'||!(messageLocales as readonly string[]).includes(rawLocale))throw new MessageTranslationError('Dil seçimi geçersiz.');
 const locale=rawLocale as MessageLocale;
 if(!Array.isArray(rawIds)||rawIds.some(id=>typeof id!=='string'||!uuid(id)))throw new MessageTranslationError('Mesaj seçimi geçersiz.');
 const ids=[...new Set(rawIds.map(id=>id.toLowerCase()))];
 if(!ids.length||ids.length>MESSAGE_TRANSLATION_BATCH)throw new MessageTranslationError('Mesaj seçimi geçersiz.');
 if(!settings.DEEPL_API_KEY||!usage)return {status:'unavailable',translations:{}};
 await ensureSchema(database);
 const marks=ids.map(()=>'?').join(',');
 const received=(await database.prepare(`SELECT id,body FROM messages WHERE recipient_id=? AND id IN (${marks})`).bind(actorId,...ids).all<{id:string;body:string}>()).results;
 if(!received.length)return {status:'ready',translations:{}};
 const stored=(await database.prepare(`SELECT message_id,translated_text,source_language FROM message_translations WHERE locale=? AND message_id IN (${received.map(()=>'?').join(',')})`).bind(locale,...received.map(m=>String(m.id))).all<{message_id:string;translated_text:string;source_language:string}>()).results;
 const translations:Record<string,MessageTranslation>={},done=new Set(stored.map(row=>String(row.message_id)));
 // An empty stored text means the message was already in this language.
 for(const row of stored)if(row.translated_text)translations[String(row.message_id)]={text:row.translated_text,source:row.source_language};
 const missing=received.filter(m=>!done.has(String(m.id))&&String(m.body||'').trim()&&!alreadyInLocale(String(m.body),locale));
 if(!missing.length)return {status:'ready',translations};
 if(await translationServicePause(usage))return {status:'pending',translations};
 const stamp=new Date().toISOString();
 await recordTranslationUsage(usage,missing.reduce((n,m)=>n+Array.from(String(m.body)).length,0),stamp);
 let results;
 try{results=await translateDeepL(settings,locale,missing.map(m=>String(m.body)),context);}
 catch(cause){if(!(cause instanceof TranslationError))throw cause;await pauseTranslationService(usage,cause.code);return {status:'unavailable',translations};}
 for(const [index,message] of missing.entries()){
  const source=results[index].language.toLowerCase().slice(0,2),same=source===locale;
  await database.prepare('INSERT INTO message_translations(message_id,locale,translated_text,source_language,created_at) VALUES(?,?,?,?,?) ON CONFLICT(message_id,locale) DO NOTHING').bind(String(message.id),locale,same?'':results[index].text,source,stamp).run();
  if(!same)translations[String(message.id)]={text:results[index].text,source};
 }
 return {status:'ready',translations};
}
