import { env } from "cloudflare:workers";
import { body, currentUser, db, error, ok, sameOrigin } from "@/lib/server";
import { emailReady, type EmailSettings } from "@/lib/email";
import { emailPreferences, setEmailPreferences, type NotificationDatabase } from "@/lib/email-notifications";

const headers = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  const prefs = await emailPreferences(db() as unknown as NotificationDatabase, user.id);
  return ok({ messages: prefs.messages, alerts: prefs.alerts, configured: emailReady(env as unknown as EmailSettings) }, headers);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  return ok(await setEmailPreferences(db() as unknown as NotificationDatabase, user.id, data), headers);
}
