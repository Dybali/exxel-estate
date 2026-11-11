import type { MetadataRoute } from "next";
import {db,publishedListingEntries} from '@/lib/server';
import {regionSitemapEntries,type RegionDatabase} from '@/lib/region-pages';
import {editorialArticles} from '@/lib/editorial';
import {companyDirectoryEntries} from '@/lib/company-seo';
import {serviceSitemapEntries} from '@/lib/services';
import {servicesDB} from '@/lib/services-server';
import {contractorSitemapEntries} from '@/lib/contractors';
import {contractorsDB} from '@/lib/contractors-server';
import {languageAlternates,localizedUrl} from '@/lib/request-context';
export const dynamic='force-dynamic';
// The sitemap protocol allows 50,000 URLs per file; contractor and service firm profiles come last and give way first.
const SITEMAP_URL_LIMIT=50000;
// One entry per page with every language variant listed as an hreflang alternate.
const entry=(path:string,extra:Omit<MetadataRoute.Sitemap[number],'url'>)=>({url:localizedUrl(path,'tr'),alternates:{languages:languageAlternates(path)},...extra});
export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  // Region pages (/emlak/...) only with at least one real listing (thin pages are noindex).
  // Service pages (/hizmetler/...) likewise only with an approved firm of their own; firm profiles when approved.
  const [listings,companies,regions,services,contractors]=await Promise.all([publishedListingEntries(),companyDirectoryEntries().catch(()=>[]),(async()=>regionSitemapEntries(db() as unknown as RegionDatabase))().catch(()=>[]),serviceSitemapEntries(servicesDB()).catch(()=>({pages:[],firms:[]})),contractorSitemapEntries(contractorsDB()).catch(()=>[] as {path:string;updatedAt:string}[])]);
  const lastModified=(at:string)=>Number.isFinite(Date.parse(at))?{lastModified:new Date(at)}:{};
  const entries:MetadataRoute.Sitemap=[
    ...["/","/ilanlar","/sirketler","/projeler","/emlak","/hizmetler","/muteahhitler","/muteahhitler/kat-karsiligi","/hakkimizda","/paketler","/kurumsal-uyelik","/blog","/asistan","/yabanci-alici","/yabanci-alici/vatandaslik"].map(path=>entry(path,{changeFrequency:'daily',priority:path==='/'?1:.7})),
    ...["/iletisim","/sss","/ilan-kurallari","/toplu-ilan"].map(path=>entry(path,{changeFrequency:'monthly',priority:.5})),
    ...["/kullanim-kosullari","/gizlilik-politikasi","/cerez-politikasi","/impressum"].map(path=>entry(path,{changeFrequency:'yearly',priority:.3})),
    ...editorialArticles.map(a=>entry('/blog/'+a.slug,{lastModified:new Date(a.date),changeFrequency:'monthly',priority:.6})),
    ...companies.map(c=>entry('/sirketler/'+c.id,{changeFrequency:'weekly',priority:.6})),
    ...regions.map(region=>entry(region.path,{...(Number.isFinite(Date.parse(region.updatedAt))?{lastModified:new Date(region.updatedAt)}:{}),changeFrequency:'daily',priority:region.path.split('/').length<=3?.7:.6})),
    ...services.pages.map(page=>entry(page.path,{...lastModified(page.updatedAt),changeFrequency:'weekly',priority:page.path.split('/').length<=4?.6:.5})),
    ...listings.map(item=>entry('/ilan/'+item.id,{...(Number.isFinite(Date.parse(item.updatedAt))?{lastModified:new Date(item.updatedAt)}:{}),changeFrequency:'weekly',priority:.8})),
  ];
  const firms=[...contractors,...services.firms];
  return [...entries,...firms.slice(0,Math.max(0,SITEMAP_URL_LIMIT-entries.length)).map(firm=>entry(firm.path,{...lastModified(firm.updatedAt),changeFrequency:'weekly',priority:.5}))];
}
