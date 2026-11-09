import { db } from "./server";
import type { FeedbackDatabase } from "./feedback";

// One database object per isolate: lib/feedback.ts caches its table check per object and db()
// returns a new object on every call.
let shared: FeedbackDatabase | null = null;
export const feedbackDB = () => shared ??= db() as unknown as FeedbackDatabase;
