export const translationLocales=['de','fr','en','ar','ru'] as const;
export type TranslationLocale=typeof translationLocales[number];
export type TranslationDocument={kind:'listing'|'blog';id:string;fields:Record<string,string>};
export type TranslationSettings={DEEPL_API_KEY?:string;DEEPL_DAILY_CHAR_LIMIT?:string;DEEPL_MONTHLY_CHAR_LIMIT?:string};
export class TranslationError extends Error{constructor(public code:string,public status=503){super(code);}}
export const translationTarget=(locale:TranslationLocale)=>({de:'DE',fr:'FR',en:'EN-GB',ar:'AR',ru:'RU'}[locale]);
export async function translationHash(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function translationSegments(doc:TranslationDocument,locale:TranslationLocale){
 const entries=Object.entries(doc.fields).filter(([,value])=>value.trim());
 if(entries.length>45||entries.some(([field,text])=>field.length>90||text.length>6000)||entries.reduce((n,[,text])=>n+text.length,0)>30000)throw new TranslationError('too_large',400);
 return Promise.all(entries.map(async([field,text])=>({field,text,key:await translationHash('deepl:auto:realestate-v1:'+locale+':'+text)})));
}
export async function translateDeepL(settings:TranslationSettings,locale:TranslationLocale,texts:string[]){
 const key=settings.DEEPL_API_KEY;if(!key)throw new TranslationError('not_configured');
 const payload={text:texts,target_lang:translationTarget(locale),context:'Real estate property listings and factual property news in Türkiye. Property names, places, figures and units refer to the original property or cited report.',preserve_formatting:true,show_billed_characters:true};
 const encoded=JSON.stringify(payload);if(!texts.length||texts.length>45||new TextEncoder().encode(encoded).byteLength>120000)throw new TranslationError('too_large',400);
 let response:Response;try{response=await fetch((key.endsWith(':fx')?'https://api-free.deepl.com':'https://api.deepl.com')+'/v2/translate',{method:'POST',headers:{Authorization:'DeepL-Auth-Key '+key,'Content-Type':'application/json'},body:encoded,redirect:'manual',signal:AbortSignal.timeout(18000)});}catch{throw new TranslationError('provider_unavailable');}
 if(!response.ok){await response.body?.cancel();throw new TranslationError(response.status===456?'provider_quota':response.status===429?'provider_busy':response.status===403?'provider_auth':'provider_unavailable');}
 const data=await response.json() as {translations?:{text?:unknown;detected_source_language?:unknown}[]};
 if(!Array.isArray(data.translations)||data.translations.length!==texts.length||data.translations.some(t=>typeof t.text!=='string'||!t.text.trim()||t.text.length>18000))throw new TranslationError('provider_response');
 return data.translations.map(t=>({text:t.text as string,language:typeof t.detected_source_language==='string'?t.detected_source_language.slice(0,10):''}));
}
