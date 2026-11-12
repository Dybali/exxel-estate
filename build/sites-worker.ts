import {apiFailureResponse,failureLog} from '../lib/api-failures';
import {recordOperation} from '../lib/operations';
import handler from "vinext/server/fetch-handler";
import { withResponseSecurity } from "../lib/response-security";
import { negotiateLocale } from "../lib/locale-negotiation";
import { LOCALE_HEADER, PATH_HEADER } from "../lib/request-headers";
import { serviceDB } from "../lib/server";
import { dailyJobs, healthJob, type JobSettings } from "../lib/scheduled-jobs";

// Pass ?lang and the path to server components so pages render in the requested language.
function withRequestContext(request: Request) {
  const url = new URL(request.url), lang = url.searchParams.get("lang");
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, negotiateLocale(lang, request.headers.get("cookie"), request.headers.get("accept-language")));
  headers.set(PATH_HEADER, url.pathname);
  return new Request(request, { headers });
}

export default {
  // Cron triggers (wrangler.jsonc): hourly health check; daily promotion expiry and email digest.
  // The same jobs run on other hosts through /api/cron/[job] (lib/scheduled-jobs.ts).
  async scheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    const settings = env as unknown as JobSettings;
    if (controller.cron === "7 * * * *") {
      ctx.waitUntil(healthJob(settings).catch((cause) => console.error("health_check_crashed", String(cause))));
      return;
    }
    const jobs = dailyJobs(settings);
    ctx.waitUntil(jobs.promotions);
    ctx.waitUntil(jobs.digest);
    ctx.waitUntil(jobs.translations);
  },
  async fetch(incoming: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const request=withRequestContext(incoming);
    const reference=crypto.randomUUID();
    try {
      const response=await handler.fetch(request,env,ctx);
      if(response.status>=500){console.error(failureLog(request,response.status,reference));ctx.waitUntil(recordOperation(serviceDB() as never,'http',String(response.status)).catch(()=>{}));}
      return withResponseSecurity(apiFailureResponse(request,response,reference));
    }catch(error){
      console.error(failureLog(request,500,reference));ctx.waitUntil(recordOperation(serviceDB() as never,'http','500').catch(()=>{}));
      if(new URL(request.url).pathname.startsWith('/api/'))return withResponseSecurity(apiFailureResponse(request,new Response(null,{status:500}),reference));
      throw error;
    }
  },
};
