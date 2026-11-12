"use client";
import {apiJson} from '@/lib/api-client';

import { Brand } from "@/components/Brand";
import { ExchangeRates } from "@/components/ExchangeRates";


import Link from "@/components/SafeLink";
import { usePathname } from "next/navigation";
import {Bell} from "lucide-react";
import { ArrowRight, HardHat, Heart, Mail, Menu, UserRound, Wrench, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { CurrencySwitch } from "@/components/DisplayCurrency";
import { useLocale } from "@/lib/i18n";

export function Header() {
  const path = usePathname();
  const isHome = path === "/";
  const [menu, setMenu] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [discoveryUnread,setDiscoveryUnread]=useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { t } = useLocale();
  useEffect(() => {
    const refresh=()=>fetch("/api/account",{cache:"no-store"}).then(async (response) => await response.json() as { user?: { id:string; name:string } }).then((data) => setUser(data.user || null)).catch(() => {});
    refresh();window.addEventListener("salesorrent:profile-changed",refresh);
    return()=>window.removeEventListener("salesorrent:profile-changed",refresh);
  }, [path]);
  useEffect(() => {
    if (!user?.id) { setUnreadMessages(0); return; }
    const control = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      try { const response = await fetch("/api/messages", { cache: "no-store", signal: control.signal }); if (response.ok) { const data = await response.json() as { unreadTotal?: number }; if (!control.signal.aborted) setUnreadMessages(Number(data.unreadTotal || 0)); } } catch {}
    };
    refresh(); const timer = setInterval(refresh, 30000);
    window.addEventListener("messages:changed", refresh);
    return () => { control.abort(); clearInterval(timer); window.removeEventListener("messages:changed", refresh); };
  }, [user?.id]);
  useEffect(()=>{if(!user?.id){setDiscoveryUnread(0);return;}let active=true,sequence=0;
    const refresh=()=>{if(document.hidden)return;const ticket=++sequence;fetch('/api/discovery',{cache:'no-store'}).then(r=>r.ok?apiJson<{unread?:number}>(r):null).then(data=>{if(active&&ticket===sequence&&data)setDiscoveryUnread(data.unread||0);}).catch(()=>{});};
    const read=()=>{if(!active)return;setDiscoveryUnread(0);refresh();};refresh();const timer=setInterval(refresh,60000);window.addEventListener('salesorrent:discovery-changed',refresh);window.addEventListener('salesorrent:discovery-read',read);window.addEventListener('focus',refresh);return()=>{active=false;sequence++;clearInterval(timer);window.removeEventListener('salesorrent:discovery-changed',refresh);window.removeEventListener('salesorrent:discovery-read',read);window.removeEventListener('focus',refresh);};
  },[user?.id]);
  const loginNext = path && path !== "/giris" ? path : "/hesabim";
  const loginHref = user ? "/hesabim" : `/giris?next=${encodeURIComponent(loginNext)}`;
  const links = [
    { href: "/", label: "Ana Sayfa", active: path === "/" },
    // Satılık / Kiralık / İlanlar are left out on the home page, whose search box already covers them.
    ...(isHome ? [] : [
      { href: "/ilanlar?purpose=satilik", label: "Satılık", active: false },
      { href: "/ilanlar?purpose=kiralik", label: "Kiralık", active: false },
      { href: "/ilanlar", label: "İlanlar", active: path === "/ilanlar" },
    ]),
    { href: "/projeler", label: "Projeler", active: path.startsWith("/projeler") },
    { href: "/sirketler", label: "Şirketler", active: path.startsWith("/sirketler") },
    { href: "/hizmetler", label: "Hizmetler", active: path.startsWith("/hizmetler"), className: "nav-services", icon: Wrench },
    { href: "/muteahhitler", label: "Müteahhitler", active: path.startsWith("/muteahhitler"), className: "nav-services nav-contractors", icon: HardHat },
    { href: "/paketler", label: "Fiyatlar", active: path === "/paketler" },
    { href: "/blog", label: "Blog & Haberler", active: path.startsWith("/blog") },
  ];
  return <>
    {isHome && <div className="home-fixed-exchange"><div className="container"><ExchangeRates /></div></div>}
    <div className={isHome ? "topline home-topline" : "topline"}><div className="container top-inner"><span>{t("Türkiye'de gayrimenkul aramanın yeni adresi")}</span><div className="top-switches"><CurrencySwitch className="header-currency"/><LocaleSwitch/></div></div></div>
    <header className={isHome ? "site-header home-header" : "site-header"}><div className="container header-inner"><Link href="/" className="brand" aria-label="estatemarket24 — Your gateway to Turkish real estate — ana sayfa"><Brand/></Link>
      <nav id="main-navigation" className={menu ? "main-nav open" : "main-nav"}><Link className="nav-post-listing" href="/ilan-ver" onClick={() => setMenu(false)}>{t("İlan Ver")} <ArrowRight size={17}/></Link>{links.map((link) => <Link key={link.href} className={[link.className, link.active ? "active" : ""].filter(Boolean).join(" ")} href={link.href} onClick={() => setMenu(false)}>{"icon" in link && link.icon && <link.icon size={14} aria-hidden="true"/>}{t(link.label)}</Link>)}<Link className="main-messages-link" href={user ? "/hesabim?tab=mesajlar" : `/giris?next=${encodeURIComponent("/hesabim?tab=mesajlar")}`} onClick={() => setMenu(false)}><Mail size={16}/><span>{t("Mesajlarım")}</span>{unreadMessages > 0 && <b className="message-count">{unreadMessages > 99 ? "99+" : unreadMessages}</b>}</Link></nav>
      <div className="header-actions">{user&&<Link className="discovery-bell" href="/hesabim?tab=bildirimler" aria-label={`${t("Bildirimler")}: ${discoveryUnread}`}><Bell size={20}/>{discoveryUnread>0&&<b>{discoveryUnread>99?"99+":discoveryUnread}</b>}</Link>}{user && <Link className="header-messages-link mobile-inbox-link" href="/hesabim?tab=mesajlar" aria-label={`${t("Mesajlarım")}${unreadMessages ? `, ${unreadMessages} ${t("okunmamış")}` : ""}`}><Mail size={20}/>{unreadMessages > 0 && <span>{unreadMessages > 99 ? "99+" : unreadMessages}</span>}</Link>}<Link className="icon-link desktop-only" href="/hesabim?tab=favoriler" aria-label={t("Favoriler")}><Heart size={20}/></Link>{isHome && !user ? <div className="home-account-guest"><UserRound size={18} aria-hidden="true"/><div><Link href={loginHref}>{t("Giriş Yap")}</Link><Link href={`/giris?mode=register&next=${encodeURIComponent(loginNext)}`}>{t("Kayıt Ol")}</Link></div></div> : <Link className="account-link" href={loginHref}><UserRound size={18}/><span>{user ? user.name.split(" ")[0] : t("Giriş Yap")}</span></Link>}<Link className="header-post" href="/ilan-ver">{t("İlan Ver")} <ArrowRight size={17}/></Link><button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label={t("Menü")} aria-expanded={menu} aria-controls="main-navigation">{menu ? <X size={25}/> : <Menu size={25}/>}</button></div>
    </div><div className="container compact-post-row"><Link className="compact-post-listing" href="/ilan-ver" onClick={() => setMenu(false)}>{t("İlan Ver")} <ArrowRight size={18}/></Link></div></header>
  </>;
}




