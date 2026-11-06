// Indicative exchange rates of the Central Bank of the Republic of Türkiye (TCMB), used only to show
// approximate listing prices in other currencies. Listing prices are stored in Turkish lira; a rate
// change never changes a stored price. The bulletin (today.xml) is published on Turkish business days
// around 15:30 and carries its own date (Tarih), which is the date shown to visitors: on weekends and
// holidays the last published bulletin stays in use with its real date.
// Pure module (no runtime imports): parsing, conversion and the refresh cache are tested in
// tests/tcmb-rates.test.mjs; lib/tcmb-server.ts wires it to fetch and the request lifecycle.

export const TCMB_TODAY_XML = "https://www.tcmb.gov.tr/kurlar/today.xml";
/** Public page the "TCMB" credit links to. */
export const TCMB_RATES_PAGE = "https://www.tcmb.gov.tr/kurlar/kurlar_tr.html";
/** TCMB is re-checked at most this often; between checks every request reuses the cached bulletin. */
export const TCMB_REFRESH_MS = 15 * 60_000;
/** A bulletin older than this is never used (TCMB publishes every business day; long holidays are ~9 days). */
export const TCMB_MAX_AGE_DAYS = 21;

export type Bulletin = {
  source: "TCMB";
  /** Bulletin date (Tarih attribute), YYYY-MM-DD. */
  date: string;
  bulletinNo?: string;
  /** Turkish lira per 1 unit of each currency: ForexSelling / Unit. TRY itself is not listed. */
  rates: Record<string, number>;
};
/** What one request sees: the bulletin plus whether the last refresh attempt failed. */
export type RateSnapshot = Bulletin & { stale: boolean };

const DAY = 86_400_000;
const CODE = /^[A-Z]{3}$/;

/** Parses today.xml. Currencies with a missing, zero, negative or non-numeric rate or unit are skipped. */
export function parseTcmbXml(xml: string): Bulletin {
  if (typeof xml !== "string" || xml.length > 200_000) throw new Error("Unexpected TCMB response");
  const head = /<Tarih_Date\b([^>]*)>/.exec(xml)?.[1] || "";
  const tarih = /\bTarih\s*=\s*"(\d{2})\.(\d{2})\.(\d{4})"/.exec(head);
  if (!tarih) throw new Error("TCMB bulletin date missing");
  const date = `${tarih[3]}-${tarih[2]}-${tarih[1]}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("TCMB bulletin date invalid");
  const bulletinNo = /\bBulten_No\s*=\s*"([^"]{1,20})"/.exec(head)?.[1];
  const rates: Record<string, number> = {};
  for (const match of xml.matchAll(/<Currency\b([^>]*)>([\s\S]*?)<\/Currency>/g)) {
    const code = /\b(?:CurrencyCode|Kod)\s*=\s*"([A-Z]{3})"/.exec(match[1])?.[1];
    const field = (name: string) => new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`).exec(match[2])?.[1] ?? "";
    const unitText = field("Unit"), sellingText = field("ForexSelling");
    if (!code || code === "TRY" || !/^\d{1,6}$/.test(unitText) || !/^\d{1,9}(?:\.\d{1,8})?$/.test(sellingText)) continue;
    const unit = Number(unitText), selling = Number(sellingText);
    if (!(unit > 0) || !(selling > 0)) continue;
    rates[code] = selling / unit;
  }
  if (!Object.keys(rates).length) throw new Error("TCMB bulletin has no usable rates");
  return { source: "TCMB", date, ...(bulletinNo ? { bulletinNo } : {}), rates };
}

/** A bulletin may be shown: valid shape, not dated in the future, not older than TCMB_MAX_AGE_DAYS. */
export function bulletinUsable(value: unknown, now = Date.now()): value is Bulletin {
  const bulletin = value as Bulletin | null;
  if (!bulletin || bulletin.source !== "TCMB" || typeof bulletin.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bulletin.date) || !bulletin.rates || typeof bulletin.rates !== "object") return false;
  const at = Date.parse(`${bulletin.date}T00:00:00Z`);
  if (!Number.isFinite(at) || at > now + DAY || now - at > TCMB_MAX_AGE_DAYS * DAY) return false;
  return Object.entries(bulletin.rates).some(([code, rate]) => CODE.test(code) && Number.isFinite(rate) && rate > 0);
}

/** Turkish lira per unit of `currency` (1 for TRY); undefined when the bulletin has no usable rate. */
export function tlPerUnit(currency: string, rates: Pick<Bulletin, "rates"> | null | undefined) {
  if (currency === "TRY") return 1;
  const rate = rates?.rates?.[currency];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : undefined;
}
/** Amount in `currency` → Turkish lira. */
export function toTl(amount: number, currency: string, rates: Pick<Bulletin, "rates"> | null | undefined) {
  const rate = tlPerUnit(currency, rates);
  return rate && Number.isFinite(amount) ? amount * rate : undefined;
}
/** Turkish lira → amount in `currency` (display amount = TL price / TL per unit). */
export function fromTl(amountTl: number, currency: string, rates: Pick<Bulletin, "rates"> | null | undefined) {
  const rate = tlPerUnit(currency, rates);
  return rate && Number.isFinite(amountTl) ? amountTl / rate : undefined;
}

export type BulletinStore = { read(): Promise<unknown>; write(bulletin: Bulletin): Promise<void> };
type CacheOptions = { fetchXml: () => Promise<string>; now?: () => number; store?: BulletinStore | null; refreshMs?: number };

/**
 * Keeps the last good bulletin. `get()` re-checks TCMB when the last check is older than refreshMs
 * (one request at a time); a failed check keeps the previous bulletin and marks it stale, so the page
 * can say the rates could not be refreshed. Never returns a bulletin that bulletinUsable rejects.
 */
export function createBulletinCache({ fetchXml, now = Date.now, store = null, refreshMs = TCMB_REFRESH_MS }: CacheOptions) {
  let bulletin: Bulletin | null = null, checkedAt = -Infinity, failed = false, loaded = false;
  let pending: Promise<void> | null = null;
  const snapshot = (): RateSnapshot | null => bulletinUsable(bulletin, now()) ? { ...bulletin, rates: { ...bulletin.rates }, stale: failed } : null;
  async function load() {
    if (loaded || !store) { loaded = true; return; }
    loaded = true;
    try { const saved = await store.read(); if (bulletinUsable(saved, now()) && (!bulletin || saved.date > bulletin.date)) bulletin = saved; } catch { /* no persisted copy */ }
  }
  async function refresh() {
    checkedAt = now();
    try {
      const next = parseTcmbXml(await fetchXml());
      if (!bulletinUsable(next, now())) throw new Error("TCMB bulletin outdated");
      // An older copy (e.g. a lagging mirror) never replaces a newer bulletin.
      if (!bulletin || next.date >= bulletin.date) bulletin = next;
      failed = false;
      if (store) await store.write(bulletin).catch(() => {});
    } catch {
      failed = true;
    }
  }
  return {
    /** Cached snapshot without any network access. */
    peek: snapshot,
    async get() {
      await load();
      if (now() - checkedAt >= refreshMs) {
        pending ||= refresh().finally(() => { pending = null; });
        await pending;
      }
      return snapshot();
    },
    /** For tests: the time of the last TCMB check. */
    checkedAt: () => checkedAt,
  };
}
