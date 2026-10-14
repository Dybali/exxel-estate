import { neighborhoodsFor } from "@/lib/turkey-neighborhoods";
import { validDistrict } from "@/lib/turkey-locations";
import { error, ok, str } from "@/lib/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const city = str(params.get("city"), 70);
  const district = str(params.get("district"), 70);
  if (!validDistrict(city, district)) return error("Geçersiz il veya ilçe.", 400);
  return ok({ neighborhoods: neighborhoodsFor(city, district) }, {
    headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" },
  });
}
