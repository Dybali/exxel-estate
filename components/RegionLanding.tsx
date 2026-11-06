import { ArrowRight, ChevronRight, MapPin, Search } from "lucide-react";
import Link from "@/components/SafeLink";
import { ListingCard } from "@/components/ListingCard";
import { translate, type Locale } from "@/lib/i18n-dictionary";
import { typeLabel, type Listing } from "@/lib/listings";
import { pricePeriod } from "@/lib/property-categories";
import { regionHeading, regionPhrase } from "@/lib/region-copy";
import { DisplayMoney, RateSource } from "@/components/DisplayCurrency";
import { regionSearchHref, REGION_LISTING_LIMIT, type RegionLink, type RegionPriceStats, type RegionScope, type RegionSummary } from "@/lib/region-pages";

export type RegionCrumb = { name: string; path: string };


function Chips({ links, current, label, locale }: { links: RegionLink[]; current: string; label: (link: RegionLink) => string; locale: Locale }) {
  return <ul className="region-chips">{links.map((link) => <li key={link.path}>
    <Link href={link.path} className={link.path === current ? "region-chip active" : "region-chip"} aria-current={link.path === current ? "page" : undefined}>
      <span>{label(link)}</span><b>{new Intl.NumberFormat(locale).format(link.count)}</b>
    </Link></li>)}</ul>;
}

/** Server-rendered region landing page (app/emlak/[...slug]/page.tsx, lib/region-pages.ts). */
export function RegionLanding({ scope, path, crumbs, summary, prices, listings, demos, locale }: {
  scope: RegionScope; path: string; crumbs: RegionCrumb[]; summary: RegionSummary; prices: RegionPriceStats | null; listings: Listing[]; demos: Listing[]; locale: Locale;
}) {
  const t = (key: string) => translate(key, locale), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const place = scope.district || scope.city, heading = regionHeading(place, locale, scope.purpose, scope.type), search = regionSearchHref(scope);
  const period = scope.purpose ? pricePeriod(scope.purpose) : "", suffix = period ? ` ${t(period)}` : "";
  const topTypes = scope.type ? [] : summary.types.slice(0, 3);
  const cityPath = crumbs[1]?.path;
  return <main className="region-page"><div className="container">
    <nav className="property-breadcrumb region-breadcrumb" aria-label={t("Sayfa konumu")}><ol>
      {crumbs.map((crumb, index) => <li key={crumb.path}>{index > 0 && <ChevronRight size={13} aria-hidden="true"/>}
        {index === crumbs.length - 1 ? <span aria-current="page">{crumb.name}</span> : <Link href={crumb.path}>{crumb.name}</Link>}</li>)}
    </ol></nav>

    <header className="region-hero">
      <span className="market-overline"><MapPin size={14} aria-hidden="true"/>{scope.district ? `${scope.district}, ${scope.city}` : scope.city}</span>
      <h1>{heading}</h1>
      <p className="region-intro">{t("{heading}: estatemarket24'te şu anda yayında olan ilanlar. Sayılar ve fiyatlar yalnızca bu ilanlardan hesaplanır; örnek ilanlar dahil edilmez.").replace("{heading}", heading)}</p>
      <dl className="region-facts">
        <div><dt>{t("Aktif ilan")}</dt><dd>{number(summary.count)}</dd></div>
        {prices && <div><dt>{t("Fiyat aralığı")}</dt><dd><DisplayMoney value={prices.min} currency={prices.currency}/> – <DisplayMoney value={prices.max} currency={prices.currency}/>{suffix}</dd></div>}
        {prices?.medianPerSqm != null && <div><dt>{t("Medyan m² fiyatı")}</dt><dd><DisplayMoney value={prices.medianPerSqm} currency={prices.currency}/> / m²{suffix}</dd></div>}
        {topTypes.length > 0 && <div><dt>{t("En çok ilan verilen türler")}</dt><dd>{topTypes.map((item) => `${t(typeLabel(item.type))} (${number(item.count)})`).join(", ")}</dd></div>}
      </dl>
      {prices && <p className="region-note">{t("Fiyat bilgileri ilanların TL esas fiyatlarından hesaplanır (ilan sayısı: {count}).").replace("{count}", number(prices.listings))}</p>}
      {prices && <RateSource currency={prices.currency}/>}
    </header>

    {summary.combos.length > 0 && <nav className="region-section" aria-labelledby="region-types-heading">
      <h2 id="region-types-heading">{t("İlan türüne göre")}</h2>
      <Chips links={summary.combos} current={path} locale={locale} label={(link) => regionPhrase(locale, link.scope.purpose, link.scope.type)}/>
    </nav>}

    <section className="region-section region-listings" aria-labelledby="region-listings-heading">
      <div className="market-section-head region-listings-head">
        <h2 id="region-listings-heading">{t("Bu bölgedeki ilanlar")}</h2>
        <Link href={search} className="btn btn-secondary btn-sm region-more">{t("Tümünü gör")}{summary.count > REGION_LISTING_LIMIT ? ` (${number(summary.count)})` : ""}<ArrowRight size={16} aria-hidden="true"/></Link>
      </div>
      {listings.length > 0
        ? <div className="market-feature-grid region-grid">{listings.map((item, index) => <ListingCard key={item.id} listing={item} priority={index < 2}/>)}</div>
        : <div className="region-empty">
            <p><strong>{t("Bu kriterlere uyan aktif ilan şu anda yok.")}</strong></p>
            <p>{t("Yeni ilanlar yayınlandığında burada listelenir. Aşağıdaki bağlantılarla diğer ilan türlerine ve ilçelere göz atabilir ya da tüm ilanlarda arama yapabilirsiniz.")}</p>
            <div className="region-empty-actions">
              <Link href="/ilanlar" className="btn btn-primary btn-sm"><Search size={16} aria-hidden="true"/>{t("Tüm ilanlarda ara")}</Link>
              {cityPath && cityPath !== path && <Link href={cityPath} className="btn btn-secondary btn-sm">{t("{name} genelindeki ilanlar").replace("{name}", scope.city)}</Link>}
            </div>
          </div>}
      {listings.length === 0 && demos.length > 0 && <div className="region-demos">
        <h3>{t("Örnek ilanlar")}</h3>
        <p className="property-example-note">{t("Bu bölgede gerçek ilan olmadığı için örnek ilanlar gösteriliyor. Örnek ilanlar gerçek bir satış veya kiralama teklifi değildir ve sayımlara dahil edilmez.")}</p>
        <div className="market-feature-grid region-grid">{demos.slice(0, 8).map((item) => <ListingCard key={item.id} listing={item}/>)}</div>
      </div>}
    </section>

    {summary.districts.length > 0 && <nav className="region-section" aria-labelledby="region-districts-heading">
      <h2 id="region-districts-heading">{t("İlçelere göre")}</h2>
      <Chips links={summary.districts} current={path} locale={locale} label={(link) => link.scope.district || ""}/>
    </nav>}

    {scope.district && cityPath && <p className="region-up"><Link href={cityPath}>{t("{name} genelindeki ilanlar").replace("{name}", scope.city)}<ArrowRight size={15} aria-hidden="true"/></Link></p>}
  </div></main>;
}
