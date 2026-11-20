import { landingCity } from "./landing-cities";

// <slug>.estatemarket24.com (and <slug>.<LANDING_BASE_DOMAIN> for a test domain) opens the city's
// pre-registration page (app/on-kayit/[sehir]); proxy.ts rewrites the root path there.
export const LANDING_BASE_DOMAINS = ["estatemarket24.com"];
export function landingSlugForHost(host: string | null | undefined, extraBase = "") {
  const name = (host || "").split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  for (const base of [...LANDING_BASE_DOMAINS, extraBase.trim().toLowerCase()].filter(Boolean)) {
    if (!name.endsWith(`.${base}`)) continue;
    const slug = name.slice(0, -base.length - 1);
    if (!slug.includes(".") && landingCity(slug)) return slug;
  }
  return null;
}
