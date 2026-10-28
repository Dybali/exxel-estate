import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/request-context";
export default function robots():MetadataRoute.Robots {
  return {rules:[{userAgent:"*",allow:["/","/ilanlar","/ilan/","/hakkimizda","/paketler"],disallow:["/api/","/hesabim","/yonetim","/ilan-ver"]}],sitemap:siteUrl()+"/sitemap.xml"};
}
