"use client";
import {openCookiePreferences} from "./CookieConsent";
import { Brand } from "@/components/Brand";


import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";

export function Footer() {
  const { t } = useLocale();
  return <footer className="site-footer"><div className="container footer-main">
    <div className="footer-about"><Link href="/" className="brand footer-brand" aria-label="estatemarket24 — Your gateway to Turkish real estate — ana sayfa"><Brand negative/></Link><p>{t("Türkiye'nin seçkin gayrimenkullerini, dünyanın her yerinden keşfetmeniz için bir araya getiriyoruz.")}</p></div>
    <div><h4>{t("Keşfet")}</h4><Link href="/ilanlar?purpose=satilik">{t("Satılık İlanlar")}</Link><Link href="/ilanlar?purpose=kiralik">{t("Kiralık İlanlar")}</Link><Link href="/ilanlar?type=villa">{t("Villalar")}</Link><Link href="/ilanlar?type=daire">{t("Daireler")}</Link></div>
    <div><h4>estatemarket24</h4><Link href="/kurumsal-uyelik">{t("İnşaat firması üyeliği")}</Link><Link href="/sirketler">{t("Şirketler")}</Link><Link href="/hakkimizda">{t("Hakkımızda")}</Link><Link href="/paketler">{t("Paketler ve fiyatlar")}</Link><Link href="/blog">{t("Blog & Haberler")}</Link><Link href="/ilan-ver">{t("İlan Ver")}</Link></div>
    <div><h4>{t("Hesabınız")}</h4><Link href="/giris">{t("Giriş Yap / Üye Ol")}</Link><Link href="/hesabim?tab=favoriler">{t("Favoriler")}</Link><Link href="/hesabim?tab=mesajlar">{t("Mesajlar")}</Link><p className="footer-note">{t("İlan sahipleriyle iletişim için üye girişi gerekir.")}</p></div>
  </div><div className="container footer-bottom"><span>© 2026 estatemarket24. {t("Tüm hakları saklıdır.")}</span><span><Link href="/impressum">{t("Yasal künye")}</Link> · <Link href="/gizlilik-politikasi">{t("Gizlilik politikası")}</Link> · <Link href="/cerez-politikasi">{t("Çerez politikası")}</Link> · <button type="button" className="footer-cookie-button" onClick={openCookiePreferences}>{t("Çerez tercihleri")}</button></span></div></footer>;
}


