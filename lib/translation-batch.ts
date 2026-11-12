// Every listing is translated into all languages once, after it is published (owner's decision 2026-11-12, for
// search engines and so no visitor waits): new, edited and approved listings are queued; the daily job sends every missing
// (listing, language) translation to the Gemini Batch API at half the normal price, and the hourly job collects
// finished jobs into the normal translation cache (content_translations). With OPENAI_API_KEY (GPT-6 Luna, the owner's
// choice) a job is an OpenAI Batch (a JSONL file, one request per listing for all missing languages at once: the
// instruction is paid once, not once per language, measured 52 % cheaper); without it, a Gemini batch job. Until a job has finished, visitors
// get on-demand translations as for every other listing (docs/translations.md), so nothing waits on the batch.
// Tables are created on first use and work on PostgreSQL and SQLite.
import { recordTranslationTokens, recordTranslationUsage, readTranslations, translationBudget } from "./translation-cache";
import { GEMINI_BASE, listingContext, OPENAI_BASE, openaiMultiRequest, openaiTranslationModel, parseOpenAiMulti, parseTranslation, translationConfigured, translationModel, translationProvider, translationRequest, TranslationError, type ContentLocale, type GeminiResponse, type OpenAiResponse, type TranslationDocument, type TranslationSettings } from "./translation";
import { ensureOps } from "./operations";

type Statement = { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> };
export type BatchDatabase = { prepare(sql: string): Statement; batch(statements: unknown[]): Promise<unknown> };

export const BATCH_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS translation_batch_queue(listing_id TEXT PRIMARY KEY,created_at TEXT NOT NULL)",
  // items: JSON [{listingId, locale, keys:[cache keys in the order of the texts]}], index = request metadata key.
  "CREATE TABLE IF NOT EXISTS translation_batch_jobs(name TEXT PRIMARY KEY,state TEXT NOT NULL,items TEXT NOT NULL,characters INTEGER NOT NULL DEFAULT 0,saved INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,finished_at TEXT,error TEXT)",
  // One row: "batch", or "direct" when the last nightly attempt was refused for lack of billing; checked_at = that attempt.
  "CREATE TABLE IF NOT EXISTS translation_batch_mode(id TEXT PRIMARY KEY,mode TEXT NOT NULL,checked_at TEXT NOT NULL)",
];
/** Listings translated per hour at the normal price while the Batch API is unavailable (free-tier request limits). */
export const DIRECT_MAX_LISTINGS = 6;
/** Listings per batch job; 300 listings × 7 languages stays far under the 20 MB inline limit. */
export const BATCH_MAX_LISTINGS = 300;
/** A listing still waiting for review stays queued this long. */
export const BATCH_QUEUE_DAYS = 7;
const FINAL = ["SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"];

const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: BatchDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { await ensureOps(db as never); for (const sql of BATCH_SCHEMA) await db.prepare(sql).bind().run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

export async function queueBatchTranslation(db: BatchDatabase, listingId: string, at = new Date()) {
  await ensure(db);
  await db.prepare("INSERT INTO translation_batch_queue(listing_id,created_at) VALUES(?,?) ON CONFLICT(listing_id) DO NOTHING").bind(listingId, at.toISOString()).run();
}

/** What to translate for a listing: null = gone or rejected, "waiting" = not published yet, else one document per language. */
export type BatchSource = (listingId: string) => Promise<null | "waiting" | { locale: ContentLocale; doc: TranslationDocument }[]>;
type Item = { listingId: string; locale: ContentLocale; keys: string[] };
/** OpenAI job item: per language the cache key of each text of the request (null = already translated). */
type MultiItem = { listingId: string; locales: ContentLocale[]; keys: Partial<Record<ContentLocale, (string | null)[]>> };

export type SubmitResult = { status: "not_configured" | "busy" | "empty" | "daily_limit" | "monthly_limit" | "billing_required" | "provider_error" | "submitted"; name?: string; requests?: number; characters?: number; code?: number };

/** Daily: sends the queued listings' missing translations as one batch job (one job at a time). */
export async function submitTranslationBatch(db: BatchDatabase, settings: TranslationSettings, source: BatchSource, fetcher: typeof fetch = fetch, at = new Date()): Promise<SubmitResult> {
  if (!translationConfigured(settings)) return { status: "not_configured" };
  await ensure(db);
  if (await db.prepare("SELECT name FROM translation_batch_jobs WHERE finished_at IS NULL").bind().first()) return { status: "busy" };
  const queue = (await db.prepare("SELECT listing_id,created_at FROM translation_batch_queue ORDER BY created_at ASC,listing_id ASC LIMIT ?").bind(BATCH_MAX_LISTINGS).all<{ listing_id: string; created_at: string }>()).results || [];
  if (translationProvider(settings) === "openai") return submitOpenAiBatch(db, settings, source, queue, fetcher, at);
  const model = translationModel(settings), stale = new Date(at.getTime() - BATCH_QUEUE_DAYS * 86400_000).toISOString();
  const requests: unknown[] = [], items: Item[] = [], done: string[] = [];
  let characters = 0;
  for (const row of queue) {
    const id = String(row.listing_id), docs = await source(id);
    if (docs === "waiting") { if (String(row.created_at) < stale) done.push(id); continue; }
    done.push(id);
    if (!docs) continue;
    for (const { locale, doc } of docs) {
      if (!Object.keys(doc.fields).length) continue;
      const cached = await readTranslations(db as never, doc, locale);
      if (cached.complete) continue;
      const missing = [...new Map(cached.segments.filter((segment) => !Object.hasOwn(cached.fields, segment.field)).map((segment) => [segment.key, segment])).values()];
      if (!missing.length) continue;
      try { requests.push({ request: translationRequest(locale, missing.map((segment) => segment.text), listingContext, model), metadata: { key: String(items.length) } }); }
      catch (cause) { if (cause instanceof TranslationError) continue; throw cause; }
      items.push({ listingId: id, locale, keys: missing.map((segment) => segment.key) });
      characters += missing.reduce((sum, segment) => sum + [...segment.text].length, 0);
    }
  }
  const clear = async () => { for (const id of done) await db.prepare("DELETE FROM translation_batch_queue WHERE listing_id=?").bind(id).run(); };
  if (!requests.length) { await clear(); return { status: "empty" }; }
  const over = await translationBudget(db as never, settings, characters, at.toISOString());
  if (over) return { status: over, characters };
  const response = await fetcher(`${GEMINI_BASE}/models/${model}:batchGenerateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": settings.GEMINI_API_KEY! }, redirect: "manual", signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({ batch: { display_name: `em24-listings-${at.toISOString().slice(0, 16)}`, input_config: { requests: { requests } } } }),
  }).catch(() => null);
  if (!response) return { status: "provider_error", code: 0 };
  const text = await response.text();
  // The Batch API needs a billed (paid-tier) project; a free-tier key answers 400 FAILED_PRECONDITION.
  if (!response.ok) {
    const billing = response.status === 400 && /FAILED_PRECONDITION/.test(text);
    if (billing) await setMode(db, "direct", at);
    return { status: billing ? "billing_required" : "provider_error", code: response.status };
  }
  let name = "";
  try { const data = JSON.parse(text) as { name?: unknown }; name = typeof data.name === "string" ? data.name : ""; } catch { name = ""; }
  if (!/^batches\/[A-Za-z0-9_-]{1,200}$/.test(name)) return { status: "provider_error", code: 502 };
  await db.prepare("INSERT INTO translation_batch_jobs(name,state,items,characters,saved,created_at) VALUES(?,?,?,?,0,?)").bind(name, "PENDING", JSON.stringify(items), characters, at.toISOString()).run();
  await recordTranslationUsage(db as never, characters, at.toISOString());
  await clear();
  await setMode(db, "batch", at);
  return { status: "submitted", name, requests: requests.length, characters };
}

const deleteQueued = (db: BatchDatabase, ids: string[]) => Promise.all(ids.map((id) => db.prepare("DELETE FROM translation_batch_queue WHERE listing_id=?").bind(id).run()));
const openaiAuth = (settings: TranslationSettings) => ({ Authorization: `Bearer ${settings.OPENAI_API_KEY}` });
/** Best effort: uploaded batch files hold listing texts, so they are removed once a job is over (data minimisation). */
const deleteOpenAiFile = (settings: TranslationSettings, id: unknown, fetcher: typeof fetch) => typeof id === "string" && /^file-[A-Za-z0-9_-]{1,200}$/.test(id)
  ? fetcher(`${OPENAI_BASE}/files/${id}`, { method: "DELETE", headers: openaiAuth(settings), redirect: "manual", signal: AbortSignal.timeout(30_000) }).then((response) => response.body?.cancel()).catch(() => undefined)
  : Promise.resolve(undefined);

async function submitOpenAiBatch(db: BatchDatabase, settings: TranslationSettings, source: BatchSource, queue: { listing_id: string; created_at: string }[], fetcher: typeof fetch, at: Date): Promise<SubmitResult> {
  const model = openaiTranslationModel(settings), stale = new Date(at.getTime() - BATCH_QUEUE_DAYS * 86400_000).toISOString();
  const lines: string[] = [], items: MultiItem[] = [], done: string[] = [];
  let characters = 0;
  for (const row of queue) {
    const id = String(row.listing_id), docs = await source(id);
    if (docs === "waiting") { if (String(row.created_at) < stale) done.push(id); continue; }
    done.push(id);
    if (!docs) continue;
    // One request for every language this listing still lacks; the texts are the union of the missing ones.
    const texts: string[] = [], position = new Map<string, number>(), perLocale = new Map<ContentLocale, Map<number, string>>();
    let listingChars = 0;
    for (const { locale, doc } of docs) {
      if (!Object.keys(doc.fields).length) continue;
      const cached = await readTranslations(db as never, doc, locale);
      if (cached.complete) continue;
      const missing = [...new Map(cached.segments.filter((segment) => !Object.hasOwn(cached.fields, segment.field)).map((segment) => [segment.key, segment])).values()];
      if (!missing.length) continue;
      const slots = new Map<number, string>();
      for (const segment of missing) {
        if (!position.has(segment.text)) { position.set(segment.text, texts.length); texts.push(segment.text); }
        slots.set(position.get(segment.text)!, segment.key);
      }
      perLocale.set(locale, slots);
      listingChars += missing.reduce((sum, segment) => sum + [...segment.text].length, 0);
    }
    if (!perLocale.size) continue;
    const locales = [...perLocale.keys()];
    try { lines.push(JSON.stringify({ custom_id: String(items.length), method: "POST", url: "/v1/chat/completions", body: openaiMultiRequest(locales, texts, listingContext, model) })); }
    catch (cause) { if (cause instanceof TranslationError) continue; throw cause; }
    items.push({ listingId: id, locales, keys: Object.fromEntries(locales.map((locale) => [locale, texts.map((_, index) => perLocale.get(locale)!.get(index) ?? null)])) });
    characters += listingChars;
  }
  if (!lines.length) { await deleteQueued(db, done); return { status: "empty" }; }
  const over = await translationBudget(db as never, settings, characters, at.toISOString());
  if (over) return { status: over, characters };
  const form = new FormData();
  form.append("purpose", "batch");
  form.append("file", new Blob([lines.join("\n") + "\n"], { type: "application/jsonl" }), `em24-translations-${at.toISOString().slice(0, 10)}.jsonl`);
  const upload = await fetcher(`${OPENAI_BASE}/files`, { method: "POST", headers: openaiAuth(settings), body: form, redirect: "manual", signal: AbortSignal.timeout(120_000) }).catch(() => null);
  if (!upload) return { status: "provider_error", code: 0 };
  if (!upload.ok) { await upload.body?.cancel(); return { status: "provider_error", code: upload.status }; }
  const file = String(((await upload.json().catch(() => ({}))) as { id?: unknown }).id || "");
  if (!/^file-[A-Za-z0-9_-]{1,200}$/.test(file)) return { status: "provider_error", code: 502 };
  const created = await fetcher(`${OPENAI_BASE}/batches`, {
    method: "POST", headers: { ...openaiAuth(settings), "Content-Type": "application/json" }, redirect: "manual", signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({ input_file_id: file, endpoint: "/v1/chat/completions", completion_window: "24h" }),
  }).catch(() => null);
  const name = created?.ok ? String(((await created.json().catch(() => ({}))) as { id?: unknown }).id || "") : "";
  if (!/^batch_[A-Za-z0-9_-]{1,200}$/.test(name)) { await created?.body?.cancel().catch(() => undefined); await deleteOpenAiFile(settings, file, fetcher); return { status: "provider_error", code: created ? (created.ok ? 502 : created.status) : 0 }; }
  await db.prepare("INSERT INTO translation_batch_jobs(name,state,items,characters,saved,created_at) VALUES(?,?,?,?,0,?)").bind(name, "PENDING", JSON.stringify(items), characters, at.toISOString()).run();
  await recordTranslationUsage(db as never, characters, at.toISOString());
  await deleteQueued(db, done);
  await setMode(db, "batch", at);
  return { status: "submitted", name, requests: lines.length, characters };
}

const OPENAI_STATES: Record<string, string> = { completed: "SUCCEEDED", failed: "FAILED", expired: "EXPIRED", cancelled: "CANCELLED" };
/** One OpenAI job: null = not finished (or not readable now, try next hour), else the saved translations and final state. */
async function pollOpenAiJob(db: BatchDatabase, settings: TranslationSettings, name: string, items: MultiItem[], fetcher: typeof fetch, stamp: string): Promise<null | { state: string; count: number; error: string | null }> {
  const response = await fetcher(`${OPENAI_BASE}/batches/${name}`, { headers: openaiAuth(settings), redirect: "manual", signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (!response) return null;
  if (response.status === 404) { await response.body?.cancel(); return { state: "MISSING", count: 0, error: "batch not found" }; }
  if (!response.ok) { await response.body?.cancel(); return null; }
  const data = await response.json() as { status?: string; input_file_id?: string; output_file_id?: string | null; error_file_id?: string | null };
  const state = OPENAI_STATES[String(data.status)];
  if (!state) { await db.prepare("UPDATE translation_batch_jobs SET state=? WHERE name=?").bind(String(data.status || "pending").toUpperCase().slice(0, 30), name).run(); return null; }
  let count = 0;
  // An expired job keeps the answers it finished; they are saved and the rest is queued again.
  if (data.output_file_id && (state === "SUCCEEDED" || state === "EXPIRED")) {
    const content = await fetcher(`${OPENAI_BASE}/files/${data.output_file_id}/content`, { headers: openaiAuth(settings), redirect: "manual", signal: AbortSignal.timeout(120_000) }).catch(() => null);
    if (!content?.ok) { await content?.body?.cancel(); return null; }
    for (const line of (await content.text()).split("\n")) {
      if (!line.trim()) continue;
      let answer: { custom_id?: unknown; error?: unknown; response?: { status_code?: number; body?: OpenAiResponse } };
      try { answer = JSON.parse(line); } catch { continue; }
      const item = items[Number(answer.custom_id)];
      if (!item || answer.error || answer.response?.status_code !== 200 || !answer.response.body) continue;
      const size = item.keys[item.locales[0]]?.length || 0;
      let parsed: ReturnType<typeof parseOpenAiMulti>;
      try { parsed = parseOpenAiMulti(answer.response.body, item.locales, size); } catch { continue; }
      const statements: unknown[] = [];
      for (const locale of item.locales) (item.keys[locale] || []).forEach((key, index) => {
        if (key) statements.push(db.prepare("INSERT INTO content_translations(key,translated_text,detected_language,created_at) VALUES(?,?,?,?) ON CONFLICT(key) DO NOTHING").bind(key, parsed.results[locale]![index], "", stamp));
      });
      await db.batch(statements);
      count += statements.length;
    }
  }
  await Promise.all([data.input_file_id, data.output_file_id, data.error_file_id].map((id) => deleteOpenAiFile(settings, id, fetcher)));
  return { state, count, error: state === "SUCCEEDED" ? null : state.toLowerCase() };
}

async function setMode(db: BatchDatabase, mode: "batch" | "direct", at: Date) {
  await db.prepare("INSERT INTO translation_batch_mode(id,mode,checked_at) VALUES('mode',?,?) ON CONFLICT(id) DO UPDATE SET mode=excluded.mode,checked_at=excluded.checked_at").bind(mode, at.toISOString()).run();
}
export async function batchMode(db: BatchDatabase) {
  await ensure(db);
  const row = await db.prepare("SELECT mode,checked_at FROM translation_batch_mode WHERE id='mode'").bind().first<{ mode: string; checked_at: string }>();
  return row ? { mode: row.mode === "direct" ? "direct" as const : "batch" as const, checkedAt: String(row.checked_at) } : { mode: "batch" as const, checkedAt: "" };
}

/** One language of one listing at the normal price; "stop" = a cap, a pause or a provider error, try again next hour. */
export type DirectTranslate = (doc: TranslationDocument, locale: ContentLocale) => Promise<"done" | "stop">;
/**
 * Hourly, only while the Batch API is refused for lack of billing: translates a few queued listings at the normal
 * price. Only listings that were already in the queue at the last nightly attempt are taken, so every night the
 * Batch API is tried again with the newer ones and the half price comes back as soon as billing is enabled.
 */
export async function translateQueueDirectly(db: BatchDatabase, settings: TranslationSettings, source: BatchSource, translate: DirectTranslate, at = new Date()) {
  if (!translationConfigured(settings)) return { status: "not_configured" as const, listings: 0 };
  const { mode, checkedAt } = await batchMode(db);
  if (mode !== "direct") return { status: "batch" as const, listings: 0 };
  const queue = (await db.prepare("SELECT listing_id,created_at FROM translation_batch_queue WHERE created_at<=? ORDER BY created_at ASC,listing_id ASC LIMIT ?").bind(checkedAt, DIRECT_MAX_LISTINGS).all<{ listing_id: string; created_at: string }>()).results || [];
  const stale = new Date(at.getTime() - BATCH_QUEUE_DAYS * 86400_000).toISOString();
  let listings = 0;
  for (const row of queue) {
    const id = String(row.listing_id), docs = await source(id);
    if (docs === "waiting") { if (String(row.created_at) < stale) await db.prepare("DELETE FROM translation_batch_queue WHERE listing_id=?").bind(id).run(); continue; }
    for (const { locale, doc } of docs || []) {
      if (!Object.keys(doc.fields).length) continue;
      if (await translate(doc, locale).catch(() => "stop" as const) === "stop") return { status: "stopped" as const, listings };
    }
    await db.prepare("DELETE FROM translation_batch_queue WHERE listing_id=?").bind(id).run();
    if (docs) listings++;
  }
  return { status: "done" as const, listings };
}

type InlinedResponse = { response?: GeminiResponse; error?: unknown; metadata?: { key?: unknown } };
/** The inline results of a finished batch; the documentation shows more than one location, so all are read. */
export function batchResponses(data: Record<string, unknown>): InlinedResponse[] {
  const pick = (value: unknown): InlinedResponse[] | null => {
    if (Array.isArray(value)) return value as InlinedResponse[];
    if (value && typeof value === "object" && Array.isArray((value as { inlinedResponses?: unknown }).inlinedResponses)) return (value as { inlinedResponses: InlinedResponse[] }).inlinedResponses;
    return null;
  };
  const meta = data.metadata as Record<string, unknown> | undefined, response = data.response as Record<string, unknown> | undefined, dest = data.dest as Record<string, unknown> | undefined;
  const output = meta?.output as Record<string, unknown> | undefined;
  return pick(response?.inlinedResponses) || pick(dest?.inlinedResponses) || pick(output?.inlinedResponses) || pick((meta?.dest as Record<string, unknown> | undefined)?.inlinedResponses) || [];
}
/** "JOB_STATE_SUCCEEDED" / "BATCH_STATE_SUCCEEDED" / "SUCCEEDED" → "SUCCEEDED". */
export const batchState = (data: Record<string, unknown>) => String((data.metadata as Record<string, unknown> | undefined)?.state ?? data.state ?? "").replace(/^(JOB|BATCH)_STATE_/, "");

/** Hourly: collects finished jobs into the translation cache; a failed or expired job puts its listings back in the queue. */
export async function pollTranslationBatches(db: BatchDatabase, settings: TranslationSettings, fetcher: typeof fetch = fetch, at = new Date()) {
  if (!translationConfigured(settings)) return { checked: 0, saved: 0 };
  await ensure(db);
  const jobs = (await db.prepare("SELECT name,items,created_at FROM translation_batch_jobs WHERE finished_at IS NULL ORDER BY created_at ASC").bind().all<{ name: string; items: string; created_at: string }>()).results || [];
  let saved = 0;
  for (const job of jobs) {
    if (String(job.name).startsWith("batch_")) {
      const items = JSON.parse(String(job.items)) as MultiItem[];
      const result = settings.OPENAI_API_KEY ? await pollOpenAiJob(db, settings, String(job.name), items, fetcher, at.toISOString()) : null;
      if (!result) {
        if (at.getTime() - Date.parse(String(job.created_at)) > 3 * 86400_000) { await db.prepare("UPDATE translation_batch_jobs SET state=?,finished_at=?,error=? WHERE name=?").bind("EXPIRED", at.toISOString(), "no result after 3 days", job.name).run(); for (const id of new Set(items.map((item) => item.listingId))) await db.prepare("INSERT INTO translation_batch_queue(listing_id,created_at) VALUES(?,?) ON CONFLICT(listing_id) DO NOTHING").bind(id, at.toISOString()).run(); }
        continue;
      }
      await db.prepare("UPDATE translation_batch_jobs SET state=?,saved=?,finished_at=?,error=? WHERE name=?").bind(result.state, result.count, at.toISOString(), result.error, job.name).run();
      if (result.state !== "SUCCEEDED") for (const id of new Set(items.map((item) => item.listingId))) await db.prepare("INSERT INTO translation_batch_queue(listing_id,created_at) VALUES(?,?) ON CONFLICT(listing_id) DO NOTHING").bind(id, at.toISOString()).run();
      saved += result.count;
      continue;
    }
    if (!settings.GEMINI_API_KEY) continue;
    const response = await fetcher(`${GEMINI_BASE}/${job.name}`, { headers: { "x-goog-api-key": settings.GEMINI_API_KEY! }, redirect: "manual", signal: AbortSignal.timeout(60_000) }).catch(() => null);
    if (!response) continue;
    const items = JSON.parse(String(job.items)) as Item[];
    const finish = async (state: string, count: number, error: string | null) => {
      await db.prepare("UPDATE translation_batch_jobs SET state=?,saved=?,finished_at=?,error=? WHERE name=?").bind(state, count, at.toISOString(), error, job.name).run();
      if (state !== "SUCCEEDED") for (const id of new Set(items.map((item) => item.listingId))) await db.prepare("INSERT INTO translation_batch_queue(listing_id,created_at) VALUES(?,?) ON CONFLICT(listing_id) DO NOTHING").bind(id, at.toISOString()).run();
    };
    if (response.status === 404) { await response.body?.cancel(); await finish("MISSING", 0, "batch not found"); continue; }
    if (!response.ok) { await response.body?.cancel(); continue; }
    const data = await response.json() as Record<string, unknown>, state = batchState(data);
    if (!FINAL.includes(state)) {
      // Google expires jobs after 48 hours; three days without an answer means it is lost.
      if (at.getTime() - Date.parse(String(job.created_at)) > 3 * 86400_000) await finish("EXPIRED", 0, "no result after 3 days");
      else await db.prepare("UPDATE translation_batch_jobs SET state=? WHERE name=?").bind(state || "PENDING", job.name).run();
      continue;
    }
    if (state !== "SUCCEEDED") { await finish(state, 0, state.toLowerCase()); continue; }
    let count = 0, usage = { input: 0, output: 0 };
    const stamp = at.toISOString();
    for (const answer of batchResponses(data)) {
      const item = items[Number(answer.metadata?.key)];
      if (!item || answer.error || !answer.response) continue;
      let parsed: ReturnType<typeof parseTranslation>;
      try { parsed = parseTranslation(answer.response, item.keys.length); } catch { continue; }
      usage = { input: usage.input + parsed.usage.input, output: usage.output + parsed.usage.output };
      await db.batch(item.keys.map((key, index) => db.prepare("INSERT INTO content_translations(key,translated_text,detected_language,created_at) VALUES(?,?,?,?) ON CONFLICT(key) DO NOTHING").bind(key, parsed.results[index].text, parsed.results[index].language, stamp)));
      count += item.keys.length;
    }
    await recordTranslationTokens(db as never, usage, at);
    await finish("SUCCEEDED", count, null);
    saved += count;
  }
  return { checked: jobs.length, saved };
}
