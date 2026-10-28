import {activeTeamCompany} from '@/lib/company-team-server';
import {officePublicationAllowed} from '@/lib/office-verification-server';
import {listingExpired} from '@/lib/listing-policy';
import {publicListing} from '@/lib/listings';
import {reportsDB} from '@/lib/reports-server';
import {scheduleListingTranslations} from '@/lib/translation-runtime';
import {presentationFrom} from "@/lib/presentation";
import { AMENITIES, PROPERTY_TYPES } from "@/lib/listings";
import { externalR2BucketName, headExternalImage } from "@/lib/external-r2";
import { findNeighborhood } from "@/lib/turkey-neighborhoods";
import { validDistrict } from "@/lib/turkey-locations";
import { body, currentUser, db, error, isAdmin, listingById, now, num, ok, sameOrigin, str } from "@/lib/server";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params,listing=await listingById(id);
  if(!listing) return error("İlan bulunamadı.",404);
  if(listing.source==="user" && listing.status!=="published") {
    const user=await currentUser(request);
    if(!user || (user.id!==listing.ownerId&&!isAdmin(user))) return error("İlan bulunamadı.",404);
  }
  const viewer=await currentUser(request);
  return ok({listing:viewer&&(viewer.id===listing.ownerId||isAdmin(viewer))?listing:publicListing(listing)},{headers:{"Cache-Control":"private, no-store"}});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request),{id}=await params;
  if(!user) return error("Giriş gerekli.",401);
  if(!user.email_verified)return error('İlan düzenlemek için önce e-posta adresinizi doğrulayın.',403);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return error("İlan bulunamadı.",404);
  const row=await db().prepare("SELECT * FROM listings WHERE id=?").bind(id).first<Record<string,unknown>>();
  if(!row) return error("İlan bulunamadı.",404);
  if(row.owner_id!==user.id&&!isAdmin(user)) return error("Bu ilanı düzenleme yetkiniz yok.",403);
  if(listingExpired(row.expires_at)&&!isAdmin(user))return error('Bu ilanın 20 günlük yayın süresi doldu. Yeni ilan hakkınızı hesabınızdan kontrol edin.',409);
  let data:Record<string,unknown>;
  try{data=await body(request);}catch{return error("İlan bilgilerini kontrol edin.");}
  const expected=str(data.expectedUpdatedAt,40);
  if(expected&&expected!==row.updated_at) return error("İlan başka bir oturumda güncellendi. Sayfayı yenileyin.",409);
  const value=(key:string,column:string,max:number)=>Object.hasOwn(data,key)?str(data[key],max):str(row[column],max);
  const title=value("title","title",150),description=value("description","description",5000),purpose=value("purpose","purpose",20),propertyType=value("propertyType","property_type",30),currency=value("currency","currency",3).toUpperCase(),city=value("city","city",70),district=value("district","district",70);
  const price=Object.hasOwn(data,"price")?num(data.price):Number(row.price),grossArea=Object.hasOwn(data,"grossArea")?num(data.grossArea):Number(row.gross_area);
  if(title.length<12||description.length<30||!["satilik","kiralik","gunluk","devren"].includes(purpose)||!PROPERTY_TYPES.some((item)=>item.value===propertyType)||!["TRY","EUR","USD","GBP"].includes(currency)||!Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(grossArea)||grossArea<=0||grossArea>100000000)return error("İlanın zorunlu alanlarını kontrol edin.");
  if(!validDistrict(city,district))return error("Geçerli bir il ve ilçe seçin.");
  const locationChanged=Object.hasOwn(data,"city")||Object.hasOwn(data,"district")||Object.hasOwn(data,"neighborhoodId");
  const neighborhoodId=locationChanged?num(data.neighborhoodId??row.neighborhood_id):Number(row.neighborhood_id);
  const neighborhood=locationChanged?findNeighborhood(city,district,neighborhoodId):null;
  if(locationChanged&&!neighborhood)return error("Geçerli bir mahalle seçin.");
  const optionalNumber=(key:string,column:string)=>{
    const input=Object.hasOwn(data,key)?data[key]:row[column];
    if(input===""||input===null||input===undefined)return null;
    const parsed=num(input);
    return Number.isSafeInteger(parsed)&&parsed>=0?parsed:NaN;
  };
  const optionalFields=[optionalNumber("netArea","net_area"),optionalNumber("bedrooms","bedrooms"),optionalNumber("bathrooms","bathrooms"),optionalNumber("buildingAge","building_age"),optionalNumber("floor","floor"),optionalNumber("totalFloors","total_floors")];
  if(optionalFields[0]!=null&&(optionalFields[0]<=0||optionalFields[0]>grossArea))return error('Net alan pozitif olmalı ve brüt alandan büyük olmamalıdır.');
  if(optionalFields.slice(1).some(item=>item!=null&&item>100000)||optionalFields[4]!=null&&optionalFields[5]!=null&&optionalFields[4]>optionalFields[5])return error("Oda ve kat bilgilerini kontrol edin. Bulunduğu kat toplam kat sayısından büyük olamaz.");
  if(optionalFields.some((item)=>Number.isNaN(item)))return error("Sayısal özellikleri kontrol edin.");
  const amenities=Object.hasOwn(data,"amenities")?Array.isArray(data.amenities)?data.amenities.filter((item):item is string=>typeof item==="string"&&AMENITIES.includes(item)).slice(0,20):null:JSON.parse(String(row.amenities||"[]")) as string[];
  if(!amenities)return error("Özellikleri kontrol edin.");
  let presentation;try{presentation=presentationFrom({...JSON.parse(String(row.presentation||'{}')),...data},String(row.owner_id));}catch(e){return error((e as Error).message);}
  if(propertyType==='villa'&&(!optionalFields[0]||!presentation.plotArea||presentation.gardenArea==null))return error('Villa için net, arsa ve bahçe alanını girin. Bahçe yoksa 0 yazın.');
  const originalImages=JSON.parse(String(row.images||"[]")) as string[];
  const images=Object.hasOwn(data,"images")?Array.isArray(data.images)?data.images.filter((item):item is string=>typeof item==="string"&&item.startsWith("/api/media/")).slice(0,30):null:originalImages;
  if(!images||images.length<1||images.length>30||new Set(images).size!==images.length)return error("En az bir benzersiz fotoğraf ekleyin.");
  const keys=[...new Set([...images,...(presentation.panoramas||[]).map(scene=>scene.url),presentation.floorPlan].filter(Boolean))].map((image)=>image.slice("/api/media/".length));
  if(keys.some((key)=>!new RegExp(`^listings/${row.owner_id}/[a-f0-9-]+\\.(jpg|png|webp)$`).test(key)))return error("Yalnızca ilan sahibinin yüklediği fotoğraflar kullanılabilir.",403);
  const originalFloorPlan=JSON.parse(String(row.presentation||"{}")).floorPlan as string|undefined;
  const originalPanoramas=(JSON.parse(String(row.presentation||'{}')).panoramas||[]) as {url:string}[];
  const previousKeys=new Set([...originalImages,...originalPanoramas.map(scene=>scene.url),...(originalFloorPlan?[originalFloorPlan]:[])].map((image)=>image.slice("/api/media/".length)));
  const added=keys.filter((key)=>!previousKeys.has(key));
  const addedInfo=await Promise.all(added.map(headExternalImage));
  if(addedInfo.some((item)=>!item))return error("Yeni fotoğraflardan biri depoda bulunamadı.");
  const bucket=externalR2BucketName();
  if(added.length&&!bucket)return error("Fotoğraf deposu yapılandırılmamış.",503);
  const translations=Object.hasOwn(data,"translations")?data.translations:JSON.parse(String(row.translations||"{}"));
  if(!translations||typeof translations!=="object"||Array.isArray(translations))return error("Çevirileri kontrol edin.");
  const cleanTranslations:Record<string,{title:string;description:string}>={};
  for(const locale of ["de","fr","en","ar","ru"]){const entry=(translations as Record<string,unknown>)[locale];if(!entry)continue;if(typeof entry!=="object"||Array.isArray(entry))return error("Çevirileri kontrol edin.");const item=entry as Record<string,unknown>,translatedTitle=str(item.title,150),translatedDescription=str(item.description,5000);if(!translatedTitle&&!translatedDescription)continue;if(translatedTitle.length<12||translatedDescription.length<30)return error("Çeviri başlığı ve açıklaması eksiksiz olmalıdır.");cleanTranslations[locale]={title:translatedTitle,description:translatedDescription};}
  await reportsDB();
  const team=row.agency_id?await activeTeamCompany(user.id):null;
  const status=(team&&team.id===String(row.agency_id)&&await officePublicationAllowed(team.owner_id))||user.role==='agent'&&await officePublicationAllowed(user.id)||isAdmin(user)?"published":"pending";
  const updatedAt=now();
  const statements=[db().prepare("UPDATE listings SET title=?,description=?,purpose=?,property_type=?,price=?,currency=?,city=?,district=?,neighborhood=?,neighborhood_id=?,postal_code=?,gross_area=?,net_area=?,rooms=?,bedrooms=?,bathrooms=?,building_age=?,floor=?,total_floors=?,heating=?,furnished=?,amenities=?,images=?,translations=?,presentation=?,status=CASE WHEN listings.status<>'published' OR EXISTS(SELECT 1 FROM listing_moderation_holds h WHERE h.listing_id=CAST(listings.id AS TEXT) AND h.active=1) THEN 'pending' ELSE ? END,review_note=CASE WHEN EXISTS(SELECT 1 FROM listing_moderation_holds h WHERE h.listing_id=CAST(listings.id AS TEXT) AND h.active=1) THEN review_note ELSE NULL END,reviewed_by=CASE WHEN EXISTS(SELECT 1 FROM listing_moderation_holds h WHERE h.listing_id=CAST(listings.id AS TEXT) AND h.active=1) THEN reviewed_by ELSE NULL END,reviewed_at=CASE WHEN EXISTS(SELECT 1 FROM listing_moderation_holds h WHERE h.listing_id=CAST(listings.id AS TEXT) AND h.active=1) THEN reviewed_at ELSE NULL END,updated_at=? WHERE id=?")
    .bind(title,description,purpose,propertyType,price,currency,city,district,neighborhood?.name??row.neighborhood??null,neighborhood?.id??row.neighborhood_id??null,neighborhood?.postalCode??row.postal_code??null,grossArea,...optionalFields.slice(0,1),value("rooms","rooms",10)||null,...optionalFields.slice(1),value("heating","heating",50)||null,Object.hasOwn(data,"furnished")?data.furnished?1:0:Number(row.furnished)||0,JSON.stringify(amenities),JSON.stringify(images),JSON.stringify(cleanTranslations),JSON.stringify(presentation),status,updatedAt,id)];
  [...new Set([...originalImages,...originalPanoramas.map(scene=>scene.url),...(originalFloorPlan?[originalFloorPlan]:[])])].forEach((image)=>{const key=image.slice("/api/media/".length);if(!keys.includes(key))statements.push(db().prepare("DELETE FROM property_images WHERE property_id=? AND object_key=?").bind(id,key));});
  keys.forEach((key,index)=>{if(previousKeys.has(key))statements.push(db().prepare("UPDATE property_images SET sort_order=? WHERE property_id=? AND object_key=?").bind(index,id,key));else{const info=addedInfo[added.indexOf(key)]!;statements.push(db().prepare("INSERT INTO property_images(id,property_id,storage_provider,bucket,object_key,content_type,byte_size,checksum_sha256,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,"r2",bucket!,key,info.contentType,info.size,info.checksum,index,updatedAt));}});
  if(status==="published")statements.push(db().prepare("UPDATE listings SET published_at=COALESCE(published_at,?) WHERE id=?").bind(updatedAt,id));
  if(Number(row.price)!==price||String(row.currency)!==currency||row.purpose!==purpose)statements.push(db().prepare("INSERT INTO price_history(id,listing_id,old_price,new_price,currency,purpose,changed_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,Number(row.currency===currency&&row.purpose===purpose?row.price:price),price,currency,purpose,updatedAt));
  await db().batch(statements);
  const actual=await db().prepare("SELECT status FROM listings WHERE id=?").bind(id).first<{status:string}>();
  if(actual?.status==='published')scheduleListingTranslations(id);
  return ok({success:true,id,status:actual?.status||status,updatedAt},{headers:{"Cache-Control":"private, no-store"}});
}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request),{id}=await params;
  if(!user) return error("Giriş gerekli.",401);
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return error("İlan bulunamadı.",404);
  const row=await db().prepare("SELECT owner_id FROM listings WHERE id=?").bind(id).first<{owner_id:string}>();
  if(!row) return error("İlan bulunamadı.",404);
  if(row.owner_id!==user.id&&!isAdmin(user)) return error("Yetkiniz yok.",403);
  await db().prepare("DELETE FROM listings WHERE id=?").bind(id).run();
  return ok({success:true});
}
