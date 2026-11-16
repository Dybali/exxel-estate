"use client";
import { useEffect } from "react";
import { trackFirmEvent } from "@/lib/firm-track-client";
import { ArrowRight, Building2, CalendarDays, ChevronRight, Clock, ExternalLink, FileBadge, Flag, FlaskConical, Globe, Handshake, HardHat, Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
import Link from "@/components/SafeLink";
import { specialtyHref } from "@/components/ContractorChrome";
import { ContractorSampleBadge, ContractorVerifiedBadge } from "@/components/ContractorDirectory";
import { useLocale } from "@/lib/i18n";
import { FirmMessage } from "@/components/FirmMessage";
import { whatsappHref } from "@/lib/phone";
import { CONTRACTOR_BASE, CONTRACTOR_STATUS_LABELS, LAND_PATH, specialtyName, type ContractorFirm, type ContractorListing } from "@/lib/contractors";

/** Public contractor profile (/muteahhitler/firma/{id}); the owner and administrators also see it before approval. */
export function ContractorProfile({ firm, listings, messaging = false }: { firm: ContractorFirm; listings: ContractorListing[]; messaging?: boolean }) {
  const { t, locale } = useLocale();
  const live = firm.status === "approved" && !firm.sample;
  const whatsapp = firm.whatsapp ? `${whatsappHref(firm.whatsapp)}?text=${encodeURIComponent(t("Merhaba, firmanızı estatemarket24'te gördüm."))}` : null;
  // Profile statistics of the firm (Müteahhitler › Firma panelim › İstatistikler); samples are never counted.
  const track = (kind: "view" | "phone" | "whatsapp" | "email" | "website") => { if (!firm.sample) trackFirmEvent("contractors", firm.id, kind); };
  useEffect(() => { if (!firm.sample) trackFirmEvent("contractors", firm.id, "view"); }, [firm.id, firm.sample]);
  const website = firm.website ? (() => { try { return new URL(firm.website).hostname.replace(/^www\./, ""); } catch { return firm.website; } })() : null;
  const units = firm.projects.reduce((sum, project) => sum + (project.units || 0), 0), number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <main className="services-page service-profile-page ctr-profile">
    <div className="container">
      <nav className="property-breadcrumb region-breadcrumb" aria-label={t("Sayfa konumu")}><ol>
        <li><Link href={CONTRACTOR_BASE}>{t("Müteahhitler")}</Link></li>
        {firm.specialties[0] && <li><ChevronRight size={13} aria-hidden="true"/><Link href={specialtyHref(firm.specialties[0])}>{t(specialtyName(firm.specialties[0]))}</Link></li>}
        <li><ChevronRight size={13} aria-hidden="true"/><span aria-current="page">{firm.name}</span></li>
      </ol></nav>
      {firm.sample && <div className="service-sample-banner" role="note"><FlaskConical size={20} aria-hidden="true"/><p><strong>{t("Örnek firma — bu profil sitenin nasıl görüneceğini göstermek içindir.")}</strong> {t("Gerçek bir firma değildir; iletişim bilgisi yoktur ve sayımlara dahil edilmez.")}</p></div>}
      {firm.status !== "approved" && <div className="service-preview-note" role="status"><Clock size={17} aria-hidden="true"/>{t("Önizleme: bu profil herkese açık değil.")} <strong>{t(CONTRACTOR_STATUS_LABELS[firm.status])}</strong></div>}
    </div>
    <header className="service-profile-head container">
      <div className={firm.cover ? "service-profile-cover" : "service-profile-cover empty"}>{firm.cover ? <img src={firm.cover} alt=""/> : <HardHat size={54} aria-hidden="true"/>}</div>
      <div className="service-profile-identity">
        <span className="service-profile-logo">{firm.logo ? <img src={firm.logo} alt={firm.name}/> : <b>{firm.name.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
        <div>
          <h1>{firm.name}</h1>
          <div className="service-profile-badges">{firm.sample && <ContractorSampleBadge className="inline"/>}{firm.verified && <ContractorVerifiedBadge/>}{firm.landDeals && <span className="ctr-land-badge"><Handshake size={14} aria-hidden="true"/>{t("Kat karşılığı çalışır")}</span>}{live && <span className="service-approved-note">{t("Yönetici onaylı profil")}</span>}</div>
        </div>
      </div>
    </header>
    <div className="container service-profile-layout">
      <article className="service-profile-main">
        <dl className="ctr-facts">
          {firm.foundedYear && <div><dt><CalendarDays size={16} aria-hidden="true"/>{t("Kuruluş yılı")}</dt><dd>{firm.foundedYear}</dd></div>}
          <div><dt><Building2 size={16} aria-hidden="true"/>{t("Tamamlanan proje")}</dt><dd>{number(firm.projects.length)}</dd></div>
          {units > 0 && <div><dt><HardHat size={16} aria-hidden="true"/>{t("Teslim edilen bağımsız bölüm")}</dt><dd>{number(units)}</dd></div>}
          {firm.licenseNumber && <div><dt><FileBadge size={16} aria-hidden="true"/>{t("Yetki belgesi no")}</dt><dd><bdi>{firm.licenseNumber}</bdi></dd></div>}
        </dl>
        <section className="service-profile-section"><h2>{t("Firma hakkında")}</h2><p className="service-profile-text" dir="auto">{firm.description}</p></section>
        <section className="service-profile-section"><h2>{t("Uzmanlık alanları")}</h2>
          <ul className="service-related">{firm.specialties.map((slug) => <li key={slug}><Link href={specialtyHref(slug)}><HardHat size={16} aria-hidden="true"/>{t(specialtyName(slug))}</Link></li>)}</ul>
        </section>
        <section className="service-profile-section"><h2>{t("Çalıştığı bölgeler")}</h2>
          <ul className="service-areas">{firm.areas.map((area) => <li key={`${area.city}|${area.district}`}><MapPin size={15} aria-hidden="true"/>
            <Link href={`${CONTRACTOR_BASE}?il=${encodeURIComponent(area.city)}#sonuclar`}>{area.district ? `${area.district}, ${area.city}` : `${area.city} (${t("tüm il")})`}</Link></li>)}</ul>
        </section>
        {listings.length > 0 && <section className="service-profile-section"><h2>{t("Satıştaki projeleri")}</h2>
          <ul className="ctr-listings">{listings.map((item) => <li key={item.id}><Link href={`/projeler/${item.id}`}>
            {item.image ? <img src={item.image} alt="" loading="lazy"/> : <span className="ctr-listing-placeholder"><Building2 size={22} aria-hidden="true"/></span>}
            <span><strong>{item.name}</strong><small>{item.district ? `${item.district}, ${item.city}` : item.city}{item.deliveryDate ? ` · ${t("Teslim")}: ${item.deliveryDate}` : ""}</small></span><ArrowRight size={16} aria-hidden="true"/>
          </Link></li>)}</ul>
        </section>}
        <section className="service-profile-section"><h2>{t("Tamamlanan projeler")}</h2>
          {firm.projects.length ? <ul className="ctr-projects">{firm.projects.map((project) => <li key={project.id} className="ctr-project">
            {project.photos.length > 0 && <div className="ctr-project-photos">{project.photos.map((photo, index) => <a key={photo} href={photo} target="_blank" rel="noopener noreferrer" aria-label={t("Fotoğraf {n}").replace("{n}", String(index + 1))}><img src={photo} alt="" loading="lazy"/></a>)}</div>}
            <div className="ctr-project-body">
              <h3 dir="auto">{project.title}</h3>
              <p className="ctr-project-meta"><span>{t(specialtyName(project.kind))}</span><span><MapPin size={13} aria-hidden="true"/>{project.district ? `${project.district}, ${project.city}` : project.city}</span><span>{project.year}</span>{project.units ? <span>{t("{n} bağımsız bölüm").replace("{n}", number(project.units))}</span> : null}</p>
              {project.description && <p dir="auto">{project.description}</p>}
            </div>
          </li>)}</ul> : <p className="project-editor-note">{t("Firma henüz tamamlanan proje eklemedi.")}</p>}
        </section>
      </article>
      <aside className="service-contact-card" aria-labelledby="ctr-contact-title">
        <h2 id="ctr-contact-title">{t("Firmayla iletişim")}</h2>
        {firm.sample ? <>
          <p className="service-sample-contact"><FlaskConical size={16} aria-hidden="true"/>{t("Örnek firma — iletişim bilgisi yok")}</p>
          <button type="button" className="btn btn-primary btn-block" disabled aria-disabled="true"><Phone size={17} aria-hidden="true"/><span>{t("Ara")}</span></button>
        </> : <>
          {live && firm.landDeals && <Link className="btn btn-accent btn-block" href={`${LAND_PATH}?firma=${firm.id}`}><Send size={17} aria-hidden="true"/>{t("Bu firmadan kat karşılığı teklif iste")}</Link>}
          <a className="btn btn-primary btn-block" href={`tel:${firm.phone}`} onClick={() => track("phone")}><Phone size={17} aria-hidden="true"/><span>{t("Ara")}</span><bdi>{firm.phone}</bdi></a>
          {whatsapp && <a className="btn btn-block service-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={() => track("whatsapp")}><MessageCircle size={17} aria-hidden="true"/>{t("WhatsApp’tan yaz")}</a>}
          {live && messaging && <FirmMessage kind="contractor" firmId={firm.id}/>}
          {firm.email && <a className="btn btn-secondary btn-block" href={`mailto:${firm.email}`} onClick={() => track("email")}><Mail size={17} aria-hidden="true"/>{t("E-posta gönder")}</a>}
          {firm.website && <a className="btn btn-secondary btn-block" href={firm.website} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={() => track("website")}><Globe size={17} aria-hidden="true"/><bdi>{website}</bdi><ExternalLink size={14} aria-hidden="true"/></a>}
          <p className="service-contact-note">{t("Kat karşılığı anlaşmalarını noter onaylı sözleşmeyle yapın; yetki belgesini Bakanlığın sisteminden kontrol edin. estatemarket24 sözleşmenin tarafı değildir.")}</p>
          <Link className="service-report" href="/iletisim"><Flag size={14} aria-hidden="true"/>{t("Bu profille ilgili sorun bildir")}</Link>
        </>}
      </aside>
    </div>
    <div className="container"><p className="region-up"><Link href={CONTRACTOR_BASE}>{t("Tüm müteahhitler")}<ArrowRight size={15} aria-hidden="true"/></Link></p></div>
  </main>;
}
