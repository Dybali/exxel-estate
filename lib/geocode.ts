import { nearProvince, provinceCenter } from "./listing-location";
// Map centre for the pin step of the listing form: the chosen neighbourhood, else the district,
// else the province centroid (data/province-centers.json). Looked up server-side with OpenStreetMap
// Nominatim, following its usage policy (https://operations.osmfoundation.org/policies/nominatim/):
// an identifying User-Agent, at most one request per second from this instance, only place names
// from our own location lists (no free text), and every answer cached.

export const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
export const GEOCODE_TTL_MS = 30 * 864e5;
const MAX_ENTRIES = 1000;
export type MapCenter = { lat: number; lng: number; zoom: number; source: "neighborhood" | "district" | "province" };
export type GeocodeOptions = { fetch?: (input: string, init?: RequestInit) => Promise<Response>; userAgent: string; endpoint?: string; now?: () => number; sleep?: (ms: number) => Promise<void> };

const cache = new Map<string, { value: { lat: number; lng: number } | null; at: number }>();
let lane: Promise<unknown> = Promise.resolve(), lastCall = 0;

export function nominatimUrl(query: string, endpoint = NOMINATIM_ENDPOINT) {
  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", countrycodes: "tr", "accept-language": "tr" });
  return `${endpoint}?${params}`;
}

/** First result of a Nominatim answer when it lies in the chosen province. */
export function parseNominatim(city: string, body: unknown): { lat: number; lng: number } | null {
  const first = Array.isArray(body) ? (body[0] as { lat?: string; lon?: string } | undefined) : undefined;
  const lat = Number(first?.lat), lng = Number(first?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) && nearProvince(city, lat, lng) ? { lat, lng } : null;
}

// Serialised and spaced at least 1.1 s apart: Nominatim allows one request per second.
function throttled<T>(task: () => Promise<T>, options: GeocodeOptions): Promise<T> {
  const now = options.now || Date.now, sleep = options.sleep || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const run = lane.then(async () => {
    const wait = lastCall + 1100 - now();
    if (wait > 0) await sleep(wait);
    lastCall = now();
    return task();
  });
  lane = run.catch(() => undefined);
  return run;
}

async function lookup(query: string, city: string, options: GeocodeOptions) {
  const key = query.toLocaleLowerCase("tr"), now = (options.now || Date.now)();
  const hit = cache.get(key);
  if (hit && now - hit.at < GEOCODE_TTL_MS) return hit.value;
  const value = await throttled(async () => {
    const response = await (options.fetch || fetch)(nominatimUrl(query, options.endpoint), { headers: { "User-Agent": options.userAgent, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`nominatim_${response.status}`);
    return parseNominatim(city, await response.json());
  }, options);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { value, at: now });
  return value;
}

/** Centre for a validated place; never throws (falls back to the province centroid). */
export async function mapCenter(city: string, district: string, neighborhood: string | undefined, options: GeocodeOptions): Promise<MapCenter | null> {
  try {
    if (neighborhood) { const point = await lookup(`${neighborhood}, ${district}, ${city}`, city, options); if (point) return { ...point, zoom: 15, source: "neighborhood" }; }
    if (district) { const point = await lookup(`${district}, ${city}`, city, options); if (point) return { ...point, zoom: 13, source: "district" }; }
  } catch { /* Nominatim busy or unreachable: use the province centroid. */ }
  const center = provinceCenter(city);
  return center ? { lat: center[0], lng: center[1], zoom: 9, source: "province" } : null;
}

/** Test hook: forget cached answers and the rate-limit clock. */
export function resetGeocodeCache() { cache.clear(); lastCall = 0; lane = Promise.resolve(); }
