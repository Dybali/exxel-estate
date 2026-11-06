import { distanceMeters } from "./listing-location";
// "Mahalle bilgisi": nearest school, hospital, pharmacy, supermarket, stops, beach, sea, park and
// mosque around a listing's PUBLIC point, from OpenStreetMap through the Overpass API.
// Only the server calls Overpass, once per location; the compact result is stored in
// presentation.nearby and refreshed lazily (docs/listing-map.md). Data © OpenStreetMap
// contributors, ODbL.

export const NEARBY_TYPES = ["school", "hospital", "pharmacy", "supermarket", "metro", "rail", "tram", "bus", "ferry", "beach", "sea", "park", "mosque"] as const;
export type NearbyType = typeof NEARBY_TYPES[number];
export type NearbyItem = { type: NearbyType; name: string; distanceM: number };
export type NearbyInfo = {
  fetchedAt: string;
  /** Public point the distances were measured from (rounded). */
  point: [number, number];
  radiusM: number;
  /** Measured from an approximate (offset) point: distances are approximate too. */
  approximate: boolean;
  items: NearbyItem[];
  /** Overpass did not answer; retried after NEARBY_RETRY_MS. */
  failed?: boolean;
};
export type OverpassElement = { type?: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; geometry?: ({ lat: number; lon: number } | null)[]; tags?: Record<string, string> };

export const NEARBY_RADIUS_M = 2000;
export const NEARBY_MAX_AGE_MS = 30 * 864e5;
export const NEARBY_RETRY_MS = 6 * 3600e3;
export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
export const OVERPASS_TIMEOUT_MS = 20_000;

/** Overpass QL for one point; coastline geometry is clipped to the search box to keep the answer small. */
export function overpassQuery(lat: number, lng: number, radius = NEARBY_RADIUS_M) {
  const around = `(around:${radius},${lat},${lng})`;
  const dLat = radius / 111_320, dLng = radius / (111_320 * Math.cos((lat * Math.PI) / 180));
  const box = [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((n) => n.toFixed(5)).join(",");
  return `[out:json][timeout:15];(` +
    `nwr${around}[amenity~"^(school|hospital|pharmacy|ferry_terminal)$"];` +
    `nwr${around}[shop=supermarket];` +
    `node${around}[highway=bus_stop];` +
    `nwr${around}[railway~"^(station|halt|tram_stop|subway_entrance)$"];` +
    `nwr${around}[natural=beach];` +
    `nwr${around}[leisure=park][name];` +
    `nwr${around}[amenity=place_of_worship][religion=muslim];` +
    `);out center 3000;way${around}[natural=coastline];out geom(${box}) 50;`;
}

/** Category of one OpenStreetMap object, or null when it is not one we show. */
export function nearbyType(element: OverpassElement): NearbyType | null {
  const tags = element.tags || {};
  if (tags.natural === "coastline") return "sea";
  if (tags.amenity === "school") return "school";
  if (tags.amenity === "hospital") return "hospital";
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "ferry_terminal") return "ferry";
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.railway === "subway_entrance" || tags.station === "subway" || (tags.railway === "station" && tags.subway === "yes")) return "metro";
  if (tags.railway === "tram_stop" || (tags.railway === "station" && tags.station === "light_rail")) return "tram";
  if (tags.railway === "station" || tags.railway === "halt") return "rail";
  if (tags.highway === "bus_stop") return "bus";
  if (tags.natural === "beach") return "beach";
  if (tags.leisure === "park") return "park";
  if (tags.amenity === "place_of_worship" && tags.religion === "muslim") return "mosque";
  return null;
}

// Distance from p to segment a–b on a local flat projection (fine within a few km).
function segmentDistance(lat: number, lng: number, a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const kx = 111_320 * Math.cos((lat * Math.PI) / 180), ky = 110_540;
  const ax = (a.lon - lng) * kx, ay = (a.lat - lat) * ky, bx = (b.lon - lng) * kx, by = (b.lat - lat) * ky;
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function elementDistance(lat: number, lng: number, element: OverpassElement) {
  if (element.geometry?.length) {
    const points = element.geometry.filter((p): p is { lat: number; lon: number } => Boolean(p) && Number.isFinite(p!.lat) && Number.isFinite(p!.lon));
    if (points.length === 1) return distanceMeters(lat, lng, points[0].lat, points[0].lon);
    let best = Infinity;
    for (let i = 1; i < points.length; i++) best = Math.min(best, segmentDistance(lat, lng, points[i - 1], points[i]));
    return best;
  }
  const point = element.center || (element.lat != null && element.lon != null ? { lat: element.lat, lon: element.lon } : null);
  return point ? distanceMeters(lat, lng, point.lat, point.lon) : Infinity;
}

/** Nearest object of each type within the radius, in NEARBY_TYPES order. */
export function parseOverpass(lat: number, lng: number, elements: OverpassElement[], radius = NEARBY_RADIUS_M): NearbyItem[] {
  const nearest = new Map<NearbyType, NearbyItem>();
  for (const element of elements || []) {
    const type = nearbyType(element);
    if (!type) continue;
    const distance = Math.round(elementDistance(lat, lng, element));
    if (!Number.isFinite(distance) || distance > radius) continue;
    const name = type === "sea" ? "" : String(element.tags?.name || "").replace(/\s+/g, " ").trim().slice(0, 80);
    const current = nearest.get(type);
    // A named place up to 30 m further away is preferred to an unnamed one.
    const score = distance - (name ? 30 : 0), currentScore = current ? current.distanceM - (current.name ? 30 : 0) : Infinity;
    if (score < currentScore) nearest.set(type, { type, name, distanceM: distance });
  }
  return NEARBY_TYPES.flatMap((type) => (nearest.has(type) ? [nearest.get(type)!] : []));
}

const samePoint = (a: [number, number] | undefined, lat: number, lng: number) => Boolean(a) && distanceMeters(a![0], a![1], lat, lng) < 25;

/** Whether the stored block must be fetched again for this public point. */
export function nearbyNeedsRefresh(nearby: NearbyInfo | null | undefined, lat: number, lng: number, now = Date.now()) {
  if (!nearby || !Array.isArray(nearby.items) || !samePoint(nearby.point, lat, lng)) return true;
  const age = now - Date.parse(nearby.fetchedAt);
  if (!Number.isFinite(age)) return true;
  return age > (nearby.failed ? NEARBY_RETRY_MS : NEARBY_MAX_AGE_MS);
}

/** presentation.nearby when it is well formed (and measured from this point), else null. */
export function storedNearby(value: unknown, lat?: number | null, lng?: number | null): NearbyInfo | null {
  if (!value || typeof value !== "object") return null;
  const item = value as NearbyInfo;
  if (!Array.isArray(item.items) || !Array.isArray(item.point) || typeof item.fetchedAt !== "string") return null;
  if (lat != null && lng != null && !samePoint(item.point, lat, lng)) return null;
  return item;
}

/** Walking minutes: 80 m a minute along streets about 25 % longer than the straight line. */
export const walkingMinutes = (meters: number) => Math.max(1, Math.round((meters * 1.25) / 80));

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export async function fetchNearby(lat: number, lng: number, options: { approximate: boolean; fetch?: FetchLike; endpoint?: string; userAgent?: string; timeoutMs?: number; now?: () => Date }): Promise<NearbyInfo> {
  const call = options.fetch || fetch, point: [number, number] = [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
  const response = await call(options.endpoint || OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": options.userAgent || "EstateMarket24/1.0" },
    body: "data=" + encodeURIComponent(overpassQuery(point[0], point[1])),
    signal: AbortSignal.timeout(options.timeoutMs || OVERPASS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`overpass_${response.status}`);
  const data = (await response.json()) as { elements?: OverpassElement[] };
  if (!data || !Array.isArray(data.elements)) throw new Error("overpass_shape");
  return { fetchedAt: (options.now?.() || new Date()).toISOString(), point, radiusM: NEARBY_RADIUS_M, approximate: options.approximate, items: parseOverpass(point[0], point[1], data.elements) };
}

/** Stored after a failed lookup so the next try waits NEARBY_RETRY_MS; a previous good result is kept. */
export function failedNearby(previous: NearbyInfo | null, lat: number, lng: number, approximate: boolean, now = new Date()): NearbyInfo {
  const point: [number, number] = [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
  if (previous && samePoint(previous.point, lat, lng) && !previous.failed && previous.items.length)
    return { ...previous, fetchedAt: new Date(now.getTime() - NEARBY_MAX_AGE_MS + NEARBY_RETRY_MS).toISOString() };
  return { fetchedAt: now.toISOString(), point, radiusM: NEARBY_RADIUS_M, approximate, items: [], failed: true };
}

type Bindable = string | number | null;
export interface NearbyDatabase {
  prepare(sql: string): { bind(...values: Bindable[]): { first<T>(): Promise<T | null>; run(): Promise<unknown> } };
}
const inflight = new Map<string, Promise<NearbyInfo | null>>();
let lane: Promise<unknown> = Promise.resolve();
// One Overpass request at a time per server instance (the public instance allows two per IP).
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = lane.then(task, task);
  lane = run.catch(() => undefined);
  return run;
}

/**
 * Stored block for a listing, fetched from Overpass first when it is missing, older than 30 days,
 * failed more than 6 hours ago, or measured from another point. Concurrent calls for one listing
 * share a single lookup; the write only lands if the row's presentation did not change meanwhile.
 */
export function refreshNearby(database: NearbyDatabase, id: string, options: { fetch?: FetchLike; endpoint?: string; userAgent?: string; now?: () => Date } = {}): Promise<NearbyInfo | null> {
  const running = inflight.get(id);
  if (running) return running;
  const task = (async () => {
    const row = await database.prepare("SELECT latitude,longitude,presentation FROM listings WHERE id=?").bind(id).first<{ latitude: number | null; longitude: number | null; presentation: string | null }>();
    if (!row || row.latitude == null || row.longitude == null) return null;
    const lat = Number(row.latitude), lng = Number(row.longitude);
    let presentation: Record<string, unknown>;
    try { presentation = JSON.parse(String(row.presentation || "{}")); } catch { return null; }
    const current = storedNearby(presentation.nearby);
    const now = options.now?.() || new Date();
    if (!nearbyNeedsRefresh(current, lat, lng, now.getTime())) return current;
    const location = presentation.location as { precision?: string } | undefined;
    const approximate = location?.precision !== "exact";
    let next: NearbyInfo;
    try { next = await serialized(() => fetchNearby(lat, lng, { approximate, fetch: options.fetch, endpoint: options.endpoint, userAgent: options.userAgent, now: () => now })); }
    catch { next = failedNearby(current && current.point && distanceMeters(current.point[0], current.point[1], lat, lng) < 25 ? current : null, lat, lng, approximate, now); }
    await database.prepare("UPDATE listings SET presentation=? WHERE id=? AND presentation=?").bind(JSON.stringify({ ...presentation, nearby: next }), id, row.presentation).run();
    return next;
  })().finally(() => inflight.delete(id));
  inflight.set(id, task);
  return task;
}
