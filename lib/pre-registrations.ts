// Pre-registrations from the city landing pages (app/on-kayit/[sehir], <slug>.estatemarket24.com): estate
// agents and individual owners leave their details before launch so the team can contact them when the site
// opens. Stored in pre_registrations (created on first use, owner approved 2026-11-20) and listed for
// administrators (/yonetim/on-kayitlar, CSV export). The KVKK notice acknowledgement is required; the
// marketing consent is optional and recorded with its time (ETİK / Law 6563). The first 1000 estate agents get
// the advertised 50 % gift, recorded per row so the thank-you screen only promises it while it is true.
type Statement = { bind(...values: (string | number | null)[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; run(): Promise<unknown> };
export type PreRegistrationDatabase = { prepare(sql: string): Statement };

export const PRE_ROLES = ["agent", "owner"] as const;
export type PreRole = (typeof PRE_ROLES)[number];
export const PORTFOLIO_SIZES = ["1–10", "11–50", "51–200", "200+"] as const;
export const YES_NO = ["Evet", "Hayır"] as const;
export const PACKAGES = ["Başlangıç", "Standart", "Gelişmiş", "Profesyonel", "Kurumsal", "Premium", "Henüz karar vermedim"] as const;
export const PROPERTY_TYPES = ["Daire", "Villa", "Müstakil ev", "Arsa", "İşyeri", "Diğer"] as const;
export const PROPERTY_COUNTS = ["1", "2–3", "4 ve üzeri"] as const;
export const PURPOSES = ["Satılık", "Kiralık", "Her ikisi"] as const;
export const TIMELINES = ["Hemen", "3 ay içinde", "6 ay içinde", "Sadece bilgi almak istiyorum"] as const;
export const AGENT_GIFT_LIMIT = 1000;
export const NOTICE_VERSION = "on-kayit-2026-11-20";

export const PRE_REGISTRATION_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS pre_registrations(id TEXT PRIMARY KEY,role TEXT NOT NULL,city TEXT NOT NULL,name TEXT NOT NULL,company TEXT,phone TEXT NOT NULL,email TEXT NOT NULL,district TEXT,portfolio TEXT,foreign_sales TEXT,package TEXT,property_type TEXT,property_count TEXT,purpose TEXT,timeline TEXT,notice_version TEXT NOT NULL,notice_at TEXT NOT NULL,marketing INTEGER NOT NULL DEFAULT 0,marketing_at TEXT,gift INTEGER NOT NULL DEFAULT 0,source TEXT,utm_source TEXT,utm_medium TEXT,utm_campaign TEXT,utm_term TEXT,utm_content TEXT,gclid TEXT,host TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,contacted_at TEXT)",
  "CREATE INDEX IF NOT EXISTS pre_registrations_email_idx ON pre_registrations(email,role)",
  "CREATE INDEX IF NOT EXISTS pre_registrations_created_idx ON pre_registrations(created_at)",
  "CREATE INDEX IF NOT EXISTS pre_registrations_city_idx ON pre_registrations(city,role)",
];
export class PreRegistrationError extends Error { constructor(message: string, public status = 400) { super(message); } }

const ready = new WeakMap<object, Promise<unknown>>();
async function ensure(db: PreRegistrationDatabase) {
  let promise = ready.get(db);
  if (!promise) {
    promise = (async () => { for (const sql of PRE_REGISTRATION_SCHEMA) await db.prepare(sql).run(); })();
    ready.set(db, promise); promise.catch(() => ready.delete(db));
  }
  await promise;
}

const clean = (value: unknown, max = 200) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const pick = <T extends readonly string[]>(options: T, value: unknown) => { const text = clean(value, 60); return (options as readonly string[]).includes(text) ? text : null; };
/** Digits with an optional leading +, 10–15 digits ("0532 123 45 67", "+49 151 …"). */
export function normalPhone(value: unknown) {
  const text = clean(value, 40), digits = text.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? (text.trim().startsWith("+") ? "+" : "") + digits : null;
}

export type PreRegistrationInput = Record<string, unknown>;
export type PreRegistration = {
  id: string; role: PreRole; city: string; name: string; company: string | null; phone: string; email: string; district: string | null;
  portfolio: string | null; foreignSales: string | null; package: string | null; propertyType: string | null; propertyCount: string | null;
  purpose: string | null; timeline: string | null; marketing: boolean; gift: boolean; source: string | null; utmSource: string | null;
  utmMedium: string | null; utmCampaign: string | null; host: string | null; createdAt: string; contactedAt: string | null;
};

export function validatePreRegistration(input: PreRegistrationInput, cities: readonly string[]) {
  const role = pick(PRE_ROLES, input.role) as PreRole | null;
  if (!role) throw new PreRegistrationError("Lütfen formdaki bilgileri kontrol edin.");
  const city = clean(input.city, 40);
  if (!cities.includes(city)) throw new PreRegistrationError("Lütfen formdaki bilgileri kontrol edin.");
  const name = clean(input.name, 100);
  if (name.length < 3) throw new PreRegistrationError("Adınızı ve soyadınızı girin.");
  const company = role === "agent" ? clean(input.company, 120) : "";
  if (role === "agent" && company.length < 2) throw new PreRegistrationError("Emlak ofisinizin adını girin.");
  const phone = normalPhone(input.phone);
  if (!phone) throw new PreRegistrationError("Geçerli bir cep telefonu numarası girin.");
  const email = clean(input.email, 200).toLowerCase();
  if (!EMAIL.test(email)) throw new PreRegistrationError("Geçerli bir e-posta adresi girin.");
  if (input.notice !== true) throw new PreRegistrationError("KVKK Aydınlatma Metni’ni okuduğunuzu onaylayın.");
  const agent = role === "agent";
  return {
    role, city, name, company: company || null, phone, email, district: clean(input.district, 80) || null,
    portfolio: agent ? pick(PORTFOLIO_SIZES, input.portfolio) : null, foreignSales: agent ? pick(YES_NO, input.foreignSales) : null,
    package: agent ? pick(PACKAGES, input.package) : null,
    propertyType: agent ? null : pick(PROPERTY_TYPES, input.propertyType), propertyCount: agent ? null : pick(PROPERTY_COUNTS, input.propertyCount),
    purpose: agent ? null : pick(PURPOSES, input.purpose), timeline: agent ? null : pick(TIMELINES, input.timeline),
    marketing: input.marketing === true,
    source: clean(input.source, 80) || null, utmSource: clean(input.utm_source, 100) || null, utmMedium: clean(input.utm_medium, 100) || null,
    utmCampaign: clean(input.utm_campaign, 150) || null, utmTerm: clean(input.utm_term, 150) || null, utmContent: clean(input.utm_content, 150) || null,
    gclid: clean(input.gclid, 200) || null,
  };
}

/** Saves (or updates the earlier entry of the same e-mail, role and city) and returns whether the gift applies. */
export async function savePreRegistration(db: PreRegistrationDatabase, input: PreRegistrationInput, cities: readonly string[], host: string | null, at = new Date()) {
  const data = validatePreRegistration(input, cities);
  await ensure(db);
  const now = at.toISOString();
  const existing = await db.prepare("SELECT id,gift,marketing,marketing_at FROM pre_registrations WHERE email=? AND role=? AND city=?").bind(data.email, data.role, data.city)
    .first<{ id: string; gift: number; marketing: number; marketing_at: string | null }>();
  const marketingAt = data.marketing ? (Number(existing?.marketing) ? existing?.marketing_at || now : now) : null;
  const fields = [data.name, data.company, data.phone, data.district, data.portfolio, data.foreignSales, data.package, data.propertyType, data.propertyCount, data.purpose, data.timeline, NOTICE_VERSION, now, data.marketing ? 1 : 0, marketingAt];
  if (existing) {
    await db.prepare("UPDATE pre_registrations SET name=?,company=?,phone=?,district=?,portfolio=?,foreign_sales=?,package=?,property_type=?,property_count=?,purpose=?,timeline=?,notice_version=?,notice_at=?,marketing=?,marketing_at=?,updated_at=? WHERE id=?")
      .bind(...fields, now, existing.id).run();
    return { id: existing.id, gift: Number(existing.gift) === 1, updated: true };
  }
  let gift = 0;
  if (data.role === "agent") {
    const row = await db.prepare("SELECT count(*) AS n FROM pre_registrations WHERE role='agent' AND gift=1").bind().first<{ n: number }>();
    gift = Number(row?.n || 0) < AGENT_GIFT_LIMIT ? 1 : 0;
  }
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO pre_registrations(id,role,city,email,name,company,phone,district,portfolio,foreign_sales,package,property_type,property_count,purpose,timeline,notice_version,notice_at,marketing,marketing_at,gift,source,utm_source,utm_medium,utm_campaign,utm_term,utm_content,gclid,host,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id, data.role, data.city, data.email, ...fields, gift, data.source, data.utmSource, data.utmMedium, data.utmCampaign, data.utmTerm, data.utmContent, data.gclid, host ? host.slice(0, 120) : null, now, now).run();
  return { id, gift: gift === 1, updated: false };
}

type Row = Record<string, unknown>;
const text = (value: unknown) => value == null || value === "" ? null : String(value);
const toEntry = (row: Row): PreRegistration => ({
  id: String(row.id), role: row.role as PreRole, city: String(row.city), name: String(row.name), company: text(row.company), phone: String(row.phone),
  email: String(row.email), district: text(row.district), portfolio: text(row.portfolio), foreignSales: text(row.foreign_sales), package: text(row.package),
  propertyType: text(row.property_type), propertyCount: text(row.property_count), purpose: text(row.purpose), timeline: text(row.timeline),
  marketing: Number(row.marketing) === 1, gift: Number(row.gift) === 1, source: text(row.source), utmSource: text(row.utm_source),
  utmMedium: text(row.utm_medium), utmCampaign: text(row.utm_campaign), host: text(row.host), createdAt: String(row.created_at), contactedAt: text(row.contacted_at),
});

export async function listPreRegistrations(db: PreRegistrationDatabase, query: { role?: string; city?: string; limit?: number } = {}) {
  await ensure(db);
  const where: string[] = [], values: (string | number)[] = [];
  if (query.role && (PRE_ROLES as readonly string[]).includes(query.role)) { where.push("role=?"); values.push(query.role); }
  if (query.city) { where.push("city=?"); values.push(query.city.slice(0, 40)); }
  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Math.max(Number(query.limit) || 500, 1), 20000);
  const [rows, totals] = await Promise.all([
    db.prepare(`SELECT * FROM pre_registrations ${filter} ORDER BY created_at DESC LIMIT ?`).bind(...values, limit).all<Row>(),
    db.prepare("SELECT role,count(*) AS n FROM pre_registrations GROUP BY role").bind().all<{ role: string; n: number }>(),
  ]);
  const counts = Object.fromEntries(totals.results.map((row) => [row.role, Number(row.n)]));
  return { entries: rows.results.map(toEntry), counts: { agent: counts.agent || 0, owner: counts.owner || 0 } };
}

const CSV_COLUMNS: [keyof PreRegistration, string][] = [
  ["createdAt", "Tarih"], ["role", "Tür"], ["city", "Şehir"], ["name", "Ad soyad"], ["company", "Ofis"], ["phone", "Telefon"], ["email", "E-posta"],
  ["district", "İlçe"], ["portfolio", "Portföy"], ["foreignSales", "Yabancıya satış"], ["package", "Paket"], ["propertyType", "Mülk türü"],
  ["propertyCount", "Mülk sayısı"], ["purpose", "Amaç"], ["timeline", "Zaman"], ["marketing", "Kampanya izni"], ["gift", "%50 hediye"],
  ["utmSource", "utm_source"], ["utmMedium", "utm_medium"], ["utmCampaign", "utm_campaign"], ["source", "Kaynak"], ["host", "Adres"],
];
/** CSV for Excel (semicolon separated, UTF-8 BOM). Cells that a spreadsheet would run as a formula are quoted with a leading apostrophe. */
export function preRegistrationsCsv(entries: PreRegistration[]) {
  const cell = (value: unknown) => {
    let out = value === true ? "Evet" : value === false ? "Hayır" : value == null ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(out)) out = "'" + out;
    return /[;"\n\r]/.test(out) ? `"${out.replace(/"/g, '""')}"` : out;
  };
  const role = (value: unknown) => value === "agent" ? "Emlakçı" : value === "owner" ? "Bireysel" : value;
  return "﻿" + [CSV_COLUMNS.map(([, label]) => label).join(";"),
    ...entries.map((entry) => CSV_COLUMNS.map(([key]) => cell(key === "role" ? role(entry[key]) : entry[key])).join(";"))].join("\r\n");
}
