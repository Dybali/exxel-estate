import {searchText,textSearchSql} from "./text-search";
import {categoryFilter} from "./property-categories";
import {priceCurrency,tlPriceRange} from "./price-filters";
import {tlPriceSql,tlRates} from "./listing-sort";
import type {RateSnapshot} from "./tcmb";
import provinceCenters from "@/data/province-centers.json";
// Shared validation for saved searches, alerts and map queries.
export const searchFields = {purpose:"purpose",city:"city",district:"district",type:"property_type",rooms:"rooms",neighborhood:"neighborhood"};
export const searchRanges = [["minPrice","price",">="],["maxPrice","price","<="],["minArea","gross_area",">="],["maxArea","gross_area","<="],["bedrooms","bedrooms",">="],["bathrooms","bathrooms",">="]] as const;
export function cleanSearch(input: string) {
  if(input.length>3000) throw new Error("Arama çok uzun.");
  const source=new URLSearchParams(input), result=new URLSearchParams();
  const text=searchText(source.get("q")||"");if(text)result.set("q",text);
  const category=source.get("category");if(category&&category.length<30)result.set("category",category);
  for(const key of Object.keys(searchFields)) { const value=source.get(key); if(value&&value.length<80)result.set(key,value); }
  // currency: the currency a price range was entered in (lib/price-filters.ts), kept only with a range.
  for(const [key] of searchRanges){const value=source.get(key);if(value&&/^\d{1,12}$/.test(value))result.set(key,value);}
  if(source.get("furnished")==="1")result.set("furnished","1");
  const amenities=(source.get("amenities")||"").split(",").filter(value=>value&&value.length<50).slice(0,12);
  if(amenities.length)result.set("amenities",amenities.join(","));
  const bounds=source.get("bounds");if(bounds&&validBounds(bounds))result.set("bounds",bounds);
  const area=source.get("area");if(area&&validArea(area))result.set("area",area);
  const currency=priceCurrency(source);if(currency)result.set("currency",currency);
  result.sort();return result.toString();
}
export function validBounds(value:string):number[]|null {
  const values=value.split(",").map(Number);
  return values.length===4&&values.every(Number.isFinite)&&values[0]>=-180&&values[2]<=180&&values[1]>=-90&&values[3]<=90&&values[0]<values[2]&&values[1]<values[3]?values:null;
}
/**
 * Saved searches and alerts. A price range is compared with the TL base price; legacy EUR/USD/GBP
 * rows and a range in another currency use `rates` (the caller's TCMB snapshot). Without a rate for
 * the range's currency the range applies to listings stored in that currency only.
 */
export function searchSql(query:string,rates:RateSnapshot|null=null) {
  const q=new URLSearchParams(cleanSearch(query)),where=["l.status='published'"],values:(string|number)[]=[];
  const text=textSearchSql(q.get("q")||"");if(text.where){where.push(text.where);values.push(...text.values);}
  const category=categoryFilter(q.get("category")||"");if(category){where.push(category.where);values.push(...category.values);}
  for(const [key,column] of Object.entries(searchFields)){const value=q.get(key);if(value){where.push(`l.${column}=?`);values.push(value);}}
  const range=tlPriceRange(q,rates),tl=tlPriceSql(tlRates(rates));
  if(range){if(range.min!==undefined){where.push(`${tl}>=?`);values.push(range.min);}if(range.max!==undefined){where.push(`${tl}<=?`);values.push(range.max);}}
  else{where.push("l.currency=?");values.push(q.get("currency")||"TRY");for(const [key,column,op] of searchRanges.slice(0,2)){const value=q.get(key);if(value){where.push(`l.${column}${op}?`);values.push(Number(value));}}}
  for(const [key,column,op] of searchRanges.slice(2)){const value=q.get(key);if(value){where.push(`l.${column}${op}?`);values.push(Number(value));}}
  if(q.get("furnished")==="1")where.push("l.furnished=1");
  for(const feature of (q.get("amenities")||"").split(",").filter(Boolean)){where.push("EXISTS (SELECT 1 FROM json_each(l.amenities) WHERE value=?)");values.push(feature);}
  const bounds=validBounds(q.get("bounds")||"");if(bounds){const filter=mapBoundsSql(bounds);where.push(filter.where);values.push(...filter.values);}
  // Alert counts use the drawn area's bounding box; the linked list applies the exact polygon.
  const area=validArea(q.get("area")||"");if(area){const filter=mapBoundsSql(areaBounds(area));where.push(filter.where);values.push(...filter.values);}
  return {where:where.join(" AND "),values};
}

export const centers=provinceCenters as Record<string,number[]>;
export function citiesInBounds(bounds:number[]){return Object.entries(centers).filter(([,p])=>p[1]>=bounds[0]&&p[0]>=bounds[1]&&p[1]<=bounds[2]&&p[0]<=bounds[3]).map(([city])=>city);}
export function mapBoundsSql(bounds:number[]){const cities=citiesInBounds(bounds);return {where:`((l.longitude>=? AND l.latitude>=? AND l.longitude<=? AND l.latitude<=?)${cities.length?` OR ((l.latitude IS NULL OR l.longitude IS NULL) AND l.city IN (${cities.map(()=>"?").join(",")}))`:""})`,values:[...bounds,...cities]};}

// Drawn search area: "lng,lat;lng,lat;..." with 3–40 corners.
export function validArea(value:string):[number,number][]|null{
  if(!value||value.length>1200)return null;
  const points=value.split(";").map(point=>point.split(",").map(Number));
  if(points.length<3||points.length>40||points.some(p=>p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))return null;
  return points as [number,number][];
}
export function areaBounds(area:[number,number][]){const lngs=area.map(p=>p[0]),lats=area.map(p=>p[1]);return [Math.min(...lngs),Math.min(...lats),Math.max(...lngs),Math.max(...lats)];}
// Ray casting; listings without exact coordinates are tested at their province centre.
export function insideArea(lng:number,lat:number,area:[number,number][]){
  let inside=false;
  for(let i=0,j=area.length-1;i<area.length;j=i++){const [xi,yi]=area[i],[xj,yj]=area[j];if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;}
  return inside;
}
export function listingInArea(listing:{latitude?:number;longitude?:number;city:string},area:[number,number][]){
  const lat=listing.latitude??centers[listing.city]?.[0],lng=listing.longitude??centers[listing.city]?.[1];
  return lat!=null&&lng!=null&&insideArea(lng,lat,area);
}
