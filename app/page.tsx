"use client";

import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, Building2, House, KeyRound } from "lucide-react";
import { HomeSearch } from "@/components/HomeSearch";
import { ListingCard } from "@/components/ListingCard";
import { CityMap } from "@/components/CityMap";
import { CompanyDirectory } from "@/components/CompanyDirectory";
import { DEMO_LISTINGS, type Listing } from "@/lib/listings";
import { useLocale } from "@/lib/i18n";

export default function Home() {
  const { t } = useLocale();
  const [listings, setListings] = useState<Listing[]>(DEMO_LISTINGS.slice(0, 4));
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/listings?page=1", { signal: controller.signal })
      .then((response): Promise<{ listings?: Listing[] } | null> => response.ok ? response.json() : Promise.resolve(null))
      .then((data) => {
        if (!Array.isArray(data?.listings)) return;
        const featured = data.listings.filter((listing) => listing.featured && listing.images.length > 0);
        setListings([...featured, ...DEMO_LISTINGS.filter((listing) => !featured.some((item) => item.id === listing.id))].slice(0, 4));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <main className="market-home">
    <section className="market-hero"><div className="container market-hero-inner">
      <div className="market-hero-copy"><span className="market-kicker">EXXEL ESTATE · TÜRKİYE</span><h1>{t("Türkiye'de satılık ve kiralık gayrimenkuller")}</h1><p>{t("Şehir, semt ve özelliklere göre arayın. Size uygun evi, arsayı veya iş yerini bulun.")}</p></div>
      <HomeSearch />
      <div className="market-hero-links"><span>{t("Popüler aramalar")}</span><Link href="/ilanlar?purpose=satilik&type=daire">{t("Satılık daire")}</Link><Link href="/ilanlar?purpose=kiralik&type=daire">{t("Kiralık daire")}</Link><Link href="/ilanlar?type=villa">{t("Villa")}</Link><Link href="/ilanlar?city=İstanbul">İstanbul</Link></div>
      <span className="hero-photo-credit">{t("Fotoğraf")}: <a href="https://www.pexels.com/photo/modern-luxury-villa-with-infinity-pool-and-scenic-views-32226001/" target="_blank" rel="noreferrer">Ahmet ÇÖTÜR / Pexels</a> · Antalya</span>
    </div></section>
    <section className="market-shortcuts container" aria-label={t("Hızlı bağlantılar")}>
      <Link href="/ilanlar?purpose=satilik"><span className="shortcut-icon"><House size={22}/></span><span><strong>{t("Satın al")}</strong><small>{t("Satılık gayrimenkulleri keşfedin")}</small></span><ArrowRight size={18}/></Link>
      <Link href="/ilanlar?purpose=kiralik"><span className="shortcut-icon"><KeyRound size={22}/></span><span><strong>{t("Kirala")}</strong><small>{t("Kiralık ev ve daireleri görün")}</small></span><ArrowRight size={18}/></Link>
      <Link href="/sirketler"><span className="shortcut-icon"><Building2 size={22}/></span><span><strong>{t("Şirketler")}</strong><small>{t("Ofis ve firmaların ilanlarını inceleyin")}</small></span><ArrowRight size={18}/></Link>
    </section>
    <section className="market-section container"><div className="market-section-head"><div><span className="market-overline">EXXEL ESTATE</span><h2>{t("Öne çıkan ilanlar")}</h2><p>{t("Satılık ve kiralık seçenekleri karşılaştırın.")}</p></div><Link href="/ilanlar" className="market-more">{t("Tüm ilanlar")}<ArrowRight size={18}/></Link></div><div className="market-feature-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div></section>
    <section className="market-section market-map-section"><div className="container"><div className="market-section-head"><div><span className="market-overline">81 {t("il")}</span><h2>{t("Haritadan ilan keşfedin")}</h2><p>{t("İl seçin; yayındaki ilan sayısını görün ve sonuçlara geçin.")}</p></div><Link href="/ilanlar" className="market-more">{t("Tüm şehirler")}<ArrowRight size={18}/></Link></div><CityMap/></div></section>
    <section className="market-section container market-companies-section"><div className="market-section-head"><div><span className="market-overline">{t("İş ortakları")}</span><h2>{t("Emlak ofisleri ve inşaat firmaları")}</h2><p>{t("Onaylı şirketlerin ilanlarını ve portföylerini görün.")}</p></div><Link href="/sirketler" className="market-more">{t("Tüm şirketler")}<ArrowRight size={18}/></Link></div><CompanyDirectory preview/></section>
  </main>;
}
