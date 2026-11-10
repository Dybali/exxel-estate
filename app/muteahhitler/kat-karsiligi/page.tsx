import { LandRequestForm } from "@/components/LandRequestForm";
import { contractorById, validContractorId } from "@/lib/contractors";
import { contractorsDB } from "@/lib/contractors-server";
import { CITIES } from "@/lib/turkey-locations";

// Title and description come from lib/seo-copy.ts ("/muteahhitler/kat-karsiligi").
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value || "").trim();

// ?firma={id} sends the request to one approved contractor that accepts land deals; ?il= prefills the province.
export default async function LandRequestPage({ searchParams }: Props) {
  const params = await searchParams, id = one(params.firma), city = one(params.il);
  const firm = validContractorId(id) ? await contractorById(contractorsDB(), id).catch(() => null) : null;
  return <LandRequestForm firm={firm?.landDeals ? { id: firm.id, name: firm.name } : null} initialCity={CITIES.includes(city) ? city : ""}/>;
}
