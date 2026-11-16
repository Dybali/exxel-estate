// Public listing search: the one query behind GET /api/listings, the /ilanlar page and the home page's
// featured listings (server-rendered first page). Published customer listings come first; labelled sample
// listings (source "demo") only fill the remaining slots and are counted separately (realTotal/sampleTotal).
// Dependencies are passed in so the query runs against node:sqlite in tests (tests/listing-search.test.mjs).
import {PRICE_DROP_SQL} from "./price-history";
import {textSearchSql,matchesSearchText} from "./text-search";
import {categoryFilter,categoryMatches} from "./property-categories";
import {extraFilterMatches,extraFilterSql} from "./search-categories";
import {tlPriceRange} from "./price-filters";
import {areaBounds,listingInArea,mapBoundsSql,validArea,validBounds} from "./search-filters";
import {AMENITIES,PUBLIC_DEMO_LISTINGS,type Listing} from "./listings";
import {compareListings,listingOrderSql,listingSort,priceSort,strictSort,tlPrice,tlPriceSql,tlRates} from "./listing-sort";
import {bboxSql,inBbox,parseBbox} from "./listing-location";
import type {RateSnapshot} from "./tcmb";

type Statement={bind(...values:unknown[]):Statement;first<T>():Promise<T|null>;all<T>():Promise<{results?:T[]}>};
export type ListingSearchDatabase={prepare(query:string):Statement};
export type ListingSearchDeps={
  db:ListingSearchDatabase;
  /** Database row (listings l JOIN users u) to the public listing shape. */
  parse:(row:Record<string,unknown>)=>Listing;
  /** Extra owner columns selected with every row (lib/server.ts OWNER_VERIFIED_SQL). */
  ownerColumns:string;
  /** TCMB bulletin; only loaded when a price sort or price range needs it. */
  loadRates:()=>Promise<RateSnapshot|null>;
  /** Sample listings (defaults to PUBLIC_DEMO_LISTINGS). */
  samples?:Listing[];
};
export type ListingSearchResult={listings:Listing[];total:number;realTotal?:number;sampleTotal?:number;page:number;pageSize:number;unlocated?:number};
export class ListingSearchError extends Error{constructor(message:string,readonly status:number){super(message);}}

export async function searchListings(q:URLSearchParams,deps:ListingSearchDeps):Promise<ListingSearchResult>{
  const database=deps.db;
  const sort=listingSort(q.get("sort"));
  // Prices are compared in Turkish lira: legacy EUR/USD/GBP rows and a price range entered in the
  // visitor's display currency are converted with one TCMB bulletin for the whole request.
  const snapshot=priceSort(sort)||q.get("minPrice")||q.get("maxPrice")?await deps.loadRates():null,rates=tlRates(snapshot);
  let range;try{range=tlPriceRange(q,snapshot);}catch{throw new ListingSearchError("Geçersiz para birimi.",400);}
  if(!range)throw new ListingSearchError("Kur verisi şu anda alınamıyor. Fiyat aralığını TL olarak girin.",503);
  const tlSql=tlPriceSql(rates);
  const page=Math.min(1000,Math.max(1,Math.floor(Number(q.get("page")))||1)),pageSize=q.get("map")==="1"?500:12;
  const where=["l.status='published'"],values:(string|number)[]=[];
  const category=categoryFilter(q.get("category")||"");if(category){where.push(category.where);values.push(...category.values);}
  const textFilter=textSearchSql(q.get("q")||"");if(textFilter.where){where.push(textFilter.where);values.push(...textFilter.values);}
  const equals:Record<string,string>={purpose:"purpose",city:"city",district:"district",type:"property_type",neighborhood:"neighborhood"};
  for(const [param,column] of Object.entries(equals)){const v=q.get(param);if(v&&v.length<80){where.push(`l.${column}=?`);values.push(v)}}
  if(range.min!==undefined){where.push(`${tlSql}>=?`);values.push(range.min);}
  if(range.max!==undefined){where.push(`${tlSql}<=?`);values.push(range.max);}
  for(const [param,column,op] of [["minArea","gross_area",">="],["maxArea","gross_area","<="],["bedrooms","bedrooms",">="],["bathrooms","bathrooms",">="]] as const){const v=q.get(param);if(v&&/^\d{1,12}$/.test(v)){where.push(`l.${column}${op}?`);values.push(Number(v))}}
  if(q.get("furnished")==="1")where.push("l.furnished=1");
  const extra=extraFilterSql(q);where.push(...extra.where);values.push(...extra.values);
  if(q.get('assistant')==='1'&&q.get('furnished')==='0')where.push('l.furnished=0');
  const chosen=(q.get("amenities")||"").split(",").filter((a)=>AMENITIES.includes(a)).slice(0,12);
  for(const a of chosen){where.push("EXISTS (SELECT 1 FROM json_each(l.amenities) WHERE value=?)");values.push(a)}
  // Non-spatial filters: also used for the "Konumu olmayan N ilan" count of the map view.
  const baseWhere=[...where],baseValues=[...values],mapMode=q.get("map")==="1";
  const bounds=validBounds(q.get("bounds")||"");
  if(bounds){const spatial=mapBoundsSql(bounds);where.push(spatial.where);values.push(...spatial.values);}
  const area=validArea(q.get("area")||"");
  if(area){const spatial=mapBoundsSql(areaBounds(area));where.push(spatial.where);values.push(...spatial.values);}
  // Map search box: plain ranges on the public point columns (approximate pins are already offset there).
  const bbox=parseBbox(q.get("bbox"));
  if(bbox){const spatial=bboxSql(bbox);where.push(spatial.where);values.push(...spatial.values);}
  // The map shows pinned listings only; the rest are counted and stay in the list view.
  if(mapMode)where.push("l.latitude IS NOT NULL AND l.longitude IS NOT NULL");
  const query=where.join(" AND ");
  const order=listingOrderSql(sort,rates);
  const select=`SELECT l.*,u.name AS owner_name,${deps.ownerColumns},${PRICE_DROP_SQL} FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${query} ORDER BY ${order}`;
  const demoBase=(q.get('assistant')==='1'?[]:deps.samples||PUBLIC_DEMO_LISTINGS).filter((l)=>{
    if(!matchesSearchText(q.get("q")||"",l))return false;
    if(!categoryMatches(q.get('category')||'',l))return false;
    if(q.get("neighborhood")&&l.neighborhood!==q.get("neighborhood"))return false;
    for(const [param,field] of [["purpose","purpose"],["city","city"],["district","district"],["type","propertyType"]] as const){const v=q.get(param);if(v&&l[field]!==v)return false}
    if(range.min!==undefined||range.max!==undefined){const value=tlPrice(l,rates);if(value===undefined||range.min!==undefined&&value<range.min||range.max!==undefined&&value>range.max)return false;}
    for(const [param,field,compare] of [["minArea","grossArea","min"],["maxArea","grossArea","max"],["bedrooms","bedrooms","min"],["bathrooms","bathrooms","min"]] as const){const v=q.get(param);if(v&&Number.isFinite(Number(v))){const n=Number(l[field]||0);if(compare==="min"&&n<Number(v)||compare==="max"&&n>Number(v))return false}}
    if(q.get("furnished")==="1"&&!l.furnished)return false;
    if(!extraFilterMatches(q,l))return false;
    if(chosen.some((a)=>!l.amenities.includes(a)))return false;
    return true;
  }).sort(compareListings(sort,rates));
  // Sample listings sit at their province centre ("province"): not a pin, so never on the map or in a bbox.
  const pinned=(l:Listing)=>l.latitude!=null&&l.longitude!=null&&l.locationPrecision!=="province";
  const demo=demoBase.filter((l)=>{
    if(bounds&&(!l.latitude||!l.longitude||l.longitude<bounds[0]||l.latitude<bounds[1]||l.longitude>bounds[2]||l.latitude>bounds[3]))return false;
    if(area&&!listingInArea(l,area))return false;
    if(bbox&&!(pinned(l)&&inBbox(bbox,l.latitude,l.longitude)))return false;
    if(mapMode&&!pinned(l))return false;
    return true;
  });
  // Map rows carry only what a marker and its popup card need.
  const mapRow=(l:Listing)=>({...l,locationPrecision:l.locationPrecision||"approximate" as const,description:"",images:l.images.slice(0,1),presentation:undefined,translations:l.translations?Object.fromEntries(Object.entries(l.translations).map(([code,item])=>[code,{title:item?.title||"",description:""}])):undefined});
  const unlocated=async()=>{if(!mapMode)return undefined;const row=await database.prepare(`SELECT count(*) AS n FROM listings l WHERE ${baseWhere.join(" AND ")} AND (l.latitude IS NULL OR l.longitude IS NULL)`).bind(...baseValues).first<{n:number}>();return Number(row?.n||0)+demoBase.filter(l=>!pinned(l)).length;};
  if(area){
    // The bounding box narrows the query in SQL; the polygon test runs here, so results are paged in memory.
    const rows=await database.prepare(`${select} LIMIT 500`).bind(...values).all<Record<string,unknown>>();
    const inside=[...(rows.results||[]).map(deps.parse).filter(l=>listingInArea(l,area)),...demo];
    const pageRows=inside.slice((page-1)*pageSize,page*pageSize);
    return {listings:mapMode?pageRows.map(mapRow):pageRows,total:inside.length,page,pageSize,unlocated:await unlocated()};
  }
  const count=await database.prepare(`SELECT count(*) AS n FROM listings l WHERE ${query}`).bind(...values).first<{n:number}>();
  const realCount=Number(count?.n||0);
  const pageStart=(page-1)*pageSize;
  // Published customer listings appear first; demo content only fills remaining slots.
  const ordered=strictSort(sort);
  const realOffset=Math.min(ordered?Math.max(0,pageStart-demo.length):pageStart,realCount);
  const realLimit=Math.max(0,Math.min(ordered?pageStart+pageSize-realOffset:pageSize,realCount-realOffset));
  let real:Listing[]=[];
  if(realLimit>0){const rows=await database.prepare(`${select} LIMIT ? OFFSET ?`).bind(...values,realLimit,realOffset).all<Record<string,unknown>>();real=(rows.results||[]).map(deps.parse)}
  const demoOffset=Math.max(0,pageStart-realCount);
  const listings=ordered?[...real,...demo].sort(compareListings(sort,rates)).slice(pageStart-realOffset,pageStart-realOffset+pageSize):[...real,...demo.slice(demoOffset,demoOffset+pageSize-real.length)];
  return {listings:mapMode?listings.map(mapRow):listings,total:demo.length+realCount,realTotal:realCount,sampleTotal:demo.length,page,pageSize,unlocated:await unlocated()};
}
