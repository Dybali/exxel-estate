import { db, error, ok } from "@/lib/server";
import { median, MIN_COMPARABLES } from "@/lib/buyer-tools";
import { CURRENCIES } from "@/lib/price-filters";

// Median price per m² of published listings in the same city / district, purpose and currency.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const city = q.get("city") || "", district = q.get("district") || "", purpose = q.get("purpose") || "", currency = q.get("currency") || "";
  if (!city || city.length > 80 || district.length > 80 || !/^[a-z]{3,10}$/.test(purpose) || !(CURRENCIES as readonly string[]).includes(currency)) return error("Geçersiz istek.");
  const rows = await db().prepare("SELECT district, price, gross_area FROM listings WHERE status='published' AND city=? AND purpose=? AND currency=? AND gross_area>0 AND price>0 LIMIT 2000")
    .bind(city, purpose, currency).all<{ district: string; price: number; gross_area: number }>();
  const all = rows.results || [];
  const perM2 = (list: typeof all) => list.map((row) => Number(row.price) / Number(row.gross_area));
  const inDistrict = all.filter((row) => row.district === district);
  const area = (list: typeof all) => ({ count: list.length, median: list.length >= MIN_COMPARABLES ? median(perM2(list)) : null });
  return ok({ city: area(all), district: area(inDistrict), currency, minimum: MIN_COMPARABLES }, { headers: { "Cache-Control": "public,max-age=600,s-maxage=3600" } });
}
