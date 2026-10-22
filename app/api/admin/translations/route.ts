import {env} from 'cloudflare:workers';
import {body,currentUser,isAdmin,sameOrigin,db} from '@/lib/server';
import {editorialArticles} from '@/lib/editorial';
import {translationContent} from '@/lib/translation-content';
import {prepareTranslations} from '@/lib/translation-cache';
import {translationSettings} from '@/lib/translation-runtime';
import {translationLocales,TranslationError,type TranslationLocale} from '@/lib/translation';
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private,no-store'}});
const allowed=async(request:Request)=>{const u=await currentUser(request);return Boolean(u?.email_verified&&isAdmin(u));};
export async function GET(request:Request){
 if(!await allowed(request))return reply({error:'Yönetici yetkisi gerekli.'},403);
 const settings=translationSettings();
 const rows=await db().prepare("SELECT id,title FROM listings WHERE status='published' ORDER BY updated_at DESC LIMIT 50").all<{id:string;title:string}>();
 return reply({configured:Boolean(settings.DEEPL_API_KEY),locales:translationLocales,documents:[...editorialArticles.map(a=>({kind:'blog',id:a.slug,title:a.title})),...rows.results.map(a=>({kind:'listing',id:a.id,title:a.title}))],dailyLimit:Number(settings.DEEPL_DAILY_CHAR_LIMIT)||50000,monthlyLimit:Number(settings.DEEPL_MONTHLY_CHAR_LIMIT)||300000});
}
export async function POST(request:Request){
 if(!sameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Geçersiz kaynak.'},403);
 if(!await allowed(request))return reply({error:'Yönetici yetkisi gerekli.'},403);
 const settings=translationSettings();if(!settings.DEEPL_API_KEY)return reply({error:'DeepL API anahtarı henüz bağlanmadı.'},503);
 try{
  const input=await body(request),{kind,id,locale}=input;
  if(Object.keys(input).some(k=>!['kind','id','locale'].includes(k))||typeof kind!=='string'||typeof id!=='string'||id.length>80||!translationLocales.includes(locale as TranslationLocale))return reply({error:'İçerik ve dili kontrol edin.'},400);
  const content=await translationContent(kind,id,locale as TranslationLocale);if(!content)return reply({error:'Yayında içerik bulunamadı.'},404);
  const document={...content.document,fields:Object.fromEntries(Object.entries(content.document.fields).filter(([field])=>!content.manual[field]))};
  const result=Object.keys(document.fields).length?await prepareTranslations(env.DB as never,settings,document,locale as TranslationLocale):{status:'cached'};
  return reply({status:result.status});
 }catch(e){const code=e instanceof TranslationError?e.code:'storage_error';const errors:Record<string,string>={character_limit:'Çeviri karakter sınırına ulaşıldı.',provider_quota:'DeepL hesap kotasına ulaşıldı.',provider_auth:'DeepL anahtarı doğrulanamadı.',provider_busy:'DeepL şu an yoğun. Biraz sonra yeniden deneyin.'};return reply({error:errors[code]||'Çeviri hazırlanamadı. Orijinal metin korunuyor.',code},e instanceof TranslationError?e.status:503);}
}
