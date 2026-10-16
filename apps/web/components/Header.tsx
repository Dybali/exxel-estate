"use client";
import { Brand } from "@/components/Brand";


import Link from "@/components/SafeLink";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Globe2, Heart, Menu, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { locales, useLocale } from "@/lib/i18n";

export function Header() {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const languageMenu = useRef<HTMLDetailsElement>(null);
  const { locale, setLocale, t } = useLocale();
  useEffect(() => {
    fetch("/api/account").then((response) => response.json()).then((data) => setUser(data.user || null)).catch(() => {});
  }, [path]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (languageMenu.current && !languageMenu.current.contains(event.target as Node)) languageMenu.current.open = false;
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && languageMenu.current?.open) {
        languageMenu.current.open = false;
        languageMenu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", closeEscape); };
  }, []);
  const currentLanguage = locales.find((item) => item.code === locale) || locales[0];
  const loginNext = path && path !== "/giris" ? path : "/hesabim";
  const loginHref = user ? "/hesabim" : `/giris?next=${encodeURIComponent(loginNext)}`;
  const links = [
    { href: "/", label: "Ana Sayfa", active: path === "/" },
    { href: "/ilanlar?purpose=satilik", label: "Satılık", active: false },
    { href: "/ilanlar?purpose=kiralik", label: "Kiralık", active: false },
    { href: "/ilanlar", label: "İlanlar", active: path === "/ilanlar" },
    { href: "/sirketler", label: "Şirketler", active: path.startsWith("/sirketler") },
  ];
  return <>
    <div className="topline"><div className="container top-inner"><span>{t("Türkiye'de gayrimenkul aramanın yeni adresi")}</span><div><details className="locale-switch" ref={languageMenu}><summary aria-label={`Dil / Language: ${currentLanguage.label}`}><Globe2 size={15} aria-hidden="true"/><span className="locale-hint">Dil / Language</span><img src={`/flags/${currentLanguage.flag}.svg`} alt="" width={20} height={15}/><strong>{currentLanguage.label}</strong><ChevronDown size={14} aria-hidden="true"/></summary><div className="locale-options">{locales.map((item) => <button type="button" key={item.code} lang={item.code} aria-label={`Dil: ${item.label}`} className={locale === item.code ? "active" : ""} aria-current={locale === item.code ? "true" : undefined} onClick={() => { setLocale(item.code); if (languageMenu.current) languageMenu.current.open = false; }}><img src={`/flags/${item.flag}.svg`} alt="" width={22} height={17}/><span>{item.label}</span></button>)}</div></details></div></div></div>
    <header className="site-header"><div className="container header-inner"><Link href="/" className="brand" aria-label="sales or rent — Your gateway to Turkish real estate — ana sayfa"><Brand/></Link>
      <nav className={menu ? "main-nav open" : "main-nav"}>{links.map((link) => <Link key={link.href} className={link.active ? "active" : ""} href={link.href} onClick={() => setMenu(false)}>{t(link.label)}</Link>)}</nav>
      <div className="header-actions"><Link className="icon-link desktop-only" href="/hesabim?tab=favoriler" aria-label={t("Favoriler")}><Heart size={20}/></Link><Link className="account-link" href={loginHref}><UserRound size={18}/><span>{user ? user.name.split(" ")[0] : t("Giriş Yap")}</span></Link><Link className="header-post" href="/ilan-ver">{t("İlan Ver")} <ArrowRight size={17}/></Link><button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Menü">{menu ? <X size={25}/> : <Menu size={25}/>}</button></div>
    </div></header>
  </>;
}


