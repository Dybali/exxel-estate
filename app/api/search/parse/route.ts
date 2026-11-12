import {env} from '@/lib/runtime';
import {body,clientIp,RequestInputError,sameOrigin,serviceDB,sha256} from '@/lib/server';
import {currentRates} from '@/lib/tcmb-server';
import {recordOperation} from '@/lib/operations';
import {isLocale,translate,type Locale} from '@/lib/i18n-dictionary';
import {createRateLimiter,geminiNlFilters,reserveNlSearchAi,resolveNlSearch,type NlSearchSettings} from '@/lib/nl-search-server';
// Natural-language search: free text → /ilanlar filters (lib/nl-search.ts, docs/nl-search.md).
// Open to visitors; same-origin only; 30 requests per 10 minutes per IP and isolate. Gemini is used
// only for leftover words, within its own daily caps and the assistant's shared counters. The query
// is neither stored nor logged.
export const dynamic='force-dynamic';
const limiter=createRateLimiter(30,10*60_000);
import {aiSettings} from '@/lib/ai-limits-server';
const settings=()=>env as unknown as NlSearchSettings;
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function POST(request:Request){
 if(!sameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'forbidden'},403);
 let input:Record<string,unknown>;
 try{input=await body(request);}catch(cause){if(cause instanceof RequestInputError)return reply({error:'input'},400);throw cause;}
 const locale:Locale=isLocale(input.locale)?input.locale:'tr',t=(key:string)=>translate(key,locale);
 const query=typeof input.query==='string'?input.query.replace(/\s+/g,' ').trim():'';
 if(!query||query.length>300)return reply({error:'input',message:t('Arama metni gerekli.')},400);
 const client=await sha256('nl-search:'+clientIp(request));
 if(!limiter.take(client))return reply({error:'rate_limit',message:t('Çok fazla arama yaptınız. Lütfen biraz bekleyin.')},429);
 const config=await aiSettings<NlSearchSettings>(),database=serviceDB();
 const ai=input.ai!==false&&config.GEMINI_API_KEY&&database?async(text:string,recognized:Parameters<typeof geminiNlFilters>[2])=>{
  const record=await reserveNlSearchAi(database as never,client,config);
  if(!record)return null;
  try{return await geminiNlFilters(config,text,recognized,record);}
  catch(cause){await recordOperation(database as never,'gemini',/status (\d{3})/.exec(String((cause as Error)?.message))?.[1]||'503').catch(()=>{});throw cause;}
 }:null;
 const result=await resolveNlSearch({query,locale,currency:typeof input.currency==='string'?input.currency:null,t,rates:await currentRates(),ai});
 return reply(result);
}
