// Shared by the browser and the server (no runtime imports).
// Statistics consent given before Google Analytics was added covered only the site's own view
// counts. Such consent does not load Google Analytics; the cookie banner asks again instead.
export const GOOGLE_ANALYTICS_SINCE = Date.parse("2026-11-02T00:00:00Z");
export const gaConsentCurrent = (consent: { analytics: boolean; updatedAt: number } | null | undefined) => Boolean(consent?.analytics && consent.updatedAt >= GOOGLE_ANALYTICS_SINCE);
