import { AMENITIES, DEMO_LISTINGS, PROPERTY_TYPES, type Listing } from "@/lib/listings";
import { body, currentUser, db, error, isAdmin, now, num, ok, parseListing, sameOrigin, str } from "@/lib/server";
import { validDistrict } from "@/lib/turkey-locations";
import { findNeighborhood } from "@/lib/turkey-neighborhoods";
import { externalR2BucketName, headExternalImage } from "@/lib/external-r2";

export async function GET(request:Request) {
  const q=new URL(request.url).searchParams;
  const page=Math.min(1000,Math.max(1,Number(q.get("page"))||1)),pageSize=12;
  const where=["l.status='published'"],values:(string|number)[]=[];
  const equals:Record<string,string>={purpose:"purpose",city:"city",district:"district",type:"property_type",rooms:"rooms"};
  for(const [param,column] of Object.entries(equals)){const v=q.get(param);if(v&&v.length<80){where.push(`l.${column}=?`);values.push(v)}}
  for(const [param,column,op] of [["minPrice","price",">="],["maxPrice","price","<="],["minArea","gross_area",">="],["maxArea","gross_area","<="],["bedrooms","bedrooms",">="],["bathrooms","bathrooms",">="]] as const){const v=q.get(param);if(v&&/^\d{1,12}$/.test(v)){where.push(`l.${column}${op}?`);values.push(Number(v))}}
  if(q.get("furnished")==="1")where.push("l.furnished=1");
  const chosen=(q.get("amenities")||"").split(",").filter((a)=>AMENITIES.includes(a)).slice(0,12);
  for(const a of chosen){where.push("EXISTS (SELECT 1 FROM json_each(l.amenities) WHERE value=?)");values.push(a)}
  const query=where.join(" AND ");
  const sort=q.get("sort");
  const order=sort==="priceAsc"?"l.price ASC":sort==="priceDesc"?"l.price DESC":sort==="area"?"l.gross_area DESC":"l.featured DESC,l.created_at DESC";
  const demo=DEMO_LISTINGS.filter((l)=>{
    for(const [param,field] of [["purpose","purpose"],["city","city"],["district","district"],["type","propertyType"],["rooms","rooms"]] as const){const v=q.get(param);if(v&&l[field]!==v)return false}
    for(const [param,field,compare] of [["minPrice","price","min"],["maxPrice","price","max"],["minArea","grossArea","min"],["maxArea","grossArea","max"],["bedrooms","bedrooms","min"],["bathrooms","bathrooms","min"]] as const){const v=q.get(param);if(v&&Number.isFinite(Number(v))){const n=Number(l[field]||0);if(compare==="min"&&n<Number(v)||compare==="max"&&n>Number(v))return false}}
    if(q.get("furnished")==="1"&&!l.furnished)return false;
    if(chosen.some((a)=>!l.amenities.includes(a)))return false;
    return true;
  }).sort((a,b)=>sort==="priceAsc"?a.price-b.price:sort==="priceDesc"?b.price-a.price:sort==="area"?b.grossArea-a.grossArea:Number(Boolean(b.featured))-Number(Boolean(a.featured)));
  const count=await db().prepare(`SELECT count(*) AS n FROM listings l WHERE ${query}`).bind(...values).first<{n:number}>();
  const realCount=Number(count?.n||0);
  const pageStart=(page-1)*pageSize;
  // Published customer listings appear first; demo content only fills remaining slots.
  const realOffset=Math.min(pageStart,realCount);
  const realLimit=Math.max(0,Math.min(pageSize,realCount-pageStart));
  let real:Listing[]=[];
  if(realLimit>0){const rows=await db().prepare(`SELECT l.*,u.name AS owner_name FROM listings l JOIN users u ON u.id=l.owner_id WHERE ${query} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...values,realLimit,realOffset).all<Record<string,unknown>>();real=(rows.results||[]).map(parseListing)}
  const demoOffset=Math.max(0,pageStart-realCount);
  const listings=[...real,...demo.slice(demoOffset,demoOffset+pageSize-real.length)];
  return ok({listings,total:demo.length+realCount,page,pageSize},{headers:{"Cache-Control":"public,max-age=20,s-maxage=45,stale-while-revalidate=180"}});
}

export async function POST(request:Request) {
  if(!sameOrigin(request)) return error("Geçersiz kaynak.",403);
  const user=await currentUser(request);
  if(!user) return error("İlan vermek için giriş yapın.",401);
  if(!["agent","individual","admin"].includes(user.role)) return error("İlan vermek için hesap türünüzü güncelleyin.",403);
  if(user.role==="agent" && user.agent_status!=="approved" && !isAdmin(user)) return error("Emlakçı hesabınız henüz onaylanmadı.",403);
  const quota=await db().prepare("SELECT count(*) AS n FROM listings WHERE owner_id=? AND status!='rejected'").bind(user.id).first<{n:number}>();
  if(!isAdmin(user)&&Number(quota?.n||0)>=3)return error("Sunum sürümünde hesap başına en fazla 3 ilan eklenebilir. Paketler açıldığında limitler güncellenecek.",429);
  let data:Record<string,unknown>;
  try {data=await body(request);} catch{return error("İlan bilgilerini kontrol edin.");}
  const title=str(data.title,150),description=str(data.description,5000),purpose=str(data.purpose,20),propertyType=str(data.propertyType,20),city=str(data.city,70),district=str(data.district,70);
  const neighborhoodId=num(data.neighborhoodId),neighborhood=findNeighborhood(city,district,neighborhoodId);
  const price=num(data.price),grossArea=num(data.grossArea);
  if(title.length<12 || description.length<30 || !["satilik","kiralik"].includes(purpose) || !PROPERTY_TYPES.some((p)=>p.value===propertyType) || !city || !district || !Number.isInteger(price) || price<=0 || !Number.isInteger(grossArea) || grossArea<=0) return error("Zorunlu ilan alanlarını doldurun.");
  if(!validDistrict(city,district) || !neighborhood) return error("Geçerli bir il, ilçe ve mahalle seçin.");
  const amenities=Array.isArray(data.amenities)?data.amenities.filter((x):x is string=>typeof x==="string"&&AMENITIES.includes(x)).slice(0,20):[];
  const images=Array.isArray(data.images)?data.images.filter((x):x is string=>typeof x==="string"&&x.startsWith("/api/media/")).slice(0,30):[];
  if(images.length===0) return error("En az bir fotoğraf yükleyin.");
  if(new Set(images).size!==images.length) return error("Aynı fotoğraf birden fazla eklenemez.");
  const imageKeys=images.map((url)=>url.slice("/api/media/".length));
  if(imageKeys.some((key)=>!new RegExp(`^listings/${user.id}/[a-f0-9-]+\\.(jpg|png|webp)$`).test(key))) return error("Yalnızca kendi yüklediğiniz fotoğrafları ekleyebilirsiniz.",403);
  const imageInfo=await Promise.all(imageKeys.map(headExternalImage));
  if(imageInfo.some((item)=>!item)) return error("Fotoğraflardan biri depoda bulunamadı.");
  const storageBucket=externalR2BucketName();
  if(!storageBucket) return error("Fotoğraf deposu yapılandırılmamış.",503);
  const translations:Record<string,{title:string;description:string}>={};
  if(data.translations && typeof data.translations==="object" && !Array.isArray(data.translations)) {
    for(const locale of ["de","fr","en","ar","ru"]){
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
  const statements=[db().prepare("INSERT INTO listings(id,owner_id,title,description,purpose,property_type,price,currency,city,district,neighborhood,neighborhood_id,postal_code,latitude,longitude,gross_area,net_area,rooms,bedrooms,bathrooms,building_age,floor,total_floors,heating,furnished,amenities,images,translations,status,featured,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(id,user.id,title,description,purpose,propertyType,price,str(data.currency,3)||"TRY",city,district,neighborhood.name,neighborhood.id,neighborhood.postalCode||null,null,null,grossArea,optional(data.netArea),str(data.rooms,10)||null,optional(data.bedrooms),optional(data.bathrooms),optional(data.buildingAge),optional(data.floor),optional(data.totalFloors),str(data.heating,50)||null,data.furnished?1:0,JSON.stringify(amenities),JSON.stringify(images),JSON.stringify(translations),"pending",0,createdAt,createdAt)];
  imageKeys.forEach((key,index)=>statements.push(db().prepare("INSERT INTO property_images(id,property_id,storage_provider,bucket,object_key,content_type,byte_size,checksum_sha256,sort_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(crypto.randomUUID(),id,"r2",storageBucket,key,imageInfo[index]!.contentType,imageInfo[index]!.size,imageInfo[index]!.checksum,index,createdAt)));
  await db().batch(statements);
  return ok({id,status:"pending"},{status:201});
}
