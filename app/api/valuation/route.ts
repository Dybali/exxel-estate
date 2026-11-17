import { db, error, ok } from "@/lib/server";
import { currentRates } from "@/lib/tcmb-server";
import { tlPrice, tlRates } from "@/lib/listing-sort";
import { CITIES, DISTRICTS } from "@/lib/turkey-locations";
import { valuate, type Comparable } from "@/lib/valuation";

// GET /api/valuation?city=&district=&type=konut|villa|arsa&area= — the market comparison of lib/valuation.ts
// from published listings (samples live only in code); prices in other currencies are converted with one TCMB bulletin.
const TYPES: Record<string, string[]> = {
  daire: ["daire", "rezidans"], mustakil: ["mustakil", "villa", "ciftlik-evi", "kosk-konak", "yazlik"], arsa: ["arsa"], isyeri: ["ticari"],
};
type Row = { price: number; currency: string; gross_area: number; net_area: number | null; district: string; purpose: string };

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const city = q.get("city") || "", district = q.get("district") || "", type = q.get("type") || "daire", area = Number(q.get("area"));
  if (!CITIES.includes(city) || (district && !(DISTRICTS[city] || []).includes(district)) || !TYPES[type] || !(area >= 15 && area <= 5000)) return error("Geçersiz istek.");
  const types = TYPES[type], marks = types.map(() => "?").join(",");
  const rows = (await db().prepare(`SELECT price,currency,gross_area,net_area,district,purpose FROM listings WHERE status='published' AND city=? AND purpose IN ('satilik','kiralik') AND property_type IN (${marks}) AND gross_area>0 AND price>0 LIMIT 4000`)
    .bind(city, ...types).all<Row>()).results || [];
  const rates = tlRates(await currentRates().catch(() => null));
  const comparable = (purpose: string): Comparable[] => rows.filter((row) => row.purpose === purpose).flatMap((row) => {
    const price = tlPrice({ price: Number(row.price), currency: row.currency }, rates);
    return price ? [{ price, area: Number(row.gross_area), district: row.district }] : [];
  });
  const result = valuate(comparable("satilik"), comparable("kiralik"), district, area);
  return ok({ result, city, district }, { headers: { "Cache-Control": "public,max-age=600,s-maxage=1800" } });
}
