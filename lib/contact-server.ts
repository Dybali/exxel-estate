import { db } from "./server";
import type { ContactDatabase } from "./contact";

// One database object per isolate: lib/contact.ts caches its table check per object and db()
// returns a new object on every call.
let shared: ContactDatabase | null = null;
export const contactDB = () => shared ??= db() as unknown as ContactDatabase;
