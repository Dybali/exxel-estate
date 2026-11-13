// Browser side of the firm statistics (lib/firm-track.ts): fire and forget, never blocks the visitor.
export type FirmScope = "services" | "contractors";
export function trackFirmEvent(scope: FirmScope, firmId: string, kind: "view" | "phone" | "whatsapp" | "email" | "website") {
  try { void fetch(`/api/${scope}/track`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firmId, kind }) }).catch(() => {}); } catch { /* ignore */ }
}
/** The firms shown on a search results page ("aramalarda görünme"); samples are never counted. */
export function trackFirmSearch(scope: FirmScope, firms: { id: string; sample?: boolean }[]) {
  const firmIds = firms.filter((firm) => !firm.sample).map((firm) => firm.id).slice(0, 24);
  if (!firmIds.length) return;
  try { void fetch(`/api/${scope}/track`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "search", firmIds }) }).catch(() => {}); } catch { /* ignore */ }
}
