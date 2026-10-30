import { body, currentUser, error, ok, sameOrigin } from "@/lib/server";
import { env, waitUntil } from "@/lib/runtime";
import { siteUrl } from "@/lib/request-context";
import type { EmailSettings } from "@/lib/email";
import { notifyProjectReservation, type NotificationDatabase } from "@/lib/email-notifications";
import { createReservation, ProjectError } from "@/lib/projects";
import { projectsDB } from "@/lib/projects-server";

// Reservation request ("yer ayırtma talebi", no payment). Works without an account.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const { id } = await params, user = await currentUser(request);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Talep bilgilerini kontrol edin."); }
  try {
    const saved = await createReservation(projectsDB(), id, data, user?.id || null);
    // Email the publisher in the background; failures never affect the request.
    waitUntil(notifyProjectReservation(projectsDB() as unknown as NotificationDatabase, { ...(env as unknown as EmailSettings), SITE_URL: siteUrl() }, saved).catch(() => {}));
    return ok({ id: saved.id, status: saved.status }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ProjectError) return error(cause.message, cause.status);
    throw cause;
  }
}
