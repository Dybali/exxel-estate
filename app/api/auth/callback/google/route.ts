import { createSession, currentUser, db, now, requestOrigin, sessionCookie, sha256 } from "@/lib/server";
import { flowCookie, GOOGLE_CALLBACK_PATH, GOOGLE_FLOW_COOKIE, googleConfig, loginError, redirectNoStore, safeNextPath } from "@/lib/google-auth";

type Flow = { code_verifier: string; role: string; next_path: string; link_user_id: string | null; expires_at: string };
type GoogleProfile = { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

function avatarFromGoogle(value: unknown) {
  if (typeof value !== "string") return null;
  const url = value.trim().slice(0, 500);
  return url.startsWith("https://") ? url : null;
}

export async function GET(request: Request) {
  const config = googleConfig();
  const url = new URL(request.url);
  // Public origin: behind Mittwald's HTTPS proxy request.url is plain http on an internal host.
  const origin = requestOrigin(request);
  if (!config || origin !== config.origin || url.pathname !== GOOGLE_CALLBACK_PATH) {
    return loginError("unavailable", origin);
  }
  if (url.searchParams.has("error")) return loginError("cancelled", origin);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${GOOGLE_FLOW_COOKIE}=([^;]+)`))?.[1];
  if (!code || !state || !cookieState || state !== cookieState || state.length > 100 || code.length > 4096) {
    return loginError("invalid", origin);
  }

  const stateHash = await sha256(state);
  const flow = await db().prepare("SELECT code_verifier,role,next_path,link_user_id,expires_at FROM oauth_flows WHERE state_hash=?")
    .bind(stateHash).first<Flow>();
  if (!flow || flow.expires_at <= now()) return loginError("expired", origin);
  await db().prepare("DELETE FROM oauth_flows WHERE state_hash=?").bind(stateHash).run();

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: flow.code_verifier,
      }),
    });
    if (!tokenResponse.ok) return loginError("exchange", origin);
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) return loginError("exchange", origin);

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!profileResponse.ok) return loginError("identity", origin);
    const profile = await profileResponse.json() as GoogleProfile;
    const email = profile.email?.trim().toLowerCase();
    if (!profile.sub || !email || profile.email_verified !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return loginError("identity", origin);
    }
    const avatarUrl = avatarFromGoogle(profile.picture);

    const mapped = await db().prepare("SELECT user_id FROM oauth_accounts WHERE provider='google' AND provider_user_id=?")
      .bind(profile.sub).first<{ user_id: string }>();
    let userId = mapped?.user_id;
    if (flow.link_user_id) {
      const signedIn = await currentUser(request);
      if (!signedIn || signedIn.id !== flow.link_user_id || signedIn.email.toLowerCase() !== email) {
        return loginError("link", origin);
      }
      if (userId && userId !== signedIn.id) return loginError("linked_elsewhere", origin);
      if (!userId) {
        await db().prepare("INSERT INTO oauth_accounts(provider,provider_user_id,user_id,created_at) VALUES('google',?,?,?)")
          .bind(profile.sub, signedIn.id, now()).run();
        userId = signedIn.id;
      }
      await db().prepare("UPDATE users SET email_verified=1, avatar_url=COALESCE(?, avatar_url) WHERE id=?").bind(avatarUrl, userId).run();
    } else if (!userId) {
      const existing = await db().prepare("SELECT id,email_verified FROM users WHERE LOWER(email)=?").bind(email).first<{ id: string; email_verified: number }>();
      if (existing) {
        // Google confirmed this mailbox, so a local account whose owner already verified the same address
        // is linked and signed in. An unverified one is not: its password may have been chosen by someone
        // else (pre-registration takeover). Its owner verifies or resets the password first (docs/auth.md).
        if (!Number(existing.email_verified)) return loginError("unverified", origin);
        const other = await db().prepare("SELECT provider_user_id FROM oauth_accounts WHERE user_id=? AND provider='google'")
          .bind(String(existing.id)).first<{ provider_user_id: string }>();
        if (other) return loginError("existing", origin);
        await db().prepare("INSERT INTO oauth_accounts(provider,provider_user_id,user_id,created_at) VALUES('google',?,?,?)")
          .bind(profile.sub, String(existing.id), now()).run();
        userId = String(existing.id);
        // Keep a photo the member chose; only fill an empty one.
        if (avatarUrl) await db().prepare("UPDATE users SET avatar_url=COALESCE(avatar_url, ?) WHERE id=?").bind(avatarUrl, userId).run();
      } else {
        userId = crypto.randomUUID();
        const name = profile.name?.trim().slice(0, 100) || email.split("@")[0];
        const role = ["buyer", "individual", "agent"].includes(flow.role) ? flow.role : "buyer";
        await db().batch([
          db().prepare("INSERT INTO users(id,email,password_hash,email_verified,name,role,agent_status,company,avatar_url,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
            .bind(userId, email, "google-only", 1, name, role, role === "agent" ? "pending" : "none", null, avatarUrl, now()),
          db().prepare("INSERT INTO oauth_accounts(provider,provider_user_id,user_id,created_at) VALUES('google',?,?,?)")
            .bind(profile.sub, userId, now()),
        ]);
      }
    } else if (avatarUrl) {
      await db().prepare("UPDATE users SET avatar_url=? WHERE id=?").bind(avatarUrl, userId).run();
    }

    const session = await createSession(userId);
    const destination = new URL(safeNextPath(flow.next_path), config.origin).toString();
    return redirectNoStore(destination, [sessionCookie(session), flowCookie("", true)]);
  } catch {
    return loginError("failed", origin);
  }
}
