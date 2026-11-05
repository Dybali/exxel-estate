import { body, currentUser, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { adminContactMessages, ContactError, setContactHandled } from "@/lib/contact";
import { contactDB } from "@/lib/contact-server";
import { env } from "@/lib/runtime";
import { emailProvider, type EmailSettings } from "@/lib/email";

const headers = { headers: { "Cache-Control": "private, no-store" } };

// Contact form messages for administrators, newest first.
export async function GET(request: Request) {
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  const list = await adminContactMessages(contactDB(), new URL(request.url).searchParams.get("status") || "all");
  // emailProvider tells the panel whether the inline reply can send (null: only the mailto link works).
  return ok({ ...list, emailProvider: emailProvider(env as unknown as EmailSettings) }, headers);
}

// Mark a message handled (or open again).
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    return ok({ message: await setContactHandled(contactDB(), admin.id, data.id, data.handled) }, headers);
  } catch (cause) {
    if (cause instanceof ContactError) return error(cause.message, cause.status);
    throw cause;
  }
}
