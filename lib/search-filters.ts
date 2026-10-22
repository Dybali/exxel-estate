import {categoryFilter} from "./property-categories";
import {priceCurrency} from "./price-filters";
import provinceCenters from "@/data/province-centers.json";
// Shared validation for saved searches, alerts and map queries.
export const searchFields = {purpose:"purpose",city:"city",district:"district",type:"property_type",rooms:"rooms",currency:"currency",neighborhood:"neighborhood"};
export const searchRanges = [["minPrice","price",">="],["maxPrice","price","<="],["minArea","gross_area",">="],["maxArea","gross_area","<="],["bedrooms","bedrooms",">="],["bathrooms","bathrooms",">="]] as const;
export function cleanSearch(input: string) {
  if(input.length>3000) throw new Error("Arama çok uzun.");
  const source=new URLSearchParams(input), result=new URLSearchParams();
  const category=source.get("category");if(category&&category.length<30)result.set("category",category);
  for(const key of Object.keys(searchFields)) { const value=source.get(key); if(value&&value.length<80)result.set(key,value); }
  for(const [key] of searchRanges){const value=source.get(key);if(value&&/^\d{1,12}$/.test(value))result.set(key,value);}
  if(source.get("furnished")==="1")result.set("furnished","1");
  const amenities=(source.get("amenities")||"").split(",").filter(value=>value&&value.length<50).slice(0,12);
  if(amenities.length)result.set("amenities",amenities.join(","));
  const bounds=source.get("bounds");if(bounds&&validBounds(bounds))result.set("bounds",bounds);
  const currency=priceCurrency(source);if(currency)result.set("currency",currency);
  result.sort();return result.toString();
}
export function validBounds(value:string):number[]|null {
  const values=value.split(",").map(Number);
  return values.length===4&&values.every(Number.isFinite)&&values[0]>=-180&&values[2]<=180&&values[1]>=-90&&values[3]<=90&&values[0]<values[2]&&values[1]<values[3]?values:null;
}
export function searchSql(query:string) {
  const q=new URLSearchParams(cleanSearch(query)),where=["l.status='published'"],values:(string|number)[]=[];
  const category=categoryFilter(q.get("category")||"");if(category){where.push(category.where);values.push(...category.values);}
  for(const [key,column] of Object.entries(searchFields)){const value=q.get(key);if(value){where.push(`l.${column}=?`);values.push(value);}}
  for(const [key,column,op] of searchRanges){const value=q.get(key);if(value){where.push(`l.${column}${op}?`);values.push(Number(value));}}
  if(q.get("furnished")==="1")where.push("l.furnished=1");
  for(const feature of (q.get("amenities")||"").split(",").filter(Boolean)){where.push("EXISTS (SELECT 1 FROM json_each(l.amenities) WHERE value=?)");values.push(feature);}
  const bounds=validBounds(q.get("bounds")||"");if(bounds){const filter=mapBoundsSql(bounds);where.push(filter.where);values.push(...filter.values);}
  return {where:where.join(" AND "),values};
}

export const centers=provinceCenters as Record<string,number[]>;
export function citiesInBounds(bounds:number[]){return Object.entries(centers).filter(([,p])=>p[1]>=bounds[0]&&p[0]>=bounds[1]&&p[1]<=bounds[2]&&p[0]<=bounds[3]).map(([city])=>city);}
export function mapBoundsSql(bounds:number[]){const cities=citiesInBounds(bounds);return {where:`((l.longitude>=? AND l.latitude>=? AND l.longitude<=? AND l.latitude<=?)${cities.length?` OR ((l.latitude IS NULL OR l.longitude IS NULL) AND l.city IN (${cities.map(()=>"?").join(",")}))`:""})`,values:[...bounds,...cities]};}
