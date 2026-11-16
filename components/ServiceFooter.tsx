"use client";
import { ArrowLeft, Plus } from "lucide-react";
import { openCookiePreferences } from "@/components/CookieConsent";
import { FeedbackLink } from "@/components/FeedbackWidget";
import Link from "@/components/SafeLink";
import { groupSearchHref, SERVICE_SIGNUP_HREF, ServiceBrand } from "@/components/ServiceHeader";
import { useLocale } from "@/lib/i18n";
import { ViewerGate } from "@/components/ViewerGate";
import { categoriesOf, SERVICE_GROUPS } from "@/lib/service-categories";
import { servicePath } from "@/lib/services";

/** Compact footer of the service sub-site: every category, provider link, legal pages, way back to the listings. */
export function ServiceFooter() {
  const { t } = useLocale();
  return <footer className="svc-footer">
    <div className="container svc-footer-top">
      <div className="svc-footer-about">
        <ServiceBrand/>
        <p>{t("Eviniz için güvenilir hizmet firmaları")}</p>
        <ViewerGate action="addServiceFirm"><Link href={`/giris?mode=register&role=service&next=${encodeURIComponent(SERVICE_SIGNUP_HREF)}`} className="btn btn-accent btn-sm"><Plus size={16} aria-hidden="true"/>{t("Firmanı ekle")}</Link></ViewerGate>
        <Link href="/" className="svc-footer-back"><ArrowLeft size={16} aria-hidden="true"/>{t("Emlak ilanlarına dön")}</Link>
      </div>
      <nav className="svc-footer-groups" aria-label={t("Hizmet kategorileri")}>
        {SERVICE_GROUPS.map((group) => <div key={group.id}>
          <h2><Link href={groupSearchHref(group.id)}>{t(group.name)}</Link></h2>
          <ul>{categoriesOf(group.id).map((item) => <li key={item.slug}><Link href={servicePath(item.slug)}>{t(item.name)}</Link></li>)}</ul>
        </div>)}
      </nav>
    </div>
    <div className="container svc-footer-bottom">
      <span>© 2026 estatemarket24. {t("Tüm hakları saklıdır.")}</span>
      <span className="svc-footer-legal">
        <Link href="/iletisim">{t("İletişim")}</Link><FeedbackLink className="svc-footer-feedback" source="services"/><Link href="/impressum">{t("Yasal künye")}</Link><Link href="/gizlilik-politikasi">{t("Gizlilik politikası")}</Link><Link href="/cerez-politikasi">{t("Çerez politikası")}</Link><Link href="/kullanim-kosullari">{t("Kullanım koşulları")}</Link>
        <button type="button" onClick={openCookiePreferences}>{t("Çerez tercihleri")}</button>
      </span>
    </div>
  </footer>;
}
