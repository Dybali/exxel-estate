import { currentUser, error, num, ok, str } from "@/lib/server";
import { validDistrict } from "@/lib/turkey-locations";
import { findNeighborhood } from "@/lib/turkey-neighborhoods";
import { mapCenter } from "@/lib/geocode";
import { geoUserAgent } from "@/lib/neighborhood-info-server";

// Where the pin map of the listing form opens (lib/geocode.ts). Signed-in advertisers only, and only
// for places from our own il/ilçe/mahalle lists, so the server never relays free text to Nominatim.
export async function GET(request: Request) {
  if (!(await currentUser(request))) return error("Giriş gerekli.", 401);
  const params = new URL(request.url).searchParams;
  const city = str(params.get("city"), 70), district = str(params.get("district"), 70);
  if (!validDistrict(city, district)) return error("Geçersiz il veya ilçe.", 400);
  const id = params.get("neighborhoodId");
  const neighborhood = id ? findNeighborhood(city, district, num(id)) : undefined;
  const center = await mapCenter(city, district, neighborhood?.name, { userAgent: geoUserAgent() });
  if (!center) return error("Geçersiz il veya ilçe.", 400);
  return ok(center, { headers: { "Cache-Control": center.source === "province" ? "private, max-age=600" : "private, max-age=604800" } });
}
