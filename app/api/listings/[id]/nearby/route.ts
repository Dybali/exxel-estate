import { error, listingById, ok } from "@/lib/server";
import { summarizeNearby, type OsmElement } from "@/lib/buyer-tools";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const WEEK = 7 * 24 * 3600;

// Schools, health, shops, transport and beaches around a published listing, from OpenStreetMap.
// The server queries Overpass (visitors' details are never sent) and caches per rounded position.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await listingById(id);
  if (!listing || (listing.source === "user" && listing.status !== "published")) return error("İlan bulunamadı.", 404);
  if (listing.latitude == null || listing.longitude == null) return ok({ available: false });
  const lat = Math.round(listing.latitude * 1000) / 1000, lng = Math.round(listing.longitude * 1000) / 1000;
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(`https://nearby.cache/v1/${lat},${lng}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const around = (meters: number) => `(around:${meters},${lat},${lng})`;
  const query = `[out:json][timeout:20];(nwr${around(1500)}[amenity~"^(school|kindergarten|university|college|hospital|clinic|pharmacy|doctors|ferry_terminal)$"];nwr${around(1500)}[shop~"^(supermarket|convenience|mall)$"];nwr${around(1000)}[highway=bus_stop];nwr${around(1500)}[public_transport=station];nwr${around(1500)}[railway~"^(station|tram_stop|subway_entrance|halt)$"];nwr${around(3000)}[natural=beach];);out center 400;`;
  let elements: OsmElement[];
  try {
    const response = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "estatemarket24 (nearby places for listings)" },
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(22000),
    });
    if (!response.ok) throw new Error(String(response.status));
    elements = ((await response.json()) as { elements?: OsmElement[] }).elements || [];
  } catch {
    return Response.json({ error: "Yakın çevre bilgisi şu anda alınamadı." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const result = ok({ available: true, radius: 1500, places: summarizeNearby(lat, lng, elements), source: "OpenStreetMap" }, { headers: { "Cache-Control": `public,max-age=86400,s-maxage=${WEEK}` } });
  await cache.put(key, result.clone()).catch(() => {});
  return result;
}
