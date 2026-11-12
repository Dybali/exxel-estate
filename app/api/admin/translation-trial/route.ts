import { env } from "@/lib/runtime";
import { body, currentUser, db, error, isAdmin, listingById, ok, sameOrigin } from "@/lib/server";
import { listingLanguage } from "@/lib/listing-language";
import { isTrialModel, runTrial, TRIAL_MAX_LISTINGS, TrialError, trialProvider } from "@/lib/translation-trial";

// "Çeviri testi" (admin only): GET lists the latest published listings to test; POST translates one of them
// with the chosen model (Gemini or OpenAI) and returns the translations and the provider's own token counts. Nothing is stored.
// One listing per request so a slow answer never hits the proxy timeout; the page calls it in a loop.
const headers = { headers: { "Cache-Control": "private, no-store" } };
const secret = (name: string) => { const value = (env as Record<string, unknown>)[name]; return typeof value === "string" && value ? value : ""; };
const providerKey = { gemini: "GEMINI_API_KEY", openai: "OPENAI_API_KEY" } as const;
async function admin(request: Request) {
  const user = await currentUser(request);
  return user?.email_verified && isAdmin(user) ? user : null;
}

export async function GET(request: Request) {
  if (!await admin(request)) return error("Yönetici yetkisi gerekli.", 403);
  const rows = await db().prepare("SELECT id FROM listings WHERE status='published' AND title<>'' AND description<>'' ORDER BY updated_at DESC LIMIT ?").bind(TRIAL_MAX_LISTINGS).all<{ id: string }>();
  const listings = [];
  for (const row of rows.results || []) {
    const listing = await listingById(String(row.id));
    if (listing) listings.push({ id: listing.id, title: listing.title, source: listingLanguage(listing), chars: [...listing.title].length + [...listing.description].length });
  }
  return ok({ listings, providers: { gemini: Boolean(secret(providerKey.gemini)), openai: Boolean(secret(providerKey.openai)) } }, headers);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Geçersiz kaynak.", 403);
  if (!await admin(request)) return error("Yönetici yetkisi gerekli.", 403);
  let data: Record<string, unknown>;
  try { data = await body(request); } catch { return error("Geçersiz istek."); }
  if (!isTrialModel(data.model)) return error("Geçersiz model.");
  const key = secret(providerKey[trialProvider(data.model)]);
  if (!key) return error(trialProvider(data.model) === "openai" ? "OPENAI_API_KEY ayarlı değil." : "GEMINI_API_KEY ayarlı değil.", 503);
  if (typeof data.id !== "string" || data.id.length > 80) return error("İlan bulunamadı.", 404);
  const listing = await listingById(data.id);
  if (!listing || listing.status !== "published") return error("İlan bulunamadı.", 404);
  try {
    return ok({ result: await runTrial(key, data.model, { id: listing.id, title: listing.title, description: listing.description, source: listingLanguage(listing) }) }, headers);
  } catch (cause) {
    if (cause instanceof TrialError) return error(cause.message, cause.status);
    throw cause;
  }
}
