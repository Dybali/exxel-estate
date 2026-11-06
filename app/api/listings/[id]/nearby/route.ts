import { error, listingById, ok } from "@/lib/server";
import { listingNearby } from "@/lib/neighborhood-info-server";
import { nearbyNeedsRefresh, storedNearby } from "@/lib/neighborhood-info";

// Neighbourhood block of a published listing (components/NeighbourhoodInfo.tsx). The stored result
// in presentation.nearby is returned as is; only a missing or stale one triggers one server-side
// Overpass lookup (lib/neighborhood-info.ts). Browsers never call Overpass.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await listingById(id);
  if (!listing || (listing.source === "user" && listing.status !== "published")) return error("İlan bulunamadı.", 404);
  if (listing.latitude == null || listing.longitude == null || listing.source !== "user") return ok({ available: false }, { headers: { "Cache-Control": "public, max-age=3600" } });
  let nearby = storedNearby(listing.presentation?.nearby, listing.latitude, listing.longitude);
  if (nearbyNeedsRefresh(nearby, listing.latitude, listing.longitude)) nearby = await listingNearby(listing.id).catch(() => nearby);
  return ok({ available: true, nearby: nearby || null }, { headers: { "Cache-Control": nearby && !nearby.failed ? "public, max-age=3600, s-maxage=86400" : "no-store" } });
}
