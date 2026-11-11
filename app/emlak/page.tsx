import Link from "@/components/SafeLink";
import { T } from "@/lib/i18n";
import { regionPath } from "@/lib/region-pages";
import { CITIES } from "@/lib/turkey-locations";

// Index of the region pages (/emlak/{il}): every province links to its own page.
// Title and description come from lib/seo-copy.ts ("/emlak") through the root layout.
export default function RegionIndexPage() {
  return <main className="region-page">
    <div className="container">
      <header className="region-hero">
        <span className="market-overline"><T id="81 İL"/></span>
        <h1><T id="İllere göre emlak ilanları"/></h1>
        <p className="region-intro"><T id="Bir il seçin; o ildeki satılık ve kiralık ilanları, ilçeleri ve fiyat aralıklarını görün."/></p>
      </header>
      <section className="region-section">
        <ul className="region-chips">{CITIES.map((city) => { const path = regionPath({ city }); return path ? <li key={city}><Link href={path} className="region-chip region-chip-plain"><span>{city}</span></Link></li> : null; })}</ul>
      </section>
      <p className="region-up"><Link href="/ilanlar"><T id="Tüm ilanlar"/></Link></p>
    </div>
  </main>;
}
