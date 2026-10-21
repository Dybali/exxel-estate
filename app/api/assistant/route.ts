import {env} from 'cloudflare:workers';
import {body,currentUser,db,sameOrigin,sha256} from '@/lib/server';
import {AssistantError,canonicalFilters,chatInput,filterHref,type AssistantLanguage} from '@/lib/assistant';
import {assistantCopy} from '@/lib/assistant-copy';
import {planSearch,explainListings,type AISettings} from '@/lib/assistant-provider';
import {findAssistantListings,reserveAssistantUsage} from '@/lib/assistant-server';
const settings=()=>env as unknown as AISettings;
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request){const user=await currentUser(request);return reply({authenticated:Boolean(user),available:Boolean(user&&settings().GEMINI_API_KEY),textOnly:true,languages:['tr','en','de','ar','fr','ru']});}
export async function POST(request:Request) {
  let language:AssistantLanguage='tr';
  if(!sameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'input'},403);
  try{
    const user=await currentUser(request);
    if(!user)return reply({error:'auth_required'},401);
    if(!settings().GEMINI_API_KEY)throw new AssistantError('unavailable',503);
    const raw=await body(request);if(JSON.stringify(raw).length>16000)throw new AssistantError('input',413);
    const parsed=chatInput.safeParse(raw);if(!parsed.success)throw new AssistantError('input');
    const input=parsed.data;language=input.language==='auto'?input.uiLanguage:input.language;
    const database=db();
    const quotas=(env as Cloudflare.Env).DB;
    if(!quotas)throw new AssistantError('unavailable',503);
    const client=user.id;
    const recordUsage=await reserveAssistantUsage(quotas,await sha256('assistant:'+settings().GEMINI_API_KEY+':'+client),Number(settings().AI_DAILY_CALL_LIMIT)||400);
    const plan=await planSearch(settings(),input,recordUsage);language=input.language==='auto'?plan.language:input.language;
    const copy=assistantCopy[language];
    const filters=canonicalFilters(plan.filters,plan.intent!=='clarify'&&plan.intent!=='chat');
    const base={language,filters,unverified:plan.unverified,listings:[],total:0,href:filterHref(filters)};
    if(plan.intent==='clarify'||plan.intent==='chat')return reply({...base,message:plan.reply});
    if(!filters.purpose&&plan.intent==='search')return reply({...base,message:copy.welcome});
    if((plan.intent==='compare'||plan.intent==='details')&&!input.shownIds.length)return reply({...base,message:copy.showFirst});
    const result=await findAssistantListings(database,filters,plan.intent==='search'?undefined:input.shownIds);
    const message=result.total===0?copy.none:plan.intent==='search'?copy.found.replace('{n}',String(result.total)).replace('{shown}',String(result.listings.length)):await explainListings(settings(),input,result.listings,language,recordUsage);
    return reply({...base,...result,message,searched:true});
  }catch(cause){
    const code=cause instanceof AssistantError?cause.code:'provider';
    return reply({error:code,message:assistantCopy[language][code as keyof typeof assistantCopy.tr]||assistantCopy[language].provider},cause instanceof AssistantError?cause.status:503);
  }
}
