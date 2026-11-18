"use client";
import Link from "@/components/SafeLink";
import { useLocale } from "@/lib/i18n";

// Translated parts of /emlak-piyasasi around the map (components/MarketMap.tsx).
export function MarketHero({ icon }: { icon: React.ReactNode }) {
  const { t } = useLocale();
  return <section className="tools-hero"><div className="container">
    <span className="market-overline">{icon}{t("EMLAK PİYASASI")}</span>
    <h1>{t("Türkiye konut piyasası")}</h1>
    <p>{t("81 ilde konutun m² satış fiyatı, m² kirası, brüt kira getirisi ve yıllık değişimi. Kaynak: Türkiye Cumhuriyet Merkez Bankası.")}</p>
  </div></section>;
}

export function MarketPending() {
  const { t } = useLocale();
  return <section className="market-pending">
    <h2>{t("Piyasa verileri hazırlanıyor")}</h2>
    <p>{t("Merkez Bankası verileri yüklendiğinde il il fiyatlar burada görünecek. Bu arada evinizin değerini bölgedeki ilanlarla karşılaştırabilirsiniz.")}</p>
    <Link className="primary-button" href="/konut-degerleme">{t("Konut değerleme")}</Link>
  </section>;
}
