// URL parameters of the service results (/hizmetler/ara and the category/region pages). Filters live
// in the address so every result page can be shared and crawled; the same parser runs on the server
// (route props) and in the browser (filter form). Parameter names are Turkish like the paths:
//   q            firm name or description words
//   kategori     category slug, repeatable (or grup=<group id> for a whole group)
//   il, ilce     province and district slugs (lib/region-pages.ts regionSlug)
//   dogrulanmis=1, fotografli=1, sirala=yeni|a-z, sayfa=2…
import { cityBySlug, districtBySlug, regionSlug } from "./region-pages";
import { categoriesOf, isServiceSlug, serviceGroup, type ServiceSlug } from "./service-categories";
import { SERVICE_BASE, SERVICE_MAX_PAGE, servicePath, type ServiceQuery, type ServiceSort } from "./services";

export const SERVICE_SEARCH_PATH = `${SERVICE_BASE}/ara`;
const SORT_PARAM: Record<ServiceSort, string> = { featured: "", newest: "yeni", az: "a-z" };

export type ServiceFilters = {
  q: string; categories: ServiceSlug[]; city: string; district: string;
  verified: boolean; photos: boolean; sort: ServiceSort; page: number;
};
export const EMPTY_SERVICE_FILTERS: ServiceFilters = { q: "", categories: [], city: "", district: "", verified: false, photos: false, sort: "featured", page: 1 };

type Params = URLSearchParams | Record<string, string | string[] | undefined>;
const all = (params: Params, name: string): string[] => {
  if (params instanceof URLSearchParams) return params.getAll(name);
  const value = params[name];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
};
const one = (params: Params, name: string) => all(params, name)[0] ?? "";

/** Page number from ?sayfa: whole numbers from 1; anything else is page 1. */
export function servicePageParam(value: unknown) {
  const text = Array.isArray(value) ? value[0] : value;
  if (typeof text !== "string" || !/^\d{1,6}$/.test(text)) return 1;
  return Math.max(1, Math.min(SERVICE_MAX_PAGE, Number(text)));
}

/** Address parameters → filters. Unknown categories, places and values are dropped. */
export function parseServiceFilters(params: Params): ServiceFilters {
  let categories = [...new Set(all(params, "kategori").filter(isServiceSlug))].slice(0, 31) as ServiceSlug[];
  const group = one(params, "grup");
  if (!categories.length && serviceGroup(group)) categories = categoriesOf(group).map((item) => item.slug as ServiceSlug);
  const city = cityBySlug(one(params, "il")) || "";
  const district = city ? districtBySlug(city, one(params, "ilce")) || "" : "";
  const sortParam = one(params, "sirala");
  const sort = (Object.entries(SORT_PARAM).find(([, value]) => value && value === sortParam)?.[0] || "featured") as ServiceSort;
  return {
    q: one(params, "q").replace(/\s+/g, " ").trim().slice(0, 100), categories, city, district,
    verified: one(params, "dogrulanmis") === "1", photos: one(params, "fotografli") === "1", sort, page: servicePageParam(one(params, "sayfa")),
  };
}

/** Filters → database query (lib/services.ts searchFirms). */
export const serviceQuery = (filters: ServiceFilters): ServiceQuery => ({
  q: filters.q, categories: filters.categories, city: filters.city || undefined, district: filters.district || undefined,
  verified: filters.verified, photos: filters.photos, sort: filters.sort, page: filters.page,
});

/**
 * Whether the filters are exactly a category/region page (/hizmetler/{kategori}[/{il}[/{ilçe}]]):
 * one category, optionally a place, nothing else. Those results have one canonical, indexable address.
 */
export const isCanonicalServiceScope = (filters: Pick<ServiceFilters, "q" | "categories" | "verified" | "photos" | "sort">) =>
  filters.categories.length === 1 && !filters.q && !filters.verified && !filters.photos && filters.sort === "featured";

/** Address of a results page: the category/region page when the filters are exactly one, else /hizmetler/ara?…. */
export function serviceSearchHref(input: Partial<ServiceFilters>) {
  const filters = { ...EMPTY_SERVICE_FILTERS, ...input };
  if (isCanonicalServiceScope(filters)) {
    const path = servicePath(filters.categories[0], filters.city || null, filters.district || null);
    return filters.page > 1 ? `${path}?sayfa=${filters.page}` : path;
  }
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  for (const slug of filters.categories) params.append("kategori", slug);
  if (filters.city) { params.set("il", regionSlug(filters.city)); if (filters.district) params.set("ilce", regionSlug(filters.district)); }
  if (filters.verified) params.set("dogrulanmis", "1");
  if (filters.photos) params.set("fotografli", "1");
  if (SORT_PARAM[filters.sort]) params.set("sirala", SORT_PARAM[filters.sort]);
  if (filters.page > 1) params.set("sayfa", String(filters.page));
  const query = params.toString();
  return query ? `${SERVICE_SEARCH_PATH}?${query}` : SERVICE_SEARCH_PATH;
}

/** Page numbers to link: first, last and two around the current one, with gaps as null ("1 … 4 5 6 … 20"). */
export function servicePageList(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((item) => item >= 1 && item <= pages));
  const sorted = [...wanted].sort((a, b) => a - b), list: (number | null)[] = [];
  for (const item of sorted) { if (list.length && item - (list[list.length - 1] as number) > 1) list.push(null); list.push(item); }
  return list;
}

/** Keeps a shared ?lang link when the visitor moves between result pages in the browser. */
export function withLang(href: string, lang: string | null) {
  if (!lang) return href;
  return `${href}${href.includes("?") ? "&" : "?"}lang=${encodeURIComponent(lang)}`;
}
