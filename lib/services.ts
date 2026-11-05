// Service directory ("Hizmetler", /hizmetler): service firms (painters, plumbers, lawyers, movers…)
// that a member registers from Hesabım → "Hizmet firmam" without changing their account role.
// A new or edited profile waits for an administrator (pending → approved | rejected; an approved
// firm can be suspended). Only approved firms are public, counted or listed in the sitemap.
// Tables are created on first use (same convention as lib/projects.ts) and work on PostgreSQL and
// SQLite, with no migration file (the convention for feature tables, as projects, leads and orders).
// Room for later phases: `plan` (paid packages) and `featured`; quote requests (teklif) and reviews
// get their own tables keyed by firm_id; the one-firm-per-owner index can be dropped for teams.
import { normalizeContactPhone } from "./phone";
import { cityBySlug, districtBySlug, regionSlug } from "./region-pages";
import { isServiceSlug, SERVICE_CATEGORIES, type ServiceSlug } from "./service-categories";
import { CITIES, validDistrict } from "./turkey-locations";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type ServiceDatabase = { prepare(sql: string): Statement };

export const SERVICE_BASE = "/hizmetler";
export const SERVICE_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type ServiceStatus = typeof SERVICE_STATUSES[number];
export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = { pending: "Onay bekliyor", approved: "Yayında", rejected: "Reddedildi", suspended: "Askıya alındı" };
export const SERVICE_TRANSLATION_LOCALES = ["en", "de", "fr", "ru", "ar", "fa", "nl"] as const;
export const SERVICE_LIMITS = { nameMin: 3, nameMax: 100, descriptionMin: 30, descriptionMax: 3000, categories: 8, areas: 30, photos: 12, noteMax: 1000 } as const;
/** Firms on one category or region page (no pagination in the first release). */
export const SERVICE_PAGE_LIMIT = 60;
export const SERVICE_FEATURED_LIMIT = 8;
/** Category/region URLs in the sitemap, most firms first. */
export const SERVICE_SITEMAP_LIMIT = 5000;

export const SERVICE_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS service_firms(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL,translations TEXT NOT NULL DEFAULT '{}',phone TEXT NOT NULL,whatsapp TEXT,email TEXT,website TEXT,logo TEXT,cover TEXT,photos TEXT NOT NULL DEFAULT '[]',tax_office TEXT,tax_number TEXT,status TEXT NOT NULL DEFAULT 'pending',review_note TEXT NOT NULL DEFAULT '',verified INTEGER NOT NULL DEFAULT 0,featured INTEGER NOT NULL DEFAULT 0,plan TEXT NOT NULL DEFAULT 'free',reviewed_by TEXT,approved_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
  // One firm per member in this release.
  "CREATE UNIQUE INDEX IF NOT EXISTS service_firms_owner_idx ON service_firms(owner_id)",
  "CREATE INDEX IF NOT EXISTS service_firms_status_idx ON service_firms(status,updated_at)",
  "CREATE TABLE IF NOT EXISTS service_firm_categories(firm_id TEXT NOT NULL,category TEXT NOT NULL,PRIMARY KEY(firm_id,category))",
  "CREATE INDEX IF NOT EXISTS service_firm_categories_category_idx ON service_firm_categories(category,firm_id)",
  // district '' = the whole province.
  "CREATE TABLE IF NOT EXISTS service_firm_areas(firm_id TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL DEFAULT '',PRIMARY KEY(firm_id,city,district))",
  "CREATE INDEX IF NOT EXISTS service_firm_areas_place_idx ON service_firm_areas(city,district,firm_id)",
];

export class ServiceError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureServices(db: ServiceDatabase) {
  let promise = ready.get(db);
  if (!promise) { promise = (async () => { for (const sql of SERVICE_SCHEMA) await db.prepare(sql).run(); })(); ready.set(db, promise); promise.catch(() => ready.delete(db)); }
  await promise;
}

export type ServiceArea = { city: string; district: string };
export type ServiceFirm = {
  id: string; name: string; description: string; translations: Partial<Record<typeof SERVICE_TRANSLATION_LOCALES[number], string>>;
  categories: ServiceSlug[]; areas: ServiceArea[]; phone: string; whatsapp: string | null; email: string | null; website: string | null;
  logo: string | null; cover: string | null; photos: string[]; verified: boolean; featured: boolean; status: ServiceStatus; createdAt: string; updatedAt: string; approvedAt: string | null;
  // Owner and administrators only.
  ownerId?: string; reviewNote?: string; taxOffice?: string | null; taxNumber?: string | null; ownerName?: string; ownerEmail?: string;
};
export type ServiceActor = { id: string; admin: boolean };

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const validFirmId = (id: unknown): id is string => typeof id === "string" && UUID.test(id);
const clean = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "";
const parse = <T>(value: unknown, fallback: T): T => { try { return value == null || value === "" ? fallback : JSON.parse(String(value)) as T; } catch { return fallback; } };
const isStatus = (value: unknown): value is ServiceStatus => (SERVICE_STATUSES as readonly unknown[]).includes(value);
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

// --- URLs: /hizmetler/{kategori}[/{il}[/{ilçe}]], /hizmetler/firma/{id} ---------------------------
export type ServiceScope = { category: ServiceSlug; city?: string; district?: string };
/** Path of a category or region page; a place that is not a known Turkish location is dropped. */
export function servicePath(category: string, city?: string | null, district?: string | null) {
  if (!isServiceSlug(category)) return SERVICE_BASE;
  const parts = [SERVICE_BASE, category];
  const citySlug = city ? regionSlug(city) : "";
  if (city && cityBySlug(citySlug) === city) {
    parts.push(citySlug);
    const districtSlug = district ? regionSlug(district) : "";
    if (district && districtBySlug(city, districtSlug) === district) parts.push(districtSlug);
  }
  return parts.join("/");
}
export const firmPath = (id: string) => `${SERVICE_BASE}/firma/${id}`;
/** Route segments after /hizmetler → scope, or null (404) for unknown or non-canonical slugs. */
export function resolveServicePath(segments: string[]): ServiceScope | null {
  if (!segments.length || segments.length > 3 || !isServiceSlug(segments[0])) return null;
  const scope: ServiceScope = { category: segments[0] };
  if (segments.length === 1) return scope;
  const city = cityBySlug(segments[1]);
  if (!city) return null;
  scope.city = city;
  if (segments.length === 2) return scope;
  const district = districtBySlug(city, segments[2]);
  return district ? { ...scope, district } : null;
}

// --- Validation -----------------------------------------------------------------------------
function categoriesInput(value: unknown): ServiceSlug[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > SERVICE_LIMITS.categories) throw new ServiceError("En az bir, en fazla 8 hizmet kategorisi seçin.");
  if (value.some((item) => !isServiceSlug(item))) throw new ServiceError("Geçersiz hizmet kategorisi.");
  return [...new Set(value as ServiceSlug[])];
}
function areasInput(value: unknown): ServiceArea[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > SERVICE_LIMITS.areas) throw new ServiceError("En az bir, en fazla 30 hizmet bölgesi seçin.");
  const areas = new Map<string, ServiceArea>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ServiceError("Hizmet bölgelerini kontrol edin.");
    const city = clean((item as Record<string, unknown>).city), district = clean((item as Record<string, unknown>).district);
    if (!CITIES.includes(city) || (district && !validDistrict(city, district))) throw new ServiceError("Hizmet bölgelerini kontrol edin.");
    areas.set(`${city}|${district}`, { city, district });
  }
  // A whole province already covers its districts.
  return [...areas.values()].filter((area) => !area.district || !areas.has(`${area.city}|`))
    .sort((a, b) => a.city.localeCompare(b.city, "tr") || a.district.localeCompare(b.district, "tr"));
}
function photoInput(value: unknown, pattern: RegExp) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !pattern.test(value)) throw new ServiceError("Yalnızca kendi yüklediğiniz fotoğrafları ekleyebilirsiniz.", 403);
  return value;
}

/** Validates every editable field; throws ServiceError with a Turkish message on the first problem. */
export function validateFirm(input: Record<string, unknown>, ownerId: string) {
  const name = clean(input.name).replace(/\s+/g, " "), description = clean(input.description);
  if (name.length < SERVICE_LIMITS.nameMin || name.length > SERVICE_LIMITS.nameMax) throw new ServiceError("Firma adı 3 ile 100 karakter arasında olmalıdır.");
  if (description.length < SERVICE_LIMITS.descriptionMin || description.length > SERVICE_LIMITS.descriptionMax) throw new ServiceError("Firma açıklaması 30 ile 3000 karakter arasında olmalıdır.");
  const translations: ServiceFirm["translations"] = {};
  const given = input.translations ?? {};
  if (!given || typeof given !== "object" || Array.isArray(given)) throw new ServiceError("Açıklama çevirilerini kontrol edin.");
  for (const [locale, text] of Object.entries(given as Record<string, unknown>)) {
    if (!(SERVICE_TRANSLATION_LOCALES as readonly string[]).includes(locale) || (text != null && typeof text !== "string")) throw new ServiceError("Açıklama çevirilerini kontrol edin.");
    const value = clean(text);
    if (value.length > SERVICE_LIMITS.descriptionMax) throw new ServiceError("Firma açıklaması 30 ile 3000 karakter arasında olmalıdır.");
    if (value) translations[locale as keyof ServiceFirm["translations"]] = value;
  }
  const categories = categoriesInput(input.categories), areas = areasInput(input.areas);
  const phone = normalizeContactPhone(input.phone);
  if (!phone) throw new ServiceError("Geçerli bir telefon numarası yazın.");
  const whatsapp = clean(input.whatsapp) ? normalizeContactPhone(input.whatsapp) : null;
  if (clean(input.whatsapp) && !whatsapp) throw new ServiceError("Geçerli bir WhatsApp numarası yazın.");
  const email = clean(input.email).toLowerCase();
  if (email && (email.length > 254 || !EMAIL.test(email))) throw new ServiceError("Geçerli bir e-posta adresi yazın.");
  const websiteInput = clean(input.website);
  let website: string | null = null;
  if (websiteInput) {
    let url: URL | null = null;
    try { url = new URL(websiteInput); } catch { url = null; }
    if (!url || url.protocol !== "https:" || websiteInput.length > 300 || url.username || url.password) throw new ServiceError("Web sitesi https:// ile başlayan geçerli bir adres olmalıdır.");
    website = url.toString();
  }
  const pattern = new RegExp(`^/api/media/listings/${ownerId.replace(/[^a-zA-Z0-9-]/g, "")}/[a-f0-9-]+\\.(jpg|png|webp)$`);
  const logo = photoInput(input.logo, pattern), cover = photoInput(input.cover, pattern);
  const photos = input.photos == null ? [] : input.photos;
  if (!Array.isArray(photos) || photos.length > SERVICE_LIMITS.photos) throw new ServiceError("En fazla 12 iş fotoğrafı ekleyebilirsiniz.");
  for (const url of photos) photoInput(url, pattern);
  const all = [logo, cover, ...photos].filter(Boolean);
  if (new Set(all).size !== all.length) throw new ServiceError("Aynı fotoğraf birden fazla eklenemez.");
  const taxOffice = clean(input.taxOffice), taxNumber = clean(input.taxNumber).replace(/\s+/g, "");
  if (taxOffice.length > 80) throw new ServiceError("Vergi dairesi en fazla 80 karakter olabilir.");
  if (taxNumber && !/^\d{10,11}$/.test(taxNumber)) throw new ServiceError("Vergi numarası 10, T.C. kimlik numarası 11 haneli olmalıdır.");
  return { name, description, translations, categories, areas, phone, whatsapp, email: email || null, website, logo, cover, photos: photos as string[], taxOffice: taxOffice || null, taxNumber: taxNumber || null };
}
type CleanFirm = ReturnType<typeof validateFirm>;

export const firmImageUrls = (firm: { logo?: unknown; cover?: unknown; photos?: unknown }) =>
  [firm.logo, firm.cover, ...(Array.isArray(firm.photos) ? firm.photos : parse<unknown[]>(firm.photos, []))].filter((url): url is string => typeof url === "string" && url.startsWith("/api/media/listings/"));
export const firmImageKeys = (firm: { logo?: unknown; cover?: unknown; photos?: unknown }) => firmImageUrls(firm).map((url) => url.slice("/api/media/".length));

// A photo belongs to one listing, project or firm only, so deleting one never removes another's photo.
async function assertImagesFree(db: ServiceDatabase, images: string[], firmId: string) {
  for (const url of images) {
    const key = url.slice("/api/media/".length), like = `%"${url}"%`;
    if (await db.prepare("SELECT 1 AS used FROM property_images WHERE object_key=?").bind(key).first()) throw new ServiceError("Bir ilanda kullanılan fotoğraf firma profiline eklenemez.", 409);
    if (await db.prepare("SELECT 1 AS used FROM service_firms WHERE id<>? AND (logo=? OR cover=? OR photos LIKE ?)").bind(firmId, url, url, like).first()) throw new ServiceError("Bu fotoğraf başka bir firma profilinde kullanılıyor.", 409);
    // projects is created on first use by lib/projects.ts; a database without it has no project photos.
    const project = await db.prepare("SELECT 1 AS used FROM projects WHERE images LIKE ?").bind(like).first().catch(() => null);
    if (project) throw new ServiceError("Bu fotoğraf başka bir firma profilinde kullanılıyor.", 409);
  }
}

async function writeRelations(db: ServiceDatabase, id: string, firm: Pick<CleanFirm, "categories" | "areas">) {
  await db.prepare("DELETE FROM service_firm_categories WHERE firm_id=?").bind(id).run();
  await db.prepare("DELETE FROM service_firm_areas WHERE firm_id=?").bind(id).run();
  for (const category of firm.categories) await db.prepare("INSERT INTO service_firm_categories(firm_id,category) VALUES(?,?)").bind(id, category).run();
  for (const area of firm.areas) await db.prepare("INSERT INTO service_firm_areas(firm_id,city,district) VALUES(?,?,?)").bind(id, area.city, area.district).run();
}

// --- Rows → objects ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
function toFirm(row: Row, relations: { categories: ServiceSlug[]; areas: ServiceArea[] }, privateView = false): ServiceFirm {
  const firm: ServiceFirm = {
    id: String(row.id), name: String(row.name), description: String(row.description), translations: parse(row.translations, {}),
    categories: relations.categories, areas: relations.areas, phone: String(row.phone || ""), whatsapp: row.whatsapp ? String(row.whatsapp) : null,
    email: row.email ? String(row.email) : null, website: row.website ? String(row.website) : null, logo: row.logo ? String(row.logo) : null, cover: row.cover ? String(row.cover) : null,
    photos: parse<string[]>(row.photos, []), verified: Number(row.verified) === 1 || row.verified === true, featured: Number(row.featured) === 1 || row.featured === true,
    status: isStatus(row.status) ? row.status : "pending", createdAt: String(row.created_at), updatedAt: String(row.updated_at), approvedAt: row.approved_at ? String(row.approved_at) : null,
  };
  if (privateView) Object.assign(firm, {
    ownerId: String(row.owner_id), reviewNote: String(row.review_note || ""), taxOffice: row.tax_office ? String(row.tax_office) : null, taxNumber: row.tax_number ? String(row.tax_number) : null,
    ...(row.owner_name != null ? { ownerName: String(row.owner_name) } : {}), ...(row.owner_email != null ? { ownerEmail: String(row.owner_email) } : {}),
  });
  return firm;
}

const ORDER = [...SERVICE_CATEGORIES.map((category) => category.slug)];
async function withRelations(db: ServiceDatabase, rows: Row[], privateView = false) {
  if (!rows.length) return [];
  const ids = rows.map((row) => String(row.id)), marks = ids.map(() => "?").join(",");
  const [categories, areas] = await Promise.all([
    db.prepare(`SELECT firm_id,category FROM service_firm_categories WHERE firm_id IN (${marks})`).bind(...ids).all<Row>(),
    db.prepare(`SELECT firm_id,city,district FROM service_firm_areas WHERE firm_id IN (${marks})`).bind(...ids).all<Row>(),
  ]);
  const byFirm = new Map(ids.map((id) => [id, { categories: [] as ServiceSlug[], areas: [] as ServiceArea[] }]));
  for (const row of categories.results || []) if (isServiceSlug(row.category)) byFirm.get(String(row.firm_id))?.categories.push(row.category);
  for (const row of areas.results || []) byFirm.get(String(row.firm_id))?.areas.push({ city: String(row.city), district: String(row.district || "") });
  for (const relation of byFirm.values()) {
    relation.categories.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    relation.areas.sort((a, b) => a.city.localeCompare(b.city, "tr") || a.district.localeCompare(b.district, "tr"));
  }
  return rows.map((row) => toFirm(row, byFirm.get(String(row.id))!, privateView));
}

async function firmRow(db: ServiceDatabase, id: string) {
  if (!validFirmId(id)) return null;
  await ensureServices(db);
  return db.prepare("SELECT * FROM service_firms WHERE id=?").bind(id).first<Row>();
}

// --- Owner ------------------------------------------------------------------------------------
/** The member's own firm (any status) or null. */
export async function ownerFirm(db: ServiceDatabase, ownerId: string) {
  await ensureServices(db);
  const row = await db.prepare("SELECT * FROM service_firms WHERE owner_id=?").bind(ownerId).first<Row>();
  return row ? (await withRelations(db, [row], true))[0] : null;
}

export async function createFirm(db: ServiceDatabase, actor: ServiceActor, input: Record<string, unknown>, at = new Date()) {
  const firm = validateFirm(input, actor.id);
  if (input.terms !== true) throw new ServiceError("Devam etmek için firma bilgilerinin yayınlanmasını onaylayın.");
  await ensureServices(db);
  if (await db.prepare("SELECT id FROM service_firms WHERE owner_id=?").bind(actor.id).first()) throw new ServiceError("Hesabınıza bağlı bir hizmet firması zaten var.", 409);
  const id = crypto.randomUUID(), stamp = at.toISOString();
  await assertImagesFree(db, firmImageUrls(firm), id);
  // Administrators publish directly; everyone else waits for review.
  const status: ServiceStatus = actor.admin ? "approved" : "pending";
  await db.prepare("INSERT INTO service_firms(id,owner_id,name,description,translations,phone,whatsapp,email,website,logo,cover,photos,tax_office,tax_number,status,review_note,verified,featured,plan,reviewed_by,approved_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'',0,0,'free',?,?,?,?)")
    .bind(id, actor.id, firm.name, firm.description, JSON.stringify(firm.translations), firm.phone, firm.whatsapp, firm.email, firm.website, firm.logo, firm.cover, JSON.stringify(firm.photos), firm.taxOffice, firm.taxNumber, status, actor.admin ? actor.id : null, actor.admin ? stamp : null, stamp, stamp).run();
  await writeRelations(db, id, firm);
  return { id, status };
}

const inputFromRow = (row: Row, relations: { categories: string[]; areas: ServiceArea[] }): Record<string, unknown> => ({
  name: row.name, description: row.description, translations: parse(row.translations, {}), categories: relations.categories, areas: relations.areas, phone: row.phone, whatsapp: row.whatsapp || "",
  email: row.email || "", website: row.website || "", logo: row.logo || null, cover: row.cover || null, photos: parse(row.photos, []), taxOffice: row.tax_office || "", taxNumber: row.tax_number || "",
});
const EDITABLE = ["name", "description", "translations", "categories", "areas", "phone", "whatsapp", "email", "website", "logo", "cover", "photos", "taxOffice", "taxNumber"];

/** Owner or admin. An owner's edit goes back to review (a suspended firm stays suspended). Returns photo keys no longer used. */
export async function updateFirm(db: ServiceDatabase, actor: ServiceActor, id: string, input: Record<string, unknown>, at = new Date()) {
  const row = await firmRow(db, id);
  if (!row) throw new ServiceError("Firma bulunamadı.", 404);
  const ownerId = String(row.owner_id);
  if (ownerId !== actor.id && !actor.admin) throw new ServiceError("Bu firmayı düzenleme yetkiniz yok.", 403);
  const [current] = await withRelations(db, [row], true);
  const merged = inputFromRow(row, current);
  for (const key of EDITABLE) if (Object.hasOwn(input, key)) merged[key] = input[key];
  const firm = validateFirm(merged, ownerId);
  await assertImagesFree(db, firmImageUrls(firm), id);
  const previousStatus = isStatus(row.status) ? row.status : "pending";
  const status: ServiceStatus = actor.admin || previousStatus === "suspended" ? previousStatus : "pending";
  const note = actor.admin || previousStatus === "suspended" ? String(row.review_note || "") : "";
  const stamp = at.toISOString();
  await db.prepare("UPDATE service_firms SET name=?,description=?,translations=?,phone=?,whatsapp=?,email=?,website=?,logo=?,cover=?,photos=?,tax_office=?,tax_number=?,status=?,review_note=?,updated_at=? WHERE id=?")
    .bind(firm.name, firm.description, JSON.stringify(firm.translations), firm.phone, firm.whatsapp, firm.email, firm.website, firm.logo, firm.cover, JSON.stringify(firm.photos), firm.taxOffice, firm.taxNumber, status, note, stamp, id).run();
  await writeRelations(db, id, firm);
  const kept = new Set(firmImageKeys(firm)), previous = firmImageKeys({ logo: row.logo, cover: row.cover, photos: row.photos });
  return { id, status, updatedAt: stamp, removedKeys: previous.filter((key) => !kept.has(key)), addedKeys: [...kept].filter((key) => !previous.includes(key)) };
}

/** Owner or admin. Removes the firm and its categories and areas; returns photo keys to delete. */
export async function deleteFirm(db: ServiceDatabase, actor: ServiceActor, id: string) {
  const row = await firmRow(db, id);
  if (!row) throw new ServiceError("Firma bulunamadı.", 404);
  if (String(row.owner_id) !== actor.id && !actor.admin) throw new ServiceError("Bu firmayı silme yetkiniz yok.", 403);
  await db.prepare("DELETE FROM service_firm_categories WHERE firm_id=?").bind(id).run();
  await db.prepare("DELETE FROM service_firm_areas WHERE firm_id=?").bind(id).run();
  await db.prepare("DELETE FROM service_firms WHERE id=?").bind(id).run();
  return { id, imageKeys: firmImageKeys({ logo: row.logo, cover: row.cover, photos: row.photos }) };
}

// --- Public reads (approved only) ---------------------------------------------------------------
const PUBLIC_ORDER = "ORDER BY f.featured DESC,f.verified DESC,f.approved_at DESC,f.id ASC";

/** Approved firm, or for its owner and administrators any status (with private fields). */
export async function firmById(db: ServiceDatabase, id: string, viewer: ServiceActor | null = null) {
  const row = await firmRow(db, id);
  if (!row) return null;
  const privileged = Boolean(viewer && (viewer.admin || viewer.id === String(row.owner_id)));
  if (row.status !== "approved" && !privileged) return null;
  return (await withRelations(db, [row], privileged))[0];
}

function scopeWhere(scope: Partial<ServiceScope>) {
  const where = ["f.status='approved'"], values: string[] = [];
  if (scope.category) { where.push("EXISTS(SELECT 1 FROM service_firm_categories c WHERE c.firm_id=f.id AND c.category=?)"); values.push(scope.category); }
  if (scope.city && scope.district) { where.push("EXISTS(SELECT 1 FROM service_firm_areas a WHERE a.firm_id=f.id AND a.city=? AND (a.district='' OR a.district=?))"); values.push(scope.city, scope.district); }
  else if (scope.city) { where.push("EXISTS(SELECT 1 FROM service_firm_areas a WHERE a.firm_id=f.id AND a.city=?)"); values.push(scope.city); }
  return { where: where.join(" AND "), values };
}

/** Approved firms of a category and place, featured and verified first. */
export async function publicFirms(db: ServiceDatabase, scope: Partial<ServiceScope> = {}, limit = SERVICE_PAGE_LIMIT) {
  await ensureServices(db);
  const { where, values } = scopeWhere(scope);
  const rows = await db.prepare(`SELECT f.* FROM service_firms f WHERE ${where} ${PUBLIC_ORDER} LIMIT ?`).bind(...values, Math.max(1, Math.min(200, limit))).all<Row>();
  return withRelations(db, rows.results || []);
}

/** Landing page: featured firms first, otherwise the newest approved ones. */
export const featuredFirms = (db: ServiceDatabase, limit = SERVICE_FEATURED_LIMIT) => publicFirms(db, {}, limit);

/** Approved firms per category (landing tiles). Categories without firms are 0. */
export async function categoryCounts(db: ServiceDatabase) {
  await ensureServices(db);
  const rows = await db.prepare("SELECT c.category AS category,COUNT(*) AS n FROM service_firm_categories c JOIN service_firms f ON f.id=c.firm_id WHERE f.status='approved' GROUP BY c.category").bind().all<Row>();
  const counts = Object.fromEntries(SERVICE_CATEGORIES.map((category) => [category.slug, 0])) as Record<ServiceSlug, number>;
  for (const row of rows.results || []) if (isServiceSlug(row.category)) counts[row.category] = Number(row.n) || 0;
  return counts;
}

export type ServicePlaceLink = { city: string; district: string; path: string; count: number };
export type ServiceSummary = {
  /** Approved firms shown on the page (province-wide firms included on district pages). */
  count: number;
  /** Firms that named this place themselves; decides indexing (see serviceIndexable). */
  local: number;
  cities: ServicePlaceLink[]; districts: ServicePlaceLink[];
};
/** (firm, city, district) rows of approved firms in one category, for the counts and place links. */
export const SERVICE_FACETS_SQL = "SELECT DISTINCT f.id AS firm_id,a.city AS city,a.district AS district FROM service_firms f JOIN service_firm_categories c ON c.firm_id=f.id JOIN service_firm_areas a ON a.firm_id=f.id WHERE f.status='approved' AND c.category=? LIMIT 20000";
export async function serviceFacets(db: ServiceDatabase, category: ServiceSlug) {
  await ensureServices(db);
  return ((await db.prepare(SERVICE_FACETS_SQL).bind(category).all<Row>()).results || []).map((row) => ({ firm: String(row.firm_id), city: String(row.city), district: String(row.district || "") }));
}
/** Counts and place links for a category page from its facet rows. */
export function summarizeService(scope: ServiceScope, facets: { firm: string; city: string; district: string }[]): ServiceSummary {
  const set = (filter: (facet: { city: string; district: string }) => boolean) => new Set(facets.filter(filter).map((facet) => facet.firm));
  const shown = !scope.city ? set(() => true) : scope.district ? set((f) => f.city === scope.city && (!f.district || f.district === scope.district)) : set((f) => f.city === scope.city);
  const local = !scope.city ? shown : scope.district ? set((f) => f.city === scope.city && f.district === scope.district) : shown;
  const perCity = new Map<string, Set<string>>(), perDistrict = new Map<string, Set<string>>();
  for (const facet of facets) {
    if (!perCity.has(facet.city)) perCity.set(facet.city, new Set());
    perCity.get(facet.city)!.add(facet.firm);
    if (scope.city && facet.city === scope.city && facet.district) {
      if (!perDistrict.has(facet.district)) perDistrict.set(facet.district, new Set());
      perDistrict.get(facet.district)!.add(facet.firm);
    }
  }
  const links = (map: Map<string, Set<string>>, place: (key: string) => [string, string]) => [...map].map(([key, firms]) => {
    const [city, district] = place(key);
    return { city, district, path: servicePath(scope.category, city, district || null), count: firms.size };
  }).filter((link) => link.path.split("/").length > 3).sort((a, b) => b.count - a.count || (a.district || a.city).localeCompare(b.district || b.city, "tr"));
  return { count: shown.size, local: local.size, cities: links(perCity, (city) => [city, ""]), districts: links(perDistrict, (district) => [scope.city!, district]) };
}
/**
 * Pages without a firm are thin content: noindex and never in the sitemap. A district page needs a
 * firm that chose that district; province-wide firms are listed there too but would otherwise make
 * every district of the province an indexable copy of the province page.
 */
export const serviceIndexable = (summary: Pick<ServiceSummary, "local">) => summary.local > 0;

// --- Sitemap ------------------------------------------------------------------------------------
export const SERVICE_SITEMAP_SQL = "SELECT f.id AS firm_id,f.updated_at AS updated_at,c.category AS category,a.city AS city,a.district AS district FROM service_firms f JOIN service_firm_categories c ON c.firm_id=f.id JOIN service_firm_areas a ON a.firm_id=f.id WHERE f.status='approved' LIMIT 50000";
/** Category and region pages with at least one firm of their own (serviceIndexable), newest update first among equals. */
export function serviceSitemapPaths(rows: Row[], limit = SERVICE_SITEMAP_LIMIT) {
  const pages = new Map<string, { path: string; firms: Set<string>; updatedAt: string }>();
  const add = (path: string, firm: string, updatedAt: string) => {
    if (path === SERVICE_BASE) return;
    const page = pages.get(path) ?? { path, firms: new Set<string>(), updatedAt: "" };
    page.firms.add(firm); if (updatedAt > page.updatedAt) page.updatedAt = updatedAt;
    pages.set(path, page);
  };
  for (const row of rows) {
    if (!isServiceSlug(row.category)) continue;
    const firm = String(row.firm_id), at = String(row.updated_at || ""), city = String(row.city), district = String(row.district || "");
    add(servicePath(row.category), firm, at);
    const cityPath = servicePath(row.category, city);
    if (cityPath.split("/").length === 4) add(cityPath, firm, at);
    if (district) { const path = servicePath(row.category, city, district); if (path.split("/").length === 5) add(path, firm, at); }
  }
  return [...pages.values()].map((page) => ({ path: page.path, count: page.firms.size, updatedAt: page.updatedAt }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path)).slice(0, limit);
}
export async function serviceSitemapEntries(db: ServiceDatabase, limit = SERVICE_SITEMAP_LIMIT) {
  await ensureServices(db);
  const rows = (await db.prepare(SERVICE_SITEMAP_SQL).bind().all<Row>()).results || [];
  const firms = new Map<string, string>();
  for (const row of rows) { const id = String(row.firm_id), at = String(row.updated_at || ""); if (!firms.has(id) || at > firms.get(id)!) firms.set(id, at); }
  return { pages: serviceSitemapPaths(rows, limit), firms: [...firms].map(([id, updatedAt]) => ({ path: firmPath(id), updatedAt })) };
}

// --- Administration -----------------------------------------------------------------------------
export const SERVICE_ADMIN_ACTIONS = ["approve", "reject", "suspend", "verify", "unverify", "feature", "unfeature"] as const;
export type ServiceAdminAction = typeof SERVICE_ADMIN_ACTIONS[number];

export async function adminFirms(db: ServiceDatabase, status: unknown = "pending") {
  await ensureServices(db);
  const filter = isStatus(status) ? status : "pending";
  const rows = await db.prepare("SELECT f.*,u.name AS owner_name,u.email AS owner_email FROM service_firms f LEFT JOIN users u ON CAST(u.id AS TEXT)=f.owner_id WHERE f.status=? ORDER BY f.updated_at ASC,f.id ASC LIMIT 200").bind(filter).all<Row>();
  const counts = await db.prepare("SELECT status,COUNT(*) AS n FROM service_firms GROUP BY status").bind().all<Row>();
  const totals = Object.fromEntries(SERVICE_STATUSES.map((name) => [name, 0])) as Record<ServiceStatus, number>;
  for (const row of counts.results || []) if (isStatus(row.status)) totals[row.status] = Number(row.n) || 0;
  return { firms: await withRelations(db, rows.results || [], true), totals };
}

/** Approve, reject or suspend (both need a note the owner can read), and the verified/featured flags. */
export async function reviewFirm(db: ServiceDatabase, adminId: string, id: unknown, action: unknown, note: unknown, at = new Date()) {
  if (!validFirmId(id) || !(SERVICE_ADMIN_ACTIONS as readonly unknown[]).includes(action)) throw new ServiceError("Geçersiz işlem.");
  const reason = clean(note);
  if (reason.length > SERVICE_LIMITS.noteMax) throw new ServiceError("İnceleme notu en fazla 1000 karakter olabilir.");
  if ((action === "reject" || action === "suspend") && reason.length < 5) throw new ServiceError("Reddetme veya askıya alma nedenini yazın.");
  const row = await firmRow(db, id);
  if (!row) throw new ServiceError("Firma bulunamadı.", 404);
  const stamp = at.toISOString();
  if (action === "approve" || action === "reject" || action === "suspend") {
    const status: ServiceStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "suspended";
    await db.prepare("UPDATE service_firms SET status=?,review_note=?,reviewed_by=?,approved_at=?,updated_at=? WHERE id=?")
      .bind(status, reason, adminId, status === "approved" ? stamp : row.approved_at == null ? null : String(row.approved_at), stamp, id).run();
    return { id, name: String(row.name), ownerId: String(row.owner_id), action, status };
  }
  const column = action === "verify" || action === "unverify" ? "verified" : "featured", value = action === "verify" || action === "feature" ? 1 : 0;
  await db.prepare(`UPDATE service_firms SET ${column}=?,reviewed_by=? WHERE id=?`).bind(value, adminId, id).run();
  return { id, name: String(row.name), ownerId: String(row.owner_id), action, status: isStatus(row.status) ? row.status : "pending" as ServiceStatus };
}

/** Media route: a firm photo is public once its firm is approved. */
export async function serviceMediaPublic(db: ServiceDatabase, key: string) {
  if (!/^listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return false;
  await ensureServices(db);
  const url = `/api/media/${key}`;
  return Boolean(await db.prepare("SELECT 1 AS ok FROM service_firms WHERE status='approved' AND (logo=? OR cover=? OR photos LIKE ?)").bind(url, url, `%"${url}"%`).first());
}

/** Description in the visitor's language when the firm wrote one, else the original. */
export const firmDescription = (firm: Pick<ServiceFirm, "description" | "translations">, locale: string) =>
  (firm.translations as Record<string, string | undefined>)[locale] || firm.description;
