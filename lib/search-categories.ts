import {LAND_CREDIT,LAND_DEED,LAND_ZONING} from './land';
import {SUBTYPE_FIELDS,subtypeFor,type SubtypeField} from './property-subtypes';
import type {Listing} from './listings';

// Search fields per home page category tab, modelled on the usual Turkish portals: each tab
// asks only what makes sense for it (no room count for land, floors for buildings and so on).
export type SearchFieldKey='type'|'city'|'rooms'|'minArea'|'maxArea'|'minPrice'|'maxPrice'|'maxAge'|'minFloors'|'zoning'|'deed'|'credit'|SubtypeField|'furnished';
export type SearchCategory={purposes:readonly string[];main:readonly SearchFieldKey[];extra:readonly SearchFieldKey[]};

export const ROOM_OPTIONS=['1+0','1+1','2+1','3+1','4+1','5+1','6+1'] as const;
export const AGE_OPTIONS=['0','5','10','20','30'] as const;
export const FLOOR_OPTIONS=['2','3','5','10','20'] as const;

export const SEARCH_CATEGORIES:Record<string,SearchCategory>={
 konut:{purposes:['satilik','kiralik','gunluk'],main:['type','city','rooms'],extra:['minPrice','maxPrice','minArea','maxArea','maxAge','furnished']},
 isyeri:{purposes:['satilik','kiralik','devren'],main:['businessType','city','minArea'],extra:['maxArea','minPrice','maxPrice','maxAge']},
 arsa:{purposes:['satilik','kiralik'],main:['city','zoning','deed'],extra:['minPrice','maxPrice','minArea','maxArea','credit']},
 bina:{purposes:['satilik','kiralik'],main:['city','minFloors','maxAge'],extra:['minPrice','maxPrice','minArea','maxArea']},
 devremulk:{purposes:['satilik'],main:['city','rooms','maxPrice'],extra:['minPrice','minArea','maxArea']},
 turistik:{purposes:['satilik','kiralik','gunluk'],main:['tourismType','city','maxPrice'],extra:['minPrice','minArea','maxArea']},
};

// Filters beyond the plain column equality ones in app/api/listings; shared by the API and the listings page.
export const EXTRA_FILTERS=['maxAge','minFloors','zoning','deed','credit','businessType','tourismType'] as const;
export type ExtraFilter=typeof EXTRA_FILTERS[number];
const LAND_OPTIONS={zoning:LAND_ZONING,deed:LAND_DEED,credit:LAND_CREDIT} as const;
const number=(value:string|null)=>value&&/^\d{1,3}$/.test(value)?Number(value):null;
const subtype=(field:SubtypeField,value:string|null)=>value&&subtypeFor(field).options.includes(value)?value:null;
const land=(key:keyof typeof LAND_OPTIONS,value:string|null)=>value&&(LAND_OPTIONS[key] as readonly string[]).includes(value)?value:null;

export function extraFilterSql(q:{get:(key:string)=>string|null}){
 const where:string[]=[],values:(string|number)[]=[];
 const age=number(q.get('maxAge'));if(age!=null){where.push('l.building_age<=?');values.push(age);}
 const floors=number(q.get('minFloors'));if(floors!=null){where.push('l.total_floors>=?');values.push(floors);}
 for(const key of ['zoning','deed','credit'] as const){const value=land(key,q.get(key));if(value){where.push(`json_extract(l.presentation,'$.land.${key}')=?`);values.push(value);}}
 for(const {field} of SUBTYPE_FIELDS){const value=subtype(field,q.get(field));if(value){where.push(`json_extract(l.presentation,'$.${field}')=?`);values.push(value);}}
 return {where,values};
}

export function extraFilterMatches(q:{get:(key:string)=>string|null},listing:Listing){
 const age=number(q.get('maxAge'));if(age!=null&&!(listing.buildingAge!=null&&listing.buildingAge<=age))return false;
 const floors=number(q.get('minFloors'));if(floors!=null&&!(listing.totalFloors!=null&&listing.totalFloors>=floors))return false;
 for(const key of ['zoning','deed','credit'] as const){const value=land(key,q.get(key));if(value&&listing.presentation?.land?.[key]!==value)return false;}
 for(const {field} of SUBTYPE_FIELDS){const value=subtype(field,q.get(field));if(value&&listing.presentation?.[field]!==value)return false;}
 return true;
}
