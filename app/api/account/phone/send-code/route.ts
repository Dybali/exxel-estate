import { body, currentUser, error, ok, RequestInputError, sameOrigin } from "@/lib/server";
import { configuredSmsProvider } from "@/lib/sms";
import { PhoneVerificationError, sendPhoneCode } from "@/lib/phone-verification";
import { phoneCodeSecret, phoneDB } from "@/lib/phone-verification-server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Önce giriş yapın.", 401);
  const provider = configuredSmsProvider(), secret = phoneCodeSecret();
  if (!provider || !secret) return error("Telefon doğrulaması henüz kullanılamıyor.", 503);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch (cause) { return error(cause instanceof RequestInputError ? cause.message : "Geçersiz istek."); }
  try {
    const sent = await sendPhoneCode(phoneDB(), { userId: user.id, phone: data.phone, secret, send: (to, text) => provider.send(to, text) });
    return ok(sent, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof PhoneVerificationError) return Response.json({ error: cause.message, retryAfter: cause.retryAfter }, { status: cause.status, headers: cause.retryAfter ? { "Retry-After": String(cause.retryAfter) } : undefined });
    console.error("phone send-code failed", cause instanceof Error ? cause.message : cause);
    return error("SMS gönderilemedi. Daha sonra tekrar deneyin.", 502);
  }
}
