import { env } from "./runtime";
import { db, isAdmin, type User } from "./server";
import { CONTRACTOR_SAMPLE_FIRMS, contractorSamplesEnabled } from "./contractor-samples";
import type { EmailSettings } from "./email";
import type { NotificationDatabase } from "./email-notifications";
import { siteUrl } from "./request-context";
import type { ContractorActor, ContractorDatabase, ContractorFirm } from "./contractors";

// One database object per isolate: lib/contractors.ts caches its table check per object (as lib/services-server.ts).
let shared: ContractorDatabase | null = null;
export const contractorsDB = () => shared ??= db() as unknown as ContractorDatabase;
export const contractorActor = (user: User): ContractorActor => ({ id: user.id, admin: isAdmin(user) });
// Photo storage checks and removal are the same as for project photos (lib/projects-server.ts).
export { projectImagesStored as contractorImagesStored, removeProjectMedia as removeContractorMedia } from "./projects-server";

/** Sample firms on the public pages, or none when CONTRACTOR_SAMPLES is "0"/"false"/"off" (lib/contractor-samples.ts). */
export const contractorSamples = (): readonly ContractorFirm[] => contractorSamplesEnabled((env as Record<string, unknown>).CONTRACTOR_SAMPLES) ? CONTRACTOR_SAMPLE_FIRMS : [];
export const contractorEmailSettings = () => ({ ...(env as unknown as EmailSettings), SITE_URL: siteUrl() });
export const contractorNotifyDB = () => contractorsDB() as unknown as NotificationDatabase;
