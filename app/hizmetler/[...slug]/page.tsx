import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ServiceCategoryPage } from "@/components/ServiceCategoryPage";
import { translate } from "@/lib/i18n-dictionary";
import { localizedUrl, pageAlternates, requestLocale } from "@/lib/request-context";
import { serviceCrumbs, serviceDescription, serviceHeading } from "@/lib/service-copy";
import { firmPath, publicFirms, resolveServicePath, serviceFacets, serviceIndexable, servicePath, summarizeService } from "@/lib/services";
import { servicesDB } from "@/lib/services-server";
import { coverShareImage } from "@/lib/share-image-policy";
import { shareMetadata } from "@/lib/share-metadata";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string[] }> };

// Two queries, run together; generateMetadata and the page share one load per request.
const load = cache(async (key: string) => {
  const scope = resolveServicePath(key.split("/"));
  if (!scope) return null;
  const [facets, firms] = await Promise.all([serviceFacets(servicesDB(), scope.category), publicFirms(servicesDB(), scope)]);
  return { scope, path: servicePath(scope.category, scope.city, scope.district), summary: summarizeService(scope, facets), firms };
});
// Slugs are plain ASCII; anything else (encoded characters, a "/" inside a segment) is a 404.
const keyOf = async ({ params }: Props) => (await params).slug.map((part) => /^[a-z0-9-]+$/.test(part) ? part : "-").join("/");

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(await keyOf(props)), locale = await requestLocale();
  if (!data) return { title: `${translate("Sayfa bulunamadı", locale)} | estatemarket24`, robots: { index: false, follow: false } };
  const { scope, path, summary, firms } = data, heading = serviceHeading(scope.category, locale, scope.district || scope.city);
  const description = serviceDescription(heading, summary.count, locale), cover = firms.find((firm) => firm.cover || firm.photos[0]);
  return {
    title: `${heading} | estatemarket24`, description,
    alternates: await pageAlternates(path),
    // Thin content: no firm of its own → kept out of search results (and the sitemap), links still followed.
    ...(serviceIndexable(summary) ? {} : { robots: { index: false, follow: true } }),
    ...shareMetadata({ title: heading, description, path, locale, image: coverShareImage(cover?.cover || cover?.photos[0], heading) }),
  };
}

export default async function ServiceCategoryRoute(props: Props) {
  const data = await load(await keyOf(props));
  if (!data) notFound();
  const locale = await requestLocale(), { scope, summary, firms } = data;
  const structured = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: serviceCrumbs(scope, locale).map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: localizedUrl(crumb.path, locale) })) },
    ...(firms.length ? [{ "@context": "https://schema.org", "@type": "ItemList", name: serviceHeading(scope.category, locale, scope.district || scope.city), numberOfItems: firms.length,
      itemListElement: firms.map((firm, index) => ({ "@type": "ListItem", position: index + 1, url: localizedUrl(firmPath(firm.id), locale), name: firm.name })) }] : []),
  ];
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}/>
    <ServiceCategoryPage scope={scope} summary={summary} firms={firms}/>
  </>;
}
