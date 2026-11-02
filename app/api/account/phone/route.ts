import { currentUser, error, ok } from "@/lib/server";
import { phoneVerificationReady, userPhoneVerified } from "@/lib/phone-verification-server";

// Phone verification state of the signed-in user; available is false until an SMS provider is configured.
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Önce giriş yapın.", 401);
  const available = phoneVerificationReady();
  let verified = false;
  try { verified = await userPhoneVerified(user); } catch { verified = false; }
  return ok({ available, phone: user.phone || null, verified }, { headers: { "Cache-Control": "private, no-store" } });
}
