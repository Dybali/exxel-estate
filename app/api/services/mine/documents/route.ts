import { bucket, error, ok, sameOrigin } from "@/lib/server";
import { officeFileType, readOfficeFile } from "@/lib/office-verification";
import { addDocument, deleteDocument, firmDocuments, isDocumentKind } from "@/lib/service-extras";
import { memberFirm, privateHeaders, serviceFailure, serviceLimited } from "@/lib/service-api";
import { servicesDB } from "@/lib/services-server";

// Firm documents ("Belgeli firma"): PDF, JPG or PNG up to 5 MB in private storage; only the owner
// and administrators can open them. The raw file is the request body, the kind is in X-Document-Kind.
export async function GET(request: Request) {
  const found = await memberFirm(request);
  if ("response" in found) return found.response;
  return ok({ documents: await firmDocuments(servicesDB(), found.firm.id) }, privateHeaders);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const found = await memberFirm(request);
  if ("response" in found) return found.response;
  const blocked = await serviceLimited("service-document", found.user.id, 10);
  if (blocked) return blocked;
  const kind = request.headers.get("X-Document-Kind");
  if (!isDocumentKind(kind)) return error("Belge türünü seçin.");
  const storage = bucket();
  if (!storage) return error("Güvenli belge deposu kullanılamıyor.", 503);
  const type = request.headers.get("Content-Type") || "";
  let bytes: Uint8Array, ext: string;
  try { bytes = await readOfficeFile(request); ext = officeFileType(bytes, type); } catch (cause) { return error((cause as Error).message); }
  const id = crypto.randomUUID(), key = `private/service-documents/${found.firm.id}/${id}.${ext}`;
  await storage.put(key, bytes, { httpMetadata: { contentType: type } });
  try { return ok({ document: await addDocument(servicesDB(), found.firm.id, { id, kind, objectKey: key, contentType: type, size: bytes.length }) }, { status: 201, ...privateHeaders }); }
  catch (cause) { await storage.delete(key).catch(() => {}); return serviceFailure(cause); }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const found = await memberFirm(request);
  if ("response" in found) return found.response;
  try {
    const key = await deleteDocument(servicesDB(), found.firm.id, new URL(request.url).searchParams.get("id"));
    await bucket()?.delete(key).catch(() => {});
    return ok({ success: true }, privateHeaders);
  } catch (cause) { return serviceFailure(cause); }
}
