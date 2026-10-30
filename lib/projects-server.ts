import { bucket, db, isAdmin, type User } from "./server";
import { officePublicationAllowed } from "./office-verification-server";
import { deleteExternalImage, externalR2BucketName, headExternalImage } from "./external-r2";
import { removeListingMedia } from "./listing-media";
import type { Actor, ProjectDatabase } from "./projects";

// One database object per isolate: lib/projects.ts caches its table check per object, and db()
// returns a new object on every call, which would repeat the CREATE TABLE statements each request.
let shared: ProjectDatabase | null = null;
export const projectsDB = () => shared ??= db() as unknown as ProjectDatabase;
export const projectActor = (user: User): Actor => ({ id: user.id, admin: isAdmin(user) });

// Same gate as direct listing publication: an approved agent (or construction company account)
// whose office document an administrator approved, or an administrator.
export async function canPublishProjects(user: User | null) {
  if (!user?.email_verified) return false;
  if (isAdmin(user)) return true;
  return user.role === "agent" && await officePublicationAllowed(user.id);
}

// New photos must exist in storage before a project may use them.
export async function projectImagesStored(keys: string[]) {
  if (!keys.length) return null;
  if (!externalR2BucketName()) return "Fotoğraf deposu yapılandırılmamış.";
  const found = await Promise.all(keys.map(headExternalImage));
  return found.some((item) => !item) ? "Fotoğraflardan biri depoda bulunamadı." : null;
}

// Photos also live in the private bucket for media uploaded before the EU bucket.
export const removeProjectMedia = (keys: string[]) => removeListingMedia(keys, async (key) => { await deleteExternalImage(key); await bucket()?.delete(key); });
