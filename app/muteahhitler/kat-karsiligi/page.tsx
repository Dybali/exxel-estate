import type { Metadata } from "next";
import { LandRequestForm } from "@/components/LandRequestForm";
import { translate } from "@/lib/i18n-dictionary";
import { requestLocale } from "@/lib/request-context";
import { contractorById, validContractorId } from "@/lib/contractors";
import { contractorsDB } from "@/lib/contractors-server";
import { CITIES } from "@/lib/turkey-locations";

// Title and description come from lib/seo-copy.ts ("/muteahhitler/kat-karsiligi").
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value || "").trim();

// ?tur=insaat ("Benim için müteahhit bul") gets its own title; the address with a query is not indexed.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  if (one((await searchParams).tur) !== "insaat") return {};
  const locale = await requestLocale();
  return { title: `${translate("İnşaat teklifi al", locale)} | estatemarket24`, description: translate("Ne yaptırmak istediğinizi bir kez anlatın; bölgenizdeki onaylı müteahhitler size fiyat ve teslim süresiyle teklif göndersin.", locale), robots: { index: false, follow: true } };
}

// ?firma={id} sends the request to one approved contractor; ?il= prefills the province; ?tur=insaat opens the paid
// construction form ("Benim için müteahhit bul"), otherwise kat karşılığı.
export default async function LandRequestPage({ searchParams }: Props) {
  const params = await searchParams, id = one(params.firma), city = one(params.il), kind = one(params.tur) === "insaat" ? "build" : "land";
  const firm = validContractorId(id) ? await contractorById(contractorsDB(), id).catch(() => null) : null;
  // Every approved firm takes construction requests; land deals only from firms that accept them.
  return <LandRequestForm firm={firm && (kind === "build" || firm.landDeals) ? { id: firm.id, name: firm.name } : null} initialCity={CITIES.includes(city) ? city : ""} initialKind={kind}/>;
}
