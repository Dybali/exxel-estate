"use client";
import { ArrowRight, BadgeCheck, CheckCircle2, MapPinned, Store } from "lucide-react";
import Link from "@/components/SafeLink";
import { ServiceFinder } from "@/components/ServiceFinder";
import { ServiceFirmCard } from "@/components/ServiceFirmCard";
import { groupSearchHref, SERVICE_SIGNUP_HREF } from "@/components/ServiceHeader";
import { ServiceIcon } from "@/components/ServiceIcon";
import { useLocale } from "@/lib/i18n";
import { categoriesOf, SERVICE_CATEGORIES, SERVICE_GROUPS, type ServiceSlug } from "@/lib/service-categories";
import { SERVICE_SEARCH_PATH } from "@/lib/service-search";
import { servicePath, type ServiceFirm } from "@/lib/services";

/** Hizmet veren firmalar için davet (landing, results and category pages). */
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

function FirmSection({ id, title, text, firms, more }: { id: string; title: string; text: string; firms: ServiceFirm[]; more: string }) {
  const { t } = useLocale();
  if (!firms.length) return null;
  return <section className="container services-featured" aria-labelledby={id}>
    <div className="services-section-head svc-section-head">
      <div><h2 id={id}>{title}</h2><p>{text}</p></div>
      <Link href={more} className="svc-more">{t("Tümünü gör")}<ArrowRight size={15} aria-hidden="true"/></Link>
    </div>
    <div className="service-firm-grid">{firms.map((firm) => <ServiceFirmCard key={firm.id} firm={firm}/>)}</div>
  </section>;
}

export type ServiceStats = { firms: number; cities: number };

/** /hizmetler: search, figures, every group with its categories, featured and newest firms, provider invitation. */
export function ServicesLanding({ counts, featured, newest, stats }: { counts: Record<ServiceSlug, number>; featured: ServiceFirm[]; newest: ServiceFirm[]; stats: ServiceStats }) {
  const { t, locale } = useLocale(), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <main className="services-page services-landing">
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

    <div className="container">
      <dl className="svc-stats">
        <div><dt>{t("Onaylı firma")}</dt><dd>{number(stats.firms)}</dd></div>
        <div><dt>{t("Hizmet kategorisi")}</dt><dd>{number(SERVICE_CATEGORIES.length)}</dd></div>
        <div><dt>{t("Hizmet verilen il")}</dt><dd>{number(stats.cities)}<small> / 81</small></dd></div>
      </dl>
    </div>

    <div className="container services-groups">
      {SERVICE_GROUPS.map((group) => <section key={group.id} id={group.id} className="services-group" aria-labelledby={`${group.id}-title`}>
        <div className="svc-group-head">
          <h2 id={`${group.id}-title`}><span className="services-group-icon"><ServiceIcon name={group.icon} size={20}/></span>{t(group.name)}</h2>
          <Link href={groupSearchHref(group.id)} className="svc-more">{t("Tümünü gör")}<ArrowRight size={15} aria-hidden="true"/></Link>
        </div>
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

    <FirmSection id="services-featured-title" title={t("Öne çıkan firmalar")} text={t("Yönetici onayından geçmiş hizmet firmaları.")} firms={featured} more={SERVICE_SEARCH_PATH}/>
    <FirmSection id="services-newest-title" title={t("Yeni eklenen firmalar")} text={t("Hizmetler bölümüne en son katılan onaylı firmalar.")} firms={newest} more={`${SERVICE_SEARCH_PATH}?sirala=yeni`}/>

    <div className="container"><ServiceProviderCta/></div>
    <p className="container services-disclaimer">{t("estatemarket24 firmaları yayınlamadan önce bilgilerini inceler; ancak sunulan hizmetin taraflarından biri değildir. Fiyat ve iş koşullarını firmayla yazılı olarak netleştirin.")}</p>
  </main>;
}
