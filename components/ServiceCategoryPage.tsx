"use client";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "@/components/SafeLink";
import { ServiceFinder } from "@/components/ServiceFinder";
import { ServiceFirmCard } from "@/components/ServiceFirmCard";
import { ServiceIcon } from "@/components/ServiceIcon";
import { ServiceProviderCta } from "@/components/ServicesLanding";
import { useLocale } from "@/lib/i18n";
import { categoriesOf, serviceCategory, serviceGroup } from "@/lib/service-categories";
import { serviceCrumbs, serviceHeading } from "@/lib/service-copy";
import { SERVICE_BASE, servicePath, type ServiceFirm, type ServicePlaceLink, type ServiceScope, type ServiceSummary } from "@/lib/services";

function Chips({ links, label }: { links: ServicePlaceLink[]; label: (link: ServicePlaceLink) => string }) {
  const { locale } = useLocale();
  return <ul className="region-chips">{links.map((link) => <li key={link.path}><Link href={link.path} className="region-chip"><span>{label(link)}</span><b>{new Intl.NumberFormat(locale).format(link.count)}</b></Link></li>)}</ul>;
}

/** Category and region page (/hizmetler/{kategori}[/{il}[/{ilçe}]]), rendered from server data. */
export function ServiceCategoryPage({ scope, summary, firms }: { scope: ServiceScope; summary: ServiceSummary; firms: ServiceFirm[] }) {
  const { t, locale } = useLocale(), crumbs = serviceCrumbs(scope, locale);
  const category = serviceCategory(scope.category)!, group = serviceGroup(category.group);
  const place = scope.district || scope.city, heading = serviceHeading(scope.category, locale, place);
  const broader = scope.district ? servicePath(scope.category, scope.city) : scope.city ? servicePath(scope.category) : null;
  const related = categoriesOf(category.group).filter((item) => item.slug !== category.slug);
  return <main className="services-page service-category-page">
    <div className="container">
      <nav className="property-breadcrumb region-breadcrumb" aria-label={t("Sayfa konumu")}><ol>
        {crumbs.map((crumb, index) => <li key={crumb.path}>{index > 0 && <ChevronRight size={13} aria-hidden="true"/>}
          {index === crumbs.length - 1 ? <span aria-current="page">{crumb.name}</span> : <Link href={crumb.path}>{crumb.name}</Link>}</li>)}
      </ol></nav>
    </div>
    <header className="service-category-hero"><div className="container">
      <div className="service-category-title">
        <span className="service-category-icon"><ServiceIcon name={category.icon} size={30}/></span>
        <div>
          {group && <span className="service-kicker">{t(group.name)}</span>}
          <h1>{heading}</h1>
          <p>{t(category.description)}</p>
        </div>
      </div>
      <p className="service-category-count"><strong>{new Intl.NumberFormat(locale).format(summary.count)}</strong> {t("onaylı firma")}{place ? ` · ${place}` : ""}</p>
      <ServiceFinder compact category={scope.category} city={scope.city || ""} district={scope.district || ""}/>
    </div></header>

    <div className="container">
      <section className="services-results" aria-labelledby="services-results-title">
        <h2 id="services-results-title" className="sr-only">{t("Firmalar")}</h2>
        {firms.length > 0
          ? <div className="service-firm-grid">{firms.map((firm) => <ServiceFirmCard key={firm.id} firm={firm} highlight={scope.category}/>)}</div>
          : <div className="service-empty">
              <span className="services-tile-icon"><ServiceIcon name={category.icon}/></span>
              <div>
                <p><strong>{t("Bu bölgede bu hizmet için henüz onaylı firma yok.")}</strong></p>
                <p>{t("Firmalar yönetici onayından sonra burada listelenir. Daha geniş bir bölgeye bakabilir ya da bu hizmeti veriyorsanız ilk firma olabilirsiniz.")}</p>
                {broader && <Link href={broader} className="btn btn-secondary btn-sm">{t("Daha geniş bölgede ara")}<ArrowRight size={15} aria-hidden="true"/></Link>}
              </div>
            </div>}
      </section>

      {!scope.city && summary.cities.length > 0 && <nav className="region-section" aria-labelledby="service-cities-title">
        <h2 id="service-cities-title">{t("İllere göre")}</h2>
        <Chips links={summary.cities} label={(link) => link.city}/>
      </nav>}
      {scope.city && summary.districts.length > 0 && <nav className="region-section" aria-labelledby="service-districts-title">
        <h2 id="service-districts-title">{t("İlçelere göre")}</h2>
        <Chips links={summary.districts} label={(link) => link.district}/>
      </nav>}

      {related.length > 0 && <nav className="region-section" aria-labelledby="service-related-title">
        <h2 id="service-related-title">{t("Benzer hizmetler")}</h2>
        <ul className="service-related">{related.map((item) => <li key={item.slug}><Link href={servicePath(item.slug, scope.city, scope.district)}><ServiceIcon name={item.icon} size={17}/>{t(item.name)}</Link></li>)}</ul>
      </nav>}

      <ServiceProviderCta compact={firms.length > 0}/>
      <p className="region-up"><Link href={SERVICE_BASE}>{t("Tüm hizmet kategorileri")}<ArrowRight size={15} aria-hidden="true"/></Link></p>
    </div>
  </main>;
}
