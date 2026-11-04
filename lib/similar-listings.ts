import type { Listing } from "./listings";

// "Benzer ilanlar" on the listing page: published listings with the same purpose and property type,
// the same district first, then the same city, then elsewhere; within each, listings in the same
// currency and closest in price come first, then the newest. In the same currency the price must be
// within ±30%; a different currency cannot be compared without rates, so it is only ranked lower.
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
export function similarListingsQuery(listing: SimilarBasis, { columns = [] as string[], limit = SIMILAR_LIMIT } = {}) {
  const band = similarPriceBand(listing.price);
  const where = ["l.status='published'", "l.purpose=?", "l.property_type=?"], values: Value[] = [listing.purpose, listing.propertyType];
  // Demo listings never live in the database (and their ids are not UUIDs, which PostgreSQL would reject).
  if (listing.source !== "demo") { where.push("l.id<>?"); values.push(listing.id); }
  if (band) { where.push("(l.currency<>? OR l.price BETWEEN ? AND ?)"); values.push(listing.currency, band.min, band.max); }
  const order = [
    "CASE WHEN l.city=? AND l.district=? THEN 0 WHEN l.city=? THEN 1 ELSE 2 END",
    "CASE WHEN l.currency=? THEN 0 ELSE 1 END",
    "CASE WHEN l.currency=? THEN ABS(l.price-?) ELSE 0 END",
    "COALESCE(l.published_at,l.created_at) DESC",
    "l.id ASC",
  ];
  values.push(listing.city, listing.district, listing.city, listing.currency, listing.currency, Math.round(listing.price) || 0, limit);
  const select = ["l.*", "u.name AS owner_name", ...columns].join(",");
  return { sql: `SELECT ${select} FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${where.join(" AND ")} ORDER BY ${order.join(",")} LIMIT ?`, values };
}

/** The same order as the SQL, for in-memory demo listings. */
export function compareSimilar(listing: SimilarBasis) {
  const place = (item: Comparable) => item.city === listing.city && item.district === listing.district ? 0 : item.city === listing.city ? 1 : 2;
  const currency = (item: Comparable) => item.currency === listing.currency ? 0 : 1;
  const distance = (item: Comparable) => item.currency === listing.currency ? Math.abs(item.price - listing.price) : 0;
  const date = (item: Comparable) => item.publishedAt || item.createdAt || "";
  return (a: Comparable, b: Comparable) => place(a) - place(b) || currency(a) - currency(b) || distance(a) - distance(b) || date(b).localeCompare(date(a)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function similarIn(listing: SimilarBasis, candidates: Listing[]) {
  const band = similarPriceBand(listing.price);
  return candidates
    .filter((item) => item.id !== listing.id && item.purpose === listing.purpose && item.propertyType === listing.propertyType
      && (!band || item.currency !== listing.currency || (item.price >= band.min && item.price <= band.max)))
    .sort(compareSimilar(listing));
}

/**
 * Real listings only for a real listing. A demo listing's page may also show demo listings, after
 * the real ones (as in /ilanlar, demo content only fills remaining places); ListingCard labels them.
 */
export async function similarListings(db: SimilarDatabase, listing: SimilarBasis, { parse, columns = [], demos = [], limit = SIMILAR_LIMIT }: { parse: (row: Record<string, unknown>) => Listing; columns?: string[]; demos?: Listing[]; limit?: number }) {
  const { sql, values } = similarListingsQuery(listing, { columns, limit });
  const rows = await db.prepare(sql).bind(...values).all<Record<string, unknown>>();
  const real = (rows.results || []).map(parse).filter((item) => item.id !== listing.id && item.source !== "demo");
  return listing.source === "demo" ? [...real, ...similarIn(listing, demos.filter((item) => item.source === "demo"))].slice(0, limit) : real.slice(0, limit);
}

/** "Tümünü gör": the same filters on /ilanlar (purpose, type, city and, when priced, the band in this currency). */
export function similarSearchHref(listing: SimilarBasis) {
  const query = new URLSearchParams({ purpose: listing.purpose, type: listing.propertyType, city: listing.city });
  const band = similarPriceBand(listing.price);
  if (band) { query.set("currency", listing.currency); query.set("minPrice", String(band.min)); query.set("maxPrice", String(band.max)); }
  return `/ilanlar?${query.toString()}`;
}
