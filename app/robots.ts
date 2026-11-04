import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/request-context";
// Listing and project photos (/api/media/listings/) stay crawlable: they are the link preview images.
export default function robots():MetadataRoute.Robots {
  return {rules:[{userAgent:"*",allow:["/","/ilanlar","/ilan/","/emlak/","/hakkimizda","/paketler","/api/media/listings/"],disallow:["/api/","/hesabim","/yonetim","/ilan-ver"]}],sitemap:siteUrl()+"/sitemap.xml"};
}
