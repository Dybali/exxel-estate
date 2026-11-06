import type { Listing, PropertyType } from "./listings";
import { DISTRICTS } from "./turkey-locations";

// SEO region landing pages (/emlak/...): one page per city, district and purpose/type combination,
// built from published listings only. URL scheme (lowercase ASCII slugs):
//   /emlak/{il}                         Muğla
//   /emlak/{il}/{satilik|kiralik[-tür]} Antalya kiralık daire  → /emlak/antalya/kiralik-daire
//   /emlak/{il}/{ilçe}                  Bodrum                 → /emlak/mugla/bodrum
//   /emlak/{il}/{ilçe}/{amaç[-tür]}     Bodrum satılık villa   → /emlak/mugla/bodrum/satilik-villa
// District slugs never start with "satilik"/"kiralik" (tests/region-pages.test.mjs checks this), so
// the second segment is unambiguous. Demo listings never live in the database; expired listings are
// removed by the database adapter (lib/listing-policy.ts activePublicationQuery).

export const REGION_BASE = "/emlak";
export const REGION_LISTING_LIMIT = 24;
/** Price figures need at least this many real listings in one currency. */
export const REGION_PRICE_MIN = 3;
/** Rows read for price statistics; enough for a stable median, bounded for large cities. */
export const REGION_PRICE_SAMPLE = 2000;
/**
 * Region URLs in the sitemap, most listings first. Listings (up to 10,000), companies and static pages
 * come on top; each entry carries 9 hreflang links, so this keeps the file well under 50,000 URLs / 50 MB.
 */
export const REGION_SITEMAP_LIMIT = 10000;

export const REGION_PURPOSES = ["satilik", "kiralik"] as const;
export type RegionPurpose = typeof REGION_PURPOSES[number];
// Property types that get their own pages; the slug is what people type ("satilik-isyeri").
export const REGION_TYPES = [
  { type: "daire", slug: "daire" }, { type: "villa", slug: "villa" }, { type: "mustakil", slug: "mustakil-ev" },
  { type: "rezidans", slug: "rezidans" }, { type: "yazlik", slug: "yazlik" }, { type: "arsa", slug: "arsa" }, { type: "ticari", slug: "isyeri" },
] as const satisfies readonly { type: PropertyType; slug: string }[];
export type RegionType = typeof REGION_TYPES[number]["type"];

export type RegionScope = { city: string; district?: string; purpose?: RegionPurpose; type?: RegionType };
type Value = string | number;
export interface RegionDatabase { prepare(query: string): { bind(...values: Value[]): { all<T = Record<string, unknown>>(): Promise<{ results: T[] }> } } }

/** Lowercase ASCII slug: ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c (and â, î, û), anything else → "-". */
export function regionSlug(value: string) {
  return value.replace(/[İI]/g, "i").toLowerCase().replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const CITY_BY_SLUG = new Map(Object.keys(DISTRICTS).map((city) => [regionSlug(city), city]));
const DISTRICT_BY_SLUG = new Map(Object.entries(DISTRICTS).map(([city, list]) => [city, new Map(list.map((district) => [regionSlug(district), district]))]));
const TYPE_BY_SLUG = new Map<string, RegionType>(REGION_TYPES.map((item) => [item.slug, item.type]));
const SLUG_BY_TYPE = new Map<string, string>(REGION_TYPES.map((item) => [item.type, item.slug]));

export const isRegionType = (value: string): value is RegionType => SLUG_BY_TYPE.has(value);
export const cityBySlug = (slug: string) => CITY_BY_SLUG.get(slug) ?? null;
export const districtBySlug = (city: string, slug: string) => DISTRICT_BY_SLUG.get(city)?.get(slug) ?? null;

/** "satilik", "kiralik-daire", ... → purpose and optional type; null for anything else. */
export function parseCombo(slug: string): { purpose: RegionPurpose; type?: RegionType } | null {
  for (const purpose of REGION_PURPOSES) {
    if (slug === purpose) return { purpose };
    if (slug.startsWith(purpose + "-")) { const type = TYPE_BY_SLUG.get(slug.slice(purpose.length + 1)); return type ? { purpose, type } : null; }
  }
  return null;
}
export const comboSlug = (purpose: RegionPurpose, type?: RegionType) => type ? `${purpose}-${SLUG_BY_TYPE.get(type)}` : purpose;

/** Route segments after /emlak → scope, or null (404) for unknown or non-canonical slugs. */
export function resolveRegion(segments: string[]): RegionScope | null {
  if (!segments.length || segments.length > 3) return null;
  const city = cityBySlug(segments[0]);
  if (!city) return null;
  if (segments.length === 1) return { city };
  const combo = parseCombo(segments[1]);
  if (combo) return segments.length === 2 ? { city, ...combo } : null;
  const district = districtBySlug(city, segments[1]);
  if (!district) return null;
  if (segments.length === 2) return { city, district };
  const districtCombo = parseCombo(segments[2]);
  return districtCombo ? { city, district, ...districtCombo } : null;
}

/** Path of a scope, or null when the city/district is not a known Turkish location. */
export function regionPath(scope: RegionScope) {
  const city = regionSlug(scope.city);
  if (!CITY_BY_SLUG.has(city)) return null;
  const parts = [REGION_BASE, city];
  if (scope.district) { const district = regionSlug(scope.district); if (districtBySlug(scope.city, district) !== scope.district) return null; parts.push(district); }
  if (scope.purpose) parts.push(comboSlug(scope.purpose, scope.type));
  return parts.join("/");
}

/** The same filters on /ilanlar ("Tümünü gör"). */
export function regionSearchHref(scope: RegionScope) {
  const query = new URLSearchParams({ city: scope.city });
  if (scope.district) query.set("district", scope.district);
  if (scope.purpose) query.set("purpose", scope.purpose);
  if (scope.type) query.set("type", scope.type);
  return `/ilanlar?${query.toString()}`;
}

function scopeWhere(scope: RegionScope) {
  const where = ["l.status='published'", "l.city=?"], values: Value[] = [scope.city];
  if (scope.district) { where.push("l.district=?"); values.push(scope.district); }
  if (scope.purpose) { where.push("l.purpose=?"); values.push(scope.purpose); }
  if (scope.type) { where.push("l.property_type=?"); values.push(scope.type); }
  return { where: where.join(" AND "), values };
}

// --- Query 1: counts per district × purpose × type for the whole city (listings_location_idx). ---
export type RegionFacet = { district: string; purpose: string; type: string; count: number; updatedAt: string };
export const REGION_FACETS_SQL = "SELECT l.district AS district,l.purpose AS purpose,l.property_type AS property_type,COUNT(*) AS count,MAX(l.updated_at) AS updated_at FROM listings l WHERE l.status='published' AND l.city=? GROUP BY l.district,l.purpose,l.property_type";
const facetOf = (row: Record<string, unknown>): RegionFacet => ({ district: String(row.district), purpose: String(row.purpose), type: String(row.property_type), count: Number(row.count) || 0, updatedAt: row.updated_at == null ? "" : String(row.updated_at) });
export async function regionFacets(db: RegionDatabase, city: string) {
  return ((await db.prepare(REGION_FACETS_SQL).bind(city).all<Record<string, unknown>>()).results || []).map(facetOf);
}

const inScope = (facet: { district: string; purpose: string; type: string }, scope: Omit<RegionScope, "city">) =>
  (!scope.district || facet.district === scope.district) && (!scope.purpose || facet.purpose === scope.purpose) && (!scope.type || facet.type === scope.type);
const latest = (a: string, b: string) => (b > a ? b : a);

export type RegionLink = { scope: RegionScope; path: string; count: number };
export type RegionSummary = {
  count: number; updatedAt: string;
  /** Most common property types in scope, most listings first. */
  types: { type: string; count: number }[];
  /** Purpose/type pages next to this one (same place), with listings only. */
  combos: RegionLink[];
  /** Districts of the city with listings for this purpose/type, most listings first. */
  districts: RegionLink[];
};

/** Everything the page needs except prices and the listings themselves, from the facet rows. */
export function summarizeRegion(scope: RegionScope, facets: RegionFacet[]): RegionSummary {
  const own = facets.filter((facet) => inScope(facet, scope));
  const count = own.reduce((sum, facet) => sum + facet.count, 0), updatedAt = own.reduce((at, facet) => latest(at, facet.updatedAt), "");
  const byType = new Map<string, number>();
  for (const facet of own) byType.set(facet.type, (byType.get(facet.type) || 0) + facet.count);
  const types = [...byType].map(([type, n]) => ({ type, count: n })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  const place = { district: scope.district }, link = (target: RegionScope, n: number): RegionLink[] => { const path = regionPath(target); return path && n > 0 ? [{ scope: target, path, count: n }] : []; };
  const sum = (filter: Omit<RegionScope, "city">) => facets.filter((facet) => inScope(facet, filter)).reduce((total, facet) => total + facet.count, 0);
  const combos = REGION_PURPOSES.flatMap((purpose) => [
    ...link({ city: scope.city, ...(scope.district ? place : {}), purpose }, sum({ ...place, purpose })),
    ...REGION_TYPES.flatMap(({ type }) => link({ city: scope.city, ...(scope.district ? place : {}), purpose, type }, sum({ ...place, purpose, type }))),
  ]);
  const perDistrict = new Map<string, number>();
  for (const facet of facets) if (inScope(facet, { purpose: scope.purpose, type: scope.type })) perDistrict.set(facet.district, (perDistrict.get(facet.district) || 0) + facet.count);
  const districts = [...perDistrict].flatMap(([district, n]) => link({ city: scope.city, district, purpose: scope.purpose, type: scope.type }, n))
    .sort((a, b) => b.count - a.count || (a.scope.district || "").localeCompare(b.scope.district || "", "tr"));
  return { count, updatedAt, types, combos, districts };
}

/** Pages without a real listing are thin content: noindex, and never in the sitemap. */
export const regionIndexable = (summary: Pick<RegionSummary, "count">) => summary.count > 0;

// --- Query 2: prices for statistics; only when a purpose is chosen (sale and rent prices never mix). ---
export type RegionPriceStats = { currency: string; listings: number; min: number; max: number; medianPerSqm: number | null };
export function regionPriceQuery(scope: RegionScope) {
  const { where, values } = scopeWhere(scope);
  return { sql: `SELECT l.price AS price,l.currency AS currency,l.gross_area AS gross_area FROM listings l WHERE ${where} LIMIT ?`, values: [...values, REGION_PRICE_SAMPLE] };
}
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1; return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
/**
 * Price range in Turkish lira (the base price) and, for a single property type, the median price per
 * m². Legacy EUR/USD/GBP listings are converted with `rates` (TL per unit, one TCMB bulletin per
 * request, lib/listing-sort.ts tlRates); a listing whose currency has no rate is left out. The page
 * shows the figures in the visitor's display currency. null below REGION_PRICE_MIN listings.
 */
export function regionPriceStats(rows: { price: unknown; currency: unknown; gross_area: unknown }[], { perSqm, rates = { TRY: 1 } }: { perSqm: boolean; rates?: Record<string, number> }): RegionPriceStats | null {
  const list = rows.map((row) => ({ price: Number(row.price) * (rates[String(row.currency || "")] ?? NaN), area: Number(row.gross_area) })).filter((row) => Number.isFinite(row.price) && row.price > 0);
  const currency = "TRY";
  if (list.length < REGION_PRICE_MIN) return null;
  const prices = list.map((row) => row.price), unit = list.filter((row) => Number.isFinite(row.area) && row.area > 0).map((row) => row.price / row.area);
  return { currency, listings: list.length, min: Math.min(...prices), max: Math.max(...prices), medianPerSqm: perSqm && unit.length >= REGION_PRICE_MIN ? Math.round(median(unit)) : null };
}
export async function regionPrices(db: RegionDatabase, scope: RegionScope, rates?: Record<string, number>) {
  if (!scope.purpose) return null;
  const { sql, values } = regionPriceQuery(scope);
  const rows = (await db.prepare(sql).bind(...values).all<{ price: unknown; currency: unknown; gross_area: unknown }>()).results || [];
  return regionPriceStats(rows, { perSqm: Boolean(scope.type), rates });
}

// --- Query 3: the listings (same default order as /ilanlar: featured, then newest). ---
/** `columns`: extra trusted select expressions (e.g. OWNER_VERIFIED_SQL) over aliases l and u. */
export function regionListingsQuery(scope: RegionScope, { columns = [] as string[], limit = REGION_LISTING_LIMIT } = {}) {
  const { where, values } = scopeWhere(scope);
  const select = ["l.*", "u.name AS owner_name", ...columns].join(",");
  return { sql: `SELECT ${select} FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${where} ORDER BY l.featured DESC,l.created_at DESC,l.id ASC LIMIT ?`, values: [...values, limit] };
}
export async function regionListings(db: RegionDatabase, scope: RegionScope, { parse, columns = [], limit = REGION_LISTING_LIMIT }: { parse: (row: Record<string, unknown>) => Listing; columns?: string[]; limit?: number }) {
  const { sql, values } = regionListingsQuery(scope, { columns, limit });
  return ((await db.prepare(sql).bind(...values).all<Record<string, unknown>>()).results || []).map(parse).filter((item) => item.source !== "demo");
}
/** Labelled sample listings for this scope, shown only when there is no real listing (never counted). */
export const regionDemos = (scope: RegionScope, demos: Listing[]) =>
  demos.filter((item) => item.source === "demo" && item.city === scope.city && inScope({ district: item.district, purpose: item.purpose, type: item.propertyType }, scope));

// --- Sitemap: one query over all published listings, grouped like the facets. ---
export const REGION_SITEMAP_SQL = "SELECT l.city AS city,l.district AS district,l.purpose AS purpose,l.property_type AS property_type,COUNT(*) AS count,MAX(l.updated_at) AS updated_at FROM listings l WHERE l.status='published' GROUP BY l.city,l.district,l.purpose,l.property_type";
/** Every region page with at least one real listing (regionIndexable), with its newest update. */
export function regionSitemapPaths(rows: Record<string, unknown>[], limit = REGION_SITEMAP_LIMIT) {
  const pages = new Map<string, { path: string; count: number; updatedAt: string }>();
  const add = (scope: RegionScope, count: number, updatedAt: string) => {
    const path = regionPath(scope);
    if (!path || count <= 0) return;
    const page = pages.get(path);
    if (page) { page.count += count; page.updatedAt = latest(page.updatedAt, updatedAt); } else pages.set(path, { path, count, updatedAt });
  };
  for (const row of rows) {
    const city = String(row.city), facet = facetOf(row), purpose = (REGION_PURPOSES as readonly string[]).includes(facet.purpose) ? facet.purpose as RegionPurpose : undefined;
    const type = isRegionType(facet.type) ? facet.type : undefined, district = regionPath({ city, district: facet.district }) ? facet.district : undefined;
    for (const place of district ? [{ city }, { city, district }] : [{ city }]) {
      add(place, facet.count, facet.updatedAt);
      if (purpose) { add({ ...place, purpose }, facet.count, facet.updatedAt); if (type) add({ ...place, purpose, type }, facet.count, facet.updatedAt); }
    }
  }
  return [...pages.values()].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, limit);
}
export async function regionSitemapEntries(db: RegionDatabase, limit = REGION_SITEMAP_LIMIT) {
  return regionSitemapPaths((await db.prepare(REGION_SITEMAP_SQL).bind().all<Record<string, unknown>>()).results || [], limit);
}
