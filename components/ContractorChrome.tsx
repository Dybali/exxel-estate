"use client";
import { loadAccount } from "@/lib/account-client";
import { ArrowLeft, Building2, HardHat, Menu, Package, Plus, Search, Send, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openCookiePreferences } from "@/components/CookieConsent";
import { FeedbackLink } from "@/components/FeedbackWidget";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";
import { viewerActions, viewerOf } from "@/lib/account-actions";
import { ViewerGate } from "@/components/ViewerGate";
import { CONTRACTOR_BASE, CONTRACTOR_PANEL, CONTRACTOR_SPECIALTIES, LAND_PATH } from "@/lib/contractors";

export const specialtyHref = (slug: string) => `${CONTRACTOR_BASE}?tur=${slug}#sonuclar`;

/** "EstateMarket24 Müteahhit": the brand logo with a gold label; links to the contractor home. */
export function ContractorBrand() {
  const { t } = useLocale();
  return <Link href={CONTRACTOR_BASE} className="svc-brand" aria-label={`EstateMarket24 ${t("Müteahhit")}`}>
    <img className="svc-brand-logo" src="/brand/logo-horizontal-negativ.svg" alt="" width={517} height={100} decoding="async"/>
    <span className="svc-brand-label">{t("Müteahhit")}</span>
  </Link>;
}

function useAccount() {
  const path = usePathname();
  const [user, setUser] = useState<{ name: string; accountKind?: string } | null>(null);
  useEffect(() => {
    loadAccount().then((data) => setUser((data.user as { name: string; accountKind?: string } | null | undefined) || null)).catch(() => {});
  }, [path]);
  const next = (target: string) => `/giris?next=${encodeURIComponent(target)}`;
  return { user, accountHref: user ? (user.accountKind === "contractor" ? CONTRACTOR_PANEL : "/hesabim") : next(path || CONTRACTOR_BASE), addFirmHref: user ? CONTRACTOR_PANEL : `/giris?mode=register&role=contractor&next=${encodeURIComponent(CONTRACTOR_PANEL)}` };
}

/** Header of the contractor sub-site (every /muteahhitler page). */
export function ContractorHeader() {
  const { t } = useLocale();
  const { user, accountHref, addFirmHref } = useAccount();
  const can = viewerActions(viewerOf(user));
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawer(false); };
    document.addEventListener("keydown", escape);
    document.body.classList.toggle("svc-drawer-open", drawer);
    return () => { document.removeEventListener("keydown", escape); document.body.classList.remove("svc-drawer-open"); };
  }, [drawer]);
  return <header className="svc-header">
    <div className="svc-header-top"><div className="container svc-header-row">
      <ContractorBrand/>
      <Link href={`${CONTRACTOR_BASE}#sonuclar`} className="svc-header-search"><Search size={16} aria-hidden="true"/><span>{t("Müteahhit ara")}</span></Link>
      <div className="svc-header-actions">
        <LocaleSwitch className="svc-locale"/>
        {can.landQuote && <Link href={LAND_PATH} className="btn btn-accent btn-sm svc-quote-link"><Send size={16} aria-hidden="true"/>{t("Kat karşılığı teklif al")}</Link>}
        {can.addContractorFirm && <Link href={addFirmHref} className="btn btn-secondary btn-sm svc-add-firm"><Plus size={16} aria-hidden="true"/>{t("Firmanı ekle")}</Link>}
        <Link href={accountHref} className="svc-account"><UserRound size={18} aria-hidden="true"/><span>{user ? user.name.split(" ")[0] : t("Giriş Yap")}</span></Link>
        <button type="button" className="svc-menu-button" onClick={() => setDrawer(true)} aria-label={t("Menü")} aria-expanded={drawer} aria-controls="ctr-drawer"><Menu size={24} aria-hidden="true"/></button>
      </div>
    </div></div>
    <nav className="svc-nav" aria-label={t("Uzmanlık alanları")}><div className="container svc-nav-row">
      <ul className="svc-nav-list ctr-nav-list">
        {CONTRACTOR_SPECIALTIES.map((item) => <li key={item.slug} className="svc-nav-item"><Link href={specialtyHref(item.slug)}>{t(item.name)}</Link></li>)}
        <li className="svc-nav-item"><Link href="/projeler"><Building2 size={14} aria-hidden="true"/>{t("Satıştaki projeler")}</Link></li>
      </ul>
      {can.contractorPlans && <Link href="/muteahhitler/paketler" className="svc-nav-back svc-nav-plans"><Package size={15} aria-hidden="true"/>{t("Paketler")}</Link>}
      <Link href="/" className="svc-nav-back"><ArrowLeft size={15} aria-hidden="true"/>{t("Emlak ilanları")}</Link>
    </div></nav>
    {drawer && <div className="svc-drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden="true"/>}
    <div id="ctr-drawer" className={drawer ? "svc-drawer open" : "svc-drawer"} role="dialog" aria-modal="true" aria-label={t("Menü")} hidden={!drawer}>
      <div className="svc-drawer-head"><ContractorBrand/><button type="button" onClick={() => setDrawer(false)} aria-label={t("Kapat")}><X size={24} aria-hidden="true"/></button></div>
      <Link href={`${CONTRACTOR_BASE}#sonuclar`} className="svc-drawer-search" onClick={() => setDrawer(false)}><Search size={17} aria-hidden="true"/>{t("Müteahhit ara")}</Link>
      <div className="svc-drawer-groups"><ul className="ctr-drawer-list">
        {CONTRACTOR_SPECIALTIES.map((item) => <li key={item.slug}><Link href={specialtyHref(item.slug)} onClick={() => setDrawer(false)}><HardHat size={16} aria-hidden="true"/>{t(item.name)}</Link></li>)}
        <li><Link href="/projeler"><Building2 size={16} aria-hidden="true"/>{t("Satıştaki projeler")}</Link></li>
      </ul></div>
      <div className="svc-drawer-actions">
        {can.landQuote && <Link href={LAND_PATH} className="btn btn-accent btn-block"><Send size={17} aria-hidden="true"/>{t("Kat karşılığı teklif al")}</Link>}
        {can.addContractorFirm && <Link href={addFirmHref} className="btn btn-secondary btn-block"><Plus size={17} aria-hidden="true"/>{t("Firmanı ekle")}</Link>}
        {can.contractorPlans && <Link href="/muteahhitler/paketler" className="btn btn-secondary btn-block"><Package size={17} aria-hidden="true"/>{t("Paketler")}</Link>}
        <Link href={accountHref} className="btn btn-secondary btn-block"><UserRound size={17} aria-hidden="true"/>{user ? t("Hesabım") : t("Giriş Yap")}</Link>
        <LocaleSwitch className="svc-locale svc-drawer-locale"/>
        <Link href="/" className="svc-drawer-back"><ArrowLeft size={16} aria-hidden="true"/>{t("Emlak ilanlarına dön")}</Link>
      </div>
    </div>
  </header>;
}

/** Compact footer of the contractor sub-site. */
export function ContractorFooter() {
  const { t } = useLocale();
  return <footer className="svc-footer">
    <div className="container svc-footer-top">
      <div className="svc-footer-about">
        <ContractorBrand/>
        <p>{t("Arsanız ve projeniz için güvenilir müteahhitler")}</p>
        <ViewerGate action="addContractorFirm"><Link href={`/giris?mode=register&role=contractor&next=${encodeURIComponent(CONTRACTOR_PANEL)}`} className="btn btn-accent btn-sm"><Plus size={16} aria-hidden="true"/>{t("Firmanı ekle")}</Link></ViewerGate>
        <Link href="/" className="svc-footer-back"><ArrowLeft size={16} aria-hidden="true"/>{t("Emlak ilanlarına dön")}</Link>
      </div>
      <nav className="svc-footer-groups" aria-label={t("Uzmanlık alanları")}>
        <div><h2>{t("Uzmanlık alanları")}</h2><ul>{CONTRACTOR_SPECIALTIES.map((item) => <li key={item.slug}><Link href={specialtyHref(item.slug)}>{t(item.name)}</Link></li>)}</ul></div>
        <div><h2>{t("Arsa sahipleri")}</h2><ul><ViewerGate action="landQuote"><li><Link href={LAND_PATH}>{t("Kat karşılığı teklif al")}</Link></li></ViewerGate><li><Link href="/ilanlar?purpose=satilik&type=arsa">{t("Satılık arsalar")}</Link></li></ul></div>
        <div><h2>{t("Diğer bölümler")}</h2><ul><li><Link href="/projeler">{t("Satıştaki projeler")}</Link></li><li><Link href="/hizmetler">{t("Hizmetler")}</Link></li><li><Link href="/sirketler">{t("Şirketler")}</Link></li></ul></div>
      </nav>
    </div>
    <div className="container svc-footer-bottom">
      <span>© 2026 estatemarket24. {t("Tüm hakları saklıdır.")}</span>
      <span className="svc-footer-legal">
        <Link href="/iletisim">{t("İletişim")}</Link><FeedbackLink className="svc-footer-feedback"/><Link href="/impressum">{t("Yasal künye")}</Link><Link href="/gizlilik-politikasi">{t("Gizlilik politikası")}</Link><Link href="/cerez-politikasi">{t("Çerez politikası")}</Link><Link href="/kullanim-kosullari">{t("Kullanım koşulları")}</Link>
        <button type="button" onClick={openCookiePreferences}>{t("Çerez tercihleri")}</button>
      </span>
    </div>
  </footer>;
}
