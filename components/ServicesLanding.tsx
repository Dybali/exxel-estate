"use client";
import { ArrowRight, BadgeCheck, CheckCircle2, MapPinned, Store } from "lucide-react";
import Link from "@/components/SafeLink";
import { ServiceFinder } from "@/components/ServiceFinder";
import { ServiceFirmCard } from "@/components/ServiceFirmCard";
import { ServiceIcon } from "@/components/ServiceIcon";
import { useLocale } from "@/lib/i18n";
import { categoriesOf, SERVICE_GROUPS, type ServiceSlug } from "@/lib/service-categories";
import { servicePath, type ServiceFirm } from "@/lib/services";

export const SERVICE_SIGNUP_HREF = "/hesabim?tab=hizmet";

/** Hizmet veren firmalar için davet (landing and empty category pages). */
export function ServiceProviderCta({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  return <section className={compact ? "service-cta compact" : "service-cta"} aria-labelledby="service-cta-title">
    <div className="service-cta-text">
      <span className="service-kicker"><Store size={15} aria-hidden="true"/>{t("Hizmet veren misiniz?")}</span>
      <h2 id="service-cta-title">{t("Firmanızı ekleyin, bölgenizdeki ev sahiplerine ulaşın")}</h2>
      {!compact && <ul>
        <li><CheckCircle2 size={17} aria-hidden="true"/>{t("Firma profili ücretsizdir; hesap türünüz değişmez.")}</li>
        <li><CheckCircle2 size={17} aria-hidden="true"/>{t("Profiliniz yönetici onayından sonra yayınlanır.")}</li>
        <li><CheckCircle2 size={17} aria-hidden="true"/>{t("Müşteriler sizi telefon, WhatsApp veya e-posta ile doğrudan arar.")}</li>
      </ul>}
    </div>
    <Link href={SERVICE_SIGNUP_HREF} className="btn btn-accent service-cta-button">{t("Firmanızı ekleyin")}<ArrowRight size={17} aria-hidden="true"/></Link>
  </section>;
}

export function ServicesLanding({ counts, featured }: { counts: Record<ServiceSlug, number>; featured: ServiceFirm[] }) {
  const { t, locale } = useLocale(), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const total = featured.length;
  return <main className="services-page">
    <header className="services-hero">
      <div className="container services-hero-inner">
        <span className="service-kicker light">{t("ESTATEMARKET24 HİZMETLER")}</span>
        <h1>{t("Eviniz için güvenilir hizmet firmaları")}</h1>
        <p>{t("Tadilattan nakliyata, tapu işlemlerinden tatil evi yönetimine: Türkiye'nin her ilinde, yönetici onayından geçmiş firmaları bulun.")}</p>
        <ServiceFinder/>
        <ul className="services-hero-points">
          <li><BadgeCheck size={17} aria-hidden="true"/>{t("Yalnızca onaylı firmalar yayınlanır")}</li>
          <li><MapPinned size={17} aria-hidden="true"/>{t("81 ilde il ve ilçeye göre arama")}</li>
          <li><Store size={17} aria-hidden="true"/>{t("Firmalar için ücretsiz profil")}</li>
        </ul>
      </div>
    </header>

    <nav className="container services-group-nav" aria-label={t("Hizmet grupları")}>
      {SERVICE_GROUPS.map((group) => <a key={group.id} href={`#${group.id}`}><ServiceIcon name={group.icon} size={16}/>{t(group.name)}</a>)}
    </nav>

    <div className="container services-groups">
      {SERVICE_GROUPS.map((group) => <section key={group.id} id={group.id} className="services-group" aria-labelledby={`${group.id}-title`}>
        <h2 id={`${group.id}-title`}><span className="services-group-icon"><ServiceIcon name={group.icon} size={20}/></span>{t(group.name)}</h2>
        <ul className="services-tiles">{categoriesOf(group.id).map((category) => {
          const count = counts[category.slug as ServiceSlug] || 0;
          return <li key={category.slug}><Link href={servicePath(category.slug)} className="services-tile">
            <span className="services-tile-icon"><ServiceIcon name={category.icon}/></span>
            <span className="services-tile-text"><strong>{t(category.name)}</strong><small>{t(category.description)}</small>
              <em className={count ? "has-firms" : ""}>{count ? t("{n} onaylı firma").replace("{n}", number(count)) : t("Bu kategoride ilk firma siz olun")}</em></span>
            <ArrowRight className="services-tile-arrow" size={17} aria-hidden="true"/>
          </Link></li>;
        })}</ul>
      </section>)}
    </div>

    {total > 0 && <section className="container services-featured" aria-labelledby="services-featured-title">
      <div className="services-section-head"><h2 id="services-featured-title">{t("Öne çıkan firmalar")}</h2><p>{t("Yönetici onayından geçmiş hizmet firmaları.")}</p></div>
      <div className="service-firm-grid">{featured.map((firm) => <ServiceFirmCard key={firm.id} firm={firm}/>)}</div>
    </section>}

    <div className="container"><ServiceProviderCta/></div>
    <p className="container services-disclaimer">{t("estatemarket24 firmaları yayınlamadan önce bilgilerini inceler; ancak sunulan hizmetin taraflarından biri değildir. Fiyat ve iş koşullarını firmayla yazılı olarak netleştirin.")}</p>
  </main>;
}
