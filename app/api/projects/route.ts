import { body, currentUser, error, ok, sameOrigin } from "@/lib/server";
import { createProject, ProjectError, projectImageKeys, publicProjects } from "@/lib/projects";
import { canPublishProjects, projectActor, projectImagesStored, projectsDB } from "@/lib/projects-server";

// Public list of approved projects. Filters: city, status, rooms, maxPrice (+currency), page.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const result = await publicProjects(projectsDB(), { city: q.get("city"), status: q.get("status"), rooms: q.get("rooms"), maxPrice: q.get("maxPrice"), currency: q.get("currency"), page: q.get("page") });
  return ok(result, { headers: { "Cache-Control": "public,max-age=20,s-maxage=45,stale-while-revalidate=180" } });
}

// Approved agents, construction companies and administrators create projects; non-admin projects wait for review.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const user = await currentUser(request);
  if (!user) return error("Proje eklemek için giriş yapın.", 401);
  if (!await canPublishProjects(user)) return error("Proje eklemek için onaylı emlakçı veya inşaat firması hesabı ve onaylı ofis yetki belgesi gerekir.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Proje bilgilerini kontrol edin."); }
  const problem = await projectImagesStored(projectImageKeys(data.images).filter((key) => key.startsWith(`listings/${user.id}/`)));
  if (problem) return error(problem, problem.includes("yapılandırılmamış") ? 503 : 400);
  try {
    return ok(await createProject(projectsDB(), projectActor(user), data), { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ProjectError) return error(cause.message, cause.status);
    throw cause;
  }
}
