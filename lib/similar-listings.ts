import type { Listing } from "./listings";
import { tlPrice, tlPriceSql } from "./listing-sort";

// "Benzer ilanlar" on the listing page: published listings with the same purpose and property type,
// the same district first, then the same city, then elsewhere; within each, the closest in price
// come first, then the newest. Prices are compared in Turkish lira (the base price): legacy EUR/USD/GBP
// listings are converted with `rates` (TL per unit from the request's TCMB bulletin, lib/listing-sort.ts
// tlRates) and must lie within ±30%; a listing without a TL value (no rate) is only ranked lower.
// The filter matches listings_search_idx (status, purpose, property_type, ...). Expired listings are
// removed by the database adapter (lib/listing-policy.ts activePublicationQuery).
export const SIMILAR_LIMIT = 6;
export const SIMILAR_PRICE_BAND = 0.3;

type Value = string | number;
export interface SimilarDatabase { prepare(query: string): { bind(...values: Value[]): { all<T = Record<string, unknown>>(): Promise<{ results: T[] }> } } }
export type SimilarBasis = Pick<Listing, "id" | "purpose" | "propertyType" | "price" | "currency" | "city" | "district" | "source">;
type Comparable = Pick<Listing, "id" | "price" | "currency" | "city" | "district" | "publishedAt" | "createdAt">;

export function similarPriceBand(price: number) {
  if (!Number.isFinite(price) || price <= 0) return null;
  return { min: Math.floor(price * (1 - SIMILAR_PRICE_BAND)), max: Math.ceil(price * (1 + SIMILAR_PRICE_BAND)) };
}

/** `columns`: extra trusted select expressions (e.g. OWNER_VERIFIED_SQL) over aliases l and u. */
export function similarListingsQuery(listing: SimilarBasis, { columns = [] as string[], limit = SIMILAR_LIMIT, rates = { TRY: 1 } as Record<string, number> } = {}) {
  const base = tlPrice(listing, rates), band = base === undefined ? null : similarPriceBand(base), tl = tlPriceSql(rates);
  const where = ["l.status='published'", "l.purpose=?", "l.property_type=?"], values: Value[] = [listing.purpose, listing.propertyType];
  // Demo listings never live in the database (and their ids are not UUIDs, which PostgreSQL would reject).
  if (listing.source !== "demo") { where.push("l.id<>?"); values.push(listing.id); }
  if (band) { where.push(`(${tl} IS NULL OR ${tl} BETWEEN ? AND ?)`); values.push(band.min, band.max); }
  const order = [
    "CASE WHEN l.city=? AND l.district=? THEN 0 WHEN l.city=? THEN 1 ELSE 2 END",
    `CASE WHEN ${tl} IS NULL THEN 1 ELSE 0 END`,
    `COALESCE(ABS(${tl}-?),0)`,
    "COALESCE(l.published_at,l.created_at) DESC",
    "l.id ASC",
  ];
  values.push(listing.city, listing.district, listing.city, Math.round(base ?? 0), limit);
  const select = ["l.*", "u.name AS owner_name", ...columns].join(",");
  return { sql: `SELECT ${select} FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${where.join(" AND ")} ORDER BY ${order.join(",")} LIMIT ?`, values };
}

/** The same order as the SQL, for in-memory demo listings. */
export function compareSimilar(listing: SimilarBasis, rates: Record<string, number> = { TRY: 1 }) {
  const base = tlPrice(listing, rates) ?? 0;
  const place = (item: Comparable) => item.city === listing.city && item.district === listing.district ? 0 : item.city === listing.city ? 1 : 2;
  const currency = (item: Comparable) => tlPrice(item, rates) === undefined ? 1 : 0;
  const distance = (item: Comparable) => { const value = tlPrice(item, rates); return value === undefined ? 0 : Math.abs(value - base); };
  const date = (item: Comparable) => item.publishedAt || item.createdAt || "";
  return (a: Comparable, b: Comparable) => place(a) - place(b) || currency(a) - currency(b) || distance(a) - distance(b) || date(b).localeCompare(date(a)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function similarIn(listing: SimilarBasis, candidates: Listing[], rates: Record<string, number> = { TRY: 1 }) {
  const base = tlPrice(listing, rates), band = base === undefined ? null : similarPriceBand(base);
  const inBand = (item: Listing) => { const value = tlPrice(item, rates); return value === undefined || (value >= band!.min && value <= band!.max); };
  return candidates
    .filter((item) => item.id !== listing.id && item.purpose === listing.purpose && item.propertyType === listing.propertyType && (!band || inBand(item)))
    .sort(compareSimilar(listing, rates));
}

/**
 * Real listings only for a real listing. A demo listing's page may also show demo listings, after
 * the real ones (as in /ilanlar, demo content only fills remaining places); ListingCard labels them.
 */
export async function similarListings(db: SimilarDatabase, listing: SimilarBasis, { parse, columns = [], demos = [], limit = SIMILAR_LIMIT, rates = { TRY: 1 } }: { parse: (row: Record<string, unknown>) => Listing; columns?: string[]; demos?: Listing[]; limit?: number; rates?: Record<string, number> }) {
  const { sql, values } = similarListingsQuery(listing, { columns, limit, rates });
  const rows = await db.prepare(sql).bind(...values).all<Record<string, unknown>>();
  const real = (rows.results || []).map(parse).filter((item) => item.id !== listing.id && item.source !== "demo");
  return listing.source === "demo" ? [...real, ...similarIn(listing, demos.filter((item) => item.source === "demo"), rates)].slice(0, limit) : real.slice(0, limit);
}

/** "Tümünü gör": the same filters on /ilanlar (purpose, type, city and, when priced, the band in this listing's stored currency). */
export function similarSearchHref(listing: SimilarBasis) {
  const query = new URLSearchParams({ purpose: listing.purpose, type: listing.propertyType, city: listing.city });
  const band = similarPriceBand(listing.price);
  if (band) { query.set("currency", listing.currency); query.set("minPrice", String(band.min)); query.set("maxPrice", String(band.max)); }
  return `/ilanlar?${query.toString()}`;
}
