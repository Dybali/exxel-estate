import { env } from "./runtime";
import { currentUser, db, isAdmin, sha256, type User } from "./server";
import { usableKey, type TotpDatabase } from "./admin-totp";

let shared: TotpDatabase | null = null;
export const totpDB = () => shared ??= db() as unknown as TotpDatabase;
// ADMIN_TOTP_KEY: at least 32 random characters. Without it 2FA enrolment is unavailable.
export const adminTotpKey = () => usableKey((env as unknown as { ADMIN_TOTP_KEY?: string }).ADMIN_TOTP_KEY);

// The signed-in administrator, whether or not this session has confirmed its second factor yet,
// plus the session hash the confirmation cookie is bound to.
export async function adminIdentity(request: Request): Promise<{ user: User; pending: boolean; sessionHash: string } | null> {
  const user = await currentUser(request);
  if (!user?.email_verified || !isAdmin({ ...user, admin_2fa_pending: false })) return null;
  const token = (request.headers.get("cookie") || "").match(/(?:^|;\s*)excell_session=([^;]+)/)?.[1];
  if (!token) return null;
  return { user, pending: Boolean(user.admin_2fa_pending), sessionHash: await sha256(token) };
}
