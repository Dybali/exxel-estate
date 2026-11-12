import {env} from './runtime';
import {aiSettings} from './ai-limits-server';
import {listingById,serviceDB} from './server';
import {contentLocales,type TranslationSettings} from './translation';
import {prepareTranslations} from './translation-cache';
import {translationContent} from './translation-content';
import {pollTranslationBatches,queueBatchTranslation,submitTranslationBatch,translateQueueDirectly,type BatchDatabase,type BatchSource} from './translation-batch';
export const translationSettings=()=>env as unknown as TranslationSettings;
// Every listing is translated into every language once (owner's decision 2026-11-12): new, edited and approved
// listings are queued and translated overnight at the batch price (lib/translation-batch.ts), or hour by hour at
// the normal price while the Batch API needs billing. Until then a language is translated the first time a visitor
// opens the listing in it (POST /api/translations). Blog texts and messages are translated on demand only.
const batchDB=()=>serviceDB() as unknown as BatchDatabase|null;
const listingSource:BatchSource=async id=>{
 const listing=await listingById(id);
 if(!listing)return null;
 if(listing.status==='pending')return 'waiting';
 if(listing.status!=='published')return null;
 const docs=[];
 for(const locale of contentLocales){
  const content=await translationContent('listing',id,locale);if(!content)continue;
  docs.push({locale,doc:{...content.document,fields:Object.fromEntries(Object.entries(content.document.fields).filter(([field])=>!content.manual[field]))}});
 }
 return docs;
};
export async function queueListingTranslation(id:string){const database=batchDB();if(database)await queueBatchTranslation(database,id).catch(cause=>console.warn('translation_queue_failed',String(cause)));}
/** Daily: collect finished jobs, then submit the queue. Never rejects. */
export async function translationBatchJob(){
 const database=batchDB();if(!database)return {poll:null,submit:null};
 const settings=await aiSettings();
 const poll=await pollTranslationBatches(database,settings).catch(cause=>({error:String(cause).slice(0,200)}));
 const submit=await submitTranslationBatch(database,settings,listingSource).catch(cause=>({status:'error',error:String(cause).slice(0,200)}));
 if(submit&&'status'in submit&&submit.status!=='empty'&&submit.status!=='not_configured')console.info('translation_batch',JSON.stringify(submit));
 return {poll,submit};
}
/** Hourly: collects finished jobs and, while the Batch API needs billing, translates a few listings directly. Never rejects. */
export async function translationBatchPoll(){
 const database=batchDB();if(!database)return null;
 const poll=await pollTranslationBatches(database,translationSettings()).catch(cause=>({error:String(cause).slice(0,200)}));
 const settings=await aiSettings().catch(()=>translationSettings());
 const direct=await translateQueueDirectly(database,settings,listingSource,async(doc,locale)=>{
  const result=await prepareTranslations(database as never,settings,doc,locale);
  return result.status==='pending'&&'reason' in result&&result.reason?'stop':'done';
 }).catch(cause=>({status:'error',error:String(cause).slice(0,200)}));
 return {poll,direct};
}
