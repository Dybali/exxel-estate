export type PropertyType = "daire" | "villa" | "mustakil" | "rezidans" | "ciftlik-evi" | "kosk-konak" | "yali" | "yali-dairesi" | "yazlik" | "kooperatif" | "arsa" | "ticari" | "bina" | "devremulk" | "turistik";
export type Purpose = "satilik" | "kiralik" | "gunluk" | "devren";
export type Listing = {
  statistics?: {views:number;favorites:number;messages:number};
  /** Latest change was a price drop within the last 30 days (PRICE_DROP_SQL in lib/price-history.ts). */
  priceDrop?: {from:number;at:string};
  presentation?:import("./presentation").Presentation;
  id: string; title: string; description: string; purpose: Purpose; propertyType: PropertyType;
  price: number; currency: string; city: string; district: string; neighborhood?: string; neighborhoodId?: number; postalCode?: string;
  latitude?: number; longitude?: number; locationPrecision?:"province"|"approximate"|"exact"; grossArea: number; netArea?: number;
  rooms?: string; bedrooms?: number; bathrooms?: number; buildingAge?: number;
  floor?: number; totalFloors?: number; heating?: string; furnished?: boolean;
  amenities: string[]; images: string[]; featured?: boolean; status?: string; expiresAt?: string;
  reviewNote?: string; reviewedAt?: string;
  translations?: Partial<Record<"de" | "fr" | "en" | "ar" | "fa" | "ru" | "nl" | "es" | "it", { title: string; description: string }>>;
  /** Consultant who published the listing; set on office pages (app/api/companies/[id]). */
  agent?: { id: string; name: string; avatarUrl: string | null; title: string };
  ownerName?: string; ownerVerified?: boolean; ownerRole?: string; ownerId?: string; createdAt?: string; publishedAt?: string; updatedAt?: string; source?: "demo" | "user";
};

const photo = (id: string, _width = 1200) => `/editorial/${id}.webp`;
export const DEMO_LISTINGS: Listing[] = [
  {
    id: "ex-1001", title: "Boğaz'a açılan zamansız bir yaşam", description: "Bebek'in kalbinde, Boğaz ışığını tüm odalarına taşıyan seçkin bir yaşam alanı. Doğal taş ve ahşap dokular, geniş salon ve sakin bir teras. Fotoğraflar ve bilgiler sunum amaçlı örnektir.", purpose: "satilik", propertyType: "daire", price: 42500000, currency: "TRY", city: "İstanbul", district: "Beşiktaş", neighborhood: "Bebek", latitude: 41.077, longitude: 29.043, grossArea: 215, netArea: 185, rooms: "3+1", bedrooms: 3, bathrooms: 2, buildingAge: 4, floor: 4, totalFloors: 6, heating: "Yerden ısıtma", furnished: false, amenities: ["Boğaz manzarası", "Teras", "Otopark", "Asansör", "Güvenlik"], images: [photo("photo-1600607687939-ce8a6c25118c"), photo("photo-1600210492486-724fe5c67fb0"), photo("photo-1600566753086-00f18fb6b3ea")], featured: true, ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1002", title: "Ege kıyısında yalın bir villa", description: "Bodrum'un ritmine uyum sağlayan, gün ışığıyla şekillenen modern villa. Özel havuz, peyzajlı bahçe ve açık yaşam alanlarıyla dingin bir yaz evi.", purpose: "satilik", propertyType: "villa", price: 68500000, currency: "TRY", city: "Muğla", district: "Bodrum", neighborhood: "Yalıkavak", latitude: 37.105, longitude: 27.296, grossArea: 340, netArea: 290, rooms: "5+1", bedrooms: 5, bathrooms: 4, buildingAge: 2, floor: 1, totalFloors: 2, heating: "Klima", furnished: true, amenities: ["Deniz manzarası", "Özel havuz", "Bahçe", "Otopark", "Teras"], images: [photo("photo-1613490493576-7fde63acd811"), photo("photo-1600607687920-4e2a09cf159d"), photo("photo-1600566753190-17f0baa2a6c3")], featured: true, ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1003", title: "Şehir merkezinde modern bir sığınak", description: "Nişantaşı'nda sakin bir sokakta, özenle yenilenmiş ferah daire. Açık mutfak, yüksek tavanlar ve şehir hayatına yakın bir konum.", purpose: "kiralik", propertyType: "daire", price: 95000, currency: "TRY", city: "İstanbul", district: "Şişli", neighborhood: "Nişantaşı", latitude: 41.048, longitude: 28.994, grossArea: 145, netArea: 128, rooms: "2+1", bedrooms: 2, bathrooms: 2, buildingAge: 8, floor: 3, totalFloors: 5, heating: "Kombi", furnished: true, amenities: ["Balkon", "Asansör", "Eşyalı", "Otopark"], images: [photo("photo-1600566753190-17f0baa2a6c3"), photo("photo-1600607688969-a5bfcd646154")], featured: true, ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1004", title: "Doğayla iç içe özel bir adres", description: "Çeşme'de bahçe ve avluyla bütünleşen mimarisiyle dört mevsim yaşanabilecek bir ev. İç ve dış mekan arasındaki doğal geçiş, güneşli Ege günlerine eşlik ediyor.", purpose: "satilik", propertyType: "mustakil", price: 32800000, currency: "TRY", city: "İzmir", district: "Çeşme", neighborhood: "Alaçatı", latitude: 38.284, longitude: 26.378, grossArea: 220, netArea: 185, rooms: "4+1", bedrooms: 4, bathrooms: 3, buildingAge: 3, floor: 1, totalFloors: 2, heating: "Yerden ısıtma", furnished: false, amenities: ["Bahçe", "Teras", "Otopark", "Şömine"], images: [photo("photo-1600596542815-ffad4c1539a9"), photo("photo-1600585154340-be6161a56a0c")], featured: true, ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1005", title: "Akdeniz'e bakan ferah rezidans", description: "Konyaaltı sahiline yakın, gün batımını karşılayan geniş balkonlu rezidans. Sosyal alanlar ve açık plan yaşamla her güne tatil hissi.", purpose: "satilik", propertyType: "rezidans", price: 17900000, currency: "TRY", city: "Antalya", district: "Konyaaltı", neighborhood: "Liman", latitude: 36.865, longitude: 30.635, grossArea: 165, netArea: 145, rooms: "3+1", bedrooms: 3, bathrooms: 2, buildingAge: 1, floor: 8, totalFloors: 12, heating: "Merkezi", furnished: false, amenities: ["Deniz manzarası", "Havuz", "Güvenlik", "Asansör", "Otopark"], images: [photo("photo-1600047509782-20d39509f26d"), photo("photo-1600566753051-f0b89df2dd90")], ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1006", title: "Kadıköy'de karakterli yaşam alanı", description: "Moda'nın yürünebilir sokaklarında, geniş pencereli, yüksek tavanlı ve yenilenmiş bir daire. Kentin enerjisini eve taşıyan sıcak bir atmosfer.", purpose: "satilik", propertyType: "daire", price: 12750000, currency: "TRY", city: "İstanbul", district: "Kadıköy", neighborhood: "Moda", latitude: 40.982, longitude: 29.025, grossArea: 120, netArea: 105, rooms: "2+1", bedrooms: 2, bathrooms: 1, buildingAge: 15, floor: 2, totalFloors: 5, heating: "Kombi", furnished: false, amenities: ["Balkon", "Asansör", "Ulaşım"], images: [photo("photo-1600607688969-a5bfcd646154"), photo("photo-1600566753190-17f0baa2a6c3")], ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1007", title: "Kalkan koyunda manzaralı villa", description: "Kalkan'ın yamaçlarında Akdeniz'e açılan, sonsuzluk havuzlu çağdaş villa. Özel terasları ve geniş yaşam alanlarıyla sakin bir kaçış.", purpose: "kiralik", propertyType: "villa", price: 280000, currency: "TRY", city: "Antalya", district: "Kaş", neighborhood: "Kalkan", latitude: 36.266, longitude: 29.416, grossArea: 280, netArea: 245, rooms: "4+1", bedrooms: 4, bathrooms: 4, buildingAge: 2, floor: 1, totalFloors: 2, heating: "Klima", furnished: true, amenities: ["Deniz manzarası", "Özel havuz", "Bahçe", "Eşyalı", "Otopark"], images: [photo("photo-1600585154340-be6161a56a0c"), photo("photo-1613490493576-7fde63acd811")], ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1008", title: "Urla'da zeytin ağaçları arasında", description: "Urla'nın sakin dokusunda bahçeyle bütünleşen müstakil ev. Geniş veranda, doğal malzemeler ve dört mevsime uygun yaşam.", purpose: "satilik", propertyType: "mustakil", price: 22400000, currency: "TRY", city: "İzmir", district: "Urla", neighborhood: "İskele", latitude: 38.326, longitude: 26.765, grossArea: 190, netArea: 160, rooms: "3+1", bedrooms: 3, bathrooms: 2, buildingAge: 5, floor: 1, totalFloors: 2, heating: "Kombi", furnished: false, amenities: ["Bahçe", "Teras", "Otopark", "Şömine"], images: [photo("photo-1600566752355-35792bedcfea"), photo("photo-1600596542815-ffad4c1539a9")], ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1009", title: "Marinaya birkaç adım mesafede", description: "Fethiye'de denize yakın, aydınlık ve kullanışlı daire. Balkonlu salonu ve pratik planıyla kolay bir kıyı yaşamı.", purpose: "kiralik", propertyType: "daire", price: 42000, currency: "TRY", city: "Muğla", district: "Fethiye", neighborhood: "Karagözler", latitude: 36.624, longitude: 29.104, grossArea: 105, netArea: 90, rooms: "2+1", bedrooms: 2, bathrooms: 1, buildingAge: 6, floor: 2, totalFloors: 4, heating: "Klima", furnished: true, amenities: ["Balkon", "Eşyalı", "Deniz manzarası"], images: [photo("photo-1600573472591-ee6b68d14c68"), photo("photo-1600210492486-724fe5c67fb0")], ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1010", title: "Bağdat Caddesi'nde rafine bir ev", description: "Caddeye yakın konumda, ışık alan salonu ve işlevsel planıyla güçlü bir şehir adresi. Modern detaylar ve yalın malzemeler öne çıkıyor.", purpose: "satilik", propertyType: "daire", price: 19800000, currency: "TRY", city: "İstanbul", district: "Kadıköy", neighborhood: "Suadiye", latitude: 40.963, longitude: 29.088, grossArea: 175, netArea: 152, rooms: "3+1", bedrooms: 3, bathrooms: 2, buildingAge: 0, floor: 5, totalFloors: 10, heating: "Yerden ısıtma", furnished: false, amenities: ["Balkon", "Otopark", "Asansör", "Güvenlik"], images: [photo("photo-1600566753086-00f18fb6b3ea"), photo("photo-1600607687939-ce8a6c25118c")], ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1011", title: "Yatırım için değerli arsa", description: "Gümüşlük çevresinde gelişen bölgede, ulaşımı kolay ve geniş kullanım seçenekleri sunan arsa. İmar ve tapu detayları doğrulanmalıdır.", purpose: "satilik", propertyType: "arsa", price: 11900000, currency: "TRY", city: "Muğla", district: "Bodrum", neighborhood: "Gümüşlük", latitude: 37.049, longitude: 27.233, grossArea: 860, amenities: ["Yola yakın", "Doğa manzarası"], images: [photo("photo-1500382017468-9049fed747ef"), photo("photo-1470770841072-f978cf4d019e")], ownerName: "estatemarket24", source: "demo"
  },
  {
    id: "ex-1012", title: "Levent'te prestijli ofis alanı", description: "Merkezi iş aksında, esnek kullanım planına sahip çağdaş ofis. Toplantı alanları ve güçlü ulaşım bağlantılarıyla işletmeler için iyi bir konum.", purpose: "kiralik", propertyType: "ticari", price: 175000, currency: "TRY", city: "İstanbul", district: "Şişli", neighborhood: "Levent", latitude: 41.082, longitude: 29.012, grossArea: 260, netArea: 235, bathrooms: 2, buildingAge: 4, floor: 8, totalFloors: 22, heating: "Merkezi", amenities: ["Otopark", "Güvenlik", "Asansör", "Ulaşım"], images: [photo("photo-1497366754035-f200968a6e72"), photo("photo-1497366811353-6870744d04b2")], ownerName: "estatemarket24", source: "demo"
  },
];

export { CITIES } from "./turkey-locations";
// Explicitly labelled sample stock requested for category exploration. No real seller.
const SAMPLE_DESCRIPTION="Bu bir örnek ilandır; kategori ve arama özelliklerini denemek için hazırlanmıştır. Fotoğraflar temsilidir. Fiyat ve konum bilgileri gerçek bir satış veya kiralama teklifi değildir. Bu ilan üzerinden satıcıya mesaj veya randevu gönderilemez.";
const sample=(id:string,title:string,propertyType:PropertyType,purpose:Purpose,price:number,city:string,district:string,area:number,photos:string[],rooms?:string):Listing=>({id:'sample-'+id,title,description:SAMPLE_DESCRIPTION,propertyType,purpose,price,currency:'TRY',city,district,latitude:city==='İstanbul'?41.0082:city==='İzmir'?38.4237:city==='Antalya'?36.8969:city==='Muğla'?37.2153:city==='Ankara'?39.9334:40.195,longitude:city==='İstanbul'?28.9784:city==='İzmir'?27.1428:city==='Antalya'?30.7133:city==='Muğla'?28.3636:city==='Ankara'?32.8597:29.06,locationPrecision:'province',grossArea:area,rooms,amenities:[],images:photos.map(id=>photo(id)),ownerName:'estatemarket24 · Örnek portföy',source:'demo',status:'published'});
// Samples that show the agent fee statement (lib/listing-commission.ts): fee, commission-free, tenant share.
const withCommission=(listing:Listing,commission:NonNullable<NonNullable<Listing['presentation']>['commission']>):Listing=>({...listing,presentation:{floorPlan:'',videoUrl:'',tourUrl:'',commission}});
const house=['photo-1600607687939-ce8a6c25118c','photo-1600210492486-724fe5c67fb0'];
const villa=['photo-1613490493576-7fde63acd811','photo-1600607687920-4e2a09cf159d'];
const office=['photo-1497366754035-f200968a6e72','photo-1497366811353-6870744d04b2'];
const land=['photo-1500382017468-9049fed747ef','photo-1470770841072-f978cf4d019e'];
export const PUBLIC_DEMO_LISTINGS:Listing[]=[
 withCommission(sample('konut-01','Örnek · Geniş balkonlu şehir dairesi','daire','satilik',5250000,'İstanbul','Kadıköy',125,house,'3+1'),{type:'share',value:2}),
 withCommission(sample('konut-02','Örnek · Bahçeli kiralık villa','villa','kiralik',65000,'İzmir','Urla',200,villa,'4+1'),{type:'none'}),
 sample('konut-03','Örnek · Günlük kiralık tatil evi','mustakil','gunluk',4500,'Antalya','Kaş',95,villa,'2+1'),
 withCommission(sample('isyeri-01','Örnek · Merkezi konumda satılık ofis','ticari','satilik',8900000,'İstanbul','Şişli',160,office),{type:'none'}),
 withCommission(sample('isyeri-02','Örnek · Aydınlık kiralık çalışma alanı','ticari','kiralik',42000,'Ankara','Çankaya',110,office),{type:'share',value:0.5}),
 sample('isyeri-03','Örnek · Devren satılık iş yeri','ticari','devren',2750000,'İzmir','Konak',85,office),
 sample('arsa-01','Örnek · Doğa içinde geniş arsa','arsa','satilik',3800000,'Muğla','Bodrum',850,land),
 sample('arsa-02','Örnek · Yatırım için arazi seçeneği','arsa','satilik',2450000,'İzmir','Seferihisar',1200,land),
 sample('arsa-03','Örnek · Kiralık açık kullanım alanı','arsa','kiralik',25000,'Ankara','Gölbaşı',2400,land),
 withCommission(sample('bina-01','Örnek · Satılık müstakil bina','bina','satilik',24500000,'İstanbul','Beşiktaş',680,house),{type:'share',value:1.5}),
 sample('bina-02','Örnek · Komple kiralık bina','bina','kiralik',180000,'Ankara','Çankaya',950,office),
 sample('bina-03','Örnek · Bahçeli küçük apartman','bina','satilik',16800000,'Bursa','Nilüfer',540,house),
 sample('devremulk-01','Örnek · Tatil bölgesinde devre mülk','devremulk','satilik',650000,'Antalya','Alanya',65,villa,'1+1'),
 sample('devremulk-02','Örnek · Aileler için devre mülk seçeneği','devremulk','satilik',850000,'Muğla','Fethiye',90,house,'2+1'),
 sample('devremulk-03','Örnek · Çeşme’de devre mülk kullanım hakkı','devremulk','satilik',490000,'İzmir','Çeşme',55,villa,'1+1'),
 sample('turistik-01','Örnek · Satılık butik konaklama tesisi','turistik','satilik',48000000,'Muğla','Bodrum',1400,villa),
 sample('turistik-02','Örnek · Kiralık turistik tesis','turistik','kiralik',220000,'Antalya','Kemer',1100,villa),
 sample('turistik-03','Örnek · Günlük konaklama seçeneği','turistik','gunluk',3800,'İzmir','Çeşme',45,house,'1+0')
];
export function publicListing(listing:Listing):Listing {const {reviewNote,reviewedAt,...visible}=listing;return visible;}
export const PROPERTY_TYPES: {value: PropertyType; label: string}[] = [
  {value:"daire",label:"Daire"},{value:"rezidans",label:"Rezidans"},{value:"mustakil",label:"Müstakil Ev"},{value:"villa",label:"Villa"},
  {value:"ciftlik-evi",label:"Çiftlik Evi"},{value:"kosk-konak",label:"Köşk & Konak"},{value:"yali",label:"Yalı"},{value:"yali-dairesi",label:"Yalı Dairesi"},{value:"yazlik",label:"Yazlık"},{value:"kooperatif",label:"Kooperatif"},
  {value:"arsa",label:"Arsa"},{value:"ticari",label:"İş yeri"},{value:"bina",label:"Bina"},{value:"devremulk",label:"Devre mülk"},{value:"turistik",label:"Turistik tesis"}
];
export const AMENITIES = ["Deniz manzarası","Boğaz manzarası","Havuz","Özel havuz","Bahçe","Teras","Balkon","Otopark","Asansör","Güvenlik","Eşyalı","Şömine"];
export const formatPrice = (value:number, currency="TRY", locale="tr-TR") => new Intl.NumberFormat(locale,{style:"currency",currency,maximumFractionDigits:0}).format(value);
export const typeLabel = (value:string) => PROPERTY_TYPES.find((item)=>item.value===value)?.label || value;


export const formatUnitPrice = (value:number,currency="TRY",locale="tr-TR") => new Intl.NumberFormat(locale,{style:"currency",currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
/** Home page "Öne çıkan ilanlar": featured listings with photos first, then the rest of the first page. */
export function featuredFirst<T extends {id:string;featured?:boolean;images:string[]}>(listings:T[],limit=8){
  const featured=listings.filter((listing)=>listing.featured&&listing.images.length>0);
  return [...featured,...listings.filter((listing)=>!featured.some((item)=>item.id===listing.id))].slice(0,limit);
}
