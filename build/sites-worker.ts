import {apiFailureResponse,failureLog} from '../lib/api-failures';
import {recordOperation} from '../lib/operations';
import handler from "vinext/server/fetch-handler";
import { withResponseSecurity } from "../lib/response-security";
import { isLocale } from "../lib/i18n-dictionary";
import { LOCALE_HEADER, PATH_HEADER } from "../lib/request-headers";
import { db } from "../lib/server";
import { siteUrl } from "../lib/site-url";
import { sendDailyDigests, type NotificationDatabase } from "../lib/email-notifications";
import { expirePromotions, type OrderDatabase } from "../lib/orders";
import { alertOnFailure, runHealthChecks } from "../lib/health";
import { externalR2Ready, headExternalImage } from "../lib/external-r2";
import type { EmailSettings } from "../lib/email";

// Pass ?lang and the path to server components so pages render in the requested language.
function withRequestContext(request: Request) {
  const url = new URL(request.url), lang = url.searchParams.get("lang");
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, isLocale(lang) ? lang : "tr");
  headers.set(PATH_HEADER, url.pathname);
  return new Request(request, { headers });
}

export default {
  // Cron triggers (wrangler.jsonc): hourly health check; daily promotion expiry and email digest.
  async scheduled(controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    const settings = { ...(env as unknown as EmailSettings & { ALERT_EMAIL?: string; EXXEL_ADMIN_EMAIL?: string }), SITE_URL: siteUrl() };
    if (controller.cron === "7 * * * *") {
      ctx.waitUntil(runHealthChecks(db() as never, { imageStorageReady: externalR2Ready, listImages: () => headExternalImage("listings/00000000-0000-4000-8000-000000000000/00000000-0000-4000-8000-000000000000.jpg"), privateBucket: env.BUCKET }).then((checks) => alertOnFailure(checks, settings)).catch((cause) => console.error("health_check_crashed", String(cause))));
      return;
    }
    ctx.waitUntil(expirePromotions(db() as unknown as OrderDatabase).catch((cause) => console.error("promotion_expiry_failed", String(cause))));
    ctx.waitUntil(sendDailyDigests(db() as unknown as NotificationDatabase, settings).catch((cause) => console.error("daily_digest_failed", String(cause))));
  },
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
