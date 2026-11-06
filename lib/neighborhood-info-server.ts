import { env, waitUntil } from "./runtime";
import { db } from "./server";
import { siteUrl } from "./site-url";
import { OVERPASS_ENDPOINT, refreshNearby, type NearbyDatabase } from "./neighborhood-info";

// Overpass settings: OVERPASS_URL may point at a self-hosted instance (e.g. on the Mittwald server).
export const overpassEndpoint = () => String((env as { OVERPASS_URL?: string }).OVERPASS_URL || OVERPASS_ENDPOINT);
export const geoUserAgent = () => `EstateMarket24/1.0 (+${siteUrl()}/iletisim)`;

export function listingNearby(id: string) {
  return refreshNearby(db() as unknown as NearbyDatabase, id, { endpoint: overpassEndpoint(), userAgent: geoUserAgent() });
}
/** After a save that set or moved the pin: fetch in the background so the first visitor finds it ready. */
export function scheduleListingNearby(id: string) {
  waitUntil(listingNearby(id).catch(() => null));
}
