import { permanentRedirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
// Short address for the "Fiyatı düşenler" filter of the listing search (priceDrop=1, lib/search-categories.ts):
// listings whose latest price change in the last 30 days was a decrease. Other parameters (purpose, city, lang)
// are passed on.
export default async function Page({ searchParams }: Props) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) { const one = Array.isArray(value) ? value[0] : value; if (one) params.set(key, one); }
  params.set("priceDrop", "1");
  permanentRedirect(`/ilanlar?${params}`);
}
