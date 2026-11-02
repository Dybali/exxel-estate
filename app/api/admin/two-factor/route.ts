import { body, error, ok, RequestInputError, sameOrigin, str } from "@/lib/server";
import { admin2faCookie, clearAdmin2faCookie, confirmEnrolment, disableTwoFactor, regenerateRecoveryCodes, startEnrolment, twoFactorStatus, TwoFactorError, verifySecondFactor } from "@/lib/admin-totp";
import { adminIdentity, adminTotpKey, totpDB } from "@/lib/admin-2fa-server";

const noStore = { "Cache-Control": "private, no-store" };

// Administrator two-factor login (TOTP). "verify" is the only action allowed while the
// session still has to confirm its second factor; everything else needs a confirmed session.
export async function GET(request: Request) {
  const admin = await adminIdentity(request);
  if (!admin) return error("Yönetici yetkisi gerekli.", 403);
  const key = adminTotpKey();
  if (!key) return ok({ available: false, enabled: false, pending: false, recoveryCodesLeft: 0 }, { headers: noStore });
  const status = await twoFactorStatus(totpDB(), String(admin.user.id));
  return ok({ available: true, ...status, pending: admin.pending }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await adminIdentity(request);
  if (!admin) return error("Yönetici yetkisi gerekli.", 403);
  const key = adminTotpKey();
  if (!key) return error("İki adımlı doğrulama henüz yapılandırılmadı.", 503);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch (cause) { return error(cause instanceof RequestInputError ? cause.message : "Geçersiz istek."); }
  const action = str(data.action, 40), code = str(data.code, 40), userId = String(admin.user.id), database = totpDB();
  try {
    if (action === "verify") {
      const method = await verifySecondFactor(database, key, userId, code);
      const status = await twoFactorStatus(database, userId);
      return ok({ verified: true, method, recoveryCodesLeft: status.recoveryCodesLeft }, { headers: { ...noStore, "Set-Cookie": await admin2faCookie(key, userId, admin.sessionHash) } });
    }
    if (admin.pending) return error("Önce iki adımlı doğrulama kodunu girin.", 403);
    if (action === "start") return ok(await startEnrolment(database, key, userId, admin.user.email), { headers: noStore });
    if (action === "confirm") {
      const result = await confirmEnrolment(database, key, userId, code);
      return ok(result, { headers: { ...noStore, "Set-Cookie": await admin2faCookie(key, userId, admin.sessionHash) } });
    }
    if (action === "disable") {
      await disableTwoFactor(database, key, userId, code);
      return ok({ enabled: false }, { headers: { ...noStore, "Set-Cookie": clearAdmin2faCookie } });
    }
    if (action === "recovery_codes") return ok({ recoveryCodes: await regenerateRecoveryCodes(database, key, userId, code) }, { headers: noStore });
    return error("Geçersiz işlem.");
  } catch (cause) {
    if (cause instanceof TwoFactorError) return error(cause.message, cause.status);
    console.error("admin two-factor failed", cause instanceof Error ? cause.message : cause);
    return error("İşlem tamamlanamadı.", 500);
  }
}
