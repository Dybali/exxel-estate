import {validatePanoramas} from './panoramas';
// One portable, private working copy per account. Publishing always uses listing validation.
export type DraftPayload = {fields:Record<string,string>;images:string[];amenities:string[]};
export type DraftRecord = {payload:DraftPayload;version:number;updatedAt:string};
// Values the form fills in by itself; a draft holding only these has nothing worth keeping.
const DEFAULT_FIELDS=new Set(['submissionId','purpose','propertyType','currency','furnished']);
export function draftHasContent(payload?:Partial<DraftPayload>|null){
 if(!payload)return false;
 if(payload.images?.length||payload.amenities?.length)return true;
 return Object.entries(payload.fields||{}).some(([key,value])=>!DEFAULT_FIELDS.has(key)&&typeof value==='string'&&value.trim()!==''&&value.trim()!=='[]');
}
type Value=string|number|null;
export interface DraftDatabase {prepare(query:string):{bind(...values:Value[]):{first<T>():Promise<T|null>}}}
export class DraftError extends Error {constructor(message:string,public status=400){super(message);}}
const fieldNames=new Set(['submissionId','panoramas','eidsNumber','businessType','tourismType','landZoning','landBlock','landParcel','landSheet','landKaks','landGabari','landCredit','landDeed','landSwap','floorPlan','videoUrl','tourUrl','title','description','purpose','propertyType','price','currency','city','district','neighborhoodId','grossArea','netArea','gardenArea','plotArea','rooms','bedrooms','bathrooms','buildingAge','floor','totalFloors','heating','furnished',...['de','fr','en','ar','fa','ru'].flatMap(code=>[`title_${code}`,`description_${code}`])]);
export function validateDraft(input:unknown,userId:string):DraftPayload {
 if(!input||typeof input!=="object"||Array.isArray(input))throw new DraftError('Taslak bilgileri geçersiz.');
 const data=input as Record<string,unknown>;
 if(!data.fields||typeof data.fields!=="object"||Array.isArray(data.fields)||!Array.isArray(data.images)||!Array.isArray(data.amenities))throw new DraftError('Taslak bilgileri geçersiz.');
 const fields:Record<string,string>={};
 for(const [key,value] of Object.entries(data.fields)){if(!fieldNames.has(key)||typeof value!=="string"||value.length>(key==='panoramas'?20000:key.startsWith('description')?5000:['floorPlan','videoUrl','tourUrl'].includes(key)?500:150))throw new DraftError('Taslak alanlarını kontrol edin.');fields[key]=value;}
 if(fields.panoramas){try{validatePanoramas(fields.panoramas,userId);}catch(cause){throw new DraftError((cause as Error).message);}}
 if(fields.currency&&!['TRY','EUR','USD','GBP'].includes(fields.currency))throw new DraftError('Geçersiz para birimi.');
 if(fields.purpose&&!['satilik','kiralik','gunluk','devren'].includes(fields.purpose))throw new DraftError('Taslak bilgileri geçersiz.');
 const prefix=`/api/media/listings/${userId}/`;
 if(data.images.length>30||data.images.some(url=>typeof url!=="string"||!url.startsWith(prefix)||!/^[-a-f0-9]+\.(jpg|png|webp)$/.test(url.slice(prefix.length)))||new Set(data.images).size!==data.images.length)throw new DraftError('Taslak fotoğraflarını kontrol edin.');
 if(data.amenities.length>20||data.amenities.some(value=>typeof value!=="string"||value.length>50))throw new DraftError('Taslak özelliklerini kontrol edin.');
 return {fields,images:data.images as string[],amenities:data.amenities as string[]};
}
export async function readDraft(db:DraftDatabase,userId:string):Promise<DraftRecord|null>{
 const row=await db.prepare('SELECT payload,version,updated_at FROM listing_drafts WHERE user_id=?').bind(userId).first<{payload:string;version:number;updated_at:string}>();
 return row?{payload:JSON.parse(row.payload),version:Number(row.version),updatedAt:row.updated_at}:null;
}
export async function writeDraft(db:DraftDatabase,userId:string,data:Record<string,unknown>){
 const version=data.version;
 if(!Number.isSafeInteger(version)||Number(version)<0)throw new DraftError('Taslak sürümü geçersiz.');
 const time=new Date().toISOString();
 if(data.action==='delete'){
  const deleted=await db.prepare('DELETE FROM listing_drafts WHERE user_id=? AND version=? RETURNING version').bind(userId,Number(version)).first();
  if(!deleted)throw new DraftError('Taslak başka bir sekmede değişti. Sayfayı yenileyin.',409);
  return {draft:null};
 }
 if(data.action!=='save')throw new DraftError('Geçersiz işlem.');
 const payload=validateDraft(data.payload,userId),serialized=JSON.stringify(payload);
 const row=version===0
  ?await db.prepare('INSERT INTO listing_drafts(user_id,payload,version,updated_at) VALUES(?,?,1,?) ON CONFLICT(user_id) DO NOTHING RETURNING version').bind(userId,serialized,time).first<{version:number}>()
  :await db.prepare('UPDATE listing_drafts SET payload=?,version=version+1,updated_at=? WHERE user_id=? AND version=? RETURNING version').bind(serialized,time,userId,Number(version)).first<{version:number}>();
 if(!row)throw new DraftError('Taslak başka bir sekmede değişti. Sayfayı yenileyin.',409);
 return {draft:{payload,version:Number(row.version),updatedAt:time}};
}
