import { body, currentUser, error, ok, sameOrigin } from "@/lib/server";
import { ownerProjects, ownerReservations, ProjectError, updateReservationStatus } from "@/lib/projects";
import { canPublishProjects, projectsDB } from "@/lib/projects-server";

const privateHeaders = { headers: { "Cache-Control": "private, no-store" } };

// The publisher's own projects (with moderation state) and the reservation requests they received.
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  const [allowed, projects, reservations] = await Promise.all([canPublishProjects(user), ownerProjects(projectsDB(), user.id), ownerReservations(projectsDB(), user.id)]);
  return ok({ allowed, projects, reservations }, privateHeaders);
}

// Only the project owner can change the status of a request they received.
export async function PATCH(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Giriş gerekli.", 401);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Talep durumunu kontrol edin."); }
  try { return ok(await updateReservationStatus(projectsDB(), user.id, data.id, data.status), privateHeaders); }
  catch (cause) { if (cause instanceof ProjectError) return error(cause.message, cause.status); throw cause; }
}
