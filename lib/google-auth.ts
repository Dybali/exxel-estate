import { env } from "cloudflare:workers";

type GoogleEnv = Cloudflare.Env & {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
};

export const GOOGLE_CALLBACK_PATH = "/api/auth/callback/google";
export const GOOGLE_FLOW_COOKIE = "exxel_google_flow";

export function googleConfig() {
  const values = env as GoogleEnv;
  const clientId = values.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = values.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = values.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:" || url.pathname !== GOOGLE_CALLBACK_PATH || url.search || url.hash) return null;
    return { clientId, clientSecret, redirectUri, origin: url.origin };
  } catch {
    return null;
  }
}

export function safeNextPath(value: string | null, fallback = "/hesabim") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://exxel.invalid");
    if (url.origin !== "https://exxel.invalid") return fallback;
    if (url.pathname.startsWith("/api/auth/")) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function randomUrlToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function flowCookie(state: string, clear = false) {
  return `${GOOGLE_FLOW_COOKIE}=${clear ? "" : state}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=${clear ? 0 : 600}`;
}

export function redirectNoStore(url: string, cookies: string[] = []) {
  const headers = new Headers({ Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export function loginError(code: string, origin: string) {
  const url = new URL("/giris", origin);
  url.searchParams.set("google", code);
  return redirectNoStore(url.toString(), [flowCookie("", true)]);
}
