import {recordOperation} from './operations';
import {env,waitUntil} from './runtime';
import {serviceDB} from './server';
import {translationLocales,type TranslationSettings} from './translation';
import {prepareTranslations} from './translation-cache';
import {translationContent} from './translation-content';
export const translationSettings=()=>env as unknown as TranslationSettings;
export function scheduleListingTranslations(id:string){
 const database=serviceDB();if(!translationSettings().DEEPL_API_KEY||!database)return;
 waitUntil(Promise.allSettled(translationLocales.map(async locale=>{
  const content=await translationContent('listing',id,locale);if(!content)return;
  const fields=Object.fromEntries(Object.entries(content.document.fields).filter(([field])=>!content.manual[field]));
  if(Object.keys(fields).length)await prepareTranslations(database as never,translationSettings(),{...content.document,fields},locale);
 })).then(results=>{for(const result of results)if(result.status==='rejected'){console.warn('translation_job_failed',result.reason?.code||'storage_error');waitUntil(recordOperation(database as never,'deepl',String(result.reason?.status||503)).catch(()=>{}));}}));
}
