import {LAND_CREDIT,LAND_DEED,LAND_ZONING} from './land';
import {SUBTYPE_FIELDS,subtypeFor,type SubtypeField} from './property-subtypes';
import {AMENITIES,type Listing} from './listings';
import {DETAIL_FIELDS} from './listing-details';

// Search fields per home page category tab, modelled on the usual Turkish portals: each tab
// asks only what makes sense for it (no room count for land, floors for buildings and so on).
export type SearchFieldKey='type'|'city'|'rooms'|'minArea'|'maxArea'|'minPrice'|'maxPrice'|'maxAge'|'minFloors'|'zoning'|'deed'|'credit'|SubtypeField|'furnished';
export type SearchCategory={purposes:readonly string[];main:readonly SearchFieldKey[];extra:readonly SearchFieldKey[]};

export const ROOM_OPTIONS=['1+0','1+1','1.5+1','2+0','2+1','2.5+1','2+2','3+0','3+1','3.5+1','3+2','4+1','4.5+1','4+2','5+1','5+2','6+1','6+2','7+1','8+1','9+1','10 Üzeri'] as const;
export const HEATING_OPTIONS=['Yok','Soba','Doğalgaz Sobası','Kat Kaloriferi','Merkezi','Merkezi (Pay Ölçer)','Kombi (Doğalgaz)','Kombi (Elektrik)','Yerden ısıtma','Klima','Fancoil Ünitesi','Güneş Enerjisi','Elektrikli Radyatör','Jeotermal','Şömine','VRV','Isı Pompası'] as const;
// Older listings stored a shorter heating name; searching the new name also finds them.
const HEATING_ALIASES:Record<string,string[]>={'Kombi (Doğalgaz)':['Kombi']};
export const AGE_OPTIONS=['0','5','10','20','30'] as const;
export const FLOOR_OPTIONS=['2','3','5','10','20'] as const;
export const DAY_OPTIONS=['1','3','7','15','30'] as const;

export const SEARCH_CATEGORIES:Record<string,SearchCategory>={
 konut:{purposes:['satilik','kiralik','gunluk'],main:['type','city','rooms'],extra:['minPrice','maxPrice','minArea','maxArea','maxAge','furnished']},
 isyeri:{purposes:['satilik','kiralik','devren'],main:['businessType','city','minArea'],extra:['maxArea','minPrice','maxPrice','maxAge']},
 arsa:{purposes:['satilik','kiralik'],main:['city','zoning','deed'],extra:['minPrice','maxPrice','minArea','maxArea','credit']},
 bina:{purposes:['satilik','kiralik'],main:['city','minFloors','maxAge'],extra:['minPrice','maxPrice','minArea','maxArea']},
 devremulk:{purposes:['satilik'],main:['city','rooms','maxPrice'],extra:['minPrice','minArea','maxArea']},
 turistik:{purposes:['satilik','kiralik','gunluk'],main:['tourismType','city','maxPrice'],extra:['minPrice','minArea','maxArea']},
};

// Listings page side panel: which blocks each category shows. No category means homes and
// everything else together, so the home blocks stay available.
export type SidebarConfig={rooms:boolean;building:boolean;heating:boolean;furnished:boolean;land:boolean;amenities:readonly string[]};
const HOME:SidebarConfig={rooms:true,building:true,heating:true,furnished:true,land:false,amenities:AMENITIES};
export const SIDEBARS:Record<string,SidebarConfig>={
 '':HOME,konut:HOME,
 isyeri:{rooms:false,building:false,heating:false,furnished:false,land:false,amenities:[]},
 arsa:{rooms:false,building:false,heating:false,furnished:false,land:true,amenities:[]},
 bina:{rooms:false,building:true,heating:true,furnished:false,land:false,amenities:['Asansör','Otopark']},
 devremulk:{rooms:true,building:false,heating:false,furnished:false,land:false,amenities:[]},
 turistik:{rooms:false,building:false,heating:false,furnished:false,land:false,amenities:[]},
};
const CATEGORY_OF_TYPE:Record<string,string>={ticari:'isyeri',arsa:'arsa',bina:'bina',devremulk:'devremulk',turistik:'turistik'};
// Category a search effectively targets: the chosen category, else the one the chosen type belongs to.
export const searchCategory=(category:string,type:string)=>category||(type?CATEGORY_OF_TYPE[type]||'konut':'');

// Filters beyond the plain column equality ones in app/api/listings; shared by the API and the listings page.
export const EXTRA_FILTERS=['rooms','minNetArea','maxNetArea','minAge','maxAge','minFloor','maxFloor','minFloors','maxFloors','heating','from','days','video','tour','mapped','zoning','deed','credit','businessType','tourismType','detailKitchen','detailUsage','detailSite','detailCredit','detailDeed','detailSwap'] as const;
export type ExtraFilter=typeof EXTRA_FILTERS[number];
type Query={get:(key:string)=>string|null};
const LAND_OPTIONS={zoning:LAND_ZONING,deed:LAND_DEED,credit:LAND_CREDIT} as const;
const small=(value:string|null)=>value&&/^\d{1,3}$/.test(value)?Number(value):null;
const large=(value:string|null)=>value&&/^\d{1,12}$/.test(value)?Number(value):null;
const subtype=(field:SubtypeField,value:string|null)=>value&&subtypeFor(field).options.includes(value)?value:null;
const land=(key:keyof typeof LAND_OPTIONS,value:string|null)=>value&&(LAND_OPTIONS[key] as readonly string[]).includes(value)?value:null;
const list=(value:string|null,options:readonly string[])=>(value||'').split(',').filter(item=>options.includes(item)).slice(0,options.length);
// Rooms come from the list or are typed ("Diğer"), so any well formed layout is accepted.
const roomList=(q:Query)=>(q.get('rooms')||'').split(',').map(item=>item.trim()).filter(item=>(ROOM_OPTIONS as readonly string[]).includes(item)||/^\d{1,2}(\.5)?\+\d{1,2}$/.test(item)).slice(0,30);
const detail=(form:string,value:string|null)=>{const field=DETAIL_FIELDS.find(item=>item.form===form);return field&&value&&(field.options as readonly string[]).includes(value)?field.key:null;};
const heatingValues=(q:Query)=>list(q.get('heating'),HEATING_OPTIONS).flatMap(item=>[item,...(HEATING_ALIASES[item]||[])]);
const sinceDays=(q:Query,now:number)=>{const days=q.get('days');return (DAY_OPTIONS as readonly string[]).includes(days||'')?new Date(now-Number(days)*86400000).toISOString():null;};
// [param, column, listing field, operator, parser]
const RANGES=[['minNetArea','net_area','netArea','>=',large],['maxNetArea','net_area','netArea','<=',large],['minAge','building_age','buildingAge','>=',small],['maxAge','building_age','buildingAge','<=',small],['minFloor','floor','floor','>=',small],['maxFloor','floor','floor','<=',small],['minFloors','total_floors','totalFloors','>=',small],['maxFloors','total_floors','totalFloors','<=',small]] as const;

export function extraFilterSql(q:Query,now=Date.now()){
 const where:string[]=[],values:(string|number)[]=[];
 for(const [param,column,,op,parse] of RANGES){const value=parse(q.get(param));if(value!=null){where.push(`l.${column}${op}?`);values.push(value);}}
 const rooms=roomList(q);if(rooms.length){where.push(`l.rooms IN (${rooms.map(()=>'?').join(',')})`);values.push(...rooms);}
 const heating=heatingValues(q);if(heating.length){where.push(`l.heating IN (${heating.map(()=>'?').join(',')})`);values.push(...heating);}
 const from=q.get('from');if(from==='agent'||from==='owner')where.push(`${from==='owner'?'NOT ':''}EXISTS(SELECT 1 FROM users fu WHERE fu.id=l.owner_id AND fu.role='agent')`);
 const since=sinceDays(q,now);if(since){where.push('COALESCE(l.published_at,l.created_at)>=?');values.push(since);}
 if(q.get('video')==='1')where.push("COALESCE(json_extract(l.presentation,'$.videoUrl'),'')<>''");
 if(q.get('tour')==='1')where.push("COALESCE(json_extract(l.presentation,'$.tourUrl'),'')<>''");
 if(q.get('mapped')==='1')where.push('l.latitude IS NOT NULL');
 for(const key of ['zoning','deed','credit'] as const){const value=land(key,q.get(key));if(value){where.push(`json_extract(l.presentation,'$.land.${key}')=?`);values.push(value);}}
 for(const {field} of SUBTYPE_FIELDS){const value=subtype(field,q.get(field));if(value){where.push(`json_extract(l.presentation,'$.${field}')=?`);values.push(value);}}
 for(const {form} of DETAIL_FIELDS){const value=q.get(form),key=detail(form,value);if(key){where.push(`json_extract(l.presentation,'$.details.${key}')=?`);values.push(value!);}}
 return {where,values};
}

export function extraFilterMatches(q:Query,listing:Listing,now=Date.now()){
 for(const [param,,field,op,parse] of RANGES){const value=parse(q.get(param));const actual=listing[field];if(value!=null&&!(actual!=null&&(op==='>='?actual>=value:actual<=value)))return false;}
 const rooms=roomList(q);if(rooms.length&&!rooms.includes(listing.rooms||''))return false;
 const heating=heatingValues(q);if(heating.length&&!heating.includes(listing.heating||''))return false;
 const from=q.get('from');if(from==='agent'&&listing.ownerRole!=='agent'||from==='owner'&&listing.ownerRole==='agent')return false;
 const since=sinceDays(q,now);if(since&&!((listing.publishedAt||listing.createdAt||'')>=since))return false;
 if(q.get('video')==='1'&&!listing.presentation?.videoUrl||q.get('tour')==='1'&&!listing.presentation?.tourUrl||q.get('mapped')==='1'&&listing.latitude==null)return false;
 for(const key of ['zoning','deed','credit'] as const){const value=land(key,q.get(key));if(value&&listing.presentation?.land?.[key]!==value)return false;}
 for(const {field} of SUBTYPE_FIELDS){const value=subtype(field,q.get(field));if(value&&listing.presentation?.[field]!==value)return false;}
 for(const {form} of DETAIL_FIELDS){const value=q.get(form),key=detail(form,value);if(key&&listing.presentation?.details?.[key]!==value)return false;}
 return true;
}
