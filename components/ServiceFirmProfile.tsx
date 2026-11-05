"use client";
import { ArrowRight, ChevronRight, Clock, ExternalLink, Flag, Globe, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "@/components/SafeLink";
import { ServiceFirmCard, ServiceVerifiedBadge } from "@/components/ServiceFirmCard";
import { ServiceIcon } from "@/components/ServiceIcon";
import { useLocale } from "@/lib/i18n";
import { whatsappHref } from "@/lib/phone";
import { serviceCategory } from "@/lib/service-categories";
import { firmDescription, SERVICE_BASE, SERVICE_STATUS_LABELS, servicePath, type ServiceFirm } from "@/lib/services";

/** Public firm profile (/hizmetler/firma/{id}); the owner and administrators also see it before approval. */
export function ServiceFirmProfile({ firm, similar = [] }: { firm: ServiceFirm; similar?: ServiceFirm[] }) {
  const { t, locale } = useLocale();
  const first = serviceCategory(firm.categories[0]), text = firmDescription(firm, locale);
  const whatsapp = firm.whatsapp ? `${whatsappHref(firm.whatsapp)}?text=${encodeURIComponent(t("Merhaba, firmanızı estatemarket24'te gördüm."))}` : null;
  const website = firm.website ? (() => { try { return new URL(firm.website).hostname.replace(/^www\./, ""); } catch { return firm.website; } })() : null;
  return <main className="services-page service-profile-page">
    <div className="container">
      <nav className="property-breadcrumb region-breadcrumb" aria-label={t("Sayfa konumu")}><ol>
        <li><Link href={SERVICE_BASE}>{t("Hizmetler")}</Link></li>
        {first && <li><ChevronRight size={13} aria-hidden="true"/><Link href={servicePath(first.slug)}>{t(first.name)}</Link></li>}
        <li><ChevronRight size={13} aria-hidden="true"/><span aria-current="page">{firm.name}</span></li>
      </ol></nav>
      {firm.status !== "approved" && <div className="service-preview-note" role="status"><Clock size={17} aria-hidden="true"/>{t("Önizleme: bu profil herkese açık değil.")} <strong>{t(SERVICE_STATUS_LABELS[firm.status])}</strong></div>}
    </div>
    <header className="service-profile-head container">
      <div className={firm.cover ? "service-profile-cover" : "service-profile-cover empty"}>{firm.cover ? <img src={firm.cover} alt=""/> : first && <ServiceIcon name={first.icon} size={54}/>}</div>
      <div className="service-profile-identity">
        <span className="service-profile-logo">{firm.logo ? <img src={firm.logo} alt={firm.name}/> : <b>{firm.name.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
        <div>
          <h1>{firm.name}</h1>
          <div className="service-profile-badges">{firm.verified && <ServiceVerifiedBadge/>}{firm.status === "approved" && <span className="service-approved-note">{t("Yönetici onaylı profil")}</span>}</div>
        </div>
      </div>
    </header>
    <div className="container service-profile-layout">
      <article className="service-profile-main">
        <section className="service-profile-section"><h2>{t("Firma hakkında")}</h2><p className="service-profile-text" dir="auto">{text}</p></section>
        <section className="service-profile-section"><h2>{t("Verdiği hizmetler")}</h2>
          <ul className="service-related">{firm.categories.map((slug) => { const item = serviceCategory(slug); return item && <li key={slug}><Link href={servicePath(slug)}><ServiceIcon name={item.icon} size={17}/>{t(item.name)}</Link></li>; })}</ul>
        </section>
        <section className="service-profile-section"><h2>{t("Hizmet bölgeleri")}</h2>
          <ul className="service-areas">{firm.areas.map((area) => <li key={`${area.city}|${area.district}`}><MapPin size={15} aria-hidden="true"/>
            {first ? <Link href={servicePath(first.slug, area.city, area.district || null)}>{area.district ? `${area.district}, ${area.city}` : `${area.city} (${t("tüm il")})`}</Link> : <span>{area.city}</span>}</li>)}</ul>
        </section>
        {firm.photos.length > 0 && <section className="service-profile-section"><h2>{t("İş örnekleri")}</h2>
          <ul className="service-photos">{firm.photos.map((photo, index) => <li key={photo}><a href={photo} target="_blank" rel="noopener noreferrer" aria-label={t("Fotoğraf {n}").replace("{n}", String(index + 1))}><img src={photo} alt="" loading="lazy"/></a></li>)}</ul>
        </section>}
      </article>
      <aside className="service-contact-card" aria-labelledby="service-contact-title">
        <h2 id="service-contact-title">{t("Firmayla iletişim")}</h2>
        <a className="btn btn-primary btn-block" href={`tel:${firm.phone}`}><Phone size={17} aria-hidden="true"/><span>{t("Ara")}</span><bdi>{firm.phone}</bdi></a>
        {whatsapp && <a className="btn btn-block service-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden="true"/>{t("WhatsApp’tan yaz")}</a>}
        {firm.email && <a className="btn btn-secondary btn-block" href={`mailto:${firm.email}`}><Mail size={17} aria-hidden="true"/>{t("E-posta gönder")}</a>}
        {firm.website && <a className="btn btn-secondary btn-block" href={firm.website} target="_blank" rel="noopener noreferrer nofollow ugc"><Globe size={17} aria-hidden="true"/><bdi>{website}</bdi><ExternalLink size={14} aria-hidden="true"/></a>}
        <p className="service-contact-note">{t("Fiyat ve iş koşullarını firmayla yazılı olarak netleştirin. estatemarket24 hizmetin tarafı değildir.")}</p>
        <Link className="service-report" href="/iletisim"><Flag size={14} aria-hidden="true"/>{t("Bu profille ilgili sorun bildir")}</Link>
      </aside>
    </div>
    {similar.length > 0 && <section className="container services-featured svc-similar" aria-labelledby="svc-similar-title">
      <div className="services-section-head"><h2 id="svc-similar-title">{t("Benzer firmalar")}</h2>{first && <p>{t(first.name)}</p>}</div>
      <div className="service-firm-grid">{similar.map((item) => <ServiceFirmCard key={item.id} firm={item} highlight={first?.slug}/>)}</div>
    </section>}
    <div className="container"><p className="region-up"><Link href={SERVICE_BASE}>{t("Tüm hizmet kategorileri")}<ArrowRight size={15} aria-hidden="true"/></Link></p></div>
  </main>;
}
