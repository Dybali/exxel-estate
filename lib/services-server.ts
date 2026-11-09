import { env } from "./runtime";
import { db, isAdmin, type User } from "./server";
import { SERVICE_SAMPLE_FIRMS, serviceSamplesEnabled } from "./service-samples";
import type { EmailSettings } from "./email";
import type { NotificationDatabase } from "./email-notifications";
import { siteUrl } from "./request-context";
import type { ServiceActor, ServiceDatabase, ServiceFirm } from "./services";

// One database object per isolate: lib/services.ts caches its table check per object, and db()
// returns a new object on every call, which would repeat the CREATE TABLE statements each request.
let shared: ServiceDatabase | null = null;
export const servicesDB = () => shared ??= db() as unknown as ServiceDatabase;
export const serviceActor = (user: User): ServiceActor => ({ id: user.id, admin: isAdmin(user) });
// Photo storage checks and removal are the same as for project photos (lib/projects-server.ts).
export { projectImagesStored as serviceImagesStored, removeProjectMedia as removeServiceMedia } from "./projects-server";

/** Sample firms shown on the public Hizmetler pages, or none when SERVICE_SAMPLES is "0"/"false"/"off" (lib/service-samples.ts). */
export const serviceSamples = (): readonly ServiceFirm[] => serviceSamplesEnabled((env as Record<string, unknown>).SERVICE_SAMPLES) ? SERVICE_SAMPLE_FIRMS : [];

/** E-mail settings for lib/service-emails.ts (SMTP from the environment, links on the current site address). */
export const serviceEmailSettings = () => ({ ...(env as unknown as EmailSettings), SITE_URL: siteUrl() });
export const serviceNotifyDB = () => servicesDB() as unknown as NotificationDatabase;
