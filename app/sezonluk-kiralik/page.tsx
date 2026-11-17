import "../tools.css";
import { SeasonalRentals } from "@/components/SeasonalRentals";
import { db } from "@/lib/server";
import { SEASON_DESTINATIONS } from "@/lib/seasonal-rentals";

export const dynamic = "force-dynamic";
// Holiday and seasonal rentals (purpose "gunluk", Turistik günlük kiralık): popular destinations with the number
// of published listings, each linking to the listing search. Title and description: lib/seo-copy.ts.
export default async function Page() {
  const counts: Record<string, number> = {};
  try {
    const rows = (await db().prepare("SELECT city,district,COUNT(*) AS n FROM listings WHERE status='published' AND purpose='gunluk' GROUP BY city,district").all<{ city: string; district: string; n: number }>()).results || [];
    for (const destination of SEASON_DESTINATIONS) counts[destination.key] = rows.filter((row) => row.city === destination.city && (!destination.district || row.district === destination.district)).reduce((sum, row) => sum + Number(row.n), 0);
  } catch { /* the page still lists the destinations */ }
  return <SeasonalRentals counts={counts}/>;
}
