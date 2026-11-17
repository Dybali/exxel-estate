import { locales, type Locale } from "./locales";
import { localizedUrl } from "./request-context";

/** JSON-LD for a <script type="application/ld+json">, with "<" escaped so page text cannot close the tag. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** schema.org BreadcrumbList repeating a page's visible breadcrumb; the last item is the page itself. */
export function breadcrumbStructuredData(items: { name: string; path?: string | null }[], locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, ...(item.path ? { item: localizedUrl(item.path, locale) } : {}) })),
  };
}

/** Site-wide Organization and WebSite (root layout), so search engines know the brand, its address and logo. */
export function siteStructuredData(base: string) {
  const url = base.replace(/\/$/, "") + "/", organization = url + "#organization";
  return [
    { "@context": "https://schema.org", "@type": "Organization", "@id": organization, name: "EstateMarket24", url, logo: url + "brand/logo-horizontal.svg" },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": url + "#website", name: "EstateMarket24", url, inLanguage: locales.map((item) => item.code), publisher: { "@id": organization } },
  ];
}
