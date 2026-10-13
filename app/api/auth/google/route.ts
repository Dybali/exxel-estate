import { currentUser, db, now, ok, sha256 } from "@/lib/server";
import { flowCookie, googleConfig, pkceChallenge, randomUrlToken, redirectNoStore, safeNextPath } from "@/lib/google-auth";

export async function GET(request: Request) {
  const config = googleConfig();
  const url = new URL(request.url);
  if (url.searchParams.get("status") === "1") {
    return ok({ enabled: Boolean(config && url.origin === config.origin) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!config) return redirectNoStore(`${url.origin}/giris?google=unavailable`);

  // OAuth cookies must be set on the same host that receives Google's callback.
  if (url.origin !== config.origin) {
    return redirectNoStore(`${url.origin}/giris?google=unavailable`);
  }

  const link = url.searchParams.get("link") === "1";
  const user = link ? await currentUser(request) : null;
  if (link && !user) return redirectNoStore(`${url.origin}/giris?next=%2Fhesabim%3Ftab%3Dprofil`);
  const desiredRole = url.searchParams.get("role");
  const role = desiredRole === "individual" || desiredRole === "agent" ? desiredRole : "buyer";
  const nextPath = safeNextPath(url.searchParams.get("next"), link ? "/hesabim?tab=profil" : "/hesabim");
  const state = randomUrlToken();
  const verifier = randomUrlToken();
  const expiry = new Date(Date.now() + 10 * 60_000).toISOString();
  await db().prepare("DELETE FROM oauth_flows WHERE expires_at<?").bind(now()).run();
  await db().prepare("INSERT INTO oauth_flows(state_hash,code_verifier,role,next_path,link_user_id,expires_at) VALUES(?,?,?,?,?,?)")
    .bind(await sha256(state), verifier, role, nextPath, user?.id ?? null, expiry).run();

  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.searchParams.set("client_id", config.clientId);
  auth.searchParams.set("redirect_uri", config.redirectUri);
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("scope", "openid email profile");
  auth.searchParams.set("state", state);
  auth.searchParams.set("code_challenge", await pkceChallenge(verifier));
  auth.searchParams.set("code_challenge_method", "S256");
  auth.searchParams.set("prompt", "select_account");
  return redirectNoStore(auth.toString(), [flowCookie(state)]);
}
