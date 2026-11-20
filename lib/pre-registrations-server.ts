import { db } from "./server";
import type { PreRegistrationDatabase } from "./pre-registrations";

// One database object per isolate: lib/pre-registrations.ts caches its table check per object.
let shared: PreRegistrationDatabase | null = null;
export const preRegistrationsDB = () => shared ??= db() as unknown as PreRegistrationDatabase;
