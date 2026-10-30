import {activeTeamCompany} from '@/lib/company-team-server';
import {submissionTicket,submittedListing,submissionStatement,SubmissionError} from '@/lib/listing-submissions';
import {textSearchSql,matchesSearchText} from '@/lib/text-search';
import {nextIndividualSubmission} from '@/lib/listing-policy';
import {categoryFilter,categoryMatches} from "@/lib/property-categories";
import {extraFilterMatches,extraFilterSql} from "@/lib/search-categories";
import {publicListing} from '@/lib/listings';
import {officeDB,officePublicationAllowed} from '@/lib/office-verification-server';
import {scheduleListingTranslations} from '@/lib/translation-runtime';
import {presentationFrom} from "@/lib/presentation";
import {priceCurrency,CURRENCIES} from "@/lib/price-filters";
import { areaBounds,centers,listingInArea,mapBoundsSql,validArea,validBounds } from "@/lib/search-filters";
import { AMENITIES, PUBLIC_DEMO_LISTINGS, PROPERTY_TYPES, type Listing } from "@/lib/listings";
import {body, currentUser, db, error, isAdmin, now, num, ok, parseListing, sameOrigin, str,OWNER_VERIFIED_SQL} from "@/lib/server";
import {AGENT_PLANS_ENABLED} from '@/lib/publication-policy';
import {agentPlanAccess,agentInsertGuard} from '@/lib/agent-plan';
import { validDistrict } from "@/lib/turkey-locations";
import {compareListings,listingOrderSql,listingSort,priceSort,strictSort,tryRates} from "@/lib/listing-sort";
import {latestExchangeRates} from "@/lib/exchange-rates";
import { findNeighborhood } from "@/lib/turkey-neighborhoods";
import { externalR2BucketName, headExternalImage } from "@/lib/external-r2";

export async function GET(request:Request) {
  const q=new URL(request.url).searchParams;
  try{const currency=priceCurrency(q);if(currency)q.set("currency",currency);}catch{return error("Geçersiz para birimi.");}
  const sort=listingSort(q.get("sort"));
  // Price sorting across currencies uses ECB rates; without them it falls back to TRY listings only.
  const rates=priceSort(sort)&&!q.get("currency")?tryRates(await latestExchangeRates().catch(()=>null)):null;
  if(priceSort(sort)&&!q.get("currency")&&!rates)q.set("currency","TRY");
  const page=Math.min(1000,Math.max(1,Math.floor(Number(q.get("page")))||1)),pageSize=q.get("map")==="1"?500:12;
  const where=["l.status='published'"],values:(string|number)[]=[];
  const category=categoryFilter(q.get("category")||"");if(category){where.push(category.where);values.push(...category.values);}
  const textFilter=textSearchSql(q.get("q")||"");if(textFilter.where){where.push(textFilter.where);values.push(...textFilter.values);}
  const equals:Record<string,string>={purpose:"purpose",city:"city",district:"district",type:"property_type",rooms:"rooms",currency:"currency",neighborhood:"neighborhood"};
  for(const [param,column] of Object.entries(equals)){const v=q.get(param);if(v&&v.length<80){where.push(`l.${column}=?`);values.push(v)}}
  for(const [param,column,op] of [["minPrice","price",">="],["maxPrice","price","<="],["minArea","gross_area",">="],["maxArea","gross_area","<="],["bedrooms","bedrooms",">="],["bathrooms","bathrooms",">="]] as const){const v=q.get(param);if(v&&/^\d{1,12}$/.test(v)){where.push(`l.${column}${op}?`);values.push(Number(v))}}
  if(q.get("furnished")==="1")where.push("l.furnished=1");
  const extra=extraFilterSql(q);where.push(...extra.where);values.push(...extra.values);
  if(q.get('assistant')==='1'&&q.get('furnished')==='0')where.push('l.furnished=0');
  const chosen=(q.get("amenities")||"").split(",").filter((a)=>AMENITIES.includes(a)).slice(0,12);
  for(const a of chosen){where.push("EXISTS (SELECT 1 FROM json_each(l.amenities) WHERE value=?)");values.push(a)}
  const bounds=validBounds(q.get("bounds")||"");
  if(bounds){const spatial=mapBoundsSql(bounds);where.push(spatial.where);values.push(...spatial.values);}
  const area=validArea(q.get("area")||"");
  if(area){const spatial=mapBoundsSql(areaBounds(area));where.push(spatial.where);values.push(...spatial.values);}
  const query=where.join(" AND ");
  const order=listingOrderSql(sort,rates);
  const demo=(q.get('assistant')==='1'?[]:PUBLIC_DEMO_LISTINGS).filter((l)=>{
    if(!matchesSearchText(q.get("q")||"",l))return false;
    if(!categoryMatches(q.get('category')||'',l))return false;
    if(q.get("neighborhood")&&l.neighborhood!==q.get("neighborhood"))return false;
    for(const [param,field] of [["purpose","purpose"],["city","city"],["district","district"],["type","propertyType"],["rooms","rooms"],["currency","currency"]] as const){const v=q.get(param);if(v&&l[field]!==v)return false}
    for(const [param,field,compare] of [["minPrice","price","min"],["maxPrice","price","max"],["minArea","grossArea","min"],["maxArea","grossArea","max"],["bedrooms","bedrooms","min"],["bathrooms","bathrooms","min"]] as const){const v=q.get(param);if(v&&Number.isFinite(Number(v))){const n=Number(l[field]||0);if(compare==="min"&&n<Number(v)||compare==="max"&&n>Number(v))return false}}
    if(bounds&&(!l.latitude||!l.longitude||l.longitude<bounds[0]||l.latitude<bounds[1]||l.longitude>bounds[2]||l.latitude>bounds[3]))return false;
    if(area&&!listingInArea(l,area))return false;
    if(q.get("furnished")==="1"&&!l.furnished)return false;
    if(!extraFilterMatches(q,l))return false;
    if(chosen.some((a)=>!l.amenities.includes(a)))return false;
    return true;
  }).sort(compareListings(sort,rates));
  const mapRow=(l:Listing)=>({...l,latitude:l.latitude??centers[l.city]?.[0],longitude:l.longitude??centers[l.city]?.[1],locationPrecision:l.latitude==null||l.longitude==null?"province" as const:"approximate" as const,description:"",images:l.images.slice(0,1),translations:undefined});
  if(area){
    // The bounding box narrows the query in SQL; the polygon test runs here, so results are paged in memory.
    const rows=await db().prepare(`SELECT l.*,u.name AS owner_name,${OWNER_VERIFIED_SQL} FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${query} ORDER BY ${order} LIMIT 500`).bind(...values).all<Record<string,unknown>>();
    const inside=[...(rows.results||[]).map(row=>publicListing(parseListing(row))).filter(l=>listingInArea(l,area)),...demo];
    const pageRows=inside.slice((page-1)*pageSize,page*pageSize);
    return ok({listings:q.get("map")==="1"?pageRows.map(mapRow):pageRows,total:inside.length,page,pageSize},{headers:{"Cache-Control":"public,max-age=20,s-maxage=45,stale-while-revalidate=180"}});
  }
  const count=await db().prepare(`SELECT count(*) AS n FROM listings l WHERE ${query}`).bind(...values).first<{n:number}>();
  const realCount=Number(count?.n||0);
  const pageStart=(page-1)*pageSize;
  // Published customer listings appear first; demo content only fills remaining slots.
  const ordered=strictSort(sort);
  const realOffset=Math.min(ordered?Math.max(0,pageStart-demo.length):pageStart,realCount);
  const realLimit=Math.max(0,Math.min(ordered?pageStart+pageSize-realOffset:pageSize,realCount-realOffset));
  let real:Listing[]=[];
  if(realLimit>0){const rows=await db().prepare(`SELECT l.*,u.name AS owner_name,${OWNER_VERIFIED_SQL} FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${query} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...values,realLimit,realOffset).all<Record<string,unknown>>();real=(rows.results||[]).map(row=>publicListing(parseListing(row)))}
  const demoOffset=Math.max(0,pageStart-realCount);
  const listings=ordered?[...real,...demo].sort(compareListings(sort,rates)).slice(pageStart-realOffset,pageStart-realOffset+pageSize):[...real,...demo.slice(demoOffset,demoOffset+pageSize-real.length)];
  return ok({listings:q.get("map")==="1"?listings.map(mapRow):listings,total:demo.length+realCount,page,pageSize},{headers:{"Cache-Control":"public,max-age=20,s-maxage=45,stale-while-revalidate=180"}});
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
  if(user.role==='individual'&&!isAdmin(user)&&!team){const quota=await db().prepare('SELECT last_submitted_at FROM individual_listing_quota WHERE user_id=?').bind(user.id).first<{last_submitted_at:string}>();if(quota&&Date.parse(nextIndividualSubmission(String(quota.last_submitted_at)))>Date.now())return error('Bireysel üyeler 3 takvim ayında bir ilan verebilir. Sonraki ilan hakkınızı hesabınızdan kontrol edebilirsiniz.',429);}
  const title=str(data.title,150),description=str(data.description,5000),purpose=str(data.purpose,20),propertyType=str(data.propertyType,20),city=str(data.city,70),district=str(data.district,70);
  const neighborhoodId=num(data.neighborhoodId),neighborhood=findNeighborhood(city,district,neighborhoodId);
  const price=num(data.price),grossArea=num(data.grossArea);
  if(!(CURRENCIES as readonly string[]).includes(str(data.currency,3)||"TRY"))return error("Geçersiz para birimi.");
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
  let presentation;try{presentation=presentationFrom(data,user.id);}catch(e){return error((e as Error).message);}
  const imageKeys=[...new Set([...images,...(presentation.panoramas||[]).map(scene=>scene.url),presentation.floorPlan].filter(Boolean))].map((url)=>url.slice("/api/media/".length));
  if(imageKeys.some((key)=>!new RegExp(`^listings/${user.id}/[a-f0-9-]+\\.(jpg|png|webp)$`).test(key))) return error("Yalnızca kendi yüklediğiniz fotoğrafları ekleyebilirsiniz.",403);
  const imageInfo=await Promise.all(imageKeys.map(headExternalImage));
  if(imageInfo.some((item)=>!item)) return error("Fotoğraflardan biri depoda bulunamadı.");
  const storageBucket=externalR2BucketName();
  if(!storageBucket) return error("Fotoğraf deposu yapılandırılmamış.",503);
  const translations:Record<string,{title:string;description:string}>={};
  if(data.translations && typeof data.translations==="object" && !Array.isArray(data.translations)) {
    for(const locale of ["de","fr","en","ar","fa","ru"]){
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
  const status=team?(await officePublicationAllowed(team.owner_id)?'published':'pending'):isAdmin(user)||user.role==='individual'||user.role==='agent'&&await officePublicationAllowed(user.id)?'published':'pending';
  const agentGuard=AGENT_PLANS_ENABLED&&user.role==='agent'&&!isAdmin(user)&&!team;
  const insertSql="INSERT INTO listings(id,owner_id,title,description,purpose,property_type,price,currency,city,district,neighborhood,neighborhood_id,postal_code,latitude,longitude,gross_area,net_area,rooms,bedrooms,bathrooms,building_age,floor,total_floors,heating,furnished,amenities,images,translations,presentation,status,featured,created_at,updated_at,agency_id) "+(team?`SELECT ${Array(34).fill('?').join(',')} WHERE EXISTS(SELECT 1 FROM company_team_memberships m JOIN agencies a ON a.id=m.agency_id JOIN users owner ON owner.id=a.owner_id JOIN users member ON member.id=m.user_id WHERE member.role='buyer' AND m.user_id=? AND m.agency_id=? AND m.ended_at IS NULL AND a.status='approved' AND owner.agent_status='approved' AND EXISTS(SELECT 1 FROM office_verifications v WHERE v.user_id=CAST(owner.id AS TEXT) AND v.state='approved' AND v.company_snapshot=owner.company))`:agentGuard?`SELECT ${Array(34).fill('?').join(',')} WHERE ${agentInsertGuard}`:`VALUES(${Array(34).fill('?').join(',')})`);
  const statements=[...(agentGuard?[db().prepare('UPDATE users SET name=name WHERE id=?').bind(user.id)]:[]),db().prepare(insertSql)
    .bind(id,user.id,title,description,purpose,propertyType,price,str(data.currency,3)||"TRY",city,district,neighborhood.name,neighborhood.id,neighborhood.postalCode||null,null,null,grossArea,optional(data.netArea),str(data.rooms,10)||null,optional(data.bedrooms),optional(data.bathrooms),optional(data.buildingAge),optional(data.floor),optional(data.totalFloors),str(data.heating,50)||null,data.furnished===true||data.furnished===1||data.furnished==='1'?1:0,JSON.stringify(amenities),JSON.stringify(images),JSON.stringify(translations),JSON.stringify(presentation),status,0,createdAt,createdAt,team?.id||null,...(team?[user.id,team.id]:[]),...(agentGuard?[user.id,createdAt,createdAt]:[]))];
  if(ticket)statements.push(submissionStatement(db(),ticket,id,createdAt));
  imageKeys.forEach((key,index)=>statements.push(db().prepare("INSERT INTO property_images(id,property_id,storage_provider,bucket,object_key,content_type,byte_size,checksum_sha256,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),id,"r2",storageBucket,key,imageInfo[index]!.contentType,imageInfo[index]!.size,imageInfo[index]!.checksum,index,createdAt)));
  if(user.role==='agent'&&!isAdmin(user)&&!team)statements.push(db().prepare("UPDATE listings SET status='pending' WHERE id=? AND NOT EXISTS(SELECT 1 FROM users u JOIN office_verifications v ON v.user_id=CAST(u.id AS TEXT) WHERE u.id=? AND u.role='agent' AND u.agent_status='approved' AND v.state='approved' AND v.company_snapshot=u.company)").bind(id,user.id));
  if(status==="published")statements.push(db().prepare("UPDATE listings SET published_at=? WHERE id=? AND status='published'").bind(createdAt,id));
  try{await db().batch(statements);}catch(cause){if(ticket){try{const existing=await submittedListing(db(),ticket);if(existing)return ok(existing,{headers:{'Cache-Control':'private, no-store'}});}catch(replayError){if(replayError instanceof SubmissionError)return error(replayError.message,replayError.status);throw replayError;}}if(String((cause as Error).message).includes('individual_listing_quota'))return error('Bireysel üyeler 3 takvim ayında bir ilan verebilir. Sonraki ilan hakkınızı hesabınızdan kontrol edebilirsiniz.',429);if(agentGuard&&String((cause as Error).message).includes('foreign key'))return error('Paket hakkınız değişti. Sayfayı yenileyip tekrar deneyin.',409);throw cause;}
  const saved=await db().prepare('SELECT status FROM listings WHERE id=?').bind(id).first<{status:string}>();
  if(!saved)return error('Ekip üyeliğiniz değişti. Sayfayı yenileyin.',409);
  if(saved?.status==='published')scheduleListingTranslations(id);
  return ok({id,status:saved?.status||'pending'},{status:201});
}
