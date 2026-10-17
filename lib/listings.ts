export type PropertyType = "daire" | "villa" | "mustakil" | "rezidans" | "arsa" | "ticari";
export type Purpose = "satilik" | "kiralik";
export type Listing = {
  id: string; title: string; description: string; purpose: Purpose; propertyType: PropertyType;
  price: number; currency: string; city: string; district: string; neighborhood?: string; neighborhoodId?: number; postalCode?: string;
  latitude?: number; longitude?: number; grossArea: number; netArea?: number;
  rooms?: string; bedrooms?: number; bathrooms?: number; buildingAge?: number;
  floor?: number; totalFloors?: number; heating?: string; furnished?: boolean;
  amenities: string[]; images: string[]; featured?: boolean; status?: string;
  reviewNote?: string; reviewedAt?: string;
  translations?: Partial<Record<"de" | "fr" | "en" | "ar" | "ru", { title: string; description: string }>>;
  ownerName?: string; ownerId?: string; createdAt?: string; updatedAt?: string; source?: "demo" | "user";
};

const photo = (id: string, width = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
export const DEMO_LISTINGS: Listing[] = [
  {
    id: "ex-1001", title: "Boğaz'a açılan zamansız bir yaşam", description: "Bebek'in kalbinde, Boğaz ışığını tüm odalarına taşıyan seçkin bir yaşam alanı. Doğal taş ve ahşap dokular, geniş salon ve sakin bir teras. Fotoğraflar ve bilgiler sunum amaçlı örnektir.", purpose: "satilik", propertyType: "daire", price: 42500000, currency: "TRY", city: "İstanbul", district: "Beşiktaş", neighborhood: "Bebek", latitude: 41.077, longitude: 29.043, grossArea: 215, netArea: 185, rooms: "3+1", bedrooms: 3, bathrooms: 2, buildingAge: 4, floor: 4, totalFloors: 6, heating: "Yerden ısıtma", furnished: false, amenities: ["Boğaz manzarası", "Teras", "Otopark", "Asansör", "Güvenlik"], images: [photo("photo-1600607687939-ce8a6c25118c"), photo("photo-1600210492486-724fe5c67fb0"), photo("photo-1600566753086-00f18fb6b3ea")], featured: true, ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1002", title: "Ege kıyısında yalın bir villa", description: "Bodrum'un ritmine uyum sağlayan, gün ışığıyla şekillenen modern villa. Özel havuz, peyzajlı bahçe ve açık yaşam alanlarıyla dingin bir yaz evi.", purpose: "satilik", propertyType: "villa", price: 68500000, currency: "TRY", city: "Muğla", district: "Bodrum", neighborhood: "Yalıkavak", latitude: 37.105, longitude: 27.296, grossArea: 340, netArea: 290, rooms: "5+1", bedrooms: 5, bathrooms: 4, buildingAge: 2, floor: 1, totalFloors: 2, heating: "Klima", furnished: true, amenities: ["Deniz manzarası", "Özel havuz", "Bahçe", "Otopark", "Teras"], images: [photo("photo-1613490493576-7fde63acd811"), photo("photo-1600607687920-4e2a09cf159d"), photo("photo-1600566753190-17f0baa2a6c3")], featured: true, ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1003", title: "Şehir merkezinde modern bir sığınak", description: "Nişantaşı'nda sakin bir sokakta, özenle yenilenmiş ferah daire. Açık mutfak, yüksek tavanlar ve şehir hayatına yakın bir konum.", purpose: "kiralik", propertyType: "daire", price: 95000, currency: "TRY", city: "İstanbul", district: "Şişli", neighborhood: "Nişantaşı", latitude: 41.048, longitude: 28.994, grossArea: 145, netArea: 128, rooms: "2+1", bedrooms: 2, bathrooms: 2, buildingAge: 8, floor: 3, totalFloors: 5, heating: "Kombi", furnished: true, amenities: ["Balkon", "Asansör", "Eşyalı", "Otopark"], images: [photo("photo-1600566753190-17f0baa2a6c3"), photo("photo-1600607688969-a5bfcd646154")], featured: true, ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1004", title: "Doğayla iç içe özel bir adres", description: "Çeşme'de bahçe ve avluyla bütünleşen mimarisiyle dört mevsim yaşanabilecek bir ev. İç ve dış mekan arasındaki doğal geçiş, güneşli Ege günlerine eşlik ediyor.", purpose: "satilik", propertyType: "mustakil", price: 32800000, currency: "TRY", city: "İzmir", district: "Çeşme", neighborhood: "Alaçatı", latitude: 38.284, longitude: 26.378, grossArea: 220, netArea: 185, rooms: "4+1", bedrooms: 4, bathrooms: 3, buildingAge: 3, floor: 1, totalFloors: 2, heating: "Yerden ısıtma", furnished: false, amenities: ["Bahçe", "Teras", "Otopark", "Şömine"], images: [photo("photo-1600596542815-ffad4c1539a9"), photo("photo-1600585154340-be6161a56a0c")], featured: true, ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1005", title: "Akdeniz'e bakan ferah rezidans", description: "Konyaaltı sahiline yakın, gün batımını karşılayan geniş balkonlu rezidans. Sosyal alanlar ve açık plan yaşamla her güne tatil hissi.", purpose: "satilik", propertyType: "rezidans", price: 17900000, currency: "TRY", city: "Antalya", district: "Konyaaltı", neighborhood: "Liman", latitude: 36.865, longitude: 30.635, grossArea: 165, netArea: 145, rooms: "3+1", bedrooms: 3, bathrooms: 2, buildingAge: 1, floor: 8, totalFloors: 12, heating: "Merkezi", furnished: false, amenities: ["Deniz manzarası", "Havuz", "Güvenlik", "Asansör", "Otopark"], images: [photo("photo-1600047509782-20d39509f26d"), photo("photo-1600566753051-f0b89df2dd90")], ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1006", title: "Kadıköy'de karakterli yaşam alanı", description: "Moda'nın yürünebilir sokaklarında, geniş pencereli, yüksek tavanlı ve yenilenmiş bir daire. Kentin enerjisini eve taşıyan sıcak bir atmosfer.", purpose: "satilik", propertyType: "daire", price: 12750000, currency: "TRY", city: "İstanbul", district: "Kadıköy", neighborhood: "Moda", latitude: 40.982, longitude: 29.025, grossArea: 120, netArea: 105, rooms: "2+1", bedrooms: 2, bathrooms: 1, buildingAge: 15, floor: 2, totalFloors: 5, heating: "Kombi", furnished: false, amenities: ["Balkon", "Asansör", "Ulaşım"], images: [photo("photo-1600607688969-a5bfcd646154"), photo("photo-1600566753190-17f0baa2a6c3")], ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1007", title: "Kalkan koyunda manzaralı villa", description: "Kalkan'ın yamaçlarında Akdeniz'e açılan, sonsuzluk havuzlu çağdaş villa. Özel terasları ve geniş yaşam alanlarıyla sakin bir kaçış.", purpose: "kiralik", propertyType: "villa", price: 280000, currency: "TRY", city: "Antalya", district: "Kaş", neighborhood: "Kalkan", latitude: 36.266, longitude: 29.416, grossArea: 280, netArea: 245, rooms: "4+1", bedrooms: 4, bathrooms: 4, buildingAge: 2, floor: 1, totalFloors: 2, heating: "Klima", furnished: true, amenities: ["Deniz manzarası", "Özel havuz", "Bahçe", "Eşyalı", "Otopark"], images: [photo("photo-1600585154340-be6161a56a0c"), photo("photo-1613490493576-7fde63acd811")], ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1008", title: "Urla'da zeytin ağaçları arasında", description: "Urla'nın sakin dokusunda bahçeyle bütünleşen müstakil ev. Geniş veranda, doğal malzemeler ve dört mevsime uygun yaşam.", purpose: "satilik", propertyType: "mustakil", price: 22400000, currency: "TRY", city: "İzmir", district: "Urla", neighborhood: "İskele", latitude: 38.326, longitude: 26.765, grossArea: 190, netArea: 160, rooms: "3+1", bedrooms: 3, bathrooms: 2, buildingAge: 5, floor: 1, totalFloors: 2, heating: "Kombi", furnished: false, amenities: ["Bahçe", "Teras", "Otopark", "Şömine"], images: [photo("photo-1600566752355-35792bedcfea"), photo("photo-1600596542815-ffad4c1539a9")], ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1009", title: "Marinaya birkaç adım mesafede", description: "Fethiye'de denize yakın, aydınlık ve kullanışlı daire. Balkonlu salonu ve pratik planıyla kolay bir kıyı yaşamı.", purpose: "kiralik", propertyType: "daire", price: 42000, currency: "TRY", city: "Muğla", district: "Fethiye", neighborhood: "Karagözler", latitude: 36.624, longitude: 29.104, grossArea: 105, netArea: 90, rooms: "2+1", bedrooms: 2, bathrooms: 1, buildingAge: 6, floor: 2, totalFloors: 4, heating: "Klima", furnished: true, amenities: ["Balkon", "Eşyalı", "Deniz manzarası"], images: [photo("photo-1600573472591-ee6b68d14c68"), photo("photo-1600210492486-724fe5c67fb0")], ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1010", title: "Bağdat Caddesi'nde rafine bir ev", description: "Caddeye yakın konumda, ışık alan salonu ve işlevsel planıyla güçlü bir şehir adresi. Modern detaylar ve yalın malzemeler öne çıkıyor.", purpose: "satilik", propertyType: "daire", price: 19800000, currency: "TRY", city: "İstanbul", district: "Kadıköy", neighborhood: "Suadiye", latitude: 40.963, longitude: 29.088, grossArea: 175, netArea: 152, rooms: "3+1", bedrooms: 3, bathrooms: 2, buildingAge: 0, floor: 5, totalFloors: 10, heating: "Yerden ısıtma", furnished: false, amenities: ["Balkon", "Otopark", "Asansör", "Güvenlik"], images: [photo("photo-1600566753086-00f18fb6b3ea"), photo("photo-1600607687939-ce8a6c25118c")], ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1011", title: "Yatırım için değerli arsa", description: "Gümüşlük çevresinde gelişen bölgede, ulaşımı kolay ve geniş kullanım seçenekleri sunan arsa. İmar ve tapu detayları doğrulanmalıdır.", purpose: "satilik", propertyType: "arsa", price: 11900000, currency: "TRY", city: "Muğla", district: "Bodrum", neighborhood: "Gümüşlük", latitude: 37.049, longitude: 27.233, grossArea: 860, amenities: ["Yola yakın", "Doğa manzarası"], images: [photo("photo-1500382017468-9049fed747ef"), photo("photo-1470770841072-f978cf4d019e")], ownerName: "Sales or rent", source: "demo"
  },
  {
    id: "ex-1012", title: "Levent'te prestijli ofis alanı", description: "Merkezi iş aksında, esnek kullanım planına sahip çağdaş ofis. Toplantı alanları ve güçlü ulaşım bağlantılarıyla işletmeler için iyi bir konum.", purpose: "kiralik", propertyType: "ticari", price: 175000, currency: "TRY", city: "İstanbul", district: "Şişli", neighborhood: "Levent", latitude: 41.082, longitude: 29.012, grossArea: 260, netArea: 235, bathrooms: 2, buildingAge: 4, floor: 8, totalFloors: 22, heating: "Merkezi", amenities: ["Otopark", "Güvenlik", "Asansör", "Ulaşım"], images: [photo("photo-1497366754035-f200968a6e72"), photo("photo-1497366811353-6870744d04b2")], ownerName: "Sales or rent", source: "demo"
  },
];

export { CITIES } from "./turkey-locations";
export const PROPERTY_TYPES: {value: PropertyType; label: string}[] = [
  {value:"daire",label:"Daire"},{value:"villa",label:"Villa"},{value:"mustakil",label:"Müstakil Ev"},{value:"rezidans",label:"Rezidans"},{value:"arsa",label:"Arsa"},{value:"ticari",label:"Ticari"}
];
export const AMENITIES = ["Deniz manzarası","Boğaz manzarası","Havuz","Özel havuz","Bahçe","Teras","Balkon","Otopark","Asansör","Güvenlik","Eşyalı","Şömine"];
export const formatPrice = (value:number, currency="TRY", locale="tr-TR") => new Intl.NumberFormat(locale,{style:"currency",currency,maximumFractionDigits:0}).format(value);
export const typeLabel = (value:string) => PROPERTY_TYPES.find((item)=>item.value===value)?.label || value;

