import {apiFailureResponse,failureLog} from '../lib/api-failures';
import {recordOperation} from '../lib/operations';
import handler from "vinext/server/fetch-handler";
import { withResponseSecurity } from "../lib/response-security";
import { isLocale } from "../lib/i18n-dictionary";
import { LOCALE_HEADER, PATH_HEADER } from "../lib/request-headers";

// Pass ?lang and the path to server components so pages render in the requested language.
function withRequestContext(request: Request) {
  const url = new URL(request.url), lang = url.searchParams.get("lang");
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, isLocale(lang) ? lang : "tr");
  headers.set(PATH_HEADER, url.pathname);
  return new Request(request, { headers });
}

export default {
  async fetch(incoming: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const request=withRequestContext(incoming);
    const reference=crypto.randomUUID();
    try {
      const response=await handler.fetch(request,env,ctx);
      if(response.status>=500){console.error(failureLog(request,response.status,reference));ctx.waitUntil(recordOperation(env.DB as never,'http',String(response.status)).catch(()=>{}));}
      return withResponseSecurity(apiFailureResponse(request,response,reference));
    }catch(error){
      console.error(failureLog(request,500,reference));ctx.waitUntil(recordOperation(env.DB as never,'http','500').catch(()=>{}));
      if(new URL(request.url).pathname.startsWith('/api/'))return withResponseSecurity(apiFailureResponse(request,new Response(null,{status:500}),reference));
      throw error;
    }
  },
};
