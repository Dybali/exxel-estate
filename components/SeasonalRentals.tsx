"use client";
import Link from "@/components/SafeLink";
import { ArrowRight, Info, Palmtree } from "lucide-react";
import { ViewerGate } from "@/components/ViewerGate";
import { useLocale } from "@/lib/i18n";
import { SEASON_DESTINATIONS, seasonHref } from "@/lib/seasonal-rentals";

export function SeasonalRentals({ counts }: { counts: Record<string, number> }) {
  const { t, locale } = useLocale();
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <main className="tools-page">
    <section className="tools-hero"><div className="container">
      <span className="market-overline"><Palmtree size={15} aria-hidden="true"/> {t("SEZONLUK KİRALIK")}</span>
      <h1>{t("Sezonluk ve günlük kiralık evler")}</h1>
      <p>{t("Türkiye'nin sevilen tatil bölgelerinde yazlık, villa ve daireleri gece, hafta veya sezon için kiralayın. İlanlar sekiz dilde, ev sahipleriyle kendi dilinizde yazışırsınız.")}</p>
      <nav className="tools-tabs"><Link href="/ilanlar?purpose=gunluk">{t("Tüm sezonluk kiralık ilanlar")}<ArrowRight size={15} aria-hidden="true"/></Link></nav>
    </div></section>
    <div className="container">
      <div className="season-grid">{SEASON_DESTINATIONS.map((destination) => <Link key={destination.key} className="season-card" href={seasonHref(destination)}>
        <strong>{destination.label}</strong>
        <span>{destination.district ? `${destination.city} · ` : ""}{t(destination.note)}</span>
        <em>{counts[destination.key] ? t("{n} ilan").replace("{n}", number(counts[destination.key])) : t("İlanları gör")}</em>
      </Link>)}</div>
      <article className="tool-card" style={{ marginTop: 24 }}>
        <header><Info size={22} aria-hidden="true"/><div><h2>{t("Ev sahipleri için: izin belgesi")}</h2>
          <p>{t("Türkiye'de bir konutun 100 güne kadar turizm amacıyla kiralanması, Kültür ve Turizm Bakanlığından alınan izin belgesi gerektirir (7464 sayılı Kanun). Belgenizi ilan açıklamasında belirtin.")}</p></div></header>
        <ViewerGate action="postListing"><div className="tool-actions"><Link className="primary-button" href="/ilan-ver">{t("Sezonluk kiralık ilan verin")}</Link></div></ViewerGate>
      </article>
    </div>
  </main>;
}
