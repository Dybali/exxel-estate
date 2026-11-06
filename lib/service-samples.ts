// Sample service firms ("Örnek firma") for the Hizmetler directory (/hizmetler), so the sub-site shows
// what it will look like while it has few real firms. Code only: nothing here is ever written to a
// database, and the admin panel, sitemap, counts and stats read the database alone.
//
// Switch: SERVICE_SAMPLES environment variable (wrangler vars / Mittwald container). Empty or unset =
// ON (the default while the directory is young); "0", "false" or "off" = OFF. Turn it off at launch.
// lib/services-server.ts reads it (serviceSamples()); the pages merge the result in:
//   - real firms always come first, samples after (results pages, landing lists, similar firms);
//   - every card shows an "Örnek firma" badge, the profile a banner, no contact actions, no JSON-LD;
//   - samples never count: result totals, category/region counts, stats, noindex decisions,
//     sitemap and ItemList structured data use real firms only.
// Names are invented, firms have no phone, e-mail or website; photos are the site's own editorial
// images (public/editorial, the same files the sample listings use). Ids start with "sample-" so they
// can never collide with the UUIDs of real firms (lib/services.ts validFirmId).
import { SERVICE_CATEGORIES, type ServiceSlug } from "./service-categories";
import { serviceNameSortKey, serviceSearchTokens } from "./service-text";
import { firmSearchText, type ServiceArea, type ServiceFirm, type ServiceQuery, type ServiceResults, type ServiceSort } from "./services";

export const SERVICE_SAMPLE_PREFIX = "sample-";
export const isSampleFirmId = (id: unknown): id is string => typeof id === "string" && id.startsWith(SERVICE_SAMPLE_PREFIX);

/** SERVICE_SAMPLES value → on/off. Unset or empty means on. */
export function serviceSamplesEnabled(value: unknown) {
  const text = typeof value === "string" ? value.trim().toLowerCase() : value == null ? "" : String(value).toLowerCase();
  return !["0", "false", "off", "no"].includes(text);
}

// public/editorial images (Unsplash originals, see docs/visual-sources.md).
const IMAGES = {
  lake: "photo-1470770841072-f978cf4d019e", officeA: "photo-1497366754035-f200968a6e72", officeB: "photo-1497366811353-6870744d04b2",
  field: "photo-1500382017468-9049fed747ef", houseA: "photo-1600047509782-20d39509f26d", houseB: "photo-1600047509807-ba8f99d2cdde",
  living: "photo-1600210492486-724fe5c67fb0", bath: "photo-1600566752355-35792bedcfea", bedroom: "photo-1600566753051-f0b89df2dd90",
  lounge: "photo-1600566753086-00f18fb6b3ea", facade: "photo-1600566753190-17f0baa2a6c3", terrace: "photo-1600573472591-ee6b68d14c68",
  garden: "photo-1600585154340-be6161a56a0c", pool: "photo-1600596542815-ffad4c1539a9", dining: "photo-1600607687920-4e2a09cf159d",
  kitchen: "photo-1600607687939-ce8a6c25118c", yard: "photo-1600607688969-a5bfcd646154", villa: "photo-1613490493576-7fde63acd811",
} as const;
type Image = keyof typeof IMAGES;
const image = (name: Image) => `/editorial/${IMAGES[name]}.webp`;

type Seed = {
  key: string; name: string; categories: ServiceSlug[];
  /** "Muğla/Bodrum, Muğla/Milas"; a province alone ("İzmir") = the whole province. */
  areas: string; verified?: boolean; featured?: boolean; cover?: Image; photos?: Image[]; tr: string; en: string;
};

const SEEDS: Seed[] = [
  // Tadilat ve bakım
  { key: "kuzey-boya", name: "Kuzey Boya Dekorasyon", categories: ["boyaci-badanaci", "anahtar-teslim-tadilat"], areas: "İstanbul/Kadıköy, İstanbul/Üsküdar, İstanbul/Ataşehir", verified: true, featured: true, cover: "living", photos: ["lounge", "bedroom"],
    tr: "Anadolu yakasında iç cephe boyası, saten alçı ve dekoratif duvar uygulamaları. Eşyalar örtülür, iş bitince temizlik yapılır.", en: "Interior painting, satin plaster and decorative wall finishes on Istanbul's Asian side; furniture is covered and the rooms cleaned afterwards." },
  { key: "ege-renk", name: "Ege Renk Boya Badana", categories: ["boyaci-badanaci"], areas: "İzmir/Karşıyaka, İzmir/Bornova", verified: true, cover: "terrace",
    tr: "Daire ve müstakil evlerde iç ve dış cephe boyası, badana ve rutubet sonrası onarım. Ücretsiz keşif, yazılı fiyat.", en: "Interior and exterior painting, whitewash and damp repairs for flats and houses; free site visit and a written quote." },
  { key: "yali-firca", name: "Yalı Fırça Boya", categories: ["boyaci-badanaci", "cati-yalitim"], areas: "Muğla/Bodrum, Muğla/Milas", cover: "facade",
    tr: "Bodrum villalarında dış cephe boyası, tuzlu havaya dayanıklı uygulamalar ve sezon öncesi bakım boyası.", en: "Exterior painting for villas around Bodrum with salt-resistant coatings and pre-season touch-ups." },
  { key: "damla-tesisat", name: "Damla Tesisat ve Kombi Servisi", categories: ["tesisatci", "klima"], areas: "Ankara/Çankaya, Ankara/Yenimahalle", verified: true, featured: true, cover: "bath",
    tr: "Su ve doğalgaz tesisatı, cihazla kaçak tespiti, kombi bakımı ve petek temizliği. Aynı gün servis randevusu.", en: "Water and gas plumbing, leak detection, boiler servicing and radiator flushing, with same-day appointments." },
  { key: "akdeniz-su", name: "Akdeniz Su Tesisatı", categories: ["tesisatci"], areas: "Antalya/Muratpaşa, Antalya/Konyaaltı", verified: true,
    tr: "Banyo ve mutfak tesisatı yenileme, tıkanıklık açma, su deposu ve hidrofor montajı.", en: "Bathroom and kitchen plumbing renewals, drain unblocking, water tanks and booster pumps." },
  { key: "marmara-tesisat", name: "Marmara Tesisat Atölyesi", categories: ["tesisatci", "fayans-parke-zemin"], areas: "Bursa/Nilüfer, Bursa/Osmangazi", cover: "bath",
    tr: "Banyo tadilatında tesisat ve fayans işini tek ekip yapar; gömme rezervuar ve duşakabin montajı.", en: "One team for plumbing and tiling in bathroom renovations, including concealed cisterns and shower enclosures." },
  { key: "voltaj-elektrik", name: "Voltaj Elektrik Hizmetleri", categories: ["elektrikci", "akilli-ev-guvenlik"], areas: "İstanbul/Beşiktaş, İstanbul/Şişli, İstanbul/Sarıyer", verified: true, cover: "officeB",
    tr: "Daire ve ofislerde elektrik tesisatı yenileme, sigorta panosu, topraklama ölçümü ve aydınlatma montajı.", en: "Rewiring, fuse boards, earthing tests and lighting installation for flats and offices." },
  { key: "isilti-elektrik", name: "Işıltı Elektrik Tesisat", categories: ["elektrikci"], areas: "İzmir/Konak, İzmir/Buca",
    tr: "Arıza onarımı, priz ve anahtar değişimi, avize ve spot montajı. Küçük işler için de gelinir.", en: "Fault repairs, sockets and switches, chandeliers and spotlights; small jobs welcome." },
  { key: "liman-elektrik", name: "Liman Elektrik", categories: ["elektrikci", "klima"], areas: "Mersin/Yenişehir, Mersin/Mezitli",
    tr: "Elektrik arızası, yeni daire tesisatı ve klima hattı çekimi. Site yönetimlerine periyodik bakım.", en: "Electrical faults, new-flat wiring and air-conditioning circuits; scheduled maintenance for residential complexes." },
  { key: "taszemin", name: "Taşzemin Fayans Parke", categories: ["fayans-parke-zemin"], areas: "İstanbul/Beylikdüzü, İstanbul/Bakırköy", verified: true, cover: "dining",
    tr: "Seramik, granit ve büyük ebat porselen döşeme; laminat parke ve şap tamiri.", en: "Ceramic, granite and large-format porcelain tiling, laminate flooring and screed repairs." },
  { key: "mese-parke", name: "Meşe Parke Uygulama", categories: ["fayans-parke-zemin", "marangoz-mutfak-dolap"], areas: "Ankara/Etimesgut, Ankara/Çankaya", cover: "bedroom",
    tr: "Masif ve lamine parke döşeme, eski parke silme ve cilalama, süpürgelik ve kapı pervazı.", en: "Solid and engineered wood floors, sanding and varnishing old parquet, skirting and door trims." },
  { key: "ardic-ahsap", name: "Ardıç Ahşap Mutfak ve Dolap", categories: ["marangoz-mutfak-dolap", "ic-mimar-dekorasyon"], areas: "İzmir/Bornova, İzmir/Urla", verified: true, featured: true, cover: "kitchen", photos: ["dining", "living"],
    tr: "Özel ölçü mutfak dolabı, gömme dolap ve vestiyer. Çizimden montaja kendi atölyemizde üretim.", en: "Made-to-measure kitchens, built-in wardrobes and hallway units, designed and built in our own workshop." },
  { key: "cinaralti", name: "Çınaraltı Marangoz Atölyesi", categories: ["marangoz-mutfak-dolap"], areas: "Bursa", cover: "kitchen",
    tr: "Ahşap kapı, merdiven, raf ve mutfak tadilatı. Eski dolapların kapak ve menteşe yenilemesi.", en: "Wooden doors, stairs, shelving and kitchen refits, plus new fronts and hinges for old cabinets." },
  { key: "kiremit-cati", name: "Kiremit Çatı ve Yalıtım", categories: ["cati-yalitim"], areas: "Ankara/Keçiören, Ankara/Yenimahalle, Ankara/Gölbaşı", verified: true, cover: "houseA",
    tr: "Çatı aktarma, kiremit değişimi, oluk montajı ve mantolama. Kış öncesi çatı kontrolü.", en: "Roof re-laying, tile replacement, gutters and external insulation; pre-winter roof checks." },
  { key: "mavi-kalkan", name: "Mavi Kalkan Su Yalıtım", categories: ["cati-yalitim", "havuz-bakimi"], areas: "Antalya/Alanya, Antalya/Manavgat", cover: "houseB",
    tr: "Teras, balkon, bodrum ve havuzlarda su yalıtımı; sızıntı tespiti ve garanti belgeli uygulama.", en: "Waterproofing for terraces, balconies, basements and pools, with leak detection and a written guarantee." },
  { key: "seffaf-pvc", name: "Şeffaf PVC Pencere Sistemleri", categories: ["pencere-kapi"], areas: "İstanbul/Pendik, İstanbul/Kartal, İstanbul/Maltepe", verified: true, cover: "terrace",
    tr: "PVC ve alüminyum pencere, ısıcam değişimi, sineklik ve çelik kapı montajı.", en: "PVC and aluminium windows, double-glazing replacement, insect screens and steel doors." },
  { key: "ruzgargulu", name: "Rüzgârgülü Cam Balkon", categories: ["pencere-kapi"], areas: "İzmir/Çeşme, İzmir/Urla", cover: "lounge",
    tr: "Katlanır cam balkon, sürme sistemler ve rüzgâra dayanıklı doğrama; yazlıklara özel ölçü.", en: "Folding glass balconies, sliding systems and wind-resistant frames made to measure for holiday homes." },
  { key: "serin-hava", name: "Serin Hava Klima Servisi", categories: ["klima"], areas: "Antalya/Muratpaşa, Antalya/Konyaaltı, Antalya/Kemer", verified: true, featured: true, cover: "terrace",
    tr: "Klima montajı, yıllık bakım, gaz dolumu ve arıza servisi. Yaz öncesi toplu bakım kampanyası.", en: "Air-conditioning installation, annual servicing, refrigerant top-ups and repairs." },
  { key: "poyraz", name: "Poyraz İklimlendirme", categories: ["klima", "elektrikci"], areas: "Muğla/Fethiye, Muğla/Dalaman",
    tr: "Split ve multi klima, ısı pompası ve villalarda merkezi iklimlendirme çözümleri.", en: "Split and multi-split units, heat pumps and central climate systems for villas." },
  { key: "atolye-tadilat", name: "Atölye Tadilat ve Yapı", categories: ["anahtar-teslim-tadilat", "boyaci-badanaci", "fayans-parke-zemin"], areas: "İstanbul/Kadıköy, İstanbul/Beşiktaş", verified: true, featured: true, cover: "lounge", photos: ["kitchen", "bath", "dining"],
    tr: "Daire tadilatını projeden teslime tek sözleşmeyle yapıyoruz: yıkım, tesisat, zemin, boya ve mutfak.", en: "Complete flat renovations under one contract, from design to handover: demolition, services, floors, paint and kitchen." },
  { key: "kiyi-yapi", name: "Kıyı Yapı Renovasyon", categories: ["anahtar-teslim-tadilat"], areas: "Muğla/Bodrum, Muğla/Marmaris", verified: true, cover: "villa", photos: ["pool"],
    tr: "Yazlık ve villaların kış döneminde yenilenmesi; sahibi yurt dışındayken fotoğraflı ilerleme raporu.", en: "Winter renovations of holiday homes and villas, with photo progress reports for owners living abroad." },
  { key: "baskent-yenileme", name: "Başkent Ev Yenileme", categories: ["anahtar-teslim-tadilat"], areas: "Ankara/Çankaya", cover: "living",
    tr: "Eski apartman dairelerinde banyo, mutfak ve zemin yenileme; kiraya vermeden önce hızlı tadilat.", en: "Bathroom, kitchen and floor renewals in older flats, including quick refreshes before letting." },
  // Bahçe ve dış mekân
  { key: "yesil-vadi", name: "Yeşil Vadi Peyzaj", categories: ["bahcivan-peyzaj", "havuz-bakimi"], areas: "Muğla/Bodrum, Muğla/Milas", verified: true, featured: true, cover: "garden", photos: ["yard"],
    tr: "Villa bahçelerinde düzenli bakım, damla sulama, çim serimi ve Akdeniz bitkileriyle peyzaj.", en: "Regular villa garden care, drip irrigation, new lawns and Mediterranean planting." },
  { key: "zeytin-dali", name: "Zeytin Dalı Bahçe Bakımı", categories: ["bahcivan-peyzaj", "ilaclama"], areas: "İzmir/Urla, İzmir/Seferihisar, İzmir/Güzelbahçe", cover: "yard",
    tr: "Zeytin ve meyve ağacı budama, bahçe temizliği ve doğal yöntemlerle zararlı kontrolü.", en: "Olive and fruit tree pruning, garden clearing and natural pest control." },
  { key: "lale-peyzaj", name: "Lale Peyzaj Mimarlık", categories: ["bahcivan-peyzaj"], areas: "İstanbul/Sarıyer, İstanbul/Ataşehir", verified: true, cover: "garden",
    tr: "Bahçe ve teras peyzaj projesi, aydınlatma ve otomatik sulama. Site ortak alanlarına bakım sözleşmesi.", en: "Garden and terrace landscape design, lighting and automatic irrigation; maintenance contracts for complexes." },
  { key: "turkuaz-havuz", name: "Turkuaz Havuz Bakım", categories: ["havuz-bakimi"], areas: "Antalya/Alanya, Antalya/Kemer, Antalya/Kaş", verified: true, cover: "pool",
    tr: "Haftalık havuz temizliği, pH ve klor dengesi, pompa ve filtre servisi. Sezon açılışı ve kapanışı.", en: "Weekly pool cleaning, pH and chlorine balance, pump and filter service, season opening and closing." },
  { key: "berrak-havuz", name: "Berrak Havuz Teknik", categories: ["havuz-bakimi"], areas: "Muğla/Fethiye, Muğla/Marmaris", cover: "villa",
    tr: "Villa havuzlarında bakım, kaplama tamiri, tuz klorinatörü ve ısı pompası montajı.", en: "Villa pool maintenance, lining repairs, salt chlorinators and heat pumps." },
  { key: "temiz-bahce", name: "Temiz Bahçe İlaçlama", categories: ["ilaclama"], areas: "Ankara/Gölbaşı, Ankara/Etimesgut",
    tr: "Ev ve bahçelerde böcek, kene ve kemirgen ilaçlaması. Evcil hayvanlı evler için uygun ürünler.", en: "Insect, tick and rodent control for homes and gardens, with pet-friendly products." },
  { key: "kalkan-hasere", name: "Kalkan Haşere Kontrol", categories: ["ilaclama"], areas: "Antalya, Mersin", verified: true, cover: "field",
    tr: "Sitelerde ve otellerde periyodik ilaçlama, sivrisinek ve hamamböceği kontrolü, belgeli uygulama.", en: "Scheduled pest control for complexes and hotels, mosquitoes and cockroaches, with certificates." },
  // Taşınma ve temizlik
  { key: "yolcu-nakliyat", name: "Yolcu Evden Eve Nakliyat", categories: ["evden-eve-nakliyat", "esya-depolama"], areas: "İstanbul, Ankara", verified: true, featured: true,
    tr: "Paketleme, asansörlü taşıma ve sigortalı şehirler arası nakliyat. Gerekirse eşyalar depomuzda bekler.", en: "Packing, lift-assisted moves and insured long-distance removals, with storage in our warehouse if needed." },
  { key: "korfez-tasima", name: "Körfez Taşımacılık", categories: ["evden-eve-nakliyat"], areas: "İzmir", verified: true,
    tr: "İzmir içi ev ve ofis taşıma, mobilya söküm ve kurulum, hafta sonu taşıma seçeneği.", en: "Home and office moves within Izmir, furniture dismantling and assembly, weekend moves available." },
  { key: "toros-nakliyat", name: "Toros Nakliyat", categories: ["evden-eve-nakliyat"], areas: "Mersin/Yenişehir, Mersin/Mezitli, Mersin/Erdemli",
    tr: "Şehir içi ve yazlık taşımaları, parça eşya ve beyaz eşya nakli.", en: "Local and holiday-home moves, single items and white goods." },
  { key: "piril-temizlik", name: "Pırıl Ev Temizliği", categories: ["temizlik", "hali-koltuk-yikama"], areas: "İstanbul/Ataşehir, İstanbul/Kadıköy, İstanbul/Üsküdar", verified: true, cover: "lounge",
    tr: "Düzenli ev temizliği, taşınma öncesi ve sonrası detaylı temizlik, yerinde koltuk yıkama.", en: "Regular home cleaning, deep cleans before and after moving, on-site sofa cleaning." },
  { key: "parlak-temizlik", name: "Parlak Temizlik Hizmetleri", categories: ["temizlik"], areas: "Antalya/Alanya", cover: "bedroom",
    tr: "İnşaat sonrası temizlik, cam ve balkon temizliği, kiralık daireler için devir teslim temizliği.", en: "Post-construction cleaning, windows and balconies, and changeover cleaning for rental flats." },
  { key: "sahil-villa-temizlik", name: "Sahil Villa Temizlik", categories: ["temizlik", "kisa-donem-kiralama"], areas: "Muğla/Bodrum, Muğla/Fethiye", verified: true, cover: "pool",
    tr: "Tatil evlerinde misafir değişim temizliği, çamaşır ve havlu hizmeti, sezon öncesi genel temizlik.", en: "Guest changeover cleaning, linen and towel service and pre-season deep cleans for holiday homes." },
  { key: "yumusak-dokunus", name: "Yumuşak Dokunuş Halı Yıkama", categories: ["hali-koltuk-yikama"], areas: "Ankara/Keçiören, Ankara/Yenimahalle",
    tr: "Halı, kilim ve battaniye yıkama; ücretsiz alım ve teslim, yerinde koltuk ve yatak temizliği.", en: "Carpet, rug and blanket washing with free collection and delivery; on-site sofa and mattress cleaning." },
  { key: "nilufer-hali", name: "Nilüfer Halı Koltuk Yıkama", categories: ["hali-koltuk-yikama"], areas: "Bursa/Nilüfer, Bursa/Mudanya", verified: true, cover: "living",
    tr: "Fabrikada halı yıkama ve kurutma, perde ve stor yıkama, leke çıkarma.", en: "Factory carpet washing and drying, curtain and blind cleaning, stain removal." },
  { key: "guvenli-kutu", name: "Güvenli Kutu Depolama", categories: ["esya-depolama"], areas: "İstanbul/Esenyurt, İstanbul/Beylikdüzü", verified: true,
    tr: "Kameralı ve alarmlı depoda aylık kiralık eşya odaları, tadilat süresince kısa dönem depolama.", en: "Monthly storage rooms in a monitored, alarmed warehouse; short-term storage during renovations." },
  { key: "ege-depo", name: "Ege Depo ve Arşiv", categories: ["esya-depolama", "evden-eve-nakliyat"], areas: "İzmir/Bornova",
    tr: "Ev eşyası ve arşiv depolama, adresten alım ve istenen tarihte teslim.", en: "Household and archive storage with collection from your address and delivery on the date you choose." },
  // Hukuk, finans ve resmî işler
  { key: "muhur-tapu", name: "Mühür Tapu Danışmanlık", categories: ["tapu-takibi", "abonelik-islemleri"], areas: "Antalya/Alanya, Antalya/Muratpaşa", verified: true, featured: true, cover: "officeA",
    tr: "Tapu randevusu, harç hesabı, belge hazırlığı ve devir günü eşlik. Yabancı alıcılar için abonelik devri.", en: "Title deed appointments, fee calculation, paperwork and support on transfer day; utility transfers for foreign buyers." },
  { key: "kadastro-tapu", name: "Kadastro Tapu Takip Bürosu", categories: ["tapu-takibi"], areas: "İstanbul/Şişli, İstanbul/Beşiktaş", cover: "officeB",
    tr: "Tapu devri, intikal, cins değişikliği ve kat irtifakı işlemlerinin takibi.", en: "Follow-up of title transfers, inheritance registrations, change of use and condominium titles." },
  { key: "belge-tapu", name: "Belge Tapu ve Resmî İşler", categories: ["tapu-takibi", "yeminli-tercuman"], areas: "Mersin/Mezitli, Mersin/Erdemli",
    tr: "Tapu ve belediye işlemleri, değerleme raporu randevusu ve tercüman ayarlama.", en: "Land registry and municipal paperwork, valuation report appointments and interpreter arrangements." },
  { key: "terazi-hukuk", name: "Terazi Gayrimenkul Hukuk Bürosu", categories: ["gayrimenkul-avukati", "oturma-izni-vatandaslik"], areas: "İstanbul/Şişli, İstanbul/Kadıköy", verified: true, featured: true, cover: "officeA",
    tr: "Satış ve kira sözleşmeleri, tapu kaydı incelemesi, kira uyuşmazlıkları ve yatırım yoluyla vatandaşlık.", en: "Sale and lease contracts, title checks, tenancy disputes and citizenship by investment." },
  { key: "pusula-hukuk", name: "Pusula Gayrimenkul Hukuku", categories: ["gayrimenkul-avukati"], areas: "Antalya/Alanya, Antalya/Konyaaltı", verified: true, cover: "officeB",
    tr: "Yabancı alıcılara satın alma öncesi hukuki kontrol, vekâletname ile işlem ve İngilizce, Almanca görüşme.", en: "Pre-purchase legal checks for foreign buyers, transactions by power of attorney, meetings in English and German." },
  { key: "akdeniz-sozlesme", name: "Akdeniz Sözleşme ve Tapu Hukuku", categories: ["gayrimenkul-avukati", "tapu-takibi"], areas: "Muğla/Fethiye, Muğla/Bodrum",
    tr: "Villa ve arsa alımlarında imar durumu, kat irtifakı ve sözleşme incelemesi.", en: "Zoning, condominium title and contract reviews for villa and land purchases." },
  { key: "lisan-tercume", name: "Lisan Yeminli Tercüme", categories: ["yeminli-tercuman"], areas: "Antalya/Alanya, Antalya/Manavgat", verified: true,
    tr: "Tapu dairesinde Rusça, Almanca ve İngilizce yeminli tercümanlık; noter onaylı belge çevirisi.", en: "Sworn interpreting in Russian, German and English at the land registry; notarised translations." },
  { key: "kopru-tercume", name: "Köprü Tercüme Bürosu", categories: ["yeminli-tercuman", "oturma-izni-vatandaslik"], areas: "İstanbul/Beyoğlu, İstanbul/Şişli",
    tr: "Arapça, Farsça ve İngilizce yeminli tercüme; ikamet başvurusu için belge çevirisi.", en: "Sworn translation in Arabic, Persian and English; document translations for residence applications." },
  { key: "deger-ekspertiz", name: "Değer Ekspertiz ve Değerleme", categories: ["ekspertiz-degerleme"], areas: "Ankara", verified: true, cover: "officeA",
    tr: "Lisanslı değerleme uzmanlarıyla konut, arsa ve iş yeri değerleme raporu.", en: "Valuation reports for homes, land and commercial property by licensed valuers." },
  { key: "pergel-degerleme", name: "Pergel Gayrimenkul Değerleme", categories: ["ekspertiz-degerleme"], areas: "İzmir, Muğla", cover: "houseA",
    tr: "Satış öncesi piyasa değeri tespiti, banka ve vatandaşlık başvuruları için değerleme raporu.", en: "Market value assessments before sale and valuation reports for bank and citizenship applications." },
  { key: "hesap-kalemi", name: "Hesap Kalemi Mali Müşavirlik", categories: ["mali-musavir"], areas: "İstanbul/Kadıköy, İstanbul/Maltepe", verified: true, cover: "officeB",
    tr: "Kira geliri beyannamesi, emlak vergisi ve değer artış kazancı hesaplaması.", en: "Rental income tax returns, property tax and capital gains calculations." },
  { key: "defter-musavirlik", name: "Defter Mali Müşavirlik", categories: ["mali-musavir", "konut-kredisi"], areas: "Bursa/Osmangazi, Bursa/Nilüfer",
    tr: "Ev sahiplerine vergi danışmanlığı, kira stopajı ve kredi başvurusu için gelir belgeleri.", en: "Tax advice for landlords, rent withholding tax and income documents for loan applications." },
  { key: "anahtar-kredi", name: "Anahtar Kredi Danışmanlık", categories: ["konut-kredisi"], areas: "İstanbul", verified: true,
    tr: "Konut kredisi seçeneklerini karşılaştırma, başvuru dosyası hazırlığı ve banka randevuları.", en: "Comparing mortgage options, preparing the application file and arranging bank appointments." },
  { key: "yuva-finans", name: "Yuva Finans Danışmanlığı", categories: ["konut-kredisi", "sigorta"], areas: "Ankara/Çankaya, Ankara/Etimesgut",
    tr: "İlk evini alanlara kredi ve DASK süreçlerinde rehberlik, ödeme planı hesaplama.", en: "Guidance for first-time buyers on mortgages and earthquake insurance, with repayment plans." },
  { key: "guvence-sigorta", name: "Güvence Sigorta Aracılık", categories: ["sigorta"], areas: "İzmir/Karşıyaka, İzmir/Bornova, İzmir/Konak", verified: true,
    tr: "DASK, konut ve eşya sigortası; birkaç sigorta şirketinden teklif karşılaştırma.", en: "Earthquake (DASK), home and contents insurance, comparing quotes from several insurers." },
  { key: "cati-sigorta", name: "Çatı Sigorta Acentesi", categories: ["sigorta"], areas: "Antalya/Muratpaşa, Antalya/Kemer",
    tr: "Kiralık ve tatil evleri için konut sigortası, hasar dosyası takibi.", en: "Home insurance for rental and holiday properties, claims follow-up." },
  // Yabancı alıcılar ve tatil evleri
  { key: "sahil-mulk", name: "Sahil Mülk Yönetimi", categories: ["mulk-yonetimi", "kisa-donem-kiralama"], areas: "Antalya/Alanya, Antalya/Kemer, Antalya/Konyaaltı", verified: true, featured: true, cover: "houseB", photos: ["pool", "terrace"],
    tr: "Yurt dışında yaşayan ev sahipleri için kiracı bulma, kira tahsilatı, aidat ve fatura ödemeleri, aylık rapor.", en: "Tenant finding, rent collection, service charges and bills, with monthly reports for owners living abroad." },
  { key: "kale-mulk", name: "Kale Mülk Yönetim Hizmetleri", categories: ["mulk-yonetimi", "abonelik-islemleri"], areas: "Muğla/Fethiye, Muğla/Marmaris, Muğla/Bodrum", verified: true, cover: "houseA",
    tr: "Kış aylarında ev kontrolü, bakım ve onarım koordinasyonu, abonelik ve vergi ödemeleri.", en: "Winter house checks, maintenance coordination, utility and tax payments." },
  { key: "kent-kira", name: "Kent Kira Yönetimi", categories: ["mulk-yonetimi"], areas: "İstanbul/Ataşehir, İstanbul/Beşiktaş", cover: "lounge",
    tr: "Uzun dönem kiralık dairelerde kiracı seçimi, sözleşme, depozito ve teslim tutanağı.", en: "Tenant screening, contracts, deposits and inventory reports for long-term rentals." },
  { key: "mavi-koy", name: "Mavi Koy Tatil Evi Yönetimi", categories: ["kisa-donem-kiralama"], areas: "Muğla/Bodrum, Muğla/Datça", featured: true, cover: "pool", photos: ["villa", "terrace"],
    tr: "Villa ilanlarının hazırlanması, rezervasyon takvimi, misafir karşılama, temizlik ve bakım koordinasyonu.", en: "Villa listings, booking calendar, guest check-in, cleaning and maintenance coordination." },
  { key: "lavanta-villa", name: "Lavanta Villa Kiralama Yönetimi", categories: ["kisa-donem-kiralama", "temizlik"], areas: "Antalya/Kaş, Antalya/Kemer", verified: true, cover: "villa",
    tr: "Günlük ve haftalık kiralamalarda fiyatlandırma, misafir iletişimi ve turizm belgesi süreçleri.", en: "Pricing, guest communication and tourism licence paperwork for daily and weekly rentals." },
  { key: "yeni-yurt", name: "Yeni Yurt Göç Danışmanlık", categories: ["oturma-izni-vatandaslik", "yeminli-tercuman"], areas: "İstanbul/Şişli, İstanbul/Kadıköy", verified: true, cover: "officeA",
    tr: "Kısa dönem ikamet izni, aile ikameti ve yatırım yoluyla vatandaşlık başvurularında dosya hazırlığı.", en: "File preparation for short-term and family residence permits and citizenship by investment." },
  { key: "rota-ikamet", name: "Rota İkamet Danışmanlığı", categories: ["oturma-izni-vatandaslik"], areas: "Antalya/Alanya, Antalya/Muratpaşa",
    tr: "Göç idaresi randevusu, sağlık sigortası ve adres kaydı işlemlerinde rehberlik.", en: "Help with immigration office appointments, health insurance and address registration." },
  { key: "liman-ikamet", name: "Liman Vatandaşlık ve İkamet", categories: ["oturma-izni-vatandaslik"], areas: "Mersin/Mezitli, Mersin/Yenişehir",
    tr: "İkamet izni uzatma, çalışma izni ön bilgilendirme ve belge tercümesi koordinasyonu.", en: "Residence permit renewals, work permit guidance and translation coordination." },
  { key: "kolay-abonelik", name: "Kolay Abonelik Hizmetleri", categories: ["abonelik-islemleri"], areas: "Antalya/Alanya, Antalya/Manavgat",
    tr: "Elektrik, su, doğalgaz ve internet aboneliklerinin açılması ve devri; yabancı ev sahiplerine destek.", en: "Opening and transferring electricity, water, gas and internet accounts; support for foreign owners." },
  { key: "hizli-baglanti", name: "Hızlı Bağlantı Abonelik Takibi", categories: ["abonelik-islemleri", "tapu-takibi"], areas: "Muğla/Fethiye, Muğla/Dalaman, Muğla/Ortaca", verified: true,
    tr: "Tapu sonrası abonelik devri, otomatik ödeme talimatı ve sayaç okuma takibi.", en: "Utility transfers after the title deed, direct debits and meter reading follow-up." },
  // Tasarım ve güvenlik
  { key: "doku-ic-mimarlik", name: "Doku İç Mimarlık", categories: ["ic-mimar-dekorasyon", "mobilya-beyaz-esya"], areas: "İstanbul/Beşiktaş, İstanbul/Sarıyer", verified: true, featured: true, cover: "dining", photos: ["living", "bedroom", "lounge"],
    tr: "Daire ve villalarda iç mimari proje, malzeme seçimi, mobilya tasarımı ve uygulama yönetimi.", en: "Interior design for flats and villas: materials, bespoke furniture and site management." },
  { key: "kum-saati", name: "Kum Saati Dekorasyon", categories: ["ic-mimar-dekorasyon"], areas: "İzmir/Çeşme, İzmir/Urla", verified: true, cover: "living",
    tr: "Yazlık evler için sade ve doğal malzemeli dekorasyon, kiraya hazır ev stilizasyonu.", en: "Simple, natural-material decoration for holiday homes and styling ready for letting." },
  { key: "atrium", name: "Atrium İç Mekân Tasarım", categories: ["ic-mimar-dekorasyon", "anahtar-teslim-tadilat"], areas: "Ankara/Çankaya", cover: "bedroom",
    tr: "Ofis ve konut iç mekân tasarımı, 3B görselleştirme ve anahtar teslim uygulama.", en: "Office and residential interiors with 3D visualisation and turnkey delivery." },
  { key: "nobetci-alarm", name: "Nöbetçi Alarm ve Kamera", categories: ["akilli-ev-guvenlik"], areas: "İstanbul/Bakırköy, İstanbul/Beylikdüzü", verified: true,
    tr: "Alarm, IP kamera ve görüntülü diyafon kurulumu; telefondan izleme ve bakım sözleşmesi.", en: "Alarm, IP camera and video intercom installation with phone monitoring and maintenance plans." },
  { key: "akilli-yuva", name: "Akıllı Yuva Sistemleri", categories: ["akilli-ev-guvenlik", "elektrikci"], areas: "Bursa/Nilüfer, Bursa/Mudanya", cover: "terrace",
    tr: "Akıllı aydınlatma, perde ve iklimlendirme kontrolü; uzaktan izlenebilen yazlık güvenliği.", en: "Smart lighting, blinds and climate control, plus remotely monitored security for holiday homes." },
  { key: "konak-mobilya", name: "Konak Mobilya ve Beyaz Eşya", categories: ["mobilya-beyaz-esya"], areas: "Antalya/Alanya, Antalya/Konyaaltı", verified: true, cover: "lounge",
    tr: "Kiralık ve tatil evleri için eşyalı paketler; mobilya, beyaz eşya ve tekstil, teslimat ve kurulum dahil.", en: "Furnishing packages for rental and holiday homes: furniture, appliances and textiles, delivered and installed." },
  { key: "dort-mevsim", name: "Dört Mevsim Ev Gereçleri", categories: ["mobilya-beyaz-esya"], areas: "Mersin/Yenişehir, Mersin/Mezitli", cover: "bedroom",
    tr: "Beyaz eşya satışı ve montajı, yatak ve ev tekstili; taşınma günü kurulum.", en: "Appliance sales and installation, beds and home textiles, set up on moving day." },
  { key: "gokyuzu-drone", name: "Gökyüzü Drone ve Emlak Fotoğrafı", categories: ["emlak-fotografciligi"], areas: "Muğla, Aydın/Didim, Aydın/Kuşadası", verified: true, featured: true, cover: "villa", photos: ["pool", "garden", "lake"],
    tr: "Villa ve arsa ilanları için drone çekimi, profesyonel fotoğraf ve kısa tanıtım videosu.", en: "Drone footage, professional photos and short videos for villa and land listings." },
  { key: "panorama-360", name: "Panorama 360 Sanal Tur", categories: ["emlak-fotografciligi"], areas: "İstanbul", verified: true, cover: "lounge", photos: ["kitchen"],
    tr: "360° sanal tur, kat planı çizimi ve ilan fotoğrafı; aynı gün teslim seçeneği.", en: "360° virtual tours, floor plans and listing photos with same-day delivery." },
  { key: "kadraj-medya", name: "Kadraj Emlak Medya", categories: ["emlak-fotografciligi"], areas: "Balıkesir/Ayvalık, Balıkesir/Edremit, İzmir/Çeşme", cover: "lake",
    tr: "Kuzey Ege'de emlak fotoğrafçılığı, gün batımı çekimleri ve sosyal medya için kısa videolar.", en: "Property photography in the North Aegean, sunset shoots and short social media videos." },
];

const ORDER = SERVICE_CATEGORIES.map((category) => category.slug as string);
function areasOf(text: string): ServiceArea[] {
  return text.split(",").map((part) => { const [city, district = ""] = part.trim().split("/"); return { city, district }; })
    .sort((a, b) => a.city.localeCompare(b.city, "tr") || a.district.localeCompare(b.district, "tr"));
}
// Fixed dates (one every 9 hours from 1 October 2026) keep "En yeni" stable between deploys.
const START = Date.UTC(2026, 9, 1, 8);

/** Every sample firm, public fields only, in the shape of a real approved firm plus `sample: true`. */
export const SERVICE_SAMPLE_FIRMS: ServiceFirm[] = SEEDS.map((seed, index) => {
  const stamp = new Date(START + index * 9 * 3600_000).toISOString();
  return {
    id: SERVICE_SAMPLE_PREFIX + seed.key, name: seed.name, description: seed.tr, translations: { en: seed.en },
    categories: [...seed.categories].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)), areas: areasOf(seed.areas),
    phone: "", whatsapp: null, email: null, website: null, logo: null,
    cover: seed.cover ? image(seed.cover) : null, photos: (seed.photos || []).map(image),
    verified: Boolean(seed.verified), featured: Boolean(seed.featured), status: "approved",
    createdAt: stamp, updatedAt: stamp, approvedAt: stamp, sample: true,
  };
});

/** A sample profile, or null when the samples are switched off (an empty list) or the id is unknown. */
export const sampleFirmById = (samples: readonly ServiceFirm[], id: string) => samples.find((firm) => firm.id === id) ?? null;

/** Real firms only (for counts, ItemList, share images and indexing decisions). */
export const realFirms = <T extends Pick<ServiceFirm, "sample">>(firms: readonly T[]) => firms.filter((firm) => !firm.sample);

// The same order as SORT_SQL in lib/services.ts, on the samples alone.
const SEARCH_TEXT = new Map<string, string>(), NAME_KEY = new Map<string, string>();
const searchText = (firm: ServiceFirm) => { let text = SEARCH_TEXT.get(firm.id); if (text === undefined) SEARCH_TEXT.set(firm.id, text = firmSearchText(firm)); return text; };
const nameKey = (firm: ServiceFirm) => { let key = NAME_KEY.get(firm.id); if (key === undefined) NAME_KEY.set(firm.id, key = serviceNameSortKey(firm.name)); return key; };
const byId = (a: ServiceFirm, b: ServiceFirm) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const SORTS: Record<ServiceSort, (a: ServiceFirm, b: ServiceFirm) => number> = {
  featured: (a, b) => Number(b.featured) - Number(a.featured) || Number(b.verified) - Number(a.verified) || b.createdAt.localeCompare(a.createdAt) || byId(a, b),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt) || byId(a, b),
  az: (a, b) => nameKey(a).localeCompare(nameKey(b)) || byId(a, b),
};

/** Samples matching the filters of a results page (same rules as lib/services.ts queryWhere), sorted. */
export function matchSampleFirms(samples: readonly ServiceFirm[], query: ServiceQuery = {}) {
  if (!samples.length) return [];
  const categories = query.categories || [], tokens = serviceSearchTokens(query.q);
  const sort: ServiceSort = query.sort && query.sort in SORTS ? query.sort : "featured";
  return samples.filter((firm) => {
    if (categories.length && !firm.categories.some((slug) => categories.includes(slug))) return false;
    // A district page also lists firms serving the whole province.
    if (query.city && !firm.areas.some((area) => area.city === query.city && (!query.district || !area.district || area.district === query.district))) return false;
    if (query.cities?.length && !firm.areas.some((area) => query.cities!.includes(area.city))) return false;
    if (query.verified && !firm.verified) return false;
    if (query.featured && !firm.featured) return false;
    if (query.photos && !firm.cover && !firm.photos.length) return false;
    if (query.excludeId && firm.id === query.excludeId) return false;
    if (tokens.length) { const text = searchText(firm); if (!tokens.every((token) => text.includes(token))) return false; }
    return true;
  }).sort(SORTS[sort]);
}

/** Results page with samples after the real firms. `total` stays the real count; `samples` is the number of matching samples; `pages` covers both. */
export function withSampleResults(results: ServiceResults, query: ServiceQuery, samples: readonly ServiceFirm[]): ServiceResults {
  const matches = matchSampleFirms(samples, query);
  if (!matches.length) return { ...results, samples: 0 };
  const offset = (results.page - 1) * results.perPage, room = results.perPage - results.firms.length;
  // Sample positions start right after the last real firm.
  const start = Math.max(0, offset - results.total);
  const extra = room > 0 ? matches.slice(start, start + room) : [];
  return { ...results, firms: [...results.firms, ...extra], pages: Math.max(1, Math.ceil((results.total + matches.length) / results.perPage)), samples: matches.length };
}

/** A short list (landing, similar firms): real firms first, filled up to `limit` with samples. */
export function fillWithSamples(real: readonly ServiceFirm[], samples: readonly ServiceFirm[], limit: number) {
  const seen = new Set(real.map((firm) => firm.id));
  return [...real, ...samples.filter((firm) => !seen.has(firm.id))].slice(0, Math.max(limit, real.length));
}

/** "Benzer firmalar" from the samples: same main category in one of the firm's provinces first, then anywhere. */
export function similarSampleFirms(samples: readonly ServiceFirm[], firm: Pick<ServiceFirm, "id" | "categories" | "areas">) {
  const category = firm.categories[0];
  if (!category || !samples.length) return [];
  const cities = [...new Set(firm.areas.map((area) => area.city))];
  const near = matchSampleFirms(samples, { categories: [category], cities, excludeId: firm.id });
  const wider = matchSampleFirms(samples, { categories: [category], excludeId: firm.id });
  return fillWithSamples(near, wider, near.length + wider.length);
}

/** Sample firms per category (a separate "örnek" hint on the landing tiles; never added to real counts). */
export function sampleCategoryCounts(samples: readonly ServiceFirm[]) {
  const counts = Object.fromEntries(SERVICE_CATEGORIES.map((category) => [category.slug, 0])) as Record<ServiceSlug, number>;
  for (const firm of samples) for (const slug of firm.categories) counts[slug] += 1;
  return counts;
}
