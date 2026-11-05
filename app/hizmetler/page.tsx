import { ServicesLanding } from "@/components/ServicesLanding";
import { SERVICE_CATEGORIES, type ServiceSlug } from "@/lib/service-categories";
import { serviceCrumbs, serviceName } from "@/lib/service-copy";
import { categoryCounts, featuredFirms, newestFirms, servicePath, serviceStats, type ServiceFirm } from "@/lib/services";
import { servicesDB } from "@/lib/services-server";
import { localizedUrl, requestLocale } from "@/lib/request-context";
import { translate } from "@/lib/i18n-dictionary";

// Title, description and link preview come from lib/seo-copy.ts ("/hizmetler") through the root layout.
export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const locale = await requestLocale(), db = servicesDB();
  // A database problem leaves the category directory usable (every tile then invites the first firm).
  const [counts, featured, newest, stats] = await Promise.all([
    categoryCounts(db).catch(() => Object.fromEntries(SERVICE_CATEGORIES.map((item) => [item.slug, 0])) as Record<ServiceSlug, number>),
    featuredFirms(db).catch(() => [] as ServiceFirm[]),
    newestFirms(db).catch(() => [] as ServiceFirm[]),
    serviceStats(db).catch(() => ({ firms: 0, cities: 0 })),
  ]);
  const structured = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: serviceCrumbs({}, locale).map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.name, item: localizedUrl(crumb.path, locale) })) },
    { "@context": "https://schema.org", "@type": "ItemList", name: translate("Hizmetler", locale), numberOfItems: SERVICE_CATEGORIES.length,
      itemListElement: SERVICE_CATEGORIES.map((item, index) => ({ "@type": "ListItem", position: index + 1, url: localizedUrl(servicePath(item.slug), locale), name: serviceName(item.slug, locale) })) },
  ];
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, "\\u003c") }}/>
    <ServicesLanding counts={counts} featured={featured} newest={newest} stats={stats}/>
  </>;
}
