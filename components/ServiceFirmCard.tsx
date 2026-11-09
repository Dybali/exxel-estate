"use client";
import { BadgeCheck, FileCheck2, FlaskConical, MapPin, Siren, Star } from "lucide-react";
import Link from "@/components/SafeLink";
import { ServiceIcon } from "@/components/ServiceIcon";
import { useLocale } from "@/lib/i18n";
import { serviceCategory } from "@/lib/service-categories";
import { firmDescription, firmPath, type ServiceArea, type ServiceFirm } from "@/lib/services";

/** "Bodrum, Muğla · İzmir (tüm il) · +2" */
export function useAreaLabel() {
  const { t } = useLocale();
  return (areas: ServiceArea[], max = 3) => {
    const names = areas.map((area) => area.district ? `${area.district}, ${area.city}` : `${area.city} (${t("tüm il")})`);
    return names.length > max ? `${names.slice(0, max).join(" · ")} · +${names.length - max}` : names.join(" · ");
  };
}

export function ServiceVerifiedBadge() {
  const { t } = useLocale();
  return <span className="service-verified" title={t("Firma bilgileri ve vergi kaydı yönetici tarafından kontrol edildi.")}><BadgeCheck size={15} aria-hidden="true"/>{t("Doğrulanmış firma")}</span>;
}

/** At least one document approved by an administrator (lib/service-extras.ts). */
export function ServiceDocumentedBadge() {
  const { t } = useLocale();
  return <span className="service-documented" title={t("Vergi levhası, ustalık belgesi veya sigorta gibi belgeleri yönetici tarafından incelendi.")}><FileCheck2 size={15} aria-hidden="true"/>{t("Belgeli firma")}</span>;
}
export function ServiceEmergencyBadge() {
  const { t } = useLocale();
  return <span className="service-emergency"><Siren size={14} aria-hidden="true"/>{t("7/24 acil")}</span>;
}

/** "Örnek firma" label of the code-only sample firms (lib/service-samples.ts). */
export function ServiceSampleBadge({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  return <span className={`service-sample-badge ${className}`.trim()}><FlaskConical size={13} aria-hidden="true"/>{t("Örnek firma")}</span>;
}

export function ServiceFirmCard({ firm, highlight }: { firm: ServiceFirm; highlight?: string }) {
  const { t, locale } = useLocale(), areaLabel = useAreaLabel();
  const first = serviceCategory(highlight && firm.categories.includes(highlight as never) ? highlight : firm.categories[0]);
  const text = firmDescription(firm, locale);
  return <article className={firm.sample ? "service-firm-card is-sample" : "service-firm-card"}>
    <Link href={firmPath(firm.id)} className="service-firm-card-link" aria-label={firm.sample ? `${firm.name} · ${t("Örnek firma")}` : firm.name}>
      <div className="service-firm-card-media">
        {firm.cover || firm.photos[0] ? <img src={firm.cover || firm.photos[0]} alt="" loading="lazy"/> : <span className="service-firm-card-placeholder">{first && <ServiceIcon name={first.icon} size={34}/>}</span>}
        {firm.featured && <span className="service-featured"><Star size={13} aria-hidden="true"/>{t("Öne çıkan")}</span>}
        {firm.sample && <ServiceSampleBadge/>}
      </div>
      <div className="service-firm-card-body">
        <div className="service-firm-card-head">
          <span className="service-firm-logo">{firm.logo ? <img src={firm.logo} alt="" loading="lazy"/> : <b>{firm.name.charAt(0).toLocaleUpperCase("tr")}</b>}</span>
          <div><h3>{firm.name}</h3><span className="service-card-badges">{firm.verified && <ServiceVerifiedBadge/>}{firm.documented && <ServiceDocumentedBadge/>}{firm.emergency && <ServiceEmergencyBadge/>}</span></div>
        </div>
        <ul className="service-firm-tags">{firm.categories.slice(0, 3).map((slug) => <li key={slug}>{t(serviceCategory(slug)?.name || slug)}</li>)}{firm.categories.length > 3 && <li>+{firm.categories.length - 3}</li>}</ul>
        <p className="service-firm-card-text">{text.length > 150 ? `${text.slice(0, 150).trimEnd()}…` : text}</p>
        <p className="service-firm-card-area"><MapPin size={14} aria-hidden="true"/><span>{areaLabel(firm.areas, 2)}</span></p>
      </div>
    </Link>
  </article>;
}
