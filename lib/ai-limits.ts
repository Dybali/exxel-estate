// Yönetim › Yapay zekâ kotaları: the site-wide AI spending caps, editable without a restart, and their usage.
// A cap is base + per-agent × approved estate agents, so it grows with the number of agents. Precedence:
// value saved in the panel (ai_settings) > environment variable > default. Usage history is kept per day in
// ai_usage_history (the live counters in ai_usage_limits are deleted after three days). Costs are estimates
// from Gemini 3.5 Flash-Lite list prices and the cost per character measured in Yönetim › Çeviri testi.
// Tables are created on first use and work on PostgreSQL and SQLite.
import { ensureMonth, ensureOps } from "./operations";

type Statement = { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> };
export type LimitsDatabase = { prepare(sql: string): Statement };

export const AI_LIMITS = [
  { id: "AI_DAILY_CALL_LIMIT", label: "Asistan ve arama: günlük model çağrısı", unit: "calls", period: "day", fallback: 400, max: 1_000_000 },
  { id: "AI_MONTHLY_CALL_LIMIT", label: "Asistan ve arama: aylık model çağrısı", unit: "calls", period: "month", fallback: 12_000, max: 30_000_000 },
  { id: "NL_SEARCH_DAILY_AI_LIMIT", label: "Doğal dil araması: günlük model çağrısı", unit: "calls", period: "day", fallback: 200, max: 1_000_000 },
  { id: "TRANSLATION_DAILY_CHAR_LIMIT", label: "Çeviri: günlük karakter", unit: "chars", period: "day", fallback: 2_000_000, max: 10_000_000_000 },
  { id: "TRANSLATION_MONTHLY_CHAR_LIMIT", label: "Çeviri: aylık karakter", unit: "chars", period: "month", fallback: 30_000_000, max: 300_000_000_000 },
] as const;
export type AiLimitId = typeof AI_LIMITS[number]["id"];
export const isAiLimitId = (value: unknown): value is AiLimitId => AI_LIMITS.some((item) => item.id === value);

/**
 * USD estimates: Gemini 3.5 Flash-Lite per 1M tokens (assistant, search), and per translated character with OpenAI GPT-6 Luna
 * as measured on real listings (one request per listing for all languages, normal price: ≈ 377 $ per 2,1 billion characters;
 * the nightly batch costs half). Gemini, used for translation only without OPENAI_API_KEY, costs ≈ 5.6x more per character.
 */
export const AI_PRICES = { input: 0.30, output: 2.50, translationPerChar: 377 / 2_100_000_000, callEstimate: 0.0015 };
export const tokenCost = (input: number, output: number) => (input * AI_PRICES.input + output * AI_PRICES.output) / 1_000_000;

export const AI_LIMITS_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS ai_settings(key TEXT PRIMARY KEY,base BIGINT,per_agent BIGINT NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,updated_by TEXT)",
  "CREATE TABLE IF NOT EXISTS ai_usage_history(day TEXT NOT NULL,metric TEXT NOT NULL,value BIGINT NOT NULL DEFAULT 0,PRIMARY KEY(day,metric))",
  // One warning e-mail per limit, period and level (80 / 100 %).
  "CREATE TABLE IF NOT EXISTS ai_limit_alerts(key TEXT PRIMARY KEY,sent_at TEXT NOT NULL)",
];
const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureAiLimits(db: LimitsDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { await ensureOps(db as never); for (const sql of AI_LIMITS_SCHEMA) await db.prepare(sql).bind().run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

const whole = (value: unknown) => { const n = Number(value); return value !== undefined && value !== null && value !== "" && Number.isSafeInteger(n) && n >= 0 ? n : null; };
export type AiLimitRow = { id: AiLimitId; label: string; unit: string; period: string; base: number | null; perAgent: number; env: number | null; fallback: number; effective: number; source: "panel" | "env" | "default" };

export const approvedAgents = async (db: LimitsDatabase) =>
  Number((await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='agent' AND agent_status='approved'").bind().first<{ n: number }>())?.n) || 0;

/** Every cap with where its value comes from and the value in force. */
export async function aiLimits(db: LimitsDatabase, env: Record<string, unknown>, agents?: number): Promise<{ agents: number; limits: AiLimitRow[] }> {
  await ensureAiLimits(db);
  const rows = (await db.prepare("SELECT key,base,per_agent FROM ai_settings").bind().all<{ key: string; base: number | null; per_agent: number }>()).results || [];
  const count = agents ?? await approvedAgents(db);
  return {
    agents: count,
    limits: AI_LIMITS.map((item) => {
      const row = rows.find((entry) => entry.key === item.id), base = whole(row?.base), perAgent = whole(row?.per_agent) ?? 0, fromEnv = whole(env[item.id]);
      const start = base ?? fromEnv ?? item.fallback;
      return { id: item.id, label: item.label, unit: item.unit, period: item.period, base, perAgent, env: fromEnv, fallback: item.fallback, effective: Math.min(item.max, start + perAgent * count), source: base !== null ? "panel" : fromEnv !== null ? "env" : "default" };
    }),
  };
}
/** The caps as environment-style strings, merged over the real environment by lib/ai-limits-server.ts. */
export const limitOverrides = (limits: AiLimitRow[]) => Object.fromEntries(limits.map((item) => [item.id, String(item.effective)])) as Record<AiLimitId, string>;

export class AiLimitError extends Error { constructor(message: string, public status = 400) { super(message); } }
/** Panel save: base null = back to the environment or default value. */
export async function saveAiLimit(db: LimitsDatabase, adminId: string, input: Record<string, unknown>, at = new Date()) {
  if (!isAiLimitId(input.id)) throw new AiLimitError("Geçersiz kota.");
  const item = AI_LIMITS.find((limit) => limit.id === input.id)!;
  const base = input.base === null || input.base === "" || input.base === undefined ? null : whole(input.base), perAgent = input.perAgent === "" || input.perAgent === undefined || input.perAgent === null ? 0 : whole(input.perAgent);
  if ((input.base !== null && input.base !== "" && input.base !== undefined && base === null) || perAgent === null) throw new AiLimitError("Kotaları sıfır veya pozitif tam sayı olarak yazın.");
  if ((base ?? 0) > item.max || perAgent > item.max) throw new AiLimitError("Kota çok yüksek.");
  await ensureAiLimits(db);
  await db.prepare("INSERT INTO ai_settings(key,base,per_agent,updated_at,updated_by) VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET base=excluded.base,per_agent=excluded.per_agent,updated_at=excluded.updated_at,updated_by=excluded.updated_by")
    .bind(item.id, base, perAgent, at.toISOString(), adminId).run();
  return { id: item.id, base, perAgent };
}

/** Today's and this month's usage of each cap, from the live counters. */
export async function aiUsageNow(db: LimitsDatabase, at = new Date()) {
  await ensureAiLimits(db);
  const day = at.toISOString().slice(0, 10), month = await ensureMonth(db as never, at);
  const [assistant, search, chars, monthly] = await Promise.all([
    db.prepare("SELECT requests,input_tokens,output_tokens FROM ai_usage_limits WHERE key=?").bind(`assistant:global:${day}`).first<Record<string, number>>(),
    db.prepare("SELECT requests FROM ai_usage_limits WHERE key=?").bind(`nl-search:global:${day}`).first<Record<string, number>>(),
    db.prepare("SELECT key,characters FROM translation_usage WHERE key IN (?,?)").bind(`day:${day}`, `month:${month}`).all<{ key: string; characters: number }>(),
    db.prepare("SELECT requests,input_tokens,output_tokens FROM ai_monthly_usage WHERE month=?").bind(month).first<Record<string, number>>(),
  ]);
  const charsOf = (key: string) => Number(chars.results.find((row) => row.key === key)?.characters || 0);
  return {
    day, month,
    used: { AI_DAILY_CALL_LIMIT: Number(assistant?.requests || 0), AI_MONTHLY_CALL_LIMIT: Number(monthly?.requests || 0), NL_SEARCH_DAILY_AI_LIMIT: Number(search?.requests || 0), TRANSLATION_DAILY_CHAR_LIMIT: charsOf(`day:${day}`), TRANSLATION_MONTHLY_CHAR_LIMIT: charsOf(`month:${month}`) } as Record<AiLimitId, number>,
    tokens: { dayInput: Number(assistant?.input_tokens || 0), dayOutput: Number(assistant?.output_tokens || 0), monthInput: Number(monthly?.input_tokens || 0), monthOutput: Number(monthly?.output_tokens || 0) },
  };
}

/** Estimated USD: Gemini tokens of the assistant and search plus translated characters (OpenAI translation tokens are not in the token totals). */
export function aiCost(usage: Awaited<ReturnType<typeof aiUsageNow>>) {
  const day = tokenCost(usage.tokens.dayInput, usage.tokens.dayOutput) + usage.used.TRANSLATION_DAILY_CHAR_LIMIT * AI_PRICES.translationPerChar;
  const month = tokenCost(usage.tokens.monthInput, usage.tokens.monthOutput) + usage.used.TRANSLATION_MONTHLY_CHAR_LIMIT * AI_PRICES.translationPerChar;
  return { day, month };
}
/** USD value of a cap if it were used in full. */
export const capCost = (row: Pick<AiLimitRow, "unit" | "effective">) => row.unit === "chars" ? row.effective * AI_PRICES.translationPerChar : row.effective * AI_PRICES.callEstimate;

/** Hourly: copies today's counters into the daily history (kept for the chart). */
export async function snapshotAiUsage(db: LimitsDatabase, at = new Date()) {
  const usage = await aiUsageNow(db, at);
  const cost = tokenCost(usage.tokens.dayInput, usage.tokens.dayOutput) + usage.used.TRANSLATION_DAILY_CHAR_LIMIT * AI_PRICES.translationPerChar;
  const values: [string, number][] = [["assistant_calls", usage.used.AI_DAILY_CALL_LIMIT], ["search_calls", usage.used.NL_SEARCH_DAILY_AI_LIMIT], ["translation_chars", usage.used.TRANSLATION_DAILY_CHAR_LIMIT], ["cost_millicents", Math.round(cost * 100_000)]];
  for (const [metric, value] of values) await db.prepare("INSERT INTO ai_usage_history(day,metric,value) VALUES(?,?,?) ON CONFLICT(day,metric) DO UPDATE SET value=excluded.value").bind(usage.day, metric, value).run();
  return usage;
}
export type AiHistoryDay = { day: string; assistantCalls: number; searchCalls: number; translationChars: number; cost: number };
export async function aiHistory(db: LimitsDatabase, days = 30, at = new Date()): Promise<AiHistoryDay[]> {
  await ensureAiLimits(db);
  const from = new Date(at.getTime() - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const rows = (await db.prepare("SELECT day,metric,value FROM ai_usage_history WHERE day>=? ORDER BY day").bind(from).all<{ day: string; metric: string; value: number }>()).results || [];
  const list: AiHistoryDay[] = [];
  for (let index = 0; index < days; index++) {
    const day = new Date(Date.parse(`${from}T00:00:00Z`) + index * 86400_000).toISOString().slice(0, 10), of = (metric: string) => Number(rows.find((row) => row.day === day && row.metric === metric)?.value || 0);
    list.push({ day, assistantCalls: of("assistant_calls"), searchCalls: of("search_calls"), translationChars: of("translation_chars"), cost: of("cost_millicents") / 100_000 });
  }
  return list;
}

/** Limits at or above 80 % (or 100 %) not yet reported for this period; marks them as reported. */
export async function dueAiAlerts(db: LimitsDatabase, limits: AiLimitRow[], usage: Awaited<ReturnType<typeof aiUsageNow>>, at = new Date()) {
  const due: { id: AiLimitId; label: string; used: number; limit: number; percent: number; level: 80 | 100 }[] = [];
  for (const row of limits) {
    const used = usage.used[row.id], percent = row.effective > 0 ? Math.round(used / row.effective * 100) : 0;
    const level = percent >= 100 ? 100 : percent >= 80 ? 80 : 0;
    if (!level) continue;
    const key = `${row.id}:${row.period === "day" ? usage.day : usage.month}:${level}`;
    const inserted = await db.prepare("INSERT INTO ai_limit_alerts(key,sent_at) VALUES(?,?) ON CONFLICT(key) DO NOTHING RETURNING key").bind(key, at.toISOString()).first();
    if (inserted) due.push({ id: row.id, label: row.label, used, limit: row.effective, percent, level });
  }
  return due;
}
