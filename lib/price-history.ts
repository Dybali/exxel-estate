// Price history of a listing, read from the price_history table that PUT /api/listings/[id] writes
// whenever price, currency or purpose changes. A row whose old and new price are equal marks a new
// starting point (currency or purpose changed): percentages are never computed across it.
export type PriceHistoryRow = { id?: unknown; old_price: unknown; new_price: unknown; currency: unknown; purpose: unknown; changed_at: unknown };
export type PriceChangeKind = "down" | "up" | "currency" | "purpose" | "reset";
export type PriceChange = { at: string; oldPrice: number; newPrice: number; currency: string; purpose: string; kind: PriceChangeKind; change: number | null };
export type PricePoint = { at: string; price: number };
export type PriceDrop = { oldPrice: number; newPrice: number; change: number; at: string };
export type PriceHistory = {
  /** Newest first, for the list. */
  changes: PriceChange[];
  /** Step series in the current currency and purpose, oldest first, ending at "now"; empty when there is no trend to draw. */
  points: PricePoint[];
  currency: string;
  /** Set when the latest change was a decrease in the listing's current currency and purpose. */
  drop: PriceDrop | null;
};
type Current = { price: number; currency: string; purpose: string; publishedAt?: string; createdAt?: string };

export const PRICE_HISTORY_LIMIT = 50;
export const PRICE_HISTORY_SQL = `SELECT id,old_price,new_price,currency,purpose,changed_at FROM price_history WHERE listing_id=? ORDER BY changed_at DESC LIMIT ${PRICE_HISTORY_LIMIT}`;
export const RECENT_DROP_DAYS = 30;

const time = (value: string) => Date.parse(value);
const valid = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

function normalize(rows: PriceHistoryRow[]) {
  return rows
    .map((row) => ({ id: String(row.id ?? ""), oldPrice: Number(row.old_price), newPrice: Number(row.new_price), currency: String(row.currency || ""), purpose: String(row.purpose || ""), at: String(row.changed_at) }))
    .filter((row) => row.oldPrice > 0 && row.newPrice > 0 && Number.isFinite(row.oldPrice) && Number.isFinite(row.newPrice) && row.currency && valid(row.at))
    .sort((a, b) => time(a.at) - time(b.at) || a.id.localeCompare(b.id));
}

export function priceHistory(rows: PriceHistoryRow[], current: Current, now = new Date().toISOString()): PriceHistory | null {
  const ordered = normalize(rows);
  if (!ordered.length) return null;
  const changes: PriceChange[] = ordered.map((row, index) => {
    const previous = ordered[index - 1];
    if (row.oldPrice === row.newPrice) {
      const kind: PriceChangeKind = !previous ? "reset" : previous.currency !== row.currency ? "currency" : previous.purpose !== row.purpose ? "purpose" : "reset";
      return { at: row.at, oldPrice: row.oldPrice, newPrice: row.newPrice, currency: row.currency, purpose: row.purpose, kind, change: null };
    }
    return { at: row.at, oldPrice: row.oldPrice, newPrice: row.newPrice, currency: row.currency, purpose: row.purpose, kind: row.newPrice < row.oldPrice ? "down" : "up", change: (row.newPrice - row.oldPrice) / row.oldPrice };
  });
  // Current segment: changes since the last currency/purpose switch, in the listing's own currency and purpose.
  let start = 0;
  changes.forEach((change, index) => {
    if (change.currency !== current.currency || change.purpose !== current.purpose) start = index + 1;
    else if (change.change === null) start = index;
  });
  const segment = changes.slice(start);
  const points: PricePoint[] = [];
  if (segment.some((change) => change.change !== null)) {
    const first = segment[0];
    if (first.change === null) points.push({ at: first.at, price: first.newPrice });
    else {
      const origin = [current.publishedAt, current.createdAt].find((value) => valid(value) && time(value!) < time(first.at));
      points.push({ at: origin || first.at, price: first.oldPrice }, { at: first.at, price: first.newPrice });
    }
    for (const change of segment.slice(1)) if (change.change !== null) points.push({ at: change.at, price: change.newPrice });
    const end = valid(now) && time(now) > time(points[points.length - 1].at) ? now : points[points.length - 1].at;
    points.push({ at: end, price: current.price });
  }
  const last = changes[changes.length - 1];
  const drop = last.kind === "down" && last.currency === current.currency && last.purpose === current.purpose && last.newPrice === current.price
    ? { oldPrice: last.oldPrice, newPrice: last.newPrice, change: last.change!, at: last.at }
    : null;
  return { changes: [...changes].reverse(), points, currency: current.currency, drop };
}

// One correlated subquery per listing row (index price_history_listing_idx): "changed_at|old_price"
// when the listing's latest price change was a drop to its current price, else NULL. Works on
// PostgreSQL and SQLite; the 30-day window is checked in recentPriceDrop.
export const PRICE_DROP_SQL = "(SELECT CASE WHEN h.new_price<h.old_price AND h.new_price=l.price AND h.currency=l.currency AND h.purpose=l.purpose THEN h.changed_at || '|' || CAST(h.old_price AS TEXT) END FROM price_history h WHERE h.listing_id=l.id ORDER BY h.changed_at DESC,h.id DESC LIMIT 1) AS price_drop";

export function recentPriceDrop(value: unknown, price: number, now = Date.now(), days = RECENT_DROP_DAYS) {
  if (typeof value !== "string") return undefined;
  const split = value.lastIndexOf("|"), at = value.slice(0, split), from = Number(value.slice(split + 1));
  if (split < 1 || !valid(at) || !(from > price)) return undefined;
  const age = now - time(at);
  return age >= -86400000 && age <= days * 86400000 ? { from, at } : undefined;
}
