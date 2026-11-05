import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { ServiceSearchPage } from "@/components/ServiceSearchPage";
import { translate } from "@/lib/i18n-dictionary";
import { pageAlternates, requestLocale } from "@/lib/request-context";
import { isCanonicalServiceScope, parseServiceFilters, SERVICE_SEARCH_PATH, serviceQuery, serviceSearchHref, withLang } from "@/lib/service-search";
import { categoryCounts, searchFirms } from "@/lib/services";
import { servicesDB } from "@/lib/services-server";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<Search> };

// Free search over every approved firm. Filters are address parameters (lib/service-search.ts), so
// result pages can be shared; they are never indexed (the category/region pages are), links are followed.
const load = cache(async (key: string) => {
  const filters = parseServiceFilters(new URLSearchParams(key)), db = servicesDB();
  const query = serviceQuery(filters);
  // Category counts follow every other filter, so each checkbox shows what choosing it would add.
  const [results, counts] = await Promise.all([searchFirms(db, query), categoryCounts(db, { q: query.q, city: query.city, district: query.district, verified: query.verified, photos: query.photos })]);
  return { filters, results, counts };
});
const keyOf = async ({ searchParams }: Props) => {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(name, item);
  return params.toString();
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const locale = await requestLocale(), { filters, results } = await load(await keyOf(props));
  const title = filters.q ? translate("“{q}” için hizmet firmaları", locale).replace("{q}", filters.q) : translate("Hizmet firması ara", locale);
  const page = results.page > 1 ? ` · ${translate("Sayfa {n}", locale).replace("{n}", String(results.page))}` : "";
  return {
    title: `${title}${page} | estatemarket24`,
    description: translate("Türkiye'nin her ilinde yönetici onaylı hizmet firmalarını kategoriye, bölgeye ve firma adına göre arayın.", locale),
    alternates: await pageAlternates(SERVICE_SEARCH_PATH),
    robots: { index: false, follow: true },
  };
}

export default async function ServiceSearchRoute(props: Props) {
  const key = await keyOf(props), { filters, results, counts } = await load(key);
  const lang = new URLSearchParams(key).get("lang");
  // Exactly one category (and place) has its own indexable page with the same results.
  if (isCanonicalServiceScope(filters)) redirect(withLang(serviceSearchHref(filters), lang));
  if (filters.page > results.pages) notFound();
  return <ServiceSearchPage filters={filters} results={results} counts={counts}/>;
}
