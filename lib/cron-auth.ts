import { sha256 } from "./server";

// Shared-secret check for /api/cron/[job]. The secret must be long (32+ characters); a shorter or
// missing CRON_SECRET disables the endpoint entirely. Comparison is constant-time over SHA-256
// digests, so neither the length nor a prefix of the secret leaks through timing.
export const cronEnabled = (secret: string | undefined): secret is string => typeof secret === "string" && secret.length >= 32;
export async function cronAuthorized(authorization: string | null, secret: string) {
  const provided = /^Bearer (.{1,512})$/.exec(authorization || "")?.[1] || "";
  const a = await sha256(secret), b = await sha256(provided);
  let diff = provided ? 0 : 1;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
