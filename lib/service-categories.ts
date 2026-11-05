// Service directory taxonomy ("Hizmetler", /hizmetler). One fixed list in code: categories are
// what visitors search for and what firms choose, so a slug never changes once published.
// Names and descriptions are Turkish source texts translated through the dictionary
// (lib/portal-translations.ts, data/nl-translations.json); tests/services.test.mjs checks that
// every one has all languages. `icon` is a lucide-react icon name (components/ServiceIcon.tsx).

export const SERVICE_GROUPS = [
  { id: "tadilat-bakim", name: "Tadilat ve bakım", icon: "Hammer" },
  { id: "bahce-dis-mekan", name: "Bahçe ve dış mekân", icon: "Trees" },
  { id: "tasinma-temizlik", name: "Taşınma ve temizlik", icon: "Truck" },
  { id: "hukuk-finans", name: "Hukuk, finans ve resmî işler", icon: "Scale" },
  { id: "yabanci-tatil", name: "Yabancı alıcılar ve tatil evleri", icon: "Globe" },
  { id: "tasarim-guvenlik", name: "Tasarım ve güvenlik", icon: "Palette" },
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
  // Bahçe ve dış mekân
  { slug: "bahcivan-peyzaj", group: "bahce-dis-mekan", icon: "Trees", name: "Bahçıvan ve peyzaj", description: "Bahçe bakımı, çim ve ağaç budama, sulama sistemi ve peyzaj tasarımı." },
  { slug: "havuz-bakimi", group: "bahce-dis-mekan", icon: "Waves", name: "Havuz bakımı", description: "Düzenli havuz temizliği, kimyasal dengeleme, pompa ve filtre servisi." },
  { slug: "ilaclama", group: "bahce-dis-mekan", icon: "Bug", name: "İlaçlama ve haşere kontrolü", description: "Böcek, kemirgen ve haşere ilaçlaması; ev, bahçe ve site uygulamaları." },
  // Taşınma ve temizlik
  { slug: "evden-eve-nakliyat", group: "tasinma-temizlik", icon: "Truck", name: "Evden eve nakliyat", description: "Paketleme, asansörlü taşıma, şehir içi ve şehirler arası nakliyat." },
  { slug: "temizlik", group: "tasinma-temizlik", icon: "Sparkles", name: "Ev temizliği ve inşaat sonrası temizlik", description: "Düzenli ev temizliği, taşınma öncesi ve inşaat sonrası detaylı temizlik." },
  { slug: "hali-koltuk-yikama", group: "tasinma-temizlik", icon: "Sofa", name: "Halı ve koltuk yıkama", description: "Halı, koltuk, yatak ve perde yıkama; yerinde veya fabrikada." },
  { slug: "esya-depolama", group: "tasinma-temizlik", icon: "Warehouse", name: "Eşya depolama", description: "Kısa ve uzun süreli güvenli eşya depolama ve arşiv hizmetleri." },
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
