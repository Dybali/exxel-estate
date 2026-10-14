"use client";

import { useEffect, useState } from "react";
import Link from "@/components/SafeLink";
import { ArrowRight, Building2, CheckCircle2, House, KeyRound, MapPin, ShieldCheck } from "lucide-react";
import { HomeSearch } from "@/components/HomeSearch";
import { ListingCard } from "@/components/ListingCard";
import { DEMO_LISTINGS, type Listing } from "@/lib/listings";
import { useLocale } from "@/lib/i18n";

const places = [
  { name: "İstanbul", image: "https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=900&q=82" },
  { name: "Antalya", image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=82" },
  { name: "Muğla", image: "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=900&q=82" },
  { name: "İzmir", image: "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=900&q=82" },
];

export default function Home() {
  const { t } = useLocale();
  const [listings, setListings] = useState<Listing[]>(DEMO_LISTINGS.slice(0, 4));
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/listings?page=1", { signal: controller.signal })
      .then((response): Promise<{listings?: Listing[]} | null> => response.ok ? response.json() : Promise.resolve(null))
      .then((data) => { if (Array.isArray(data?.listings)) setListings(data.listings.slice(0, 4)); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <main className="market-home">
    <section className="market-hero"><div className="container market-hero-inner">
      <div className="market-hero-copy"><span className="market-kicker">EXXEL ESTATE / {t("Türkiye")}</span><h1>{t("Türkiye'de evinizi bulun.")}</h1><p>{t("Satılık ve kiralık daire, ev, villa ve arsaları tek yerde karşılaştırın.")}</p></div>
      <HomeSearch />
      <div className="market-hero-links"><span>{t("Popüler aramalar")}</span><Link href="/ilanlar?purpose=satilik&type=daire">{t("Satılık daire")}</Link><Link href="/ilanlar?purpose=kiralik&type=daire">{t("Kiralık daire")}</Link><Link href="/ilanlar?type=villa">{t("Villa")}</Link><Link href="/ilanlar?city=İstanbul">İstanbul</Link></div>
    </div></section>
    <section className="market-shortcuts container" aria-label={t("Hızlı bağlantılar")}>
      <Link href="/ilanlar?purpose=satilik"><span className="shortcut-icon"><House size={23}/></span><span><strong>{t("Satın al")}</strong><small>{t("Satılık gayrimenkulleri keşfedin")}</small></span><ArrowRight size={19}/></Link>
      <Link href="/ilanlar?purpose=kiralik"><span className="shortcut-icon"><KeyRound size={23}/></span><span><strong>{t("Kirala")}</strong><small>{t("Kiralık ev ve daireleri görün")}</small></span><ArrowRight size={19}/></Link>
      <Link href="/ilan-ver"><span className="shortcut-icon"><Building2 size={23}/></span><span><strong>{t("İlan ver")}</strong><small>{t("Gayrimenkulünüzü alıcılarla buluşturun")}</small></span><ArrowRight size={19}/></Link>
    </section>
    <section className="market-section container"><div className="market-section-head"><div><span className="market-overline">EXXEL ESTATE</span><h2>{t("Öne çıkan ilanlar")}</h2><p>{t("Türkiye'nin farklı bölgelerinden güncel fırsatları inceleyin.")}</p></div><Link href="/ilanlar" className="market-more">{t("Tüm ilanlar")}<ArrowRight size={18}/></Link></div><div className="market-feature-grid">{listings.map((listing) => <ListingCard key={listing.id} listing={listing}/>)}</div></section>
    <section className="market-section market-location-section"><div className="container"><div className="market-section-head"><div><span className="market-overline">81 İL</span><h2>{t("Şehre göre keşfedin")}</h2><p>{t("Aradığınız konuma hızlıca ulaşın.")}</p></div><Link href="/ilanlar" className="market-more">{t("Tüm şehirler")}<ArrowRight size={18}/></Link></div><div className="market-places">{places.map((place) => <Link href={`/ilanlar?city=${encodeURIComponent(place.name)}`} key={place.name} className="market-place"><img src={place.image} alt={place.name}/><span><MapPin size={16}/>{place.name}<ArrowRight size={18}/></span></Link>)}</div></div></section>
    <section className="container market-trust"><div><ShieldCheck size={29}/><h3>{t("Kontrollü ilan yayını")}</h3><p>{t("İlanlar yönetici incelemesinden sonra yayına alınır.")}</p></div><div><CheckCircle2 size={29}/><h3>{t("Ayrıntılı arama")}</h3><p>{t("Konum, fiyat, oda ve özelliklere göre arayın.")}</p></div><div><Building2 size={29}/><h3>{t("Doğrudan iletişim")}</h3><p>{t("Üye olarak ilan sahibiyle güvenli biçimde mesajlaşın.")}</p></div></section>
  </main>;
}
