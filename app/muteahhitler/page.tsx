import { ContractorDirectory, type ContractorFilters } from "@/components/ContractorDirectory";
import { matchSampleContractors } from "@/lib/contractor-samples";
import { CONTRACTOR_PER_PAGE, contractorStats, isSpecialty, searchContractors, type ContractorResults } from "@/lib/contractors";
import { contractorSamples, contractorsDB } from "@/lib/contractors-server";
import { AREA_CITIES } from "@/lib/service-locations";

// Title, description and link preview come from lib/seo-copy.ts ("/muteahhitler") through the root layout.
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value || "").trim();

export default async function ContractorsPage({ searchParams }: Props) {
  const params = await searchParams, city = one(params.il), specialty = one(params.tur), sort = one(params.sirala);
  const filters: ContractorFilters = {
    q: one(params.q).slice(0, 100), city: AREA_CITIES.includes(city) ? city : "", specialty: isSpecialty(specialty) ? specialty : "",
    verified: one(params.dogrulanmis) === "1", landDeals: one(params.kat) === "1", sort: ["featured", "newest", "az"].includes(sort) ? sort : "featured",
  };
  const page = Number(one(params.sayfa)) || 1;
  // A database problem (even a missing connection) leaves the page usable: empty results, zero figures.
  const empty: ContractorResults = { firms: [], total: 0, page: 1, pages: 1, perPage: CONTRACTOR_PER_PAGE };
  const [results, stats] = await Promise.all([
    Promise.resolve().then(() => searchContractors(contractorsDB(), { ...filters, page })).catch(() => empty),
    Promise.resolve().then(() => contractorStats(contractorsDB())).catch(() => ({ firms: 0, cities: 0, projects: 0 })),
  ]);
  // Labelled sample firms (lib/contractor-samples.ts) appear while the directory has fewer than a page of real ones.
  const samples = results.total < CONTRACTOR_PER_PAGE ? matchSampleContractors(contractorSamples(), filters) : [];
  return <ContractorDirectory filters={filters} results={results} samples={samples} stats={stats}/>;
}
