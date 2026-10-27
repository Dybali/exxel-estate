import type { MetadataRoute } from "next";
import {publishedListingEntries} from '@/lib/server';
const base="https://exxel-estate.blue-grape-8839.chatgpt.site";
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const listings=await publishedListingEntries();
  return [...["/","/ilanlar","/sirketler","/hakkimizda","/paketler"].map(path=>({url:base+path,changeFrequency:'daily' as const,priority:path==='/'?1:.7})),...listings.map(item=>({url:base+'/ilan/'+item.id,...(Number.isFinite(Date.parse(item.updatedAt))?{lastModified:new Date(item.updatedAt)}:{}),changeFrequency:'weekly' as const,priority:.8}))];
}
