// Sample contractors ("Örnek firma") for /muteahhitler while the directory has few real firms. Code only:
// never written to a database, never counted, indexed, put in the sitemap or offered land requests.
// The firms are the fictional developers of the homepage showcase (data/developer-showcase.json, same
// names and photos in public/developers). Switch: CONTRACTOR_SAMPLES (empty/unset = on; "0", "false",
// "off" = off), read in lib/contractors-server.ts. Ids start with "sample-" so they never match a UUID.
import type { ContractorFirm, ContractorProject } from "./contractors";

export const CONTRACTOR_SAMPLE_PREFIX = "sample-";
export const isSampleContractorId = (id: unknown): id is string => typeof id === "string" && id.startsWith(CONTRACTOR_SAMPLE_PREFIX);
export function contractorSamplesEnabled(value: unknown) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : value == null ? "" : String(value).toLowerCase();
  return !["0", "false", "off", "no"].includes(text);
}

const project = (id: string, title: string, city: string, district: string, year: number, kind: ContractorProject["kind"], units: number, photo: string, description: string): ContractorProject =>
  ({ id: `${CONTRACTOR_SAMPLE_PREFIX}${id}`, title, city, district, year, kind, units, description, photos: [photo] });
const firm = (seed: Pick<ContractorFirm, "id" | "name" | "description" | "foundedYear" | "specialties" | "areas" | "projects" | "cover">): ContractorFirm => ({
  phone: "", whatsapp: null, email: null, website: null, logo: null, licenseNumber: null, landDeals: true, verified: false, featured: false,
  status: "approved", createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", sample: true, ...seed,
});

export const CONTRACTOR_SAMPLE_FIRMS: readonly ContractorFirm[] = [
  firm({
    id: "sample-akdeniz-atlas-yapi", name: "Akdeniz Atlas Yapı", foundedYear: 2008, cover: "/developers/antalya.webp", specialties: ["villa", "konut", "turizm"],
    description: "Antalya ve Muğla'da bahçeli villa ve düşük katlı konut projeleri geliştiren örnek müteahhit profili. Kat karşılığı arsa değerlendirmelerinde bölgenin imar koşullarına uygun villa ve site projeleri önerir.",
    areas: [{ city: "Antalya", district: "" }, { city: "Muğla", district: "Bodrum" }, { city: "Muğla", district: "Fethiye" }],
    projects: [project("akdeniz-1", "Bahçe Yaşam Villaları", "Antalya", "Konyaaltı", 2024, "villa", 18, "/developers/antalya.webp", "Havuzlu ve bahçeli 18 müstakil villa.")],
  }),
  firm({
    id: "sample-ege-form-yapi", name: "Ege Form Yapı", foundedYear: 2012, cover: "/developers/izmir.webp", specialties: ["konut", "karma", "kentsel-donusum"],
    description: "İzmir'de teraslı apartman, karma proje ve kentsel dönüşüm işleri yapan örnek müteahhit profili. Eski binaların yenilenmesinde kat malikleriyle birlikte çalışma modelini anlatır.",
    areas: [{ city: "İzmir", district: "" }, { city: "Manisa", district: "" }],
    projects: [project("ege-1", "Ege Teras Evleri", "İzmir", "Karşıyaka", 2023, "konut", 42, "/developers/izmir.webp", "Geniş teraslı 42 daireli apartman.")],
  }),
  firm({
    id: "sample-marmara-kent-proje", name: "Marmara Kent Proje", foundedYear: 2005, cover: "/developers/istanbul.webp", specialties: ["konut", "ticari", "kentsel-donusum"],
    description: "İstanbul ve Kocaeli'de konut, ofis ve kentsel dönüşüm projeleri yürüten örnek müteahhit profili. Riskli yapıların yenilenmesinde kat karşılığı ve ruhsat sürecini örnekler.",
    areas: [{ city: "İstanbul", district: "" }, { city: "Kocaeli", district: "" }],
    projects: [project("marmara-1", "Kent Panorama", "İstanbul", "Kartal", 2022, "konut", 96, "/developers/istanbul.webp", "Deniz manzaralı 96 daire ve ticari birimler.")],
  }),
];

export const sampleContractorById = (samples: readonly ContractorFirm[], id: string) => samples.find((item) => item.id === id) || null;
/** Samples that fit the visitor's filters (province, specialty, land deals); a verified filter shows none. */
export function matchSampleContractors(samples: readonly ContractorFirm[], query: { city?: string; specialty?: string; verified?: boolean; q?: string }) {
  if (query.verified || (query.q && query.q.trim())) return [];
  return samples.filter((item) => (!query.city || item.areas.some((area) => area.city === query.city)) && (!query.specialty || item.specialties.includes(query.specialty as never)));
}
