import { db, isAdmin, type User } from "./server";
import type { ServiceActor, ServiceDatabase } from "./services";

// One database object per isolate: lib/services.ts caches its table check per object, and db()
// returns a new object on every call, which would repeat the CREATE TABLE statements each request.
let shared: ServiceDatabase | null = null;
export const servicesDB = () => shared ??= db() as unknown as ServiceDatabase;
export const serviceActor = (user: User): ServiceActor => ({ id: user.id, admin: isAdmin(user) });
// Photo storage checks and removal are the same as for project photos (lib/projects-server.ts).
export { projectImagesStored as serviceImagesStored, removeProjectMedia as removeServiceMedia } from "./projects-server";
