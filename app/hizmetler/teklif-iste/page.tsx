import type { Metadata } from "next";
import { ServiceQuoteForm } from "@/components/ServiceQuoteForm";
import { translate } from "@/lib/i18n-dictionary";
import { areaCityBySlug, areaDistrictBySlug } from "@/lib/service-locations";
import { pageAlternates, requestLocale } from "@/lib/request-context";
import { isServiceSlug } from "@/lib/service-categories";
import { firmById, SERVICE_QUOTE_PATH, validFirmId } from "@/lib/services";
import { servicesDB } from "@/lib/services-server";

export const dynamic = "force-dynamic";
type Search = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || "" : value || "";

// "Teklif iste": one form, sent to matching firms (or to one firm with ?firma=). Prefilled from
// ?kategori=&il=&ilce= (category and firm pages link here). Only the bare address is indexed.
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const locale = await requestLocale(), params = await searchParams;
  const title = translate("Ücretsiz teklif alın", locale), description = translate("İşinizi bir kez anlatın; bölgenizdeki onaylı firmalar size fiyat teklifi göndersin. Teklifleri yan yana karşılaştırın, size uygun olanı seçin.", locale);
  return { title: `${title} | estatemarket24`, description, alternates: await pageAlternates(SERVICE_QUOTE_PATH), ...(Object.keys(params).length ? { robots: { index: false, follow: true } } : {}) };
}

export default async function QuoteRequestPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const category = one(params.kategori), city = areaCityBySlug(one(params.il)) || "", district = city ? areaDistrictBySlug(city, one(params.ilce)) || "" : "";
  const firmId = one(params.firma);
  const firm = validFirmId(firmId) ? await firmById(servicesDB(), firmId).catch(() => null) : null;
  return <ServiceQuoteForm initial={{ category: isServiceSlug(category) ? category : firm?.categories[0] || "", city: city || (firm?.areas.length === 1 ? firm.areas[0].city : ""), district }}
    firm={firm ? { id: firm.id, name: firm.name, categories: firm.categories } : null}/>;
}
