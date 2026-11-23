import "../tools.css";
import { AgentDirectory } from "@/components/AgentDirectory";
import { listAgents, listOffices, type AgentDirectoryDatabase, type AgentQuery } from "@/lib/agent-directory";
import { db, OWNER_VERIFIED_SQL } from "@/lib/server";
import { CITIES, DISTRICTS } from "@/lib/turkey-locations";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
// Consultants and offices (lib/agent-directory.ts): ?gorunum=ofisler&il=&ilce=&dil=&tur=&uzmanlik=&sira=&q=&sayfa=.
// Title and description: lib/seo-copy.ts.
export default async function Page({ searchParams }: Props) {
  const raw = await searchParams, one = (key: string) => { const value = raw[key]; return (Array.isArray(value) ? value[0] : value) || ""; };
  const city = CITIES.includes(one("il")) ? one("il") : "", district = city && (DISTRICTS[city] || []).includes(one("ilce")) ? one("ilce") : "";
  const query: AgentQuery = { city, district, language: one("dil"), q: one("q").slice(0, 80), page: Number(one("sayfa")) || 1, purpose: one("tur"), specialty: one("uzmanlik"), sort: one("sira") || "onerilen" };
  const database = db() as unknown as AgentDirectoryDatabase;
  if (one("gorunum") === "ofisler") {
    const result = await listOffices(database, query, OWNER_VERIFIED_SQL).catch(() => ({ total: 0, page: 1, offices: [] }));
    return <AgentDirectory view="offices" query={{ ...query, page: result.page }} total={result.total} agents={[]} offices={result.offices}/>;
  }
  const result = await listAgents(database, query, OWNER_VERIFIED_SQL).catch(() => ({ total: 0, page: 1, agents: [] }));
  return <AgentDirectory view="agents" query={{ ...query, page: result.page }} total={result.total} agents={result.agents} offices={[]}/>;
}
