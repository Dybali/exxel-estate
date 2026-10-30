import { body, currentUser, db, error, isAdmin, ok, sameOrigin } from "@/lib/server";
import { reportsDB } from "@/lib/reports-server";
import { adminPendingProjects, ProjectError, reviewProject } from "@/lib/projects";
import { projectsDB } from "@/lib/projects-server";

const headers = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  return ok({ projects: await adminPendingProjects(projectsDB()) }, headers);
}

// Approve or reject a pending project; a rejection needs a note the publisher can read.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  const admin = await currentUser(request);
  if (!admin?.email_verified || !isAdmin(admin)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  try {
    const result = await reviewProject(projectsDB(), admin.id, data.id, data.decision, data.note);
    try {
      await reportsDB();
      const note = typeof data.note === "string" ? data.note.trim().slice(0, 300) : "";
      await db().prepare("INSERT INTO admin_audit(id,actor_id,actor_name,action,target_id,summary,created_at) VALUES(?,?,?,?,?,?,?)")
        .bind(crypto.randomUUID(), admin.id, admin.name, `project_${result.moderation}`, result.id, note ? `${result.name} · ${note}` : result.name, new Date().toISOString()).run();
    } catch { /* The decision stands even if the audit entry cannot be written. */ }
    return ok(result, headers);
  } catch (cause) {
    if (cause instanceof ProjectError) return error(cause.message, cause.status);
    throw cause;
  }
}
