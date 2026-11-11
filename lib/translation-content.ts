import {editorialArticles,editorialFields} from './editorial';
import {listingById} from './server';
import {listingLanguage} from './listing-language';
import type {ContentLocale,TranslationDocument} from './translation';
// Returns null when there is nothing to translate into `locale`: unknown or unpublished content, or the
// language the text is already written in (Turkish for the blog; the listing's own language).
export async function translationContent(kind:string,id:string,locale:ContentLocale):Promise<{document:TranslationDocument;manual:Record<string,string>}|null>{
 if(kind==='blog'){
  if(locale==='tr')return null;
  const article=editorialArticles.find(a=>a.slug===id);if(!article)return null;
  const fields=editorialFields(article);
  return {document:{kind:'blog',id,fields},manual:{}};
 }
 if(kind!=='listing'||id.length>80)return null;
 const listing=await listingById(id);if(!listing||listing.source!=='demo'&&listing.status!=='published')return null;
 if(listingLanguage(listing)===locale)return null;
 const manual=locale==='tr'?undefined:listing.translations?.[locale];
 return {document:{kind:'listing',id,fields:{title:listing.title,description:listing.description}},manual:manual?Object.fromEntries(Object.entries(manual).filter(([,text])=>typeof text==='string'&&text.trim())):{}};
}
