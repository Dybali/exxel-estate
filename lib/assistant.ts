import { z } from 'zod';
import { AMENITIES, PROPERTY_TYPES } from './listings';
import { CITIES, DISTRICTS } from './turkey-locations';

export const assistantLanguages=['tr','en','de','ar','fr','ru'] as const;
export type AssistantLanguage=typeof assistantLanguages[number];
export const filterSchema=z.object({
  purpose:z.enum(['satilik','kiralik']).nullable().default(null),
  city:z.string().max(70).nullable().default(null), district:z.string().max(70).nullable().default(null),
  type:z.enum(['daire','villa','mustakil','rezidans','arsa','ticari']).nullable().default(null),
  currency:z.enum(['TRY','EUR','USD','GBP']).nullable().default(null),
  minPrice:z.number().int().min(0).max(999999999999).nullable().default(null),maxPrice:z.number().int().min(0).max(999999999999).nullable().default(null),
  minArea:z.number().int().min(0).max(1000000).nullable().default(null),maxArea:z.number().int().min(0).max(1000000).nullable().default(null),
  bedrooms:z.number().int().min(0).max(30).nullable().default(null),rooms:z.string().regex(/^\d{1,2}\+\d$/).nullable().default(null),
  amenities:z.array(z.string().max(40)).max(12).default([]),furnished:z.boolean().nullable().default(null),
  sort:z.enum(['newest','priceAsc','priceDesc','area']).default('newest'),
}).strict();
export type AssistantFilters=z.infer<typeof filterSchema>;
export const emptyFilters=():AssistantFilters=>filterSchema.parse({});
export const chatInput=z.object({
  message:z.string().trim().min(1).max(1000),language:z.enum(['auto',...assistantLanguages]).default('auto'),
  uiLanguage:z.enum(assistantLanguages).default('tr'),
  history:z.array(z.object({role:z.enum(['user','assistant']),text:z.string().max(1800)}).strict()).max(10).default([]),
  filters:filterSchema.default({}),
  shownIds:z.array(z.string().uuid()).max(6).default([]),
}).strict();
export type ChatInput=z.infer<typeof chatInput>;
// UI turns also hold result links and warnings; only conversation text belongs in API history.
export function assistantHistory(turns:readonly {role:'user'|'assistant';text:string}[]):ChatInput['history'] {
  return turns.slice(-8).map(({role,text})=>({role,text:text.slice(0,1200)}));
}
export const planSchema=z.object({
  intent:z.enum(['search','compare','details','clarify','chat']),language:z.enum(assistantLanguages),
  reply:z.string().max(1800),filters:filterSchema,
  unverified:z.array(z.string().max(100)).max(5),
}).strict();
export type AssistantPlan=z.infer<typeof planSchema>;
export class AssistantError extends Error {constructor(public code:string,public status=400){super(code);}}
const fold=(s:string)=>s.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').trim();
export function canonicalFilters(input:unknown,requireCurrency=true):AssistantFilters {
  const f=filterSchema.parse(input);
  if(f.city){const city=CITIES.find(x=>fold(x)===fold(f.city!));if(!city)throw new AssistantError('location');f.city=city;}
  if(f.district){
    const matches=Object.entries(DISTRICTS).flatMap(([city,list])=>list.filter(d=>fold(d)===fold(f.district!)).map(d=>({city,district:d})));
    const match=f.city?matches.find(x=>x.city===f.city):matches.length===1?matches[0]:null;
    if(!match)throw new AssistantError('location');f.city=match.city;f.district=match.district;
  }
  if(requireCurrency&&(f.minPrice!==null||f.maxPrice!==null)&&!f.currency)throw new AssistantError('currency');
  if(f.minPrice!==null&&f.maxPrice!==null&&f.minPrice>f.maxPrice||f.minArea!==null&&f.maxArea!==null&&f.minArea>f.maxArea)throw new AssistantError('range');
  if(f.amenities.some(x=>!AMENITIES.includes(x)))throw new AssistantError('amenities');
  f.amenities=[...new Set(f.amenities)];return f;
}
export function assistantQuery(f:AssistantFilters,ids?:string[]) {
  const where=["l.status='published'"],values:(string|number)[]=[];
  for(const [key,column] of Object.entries({purpose:'purpose',city:'city',district:'district',type:'property_type',currency:'currency',rooms:'rooms'})){
    const value=f[key as keyof AssistantFilters];if(value!==null){where.push(`l.${column}=?`);values.push(String(value));}
  }
  for(const [key,column,op] of [['minPrice','price','>='],['maxPrice','price','<='],['minArea','gross_area','>='],['maxArea','gross_area','<='],['bedrooms','bedrooms','>=']] as const){if(f[key]!==null){where.push(`l.${column}${op}?`);values.push(f[key]!);}}
  if(f.furnished!==null){where.push('l.furnished=?');values.push(f.furnished?1:0);}
  for(const a of f.amenities){where.push('EXISTS (SELECT 1 FROM json_each(l.amenities) WHERE value=?)');values.push(a);}
  if(ids){if(!ids.length||ids.length>6||ids.some(x=>!z.string().uuid().safeParse(x).success))throw new AssistantError('input');where.push(`l.id IN (${ids.map(()=>'?').join(',')})`);values.push(...ids);}
  const order={newest:'l.created_at DESC,l.id DESC',priceAsc:'l.price ASC,l.id ASC',priceDesc:'l.price DESC,l.id ASC',area:'l.gross_area DESC,l.id ASC'}[f.sort];
  return {where:where.join(' AND '),values,order};
}
export function filterHref(filters:AssistantFilters) {
  const q=new URLSearchParams({assistant:'1'});for(const [key,value] of Object.entries(filters)){
    if(value===null||Array.isArray(value)&&!value.length||key==='sort'&&value==='newest')continue;
    q.set(key,Array.isArray(value)?value.join(','):typeof value==='boolean'?(value?'1':'0'):String(value));
  }return '/ilanlar?'+q;
}
export function redactContact(text:string){return text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email removed]').replace(/\+\d[\d ()-]{8,}\d/g,'[phone removed]');}
export const filterDeclaration={type:'OBJECT',properties:{
  purpose:{type:'STRING',enum:['satilik','kiralik'],nullable:true},city:{type:'STRING',nullable:true},district:{type:'STRING',nullable:true},type:{type:'STRING',enum:PROPERTY_TYPES.map(x=>x.value),nullable:true},
  currency:{type:'STRING',enum:['TRY','EUR','USD','GBP'],nullable:true},
  ...Object.fromEntries(['minPrice','maxPrice','minArea','maxArea','bedrooms'].map(x=>[x,{type:'INTEGER',nullable:true}])),
  rooms:{type:'STRING',nullable:true},amenities:{type:'ARRAY',items:{type:'STRING',enum:AMENITIES}},furnished:{type:'BOOLEAN',nullable:true},sort:{type:'STRING',enum:['newest','priceAsc','priceDesc','area']},
},required:Object.keys(emptyFilters())};
export const planDeclaration={type:'OBJECT',properties:{intent:{type:'STRING',enum:['search','compare','details','clarify','chat']},language:{type:'STRING',enum:assistantLanguages},reply:{type:'STRING'},filters:filterDeclaration,unverified:{type:'ARRAY',items:{type:'STRING'}}},required:['intent','language','reply','filters','unverified']};
