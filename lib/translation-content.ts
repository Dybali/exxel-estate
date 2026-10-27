import {editorialArticles,editorialFields} from './editorial';
import {listingById} from './server';
import type {TranslationDocument,TranslationLocale} from './translation';
export async function translationContent(kind:string,id:string,locale:TranslationLocale):Promise<{document:TranslationDocument;manual:Record<string,string>}|null>{
 if(kind==='blog'){
  const article=editorialArticles.find(a=>a.slug===id);if(!article)return null;
  const fields=editorialFields(article);
  return {document:{kind:'blog',id,fields},manual:{}};
 }
 if(kind!=='listing'||id.length>80)return null;
 const listing=await listingById(id);if(!listing||listing.source!=='demo'&&listing.status!=='published')return null;
 const manual=listing.translations?.[locale];
 return {document:{kind:'listing',id,fields:{title:listing.title,description:listing.description}},manual:manual?Object.fromEntries(Object.entries(manual).filter(([,text])=>typeof text==='string'&&text.trim())):{}};
}
