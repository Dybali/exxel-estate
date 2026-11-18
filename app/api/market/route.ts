import { db } from "@/lib/server";
import { readMarketSnapshot, type MarketDatabase } from "@/lib/market-stats-store";

// Status of the TCMB market snapshot behind /emlak-piyasasi (lib/market-stats.ts): when it was fetched, how many
// series came back and which request batches gave nothing. Public data only; the EVDS key is never stored here.
export async function GET() {
  const snapshot = await readMarketSnapshot(db() as unknown as MarketDatabase).catch(() => null);
  if (!snapshot) return Response.json({ ready: false }, { headers: { "Cache-Control": "no-store" } });
  const provinces = Object.values(snapshot.provinces);
  return Response.json({
    ready: true,
    updatedAt: snapshot.updatedAt,
    provincesWithPrice: provinces.filter((item) => item.price.length).length,
    provincesWithRent: provinces.filter((item) => item.rent.length).length,
    turkey: { price: snapshot.turkey.price.at(-1) || null, rent: snapshot.turkey.rent.at(-1) || null, index: snapshot.turkey.index.at(-1) || null, rentIndex: snapshot.turkey.rentIndex.at(-1) || null },
    regionsWithIndex: Object.values(snapshot.regions).filter((item) => item.index.length).length,
    notes: snapshot.notes || [],
  }, { headers: { "Cache-Control": "no-store" } });
}
