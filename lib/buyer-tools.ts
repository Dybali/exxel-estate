// Pure helpers for the buyer tools on listing pages (shared by API routes and tests).

// Standard annuity: monthly payment for principal at a monthly rate (percent) over n months.
export function monthlyPayment(principal: number, monthlyRatePercent: number, months: number) {
  if (!(principal > 0) || !(months > 0)) return 0;
  const r = monthlyRatePercent / 100;
  if (r <= 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export function loanSummary(price: number, downPaymentPercent: number, monthlyRatePercent: number, months: number) {
  const down = Math.min(price, Math.max(0, (price * downPaymentPercent) / 100));
  const principal = price - down;
  const monthly = monthlyPayment(principal, monthlyRatePercent, months);
  const total = monthly * months;
  return { down, principal, monthly, total, interest: Math.max(0, total - principal) };
}

export function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export const MIN_COMPARABLES = 3;

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

export type NearbyCategory = "education" | "health" | "shopping" | "transport" | "beach";
export type OsmElement = { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

export function nearbyCategory(tags: Record<string, string> = {}): NearbyCategory | null {
  if (/^(school|kindergarten|university|college)$/.test(tags.amenity || "")) return "education";
  if (/^(hospital|clinic|pharmacy|doctors)$/.test(tags.amenity || "")) return "health";
  if (/^(supermarket|convenience|mall)$/.test(tags.shop || "")) return "shopping";
  if (tags.highway === "bus_stop" || tags.public_transport === "station" || /^(station|tram_stop|subway_entrance|halt)$/.test(tags.railway || "") || tags.amenity === "ferry_terminal") return "transport";
  if (tags.natural === "beach") return "beach";
  return null;
}

// Count places per category and keep the nearest named one.
export function summarizeNearby(lat: number, lng: number, elements: OsmElement[]) {
  const summary: Record<NearbyCategory, { count: number; nearest: { name: string; meters: number } | null }> = {
    education: { count: 0, nearest: null }, health: { count: 0, nearest: null }, shopping: { count: 0, nearest: null },
    transport: { count: 0, nearest: null }, beach: { count: 0, nearest: null },
  };
  for (const element of elements) {
    const category = nearbyCategory(element.tags);
    const point = element.center || (element.lat != null && element.lon != null ? { lat: element.lat, lon: element.lon } : null);
    if (!category || !point) continue;
    const entry = summary[category], meters = Math.round(distanceMeters(lat, lng, point.lat, point.lon));
    entry.count++;
    const name = element.tags?.name || "";
    if (name && (!entry.nearest || meters < entry.nearest.meters)) entry.nearest = { name: name.slice(0, 80), meters };
  }
  return summary;
}
