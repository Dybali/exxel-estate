import type { MetadataRoute } from "next";
export default function robots():MetadataRoute.Robots {
  return {rules:[{userAgent:"*",allow:["/","/ilanlar","/ilan/","/hakkimizda","/paketler"],disallow:["/api/","/hesabim","/yonetim","/ilan-ver"]}],sitemap:"https://excell-estate.blue-grape-8839.chatgpt.site/sitemap.xml"};
}
