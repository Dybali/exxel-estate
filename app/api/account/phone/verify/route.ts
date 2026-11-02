import { body, currentUser, db, error, ok, RequestInputError, sameOrigin } from "@/lib/server";
import { PhoneVerificationError, verifyPhoneCode } from "@/lib/phone-verification";
import { phoneCodeSecret, phoneDB } from "@/lib/phone-verification-server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Önce giriş yapın.", 401);
  const secret = phoneCodeSecret();
  if (!secret) return error("Telefon doğrulaması henüz kullanılamıyor.", 503);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch (cause) { return error(cause instanceof RequestInputError ? cause.message : "Geçersiz istek."); }
  try {
    const phone = await verifyPhoneCode(phoneDB(), { userId: user.id, code: data.code, secret });
    // The verified number becomes the account's contact phone.
    await db().prepare("UPDATE users SET phone=? WHERE id=?").bind(phone, user.id).run();
    return ok({ phone, verified: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof PhoneVerificationError) return error(cause.message, cause.status);
    console.error("phone verify failed", cause instanceof Error ? cause.message : cause);
    return error("Doğrulama tamamlanamadı. Tekrar deneyin.", 500);
  }
}
