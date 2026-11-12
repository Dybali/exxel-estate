import {env} from './runtime';
import {aiSettings} from './ai-limits-server';
import {listingById,serviceDB} from './server';
import {contentLocales,type TranslationSettings} from './translation';
import {translationContent} from './translation-content';
import {pollTranslationBatches,queueBatchTranslation,submitTranslationBatch,type BatchDatabase,type BatchSource} from './translation-batch';
export const translationSettings=()=>env as unknown as TranslationSettings;
// Listings are no longer translated into every language when they are published or edited (owner's decision
// 2026-11-12, to cut cost): a language is translated the first time a visitor opens the listing in it
// (POST /api/translations), or by an administrator in Yönetim › Çeviriler. XML imports are the exception: they
// are translated into every language overnight at the batch price (lib/translation-batch.ts).
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
export async function queueImportedListing(id:string){const database=batchDB();if(database)await queueBatchTranslation(database,id).catch(cause=>console.warn('translation_queue_failed',String(cause)));}
/** Daily: collect finished jobs, then submit the queue. Never rejects. */
export async function translationBatchJob(){
 const database=batchDB();if(!database)return {poll:null,submit:null};
 const settings=await aiSettings();
 const poll=await pollTranslationBatches(database,settings).catch(cause=>({error:String(cause).slice(0,200)}));
 const submit=await submitTranslationBatch(database,settings,listingSource).catch(cause=>({status:'error',error:String(cause).slice(0,200)}));
 if(submit&&'status'in submit&&submit.status!=='empty'&&submit.status!=='not_configured')console.info('translation_batch',JSON.stringify(submit));
 return {poll,submit};
}
/** Hourly: only collects finished jobs. Never rejects. */
export async function translationBatchPoll(){const database=batchDB();if(!database)return null;return pollTranslationBatches(database,translationSettings()).catch(cause=>({error:String(cause).slice(0,200)}));}
