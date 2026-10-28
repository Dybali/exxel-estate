import {apiFailureResponse,failureLog} from '../lib/api-failures';
import {recordOperation} from '../lib/operations';
import handler from "vinext/server/fetch-handler";
import { withResponseSecurity } from "../lib/response-security";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
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
