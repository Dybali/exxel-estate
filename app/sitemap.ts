import type { MetadataRoute } from "next";
import { DEMO_LISTINGS } from "@/lib/listings";
const base="https://excell-estate.blue-grape-8839.chatgpt.site";
export default function sitemap():MetadataRoute.Sitemap {
  return ["/","/ilanlar","/hakkimizda","/paketler",...DEMO_LISTINGS.map((l)=>`/ilan/${l.id}`)].map((path)=>({url:base+path,changeFrequency:path==="/ilanlar"?"daily":"weekly",priority:path==="/"?1:0.7}));
}
