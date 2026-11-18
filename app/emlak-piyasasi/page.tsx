import "../tools.css";
import "../market.css";
import { ChartLine } from "lucide-react";
import { MarketMap } from "@/components/MarketMap";
import { MarketHero, MarketPending } from "@/components/MarketPageParts";
import { currentMarketView } from "@/lib/market-stats-server";

export const dynamic = "force-dynamic";
// Housing market by province from TCMB (lib/market-stats.ts, docs/market-stats.md). Title and description: lib/seo-copy.ts.
export default async function Page() {
  const view = await currentMarketView();
  return <main className="tools-page market-page">
    <MarketHero icon={<ChartLine size={15} aria-hidden="true"/>}/>
    <div className="container market-body">{view ? <MarketMap view={view}/> : <MarketPending/>}</div>
  </main>;
}
