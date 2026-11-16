"use client";
import { ArrowLeft, ChevronDown, Menu, Package, Plus, Search, Send, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import Link from "@/components/SafeLink";
import { ServiceIcon } from "@/components/ServiceIcon";
import { useLocale } from "@/lib/i18n";
import { viewerActions, viewerOf } from "@/lib/account-actions";
import { categoriesOf, SERVICE_GROUPS } from "@/lib/service-categories";
import { SERVICE_SEARCH_PATH } from "@/lib/service-search";
import { SERVICE_BASE, SERVICE_QUOTE_PATH, servicePath } from "@/lib/services";

export const SERVICE_SIGNUP_HREF = "/hizmetler/panel";
export const groupSearchHref = (group: string) => `${SERVICE_SEARCH_PATH}?grup=${group}`;

/** "EstateMarket24 Hizmet": the brand logo with a gold label; links to the service home. */
export function ServiceBrand() {
  const { t } = useLocale();
  return <Link href={SERVICE_BASE} className="svc-brand" aria-label={`EstateMarket24 ${t("Hizmet")}`}>
    <img className="svc-brand-logo" src="/brand/logo-horizontal-negativ.svg" alt="" width={517} height={100} decoding="async"/>
    <span className="svc-brand-label">{t("Hizmet")}</span>
  </Link>;
}

function useAccount() {
  const path = usePathname();
  const [user, setUser] = useState<{ name: string; accountKind?: string } | null>(null);
  useEffect(() => {
    fetch("/api/account", { cache: "no-store" }).then(async (response) => await response.json() as { user?: { name: string; accountKind?: string } }).then((data) => setUser(data.user || null)).catch(() => {});
  }, [path]);
  const next = (target: string) => `/giris?next=${encodeURIComponent(target)}`;
  return { user, accountHref: user ? (user.accountKind === "service" ? SERVICE_SIGNUP_HREF : "/hesabim") : next(path || SERVICE_BASE), addFirmHref: user ? SERVICE_SIGNUP_HREF : `/giris?mode=register&role=service&next=${encodeURIComponent(SERVICE_SIGNUP_HREF)}` };
}

/** Header of the service sub-site (every /hizmetler page, app/hizmetler/layout.tsx). */
export function ServiceHeader() {
  const { t } = useLocale();
  const path = usePathname() || SERVICE_BASE;
  const { user, accountHref, addFirmHref } = useAccount();
  const can = viewerActions(viewerOf(user));
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (nav.current && !nav.current.contains(event.target as Node)) setOpen(null); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(null); setDrawer(false); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("svc-drawer-open", drawer);
    return () => document.body.classList.remove("svc-drawer-open");
  }, [drawer]);
  const activeGroup = SERVICE_GROUPS.find((group) => categoriesOf(group.id).some((item) => path.startsWith(servicePath(item.slug))))?.id;

  return <header className="svc-header">
    <div className="svc-header-top"><div className="container svc-header-row">
      <ServiceBrand/>
      <Link href={SERVICE_SEARCH_PATH} className="svc-header-search"><Search size={16} aria-hidden="true"/><span>{t("Firma veya hizmet ara")}</span></Link>
      <div className="svc-header-actions">
        <LocaleSwitch className="svc-locale"/>
        {can.serviceQuote && <Link href={SERVICE_QUOTE_PATH} className="btn btn-accent btn-sm svc-quote-link"><Send size={16} aria-hidden="true"/>{t("Teklif iste")}</Link>}
        {can.addServiceFirm && <Link href={addFirmHref} className="btn btn-secondary btn-sm svc-add-firm"><Plus size={16} aria-hidden="true"/>{t("Firmanı ekle")}</Link>}
        <Link href={accountHref} className="svc-account"><UserRound size={18} aria-hidden="true"/><span>{user ? user.name.split(" ")[0] : t("Giriş Yap")}</span></Link>
        <button type="button" className="svc-menu-button" onClick={() => setDrawer(true)} aria-label={t("Menü")} aria-expanded={drawer} aria-controls="svc-drawer"><Menu size={24} aria-hidden="true"/></button>
      </div>
    </div></div>

    <nav className="svc-nav" aria-label={t("Hizmet grupları")} ref={nav}><div className="container svc-nav-row">
      <ul className="svc-nav-list">
        {SERVICE_GROUPS.map((group) => {
          const expanded = open === group.id;
          return <li key={group.id} className={`svc-nav-item${expanded ? " open" : ""}${activeGroup === group.id ? " active" : ""}`} onMouseLeave={() => setOpen((value) => value === group.id ? null : value)}>
            <button type="button" aria-expanded={expanded} aria-controls={`svc-menu-${group.id}`} onClick={() => setOpen(expanded ? null : group.id)}>
              <span title={group.nav === group.name ? undefined : t(group.name)}>{t(group.nav)}</span><ChevronDown size={14} aria-hidden="true"/>
            </button>
            <div className="svc-mega" id={`svc-menu-${group.id}`}>
              <p className="svc-mega-title">{t(group.name)}</p>
              <ul>{categoriesOf(group.id).map((item) => <li key={item.slug}><Link href={servicePath(item.slug)} onClick={() => setOpen(null)}>
                <span className="svc-mega-icon"><ServiceIcon name={item.icon} size={17}/></span><span><strong>{t(item.name)}</strong><small>{t(item.description)}</small></span>
              </Link></li>)}</ul>
              <Link className="svc-mega-all" href={groupSearchHref(group.id)} onClick={() => setOpen(null)}>{t("Bu gruptaki tüm firmalar")}</Link>
            </div>
          </li>;
        })}
      </ul>
      {can.servicePlans && <Link href="/hizmetler/paketler" className="svc-nav-back svc-nav-plans"><Package size={15} aria-hidden="true"/>{t("Paketler")}</Link>}
      <Link href="/" className="svc-nav-back"><ArrowLeft size={15} aria-hidden="true"/>{t("Emlak ilanları")}</Link>
    </div></nav>

    {drawer && <div className="svc-drawer-backdrop" onClick={() => setDrawer(false)} aria-hidden="true"/>}
    <div id="svc-drawer" className={drawer ? "svc-drawer open" : "svc-drawer"} role="dialog" aria-modal="true" aria-label={t("Menü")} hidden={!drawer}>
      <div className="svc-drawer-head"><ServiceBrand/><button type="button" onClick={() => setDrawer(false)} aria-label={t("Kapat")}><X size={24} aria-hidden="true"/></button></div>
      <Link href={SERVICE_SEARCH_PATH} className="svc-drawer-search"><Search size={17} aria-hidden="true"/>{t("Firma veya hizmet ara")}</Link>
      <div className="svc-drawer-groups">
        {SERVICE_GROUPS.map((group) => <details key={group.id} open={activeGroup === group.id}>
          <summary><ServiceIcon name={group.icon} size={18}/><span>{t(group.name)}</span><ChevronDown size={16} aria-hidden="true"/></summary>
          <ul>{categoriesOf(group.id).map((item) => <li key={item.slug}><Link href={servicePath(item.slug)}><ServiceIcon name={item.icon} size={16}/>{t(item.name)}</Link></li>)}
            <li><Link className="svc-drawer-all" href={groupSearchHref(group.id)}>{t("Bu gruptaki tüm firmalar")}</Link></li></ul>
        </details>)}
      </div>
      <div className="svc-drawer-actions">
        {can.serviceQuote && <Link href={SERVICE_QUOTE_PATH} className="btn btn-accent btn-block"><Send size={17} aria-hidden="true"/>{t("Teklif iste")}</Link>}
        {can.addServiceFirm && <Link href={addFirmHref} className="btn btn-secondary btn-block"><Plus size={17} aria-hidden="true"/>{t("Firmanı ekle")}</Link>}
        {can.servicePlans && <Link href="/hizmetler/paketler" className="btn btn-secondary btn-block"><Package size={17} aria-hidden="true"/>{t("Paketler")}</Link>}
        <Link href={accountHref} className="btn btn-secondary btn-block"><UserRound size={17} aria-hidden="true"/>{user ? t("Hesabım") : t("Giriş Yap")}</Link>
        <LocaleSwitch className="svc-locale svc-drawer-locale"/>
        <Link href="/" className="svc-drawer-back"><ArrowLeft size={16} aria-hidden="true"/>{t("Emlak ilanlarına dön")}</Link>
      </div>
    </div>
  </header>;
}
