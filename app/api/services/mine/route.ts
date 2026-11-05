import { consumeRecoveryLimit, RecoveryError } from "@/lib/recovery-service";
import { body, currentUser, db, error, ok, sameOrigin, sha256 } from "@/lib/server";
import { createFirm, deleteFirm, firmImageKeys, ownerFirm, ServiceError, updateFirm } from "@/lib/services";
import { removeServiceMedia, serviceActor, serviceImagesStored, servicesDB } from "@/lib/services-server";

const privateHeaders = { headers: { "Cache-Control": "private, no-store" } };

// Any signed-in member with a verified e-mail can run one service firm ("Hizmet firmam" in Hesabım);
// their account role does not change. currentUser() already refuses unverified sessions here.
async function member(request: Request) {
  const user = await currentUser(request);
  return user?.email_verified ? user : null;
}
// Writes: at most 30 per member in 15 minutes (shared auth_limits table).
async function limited(userId: string) {
  try { await consumeRecoveryLimit(db(),await sha256("service-firm:" + userId), 30); return null; }
  catch (cause) { if (cause instanceof RecoveryError) return error(cause.message, cause.status); throw cause; }
}
const failure = (cause: unknown) => { if (cause instanceof ServiceError) return error(cause.message, cause.status); throw cause; };
// New photos (by this member) must exist in storage before the profile may use them.
async function storedProblem(data: Record<string, unknown>, userId: string, previous: string[] = []) {
  const keys = firmImageKeys({ logo: data.logo, cover: data.cover, photos: data.photos }).filter((key) => key.startsWith(`listings/${userId}/`) && !previous.includes(key));
  const problem = await serviceImagesStored(keys);
  return problem ? error(problem, problem.includes("yapılandırılmamış") ? 503 : 400) : null;
}

export async function GET(request: Request) {
  const user = await member(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  return ok({ firm: await ownerFirm(servicesDB(), user.id) }, privateHeaders);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await member(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const blocked = await limited(user.id);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Firma bilgilerini kontrol edin."); }
  const problem = await storedProblem(data, user.id);
  if (problem) return problem;
  try { return ok(await createFirm(servicesDB(), serviceActor(user), data), { status: 201, ...privateHeaders }); }
  catch (cause) { return failure(cause); }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await member(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const blocked = await limited(user.id);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Firma bilgilerini kontrol edin."); }
  try {
    const current = await ownerFirm(servicesDB(), user.id);
    if (!current) return error("Firma bulunamadı.", 404);
    const problem = await storedProblem(data, user.id, firmImageKeys(current));
    if (problem) return problem;
    const result = await updateFirm(servicesDB(), serviceActor(user), current.id, data);
    await removeServiceMedia(result.removedKeys);
    return ok({ id: result.id, status: result.status, updatedAt: result.updatedAt }, privateHeaders);
  } catch (cause) { return failure(cause); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await member(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const blocked = await limited(user.id);
  if (blocked) return blocked;
  try {
    const current = await ownerFirm(servicesDB(), user.id);
    if (!current) return error("Firma bulunamadı.", 404);
    const result = await deleteFirm(servicesDB(), serviceActor(user), current.id);
    await removeServiceMedia(result.imageKeys);
    return ok({ success: true }, privateHeaders);
  } catch (cause) { return failure(cause); }
}
