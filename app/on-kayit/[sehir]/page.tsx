import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreRegistrationFlow } from "@/components/PreRegistrationFlow";
import { landingCity } from "@/lib/landing-cities";
import { siteUrl } from "@/lib/request-context";

type Props = { params: Promise<{ sehir: string }> };
// Pre-registration landing page for one city; also served at <slug>.estatemarket24.com (proxy.ts).
// Only for ad traffic: never indexed (layout metadata + no sitemap entry).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = landingCity((await params).sehir);
  if (!city) return { robots: { index: false, follow: false } };
  return { title: `${city.name} ön kayıt | EstateMarket24`, description: `${city.locative} emlakçılar ve mülk sahipleri için EstateMarket24 ön kaydı.`, robots: { index: false, follow: false } };
}
export default async function CityLandingPage({ params }: Props) {
  const city = landingCity((await params).sehir);
  if (!city) notFound();
  return <PreRegistrationFlow city={city} siteHref={siteUrl()}/>;
}
