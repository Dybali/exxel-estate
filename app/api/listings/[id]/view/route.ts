import {consumeRecoveryLimit,RecoveryError} from '@/lib/recovery-service';import {db} from '@/lib/server';
import {clientIp,currentUser,ok,error,sameOrigin,sha256} from '@/lib/server';import {statisticsDB} from '@/lib/listing-statistics-server';import {recordListingView} from '@/lib/listing-statistics';
import {parseConsent,clearViewerCookie} from '@/lib/cookie-consent';
import {recordListingEvent,type CrmDatabase} from '@/lib/crm-stats';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return error('Geçersiz kaynak.',403);
 if(!parseConsent(request.headers.get('cookie')||'')?.analytics)return ok({recorded:false},{headers:{'Cache-Control':'private, no-store','Set-Cookie':clearViewerCookie}});
 const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return error('İlan bulunamadı.',404);
 const headers=new Headers({'Cache-Control':'private, no-store'});if(/bot|crawler|spider|headless/i.test(request.headers.get('user-agent')||''))return ok({recorded:false},{headers});
 try{await consumeRecoveryLimit(db(),await sha256('listing-views:'+clientIp(request)),600);}catch(cause){if(cause instanceof RecoveryError)return error('Çok fazla görüntüleme isteği.',429);throw cause;}
 const user=await currentUser(request),cookie=(request.headers.get('cookie')||'').match(/(?:^|;\s*)em24_viewer=([a-f0-9-]{36})(?:;|$)/i)?.[1],visitor=cookie||crypto.randomUUID(),at=new Date();
 if(!user&&!cookie)headers.set('Set-Cookie',`em24_viewer=${visitor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
 const visitorHash=await sha256(`${id}:${at.toISOString().slice(0,10)}:${user?'account:'+user.id:'browser:'+visitor}`);const recorded=await recordListingView(await statisticsDB(),id,user?.id||null,visitorHash,at);
 // Page language of the counted view, for the visitor-language chart; never blocks the counter.
 if(recorded){const locale=await request.json().then((data)=>{const locale=(data as {locale?:unknown})?.locale;return typeof locale==='string'?locale:'';}).catch(()=>'');await recordListingEvent(db() as unknown as CrmDatabase,id,'view',visitorHash,user?.id||null,locale,at).catch(()=>false);}
 return ok({recorded},{headers});
}
