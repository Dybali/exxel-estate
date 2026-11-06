import provinceCenters from "@/data/province-centers.json";
// Map pin of a listing (docs/listing-map.md).
//
// Storage: the listings.latitude/longitude columns always hold the PUBLIC point, the one every
// visitor, the map search (bbox) and the neighbourhood lookup use. When the owner chose
// "approximate" (the default) the public point is the exact pin moved 250–600 m in a random
// direction and rounded to 3 decimals; the exact pin is kept only in presentation.location.exact,
// which parseListing (lib/server.ts) removes before a listing leaves the server. With "exact" the
// columns hold the pin itself and presentation.location has no copy.
// Searching the columns therefore can never reveal an exact point the owner did not publish.

export type LocationPrecision = "exact" | "approximate";
export type StoredLocation = { precision: LocationPrecision; exact?: { lat: number; lng: number } };
export type LocationInput = { kind: "none" } | { kind: "clear" } | { kind: "set"; lat: number; lng: number; precision: LocationPrecision };
export type ResolvedLocation = { latitude: number | null; longitude: number | null; location: StoredLocation | null };

/** Mainland, islands and territorial waters of Türkiye, generously rounded. */
export const TURKEY_BOUNDS = { minLat: 35.8, maxLat: 42.15, minLng: 25.6, maxLng: 44.85 };
/** Distance from a province's centroid that still counts as "in the province" (Konya, Sivas, Antalya are ~300 km wide). */
export const PROVINCE_RADIUS_M = 220_000;
export const APPROXIMATE_MIN_M = 250, APPROXIMATE_MAX_M = 600;
const centers = provinceCenters as Record<string, number[]>;

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
export const inTurkey = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= TURKEY_BOUNDS.minLat && lat <= TURKEY_BOUNDS.maxLat && lng >= TURKEY_BOUNDS.minLng && lng <= TURKEY_BOUNDS.maxLng;
export const provinceCenter = (city: string): [number, number] | null => { const point = centers[city]; return point ? [point[0], point[1]] : null; };
/** Roughly inside the chosen province: within PROVINCE_RADIUS_M of its centroid. Unknown province: false. */
export function nearProvince(city: string, lat: number, lng: number) {
  const center = provinceCenter(city);
  return Boolean(center) && distanceMeters(center![0], center![1], lat, lng) <= PROVINCE_RADIUS_M;
}

const round = (value: number, digits: number) => { const f = 10 ** digits; return Math.round(value * f) / f; };
const blank = (value: unknown) => value === undefined || value === null || value === "";

/**
 * Reads latitude, longitude and locationPrecision from a listing form. "none": the request does not
 * touch the pin; "clear": the owner removed it. Throws an Error with a user-facing message.
 */
export function parseLocationInput(data: Record<string, unknown>, city: string): LocationInput {
  const hasLat = Object.hasOwn(data, "latitude"), hasLng = Object.hasOwn(data, "longitude");
  if (!hasLat && !hasLng) return { kind: "none" };
  if (blank(data.latitude) && blank(data.longitude)) return { kind: "clear" };
  const lat = typeof data.latitude === "number" || typeof data.latitude === "string" ? Number(data.latitude) : NaN;
  const lng = typeof data.longitude === "number" || typeof data.longitude === "string" ? Number(data.longitude) : NaN;
  if (!inTurkey(lat, lng)) throw new Error("Harita konumu Türkiye sınırları içinde olmalıdır.");
  if (!nearProvince(city, lat, lng)) throw new Error("Harita konumu seçtiğiniz ilin içinde olmalıdır.");
  const precision = data.locationPrecision === "exact" ? "exact" : "approximate";
  // ~1 m is enough for a house; more digits only make the pin look more precise than a click is.
  return { kind: "set", lat: round(lat, 5), lng: round(lng, 5), precision };
}

/** The exact pin moved APPROXIMATE_MIN_M–APPROXIMATE_MAX_M in a random direction, rounded to 3 decimals (~100 m). */
export function approximatePoint(lat: number, lng: number, random: () => number = Math.random): { lat: number; lng: number } {
  for (let attempt = 0; attempt < 20; attempt++) {
    const meters = 300 + random() * 200, bearing = random() * 2 * Math.PI;
    const dLat = (meters * Math.cos(bearing)) / 111_320, dLng = (meters * Math.sin(bearing)) / (111_320 * Math.cos((lat * Math.PI) / 180));
    const point = { lat: round(lat + dLat, 3), lng: round(lng + dLng, 3) };
    const moved = distanceMeters(lat, lng, point.lat, point.lng);
    if (moved >= APPROXIMATE_MIN_M && moved <= APPROXIMATE_MAX_M) return point;
  }
  // Practically unreachable; a fixed 400 m north still never returns the pin itself.
  return { lat: round(lat + 400 / 111_320, 3), lng: round(lng, 3) };
}

export type PreviousLocation = { latitude: number | null; longitude: number | null; location?: StoredLocation | null };

/**
 * Column values and presentation.location for a save. An approximate pin that did not move keeps
 * its earlier public point, so editing a listing again and again does not publish a cloud of
 * offsets around the real address.
 */
export function resolveLocation(input: LocationInput, previous: PreviousLocation | null, random: () => number = Math.random): ResolvedLocation | null {
  if (input.kind === "none") return null;
  if (input.kind === "clear") return { latitude: null, longitude: null, location: null };
  if (input.precision === "exact") return { latitude: input.lat, longitude: input.lng, location: { precision: "exact" } };
  const before = previous?.location?.precision === "approximate" ? previous.location.exact : undefined;
  if (before && before.lat === input.lat && before.lng === input.lng && previous!.latitude != null && previous!.longitude != null)
    return { latitude: previous!.latitude, longitude: previous!.longitude, location: { precision: "approximate", exact: before } };
  const point = approximatePoint(input.lat, input.lng, random);
  return { latitude: point.lat, longitude: point.lng, location: { precision: "approximate", exact: { lat: input.lat, lng: input.lng } } };
}

/** presentation.location as stored, or null when it is missing or malformed. */
export function storedLocation(value: unknown): StoredLocation | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>, precision = item.precision === "exact" ? "exact" : item.precision === "approximate" ? "approximate" : null;
  if (!precision) return null;
  const exact = item.exact as Record<string, unknown> | undefined;
  return precision === "approximate" && exact && Number.isFinite(exact.lat) && Number.isFinite(exact.lng)
    ? { precision, exact: { lat: Number(exact.lat), lng: Number(exact.lng) } } : { precision };
}

/** Presentation without the private exact pin: the only shape that may leave the server. */
export function publicPresentation<T extends Record<string, unknown>>(presentation: T): T {
  const location = storedLocation(presentation?.location);
  if (!presentation || !("location" in presentation)) return presentation;
  const { location: _hidden, ...rest } = presentation;
  return (location ? { ...rest, location: { precision: location.precision } } : rest) as unknown as T;
}

/** Precision shown to visitors; rows without a flag predate the pin step and are labelled approximate. */
export function publicPrecision(presentation: unknown, latitude: unknown, longitude: unknown): "exact" | "approximate" | undefined {
  if (latitude == null || longitude == null) return undefined;
  return storedLocation((presentation as Record<string, unknown> | null)?.location)?.precision === "exact" ? "exact" : "approximate";
}

/** The owner's own pin for the edit form (never sent to anyone else). */
export function ownerPin(row: { latitude?: unknown; longitude?: unknown; presentation?: unknown }) {
  if (row.latitude == null || row.longitude == null) return null;
  let presentation: Record<string, unknown> = {};
  try { presentation = typeof row.presentation === "string" ? JSON.parse(row.presentation || "{}") : (row.presentation as Record<string, unknown>) || {}; } catch { /* keep empty */ }
  const location = storedLocation(presentation.location);
  if (location?.precision === "approximate" && location.exact) return { latitude: location.exact.lat, longitude: location.exact.lng, precision: "approximate" as const };
  return { latitude: Number(row.latitude), longitude: Number(row.longitude), precision: location?.precision === "exact" ? "exact" as const : "approximate" as const };
}

/** Map search box "minLng,minLat,maxLng,maxLat"; null when malformed. */
export function parseBbox(value: string | null | undefined): [number, number, number, number] | null {
  if (!value || value.length > 120) return null;
  const parts = value.split(",").map((part) => (part.trim() === "" ? NaN : Number(part)));
  if (parts.length !== 4 || !parts.every(Number.isFinite)) return null;
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90 || minLng >= maxLng || minLat >= maxLat) return null;
  return [minLng, minLat, maxLng, maxLat];
}
/** Plain range conditions on the public point columns, so a (latitude, longitude) index can serve them. */
export function bboxSql(bbox: [number, number, number, number], alias = "l") {
  return { where: `${alias}.latitude BETWEEN ? AND ? AND ${alias}.longitude BETWEEN ? AND ?`, values: [bbox[1], bbox[3], bbox[0], bbox[2]] };
}
export const inBbox = (bbox: [number, number, number, number], lat?: number | null, lng?: number | null) =>
  lat != null && lng != null && lng >= bbox[0] && lat >= bbox[1] && lng <= bbox[2] && lat <= bbox[3];
