import {publicListingSearch} from "@/lib/listing-search-server";
import {ListingSearchError} from "@/lib/listing-search";
import {activeTeamCompany} from '@/lib/company-team-server';
import {submissionTicket,submittedListing,submissionStatement,SubmissionError} from '@/lib/listing-submissions';
import {nextIndividualSubmission} from '@/lib/listing-policy';
import {validRooms} from "@/lib/listing-details";
import {attachVideoStatement,videoAttachProblem,type VideoDatabase} from "@/lib/listing-video-store";
import {videoFeatureEnabled} from "@/lib/listing-video-server";
import {officeDB,officePublicationAllowed} from '@/lib/office-verification-server';
import {presentationFrom} from "@/lib/presentation";
import {assessListingSave,type RiskDatabase} from "@/lib/listing-risk-server";
import {RISK_REVIEW_NOTE} from "@/lib/listing-risk";
import {listingCurrencyAllowed,TL_ONLY_MESSAGE} from "@/lib/price-filters";
import {AMENITIES,PROPERTY_TYPES} from "@/lib/listings";
import {body,currentUser,db,error,isAdmin,now,num,ok,sameOrigin,str} from "@/lib/server";
import {AGENT_PLANS_ENABLED} from '@/lib/publication-policy';
import {agentPlanAccess,agentInsertGuard} from '@/lib/agent-plan';
import {validDistrict} from "@/lib/turkey-locations";
import {findNeighborhood} from "@/lib/turkey-neighborhoods";
import {externalR2BucketName,headExternalImage} from "@/lib/external-r2";
import {parseLocationInput,resolveLocation} from "@/lib/listing-location";
import {scheduleListingNearby} from "@/lib/neighborhood-info-server";
import {queueListingTranslation} from "@/lib/translation-runtime";

export async function GET(request:Request) {
  try{
    const result=await publicListingSearch(new URL(request.url).searchParams);
    return ok(result,{headers:{"Cache-Control":"public,max-age=20,s-maxage=45,stale-while-revalidate=180"}});
  }catch(cause){if(cause instanceof ListingSearchError)return error(cause.message,cause.status);throw cause;}
}

export async function POST(request:Request) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);
  if(!user) return error("İlan vermek için giriş yapın.",401);
  if(!user.email_verified)return error('İlan vermek için önce e-posta adresinizi doğrulayın.',403);
  const team=await activeTeamCompany(user.id);
  if(!team && !["agent","individual","admin"].includes(user.role)) return error("İlan vermek için hesap türünüzü güncelleyin.",403);
  await officeDB();
  if(user.role==='agent'&&!isAdmin(user)&&!team){
    const verification=await db().prepare('SELECT state,company_snapshot FROM office_verifications WHERE user_id=?').bind(user.id).first<{state:string;company_snapshot:string}>();
    if(!verification||verification.state==='rejected'||verification.company_snapshot!==user.company)return error('Önce ofis yetki belgenizi incelemeye gönderin.',403);
    if(user.agent_status==='rejected'&&verification.state==='approved')return error('Emlakçı hesabınız yönetici tarafından durduruldu. Yöneticiyle iletişime geçin.',403);
    if(AGENT_PLANS_ENABLED){const access=await agentPlanAccess(user.id);if(!access.allowed)return error(access.reason||'Aktif paket gerekli.',403);}
  }
  let data:Record<string,unknown>;
  try {data=await body(request);} catch{return error("İlan bilgilerini kontrol edin.");}
  let ticket;try{ticket=await submissionTicket(db(),user.id,data);if(ticket){const existing=await submittedListing(db(),ticket);if(existing)return ok(existing,{headers:{'Cache-Control':'private, no-store'}});}}catch(cause){if(cause instanceof SubmissionError)return error(cause.message,cause.status);throw cause;}
  if(user.role==='individual'&&!isAdmin(user)&&!team){const quota=await db().prepare('SELECT last_submitted_at FROM individual_listing_quota WHERE user_id=?').bind(user.id).first<{last_submitted_at:string}>();if(quota&&Date.parse(nextIndividualSubmission(String(quota.last_submitted_at)))>Date.now())return error('Bireysel üyeler 45 günde bir ilan verebilir. Sonraki ilan hakkınızı hesabınızdan kontrol edebilirsiniz.',429);}
  const title=str(data.title,150),description=str(data.description,5000),purpose=str(data.purpose,20),propertyType=str(data.propertyType,20),city=str(data.city,70),district=str(data.district,70);
  const neighborhoodId=num(data.neighborhoodId),neighborhood=findNeighborhood(city,district,neighborhoodId);
  const price=num(data.price),grossArea=num(data.grossArea);
  // Prices are entered only in Turkish lira (XML import included); other currencies are display-only.
  if(!listingCurrencyAllowed(data.currency))return error(TL_ONLY_MESSAGE);
  if(title.length<12 || description.length<30 || !["satilik","kiralik","gunluk","devren"].includes(purpose) || !PROPERTY_TYPES.some((p)=>p.value===propertyType) || !city || !district || !Number.isSafeInteger(price) || price<=0 || !Number.isSafeInteger(grossArea) || grossArea<=0 || grossArea>100000000) return error("Zorunlu ilan alanlarını doldurun.");
  if(!validDistrict(city,district) || !neighborhood) return error("Geçerli bir il, ilçe ve mahalle seçin.");
  if(data.netArea!==''&&data.netArea!=null&&(!Number.isSafeInteger(num(data.netArea))||num(data.netArea)<=0||num(data.netArea)>grossArea))return error('Net alan pozitif olmalı ve brüt alandan büyük olmamalıdır.');
  if(propertyType==='villa'&&(!num(data.netArea)||!num(data.plotArea)||data.gardenArea==null||data.gardenArea===''))return error('Villa için net, arsa ve bahçe alanını girin. Bahçe yoksa 0 yazın.');
  for(const key of ["bedrooms","bathrooms","buildingAge","floor","totalFloors"]){const v=data[key];if(v!==undefined&&v!==null&&v!==""&&(!Number.isSafeInteger(num(v))||num(v)<0||num(v)>100000))return error("Oda, banyo ve bina bilgilerini geçerli tam sayılarla doldurun.");}
  if(data.floor!=null&&data.floor!==""&&data.totalFloors!=null&&data.totalFloors!==""&&num(data.floor)>num(data.totalFloors))return error("Bulunduğu kat toplam kat sayısından büyük olamaz.");
  const amenities=Array.isArray(data.amenities)?data.amenities.filter((x):x is string=>typeof x==="string"&&AMENITIES.includes(x)).slice(0,20):[];
  const images=Array.isArray(data.images)?data.images.filter((x):x is string=>typeof x==="string"&&x.startsWith("/api/media/")).slice(0,30):[];
  if(images.length===0) return error("En az bir fotoğraf yükleyin.");
  if(new Set(images).size!==images.length) return error("Aynı fotoğraf birden fazla eklenemez.");
  if(!validRooms(data.rooms))return error("Oda sayısını 3+1 biçiminde yazın.");
  let presentation;try{presentation=presentationFrom(data,user.id);}catch(e){return error((e as Error).message);}
  // Optional map pin: the columns get the public point, the exact pin stays private (lib/listing-location.ts).
  let pin=null;if(Object.hasOwn(data,"latitude")||Object.hasOwn(data,"longitude")){try{pin=resolveLocation(parseLocationInput(data,city),null);}catch(e){return error((e as Error).message);}}
  if(pin?.location)presentation.location=pin.location;
  if(presentation.videoId){if(!videoFeatureEnabled())return error("Video yükleme şu anda kullanılamıyor.",503);try{const problem=await videoAttachProblem(db() as unknown as VideoDatabase,presentation.videoId,user.id,null);if(problem)return error(problem);}catch{return error("Video şu anda doğrulanamadı. Tekrar deneyin.",503);}}
  const imageKeys=[...new Set([...images,...(presentation.panoramas||[]).map(scene=>scene.url),presentation.floorPlan].filter(Boolean))].map((url)=>url.slice("/api/media/".length));
  if(imageKeys.some((key)=>!new RegExp(`^listings/${user.id}/[a-f0-9-]+\\.(jpg|png|webp)$`).test(key))) return error("Yalnızca kendi yüklediğiniz fotoğrafları ekleyebilirsiniz.",403);
  const imageInfo=await Promise.all(imageKeys.map(headExternalImage));
  if(imageInfo.some((item)=>!item)) return error("Fotoğraflardan biri depoda bulunamadı.");
  const storageBucket=externalR2BucketName();
  if(!storageBucket) return error("Fotoğraf deposu yapılandırılmamış.",503);
  const translations:Record<string,{title:string;description:string}>={};
  if(data.translations && typeof data.translations==="object" && !Array.isArray(data.translations)) {
    for(const locale of ["de","fr","en","ar","fa","ru","nl"]){
      const entry=(data.translations as Record<string,unknown>)[locale];
      if(!entry || typeof entry!=="object" || Array.isArray(entry)) continue;
      const translatedTitle=str((entry as Record<string,unknown>).title,150);
      const translatedDescription=str((entry as Record<string,unknown>).description,5000);
      if(!translatedTitle && !translatedDescription) continue;
      if(translatedTitle.length<12 || translatedDescription.length<30) return error("Çeviri başlığı ve açıklaması eksiksiz olmalıdır.");
      translations[locale]={title:translatedTitle,description:translatedDescription};
    }
  }
  const optional=(value:unknown)=>value!==""&&value!==null&&value!==undefined&&Number.isFinite(num(value))&&num(value)>=0?num(value):null;
  const id=crypto.randomUUID(),createdAt=now();
  // Fraud and duplicate check (lib/listing-risk.ts, docs/listing-risk.md): advisory. Only a high score sends a
  // non-admin's listing to review instead of publishing it; a failing check never blocks the listing.
  let risk={route:false};
  try{risk=await assessListingSave(db() as unknown as RiskDatabase,{id,ownerId:user.id,title,description,purpose,propertyType,city,district,price,currency:'TRY',grossArea,photoHashes:[],checksums:imageInfo.map(item=>item?.checksum||''),images,hashes:Object.fromEntries(imageKeys.map((key,index)=>['/api/media/'+key,imageInfo[index]?.photoHash||'']))},presentation as unknown as Record<string,unknown>,null,isAdmin(user));}catch{}
  const status=risk.route?'pending':team?(await officePublicationAllowed(team.owner_id)?'published':'pending'):isAdmin(user)||user.role==='individual'||user.role==='agent'&&await officePublicationAllowed(user.id)?'published':'pending';
  const agentGuard=AGENT_PLANS_ENABLED&&user.role==='agent'&&!isAdmin(user)&&!team;
  const insertSql="INSERT INTO listings(id,owner_id,title,description,purpose,property_type,price,currency,city,district,neighborhood,neighborhood_id,postal_code,latitude,longitude,gross_area,net_area,rooms,bedrooms,bathrooms,building_age,floor,total_floors,heating,furnished,amenities,images,translations,presentation,status,featured,created_at,updated_at,agency_id) "+(team?`SELECT ${Array(34).fill('?').join(',')} WHERE EXISTS(SELECT 1 FROM company_team_memberships m JOIN agencies a ON a.id=m.agency_id JOIN users owner ON owner.id=a.owner_id JOIN users member ON member.id=m.user_id WHERE member.role='buyer' AND m.user_id=? AND m.agency_id=? AND m.ended_at IS NULL AND a.status='approved' AND owner.agent_status='approved' AND EXISTS(SELECT 1 FROM office_verifications v WHERE v.user_id=CAST(owner.id AS TEXT) AND v.state='approved' AND v.company_snapshot=owner.company))`:agentGuard?`SELECT ${Array(34).fill('?').join(',')} WHERE ${agentInsertGuard}`:`VALUES(${Array(34).fill('?').join(',')})`);
  const statements=[...(agentGuard?[db().prepare('UPDATE users SET name=name WHERE id=?').bind(user.id)]:[]),db().prepare(insertSql)
    .bind(id,user.id,title,description,purpose,propertyType,price,"TRY",city,district,neighborhood.name,neighborhood.id,neighborhood.postalCode||null,pin?.latitude??null,pin?.longitude??null,grossArea,optional(data.netArea),str(data.rooms,10)||null,optional(data.bedrooms),optional(data.bathrooms),optional(data.buildingAge),optional(data.floor),optional(data.totalFloors),str(data.heating,50)||null,data.furnished===true||data.furnished===1||data.furnished==='1'?1:0,JSON.stringify(amenities),JSON.stringify(images),JSON.stringify(translations),JSON.stringify(presentation),status,0,createdAt,createdAt,team?.id||null,...(team?[user.id,team.id]:[]),...(agentGuard?[user.id,createdAt,createdAt]:[]))];
  if(ticket)statements.push(submissionStatement(db(),ticket,id,createdAt));
  if(presentation.videoId)statements.push(attachVideoStatement(db(),presentation.videoId,user.id,id));
  imageKeys.forEach((key,index)=>statements.push(db().prepare("INSERT INTO property_images(id,property_id,storage_provider,bucket,object_key,content_type,byte_size,checksum_sha256,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),id,"r2",storageBucket,key,imageInfo[index]!.contentType,imageInfo[index]!.size,imageInfo[index]!.checksum,index,createdAt)));
  if(user.role==='agent'&&!isAdmin(user)&&!team)statements.push(db().prepare("UPDATE listings SET status='pending' WHERE id=? AND NOT EXISTS(SELECT 1 FROM users u JOIN office_verifications v ON v.user_id=CAST(u.id AS TEXT) WHERE u.id=? AND u.role='agent' AND u.agent_status='approved' AND v.state='approved' AND v.company_snapshot=u.company)").bind(id,user.id));
  if(status==="published")statements.push(db().prepare("UPDATE listings SET published_at=? WHERE id=? AND status='published'").bind(createdAt,id));
  if(risk.route)statements.push(db().prepare("UPDATE listings SET review_note=? WHERE id=? AND status='pending'").bind(RISK_REVIEW_NOTE,id));
  try{await db().batch(statements);}catch(cause){if(ticket){try{const existing=await submittedListing(db(),ticket);if(existing)return ok(existing,{headers:{'Cache-Control':'private, no-store'}});}catch(replayError){if(replayError instanceof SubmissionError)return error(replayError.message,replayError.status);throw replayError;}}if(String((cause as Error).message).includes('individual_listing_quota'))return error('Bireysel üyeler 45 günde bir ilan verebilir. Sonraki ilan hakkınızı hesabınızdan kontrol edebilirsiniz.',429);if(agentGuard&&String((cause as Error).message).includes('foreign key'))return error('Paket hakkınız değişti. Sayfayı yenileyip tekrar deneyin.',409);throw cause;}
  const saved=await db().prepare('SELECT status FROM listings WHERE id=?').bind(id).first<{status:string}>();
  if(!saved)return error('Ekip üyeliğiniz değişti. Sayfayı yenileyin.',409);
  if(pin?.latitude!=null)scheduleListingNearby(id);
  // XML imports are translated into every language overnight at the batch price (lib/translation-batch.ts).
  // Every new listing is translated into all languages once it is published (nightly batch, docs/translations.md).
  await queueListingTranslation(id);
  return ok({id,status:saved?.status||'pending'},{status:201});
}
