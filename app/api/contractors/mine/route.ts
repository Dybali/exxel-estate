import { body, error, ok, sameOrigin } from "@/lib/server";
import { privateHeaders, serviceLimited, serviceMember } from "@/lib/service-api";
import { firmAllowed, firmRefusal, type KindDatabase } from "@/lib/account-kind";
import { ContractorError, contractorImageKeys, deleteContractor, newLandRequestCount, ownerContractor, saveContractor } from "@/lib/contractors";
import { contractorActor, contractorImagesStored, contractorsDB, removeContractorMedia } from "@/lib/contractors-server";

// Any signed-in member with a verified e-mail can run one contractor firm ("Müteahhit firmam" in
// Hesabım); only contractor accounts may open one (lib/account-kind.ts). Writes share the 30-per-15-minutes limit pattern.
const failure = (cause: unknown) => { if (cause instanceof ContractorError) return error(cause.message, cause.status); throw cause; };

export async function GET(request: Request) {
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const firm = await ownerContractor(contractorsDB(), user.id);
  return ok({ firm, newRequests: firm ? await newLandRequestCount(contractorsDB(), user.id) : 0 }, privateHeaders);
}

// Creates the firm or saves an edit (both go to review; see lib/contractors.ts saveContractor).
export async function PUT(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const blocked = await serviceLimited("contractor-firm", user.id);
  if (blocked) return blocked;
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Firma bilgilerini kontrol edin."); }
  try {
    const current = await ownerContractor(contractorsDB(), user.id);
    // A new firm needs a contractor account (one account, one type); an existing firm stays editable.
    if (!current && !await firmAllowed(contractorsDB() as unknown as KindDatabase, user, "contractor")) return error(firmRefusal("contractor"), 403);
    const previous = current ? contractorImageKeys(current) : [];
    // New photos (by this member) must exist in storage before the profile may use them.
    const projects = Array.isArray(data.projects) ? data.projects.map((item) => ({ photos: Array.isArray((item as { photos?: unknown })?.photos) ? (item as { photos: unknown[] }).photos.filter((url): url is string => typeof url === "string") : [] })) : [];
    const keys = contractorImageKeys({ logo: data.logo, cover: data.cover, projects }).filter((key) => key.startsWith(`listings/${user.id}/`) && !previous.includes(key));
    const problem = await contractorImagesStored(keys);
    if (problem) return error(problem, problem.includes("yapılandırılmamış") ? 503 : 400);
    const result = await saveContractor(contractorsDB(), contractorActor(user), data);
    await removeContractorMedia(result.removedKeys);
    return ok({ id: result.id, status: result.status }, { status: result.created ? 201 : 200, ...privateHeaders });
  } catch (cause) { return failure(cause); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await serviceMember(request);
  if (!user) return error("Giriş ve e-posta doğrulaması gerekli.", 401);
  const blocked = await serviceLimited("contractor-firm", user.id);
  if (blocked) return blocked;
  try {
    const current = await ownerContractor(contractorsDB(), user.id);
    // A new firm needs a contractor account (one account, one type); an existing firm stays editable.
    if (!current && !await firmAllowed(contractorsDB() as unknown as KindDatabase, user, "contractor")) return error(firmRefusal("contractor"), 403);
    if (!current) return error("Firma bulunamadı.", 404);
    const result = await deleteContractor(contractorsDB(), contractorActor(user), current.id);
    await removeContractorMedia(result.imageKeys);
    return ok({ success: true }, privateHeaders);
  } catch (cause) { return failure(cause); }
}
