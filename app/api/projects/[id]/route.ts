import { body, currentUser, error, ok, sameOrigin } from "@/lib/server";
import { deleteProject, ProjectError, projectById, updateProject } from "@/lib/projects";
import { canPublishProjects, projectActor, projectImagesStored, projectsDB, removeProjectMedia } from "@/lib/projects-server";

const privateHeaders = { headers: { "Cache-Control": "private, no-store" } };

// Approved projects for everyone; pending/rejected ones only for their owner and administrators.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, user = await currentUser(request);
  const project = await projectById(projectsDB(), id, user ? projectActor(user) : null);
  if (!project) return error("Proje bulunamadı.", 404);
  return ok({ project }, privateHeaders);
}

// Owner (still allowed to publish) or administrator. Owner edits go back to review.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request), { id } = await params;
  if (!user) return error("Giriş gerekli.", 401);
  const actor = projectActor(user);
  if (!actor.admin && !await canPublishProjects(user)) return error("Proje düzenlemek için onaylı emlakçı veya inşaat firması hesabı gerekir.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Proje bilgilerini kontrol edin."); }
  try {
    const current = await projectById(projectsDB(), id, actor);
    if (!current) return error("Proje bulunamadı.", 404);
    if (current.ownerId !== user.id && !actor.admin) return error("Bu projeyi düzenleme yetkiniz yok.", 403);
    const previous = new Set(current.images);
    const added = Array.isArray(data.images) ? data.images.filter((url): url is string => typeof url === "string" && url.startsWith(`/api/media/listings/${current.ownerId}/`) && !previous.has(url)).map((url) => url.slice("/api/media/".length)) : [];
    const problem = await projectImagesStored(added);
    if (problem) return error(problem, problem.includes("yapılandırılmamış") ? 503 : 400);
    const result = await updateProject(projectsDB(), actor, id, data);
    await removeProjectMedia(result.removedKeys);
    return ok({ id: result.id, moderation: result.moderation, updatedAt: result.updatedAt }, privateHeaders);
  } catch (cause) {
    if (cause instanceof ProjectError) return error(cause.message, cause.status);
    throw cause;
  }
}

// Owner or administrator; also removes the project's photos and reservation requests.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request), { id } = await params;
  if (!user) return error("Giriş gerekli.", 401);
  try {
    const result = await deleteProject(projectsDB(), projectActor(user), id);
    await removeProjectMedia(result.imageKeys);
    return ok({ success: true }, privateHeaders);
  } catch (cause) {
    if (cause instanceof ProjectError) return error(cause.message, cause.status);
    throw cause;
  }
}
