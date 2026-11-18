"use client";
import { ViewerGate } from "@/components/ViewerGate";
import {openCookiePreferences} from "./CookieConsent";
import {FeedbackLink} from "./FeedbackWidget";
import { Brand } from "@/components/Brand";


import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";
import { TCMB_RATES_PAGE } from "@/lib/tcmb";

// Region landing pages (lib/region-pages.ts) for the largest markets; tests/region-pages.test.mjs checks the paths.
export const POPULAR_REGIONS=[["İstanbul","/emlak/istanbul"],["Antalya","/emlak/antalya"],["İzmir","/emlak/izmir"],["Bodrum","/emlak/mugla/bodrum"],["Alanya","/emlak/antalya/alanya"],["Ankara","/emlak/ankara"]] as const;

export function Footer() {
  const { t } = useLocale();
  return <footer className="site-footer"><div className="container footer-main">
    <div className="footer-about"><Link href="/" className="brand footer-brand" aria-label="estatemarket24 — Your gateway to Turkish real estate — ana sayfa"><Brand negative/></Link><p>{t("Türkiye'nin seçkin gayrimenkullerini, dünyanın her yerinden keşfetmeniz için bir araya getiriyoruz.")}</p></div>
    <div><h4>{t("Keşfet")}</h4><Link href="/ilanlar?purpose=satilik">{t("Satılık İlanlar")}</Link><Link href="/ilanlar?purpose=kiralik">{t("Kiralık İlanlar")}</Link><Link href="/ilanlar?type=villa">{t("Villalar")}</Link><Link href="/ilanlar?type=daire">{t("Daireler")}</Link><Link href="/ilanlar?purpose=gunluk">{t("Sezonluk kiralık")}</Link><Link href="/fiyati-dusen-ilanlar">{t("Fiyatı düşenler")}</Link><Link href="/hizmetler">{t("Hizmetler")}</Link><h4 style={{marginTop:28}}>{t("Araçlar")}</h4><Link href="/emlak-piyasasi">{t("Emlak piyasası")}</Link><Link href="/konut-degerleme">{t("Konut değerleme")}</Link><Link href="/hesaplama-araclari">{t("Hesaplama araçları")}</Link><Link href="/benim-icin-bul">{t("Benim için bul")}</Link><Link href="/danismanlar">{t("Danışman bul")}</Link><h4 style={{marginTop:28}}>{t("Popüler bölgeler")}</h4>{POPULAR_REGIONS.map(([name,href])=><Link key={href} href={href}>{name}</Link>)}</div>
    <div><h4>estatemarket24</h4><ViewerGate action="signUp"><Link href="/kurumsal-uyelik">{t("İnşaat firması üyeliği")}</Link></ViewerGate><ViewerGate action="bulkUpload"><Link href="/toplu-ilan">{t("Toplu ilan yükleme")}</Link></ViewerGate><ViewerGate action="abroadListing"><Link href="/yurtdisindan-ilan">{t("Yurt dışından ilan verin")}</Link></ViewerGate><Link href="/sirketler">{t("Şirketler")}</Link><ViewerGate action="addServiceFirm"><Link href="/hizmetler/paketler">{t("Hizmet firmanızı ekleyin")}</Link></ViewerGate><Link href="/hakkimizda">{t("Hakkımızda")}</Link><ViewerGate action="postListing"><Link href="/paketler">{t("Paketler ve fiyatlar")}</Link></ViewerGate><Link href="/blog">{t("Blog & Haberler")}</Link><ViewerGate action="postListing"><Link href="/ilan-ver">{t("İlan Ver")}</Link></ViewerGate></div>
    <div><h4>{t("Hesabınız")}</h4><Link href="/giris">{t("Giriş Yap / Üye Ol")}</Link><Link href="/hesabim?tab=favoriler">{t("Favoriler")}</Link><Link href="/hesabim?tab=mesajlar">{t("Mesajlar")}</Link><p className="footer-note">{t("İlan sahipleriyle iletişim için üye girişi gerekir.")}</p><h4 style={{marginTop:28}}>{t("Yardım")}</h4><Link href="/sss">{t("Sık sorulan sorular")}</Link><Link href="/ilan-kurallari">{t("İlan kuralları")}</Link><Link href="/iletisim">{t("İletişim")}</Link><FeedbackLink/></div>
  </div><div className="container footer-bottom"><span>© 2026 estatemarket24. {t("Tüm hakları saklıdır.")}</span><span><Link href="/impressum">{t("Yasal künye")}</Link> · <Link href="/gizlilik-politikasi">{t("Gizlilik politikası")}</Link> · <Link href="/cerez-politikasi">{t("Çerez politikası")}</Link> · <Link href="/kullanim-kosullari">{t("Kullanım koşulları")}</Link> · <button type="button" className="footer-cookie-button" onClick={openCookiePreferences}>{t("Çerez tercihleri")}</button></span><small className="footer-rates-credit">{t("Döviz kurları")}: {t("Kaynak")}: <a href={TCMB_RATES_PAGE} target="_blank" rel="noopener noreferrer" title={t("Türkiye Cumhuriyet Merkez Bankası")}>TCMB</a></small></div></footer>;
}


