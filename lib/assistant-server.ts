import { AssistantError, assistantQuery, emptyFilters, type AssistantFilters } from './assistant';
import type { Listing } from './listings';
type Value=string|number;
export interface AssistantDatabase {prepare(query:string):{bind(...values:Value[]):{first<T=Record<string,unknown>>():Promise<T|null>;all<T=Record<string,unknown>>():Promise<{results:T[]}>;run():Promise<unknown>}}}
export async function reserveAssistantUsage(database:AssistantDatabase,clientKey:string,dailyLimit=400,time=new Date()) {
  const day=time.toISOString().slice(0,10),hour=time.toISOString().slice(0,13);
  const keys=[{key:`assistant:member:${clientKey}:${hour}`,limit:20,cost:1},{key:`assistant:global:${day}`,limit:Math.min(2000,Math.max(2,dailyLimit)),cost:2}];
  for(const item of keys){
    await database.prepare('INSERT INTO ai_usage_limits(key,requests,expires_at) VALUES(?,0,?) ON CONFLICT(key) DO NOTHING').bind(item.key,new Date(time.getTime()+3*86400000).toISOString()).run();
    const row=await database.prepare('UPDATE ai_usage_limits SET requests=requests+? WHERE key=? AND requests+?<=? RETURNING requests').bind(item.cost,item.key,item.cost,item.limit).first<{requests:number}>();
    if(!row)throw new AssistantError(item.cost===1?'rate_limit':'daily_limit',429);
  }
  // Only aggregate counters, never messages or identifying account data.
  await database.prepare('DELETE FROM ai_usage_limits WHERE expires_at<?').bind(time.toISOString()).run();
  return async(usage:{input:number;output:number})=>{await database.prepare('UPDATE ai_usage_limits SET input_tokens=input_tokens+?,output_tokens=output_tokens+? WHERE key=?').bind(Math.max(0,Math.ceil(usage.input)),Math.max(0,Math.ceil(usage.output)),`assistant:global:${day}`).run();};
}
export function publicAssistantListing(row:Record<string,unknown>):Listing {
  const array=(v:unknown)=>{try{const data=JSON.parse(String(v||'[]'));return Array.isArray(data)?data.filter((x):x is string=>typeof x==='string'):[];}catch{return [];}};
  const numeric=(v:unknown)=>v==null?undefined:Number(v);
  return {id:String(row.id),title:String(row.title),description:'',purpose:row.purpose as Listing['purpose'],propertyType:row.property_type as Listing['propertyType'],price:Number(row.price),currency:String(row.currency),city:String(row.city),district:String(row.district),grossArea:Number(row.gross_area),netArea:numeric(row.net_area),rooms:row.rooms?String(row.rooms):undefined,bedrooms:numeric(row.bedrooms),bathrooms:numeric(row.bathrooms),buildingAge:numeric(row.building_age),furnished:row.furnished==null?undefined:Boolean(row.furnished),amenities:array(row.amenities),images:array(row.images).filter(x=>x.startsWith('/api/media/')).slice(0,1),source:'user',status:'published'};
}
export async function findAssistantListings(database:AssistantDatabase,filters:AssistantFilters,ids?:string[]) {
  // Details re-read the exact shown IDs, always checking published status again.
  const query=assistantQuery(ids?emptyFilters():filters,ids);
  const count=await database.prepare(`SELECT count(*) AS n FROM listings l WHERE ${query.where}`).bind(...query.values).first<{n:number}>();
  const rows=await database.prepare(`SELECT l.id,l.title,l.purpose,l.property_type,l.price,l.currency,l.city,l.district,l.gross_area,l.net_area,l.rooms,l.bedrooms,l.bathrooms,l.building_age,l.furnished,l.amenities,l.images FROM listings l WHERE ${query.where} ORDER BY ${query.order} LIMIT 6`).bind(...query.values).all<Record<string,unknown>>();
  return {listings:rows.results.map(publicAssistantListing),total:Number(count?.n||0)};
}
