import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/request-context";
// Rendered per request so the Sitemap line carries the runtime SITE_URL, not the one present at build time.
export const dynamic = "force-dynamic";
// Listing and project photos (/api/media/listings/) stay crawlable: they are the link preview images.
// The read-only lists and records the public pages load in the browser stay crawlable too, so Google's
// renderer sees the listings, companies, projects and seller profiles those pages show. The longer,
// more specific rule wins, so these beat "/api/" while the owner list, contact details and the view,
// event and reservation endpoints stay closed (a rendering crawler must not count as a visitor).
const PUBLIC_API = ["/api/listings", "/api/companies", "/api/projects", "/api/profiles", "/api/media/listings/"];
export default function robots():MetadataRoute.Robots {
  return {rules:[{userAgent:"*",allow:["/","/ilanlar","/ilan/","/emlak/","/hizmetler","/hakkimizda","/paketler",...PUBLIC_API],disallow:["/api/","/api/projects/mine","/api/projects/*/reservations","/api/listings/*/contact","/api/listings/*/event","/api/listings/*/view","/hesabim","/yonetim","/ilan-ver","/ilan-duzenle","/giris","/karsilastir"]}],sitemap:siteUrl()+"/sitemap.xml"};
}
