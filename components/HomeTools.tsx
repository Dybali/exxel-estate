"use client";
import Link from "@/components/SafeLink";
import { Calculator, ChartColumn, Palmtree, Search, TrendingDown, Users } from "lucide-react";
import { useLocale } from "@/lib/i18n";

// Home page: the buyer and owner tools (hesaplama araçları, konut değerleme, benim için bul, fiyatı düşenler,
// sezonluk kiralık, danışmanlar).
const TOOLS = [
  { href: "/konut-degerleme", icon: ChartColumn, title: "Konut değerleme", text: "Evinizin bugünkü değerini bölgedeki ilanlarla karşılaştırın." },
  { href: "/benim-icin-bul", icon: Search, title: "Benim için bul", text: "Aradığınız evi anlatın, danışmanlar size ulaşsın." },
  { href: "/fiyati-dusen-ilanlar", icon: TrendingDown, title: "Fiyatı düşenler", text: "Son 30 günde fiyatı düşen ilanlar." },
  { href: "/sezonluk-kiralik", icon: Palmtree, title: "Sezonluk kiralık", text: "Tatil bölgelerinde günlük ve sezonluk evler." },
  { href: "/danismanlar", icon: Users, title: "Danışman bul", text: "Bölgenizdeki ve dilinizi konuşan emlak danışmanları." },
  { href: "/hesaplama-araclari", icon: Calculator, title: "Hesaplama araçları", text: "Kira artışı, tapu harcı ve tapu masrafları." },
] as const;

export function HomeTools() {
  const { t } = useLocale();
  return <section className="market-section container home-tools" aria-labelledby="home-tools-title">
    <div className="market-section-head"><div><span className="market-overline">{t("ARAÇLAR")}</span><h2 id="home-tools-title">{t("Karar vermenizi kolaylaştıran araçlar")}</h2></div></div>
    <div className="home-tools-grid">{TOOLS.map(({ href, icon: Icon, title, text }) => <Link key={href} href={href} className="home-tool">
      <span className="home-tool-icon"><Icon size={22} aria-hidden="true"/></span><span><strong>{t(title)}</strong><small>{t(text)}</small></span></Link>)}</div>
  </section>;
}
