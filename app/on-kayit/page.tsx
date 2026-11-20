import Link from "next/link";
import { LANDING_CITIES } from "@/lib/landing-cities";

export const metadata = { title: "Ön kayıt sayfaları | EstateMarket24", robots: { index: false, follow: false } };
// Index of the 30 city pre-registration pages (temporary addresses until the subdomains are connected).
export default function PreRegistrationIndex() {
  return <main className="lp lp-screen"><div className="lp-card">
    <img className="lp-logo-dark" src="/brand/logo-horizontal.svg" alt="EstateMarket24" width={190} height={37}/>
    <h2>{"Ön kayıt sayfaları"}</h2>
    <ul className="lp-index">{LANDING_CITIES.map((city) => <li key={city.slug}><Link href={`/on-kayit/${city.slug}`}>{city.name}</Link></li>)}</ul>
  </div></main>;
}
