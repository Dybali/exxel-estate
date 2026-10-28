import {apiFailureResponse,failureLog} from '../lib/api-failures';
import {recordOperation} from '../lib/operations';
import handler from "vinext/server/fetch-handler";
import { withResponseSecurity } from "../lib/response-security";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, async () => {
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
    });
  },
};
