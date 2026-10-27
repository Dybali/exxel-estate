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
    return runWithConnectorBinding(binding, async () => {try{const response=await handler.fetch(request,env,ctx);if(response.status>=500)ctx.waitUntil(recordOperation(env.DB as never,'http',String(response.status)).catch(()=>{}));return withResponseSecurity(response);}catch(error){ctx.waitUntil(recordOperation(env.DB as never,'http','500').catch(()=>{}));throw error;}});
  },
};
