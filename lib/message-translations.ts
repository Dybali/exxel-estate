// Private message translation for the reader. Only messages the actor received are sent to Gemini (paid tier),
// and each (message, language) pair is translated once; the stored copy is removed with the message.
import {translateText,translationConfigured,TranslationError,type TranslationSettings} from './translation';
import {recordTranslationTokens,recordTranslationUsage,translationBudget} from './translation-cache';
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
// Monthly translation allowance per reader (owner's request 2026-11-25): 150 messages for everyone for now, one
// message counted as 5 words on average, so 750 words a month. Only messages actually translated into another
// language use it; stored translations, text already in the reader's language and admins cost nothing. When it is
// used up, messages show in their original language until the 1st of the next month (Istanbul time).
// MESSAGE_TRANSLATION_MESSAGES changes the number of messages.
export const MESSAGE_WORDS_PER_MESSAGE=5,MESSAGE_TRANSLATION_MESSAGES_DEFAULT=150;
export const messageQuotaMessages=(settings:{MESSAGE_TRANSLATION_MESSAGES?:unknown})=>{const n=Number(settings.MESSAGE_TRANSLATION_MESSAGES);return Number.isSafeInteger(n)&&n>=0&&n<=100000?n:MESSAGE_TRANSLATION_MESSAGES_DEFAULT;};
export const MESSAGE_QUOTA_SCHEMA='CREATE TABLE IF NOT EXISTS message_translation_quota(user_id TEXT NOT NULL,month TEXT NOT NULL,words INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,month))';
/** Words in a message (letters, with apostrophes and hyphens inside a word); at least 1. */
export const messageWords=(text:string)=>Math.max(1,(text.match(/\p{L}[\p{L}\p{M}'’-]*/gu)||[]).length);
const istanbul=(at:Date)=>new Date(at.getTime()+3*3600_000);
export const quotaMonth=(at:Date)=>istanbul(at).toISOString().slice(0,7);
/** Start of the next month in Istanbul, as a UTC ISO string. */
export function quotaResetsAt(at:Date){const local=istanbul(at);return new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,1)-3*3600_000).toISOString();}
export type MessageQuota={limit:number;used:number;remaining:number;resetsAt:string};
const quotaReady=new WeakMap<Database,Promise<unknown>>();
async function ensureQuota(database:Database){
 if(!quotaReady.has(database))quotaReady.set(database,database.prepare(MESSAGE_QUOTA_SCHEMA).bind().run().catch(error=>{quotaReady.delete(database);throw error;}));
 await quotaReady.get(database);
}
async function usedWords(database:Database,userId:string,at:Date){
 await ensureQuota(database);
 const row=await database.prepare('SELECT words FROM message_translation_quota WHERE user_id=? AND month=?').bind(userId,quotaMonth(at)).first<{words:number}>();
 return Number(row?.words)||0;
}
/** The reader's allowance in messages (words ÷ 5, rounded up for what is used). */
export async function messageQuota(database:Database,userId:string,limitMessages:number,at=new Date()):Promise<MessageQuota>{
 const used=Math.min(limitMessages,Math.ceil(await usedWords(database,userId,at)/MESSAGE_WORDS_PER_MESSAGE));
 return {limit:limitMessages,used,remaining:limitMessages-used,resetsAt:quotaResetsAt(at)};
}
const context='Private chat on a real estate site in Türkiye between a member and a seller, estate agent, contractor or service firm (painter, plumber, mover, lawyer…). Keep names, places, prices and units unchanged.';
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
/** quota: the reader's monthly allowance in messages (null = unlimited, e.g. administrators). */
export async function translateMessages(database:Database,usage:UsageDatabase|undefined,settings:TranslationSettings,actorId:string,rawIds:unknown,rawLocale:unknown,quota:{messages:number;at?:Date}|null=null):Promise<{status:'ready'|'pending'|'unavailable'|'quota';translations:Record<string,MessageTranslation>}>{
 if(typeof rawLocale!=='string'||!(messageLocales as readonly string[]).includes(rawLocale))throw new MessageTranslationError('Dil seçimi geçersiz.');
 const locale=rawLocale as MessageLocale;
 if(!Array.isArray(rawIds)||rawIds.some(id=>typeof id!=='string'||!uuid(id)))throw new MessageTranslationError('Mesaj seçimi geçersiz.');
 const ids=[...new Set(rawIds.map(id=>id.toLowerCase()))];
 if(!ids.length||ids.length>MESSAGE_TRANSLATION_BATCH)throw new MessageTranslationError('Mesaj seçimi geçersiz.');
 if(!translationConfigured(settings)||!usage)return {status:'unavailable',translations:{}};
 await ensureSchema(database);
 const marks=ids.map(()=>'?').join(',');
 const received=(await database.prepare(`SELECT id,body FROM messages WHERE recipient_id=? AND id IN (${marks})`).bind(actorId,...ids).all<{id:string;body:string}>()).results;
 if(!received.length)return {status:'ready',translations:{}};
 const stored=(await database.prepare(`SELECT message_id,translated_text,source_language FROM message_translations WHERE locale=? AND message_id IN (${received.map(()=>'?').join(',')})`).bind(locale,...received.map(m=>String(m.id))).all<{message_id:string;translated_text:string;source_language:string}>()).results;
 const translations:Record<string,MessageTranslation>={},done=new Set(stored.map(row=>String(row.message_id)));
 // An empty stored text means the message was already in this language.
 for(const row of stored)if(row.translated_text)translations[String(row.message_id)]={text:row.translated_text,source:row.source_language};
 // Text without letters (emoji, numbers, a phone number) needs no translation.
 let missing=received.filter(m=>!done.has(String(m.id))&&/\p{L}/u.test(String(m.body||''))&&!alreadyInLocale(String(m.body),locale));
 if(!missing.length)return {status:'ready',translations};
 // Monthly allowance: translate messages in order while words are left (the last one may go slightly over).
 const quotaAt=quota?.at||new Date(),limitWords=quota?quota.messages*MESSAGE_WORDS_PER_MESSAGE:0;
 let quotaCut=false;
 if(quota){
  let left=limitWords-await usedWords(database,actorId,quotaAt);const fits=[];
  for(const m of missing){if(left<=0){quotaCut=true;break;}fits.push(m);left-=messageWords(String(m.body));}
  missing=fits;
  if(!missing.length)return {status:'quota',translations};
 }
 if(await translationServicePause(usage))return {status:'pending',translations};
 const stamp=new Date().toISOString(),characters=missing.reduce((n,m)=>n+Array.from(String(m.body)).length,0);
 // Over the daily or monthly cap the original text is shown (lib/translation.ts translationCaps).
 if(await translationBudget(usage,settings,characters,stamp))return {status:'unavailable',translations};
 await recordTranslationUsage(usage,characters,stamp);
 let results;
 try{const answer=await translateText(settings,locale,missing.map(m=>String(m.body)),context);results=answer.results;await recordTranslationTokens(usage,answer.usage);}
 catch(cause){if(!(cause instanceof TranslationError))throw cause;await pauseTranslationService(usage,cause.code);return {status:'unavailable',translations};}
 for(const [index,message] of missing.entries()){
  const source=results[index].language.toLowerCase().slice(0,2),same=source===locale;
  await database.prepare('INSERT INTO message_translations(message_id,locale,translated_text,source_language,created_at) VALUES(?,?,?,?,?) ON CONFLICT(message_id,locale) DO NOTHING').bind(String(message.id),locale,same?'':results[index].text,source,stamp).run();
  if(!same)translations[String(message.id)]={text:results[index].text,source};
 }
 if(quota){
  const words=missing.reduce((n,m,index)=>results[index].language.toLowerCase().slice(0,2)===locale?n:n+messageWords(String(m.body)),0);
  if(words)await database.prepare('INSERT INTO message_translation_quota(user_id,month,words) VALUES(?,?,?) ON CONFLICT(user_id,month) DO UPDATE SET words=message_translation_quota.words+excluded.words').bind(actorId,quotaMonth(quotaAt),words).run();
 }
 return {status:quotaCut?'quota':'ready',translations};
}
