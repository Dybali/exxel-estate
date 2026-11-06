import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ServiceCategoryPage } from "@/components/ServiceCategoryPage";
import { translate } from "@/lib/i18n-dictionary";
import { localizedUrl, pageAlternates, requestLocale } from "@/lib/request-context";
import { serviceCrumbs, serviceDescription, serviceHeading } from "@/lib/service-copy";
import { servicePageParam } from "@/lib/service-search";
import { categoryCounts, firmPath, resolveServicePath, searchFirms, serviceIndexable, servicePath, serviceSummary } from "@/lib/services";
import { realFirms, withSampleResults } from "@/lib/service-samples";
import { serviceSamples, servicesDB } from "@/lib/services-server";
import { coverShareImage } from "@/lib/share-image-policy";
import { shareMetadata } from "@/lib/share-metadata";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// One page of firms with its COUNT, the place links (grouped queries) and the sidebar's category
// counts for this place; generateMetadata and the page share one load per request (React cache).
// Sample firms (lib/service-samples.ts) follow the real ones and may add pages; every count, the
// summary and the indexing decision stay real-only.
const load = cache(async (key: string, page: number) => {
  const scope = resolveServicePath(key.split("/"));
  if (!scope) return null;
  const db = servicesDB(), query = { categories: [scope.category], city: scope.city, district: scope.district, page };
  const [real, counts] = await Promise.all([
    searchFirms(db, query),
    categoryCounts(db, { city: scope.city, district: scope.district }),
  ]);
  const results = withSampleResults(real, query, serviceSamples());
  // A page number past the last page does not exist (page 1 always does, also when empty).
  if (page > results.pages) return null;
  const summary = await serviceSummary(db, scope, results.total);
  const base = servicePath(scope.category, scope.city, scope.district);
  return { scope, path: page > 1 ? `${base}?sayfa=${page}` : base, summary, results, counts };
});
// Slugs are plain ASCII; anything else (encoded characters, a "/" inside a segment) is a 404.
const keyOf = async ({ params }: Props) => (await params).slug.map((part) => /^[a-z0-9-]+$/.test(part) ? part : "-").join("/");
const pageOf = async ({ searchParams }: Props) => servicePageParam((await searchParams).sayfa);

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(await keyOf(props), await pageOf(props)), locale = await requestLocale();
  if (!data) return { title: `${translate("Sayfa bulunamadı", locale)} | estatemarket24`, robots: { index: false, follow: false } };
  const { scope, path, summary, results } = data, heading = serviceHeading(scope.category, locale, scope.district || scope.city);
  const pageLabel = results.page > 1 ? ` · ${translate("Sayfa {n}", locale).replace("{n}", String(results.page))}` : "";
  const description = serviceDescription(heading, summary.count, locale), cover = realFirms(results.firms).find((firm) => firm.cover || firm.photos[0]);
  return {
    title: `${heading}${pageLabel} | estatemarket24`, description,
    // Later pages are their own canonical (?sayfa=n), so their firms stay reachable for search engines.
    alternates: await pageAlternates(path),
    // Thin content: no firm of its own → kept out of search results (and the sitemap), links still followed.
    // A page listing only sample firms (e.g. a later page after the real ones) is thin content too.
    ...(serviceIndexable(summary) && realFirms(results.firms).length > 0 ? {} : { robots: { index: false, follow: true } }),
    ...shareMetadata({ title: heading, description, path, locale, image: coverShareImage(cover?.cover || cover?.photos[0], heading) }),
  };
}

export default async function ServiceCategoryRoute(props: Props) {
  const data = await load(await keyOf(props), await pageOf(props));
  if (!data) notFound();
  const locale = await requestLocale(), { scope, summary, results, counts } = data;
  // ItemList: real firms only (they come first, so their positions are unchanged).
  const firms = realFirms(results.firms), offset = (results.page - 1) * results.perPage;
  const structured = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: serviceCrumbs(scope, locale).map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: localizedUrl(crumb.path, locale) })) },
    ...(firms.length ? [{ "@context": "https://schema.org", "@type": "ItemList", name: serviceHeading(scope.category, locale, scope.district || scope.city), numberOfItems: results.total,
      itemListElement: firms.map((firm, index) => ({ "@type": "ListItem", position: offset + index + 1, url: localizedUrl(firmPath(firm.id), locale), name: firm.name })) }] : []),
  ];
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}/>
    <ServiceCategoryPage scope={scope} summary={summary} results={results} counts={counts}/>
  </>;
}
