import {recordOperation} from '@/lib/operations';
import {env} from '@/lib/runtime';
import {body,currentUser,db,sameOrigin,sha256} from '@/lib/server';
import {AssistantError,assistantLanguages,canonicalFilters,chatInput,filterHref,type AssistantLanguage} from '@/lib/assistant';
import {assistantCopy,assistantResultSummary} from '@/lib/assistant-copy';
import {planSearch,explainListings,type AISettings} from '@/lib/assistant-provider';
import {findAssistantListings,reserveAssistantUsage} from '@/lib/assistant-server';
const settings=()=>env as unknown as AISettings;
const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(request:Request){const user=await currentUser(request);return reply({authenticated:Boolean(user),available:Boolean(user&&settings().GEMINI_API_KEY),textOnly:true,languages:assistantLanguages});}
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
    const filters=canonicalFilters(plan.filters,false);
    const base={language,filters,unverified:plan.unverified,listings:[],total:0,href:filterHref(filters)};
    // Currency is needed only for an actual price constraint; keep clarification in the conversation.
    if((filters.minPrice!==null||filters.maxPrice!==null)&&!filters.currency)return reply({...base,message:copy.currency});
    if(plan.intent==='clarify'||plan.intent==='chat')return reply({...base,message:plan.intent==='clarify'&&!filters.purpose?copy.welcome:plan.reply});
    if(!filters.purpose&&plan.intent==='search')return reply({...base,message:copy.welcome});
    if((plan.intent==='compare'||plan.intent==='details')&&!input.shownIds.length)return reply({...base,message:copy.showFirst});
    const result=await findAssistantListings(database,filters,plan.intent==='search'?undefined:input.shownIds);
    const message=result.total===0?copy.none:plan.intent==='search'?assistantResultSummary(language,result.total):await explainListings(settings(),input,result.listings,language,recordUsage);
    return reply({...base,...result,message,searched:true});
  }catch(cause){
    const code=cause instanceof AssistantError?cause.code:'provider';
    const status=cause instanceof AssistantError?cause.status:503;if(status>=500||status===429)await recordOperation(env.DB as never,'gemini',String(status)).catch(()=>{});
    return reply({error:code,message:assistantCopy[language][code as keyof typeof assistantCopy.tr]||assistantCopy[language].provider},cause instanceof AssistantError?cause.status:503);
  }
}
