// Contractor directory ("Müteahhitler", /muteahhitler): construction firms that a member registers from
// Hesabım → "Müteahhit firmam" without changing their account role, with their completed projects, the
// provinces they build in and the Ministry contractor licence number ("Yapı Müteahhitliği Yetki Belgesi").
// Like the service directory (lib/services.ts) a new or edited profile waits for an administrator
// (pending → approved | rejected; an approved firm can be suspended); only approved firms are public.
// "Doğrulanmış müteahhit" is a separate flag an administrator sets after checking the licence.
// Land-for-flats requests ("kat karşılığı", /muteahhitler/kat-karsiligi): a landowner describes a plot,
// matching contractors that accept such deals get it and send one offer each (landowner's share of the
// flats, delivery time, note); the landowner accepts one. Contact details stay hidden until then unless
// the landowner chose to share them. estatemarket24 is not a party to any agreement.
// Housing projects for sale stay in lib/projects.ts (/projeler); a profile links its owner's approved ones.
// Tables are created on first use and work on PostgreSQL and SQLite (no migration file), docs/contractors.md.
import { countFirmStat, firmDailyStats, firmStatsSchema, type FirmStats } from "./firm-stats";
import { normalizeContactPhone } from "./phone";
import { serviceNameSortKey, serviceSearchKey, serviceSearchTokens } from "./service-text";
import { CITIES, validDistrict } from "./turkey-locations";
import { AREA_CITIES, validArea } from "./service-locations";

interface Statement { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<unknown>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }> }
export type ContractorDatabase = { prepare(sql: string): Statement };
type Row = Record<string, unknown>;

export const CONTRACTOR_BASE = "/muteahhitler";
export const LAND_PATH = `${CONTRACTOR_BASE}/kat-karsiligi`;
/** The contractor's own panel inside the Müteahhitler sub-site (app/muteahhitler/panel). */
export const CONTRACTOR_PANEL = "/muteahhitler/panel";
export const LAND_PANEL = "/hesabim?tab=kat-karsiligi";
export const contractorPath = (id: string) => `${CONTRACTOR_BASE}/firma/${id}`;

export const CONTRACTOR_SPECIALTIES = [
  { slug: "konut", name: "Konut" },
  { slug: "villa", name: "Villa" },
  { slug: "ticari", name: "Ticari ve ofis" },
  { slug: "karma", name: "Karma proje" },
  { slug: "kentsel-donusum", name: "Kentsel dönüşüm" },
  { slug: "turizm", name: "Otel ve turizm" },
  { slug: "sanayi", name: "Sanayi ve depo" },
  { slug: "restorasyon", name: "Restorasyon" },
] as const;
export type ContractorSpecialty = typeof CONTRACTOR_SPECIALTIES[number]["slug"];
export const isSpecialty = (value: unknown): value is ContractorSpecialty => CONTRACTOR_SPECIALTIES.some((item) => item.slug === value);
export const specialtyName = (slug: string) => CONTRACTOR_SPECIALTIES.find((item) => item.slug === slug)?.name || slug;

export const LAND_ZONINGS = [
  { slug: "konut", name: "Konut imarlı" },
  { slug: "ticari", name: "Ticari imarlı" },
  { slug: "karma", name: "Konut + ticari" },
  { slug: "turizm", name: "Turizm imarlı" },
  { slug: "bilinmiyor", name: "İmar durumunu bilmiyorum" },
] as const;
export type LandZoning = typeof LAND_ZONINGS[number]["slug"];
export const zoningName = (slug: string) => LAND_ZONINGS.find((item) => item.slug === slug)?.name || slug;

export const CONTRACTOR_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type ContractorStatus = typeof CONTRACTOR_STATUSES[number];
export const CONTRACTOR_STATUS_LABELS: Record<ContractorStatus, string> = { pending: "Onay bekliyor", approved: "Yayında", rejected: "Reddedildi", suspended: "Askıya alındı" };
export const CONTRACTOR_LIMITS = { nameMin: 3, nameMax: 100, descriptionMin: 30, descriptionMax: 3000, specialties: 8, areas: 30, projects: 30, projectPhotos: 20, noteMax: 1000 } as const;
export const CONTRACTOR_PER_PAGE = 24;
export const CONTRACTOR_MAX_PAGE = 5000;
export const CONTRACTOR_FEATURED_LIMIT = 6;
export const CONTRACTOR_SITEMAP_LIMIT = 20000;
/** Land requests: per member per day, contractors per request, days open. */
export const LAND_LIMITS = { perDay: 3, recipients: 12, days: 30 } as const;

export const CONTRACTOR_SCHEMA = [
  // Daily profile statistics (lib/firm-stats.ts): views, search appearances, contact clicks, requests and offers.
  firmStatsSchema("contractor_firm_stats"),
  "CREATE TABLE IF NOT EXISTS contractor_firms(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL,phone TEXT NOT NULL,whatsapp TEXT,email TEXT,website TEXT,logo TEXT,cover TEXT,founded_year INTEGER,license_number TEXT,specialties TEXT NOT NULL DEFAULT '[]',land_deals INTEGER NOT NULL DEFAULT 1,tax_office TEXT,tax_number TEXT,search_text TEXT NOT NULL DEFAULT '',name_key TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',review_note TEXT NOT NULL DEFAULT '',verified INTEGER NOT NULL DEFAULT 0,featured INTEGER NOT NULL DEFAULT 0,reviewed_by TEXT,approved_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
  // One contractor firm per member in this release.
  "CREATE UNIQUE INDEX IF NOT EXISTS contractor_firms_owner_idx ON contractor_firms(owner_id)",
  "CREATE INDEX IF NOT EXISTS contractor_firms_public_idx ON contractor_firms(status,featured,verified,created_at)",
  // district '' = the whole province.
  "CREATE TABLE IF NOT EXISTS contractor_areas(firm_id TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL DEFAULT '',PRIMARY KEY(firm_id,city,district))",
  "CREATE INDEX IF NOT EXISTS contractor_areas_place_idx ON contractor_areas(city,district,firm_id)",
  "CREATE TABLE IF NOT EXISTS contractor_projects(id TEXT PRIMARY KEY,firm_id TEXT NOT NULL,title TEXT NOT NULL,city TEXT NOT NULL,district TEXT NOT NULL DEFAULT '',year INTEGER NOT NULL,kind TEXT NOT NULL,units INTEGER,description TEXT NOT NULL DEFAULT '',photos TEXT NOT NULL DEFAULT '[]',sort INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS contractor_projects_firm_idx ON contractor_projects(firm_id,sort)",
  "CREATE TABLE IF NOT EXISTS land_requests(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT,share_contact INTEGER NOT NULL DEFAULT 0,city TEXT NOT NULL,district TEXT NOT NULL DEFAULT '',area_m2 INTEGER NOT NULL,zoning TEXT NOT NULL,emsal TEXT,expected_share INTEGER,description TEXT NOT NULL,firm_id TEXT,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,expires_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS land_requests_user_idx ON land_requests(user_id,created_at)",
  "CREATE TABLE IF NOT EXISTS land_request_recipients(request_id TEXT NOT NULL,firm_id TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL,PRIMARY KEY(request_id,firm_id))",
  "CREATE INDEX IF NOT EXISTS land_request_recipients_firm_idx ON land_request_recipients(firm_id,created_at)",
  "CREATE TABLE IF NOT EXISTS land_offers(id TEXT PRIMARY KEY,request_id TEXT NOT NULL,firm_id TEXT NOT NULL,owner_share INTEGER NOT NULL,delivery_months INTEGER NOT NULL,message TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'sent',created_at TEXT NOT NULL)",
  "CREATE UNIQUE INDEX IF NOT EXISTS land_offers_firm_idx ON land_offers(request_id,firm_id)",
];

export class ContractorError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
export async function ensureContractors(db: ContractorDatabase) {
  let promise = ready.get(db);
  if (!promise) {
    promise = (async () => { for (const sql of CONTRACTOR_SCHEMA) await db.prepare(sql).run(); })();
    ready.set(db, promise); promise.catch(() => ready.delete(db));
  }
  await promise;
}

export type ContractorArea = { city: string; district: string };
export type ContractorProject = { id: string; title: string; city: string; district: string; year: number; kind: ContractorSpecialty; units: number | null; description: string; photos: string[] };
/** Approved housing project of the same member on /projeler. */
export type ContractorListing = { id: string; name: string; city: string; district: string; deliveryDate: string | null; image: string | null };
export type ContractorFirm = {
  id: string; name: string; description: string; phone: string; whatsapp: string | null; email: string | null; website: string | null;
  logo: string | null; cover: string | null; foundedYear: number | null; licenseNumber: string | null; specialties: ContractorSpecialty[]; landDeals: boolean;
  areas: ContractorArea[]; projects: ContractorProject[]; verified: boolean; featured: boolean; status: ContractorStatus; createdAt: string; updatedAt: string;
  /** Code-only sample (lib/contractor-samples.ts): labelled everywhere, never counted, indexed or stored. */
  sample?: boolean;
  // Owner and administrators only.
  ownerId?: string; reviewNote?: string; taxOffice?: string | null; taxNumber?: string | null; ownerName?: string; ownerEmail?: string;
};
export type ContractorActor = { id: string; admin: boolean };

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const validContractorId = (id: unknown): id is string => typeof id === "string" && UUID.test(id);
const clean = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim() : "";
const parse = <T>(value: unknown, fallback: T): T => { try { return value == null || value === "" ? fallback : JSON.parse(String(value)) as T; } catch { return fallback; } };
const isStatus = (value: unknown): value is ContractorStatus => (CONTRACTOR_STATUSES as readonly unknown[]).includes(value);
const flag = (value: unknown) => Number(value) === 1 || value === true;
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const integer = (value: unknown) => { const n = typeof value === "string" && value.trim() ? Number(value) : typeof value === "number" ? value : NaN; return Number.isSafeInteger(n) ? n : null; };

// --- Validation -----------------------------------------------------------------------------------
// Work areas and completed projects may be in Türkiye or Germany (lib/service-locations.ts); kat karşılığı
// land requests are a Turkish arrangement and stay Türkiye-only (turkeyOnly).
function placeInput(value: Record<string, unknown>, message: string, turkeyOnly = false) {
  const city = clean(value.city), district = clean(value.district);
  if (turkeyOnly ? !CITIES.includes(city) || (district && !validDistrict(city, district)) : !validArea(city, district)) throw new ContractorError(message);
  return { city, district };
}
function areasInput(value: unknown): ContractorArea[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > CONTRACTOR_LIMITS.areas) throw new ContractorError("En az bir, en fazla 30 çalışma bölgesi seçin.");
  const areas = new Map<string, ContractorArea>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ContractorError("Çalışma bölgelerini kontrol edin.");
    const area = placeInput(item as Record<string, unknown>, "Çalışma bölgelerini kontrol edin.");
    areas.set(`${area.city}|${area.district}`, area);
  }
  // A whole province already covers its districts.
  return [...areas.values()].filter((area) => !area.district || !areas.has(`${area.city}|`))
    .sort((a, b) => a.city.localeCompare(b.city, "tr") || a.district.localeCompare(b.district, "tr"));
}
function photoInput(value: unknown, pattern: RegExp) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !pattern.test(value)) throw new ContractorError("Yalnızca kendi yüklediğiniz fotoğrafları ekleyebilirsiniz.", 403);
  return value;
}
function projectsInput(value: unknown, pattern: RegExp, year: number): ContractorProject[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > CONTRACTOR_LIMITS.projects) throw new ContractorError("En fazla 30 tamamlanan proje ekleyebilirsiniz.");
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ContractorError("Tamamlanan projeleri kontrol edin.");
    const input = item as Record<string, unknown>, title = clean(input.title).replace(/\s+/g, " "), description = clean(input.description);
    const label = `${index + 1}. proje`;
    if (title.length < 3 || title.length > 120) throw new ContractorError(`${label}: proje adı 3 ile 120 karakter arasında olmalıdır.`);
    const place = placeInput(input, `${label}: il ve ilçeyi kontrol edin.`);
    const built = integer(input.year), units = input.units === "" || input.units == null ? null : integer(input.units);
    if (built == null || built < 1950 || built > year) throw new ContractorError(`${label}: tamamlanma yılı 1950 ile ${year} arasında olmalıdır.`);
    if (!isSpecialty(input.kind)) throw new ContractorError(`${label}: proje türünü seçin.`);
    if (units != null && (units < 1 || units > 100000)) throw new ContractorError(`${label}: bağımsız bölüm sayısı 1 ile 100000 arasında olmalıdır.`);
    if (description.length > 1000) throw new ContractorError(`${label}: açıklama en fazla 1000 karakter olabilir.`);
    const photos = input.photos == null ? [] : input.photos;
    if (!Array.isArray(photos) || photos.length > CONTRACTOR_LIMITS.projectPhotos) throw new ContractorError(`${label}: en fazla 20 fotoğraf ekleyebilirsiniz.`);
    for (const url of photos) photoInput(url, pattern);
    const id = validContractorId(input.id) ? String(input.id).toLowerCase() : crypto.randomUUID();
    return { id, title, ...place, year: built, kind: input.kind, units, description, photos: photos as string[] };
  });
}

/** Validates every editable field; throws ContractorError with a Turkish message on the first problem. */
export function validateContractor(input: Record<string, unknown>, ownerId: string, at = new Date()) {
  const year = at.getUTCFullYear();
  const name = clean(input.name).replace(/\s+/g, " "), description = clean(input.description);
  if (name.length < CONTRACTOR_LIMITS.nameMin || name.length > CONTRACTOR_LIMITS.nameMax) throw new ContractorError("Firma adı 3 ile 100 karakter arasında olmalıdır.");
  if (description.length < CONTRACTOR_LIMITS.descriptionMin || description.length > CONTRACTOR_LIMITS.descriptionMax) throw new ContractorError("Firma açıklaması 30 ile 3000 karakter arasında olmalıdır.");
  const specialties = input.specialties;
  if (!Array.isArray(specialties) || specialties.length < 1 || specialties.length > CONTRACTOR_LIMITS.specialties || specialties.some((item) => !isSpecialty(item))) throw new ContractorError("En az bir uzmanlık alanı seçin.");
  const areas = areasInput(input.areas);
  const phone = normalizeContactPhone(input.phone);
  if (!phone) throw new ContractorError("Geçerli bir telefon numarası yazın.");
  const whatsapp = clean(input.whatsapp) ? normalizeContactPhone(input.whatsapp) : null;
  if (clean(input.whatsapp) && !whatsapp) throw new ContractorError("Geçerli bir WhatsApp numarası yazın.");
  const email = clean(input.email).toLowerCase();
  if (email && (email.length > 254 || !EMAIL.test(email))) throw new ContractorError("Geçerli bir e-posta adresi yazın.");
  const websiteInput = clean(input.website);
  let website: string | null = null;
  if (websiteInput) {
    let url: URL | null = null;
    try { url = new URL(websiteInput); } catch { url = null; }
    if (!url || url.protocol !== "https:" || websiteInput.length > 300 || url.username || url.password) throw new ContractorError("Web sitesi https:// ile başlayan geçerli bir adres olmalıdır.");
    website = url.toString();
  }
  const foundedGiven = input.foundedYear !== "" && input.foundedYear != null, founded = foundedGiven ? integer(input.foundedYear) : null;
  if (foundedGiven && (founded === null || founded < 1900 || founded > year)) throw new ContractorError(`Kuruluş yılı 1900 ile ${year} arasında olmalıdır.`);
  const license = clean(input.licenseNumber).replace(/\s+/g, " ");
  if (license && !/^[\p{L}\p{N} ./-]{3,40}$/u.test(license)) throw new ContractorError("Yetki belgesi numarası 3 ile 40 karakter arasında olmalı; harf, rakam, boşluk, nokta, tire ve eğik çizgi kullanılabilir.");
  const pattern = new RegExp(`^/api/media/listings/${ownerId.replace(/[^a-zA-Z0-9-]/g, "")}/[a-f0-9-]+\\.(jpg|png|webp)$`);
  const logo = photoInput(input.logo, pattern), cover = photoInput(input.cover, pattern);
  const projects = projectsInput(input.projects, pattern, year);
  const all = [logo, cover, ...projects.flatMap((project) => project.photos)].filter(Boolean);
  if (new Set(all).size !== all.length) throw new ContractorError("Aynı fotoğraf birden fazla eklenemez.");
  const taxOffice = clean(input.taxOffice), taxNumber = clean(input.taxNumber).replace(/\s+/g, "");
  if (taxOffice.length > 80) throw new ContractorError("Vergi dairesi en fazla 80 karakter olabilir.");
  if (taxNumber && !/^\d{10,11}$/.test(taxNumber)) throw new ContractorError("Vergi numarası 10, T.C. kimlik numarası 11 haneli olmalıdır.");
  return {
    name, description, specialties: [...new Set(specialties as ContractorSpecialty[])], areas, phone, whatsapp, email: email || null, website, logo, cover,
    foundedYear: founded, licenseNumber: license || null, landDeals: input.landDeals !== false, projects, taxOffice: taxOffice || null, taxNumber: taxNumber || null,
  };
}
type CleanContractor = ReturnType<typeof validateContractor>;

export const contractorImageUrls = (firm: { logo?: unknown; cover?: unknown; projects?: { photos: string[] }[] }) =>
  [firm.logo, firm.cover, ...(firm.projects || []).flatMap((project) => project.photos)].filter((url): url is string => typeof url === "string" && url.startsWith("/api/media/listings/"));
export const contractorImageKeys = (firm: Parameters<typeof contractorImageUrls>[0]) => contractorImageUrls(firm).map((url) => url.slice("/api/media/".length));

// A photo belongs to one listing, project or firm only, so deleting one never removes another's photo.
async function assertImagesFree(db: ContractorDatabase, images: string[], firmId: string) {
  for (const url of images) {
    const key = url.slice("/api/media/".length), like = `%"${url}"%`;
    if (await db.prepare("SELECT 1 AS used FROM property_images WHERE object_key=?").bind(key).first().catch(() => null)) throw new ContractorError("Bir ilanda kullanılan fotoğraf firma profiline eklenemez.", 409);
    if (await db.prepare("SELECT 1 AS used FROM contractor_firms WHERE id<>? AND (logo=? OR cover=?)").bind(firmId, url, url).first()) throw new ContractorError("Bu fotoğraf başka bir firma profilinde kullanılıyor.", 409);
    if (await db.prepare("SELECT 1 AS used FROM contractor_projects WHERE firm_id<>? AND photos LIKE ?").bind(firmId, like).first()) throw new ContractorError("Bu fotoğraf başka bir firma profilinde kullanılıyor.", 409);
    // service_firms and projects are created on first use by their own modules.
    const other = await db.prepare("SELECT 1 AS used FROM service_firms WHERE logo=? OR cover=? OR photos LIKE ?").bind(url, url, like).first().catch(() => null)
      || await db.prepare("SELECT 1 AS used FROM projects WHERE images LIKE ?").bind(like).first().catch(() => null);
    if (other) throw new ContractorError("Bu fotoğraf başka bir firma profilinde kullanılıyor.", 409);
  }
}

const searchText = (firm: Pick<CleanContractor, "name" | "description" | "projects">) =>
  serviceSearchKey([firm.name, firm.description, ...firm.projects.map((project) => `${project.title} ${project.city} ${project.district}`)].join(" ")).slice(0, 8000);

async function writeRelations(db: ContractorDatabase, id: string, firm: CleanContractor, stamp: string) {
  await db.prepare("DELETE FROM contractor_areas WHERE firm_id=?").bind(id).run();
  await db.prepare("DELETE FROM contractor_projects WHERE firm_id=?").bind(id).run();
  for (const area of firm.areas) await db.prepare("INSERT INTO contractor_areas(firm_id,city,district) VALUES(?,?,?)").bind(id, area.city, area.district).run();
  for (const [index, project] of firm.projects.entries()) await db.prepare("INSERT INTO contractor_projects(id,firm_id,title,city,district,year,kind,units,description,photos,sort,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(project.id, id, project.title, project.city, project.district, project.year, project.kind, project.units, project.description, JSON.stringify(project.photos), index, stamp).run();
}

// --- Rows → objects ---------------------------------------------------------------------------------
function toFirm(row: Row, areas: ContractorArea[], projects: ContractorProject[], privateView = false): ContractorFirm {
  const firm: ContractorFirm = {
    id: String(row.id), name: String(row.name), description: String(row.description), phone: String(row.phone || ""), whatsapp: row.whatsapp ? String(row.whatsapp) : null,
    email: row.email ? String(row.email) : null, website: row.website ? String(row.website) : null, logo: row.logo ? String(row.logo) : null, cover: row.cover ? String(row.cover) : null,
    foundedYear: row.founded_year == null ? null : Number(row.founded_year), licenseNumber: row.license_number ? String(row.license_number) : null,
    specialties: parse<unknown[]>(row.specialties, []).filter(isSpecialty), landDeals: flag(row.land_deals), areas, projects,
    verified: flag(row.verified), featured: flag(row.featured), status: isStatus(row.status) ? row.status : "pending", createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
  if (privateView) Object.assign(firm, {
    ownerId: String(row.owner_id), reviewNote: String(row.review_note || ""), taxOffice: row.tax_office ? String(row.tax_office) : null, taxNumber: row.tax_number ? String(row.tax_number) : null,
    ...(row.owner_name != null ? { ownerName: String(row.owner_name) } : {}), ...(row.owner_email != null ? { ownerEmail: String(row.owner_email) } : {}),
  });
  return firm;
}
async function withRelations(db: ContractorDatabase, rows: Row[], privateView = false, projects = true) {
  if (!rows.length) return [];
  const ids = rows.map((row) => String(row.id)), marks = ids.map(() => "?").join(",");
  const [areas, works] = await Promise.all([
    db.prepare(`SELECT firm_id,city,district FROM contractor_areas WHERE firm_id IN (${marks})`).bind(...ids).all<Row>(),
    projects ? db.prepare(`SELECT * FROM contractor_projects WHERE firm_id IN (${marks}) ORDER BY sort ASC,id ASC`).bind(...ids).all<Row>() : Promise.resolve({ results: [] as Row[] }),
  ]);
  const byFirm = new Map(ids.map((id) => [id, { areas: [] as ContractorArea[], projects: [] as ContractorProject[] }]));
  for (const row of areas.results || []) byFirm.get(String(row.firm_id))?.areas.push({ city: String(row.city), district: String(row.district || "") });
  for (const row of works.results || []) byFirm.get(String(row.firm_id))?.projects.push({
    id: String(row.id), title: String(row.title), city: String(row.city), district: String(row.district || ""), year: Number(row.year),
    kind: isSpecialty(row.kind) ? row.kind : "konut", units: row.units == null ? null : Number(row.units), description: String(row.description || ""), photos: parse<string[]>(row.photos, []),
  });
  for (const relation of byFirm.values()) relation.areas.sort((a, b) => a.city.localeCompare(b.city, "tr") || a.district.localeCompare(b.district, "tr"));
  return rows.map((row) => { const relation = byFirm.get(String(row.id))!; return toFirm(row, relation.areas, relation.projects, privateView); });
}
async function firmRow(db: ContractorDatabase, id: string) {
  if (!validContractorId(id)) return null;
  await ensureContractors(db);
  return db.prepare("SELECT * FROM contractor_firms WHERE id=?").bind(id).first<Row>();
}

// --- Owner ------------------------------------------------------------------------------------------
export async function ownerContractor(db: ContractorDatabase, ownerId: string) {
  await ensureContractors(db);
  const row = await db.prepare("SELECT * FROM contractor_firms WHERE owner_id=?").bind(ownerId).first<Row>();
  return row ? (await withRelations(db, [row], true))[0] : null;
}

/** Creates or updates the member's firm. An owner's save goes (back) to review; a suspended firm stays suspended. Returns photo keys no longer used. */
export async function saveContractor(db: ContractorDatabase, actor: ContractorActor, input: Record<string, unknown>, at = new Date()) {
  const firm = validateContractor(input, actor.id, at);
  await ensureContractors(db);
  const row = await db.prepare("SELECT * FROM contractor_firms WHERE owner_id=?").bind(actor.id).first<Row>();
  const stamp = at.toISOString(), search = searchText(firm), nameKey = serviceNameSortKey(firm.name);
  if (!row) {
    if (input.terms !== true) throw new ContractorError("Devam etmek için firma bilgilerinin yayınlanmasını onaylayın.");
    const id = crypto.randomUUID();
    await assertImagesFree(db, contractorImageUrls(firm), id);
    const status: ContractorStatus = actor.admin ? "approved" : "pending";
    await db.prepare("INSERT INTO contractor_firms(id,owner_id,name,description,phone,whatsapp,email,website,logo,cover,founded_year,license_number,specialties,land_deals,tax_office,tax_number,search_text,name_key,status,review_note,verified,featured,reviewed_by,approved_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'',0,0,?,?,?,?)")
      .bind(id, actor.id, firm.name, firm.description, firm.phone, firm.whatsapp, firm.email, firm.website, firm.logo, firm.cover, firm.foundedYear, firm.licenseNumber, JSON.stringify(firm.specialties), firm.landDeals ? 1 : 0, firm.taxOffice, firm.taxNumber, search, nameKey, status, actor.admin ? actor.id : null, actor.admin ? stamp : null, stamp, stamp).run();
    await writeRelations(db, id, firm, stamp);
    return { id, status, created: true, removedKeys: [] as string[] };
  }
  const id = String(row.id);
  await assertImagesFree(db, contractorImageUrls(firm), id);
  const [current] = await withRelations(db, [row], true);
  const previous = isStatus(row.status) ? row.status : "pending";
  const status: ContractorStatus = actor.admin || previous === "suspended" ? previous : "pending";
  const note = actor.admin || previous === "suspended" ? String(row.review_note || "") : "";
  // A changed licence number needs a new check before the badge comes back.
  const verified = flag(row.verified) && (row.license_number || null) === firm.licenseNumber ? 1 : 0;
  await db.prepare("UPDATE contractor_firms SET name=?,description=?,phone=?,whatsapp=?,email=?,website=?,logo=?,cover=?,founded_year=?,license_number=?,specialties=?,land_deals=?,tax_office=?,tax_number=?,search_text=?,name_key=?,status=?,review_note=?,verified=?,updated_at=? WHERE id=?")
    .bind(firm.name, firm.description, firm.phone, firm.whatsapp, firm.email, firm.website, firm.logo, firm.cover, firm.foundedYear, firm.licenseNumber, JSON.stringify(firm.specialties), firm.landDeals ? 1 : 0, firm.taxOffice, firm.taxNumber, search, nameKey, status, note, verified, stamp, id).run();
  await writeRelations(db, id, firm, stamp);
  const kept = new Set(contractorImageKeys(firm));
  return { id, status, created: false, removedKeys: contractorImageKeys(current).filter((key) => !kept.has(key)) };
}

/** Owner or admin. Land requests stay with their members; this firm's recipient rows and offers go. Returns photo keys to delete. */
export async function deleteContractor(db: ContractorDatabase, actor: ContractorActor, id: string) {
  const row = await firmRow(db, id);
  if (!row) throw new ContractorError("Firma bulunamadı.", 404);
  if (String(row.owner_id) !== actor.id && !actor.admin) throw new ContractorError("Bu firmayı silme yetkiniz yok.", 403);
  const [current] = await withRelations(db, [row], true);
  for (const table of ["contractor_areas", "contractor_projects", "land_request_recipients", "land_offers", "contractor_firm_stats"]) await db.prepare(`DELETE FROM ${table} WHERE firm_id=?`).bind(id).run();
  await db.prepare("DELETE FROM contractor_firms WHERE id=?").bind(id).run();
  return { id, imageKeys: contractorImageKeys(current) };
}

// --- Public reads (approved only) -------------------------------------------------------------------
export const CONTRACTOR_SORTS = ["featured", "newest", "az"] as const;
export type ContractorSort = typeof CONTRACTOR_SORTS[number];
const SORT_SQL: Record<ContractorSort, string> = {
  featured: "f.featured DESC,f.verified DESC,f.created_at DESC,f.id ASC",
  newest: "f.created_at DESC,f.id ASC",
  az: "f.name_key ASC,f.id ASC",
};
export type ContractorQuery = { q?: string; city?: string; specialty?: string; verified?: boolean; landDeals?: boolean; featured?: boolean; sort?: string; page?: number; perPage?: number };
export type ContractorResults = { firms: ContractorFirm[]; total: number; page: number; pages: number; perPage: number };

/** Approved firm, or for its owner and administrators any status (with private fields). */
export async function contractorById(db: ContractorDatabase, id: string, viewer: ContractorActor | null = null) {
  const row = await firmRow(db, id);
  if (!row) return null;
  const privileged = Boolean(viewer && (viewer.admin || viewer.id === String(row.owner_id)));
  if (row.status !== "approved" && !privileged) return null;
  return (await withRelations(db, [row], privileged))[0];
}

export async function searchContractors(db: ContractorDatabase, query: ContractorQuery = {}): Promise<ContractorResults> {
  await ensureContractors(db);
  const perPage = Math.max(1, Math.min(60, Math.floor(query.perPage || CONTRACTOR_PER_PAGE)));
  const requested = Math.floor(Number(query.page)), page = Number.isFinite(requested) && requested >= 1 ? Math.min(requested, CONTRACTOR_MAX_PAGE) : 1;
  const sort: ContractorSort = (CONTRACTOR_SORTS as readonly unknown[]).includes(query.sort) ? query.sort as ContractorSort : "featured";
  const where = ["f.status='approved'"], values: (string | number)[] = [];
  if (query.city && AREA_CITIES.includes(query.city)) { where.push("EXISTS(SELECT 1 FROM contractor_areas a WHERE a.firm_id=f.id AND a.city=?)"); values.push(query.city); }
  // Specialties are stored as a JSON array of known slugs, so the quoted slug matches exactly.
  if (isSpecialty(query.specialty)) { where.push("f.specialties LIKE ?"); values.push(`%"${query.specialty}"%`); }
  if (query.verified) where.push("f.verified=1");
  if (query.landDeals) where.push("f.land_deals=1");
  if (query.featured) where.push("f.featured=1");
  // Tokens are folded to letters, digits and spaces, so LIKE wildcards cannot appear in them.
  for (const token of serviceSearchTokens(query.q)) { where.push("f.search_text LIKE ?"); values.push(`%${token}%`); }
  const clause = where.join(" AND ");
  const [count, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM contractor_firms f WHERE ${clause}`).bind(...values).first<Row>(),
    db.prepare(`SELECT f.* FROM contractor_firms f WHERE ${clause} ORDER BY ${SORT_SQL[sort]} LIMIT ? OFFSET ?`).bind(...values, perPage, (page - 1) * perPage).all<Row>(),
  ]);
  const total = Number(count?.n) || 0;
  return { firms: await withRelations(db, rows.results || []), total, page, pages: Math.max(1, Math.ceil(total / perPage)), perPage };
}

export async function contractorStats(db: ContractorDatabase) {
  await ensureContractors(db);
  const [firms, places, projects] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM contractor_firms WHERE status='approved'").bind().first<Row>(),
    db.prepare("SELECT COUNT(DISTINCT a.city) AS n FROM contractor_areas a JOIN contractor_firms f ON f.id=a.firm_id WHERE f.status='approved'").bind().first<Row>(),
    db.prepare("SELECT COUNT(*) AS n FROM contractor_projects p JOIN contractor_firms f ON f.id=p.firm_id WHERE f.status='approved'").bind().first<Row>(),
  ]);
  return { firms: Number(firms?.n) || 0, cities: Number(places?.n) || 0, projects: Number(projects?.n) || 0 };
}

/** The firm owner's approved housing projects on /projeler (lib/projects.ts creates that table on first use). */
export async function contractorListings(db: ContractorDatabase, ownerId: string, limit = 12): Promise<ContractorListing[]> {
  const rows = await db.prepare("SELECT id,name,city,district,delivery_date,images FROM projects WHERE owner_id=? AND moderation='approved' ORDER BY updated_at DESC,id ASC LIMIT ?").bind(ownerId, limit).all<Row>().catch(() => ({ results: [] as Row[] }));
  return (rows.results || []).map((row) => ({ id: String(row.id), name: String(row.name), city: String(row.city), district: String(row.district || ""), deliveryDate: row.delivery_date ? String(row.delivery_date) : null, image: parse<string[]>(row.images, [])[0] || null }));
}
export async function contractorOwnerId(db: ContractorDatabase, id: string) {
  const row = await firmRow(db, id);
  return row ? String(row.owner_id) : null;
}

export async function contractorSitemapEntries(db: ContractorDatabase, limit = CONTRACTOR_SITEMAP_LIMIT) {
  await ensureContractors(db);
  const rows = await db.prepare("SELECT id,updated_at FROM contractor_firms WHERE status='approved' ORDER BY updated_at DESC,id ASC LIMIT ?").bind(limit).all<Row>();
  return (rows.results || []).map((row) => ({ path: contractorPath(String(row.id)), updatedAt: String(row.updated_at || "") }));
}

/** Media route: logo, cover and project photos of approved firms are public. */
export async function contractorMediaPublic(db: ContractorDatabase, key: string) {
  if (!/^listings\/[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key)) return false;
  await ensureContractors(db);
  const url = `/api/media/${key}`;
  return Boolean(await db.prepare("SELECT 1 AS ok FROM contractor_firms WHERE status='approved' AND (logo=? OR cover=?)").bind(url, url).first()
    || await db.prepare("SELECT 1 AS ok FROM contractor_projects p JOIN contractor_firms f ON f.id=p.firm_id WHERE f.status='approved' AND p.photos LIKE ?").bind(`%"${url}"%`).first());
}

// --- Administration ---------------------------------------------------------------------------------
export const CONTRACTOR_ADMIN_ACTIONS = ["approve", "reject", "suspend", "verify", "unverify", "feature", "unfeature"] as const;
export async function adminContractors(db: ContractorDatabase, status: unknown = "pending") {
  await ensureContractors(db);
  const filter = isStatus(status) ? status : "pending";
  const rows = await db.prepare("SELECT f.*,u.name AS owner_name,u.email AS owner_email FROM contractor_firms f LEFT JOIN users u ON CAST(u.id AS TEXT)=f.owner_id WHERE f.status=? ORDER BY f.updated_at ASC,f.id ASC LIMIT 200").bind(filter).all<Row>();
  const counts = await db.prepare("SELECT status,COUNT(*) AS n FROM contractor_firms GROUP BY status").bind().all<Row>();
  const totals = Object.fromEntries(CONTRACTOR_STATUSES.map((name) => [name, 0])) as Record<ContractorStatus, number>;
  for (const row of counts.results || []) if (isStatus(row.status)) totals[row.status] = Number(row.n) || 0;
  const open = await db.prepare("SELECT COUNT(*) AS n FROM land_requests WHERE status='open'").bind().first<Row>();
  return { firms: await withRelations(db, rows.results || [], true), totals, openLandRequests: Number(open?.n) || 0 };
}
/** Approve, reject or suspend (both need a note the owner can read), and the verified/featured flags. */
export async function reviewContractor(db: ContractorDatabase, adminId: string, id: unknown, action: unknown, note: unknown, at = new Date()) {
  if (!validContractorId(id) || !(CONTRACTOR_ADMIN_ACTIONS as readonly unknown[]).includes(action)) throw new ContractorError("Geçersiz işlem.");
  const reason = clean(note);
  if (reason.length > CONTRACTOR_LIMITS.noteMax) throw new ContractorError("İnceleme notu en fazla 1000 karakter olabilir.");
  if ((action === "reject" || action === "suspend") && reason.length < 5) throw new ContractorError("Reddetme veya askıya alma nedenini yazın.");
  const row = await firmRow(db, id);
  if (!row) throw new ContractorError("Firma bulunamadı.", 404);
  if (action === "verify" && !row.license_number) throw new ContractorError("Yetki belgesi numarası olmayan firma doğrulanamaz.");
  const stamp = at.toISOString();
  if (action === "approve" || action === "reject" || action === "suspend") {
    const status: ContractorStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "suspended";
    await db.prepare("UPDATE contractor_firms SET status=?,review_note=?,reviewed_by=?,approved_at=?,updated_at=? WHERE id=?")
      .bind(status, reason, adminId, status === "approved" ? stamp : row.approved_at == null ? null : String(row.approved_at), stamp, id).run();
    return { id, name: String(row.name), ownerId: String(row.owner_id), action: String(action), status };
  }
  const column = action === "verify" || action === "unverify" ? "verified" : "featured", value = action === "verify" || action === "feature" ? 1 : 0;
  await db.prepare(`UPDATE contractor_firms SET ${column}=?,reviewed_by=? WHERE id=?`).bind(value, adminId, id).run();
  return { id, name: String(row.name), ownerId: String(row.owner_id), action: String(action), status: isStatus(row.status) ? row.status : "pending" as ContractorStatus };
}

// --- Land-for-flats requests ("kat karşılığı") --------------------------------------------------------
export type LandRequestStatus = "open" | "accepted" | "closed" | "expired";
export type LandOffer = { id: string; firmId: string; firmName: string; firmVerified: boolean; firmLogo: string | null; ownerShare: number; deliveryMonths: number; message: string; state: "sent" | "accepted" | "declined"; createdAt: string };
export type LandRequest = {
  id: string; city: string; district: string; areaM2: number; zoning: LandZoning; emsal: string | null; expectedShare: number | null; description: string;
  status: LandRequestStatus; createdAt: string; expiresAt: string; name: string;
  /** Only when the landowner shared it or accepted this contractor's offer. */
  email?: string | null; phone?: string | null;
};

export function validateLandRequest(input: Record<string, unknown>) {
  const place = placeInput(input, "Arsanın il ve ilçesini seçin.", true);
  const area = integer(input.areaM2);
  if (area == null || area < 50 || area > 1000000) throw new ContractorError("Arsa alanı 50 ile 1.000.000 m² arasında olmalıdır.");
  if (!LAND_ZONINGS.some((item) => item.slug === input.zoning)) throw new ContractorError("İmar durumunu seçin.");
  const emsalText = clean(input.emsal).replace(",", ".");
  const emsal = emsalText ? Number(emsalText) : null;
  if (emsal !== null && (!/^\d+(\.\d{1,2})?$/.test(emsalText) || emsal < 0.05 || emsal > 10)) throw new ContractorError("Emsal (KAKS) 0,05 ile 10 arasında bir sayı olmalıdır.");
  const share = input.expectedShare === "" || input.expectedShare == null ? null : integer(input.expectedShare);
  if (input.expectedShare !== "" && input.expectedShare != null && (share == null || share < 1 || share > 99)) throw new ContractorError("Beklediğiniz pay yüzde 1 ile 99 arasında olmalıdır.");
  const description = clean(input.description);
  if (description.length < 20 || description.length > 2000) throw new ContractorError("Açıklama 20 ile 2000 karakter arasında olmalıdır.");
  const name = clean(input.name).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) throw new ContractorError("Adınızı yazın.");
  const email = clean(input.email).toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) throw new ContractorError("Geçerli bir e-posta adresi yazın.");
  const phone = clean(input.phone) ? normalizeContactPhone(input.phone) : null;
  if (clean(input.phone) && !phone) throw new ContractorError("Geçerli bir telefon numarası yazın.");
  const firmId = validContractorId(input.firmId) ? String(input.firmId).toLowerCase() : null;
  return { ...place, areaM2: area, zoning: input.zoning as LandZoning, emsal: emsal === null ? null : emsal.toString(), expectedShare: share, description, name, email, phone, shareContact: input.shareContact === true, firmId };
}

type Recipient = { id: string; name: string; ownerId: string };
/** Approved firms that accept land deals in the province (whole province or the district), featured and verified first. */
export async function matchingContractors(db: ContractorDatabase, city: string, district: string, excludeOwner: string, limit = LAND_LIMITS.recipients) {
  await ensureContractors(db);
  const rows = await db.prepare(`SELECT f.id,f.name,f.owner_id FROM contractor_firms f WHERE f.status='approved' AND f.land_deals=1 AND f.owner_id<>?
    AND EXISTS(SELECT 1 FROM contractor_areas a WHERE a.firm_id=f.id AND a.city=? AND (a.district='' OR a.district=? OR ?=''))
    ORDER BY f.featured DESC,f.verified DESC,f.created_at ASC,f.id ASC LIMIT ?`).bind(excludeOwner, city, district, district, limit).all<Row>();
  return (rows.results || []).map((row) => ({ id: String(row.id), name: String(row.name), ownerId: String(row.owner_id) }));
}

/** Saves a request and its recipients; throws when no contractor matches (nothing is saved then). */
export async function createLandRequest(db: ContractorDatabase, userId: string, input: Record<string, unknown>, at = new Date()) {
  const request = validateLandRequest(input);
  await ensureContractors(db);
  const since = new Date(at.getTime() - 86_400_000).toISOString();
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM land_requests WHERE user_id=? AND created_at>?").bind(userId, since).first<Row>();
  if ((Number(recent?.n) || 0) >= LAND_LIMITS.perDay) throw new ContractorError("Günde en fazla 3 kat karşılığı talebi gönderebilirsiniz.", 429);
  let recipients: Recipient[];
  if (request.firmId) {
    const row = await db.prepare("SELECT id,name,owner_id FROM contractor_firms WHERE id=? AND status='approved' AND land_deals=1").bind(request.firmId).first<Row>();
    if (!row) throw new ContractorError("Bu müteahhit şu an kat karşılığı talebi almıyor.", 404);
    if (String(row.owner_id) === userId) throw new ContractorError("Kendi firmanıza talep gönderemezsiniz.");
    recipients = [{ id: String(row.id), name: String(row.name), ownerId: String(row.owner_id) }];
  } else recipients = await matchingContractors(db, request.city, request.district, userId);
  if (!recipients.length) throw new ContractorError("Bu bölgede kat karşılığı çalışan onaylı müteahhit henüz yok. Başka bir ilçe veya tüm il için deneyebilirsiniz.", 409);
  const id = crypto.randomUUID(), stamp = at.toISOString(), expires = new Date(at.getTime() + LAND_LIMITS.days * 86_400_000).toISOString();
  await db.prepare("INSERT INTO land_requests(id,user_id,name,email,phone,share_contact,city,district,area_m2,zoning,emsal,expected_share,description,firm_id,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'open',?,?)")
    .bind(id, userId, request.name, request.email, request.phone, request.shareContact ? 1 : 0, request.city, request.district, request.areaM2, request.zoning, request.emsal, request.expectedShare, request.description, request.firmId, stamp, expires).run();
  for (const firm of recipients) { await db.prepare("INSERT INTO land_request_recipients(request_id,firm_id,state,created_at) VALUES(?,?,'new',?)").bind(id, firm.id, stamp).run(); await countFirmStat(db as never, "contractor_firm_stats", String(firm.id), "request", at).catch(() => undefined); }
  return { id, recipients, summary: `${request.district ? `${request.district}, ` : ""}${request.city} · ${request.areaM2} m²` };
}

const requestStatus = (row: Row, at: Date): LandRequestStatus => {
  const status = String(row.status);
  if (status === "open" && String(row.expires_at) <= at.toISOString()) return "expired";
  return status === "accepted" || status === "closed" ? status : status === "expired" ? "expired" : "open";
};
function toRequest(row: Row, at: Date, contact: boolean): LandRequest {
  return {
    id: String(row.id), city: String(row.city), district: String(row.district || ""), areaM2: Number(row.area_m2), zoning: LAND_ZONINGS.some((item) => item.slug === row.zoning) ? row.zoning as LandZoning : "bilinmiyor",
    emsal: row.emsal ? String(row.emsal) : null, expectedShare: row.expected_share == null ? null : Number(row.expected_share), description: String(row.description),
    status: requestStatus(row, at), createdAt: String(row.created_at), expiresAt: String(row.expires_at), name: String(row.name),
    ...(contact ? { email: String(row.email), phone: row.phone ? String(row.phone) : null } : {}),
  };
}

/** The landowner's requests with every offer (best share first). */
export async function myLandRequests(db: ContractorDatabase, userId: string, at = new Date()) {
  await ensureContractors(db);
  const rows = (await db.prepare("SELECT * FROM land_requests WHERE user_id=? ORDER BY created_at DESC,id ASC LIMIT 50").bind(userId).all<Row>()).results || [];
  if (!rows.length) return [];
  const ids = rows.map((row) => String(row.id)), marks = ids.map(() => "?").join(",");
  const [offers, recipients] = await Promise.all([
    db.prepare(`SELECT o.*,f.name AS firm_name,f.verified AS firm_verified,f.logo AS firm_logo FROM land_offers o JOIN contractor_firms f ON f.id=o.firm_id WHERE o.request_id IN (${marks}) ORDER BY o.owner_share DESC,o.created_at ASC`).bind(...ids).all<Row>(),
    db.prepare(`SELECT request_id,COUNT(*) AS n FROM land_request_recipients WHERE request_id IN (${marks}) GROUP BY request_id`).bind(...ids).all<Row>(),
  ]);
  return rows.map((row) => ({
    ...toRequest(row, at, true),
    recipients: Number((recipients.results || []).find((item) => String(item.request_id) === String(row.id))?.n) || 0,
    offers: (offers.results || []).filter((offer) => String(offer.request_id) === String(row.id)).map((offer): LandOffer => ({
      id: String(offer.id), firmId: String(offer.firm_id), firmName: String(offer.firm_name), firmVerified: flag(offer.firm_verified), firmLogo: offer.firm_logo ? String(offer.firm_logo) : null,
      ownerShare: Number(offer.owner_share), deliveryMonths: Number(offer.delivery_months), message: String(offer.message), state: offer.state === "accepted" || offer.state === "declined" ? offer.state : "sent", createdAt: String(offer.created_at),
    })),
  }));
}

/** Requests that reached the member's firm, newest first; marks new ones as seen. cutoff: the firm's package
 * (lib/firm-plans.ts) only shows requests created at or before this time (Plus sees them a day later). */
export async function contractorInbox(db: ContractorDatabase, ownerId: string, at = new Date(), cutoff?: string) {
  await ensureContractors(db);
  const firm = await db.prepare("SELECT id,status FROM contractor_firms WHERE owner_id=?").bind(ownerId).first<Row>();
  if (!firm) return { firmId: null, requests: [] };
  const firmId = String(firm.id);
  const rows = (await db.prepare(`SELECT r.*,x.state AS recipient_state,o.id AS offer_id,o.owner_share,o.delivery_months,o.message AS offer_message,o.state AS offer_state
    FROM land_request_recipients x JOIN land_requests r ON r.id=x.request_id LEFT JOIN land_offers o ON o.request_id=r.id AND o.firm_id=x.firm_id
    WHERE x.firm_id=? AND r.created_at<=? ORDER BY r.created_at DESC,r.id ASC LIMIT 100`).bind(firmId, cutoff ?? "9999").all<Row>()).results || [];
  await db.prepare("UPDATE land_request_recipients SET state='seen' WHERE firm_id=? AND state='new' AND request_id IN (SELECT id FROM land_requests WHERE created_at<=?)").bind(firmId, cutoff ?? "9999").run();
  return {
    firmId, requests: rows.map((row) => ({
      ...toRequest(row, at, flag(row.share_contact) || row.offer_state === "accepted"),
      state: String(row.recipient_state), offer: row.offer_id ? { ownerShare: Number(row.owner_share), deliveryMonths: Number(row.delivery_months), message: String(row.offer_message), state: String(row.offer_state) } : null,
    })),
  };
}
export async function newLandRequestCount(db: ContractorDatabase, ownerId: string, cutoff?: string) {
  await ensureContractors(db);
  const row = await db.prepare("SELECT COUNT(*) AS n FROM land_request_recipients x JOIN contractor_firms f ON f.id=x.firm_id JOIN land_requests r ON r.id=x.request_id WHERE f.owner_id=? AND x.state='new' AND r.status='open' AND r.created_at<=?").bind(ownerId, cutoff ?? "9999").first<Row>();
  return Number(row?.n) || 0;
}

async function recipientRequest(db: ContractorDatabase, ownerId: string, requestId: unknown, at: Date, cutoff?: string) {
  if (!validContractorId(requestId)) throw new ContractorError("Talep bulunamadı.", 404);
  await ensureContractors(db);
  const firm = await db.prepare("SELECT id,name,status FROM contractor_firms WHERE owner_id=?").bind(ownerId).first<Row>();
  if (!firm || firm.status !== "approved") throw new ContractorError("Teklif vermek için firmanızın yayında olması gerekir.", 403);
  const row = await db.prepare("SELECT r.* FROM land_requests r JOIN land_request_recipients x ON x.request_id=r.id WHERE r.id=? AND x.firm_id=?").bind(requestId, String(firm.id)).first<Row>();
  if (!row || (cutoff !== undefined && String(row.created_at) > cutoff)) throw new ContractorError("Talep bulunamadı.", 404);
  if (requestStatus(row, at) !== "open") throw new ContractorError("Bu talep artık teklif almıyor.", 409);
  return { firmId: String(firm.id), firmName: String(firm.name), request: row };
}

/** One offer per firm and request: landowner's share of the flats (%), delivery time (months), a note. */
export async function sendLandOffer(db: ContractorDatabase, ownerId: string, requestId: unknown, input: Record<string, unknown>, at = new Date(), cutoff?: string) {
  const { firmId, firmName, request } = await recipientRequest(db, ownerId, requestId, at, cutoff);
  const share = integer(input.ownerShare), months = integer(input.deliveryMonths), message = clean(input.message);
  if (share == null || share < 1 || share > 99) throw new ContractorError("Arsa sahibine kalacak pay yüzde 1 ile 99 arasında olmalıdır.");
  if (months == null || months < 1 || months > 120) throw new ContractorError("Teslim süresi 1 ile 120 ay arasında olmalıdır.");
  if (message.length < 10 || message.length > 2000) throw new ContractorError("Teklif açıklaması 10 ile 2000 karakter arasında olmalıdır.");
  if (await db.prepare("SELECT 1 AS sent FROM land_offers WHERE request_id=? AND firm_id=?").bind(String(request.id), firmId).first()) throw new ContractorError("Bu talebe zaten teklif verdiniz.", 409);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO land_offers(id,request_id,firm_id,owner_share,delivery_months,message,state,created_at) VALUES(?,?,?,?,?,?,'sent',?)").bind(id, String(request.id), firmId, share, months, message, at.toISOString()).run();
  await db.prepare("UPDATE land_request_recipients SET state='offered' WHERE request_id=? AND firm_id=?").bind(String(request.id), firmId).run();
  await countFirmStat(db as never, "contractor_firm_stats", firmId, "offer", at).catch(() => undefined);
  return { id, firmName, requestUserId: String(request.user_id), ownerShare: share, deliveryMonths: months };
}
export async function passLandRequest(db: ContractorDatabase, ownerId: string, requestId: unknown, at = new Date(), cutoff?: string) {
  const { firmId, request } = await recipientRequest(db, ownerId, requestId, at, cutoff);
  await db.prepare("UPDATE land_request_recipients SET state='passed' WHERE request_id=? AND firm_id=? AND state<>'offered'").bind(String(request.id), firmId).run();
  return { id: String(request.id) };
}

/** Landowner accepts one offer: the others are declined and the request closes. */
export async function acceptLandOffer(db: ContractorDatabase, userId: string, offerId: unknown, at = new Date()) {
  if (!validContractorId(offerId)) throw new ContractorError("Teklif bulunamadı.", 404);
  await ensureContractors(db);
  const offer = await db.prepare("SELECT o.*,r.user_id,r.status AS request_status,r.expires_at,f.owner_id AS firm_owner,f.name AS firm_name FROM land_offers o JOIN land_requests r ON r.id=o.request_id JOIN contractor_firms f ON f.id=o.firm_id WHERE o.id=?").bind(offerId).first<Row>();
  if (!offer || String(offer.user_id) !== userId) throw new ContractorError("Teklif bulunamadı.", 404);
  if (requestStatus({ status: offer.request_status, expires_at: offer.expires_at }, at) !== "open") throw new ContractorError("Bu talep artık açık değil.", 409);
  await db.prepare("UPDATE land_offers SET state=CASE WHEN id=? THEN 'accepted' ELSE 'declined' END WHERE request_id=?").bind(String(offer.id), String(offer.request_id)).run();
  await db.prepare("UPDATE land_requests SET status='accepted' WHERE id=?").bind(String(offer.request_id)).run();
  return { requestId: String(offer.request_id), firmOwnerId: String(offer.firm_owner), firmName: String(offer.firm_name) };
}
export async function closeLandRequest(db: ContractorDatabase, userId: string, requestId: unknown) {
  if (!validContractorId(requestId)) throw new ContractorError("Talep bulunamadı.", 404);
  await ensureContractors(db);
  const row = await db.prepare("SELECT status FROM land_requests WHERE id=? AND user_id=?").bind(requestId, userId).first<Row>();
  if (!row) throw new ContractorError("Talep bulunamadı.", 404);
  if (row.status === "open") await db.prepare("UPDATE land_requests SET status='closed' WHERE id=?").bind(requestId).run();
  return { id: String(requestId) };
}

// --- Profile statistics (Müteahhitler › Firma panelim › İstatistikler) ------------------------------
export const CONTRACTOR_STAT_KINDS = ["view", "search", "phone", "whatsapp", "email", "website", "request", "offer"] as const;
export type ContractorStatKind = typeof CONTRACTOR_STAT_KINDS[number];
/** Kinds a visitor's browser may report; requests and offers are counted by the server. */
export const CONTRACTOR_TRACKED_KINDS = ["view", "search", "phone", "whatsapp", "email", "website"] as const;
export type ContractorStats = FirmStats<ContractorStatKind>;
/** Visitor event for an approved firm; false when the firm is not public. */
export async function trackContractor(db: ContractorDatabase, firmId: unknown, kind: unknown, at = new Date()) {
  if (!validContractorId(firmId) || !(CONTRACTOR_TRACKED_KINDS as readonly unknown[]).includes(kind)) return false;
  if (!await db.prepare("SELECT 1 AS ok FROM contractor_firms WHERE id=? AND status='approved'").bind(String(firmId).toLowerCase()).first()) return false;
  await countFirmStat(db as never, "contractor_firm_stats", String(firmId).toLowerCase(), String(kind), at);
  return true;
}
export const contractorFirmStats = (db: ContractorDatabase, firmId: string, days = 30, at = new Date()): Promise<ContractorStats> => firmDailyStats(db as never, "contractor_firm_stats", CONTRACTOR_STAT_KINDS, firmId, days, at);
