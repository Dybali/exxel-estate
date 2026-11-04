import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RegionLanding, type RegionCrumb } from "@/components/RegionLanding";
import { translate } from "@/lib/i18n-dictionary";
import { publicListing, PUBLIC_DEMO_LISTINGS } from "@/lib/listings";
import { localizedListingText } from "@/lib/listing-seo";
import { PRICE_DROP_SQL } from "@/lib/price-history";
import { regionDescription, regionHeading, regionPhrase } from "@/lib/region-copy";
import { regionDemos, regionFacets, regionIndexable, regionListings, regionPath, regionPrices, resolveRegion, summarizeRegion, type RegionDatabase, type RegionScope } from "@/lib/region-pages";
import { localizedUrl, pageAlternates, requestLocale } from "@/lib/request-context";
import { coverShareImage } from "@/lib/share-image-policy";
import { shareMetadata } from "@/lib/share-metadata";
import { db, OWNER_VERIFIED_SQL, parseListing } from "@/lib/server";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string[] }> };

// At most three queries, run together; generateMetadata and the page share one load per request.
const load = cache(async (key: string) => {
  const scope = resolveRegion(key.split("/"));
  if (!scope) return null;
  const database = db() as unknown as RegionDatabase;
  const [facets, prices, listings] = await Promise.all([
    regionFacets(database, scope.city),
    regionPrices(database, scope),
    regionListings(database, scope, { parse: (row) => publicListing(parseListing(row)), columns: [OWNER_VERIFIED_SQL, PRICE_DROP_SQL] }),
  ]);
  const summary = summarizeRegion(scope, facets);
  return { scope, path: regionPath(scope)!, summary, prices: summary.count ? prices : null, listings };
});
// Slugs are plain ASCII; anything else (encoded characters, a "/" inside a segment) is a 404.
const scopeOf = async ({ params }: Props) => (await params).slug.map((part) => /^[a-z0-9-]+$/.test(part) ? part : "-").join("/");

function crumbsOf(scope: RegionScope, locale: Parameters<typeof translate>[1]): RegionCrumb[] {
  const crumbs: RegionCrumb[] = [{ name: translate("Ana sayfa", locale), path: "/" }, { name: scope.city, path: regionPath({ city: scope.city })! }];
  if (scope.district) crumbs.push({ name: scope.district, path: regionPath({ city: scope.city, district: scope.district })! });
  if (scope.purpose) crumbs.push({ name: regionPhrase(locale, scope.purpose, scope.type), path: regionPath(scope)! });
  return crumbs;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const data = await load(await scopeOf(props)), locale = await requestLocale();
  if (!data) return { title: `${translate("Sayfa bulunamadı", locale)} | estatemarket24`, robots: { index: false, follow: false } };
  const { scope, path, summary, listings } = data, heading = regionHeading(scope.district || scope.city, locale, scope.purpose, scope.type);
  const description = regionDescription(heading, summary.count, locale), cover = listings.find((item) => item.images.length)?.images[0];
  return {
    title: `${heading} | estatemarket24`, description,
    alternates: await pageAlternates(path),
    // Thin content: no real listing → kept out of search results (and out of the sitemap), links still followed.
    ...(regionIndexable(summary) ? {} : { robots: { index: false, follow: true } }),
    ...shareMetadata({ title: heading, description, path, locale, image: coverShareImage(cover, heading) }),
  };
}

export default async function RegionPage(props: Props) {
  const data = await load(await scopeOf(props));
  if (!data) notFound();
  const locale = await requestLocale(), { scope, path, summary, prices, listings } = data;
  const crumbs = crumbsOf(scope, locale);
  const structured = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: localizedUrl(crumb.path, locale) })) },
    ...(listings.length ? [{ "@context": "https://schema.org", "@type": "ItemList", name: regionHeading(scope.district || scope.city, locale, scope.purpose, scope.type), numberOfItems: listings.length,
      itemListElement: listings.map((item, index) => ({ "@type": "ListItem", position: index + 1, url: localizedUrl(`/ilan/${item.id}`, locale), name: localizedListingText(item, locale).title })) }] : []),
  ];
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}/>
    <RegionLanding scope={scope} path={path} crumbs={crumbs} summary={summary} prices={prices} listings={listings} demos={listings.length ? [] : regionDemos(scope, PUBLIC_DEMO_LISTINGS)} locale={locale}/>
  </>;
}
