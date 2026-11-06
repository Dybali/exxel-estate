"use client";

import {DeveloperShowcase} from "@/components/DeveloperShowcase";
import {ForeignBuyerGuide} from "@/components/ForeignBuyerGuide";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight } from "lucide-react";
import { HomeSearch } from "@/components/HomeSearch";
import { NaturalSearch } from "@/components/NaturalSearch";
import {HomeEditorial} from '@/components/Editorial';
import { ListingCard } from "@/components/ListingCard";
import { type Listing } from "@/lib/listings";
import { useLocale } from "@/lib/i18n";

const CityMap = lazy(() => import("@/components/CityMap").then((module) => ({ default: module.CityMap })));
const CompanyDirectory = lazy(() => import("@/components/CompanyDirectory").then((module) => ({ default: module.CompanyDirectory })));

function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "250px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, visible] as const;
}

export default function Home() {
  const { t } = useLocale();
  const [mapRef, mapVisible] = useNearViewport<HTMLElement>();
  const [companiesRef, companiesVisible] = useNearViewport<HTMLElement>();
  const [listings, setListings] = useState<Listing[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/listings?page=1", { signal: controller.signal })
      .then((response): Promise<{ listings?: Listing[] } | null> => response.ok ? response.json() : Promise.resolve(null))
      .then((data) => {
        if (!Array.isArray(data?.listings)) return;
        const featured = data.listings.filter((listing) => listing.featured && listing.images.length > 0);
        setListings([...featured, ...data.listings.filter((listing) => !featured.some((item) => item.id === listing.id))].slice(0, 4));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <main className="market-home">
    <section className="market-hero">
      <div className="market-hero-media" aria-hidden="true"><img src="/villa-sunset-1920.webp" srcSet="/villa-sunset-720.webp 720w, /villa-sunset-1280.webp 1280w, /villa-sunset-1920.webp 1920w" sizes="100vw" width={2400} height={1601} alt="" loading="eager" fetchPriority="high" decoding="async"/></div>
      <div className="container market-hero-inner">
      <div className="market-hero-copy"><span className="market-kicker">ESTATEMARKET24 · {t("TÜRKİYE")}</span><h1>{t("Türkiye'de satılık ve kiralık gayrimenkuller")}</h1><p>{t("Şehir, semt ve özelliklere göre arayın. Size uygun evi, arsayı veya iş yerini bulun.")}</p></div>
      <NaturalSearch variant="home" />
      <HomeSearch />
      <div className="market-hero-links"><span>{t("Popüler aramalar")}</span><Link href="/ilanlar?purpose=satilik&type=daire">{t("Satılık daire")}</Link><Link href="/ilanlar?purpose=kiralik&type=daire">{t("Kiralık daire")}</Link><Link href="/ilanlar?type=villa">{t("Villa")}</Link><Link href="/ilanlar?city=İstanbul">İstanbul</Link></div>
      <span className="hero-photo-credit">{t("Fotoğraf")}: <a href="https://www.pexels.com/photo/luxurious-modern-villa-with-infinity-pool-at-sunset-31817157/" target="_blank" rel="noreferrer">Ahmet ÇÖTÜR / Pexels</a></span>
    </div></section>
    <section className="market-shortcuts container" aria-label={t("Hızlı bağlantılar")}>
      <Link href="/ilanlar?purpose=satilik"><span className="shortcut-icon"><img src="/shortcuts/buy.webp" width={72} height={72} alt="" decoding="async"/></span><span><strong>{t("Satın al")}</strong><small>{t("Satılık gayrimenkulleri keşfedin")}</small></span><ArrowRight size={18}/></Link>
      <Link href="/ilanlar?purpose=kiralik"><span className="shortcut-icon"><img src="/shortcuts/rent.webp" width={72} height={72} alt="" decoding="async"/></span><span><strong>{t("Kirala")}</strong><small>{t("Kiralık ev ve daireleri görün")}</small></span><ArrowRight size={18}/></Link>
      <Link href="/sirketler"><span className="shortcut-icon"><img src="/shortcuts/companies.webp" width={72} height={72} alt="" decoding="async"/></span><span><strong>{t("Şirketler")}</strong><small>{t("Ofis ve firmaların ilanlarını inceleyin")}</small></span><ArrowRight size={18}/></Link>
    </section>
    <section className="market-section container"><div className="market-section-head"><div><span className="market-overline">ESTATEMARKET24</span><h2>{t("Öne çıkan ilanlar")}</h2><p>{t("Satılık ve kiralık seçenekleri karşılaştırın.")}</p></div><Link href="/ilanlar" className="market-more">{t("Tüm ilanlar")}<ArrowRight size={18}/></Link></div><div className="market-feature-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div></section>
    <ForeignBuyerGuide/>
    <DeveloperShowcase/>
    <section ref={mapRef} className="market-section market-map-section"><div className="container"><div className="market-section-head"><div><span className="market-overline">81 {t("il")}</span><h2>{t("Haritadan ilan keşfedin")}</h2><p>{t("İl seçin; yayındaki ilan sayısını görün ve sonuçlara geçin.")}</p></div><Link href="/ilanlar" className="market-more">{t("Tüm şehirler")}<ArrowRight size={18}/></Link></div>{mapVisible ? <Suspense fallback={<div className="city-map-layout"><div className="city-map-loading">{t("Harita yükleniyor...")}</div></div>}><CityMap/></Suspense> : <div className="city-map-layout"><div className="city-map-loading">{t("Harita yükleniyor...")}</div></div>}</div></section>
    <section ref={companiesRef} className="market-section container market-companies-section"><div className="market-section-head"><div><span className="market-overline">{t("İş ortakları")}</span><h2>{t("Emlak ofisleri ve inşaat firmaları")}</h2><p>{t("Onaylı şirketleri ve sunum amaçlı örnek portföyleri inceleyin.")}</p></div><Link href="/kurumsal-uyelik" className="market-more">{t("İnşaat firması üyeliği")}<ArrowRight size={18}/></Link></div>{companiesVisible ? <Suspense fallback={<div className="company-preview"><p className="directory-state">{t("Şirketler yükleniyor...")}</p></div>}><CompanyDirectory preview/></Suspense> : <div className="company-preview"><p className="directory-state">{t("Şirketler yükleniyor...")}</p></div>}</section>
    <HomeEditorial/>
  </main>;
}

