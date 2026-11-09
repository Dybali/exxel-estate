// Shared pieces of the /api/services/* routes (member check, write limit, error mapping).
import { consumeRecoveryLimit, RecoveryError } from "./recovery-service";
import { currentUser, db, error, sha256 } from "./server";
import { ServiceError, ownerFirm } from "./services";
import { servicesDB } from "./services-server";

export const privateHeaders = { headers: { "Cache-Control": "private, no-store" } };

/** Signed-in member with a verified e-mail (currentUser already refuses unverified sessions here). */
export async function serviceMember(request: Request) {
  const user = await currentUser(request);
  return user?.email_verified ? user : null;
}
/** Writes: at most `max` per member and purpose in 15 minutes (shared auth_limits table). */
export async function serviceLimited(purpose: string, userId: string, max = 30) {
  try { await consumeRecoveryLimit(db(), await sha256(`${purpose}:${userId}`), max); return null; }
  catch (cause) { if (cause instanceof RecoveryError) return error(cause.message, cause.status); throw cause; }
}
export const serviceFailure = (cause: unknown) => { if (cause instanceof ServiceError) return error(cause.message, cause.status); throw cause; };
/** The member's firm, or an error response. */
export async function memberFirm(request: Request) {
  const user = await serviceMember(request);
  if (!user) return { response: error("Giriş ve e-posta doğrulaması gerekli.", 401) } as const;
  const firm = await ownerFirm(servicesDB(), user.id);
  if (!firm) return { response: error("Önce hizmet firması profilinizi oluşturun.", 404) } as const;
  return { user, firm } as const;
}
