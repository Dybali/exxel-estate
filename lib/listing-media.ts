// Storage keys of every file a listing uses: photos, 360° scenes and the floor plan.
export function listingMediaKeys(images: unknown, presentation: unknown) {
  const list = Array.isArray(images) ? images : [];
  const shown = (presentation && typeof presentation === "object" ? presentation : {}) as { panoramas?: { url?: unknown }[]; floorPlan?: unknown };
  const urls = [...list, ...(Array.isArray(shown.panoramas) ? shown.panoramas.map((scene) => scene?.url) : []), shown.floorPlan];
  return [...new Set(urls.filter((url): url is string => typeof url === "string" && url.startsWith("/api/media/listings/")).map((url) => url.slice("/api/media/".length)))];
}

// Removes files a listing no longer uses. Each key belongs to one listing only (property_images.object_key
// is unique), so nothing else can still point at them. Best effort: a failed delete only leaves storage behind.
export async function removeListingMedia(keys: string[], remove: (key: string) => Promise<unknown>) {
  const results = await Promise.allSettled(keys.map((key) => remove(key)));
  return results.filter((result) => result.status === "rejected").length;
}
