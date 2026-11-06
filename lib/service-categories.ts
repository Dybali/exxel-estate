// Service directory taxonomy ("Hizmetler", /hizmetler). One fixed list in code: categories are
// what visitors search for and what firms choose, so a slug never changes once published.
// Names and descriptions are Turkish source texts translated through the dictionary
// (lib/portal-translations.ts, data/nl-translations.json); tests/services.test.mjs checks that
// every one has all languages. A group's `nav` is the short label of the desktop header tab. `icon` is a lucide-react icon name (components/ServiceIcon.tsx).

export const SERVICE_GROUPS = [
  { id: "tadilat-bakim", name: "Tadilat ve bakım", nav: "Tadilat", icon: "Hammer" },
  { id: "teknik-servis", name: "Teknik servis ve bina hizmetleri", nav: "Teknik servis", icon: "Toolbox" },
  { id: "ev-hizmetleri", name: "Ev hizmetleri ve bakım", nav: "Ev hizmetleri", icon: "House" },
  { id: "tasinma-temizlik", name: "Taşınma ve temizlik", nav: "Taşınma ve temizlik", icon: "Truck" },
  { id: "bahce-dis-mekan", name: "Bahçe ve dış mekân", nav: "Bahçe ve dış mekân", icon: "Trees" },
  { id: "hukuk-finans", name: "Hukuk, finans ve resmî işler", nav: "Hukuk ve finans", icon: "Scale" },
  { id: "yabanci-tatil", name: "Yabancı alıcılar ve tatil evleri", nav: "Yabancı alıcılar", icon: "Globe" },
  { id: "tasarim-guvenlik", name: "Tasarım ve güvenlik", nav: "Tasarım ve güvenlik", icon: "Palette" },
] as const;
export type ServiceGroupId = typeof SERVICE_GROUPS[number]["id"];

export type ServiceCategory = { slug: string; group: ServiceGroupId; name: string; description: string; icon: string };

export const SERVICE_CATEGORIES = [
  // Tadilat ve bakım
  { slug: "boyaci-badanaci", group: "tadilat-bakim", icon: "PaintRoller", name: "Boyacı ve badanacı", description: "İç ve dış cephe boyası, badana, alçı ve dekoratif duvar uygulamaları." },
  { slug: "tesisatci", group: "tadilat-bakim", icon: "Wrench", name: "Tesisatçı", description: "Su ve doğalgaz tesisatı, kaçak tespiti, kombi bakımı ve petek temizliği." },
  { slug: "elektrikci", group: "tadilat-bakim", icon: "Zap", name: "Elektrikçi", description: "Elektrik tesisatı, arıza onarımı, sigorta panosu ve aydınlatma montajı." },
  { slug: "fayans-parke-zemin", group: "tadilat-bakim", icon: "LayoutGrid", name: "Fayans, parke ve zemin ustası", description: "Seramik, fayans, laminat ve masif parke döşeme, şap ve zemin tamiri." },
  { slug: "marangoz-mutfak-dolap", group: "tadilat-bakim", icon: "Hammer", name: "Marangoz, mutfak ve dolap", description: "Mutfak dolabı, gömme dolap, kapı ve özel ölçü ahşap işleri." },
  { slug: "cati-yalitim", group: "tadilat-bakim", icon: "Umbrella", name: "Çatı ve yalıtım", description: "Çatı onarımı, su yalıtımı, mantolama ve ısı yalıtımı uygulamaları." },
  { slug: "pencere-kapi", group: "tadilat-bakim", icon: "DoorOpen", name: "Alüminyum ve PVC pencere, kapı", description: "PVC ve alüminyum doğrama, cam balkon, sineklik ve çelik kapı." },
  { slug: "klima", group: "tadilat-bakim", icon: "AirVent", name: "Klima montaj ve servis", description: "Klima satışı, montajı, bakımı, gaz dolumu ve arıza servisi." },
  { slug: "anahtar-teslim-tadilat", group: "tadilat-bakim", icon: "KeyRound", name: "Anahtar teslim tadilat", description: "Projelendirmeden teslime kadar tüm ev ve iş yeri tadilatı tek elden." },
  // Teknik servis ve bina hizmetleri
  { slug: "beyaz-esya-servisi", group: "teknik-servis", icon: "WashingMachine", name: "Beyaz eşya teknik servisi", description: "Çamaşır ve bulaşık makinesi, buzdolabı, fırın ve kurutucu arızası, bakım ve montaj." },
  { slug: "cilingir", group: "teknik-servis", icon: "LockKeyhole", name: "Çilingir", description: "Kapı açma, kilit ve barel değişimi, çelik kapı kilidi ve kasa çilingirliği." },
  { slug: "ev-ustasi", group: "teknik-servis", icon: "Drill", name: "Ev ustası ve küçük tamirat", description: "Mobilya kurulumu, raf, TV ve perde askısı montajı, musluk ve kapı kolu değişimi gibi küçük işler." },
  { slug: "uydu-anten-internet", group: "teknik-servis", icon: "SatelliteDish", name: "Uydu, anten ve internet kurulumu", description: "Çanak anten ve merkezi uydu sistemi, ev içi ağ kablolaması, modem ve Wi-Fi kurulumu." },
  { slug: "su-deposu-hidrofor", group: "teknik-servis", icon: "Droplets", name: "Su deposu ve hidrofor", description: "Su deposu montajı ve temizliği, hidrofor kurulumu, bakımı ve arıza servisi." },
  { slug: "gunes-enerjisi-jenerator", group: "teknik-servis", icon: "SolarPanel", name: "Güneş enerjisi ve jeneratör", description: "Çatı güneş paneli, güneş enerjili su ısıtıcı, akü sistemi ve jeneratör kurulumu." },
  { slug: "asansor-bakimi", group: "teknik-servis", icon: "ArrowUpDown", name: "Asansör bakım ve servis", description: "Apartman ve site asansörlerinde periyodik bakım, arıza servisi ve modernizasyon." },
  { slug: "site-apartman-yonetimi", group: "teknik-servis", icon: "Building", name: "Site ve apartman yönetimi", description: "Profesyonel site yönetimi, aidat takibi, ortak alan bakımı ve kat malikleri kurulu işleri." },
  { slug: "guvenlik-gorevlisi", group: "teknik-servis", icon: "ShieldUser", name: "Güvenlik görevlisi ve bekçi", description: "Site, şantiye ve villalar için özel güvenlik görevlisi, kapı görevlisi ve devriye hizmeti." },
  // Ev hizmetleri ve bakım
  { slug: "gundelikci", group: "ev-hizmetleri", icon: "BrushCleaning", name: "Gündelikçi ve düzenli ev temizliği", description: "Haftalık veya aylık düzenli ev temizliği, gündelikçi ve yatılı ev yardımcısı." },
  { slug: "utu-camasir", group: "ev-hizmetleri", icon: "Shirt", name: "Ütü ve çamaşır hizmeti", description: "Evde ütü, çamaşır yıkama ve katlama; adresten alım ve teslimli kuru temizleme." },
  { slug: "ev-asci", group: "ev-hizmetleri", icon: "ChefHat", name: "Ev aşçısı ve yemek hizmeti", description: "Evde günlük yemek yapan aşçı, davet ve özel gün yemekleri, haftalık yemek hazırlığı." },
  { slug: "yasli-bakimi", group: "ev-hizmetleri", icon: "HeartHandshake", name: "Evde yaşlı bakımı", description: "Yaşlılar için gündüz veya yatılı bakıcı, refakat, kişisel bakım ve günlük yaşam desteği." },
  { slug: "evde-hasta-bakimi", group: "ev-hizmetleri", icon: "Stethoscope", name: "Evde hasta bakımı ve evde sağlık", description: "Evde hemşirelik, fizyoterapi, yatağa bağımlı hasta bakımı ve ameliyat sonrası refakat." },
  { slug: "cocuk-bakicisi", group: "ev-hizmetleri", icon: "Baby", name: "Çocuk bakıcısı ve dadı", description: "Bebek ve çocuk bakıcısı, gündüzlü veya yatılı dadı, okul sonrası ve saatlik bakım." },
  { slug: "evcil-hayvan-bakimi", group: "ev-hizmetleri", icon: "PawPrint", name: "Evcil hayvan bakımı ve gezdirme", description: "Köpek gezdirme, evde kedi ve köpek bakımı, tatil süresince bakım ve evde pet kuaförü." },
  // Taşınma ve temizlik ("temizlik" is the one-off deep clean; regular household cleaning is "gundelikci")
  { slug: "evden-eve-nakliyat", group: "tasinma-temizlik", icon: "Truck", name: "Evden eve nakliyat", description: "Paketleme, asansörlü taşıma, şehir içi ve şehirler arası nakliyat." },
  { slug: "temizlik", group: "tasinma-temizlik", icon: "Sparkles", name: "Detaylı ev temizliği ve inşaat sonrası temizlik", description: "Taşınma öncesi ve sonrası, inşaat sonrası ve sezon açılışında tek seferlik detaylı temizlik." },
  { slug: "hali-koltuk-yikama", group: "tasinma-temizlik", icon: "Sofa", name: "Halı ve koltuk yıkama", description: "Halı, koltuk, yatak ve perde yıkama; yerinde veya fabrikada." },
  { slug: "esya-depolama", group: "tasinma-temizlik", icon: "Warehouse", name: "Eşya depolama", description: "Kısa ve uzun süreli güvenli eşya depolama ve arşiv hizmetleri." },
  { slug: "cam-cephe-temizligi", group: "tasinma-temizlik", icon: "AppWindow", name: "Cam ve dış cephe temizliği", description: "Pencere ve cam balkon silme, yüksek cephe, vitrin ve güneş paneli temizliği." },
  { slug: "baca-temizligi", group: "tasinma-temizlik", icon: "Flame", name: "Baca ve şömine temizliği", description: "Soba, şömine ve kazan bacası temizliği, kurum alma ve baca çekiş kontrolü." },
  // Bahçe ve dış mekân
  { slug: "bahcivan-peyzaj", group: "bahce-dis-mekan", icon: "Trees", name: "Bahçıvan ve peyzaj", description: "Bahçe bakımı, çim ve ağaç budama, sulama sistemi ve peyzaj tasarımı." },
  { slug: "havuz-bakimi", group: "bahce-dis-mekan", icon: "Waves", name: "Havuz bakımı", description: "Düzenli havuz temizliği, kimyasal dengeleme, pompa ve filtre servisi." },
  { slug: "ilaclama", group: "bahce-dis-mekan", icon: "Bug", name: "İlaçlama ve haşere kontrolü", description: "Böcek, kemirgen ve haşere ilaçlaması; ev, bahçe ve site uygulamaları." },
  { slug: "tente-pergola", group: "bahce-dis-mekan", icon: "Sun", name: "Tente, pergola ve gölgelendirme", description: "Teras ve bahçe için tente, bioklimatik pergola, şemsiye ve gölgelendirme sistemleri." },
  // Hukuk, finans ve resmî işler
  { slug: "tapu-takibi", group: "hukuk-finans", icon: "FileCheck", name: "Tapu takibi", description: "Tapu devri, randevu, harç ve belge işlemlerinin takibi." },
  { slug: "gayrimenkul-avukati", group: "hukuk-finans", icon: "Scale", name: "Gayrimenkul avukatı", description: "Satış ve kira sözleşmeleri, tapu incelemesi ve gayrimenkul uyuşmazlıkları." },
  { slug: "yeminli-tercuman", group: "hukuk-finans", icon: "Languages", name: "Yeminli tercüman", description: "Tapu işlemlerinde tercümanlık, noter onaylı belge çevirisi." },
  { slug: "ekspertiz-degerleme", group: "hukuk-finans", icon: "ClipboardCheck", name: "SPK lisanslı ekspertiz ve değerleme", description: "Lisanslı değerleme raporu, ekspertiz ve piyasa değeri tespiti." },
  { slug: "mali-musavir", group: "hukuk-finans", icon: "Calculator", name: "Mali müşavir", description: "Kira geliri beyannamesi, emlak vergisi ve gayrimenkul vergileri danışmanlığı." },
  { slug: "konut-kredisi", group: "hukuk-finans", icon: "Landmark", name: "Konut kredisi danışmanı", description: "Konut kredisi seçenekleri, başvuru hazırlığı ve banka süreçleri." },
  { slug: "sigorta", group: "hukuk-finans", icon: "ShieldCheck", name: "Sigorta (DASK ve konut)", description: "Zorunlu deprem sigortası (DASK), konut ve eşya sigortası." },
  // Yabancı alıcılar ve tatil evleri
  { slug: "mulk-yonetimi", group: "yabanci-tatil", icon: "Building2", name: "Mülk yönetimi", description: "Kiracı bulma, kira tahsilatı, bakım ve mülkün yerinde takibi." },
  { slug: "kisa-donem-kiralama", group: "yabanci-tatil", icon: "CalendarDays", name: "Kısa dönem kiralama yönetimi", description: "Tatil evi kiralama, rezervasyon, misafir karşılama ve temizlik yönetimi." },
  { slug: "oturma-izni-vatandaslik", group: "yabanci-tatil", icon: "IdCard", name: "Oturma izni ve vatandaşlık danışmanlığı", description: "İkamet izni başvurusu ve yatırım yoluyla vatandaşlık süreçleri." },
  { slug: "abonelik-islemleri", group: "yabanci-tatil", icon: "Plug", name: "Abonelik işlemleri", description: "Elektrik, su, doğalgaz ve internet aboneliklerinin açılması ve devri." },
  // Tasarım ve güvenlik
  { slug: "ic-mimar-dekorasyon", group: "tasarim-guvenlik", icon: "Palette", name: "İç mimar ve dekorasyon", description: "İç mimari proje, dekorasyon, mobilya seçimi ve uygulama." },
  { slug: "akilli-ev-guvenlik", group: "tasarim-guvenlik", icon: "Cctv", name: "Akıllı ev, alarm ve kamera", description: "Alarm, güvenlik kamerası, görüntülü diyafon ve akıllı ev sistemleri." },
  { slug: "mobilya-beyaz-esya", group: "tasarim-guvenlik", icon: "Armchair", name: "Mobilya ve beyaz eşya", description: "Mobilya, beyaz eşya ve ev tekstili satışı, teslimat ve montaj." },
  { slug: "perde-stor-jaluzi", group: "tasarim-guvenlik", icon: "Blinds", name: "Perde, stor ve jaluzi", description: "Ölçüye göre perde, stor, zebra perde ve jaluzi; ölçü alma, dikim ve montaj." },
  { slug: "emlak-fotografciligi", group: "tasarim-guvenlik", icon: "Camera", name: "Emlak fotoğrafçılığı, drone ve 360° tur", description: "Profesyonel ilan fotoğrafı, drone çekimi, video ve 360° sanal tur." },
] as const satisfies readonly ServiceCategory[];
export type ServiceSlug = typeof SERVICE_CATEGORIES[number]["slug"];

const BY_SLUG = new Map<string, ServiceCategory>(SERVICE_CATEGORIES.map((category) => [category.slug, category]));
export const serviceCategory = (slug: string): ServiceCategory | null => BY_SLUG.get(slug) ?? null;
export const isServiceSlug = (value: unknown): value is ServiceSlug => typeof value === "string" && BY_SLUG.has(value);
export const serviceGroup = (id: string) => SERVICE_GROUPS.find((group) => group.id === id) ?? null;
export const categoriesOf = (group: string) => SERVICE_CATEGORIES.filter((category) => category.group === group);

/** Categories offered on listing pages (components/ServiceSuggestions.tsx); none for other purposes (e.g. daily rentals). */
export function listingServiceSlugs(purpose: string, foreignBuyer: boolean): ServiceSlug[] {
  if (purpose === "kiralik") return ["evden-eve-nakliyat", "temizlik", "boyaci-badanaci", "abonelik-islemleri"];
  if (purpose !== "satilik") return [];
  return ["ekspertiz-degerleme", "tapu-takibi", "gayrimenkul-avukati", foreignBuyer ? "yeminli-tercuman" : "evden-eve-nakliyat"];
}
/** Legal and finance categories linked from the foreign buyer guide (/yabanci-alici). */
export const FOREIGN_BUYER_SERVICES: ServiceSlug[] = ["tapu-takibi", "gayrimenkul-avukati", "yeminli-tercuman", "ekspertiz-degerleme", "oturma-izni-vatandaslik", "mali-musavir", "sigorta", "mulk-yonetimi"];
