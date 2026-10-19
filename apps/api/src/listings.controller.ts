import {priceCurrency} from "./shared/price-filters";
import {centers,citiesInBounds, validBounds } from "./shared/search-filters";
import type { Response } from "express";
import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Req, Res } from "@nestjs/common";
import { Prisma, type listings } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AuthService } from "./auth.service";
import { assertOrigin, AuthRequest, now, positive, requireUser, safeJson, str } from "./common";
import { PrismaService } from "./prisma.service";
import { MediaService } from "./media.controller";
import districtsData from "./data/districts.json";
import neighborhoodsData from "./data/neighborhoods.json";
import demoRows from "./data/demo-listings.json";

const types = new Set(["daire", "villa", "mustakil", "rezidans", "arsa", "ticari"]);
const imagePrefix = "/api/media/";
const fields = { users_listings_owner_idTousers: { select: { name: true } } } as const;
type Row = listings & { users_listings_owner_idTousers?: { name: string } };
const districts = districtsData as Record<string, string[]>;
const neighborhoods = neighborhoodsData as Record<string, Record<string, {id:number;name:string;postalCode:string;label:string}[]>>;
type DemoListing = { id: string; purpose: string; currency:string; city: string; district: string; propertyType: string; rooms?: string; price: number; grossArea: number; bedrooms?: number; bathrooms?: number; furnished?: boolean; amenities: string[]; featured?: boolean; source: string };
const demoListings = demoRows as unknown as DemoListing[];

export function listingView(row: Row) {
  return {
    id: row.id, ownerId: row.owner_id, ownerName: row.users_listings_owner_idTousers?.name || "estatemarket24", source: "user",
    title: row.title, description: row.description, purpose: row.purpose, propertyType: row.property_type,
    price: Number(row.price), currency: row.currency, city: row.city, district: row.district,
    neighborhood: row.neighborhood, neighborhoodId: row.neighborhood_id, postalCode: row.postal_code,
    latitude: row.latitude, longitude: row.longitude, grossArea: row.gross_area, netArea: row.net_area,
    rooms: row.rooms, bedrooms: row.bedrooms, bathrooms: row.bathrooms, buildingAge: row.building_age,
    floor: row.floor, totalFloors: row.total_floors, heating: row.heating, furnished: Boolean(row.furnished),
    amenities: safeJson<string[]>(row.amenities, []), images: safeJson<string[]>(row.images, []),
    translations: safeJson<Record<string, {title:string;description:string}>>(row.translations, {}),
    status: row.status, featured: Boolean(row.featured), reviewNote: row.review_note, reviewedAt: row.reviewed_at, createdAt: row.created_at,updatedAt:row.updated_at,
  };
}

@Controller("listings")
export class ListingsController {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly media: MediaService) {}
  @Get("locations") locations(@Query() query: Record<string, string>) {
    const city = str(query.city, 70), district = str(query.district, 70);
    return { neighborhoods: districts[city]?.includes(district) ? neighborhoods[city]?.[district] || [] : [] };
  }
  @Get() async list(@Query() query: Record<string, string>) {
    const page = Math.min(1000, Math.max(1, Number(query.page) || 1)), pageSize = query.map==="1"?500:12;
    let currency:string;try{currency=priceCurrency({get:key=>query[key]||null});}catch{throw new BadRequestException("Geçersiz para birimi.");}if(currency)query.currency=currency;
    const where: Prisma.listingsWhereInput = { status: "published",...(currency?{currency}:{}) };
    if (["satilik", "kiralik"].includes(query.purpose)) where.purpose = query.purpose;
    if (query.city && query.city.length < 80) where.city = query.city;
    if (query.district && query.district.length < 80) where.district = query.district;
    if (types.has(query.type)) where.property_type = query.type;
    if (query.rooms && query.rooms.length < 12) where.rooms = query.rooms;
    const range = (min: string, max: string, bigint = false) => {
      const result: {gte?: number | bigint; lte?: number | bigint} = {};
      if (/^\d{1,12}$/.test(query[min] || "")) result.gte = bigint ? BigInt(query[min]) : Number(query[min]);
      if (/^\d{1,12}$/.test(query[max] || "")) result.lte = bigint ? BigInt(query[max]) : Number(query[max]);
      return result;
    };
    const price = range("minPrice", "maxPrice", true), area = range("minArea", "maxArea");
    if (Object.keys(price).length) where.price = price as Prisma.BigIntFilter;
    if (Object.keys(area).length) where.gross_area = area as Prisma.IntFilter;
    if (/^\d{1,2}$/.test(query.bedrooms || "")) where.bedrooms = { gte: Number(query.bedrooms) };
    if (/^\d{1,2}$/.test(query.bathrooms || "")) where.bathrooms = { gte: Number(query.bathrooms) };
    if (query.furnished === "1") where.furnished = 1;
    const amenities = (query.amenities || "").split(",").filter((item) => item && item.length < 50).slice(0, 12);
    if (amenities.length) where.AND = amenities.map((item) => ({ amenities: { contains: JSON.stringify(item) } }));
    const bounds=validBounds(query.bounds||"");
    if(bounds){where.OR=[{longitude:{gte:bounds[0],lte:bounds[2]},latitude:{gte:bounds[1],lte:bounds[3]}},{OR:[{latitude:null},{longitude:null}],city:{in:citiesInBounds(bounds)}}];}
    const orderBy: Prisma.listingsOrderByWithRelationInput[] = query.sort === "priceAsc" ? [{price:"asc"},{id:"asc"}] : query.sort === "priceDesc" ? [{price:"desc"},{id:"asc"}] : query.sort === "area" ? [{gross_area:"desc"},{id:"asc"}] : [{featured:"desc"},{created_at:"desc"}];
    const demo = demoListings.filter((item) => {
      for (const [param, field] of [["purpose", "purpose"], ["city", "city"], ["district", "district"], ["type", "propertyType"], ["rooms", "rooms"], ["currency","currency"]] as const) {
        if (query[param] && item[field] !== query[param]) return false;
      }
      for (const [param, field, mode] of [["minPrice", "price", "min"], ["maxPrice", "price", "max"], ["minArea", "grossArea", "min"], ["maxArea", "grossArea", "max"], ["bedrooms", "bedrooms", "min"], ["bathrooms", "bathrooms", "min"]] as const) {
        const value = query[param];
        if (value && /^\d{1,12}$/.test(value)) {
          const actual = Number(item[field] || 0), limit = Number(value);
          if (mode === "min" && actual < limit || mode === "max" && actual > limit) return false;
        }
      }
      if(bounds){const point=item as unknown as {latitude?:number;longitude?:number};if(!point.latitude||!point.longitude||point.longitude<bounds[0]||point.latitude<bounds[1]||point.longitude>bounds[2]||point.latitude>bounds[3])return false;}
      if (query.furnished === "1" && !item.furnished) return false;
      return amenities.every((feature) => item.amenities.includes(feature));
    }).sort((a, b) => query.sort === "priceAsc" ? a.price - b.price : query.sort === "priceDesc" ? b.price - a.price : query.sort === "area" ? b.grossArea - a.grossArea : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    const realCount = await this.prisma.listings.count({ where });
    const pageStart = (page - 1) * pageSize;
    const ordered=["priceAsc","priceDesc","area"].includes(query.sort);
    const realOffset=Math.min(ordered?Math.max(0,pageStart-demo.length):pageStart,realCount);
    const realLimit = Math.max(0, Math.min(ordered?pageStart+pageSize-realOffset:pageSize, realCount - realOffset));
    const rows = realLimit ? await this.prisma.listings.findMany({ where, orderBy, include: fields, take: realLimit, skip: realOffset }) : [];
    const demoOffset = Math.max(0, pageStart - realCount);
    const results=ordered?[...rows.map(listingView),...demo].sort((a,b)=>query.sort==="priceAsc"?a.price-b.price||a.id.localeCompare(b.id):query.sort==="priceDesc"?b.price-a.price||a.id.localeCompare(b.id):b.grossArea-a.grossArea||a.id.localeCompare(b.id)).slice(pageStart-realOffset,pageStart-realOffset+pageSize):[...rows.map(listingView), ...demo.slice(demoOffset, demoOffset + pageSize - rows.length)];
    return { listings:query.map==="1"?results.map(item=>{const l=item as ReturnType<typeof listingView>;return {...l,latitude:l.latitude??centers[l.city]?.[0],longitude:l.longitude??centers[l.city]?.[1],locationPrecision:l.latitude==null||l.longitude==null?"province":"approximate",description:"",images:l.images.slice(0,1),translations:undefined};}):results, total: realCount + demo.length, page, pageSize };
  }
  @Get(":id/contact") async contact(@Param("id") id: string, @Req() request: AuthRequest, @Res({passthrough:true}) response: Response) {
    const user = await this.auth.current(request); requireUser(user);
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new NotFoundException("İlan bulunamadı.");
    const row = await this.prisma.listings.findUnique({where:{id},include:{users_listings_owner_idTousers:true}});
    if (!row || row.status !== "published" && row.owner_id !== user.id && !this.auth.isAdmin(user)) throw new NotFoundException("İlan bulunamadı.");
    const seller = row.users_listings_owner_idTousers;
    response.setHeader("Cache-Control","private, no-store");
    return {seller:{id:seller.id,name:seller.name,phone:seller.phone,whatsappEnabled:Boolean(seller.whatsapp_enabled),company:seller.company,role:seller.role,agentApproved:seller.role === "agent" && seller.agent_status === "approved",avatarUrl:seller.avatar_url}};
  }
  @Get(":id") async detail(@Param("id") id: string,@Req() request:AuthRequest) {
    const demo = demoListings.find((item) => item.id === id);
    if (demo) return { listing: demo };
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new NotFoundException("İlan bulunamadı.");
    const row = await this.prisma.listings.findUnique({ where: { id }, include: fields });
    if (!row) throw new NotFoundException("İlan bulunamadı.");
    if(row.status!=="published"){const user=await this.auth.current(request);if(!user||row.owner_id!==user.id&&!this.auth.isAdmin(user))throw new NotFoundException("İlan bulunamadı.");}
    return { listing: listingView(row) };
  }
  @Post() async create(@Body() data: Record<string, unknown>, @Req() request: AuthRequest) {
    assertOrigin(request);
    const user = await this.auth.current(request); requireUser(user);
    if (!["individual", "agent", "admin"].includes(user.role)) throw new ForbiddenException("İlan veren hesabı gerekli.");
    if (user.role === "agent" && user.agent_status !== "approved" && !this.auth.isAdmin(user)) throw new ForbiddenException("Emlakçı hesabı onay bekliyor.");
    const title = str(data.title, 150), description = str(data.description, 5000), purpose = str(data.purpose, 20), propertyType = str(data.propertyType, 20), city = str(data.city, 70), district = str(data.district, 70);
    const neighborhoodId = Number(data.neighborhoodId);
    const neighborhood = neighborhoods[city]?.[district]?.find((item) => item.id === neighborhoodId);
    const price = positive(data.price, "Fiyat"), grossArea = positive(data.grossArea, "Alan");
    if (title.length < 12 || description.length < 30 || !["satilik", "kiralik"].includes(purpose) || !types.has(propertyType) || !districts[city]?.includes(district) || !neighborhood) throw new BadRequestException("Zorunlu ilan veya konum alanları geçersiz.");
    const images = Array.isArray(data.images) ? data.images.filter((value): value is string => typeof value === "string").slice(0, 30) : [];
    if (!images.length || new Set(images).size !== images.length || images.some((url) => !url.startsWith(`${imagePrefix}listings/${user.id}/`))) throw new BadRequestException("Fotoğraf bilgilerini kontrol edin.");
    const imageInfo = await Promise.all(images.map((url) => this.media.head(url.slice(imagePrefix.length))));
    if (imageInfo.some((item) => !item)) throw new BadRequestException("Fotoğraflardan biri depoda bulunamadı.");
    const count = await this.prisma.listings.count({ where: { owner_id: user.id, status: { not: "rejected" } } });
    if (user.role === "individual" && count >= 3) throw new ForbiddenException("İlan kotası dolu.");
    if(!["TRY","EUR","USD","GBP"].includes(str(data.currency,3)||"TRY"))throw new BadRequestException("Geçersiz para birimi.");
    const id = randomUUID(), createdAt = now(),status=user.role==="agent"&&user.agent_status==="approved"||this.auth.isAdmin(user)?"published":"pending";
    const numberOrNull = (value: unknown) => value === "" || value == null ? null : Number.isSafeInteger(Number(value)) ? Number(value) : null;
    const amenities = Array.isArray(data.amenities) ? data.amenities.filter((item): item is string => typeof item === "string" && item.length < 50).slice(0, 20) : [];
    const translations = data.translations && typeof data.translations === "object" ? data.translations : {};
    await this.prisma.$transaction(async (db) => {
      await db.listings.create({ data: {
      id, published_at:status==="published"?createdAt:null, owner_id: user.id, title, description, purpose, property_type: propertyType, price: BigInt(price), currency: str(data.currency, 3) || "TRY",
      city, district, neighborhood: neighborhood.name, neighborhood_id: neighborhood.id, postal_code: neighborhood.postalCode || null,
      latitude: null, longitude: null, gross_area: grossArea, net_area: numberOrNull(data.netArea), rooms: str(data.rooms, 10) || null,
      bedrooms: numberOrNull(data.bedrooms), bathrooms: numberOrNull(data.bathrooms), building_age: numberOrNull(data.buildingAge), floor: numberOrNull(data.floor), total_floors: numberOrNull(data.totalFloors), heating: str(data.heating, 50) || null,
      furnished: data.furnished ? 1 : 0, amenities: JSON.stringify(amenities), images: JSON.stringify(images), translations: JSON.stringify(translations), status, featured: 0, created_at: createdAt, updated_at: createdAt,
      } });
      for (let index = 0; index < images.length; index++) {
        const info = imageInfo[index]!;
        await db.property_images.create({ data: { id: randomUUID(), property_id: id, storage_provider: "r2", bucket: info.bucket, object_key: images[index].slice(imagePrefix.length), content_type: info.contentType, byte_size: BigInt(info.size), checksum_sha256: info.checksum, sort_order: index, created_at: createdAt } });
      }
    });
    return { id, status };
  }
  @Patch(":id") async update(@Param("id") id:string,@Body() input:Record<string,unknown>,@Req() request:AuthRequest){
    assertOrigin(request);const user=await this.auth.current(request);requireUser(user);
    if(!/^[a-f0-9-]{36}$/i.test(id))throw new NotFoundException("İlan bulunamadı.");
    const row=await this.prisma.listings.findUnique({where:{id}});if(!row)throw new NotFoundException("İlan bulunamadı.");
    if(row.owner_id!==user.id&&!this.auth.isAdmin(user))throw new ForbiddenException("Bu ilanı düzenleme yetkiniz yok.");
    if(input.expectedUpdatedAt&&input.expectedUpdatedAt!==row.updated_at)throw new ConflictException("İlan başka bir oturumda güncellendi. Sayfayı yenileyin.");
    const data={...listingView(row),...input};
    const title=str(data.title,150),description=str(data.description,5000),purpose=str(data.purpose,20),propertyType=str(data.propertyType,30),city=str(data.city,70),district=str(data.district,70),currency=str(data.currency,3).toUpperCase();
    const price=positive(data.price,"Fiyat"),grossArea=positive(data.grossArea,"Alan");
    if(title.length<12||description.length<30||!["satilik","kiralik"].includes(purpose)||!types.has(propertyType)||!["TRY","EUR","USD","GBP"].includes(currency)||!districts[city]?.includes(district))throw new BadRequestException("Zorunlu ilan alanlarını kontrol edin.");
    const locationChanged=["city","district","neighborhoodId"].some(key=>Object.hasOwn(input,key));
    const neighborhood=locationChanged?neighborhoods[city]?.[district]?.find(item=>item.id===Number(data.neighborhoodId)):null;
    if(locationChanged&&!neighborhood)throw new BadRequestException("Geçerli bir mahalle seçin.");
    const numberOrNull=(value:unknown)=>{if(value===""||value==null)return null;const result=Number(value);if(!Number.isSafeInteger(result)||result<0)throw new BadRequestException("Sayısal özellikleri kontrol edin.");return result;};
    const original=safeJson<string[]>(row.images,[]);
    const images=Array.isArray(data.images)?data.images.filter((image):image is string=>typeof image==="string"):[];
    const pattern=new RegExp(`^/api/media/listings/${row.owner_id}/[a-f0-9-]+\\.(jpg|png|webp)$`);
    if(!images.length||images.length>30||new Set(images).size!==images.length||images.some(image=>!pattern.test(image)))throw new BadRequestException("Fotoğraf bilgilerini kontrol edin.");
    const added=images.filter(image=>!original.includes(image));const info=await Promise.all(added.map(image=>this.media.head(image.slice(imagePrefix.length))));
    if(info.some(item=>!item))throw new BadRequestException("Yeni fotoğraflardan biri depoda bulunamadı.");
    const allowed=["Deniz manzarası","Boğaz manzarası","Havuz","Özel havuz","Bahçe","Teras","Balkon","Otopark","Asansör","Güvenlik","Eşyalı","Şömine"];
    const amenities=Array.isArray(data.amenities)?data.amenities.filter((item):item is string=>typeof item==="string"&&allowed.includes(item)).slice(0,20):[];
    const translations:Record<string,{title:string;description:string}>={};
    if(!data.translations||typeof data.translations!=="object"||Array.isArray(data.translations))throw new BadRequestException("Çevirileri kontrol edin.");
    for(const locale of ["de","fr","en","ar","ru"]){const entry=(data.translations as Record<string,unknown>)[locale];if(!entry)continue;if(typeof entry!=="object"||Array.isArray(entry))throw new BadRequestException("Çevirileri kontrol edin.");const item=entry as Record<string,unknown>,translatedTitle=str(item.title,150),translatedDescription=str(item.description,5000);if(!translatedTitle&&!translatedDescription)continue;if(translatedTitle.length<12||translatedDescription.length<30)throw new BadRequestException("Çevirileri eksiksiz doldurun.");translations[locale]={title:translatedTitle,description:translatedDescription};}
    const status=user.role==="agent"&&user.agent_status==="approved"||this.auth.isAdmin(user)?"published":"pending",updatedAt=now();
    await this.prisma.$transaction(async db=>{
      if(Number(row.price)!==price||row.currency!==currency||row.purpose!==purpose)await db.price_history.create({data:{id:randomUUID(),listing_id:id,old_price:row.currency===currency&&row.purpose===purpose?row.price:BigInt(price),new_price:BigInt(price),currency,purpose,changed_at:updatedAt}});
      await db.listings.update({where:{id},data:{published_at:status==="published"?row.published_at||updatedAt:row.published_at,title,description,purpose,property_type:propertyType,price:BigInt(price),currency,city,district,neighborhood:neighborhood?.name??row.neighborhood,neighborhood_id:neighborhood?.id??row.neighborhood_id,postal_code:neighborhood?.postalCode??row.postal_code,gross_area:grossArea,net_area:numberOrNull(data.netArea),rooms:str(data.rooms,10)||null,bedrooms:numberOrNull(data.bedrooms),bathrooms:numberOrNull(data.bathrooms),building_age:numberOrNull(data.buildingAge),floor:numberOrNull(data.floor),total_floors:numberOrNull(data.totalFloors),heating:str(data.heating,50)||null,furnished:data.furnished?1:0,amenities:JSON.stringify(amenities),images:JSON.stringify(images),translations:JSON.stringify(translations),status,review_note:null,reviewed_by:null,reviewed_at:null,updated_at:updatedAt}});
      await db.property_images.deleteMany({where:{property_id:id,object_key:{notIn:images.map(image=>image.slice(imagePrefix.length))}}});
      for(let index=0;index<images.length;index++){const image=images[index],key=image.slice(imagePrefix.length);if(original.includes(image))await db.property_images.updateMany({where:{property_id:id,object_key:key},data:{sort_order:index}});else{const metadata=info[added.indexOf(image)]!;await db.property_images.create({data:{id:randomUUID(),property_id:id,storage_provider:"r2",bucket:metadata.bucket,object_key:key,content_type:metadata.contentType,byte_size:BigInt(metadata.size),checksum_sha256:metadata.checksum,sort_order:index,created_at:updatedAt}});}}
    });return {success:true,id,status,updatedAt};
  }
  @Delete(":id") async remove(@Param("id") id:string,@Req() request:AuthRequest){assertOrigin(request);const user=await this.auth.current(request);requireUser(user);if(!/^[a-f0-9-]{36}$/i.test(id))throw new NotFoundException("İlan bulunamadı.");const row=await this.prisma.listings.findUnique({where:{id}});if(!row)throw new NotFoundException("İlan bulunamadı.");if(row.owner_id!==user.id&&!this.auth.isAdmin(user))throw new ForbiddenException("Yetkiniz yok.");await this.prisma.listings.delete({where:{id}});return {success:true};}
}

