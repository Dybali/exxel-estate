// Bulk import format (docs/xml-import.md): a parsed <listing> becomes the same payload
// the listing form sends to POST /api/listings, so every server rule still applies.
export const IMPORT_PURPOSES = ["satilik", "kiralik", "gunluk", "devren"] as const;
export const IMPORT_LANGUAGES = ["de", "fr", "en", "ar", "fa", "ru"] as const;
export const MAX_IMPORT_LISTINGS = 100;
export const MAX_IMPORT_IMAGES = 20;

export type RawImport = {
  ref: string; fields: Record<string, string>; neighborhoodPostalCode?: string; currency?: string;
  amenities: string[]; images: string[]; translations: Record<string, { title: string; description: string }>;
};

export type ImportCandidate = {
  ref: string; neighborhood: string; postalCode?: string; images: string[];
  payload: Record<string, unknown>; errors: string[];
};

const NUMBER_FIELDS = ["grossArea", "netArea", "plotArea", "gardenArea", "bedrooms", "bathrooms", "buildingAge", "floor", "totalFloors"] as const;

export function normalizeImport(raw: RawImport, options: { propertyTypes: readonly string[]; amenities: readonly string[]; currencies: readonly string[] }): ImportCandidate {
  const f = raw.fields, errors: string[] = [];
  const text = (key: string, max: number) => (f[key] || "").trim().slice(0, max);
  const ref = raw.ref.trim().slice(0, 80);
  if (!ref) errors.push("ref özniteliği gerekli.");
  const title = text("title", 150), description = text("description", 5000);
  if (title.length < 5) errors.push("Başlık en az 5 karakter olmalı.");
  if (description.length < 20) errors.push("Açıklama en az 20 karakter olmalı.");
  const purpose = text("purpose", 20);
  if (!(IMPORT_PURPOSES as readonly string[]).includes(purpose)) errors.push(`Geçersiz ilan türü: ${purpose || "-"}`);
  const propertyType = text("type", 20);
  if (!options.propertyTypes.includes(propertyType)) errors.push(`Geçersiz gayrimenkul tipi: ${propertyType || "-"}`);
  const price = Number(text("price", 20));
  if (!Number.isFinite(price) || price <= 0) errors.push("Fiyat pozitif bir sayı olmalı.");
  const currency = (raw.currency || "TRY").trim().toUpperCase();
  if (!options.currencies.includes(currency)) errors.push(`Geçersiz para birimi: ${currency}`);
  const city = text("city", 70), district = text("district", 70), neighborhood = text("neighborhood", 120);
  if (!city || !district || !neighborhood) errors.push("İl, ilçe ve mahalle gerekli.");
  const numbers: Record<string, number | ""> = {};
  for (const key of NUMBER_FIELDS) {
    const value = text(key, 20);
    if (!value) { numbers[key] = ""; continue; }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 0) errors.push(`Tam sayı olmalı: ${key}`);
    numbers[key] = parsed;
  }
  if (!(Number(numbers.grossArea) > 0)) errors.push("Brüt alan (grossArea) gerekli.");
  const images = [...new Set(raw.images.map((url) => url.trim()).filter(Boolean))].slice(0, MAX_IMPORT_IMAGES);
  if (!images.length) errors.push("En az bir fotoğraf adresi gerekli.");
  if (images.some((url) => !/^https:\/\/[^\s]+$/i.test(url))) errors.push("Fotoğraf adresleri https ile başlamalı.");
  const unknownAmenities = raw.amenities.filter((a) => !options.amenities.includes(a.trim()));
  if (unknownAmenities.length) errors.push(`Tanınmayan özellik: ${unknownAmenities.join(", ")}`);
  const translations: Record<string, { title: string; description: string }> = {};
  for (const [lang, value] of Object.entries(raw.translations)) {
    if (!(IMPORT_LANGUAGES as readonly string[]).includes(lang)) { errors.push(`Desteklenmeyen çeviri dili: ${lang}`); continue; }
    const t = value.title.trim().slice(0, 150), d = value.description.trim().slice(0, 5000);
    if (t || d) translations[lang] = { title: t, description: d };
  }
  const furnished = text("furnished", 5);
  return {
    ref, neighborhood, postalCode: raw.neighborhoodPostalCode?.trim() || undefined, images, errors,
    payload: {
      title, description, purpose, propertyType, price, currency, city, district, ...numbers,
      rooms: text("rooms", 20), heating: text("heating", 60), furnished: furnished === "1" || furnished.toLowerCase() === "true",
      amenities: raw.amenities.map((a) => a.trim()).filter((a) => options.amenities.includes(a)),
      videoUrl: text("videoUrl", 500), tourUrl: text("tourUrl", 500), floorPlan: "", panoramas: "[]", translations,
    },
  };
}

// Same ref for the same account always maps to the same submission id, so a re-run cannot duplicate a listing.
export async function importSubmissionId(userId: string, ref: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`xml-import:${userId}:${ref}`)));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Turkish-aware comparison so "Beşyol", "BEŞYOL" and "Besyol Mah." resolve to the same neighbourhood.
export function neighborhoodKey(name: string) {
  return name.toLocaleLowerCase("tr").replace(/\s+(mah\.?|mahallesi)$/u, "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
}

export function matchNeighborhood(options: { id: number; name: string; postalCode?: string }[], name: string, postalCode?: string) {
  const key = neighborhoodKey(name);
  const matches = options.filter((item) => neighborhoodKey(item.name) === key && (!postalCode || item.postalCode === postalCode));
  return matches.length === 1 ? matches[0] : null;
}
