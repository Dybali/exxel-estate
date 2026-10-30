import type { MetadataRoute } from "next";
import {publishedListingEntries} from '@/lib/server';
import {editorialArticles} from '@/lib/editorial';
import {companyDirectoryEntries} from '@/lib/company-seo';
import {languageAlternates,localizedUrl} from '@/lib/request-context';
export const dynamic='force-dynamic';
// One entry per page with every language variant listed as an hreflang alternate.
const entry=(path:string,extra:Omit<MetadataRoute.Sitemap[number],'url'>)=>({url:localizedUrl(path,'tr'),alternates:{languages:languageAlternates(path)},...extra});
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const [listings,companies]=await Promise.all([publishedListingEntries(),companyDirectoryEntries().catch(()=>[])]);
  return [
    ...["/","/ilanlar","/sirketler","/projeler","/hakkimizda","/paketler","/kurumsal-uyelik","/blog","/asistan"].map(path=>entry(path,{changeFrequency:'daily',priority:path==='/'?1:.7})),
    ...editorialArticles.map(a=>entry('/blog/'+a.slug,{lastModified:new Date(a.date),changeFrequency:'monthly',priority:.6})),
    ...companies.map(c=>entry('/sirketler/'+c.id,{changeFrequency:'weekly',priority:.6})),
    ...listings.map(item=>entry('/ilan/'+item.id,{...(Number.isFinite(Date.parse(item.updatedAt))?{lastModified:new Date(item.updatedAt)}:{}),changeFrequency:'weekly',priority:.8})),
  ];
}
