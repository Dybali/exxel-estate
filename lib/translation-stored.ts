import {readTranslations} from './translation-cache';
import {listingLanguage} from './listing-language';
import {isContentLocale,type TranslationDocument} from './translation';
type Database=Parameters<typeof readTranslations>[0];
/** A machine translation already in content_translations, for the server-rendered page (same shape the client hook uses). */
export type StoredTranslation={locale:string;fields:Record<string,string>;machine:true};
// Server rendering reads saved translations only: it never calls a provider, so a page costs nothing and bots
// cannot cause a paid translation (docs/translations.md › Bot koruması). Like GET /api/translations, a document
// counts only when every field is saved; otherwise null and the page shows the original as before, and the
// browser asks for the translation (components/ContentTranslation.tsx). Any database error also gives null.
export async function storedTranslation(database:Database|null|undefined,doc:TranslationDocument,locale:string):Promise<StoredTranslation|null>{
 if(!database||!isContentLocale(locale)||!Object.values(doc.fields).some(text=>text.trim()))return null;
 try{
  const cached=await readTranslations(database,doc,locale);
  return cached.complete&&Object.keys(cached.fields).length?{locale,fields:cached.fields,machine:true}:null;
 }catch{return null;}
}
type ListingText={id:string;title:string;description:string;presentation?:{language?:string}|null;translations?:Partial<Record<string,{title?:string;description?:string}>>|null};
// Fields the owner translated by hand keep priority (lib/listing-seo.ts localizedListingText) and are not looked
// up; nothing is looked up in the listing's own language (lib/listing-language.ts). The document matches
// lib/translation-content.ts, so the keys are those the nightly batch and POST /api/translations write.
export async function storedListingTranslation(database:Database|null|undefined,listing:ListingText,locale:string){
 if(locale===listingLanguage(listing))return null;
 const manual=locale==='tr'?undefined:listing.translations?.[locale];
 const fields=Object.fromEntries((['title','description'] as const).filter(field=>!manual?.[field]?.trim()).map(field=>[field,listing[field]]));
 return storedTranslation(database,{kind:'listing',id:listing.id,fields},locale);
}
