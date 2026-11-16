// The /ilanlar search state as a query string: shared by the Explorer (browser) and the server page, so the
// server can render exactly the first page the browser would otherwise request from /api/listings.
import {AMENITIES} from "./listings";
import {priceCurrency} from "./price-filters";
import {EXTRA_FILTERS,type ExtraFilter} from "./search-categories";

type Params = { get: (key: string) => string | null };
export type Filters = {
  q:string; category:string; neighborhood:string; currency:string; purpose: string; city: string; district: string; type: string;
  minPrice: string; maxPrice: string; minArea: string; maxArea: string;
  bedrooms: string; bathrooms: string; furnished: boolean;
  amenities: string[];
} & Record<ExtraFilter,string>;
const emptyExtras=Object.fromEntries(EXTRA_FILTERS.map(key=>[key,""])) as Record<ExtraFilter,string>;
export const emptyFilters: Filters = {
  q:"", category:"", neighborhood:"", currency:"", purpose: "", city: "", district: "", type: "", minPrice: "", maxPrice: "",
  minArea: "", maxArea: "", bedrooms: "", bathrooms: "",
  furnished: false, amenities: [], ...emptyExtras,
};
const filterKeys = Object.keys(emptyFilters) as (keyof Filters)[];

export function readFilters(params: Params): Filters {
  return {
    q:(params.get("q")||"").slice(0,160),category:params.get("category")==="devren"?"":params.get("category")||"",neighborhood:params.get("neighborhood")||"",
    currency:(()=>{try{return priceCurrency(params);}catch{return "";}})(),
    purpose: params.get("category")==="devren"?"devren":params.get("purpose") || "", city: params.get("city") || "",
    district: params.get("district") || "", type: params.get("type") || "",
    minPrice: params.get("minPrice") || "", maxPrice: params.get("maxPrice") || "",
    minArea: params.get("minArea") || "", maxArea: params.get("maxArea") || "",
    bedrooms: params.get("bedrooms") || "",
    bathrooms: params.get("bathrooms") || "", furnished: params.get("furnished") === "1",
    amenities: (params.get("amenities") || "").split(",").filter((item) => AMENITIES.includes(item)),
    ...Object.fromEntries(EXTRA_FILTERS.map(key=>[key,(params.get(key)||"").slice(0,400)])) as Record<ExtraFilter,string>,
  };
}
export function filterQuery(filters: Filters, sort: string) {
  const query = new URLSearchParams();
  for (const key of filterKeys) {
    const value = filters[key];
    if (key === "amenities") { if (filters.amenities.length) query.set(key, filters.amenities.join(",")); }
    else if (key === "furnished") { if (filters.furnished) query.set(key, "1"); }
    else if (value) query.set(key, String(value));
  }
  if (sort !== "new") query.set("sort", sort);
  return query;
}
/** The Explorer's /api/listings query (without page): filters, sort, assistant flags and map area. */
export function explorerQuery(filters: Filters, sort: string, params: Params, bounds: string, area: string) {
  const q = filterQuery(filters, sort);
  if (params.get('assistant') === '1') { q.set('assistant', '1'); if (!filters.furnished && params.get('furnished') === '0') q.set('furnished', '0'); }
  if (bounds) q.set("bbox", bounds);
  if (area) q.set("area", area);
  return q.toString();
}
/** The query a freshly opened /ilanlar page requests first ("bounds" is the older name of "bbox"). */
export function initialExplorerQuery(params: Params) {
  return explorerQuery(readFilters(params), params.get("sort") || "new", params, params.get("bbox") || params.get("bounds") || "", params.get("area") || "");
}
