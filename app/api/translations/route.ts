import {env} from 'cloudflare:workers';
import {translationContent} from '@/lib/translation-content';
import {readTranslations} from '@/lib/translation-cache';
import {translationLocales,translationHash,type TranslationLocale} from '@/lib/translation';
export async function GET(request:Request){
 const q=new URL(request.url).searchParams,kind=q.get('kind')||'',id=q.get('id')||'',locale=q.get('locale') as TranslationLocale;
 if(!translationLocales.includes(locale)||!['listing','blog'].includes(kind)||id.length>80)return Response.json({error:'invalid_request'},{status:400});
 try{
  const content=await translationContent(kind,id,locale);if(!content)return Response.json({error:'not_found'},{status:404});
  const doc={...content.document,fields:Object.fromEntries(Object.entries(content.document.fields).filter(([field])=>!content.manual[field]))};
  const cached=Object.keys(doc.fields).length?await readTranslations(env.DB as never,doc,locale):{fields:{},complete:true};
  return Response.json({locale,revision:await translationHash(JSON.stringify(content.document.fields)),status:cached.complete?'ready':'original',fields:cached.complete?{...cached.fields,...content.manual}:content.manual,machine:Object.keys(cached.fields).length>0&&cached.complete},{headers:{'Cache-Control':'public,max-age=15,s-maxage=30','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({locale,status:'original',fields:{},machine:false},{headers:{'Cache-Control':'no-store'}});}
}
