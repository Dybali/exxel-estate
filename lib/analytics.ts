// Google Analytics 4 and Search Console settings (server only). Both are optional: without
// GA_MEASUREMENT_ID nothing is loaded, without GOOGLE_SITE_VERIFICATION no meta tag is rendered.
// See docs/security-checklist.md.
import { env } from "./runtime";

const setting = (name: string) => String((env as unknown as Record<string, unknown>)[name] ?? "").trim();
export function gaMeasurementId() {
  const id = setting("GA_MEASUREMENT_ID").toUpperCase();
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}
export function googleSiteVerification() {
  const token = setting("GOOGLE_SITE_VERIFICATION");
  return /^[A-Za-z0-9_-]{10,100}$/.test(token) ? token : null;
}
