"use client";
import { Search } from "lucide-react";
import { ServiceCrumbs } from "@/components/ServiceCategoryPage";
import { ServiceResults, type ServiceResultsData } from "@/components/ServiceResults";
import { ServiceProviderCta } from "@/components/ServicesLanding";
import { useLocale } from "@/lib/i18n";
import { serviceCategory, type ServiceSlug } from "@/lib/service-categories";
import { serviceCrumbs } from "@/lib/service-copy";
import { SERVICE_SEARCH_PATH, type ServiceFilters } from "@/lib/service-search";

/** /hizmetler/ara: free search with every filter. */
export function ServiceSearchPage({ filters, results, counts }: { filters: ServiceFilters; results: ServiceResultsData; counts: Record<ServiceSlug, number> }) {
  const { t, locale } = useLocale();
  const crumbs = [...serviceCrumbs({}, locale), { name: t("Firma ara"), path: SERVICE_SEARCH_PATH }];
  const title = filters.q ? t("“{q}” için hizmet firmaları").replace("{q}", filters.q) : t("Hizmet firması ara");
  const scope = [...filters.categories.slice(0, 3).map((slug) => t(serviceCategory(slug)?.name || slug)), ...(filters.categories.length > 3 ? [`+${filters.categories.length - 3}`] : []), filters.district || filters.city].filter(Boolean).join(" · ");
  return <main className="services-page service-search-page">
    <header className="service-category-hero svc-search-hero"><div className="container">
      <ServiceCrumbs crumbs={crumbs}/>
      <div className="service-category-title">
        <span className="service-category-icon"><Search size={28} aria-hidden="true"/></span>
        <div>
          <h1 dir="auto">{title}</h1>
          <p>{scope || t("Türkiye'nin her ilinde yönetici onaylı hizmet firmalarını kategoriye, bölgeye ve firma adına göre arayın.")}</p>
        </div>
      </div>
    </div></header>
    <div className="container">
      <ServiceResults filters={filters} results={results} counts={counts}/>
      <ServiceProviderCta compact/>
    </div>
  </main>;
}
