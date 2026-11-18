import { db } from "./server";
import { env, waitUntil } from "./runtime";
import { buildSnapshot, evdsUrl, marketSeriesBatches, marketView, parseEvds, snapshotUsable, type MarketView, type Point } from "./market-stats";
import { readMarketSnapshot, writeMarketSnapshot, type MarketDatabase } from "./market-stats-store";

// TCMB EVDS fetch for /emlak-piyasasi (lib/market-stats.ts). The free key is the server setting EVDS_API_KEY
// (evds3.tcmb.gov.tr › profile › API key); it is sent only in the "key" header, never logged.
const YEARS_BACK = 6;
const REFRESH_AFTER_MS = 20 * 3600_000;
let lastAttempt = 0;

const marketDb = () => db() as unknown as MarketDatabase;
export const evdsKey = () => { const key = String((env as Record<string, unknown>).EVDS_API_KEY || "").trim(); return key || null; };

export async function refreshMarketStats(fetcher: typeof fetch = fetch, now = new Date()): Promise<"skipped" | "updated" | "incomplete"> {
  const key = evdsKey();
  if (!key) return "skipped";
  const from = new Date(Date.UTC(now.getUTCFullYear() - YEARS_BACK, 0, 1));
  const values: Record<string, Point[]> = {};
  const notes: string[] = [];
  for (const { series, frequency } of marketSeriesBatches()) {
    const response = await fetcher(evdsUrl(series, from, now, frequency), { headers: { key, Accept: "application/json" }, redirect: "manual", signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (!response?.ok) { notes.push(`${series[0]}: HTTP ${response?.status ?? "network"}`); console.error("market_stats_fetch_failed", response?.status ?? "network"); continue; }
    const text = await response.text().catch(() => "");
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* noted below */ }
    const parsed = parseEvds(json, series);
    // Keep the start of an answer that gave nothing, to see what TCMB sent (it never contains the key).
    if (!Object.values(parsed).some((points) => points.length)) notes.push(`${series[0]}: ${text.slice(0, 240)}`);
    Object.assign(values, parsed);
  }
  const snapshot = buildSnapshot(values, now, notes);
  if (!snapshotUsable(snapshot)) { console.error("market_stats_incomplete"); return "incomplete"; }
  await writeMarketSnapshot(marketDb(), snapshot);
  return "updated";
}

/** Daily job: refresh when the stored snapshot is older than a day (TCMB publishes monthly and quarterly). */
export async function marketStatsJob() {
  try {
    if (!evdsKey()) return true;
    const stored = await readMarketSnapshot(marketDb());
    if (stored && Date.now() - Date.parse(stored.updatedAt) < REFRESH_AFTER_MS) return true;
    const result = await refreshMarketStats();
    if (result !== "skipped") console.info("market_stats", result);
    return true;
  } catch (cause) { console.error("market_stats_failed", String(cause)); return false; }
}

/** What the page shows; with a key but no snapshot yet (first day), one background fetch per hour. */
export async function currentMarketView(): Promise<MarketView | null> {
  const stored = await readMarketSnapshot(marketDb()).catch(() => null);
  // No snapshot yet, or the monthly indices are missing: one background fetch per hour.
  if ((!snapshotUsable(stored) || !stored.turkey.index.length) && evdsKey() && Date.now() - lastAttempt > 3600_000) {
    lastAttempt = Date.now();
    waitUntil(refreshMarketStats().catch((cause) => console.error("market_stats_failed", String(cause))));
  }
  return snapshotUsable(stored) ? marketView(stored) : null;
}
