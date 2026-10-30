import {recordOperation} from '@/lib/operations';
import {env} from '@/lib/runtime';
import {translationContent} from '@/lib/translation-content';
import {readTranslations,prepareTranslations} from '@/lib/translation-cache';
import {translationLocales,translationHash,TranslationError,type TranslationLocale} from '@/lib/translation';
import {sameOrigin,body} from '@/lib/server';
import {translationSettings} from '@/lib/translation-runtime';
// Public visitors may prepare only existing published content, never supplied text.
// Shared leases and daily/monthly character caps also apply to this path.
export async function POST(request:Request){
 if(!sameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'invalid_origin'},{status:403});
 try{
  const input=await body(request),{kind,id,locale}=input;
  if(Object.keys(input).some(k=>!['kind','id','locale'].includes(k))||(typeof kind!=='string'||!['listing','blog'].includes(kind))||typeof id!=='string'||!id||id.length>80||(typeof locale!=='string'||!translationLocales.includes(locale as TranslationLocale)))return Response.json({error:'invalid_request'},{status:400});
  const content=await translationContent(kind,id,locale as TranslationLocale);if(!content)return Response.json({error:'not_found'},{status:404});
  const doc={...content.document,fields:Object.fromEntries(Object.entries(content.document.fields).filter(([field])=>!content.manual[field]))};
  const result=Object.keys(doc.fields).length?await prepareTranslations(env.DB as never,translationSettings(),doc,locale as TranslationLocale):{status:'cached',fields:{}};
  const pending=result.status==='pending';
  return Response.json({locale,revision:await translationHash(JSON.stringify(content.document.fields)),status:pending?'pending':'ready',fields:pending?content.manual:{...result.fields,...content.manual},machine:!pending&&Object.keys(result.fields).length>0},{status:pending?202:200,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){await recordOperation(env.DB as never,'deepl',String(e instanceof TranslationError?e.status:503)).catch(()=>{});return Response.json({error:e instanceof TranslationError?e.code:'translation_unavailable'},{status:e instanceof TranslationError?e.status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,kind=q.get('kind')||'',id=q.get('id')||'',locale=q.get('locale') as TranslationLocale;
 if(!translationLocales.includes(locale)||!['listing','blog'].includes(kind)||id.length>80)return Response.json({error:'invalid_request'},{status:400});
 try{
  const content=await translationContent(kind,id,locale);if(!content)return Response.json({error:'not_found'},{status:404});
  const doc={...content.document,fields:Object.fromEntries(Object.entries(content.document.fields).filter(([field])=>!content.manual[field]))};
  const cached=Object.keys(doc.fields).length?await readTranslations(env.DB as never,doc,locale):{fields:{},complete:true};
  return Response.json({locale,revision:await translationHash(JSON.stringify(content.document.fields)),status:cached.complete?'ready':'original',fields:cached.complete?{...cached.fields,...content.manual}:content.manual,machine:Object.keys(cached.fields).length>0&&cached.complete},{headers:{'Cache-Control':cached.complete?'public,max-age=15,s-maxage=30':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({locale,status:'original',fields:{},machine:false},{headers:{'Cache-Control':'no-store'}});}
}
