"use client";
import { ArrowRight, Wrench } from "lucide-react";
import Link from "@/components/SafeLink";
import { ServiceIcon } from "@/components/ServiceIcon";
import { useLocale } from "@/lib/i18n";
import { FOREIGN_BUYER_SERVICES, listingServiceSlugs, serviceCategory } from "@/lib/service-categories";
import { SERVICE_BASE, servicePath } from "@/lib/services";

/** "Bu bölgede hizmetler" on listing pages: 4 categories that fit the listing, linked to the province page. */
export function ServiceSuggestions({ city, purpose, foreignSale }: { city: string; purpose: string; foreignSale: boolean }) {
  const { t, locale } = useLocale();
  const slugs = listingServiceSlugs(purpose, foreignSale || locale !== "tr");
  if (!slugs.length) return null;
  return <section className="property-section service-suggestions" aria-labelledby="service-suggestions-title">
    <h2 id="service-suggestions-title">{t("Bu bölgede hizmetler")}</h2>
    <p>{t(purpose === "kiralik" ? "Taşınırken ihtiyaç duyabileceğiniz hizmet firmaları" : "Satın alma sürecinde ihtiyaç duyabileceğiniz uzmanlar")}</p>
    <ul>{slugs.map((slug) => { const item = serviceCategory(slug)!; return <li key={slug}><Link href={servicePath(slug, city)}><ServiceIcon name={item.icon} size={18}/><span>{t(item.name)}</span><ArrowRight size={15} aria-hidden="true"/></Link></li>; })}</ul>
    <Link className="service-suggestions-all" href={SERVICE_BASE}><Wrench size={15} aria-hidden="true"/>{t("Tüm hizmetler")}</Link>
  </section>;
}

/** Legal and finance services on the foreign buyer guide (/yabanci-alici). */
export function ForeignBuyerServices() {
  const { t } = useLocale();
  return <section className="container foreign-buyer-services" aria-labelledby="foreign-buyer-services-title">
    <h2 id="foreign-buyer-services-title">{t("Yabancı alıcılar için uzmanlar")}</h2>
    <p>{t("Tapu işlemleri, sözleşme incelemesi, tercüme ve değerleme için Hizmetler bölümündeki onaylı firmalara ulaşın.")}</p>
    <ul className="services-tiles">{FOREIGN_BUYER_SERVICES.map((slug) => { const item = serviceCategory(slug)!; return <li key={slug}><Link href={servicePath(slug)} className="services-tile">
      <span className="services-tile-icon"><ServiceIcon name={item.icon}/></span><span className="services-tile-text"><strong>{t(item.name)}</strong><small>{t(item.description)}</small></span><ArrowRight className="services-tile-arrow" size={17} aria-hidden="true"/></Link></li>; })}</ul>
  </section>;
}
