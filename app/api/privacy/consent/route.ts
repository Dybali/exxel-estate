import {body,error,ok,sameOrigin} from '@/lib/server';
import {consentCookie,clearViewerCookie,type CookieConsent} from '@/lib/cookie-consent';
export async function POST(request:Request){
  if(!sameOrigin(request)||request.headers.get('sec-fetch-site')==='cross-site')return error('Geçersiz kaynak.',403);
  let data:Record<string,unknown>;try{data=await body(request);}catch{return error('Geçersiz istek.');}
  if(typeof data.analytics!=='boolean'||typeof data.externalMedia!=='boolean')return error('Geçerli çerez tercihleri seçin.');
  const consent:CookieConsent={version:1,analytics:data.analytics,externalMedia:data.externalMedia,updatedAt:Date.now()};
  const headers=new Headers({'Cache-Control':'private, no-store'});
  headers.append('Set-Cookie',consentCookie(consent));
  if(!consent.analytics)headers.append('Set-Cookie',clearViewerCookie);
  return ok({consent},{headers});
}
