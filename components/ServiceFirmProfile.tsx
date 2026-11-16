"use client";
import { ArrowRight, CalendarClock, ChevronRight, Clock, ExternalLink, FlaskConical, Flag, Globe, Mail, MapPin, MessageCircle, Phone, Send, Siren, Tag, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ServiceDocumentedBadge, ServiceEmergencyBadge, ServiceFirmCard, ServiceSampleBadge, ServiceVerifiedBadge } from "@/components/ServiceFirmCard";
import { ServiceIcon } from "@/components/ServiceIcon";
import { FirmMessage } from "@/components/FirmMessage";
import { useLocale } from "@/lib/i18n";
import { whatsappHref } from "@/lib/phone";
import { serviceCategory } from "@/lib/service-categories";
import { istanbulClock, openNow, SERVICE_PRICE_UNITS, SERVICE_WEEKDAYS, type ServiceDetails } from "@/lib/service-extras";
import { firmDescription, quoteHref, SERVICE_BASE, SERVICE_STATUS_LABELS, servicePath, type ServiceFirm } from "@/lib/services";

/** Counts a profile view or contact click (daily totals only, app/api/services/track). */
export function trackService(firmId: string, kind: "view" | "phone" | "whatsapp" | "email" | "website") {
  try { void fetch("/api/services/track", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firmId, kind }) }).catch(() => {}); } catch { /* Statistics never block the visitor. */ }
}

/** "Çalışma bilgileri": 7/24, typical answer time, price range and the weekly hours. */
function ServiceWorkInfo({ details, responseHours }: { details: ServiceDetails; responseHours: number | null }) {
  const { t, locale } = useLocale();
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value);
  // Computed after mounting so the server render and the visitor's clock never disagree.
  const [state, setState] = useState<{ open: boolean | null; today: number }>({ open: null, today: -1 });
  useEffect(() => { setState({ open: openNow(details), today: istanbulClock().day }); }, [details]);
  if (!details.emergency && details.hours.length !== 7 && details.priceMin === null && responseHours === null) return null;
  return <section className="service-profile-section svc-work-info"><h2>{t("Çalışma bilgileri")}</h2>
    <div className="svc-work-grid">
      {details.emergency && <p className="svc-work-item emergency"><Siren size={18} aria-hidden="true"/><span><strong>{t("7/24 acil hizmet")}</strong>{t("Gece, hafta sonu ve tatil günlerinde de ulaşabilirsiniz.")}</span></p>}
      {responseHours !== null && <p className="svc-work-item"><Timer size={18} aria-hidden="true"/><span><strong>{responseHours <= 24 ? t("Genellikle {n} saat içinde yanıt verir").replace("{n}", String(responseHours)) : t("Genellikle {n} gün içinde yanıt verir").replace("{n}", String(Math.ceil(responseHours / 24)))}</strong>{t("Son 90 gündeki teklif yanıtlarına göre.")}</span></p>}
      {details.priceMin !== null && <p className="svc-work-item"><Tag size={18} aria-hidden="true"/><span><strong>{money(details.priceMin)}{details.priceMax ? ` – ${money(details.priceMax)}` : "+"} <small>{t(SERVICE_PRICE_UNITS[details.priceUnit])}</small></strong>{details.priceNote ? <bdi dir="auto">{details.priceNote}</bdi> : t("Firmanın belirttiği ortalama fiyat; kesin fiyat için teklif isteyin.")}</span></p>}
    </div>
    {details.hours.length === 7 && <div className="svc-hours-view">
      <h3><CalendarClock size={17} aria-hidden="true"/>{t("Çalışma saatleri")}{state.open !== null && !details.emergency && <span className={state.open ? "svc-open" : "svc-closed-now"}>{t(state.open ? "Şu an açık" : "Şu an kapalı")}</span>}</h3>
      <dl>{SERVICE_WEEKDAYS.map((name, index) => { const day = details.hours[index]; return <div key={name} className={index === state.today ? "today" : undefined}><dt>{t(name)}</dt><dd>{day ? <bdi>{day[0]} – {day[1]}</bdi> : t("Kapalı")}</dd></div>; })}</dl>
    </div>}
  </section>;
}

/** Public firm profile (/hizmetler/firma/{id}); the owner and administrators also see it before approval. */
export function ServiceFirmProfile({ firm, similar = [], details, responseHours = null, messaging = false }: { firm: ServiceFirm; similar?: ServiceFirm[]; details?: ServiceDetails; responseHours?: number | null; messaging?: boolean }) {
  const { t, locale } = useLocale();
  const live = firm.status === "approved" && !firm.sample;
  useEffect(() => { if (live) trackService(firm.id, "view"); }, [live, firm.id]);
  const track = (kind: "phone" | "whatsapp" | "email" | "website") => () => { if (live) trackService(firm.id, kind); };
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
      {firm.sample && <div className="service-sample-banner" role="note"><FlaskConical size={20} aria-hidden="true"/><p><strong>{t("Örnek firma — bu profil sitenin nasıl görüneceğini göstermek içindir.")}</strong> {t("Gerçek bir firma değildir; iletişim bilgisi yoktur ve sayımlara dahil edilmez.")}</p></div>}
      {firm.status !== "approved" && <div className="service-preview-note" role="status"><Clock size={17} aria-hidden="true"/>{t("Önizleme: bu profil herkese açık değil.")} <strong>{t(SERVICE_STATUS_LABELS[firm.status])}</strong></div>}
    </div>
    <header className="service-profile-head container">
      <div className={firm.cover ? "service-profile-cover" : "service-profile-cover empty"}>{firm.cover ? <img src={firm.cover} alt=""/> : first && <ServiceIcon name={first.icon} size={54}/>}</div>
      <div className="service-profile-identity">
        <span className="service-profile-logo">{firm.logo ? <img src={firm.logo} alt={firm.name}/> : <b>{firm.name.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
        <div>
          <h1>{firm.name}</h1>
          <div className="service-profile-badges">{firm.sample && <ServiceSampleBadge className="inline"/>}{firm.verified && <ServiceVerifiedBadge/>}{firm.documented && <ServiceDocumentedBadge/>}{firm.emergency && <ServiceEmergencyBadge/>}{firm.status === "approved" && !firm.sample && <span className="service-approved-note">{t("Yönetici onaylı profil")}</span>}</div>
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
        {details && <ServiceWorkInfo details={details} responseHours={responseHours}/>}
        {firm.photos.length > 0 && <section className="service-profile-section"><h2>{t("İş örnekleri")}</h2>
          <ul className="service-photos">{firm.photos.map((photo, index) => <li key={photo}><a href={photo} target="_blank" rel="noopener noreferrer" aria-label={t("Fotoğraf {n}").replace("{n}", String(index + 1))}><img src={photo} alt="" loading="lazy"/></a></li>)}</ul>
        </section>}
      </article>
      <aside className="service-contact-card" aria-labelledby="service-contact-title">
        <h2 id="service-contact-title">{t("Firmayla iletişim")}</h2>
        {firm.sample ? <>
          <p className="service-sample-contact"><FlaskConical size={16} aria-hidden="true"/>{t("Örnek firma — iletişim bilgisi yok")}</p>
          <button type="button" className="btn btn-primary btn-block" disabled aria-disabled="true"><Phone size={17} aria-hidden="true"/><span>{t("Ara")}</span></button>
          {first && <Link className="btn btn-secondary btn-block" href={servicePath(first.slug)}><ServiceIcon name={first.icon} size={17}/>{t(first.name)}</Link>}
        </> : <>
        {live && <Link className="btn btn-accent btn-block" href={quoteHref({ firmId: firm.id })}><Send size={17} aria-hidden="true"/>{t("Bu firmadan teklif iste")}</Link>}
        <a className="btn btn-primary btn-block" href={`tel:${firm.phone}`} onClick={track("phone")}><Phone size={17} aria-hidden="true"/><span>{t("Ara")}</span><bdi>{firm.phone}</bdi></a>
        {whatsapp && <a className="btn btn-block service-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={track("whatsapp")}><MessageCircle size={17} aria-hidden="true"/>{t("WhatsApp’tan yaz")}</a>}
        {live && messaging && <FirmMessage kind="service" firmId={firm.id}/>}
        {firm.email && <a className="btn btn-secondary btn-block" href={`mailto:${firm.email}`} onClick={track("email")}><Mail size={17} aria-hidden="true"/>{t("E-posta gönder")}</a>}
        {firm.website && <a className="btn btn-secondary btn-block" href={firm.website} target="_blank" rel="noopener noreferrer nofollow ugc" onClick={track("website")}><Globe size={17} aria-hidden="true"/><bdi>{website}</bdi><ExternalLink size={14} aria-hidden="true"/></a>}
        <p className="service-contact-note">{t("Fiyat ve iş koşullarını firmayla yazılı olarak netleştirin. estatemarket24 hizmetin tarafı değildir.")}</p>
        <Link className="service-report" href="/iletisim"><Flag size={14} aria-hidden="true"/>{t("Bu profille ilgili sorun bildir")}</Link>
        </>}
      </aside>
    </div>
    {similar.length > 0 && <section className="container services-featured svc-similar" aria-labelledby="svc-similar-title">
      <div className="services-section-head"><h2 id="svc-similar-title">{t("Benzer firmalar")}</h2>{first && <p>{t(first.name)}</p>}</div>
      <div className="service-firm-grid">{similar.map((item) => <ServiceFirmCard key={item.id} firm={item} highlight={first?.slug}/>)}</div>
    </section>}
    <div className="container"><p className="region-up"><Link href={SERVICE_BASE}>{t("Tüm hizmet kategorileri")}<ArrowRight size={15} aria-hidden="true"/></Link></p></div>
  </main>;
}
