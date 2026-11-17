import "../tools.css";
import { AgentDirectory } from "@/components/AgentDirectory";
import { listAgents, type AgentDirectoryDatabase, type AgentQuery } from "@/lib/agent-directory";
import { db, OWNER_VERIFIED_SQL } from "@/lib/server";
import { CITIES, DISTRICTS } from "@/lib/turkey-locations";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
// Estate agent directory (lib/agent-directory.ts): ?il=&ilce=&dil=&q=&sayfa=. Title and description: lib/seo-copy.ts.
export default async function Page({ searchParams }: Props) {
  const raw = await searchParams, one = (key: string) => { const value = raw[key]; return (Array.isArray(value) ? value[0] : value) || ""; };
  const city = CITIES.includes(one("il")) ? one("il") : "", district = city && (DISTRICTS[city] || []).includes(one("ilce")) ? one("ilce") : "";
  const query: AgentQuery = { city, district, language: one("dil"), q: one("q").slice(0, 80), page: Number(one("sayfa")) || 1 };
  const result = await listAgents(db() as unknown as AgentDirectoryDatabase, query, OWNER_VERIFIED_SQL).catch(() => ({ total: 0, page: 1, agents: [] }));
  return <AgentDirectory query={{ ...query, page: result.page }} total={result.total} agents={result.agents}/>;
}
