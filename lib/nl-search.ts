import {AMENITIES,PROPERTY_TYPES} from './listings';
import {CITIES,DISTRICTS} from './turkey-locations';
import {BUSINESS_TYPES,TOURISM_TYPES} from './property-subtypes';
import {HEATING_OPTIONS,ROOM_OPTIONS} from './search-categories';
import {PROPERTY_CATEGORIES,purposeLabel} from './property-categories';
import {DETAIL_FIELDS,FOREIGN_SALE} from './listing-details';
import {formatMoney} from './display-currency';
import {tlPerUnit,type RateSnapshot} from './tcmb';

// Natural-language search ("Doğal dil araması", docs/nl-search.md): a free-text property query in any
// of the site's languages (tr, en, de, fr, ru, ar, fa, nl) becomes /ilanlar filters. Pure and
// deterministic: no network, no database. Words are matched against a small lexicon, numbers become
// prices, areas or room layouts from the words around them, and places come from lib/turkey-locations.
// Only filters that /ilanlar really has are produced; anything else is reported, never invented.
//
// Room rule (Turkish "oda+salon" layout): N bedrooms → "N+1" (studio → "1+0"). Languages that count
// the living room as a room (German "Zimmer", French "pièces"/T3, Russian "комнат", Dutch "kamers")
// give N rooms → "(N-1)+1", one room → "1+0". Arabic "غرف" and Persian "اتاق"/"خوابه" are read as
// bedrooms. "en az 3 oda" / "3+ bedrooms" lists every layout with at least that many bedrooms.
// Prices: "15 milyona kadar" → max; "5 milyon üzeri" → min; "5-10 milyon arası" → range; an amount
// without such a word is a budget (max). An amount without a currency uses the visitor's display
// currency (the one /ilanlar uses for typed ranges), except Turkish number words (bin, milyon) → TL.
// Areas: "120 m²" alone → at least 120 m².

export const NL_PURPOSES=['satilik','kiralik','gunluk','devren'] as const;
/** Currencies a typed price range may use: the display currencies of lib/display-currency.ts. */
export const NL_CURRENCIES=['TRY','EUR','USD','GBP','RUB','SAR','AED'] as const;
export const NL_LOCALES=['tr','en','de','fr','ru','ar','fa','nl'] as const;
export type NlLocale=typeof NL_LOCALES[number];
const DEFAULT_CURRENCY:Record<NlLocale,string>={tr:'TRY',de:'EUR',fr:'EUR',nl:'EUR',en:'GBP',ru:'RUB',fa:'TRY',ar:'SAR'};
export const nlDefaultCurrency=(locale:string,display?:string|null)=>display&&(NL_CURRENCIES as readonly string[]).includes(display)?display:DEFAULT_CURRENCY[locale as NlLocale]||'TRY';

export type NlFilters={
 purpose?:string;category?:string;type?:string;businessType?:string;tourismType?:string;city?:string;district?:string;
 rooms?:string[];minPrice?:number;maxPrice?:number;currency?:string;minArea?:number;maxArea?:number;bathrooms?:number;maxAge?:number;
 heating?:string[];furnished?:boolean;amenities?:string[];detailSite?:string;detailCredit?:string;detailSwap?:string;detailUsage?:string;detailKitchen?:string;
 from?:string;foreignSale?:boolean;video?:boolean;tour?:boolean;q?:string;
};
export type NlParse={filters:NlFilters;ignored:string[];unsupported:string[]};

// ---------------------------------------------------------------- text folding and tokens
const ELISION=new Set(['l','d','j','qu','jusqu','s','n','c','m','t','lorsqu','puisqu']);
const asciiDigits=(s:string)=>s.replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x6F0)).replace(/٬/g,',').replace(/٫/g,'.');
/** Case, diacritic and script folding shared by the lexicon and the query (Turkish ı/İ, Arabic/Persian letters). */
export function fold(value:string){
 return asciiDigits(value.normalize('NFKC')).toLocaleLowerCase('tr').replace(/ı/g,'i').replace(/ß/g,'ss').replace(/œ/g,'oe').normalize('NFD')
  .replace(/[̀-ًͯ-ٰٟـ]/g,'').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/ة/g,'ه').replace(/‌|‍/g,'').normalize('NFC');
}
type Token={raw:string;f:string;alts:string[];kind?:string;value?:string;soft?:boolean};
const tokenOf=(raw:string):Token=>{const f=fold(raw),alts=[f];if(/^[؀-ۿ]/.test(f)){for(const p of ['ال','لل','و','ب','ل'])if(f.startsWith(p)&&f.length-p.length>=3)alts.push(f.slice(p.length));if(f.startsWith('وال')&&f.length>5)alts.push(f.slice(3));if(f.startsWith('بال')&&f.length>5)alts.push(f.slice(3));}return {raw,f,alts};};
const NUMBER=/^\d[\d.,]*$/,ROOMS=/^(\d{1,2}(?:[.,]5)?)\+(\d{1,2})/;
export function tokenize(text:string):Token[]{
 let s=asciiDigits(text.normalize('NFKC')).replace(/[‘’ʼ`´]/g,"'");
 s=s.replace(/([€$£₺₽])/g,' $1 ').replace(/(?<!\d)[.,]|[.,](?!\d)/g,' ').replace(/[;:!?()[\]{}"«»•·|/\\،؟؛<>=*_~#]/g,' ').replace(/[–—]/g,'-').replace(/(\d)\s*-\s*(?=\d)/g,'$1 ~ ').replace(/\s-\s/g,' ~ ').replace(/-/g,' ').replace(/~/g,'-');
 const out:Token[]=[];
 for(const word of s.split(/\s+/).filter(Boolean)){
  let w=word;const at=w.indexOf("'");
  if(at>=0){const head=w.slice(0,at),tail=w.slice(at+1);if(ELISION.has(fold(head))){if(head)out.push(tokenOf(head));w=tail;}else w=head;}
  w=w.replace(/'/g,'');if(!w)continue;
  const room=ROOMS.exec(w);if(room&&/^[\d.,+]*(\D*)$/.test(w.slice(room[0].length).replace(/[^\d.,+]*$/,''))){out.push(tokenOf(room[0].replace(',','.')));continue;}
  const split=/^(\d[\d.,]*)([^\d.,+].*)$/.exec(w);
  if(split){out.push(tokenOf(split[1]));out.push(tokenOf(split[2]));continue;}
  out.push(tokenOf(w));
 }
 // "3 000 000" → one number.
 for(let i=0;i<out.length-1;i++)if(/^\d{1,3}$/.test(out[i].f)&&/^\d{3}$/.test(out[i+1].f)&&!(i>0&&/^\d+$/.test(out[i-1].f))){let raw=out[i].raw;while(/^\d{3}$/.test(out[i+1]?.f||'')){raw+=out[i+1].raw;out.splice(i+1,1);}out[i]=tokenOf(raw);}
 return out;
}

// ---------------------------------------------------------------- lexicon
// [kind, value, phrases]. Phrases are separated by "|"; words are folded. A word ending in "*" accepts
// any ending; other words of 4+ letters accept a short ending (Turkish/Russian/Arabic suffixes).
type Kind='purpose'|'type'|'category'|'amenity'|'furnished'|'detail'|'from'|'newBuild'|'foreign'|'heating'|'video'|'tour'|'unsupported'|'stop'|'max'|'min'|'between'|'joiner'|'mult'|'currency'|'area'|'bedroom'|'total'|'bath'|'salon'|'num'|'studio'|'bedroomN'|'totalN';
const SOFT=new Set<Kind>(['stop','max','min','between','joiner','num']);
const LEXICON:[Kind,string,string][]=[
 // Purposes
 ['purpose','gunluk','günlük kiralık|günlük kiralik|günlük|gunluk|daily rental|holiday rental|holiday let|vacation rental|short term rental|short term|ferienwohnung|ferienvermietung|tageweise|location saisonnière|location de vacances|location courte durée|посуточно|посуточная|посуточн*|краткосрочн*|ایجار یومی|إيجار يومي|اجاره روزانه|روزانه|vakantieverhuur|vakantiewoning|kortverblijf'],
 ['purpose','devren','devren satılık|devren kiralık|devren|devir|business transfer|transfer of business|ablöse|zur übernahme|cession de bail|fonds de commerce|переуступка|تنازل|واگذاری سرقفلی|سرقفلی|ter overname|overname'],
 ['purpose','satilik','satılık|satilik|satlık|satın almak|satın al|satın|satin|almak istiyorum|for sale|sale|buy|buying|purchase|to buy|kaufen|zu verkaufen|kauf|verkauf|à vendre|a vendre|vendre|achat|acheter|vente|купить|купля|продажа|продается|продаётся|на продажу|للبيع|بيع|شراء|للشراء|فروشی|فروش|خرید|te koop|koop|kopen'],
 ['purpose','kiralik','kiralık|kiralik|kiralk|kira|kiralamak|for rent|to rent|rent|rental|renting|to let|lease|mieten|zu vermieten|miete|vermietung|mietwohnung|à louer|a louer|louer|en location|аренда|аренду|арендовать|снять|сдается|сдаётся|в аренду|للإيجار|للايجار|ايجار|إيجار|اجاره|رهن|te huur|huur|huren'],
 // Property types (value "type" or "type:subtype")
 ['type','yali-dairesi','yalı dairesi|yali dairesi'],
 ['type','yali','yalı|yali|waterfront mansion'],
 ['type','rezidans','rezidans|residence|residenz|резиденция|رزیدنس|residentie'],
 ['type','mustakil','müstakil ev|müstakil|mustakil|detached house|detached|single family house|einfamilienhaus|freistehendes haus|landhaus|maison individuelle|pavillon|частный дом|отдельный дом|коттедж|таунхаус|منزل مستقل|بيت مستقل|خانه مستقل|خانه ویلایی|vrijstaand huis|vrijstaande woning|vrijstaand'],
 ['type','ciftlik-evi','çiftlik evi|ciftlik evi|çiftlik|farmhouse|farm house|farm|bauernhaus|bauernhof|ferme|фермерский дом|ферма|مزرعه|مزرعة|boerderij'],
 ['type','kosk-konak','köşk|kosk|konak|mansion|herrenhaus|manoir|особняк|قصر|عمارت|landhuis'],
 ['type','yazlik','yazlık|yazlik|summer house|holiday home|sommerhaus|ferienhaus|maison de vacances|résidence secondaire|дача|بيت صيفي|خانه ییلاقی|ویلای تابستانی|zomerhuis|vakantiehuis'],
 ['type','kooperatif','kooperatif|cooperative|genossenschaft|coopérative|кооператив|coöperatie'],
 ['type','villa','villa*|villen|вилл*|فيلا|فلل|ویلا*'],
 ['type','daire','daire*|apartman dairesi|apartman|flat|flats|apartment*|apt|condo|wohnung|etagenwohnung|eigentumswohnung|appartement*|appart|studio apartment|квартир*|апартамент*|شقه|شقق|اپارتمان*|آپارتمان*|واحد مسکونی|flat'],
 ['type','arsa','arsa*|arazi*|tarla*|land|plot|plots|building plot|grundstück|baugrundstück|bauland|terrain|terrain à bâtir|участок|земля|земельный участок|ارض|اراضی|قطعه ارض|زمین|grond|bouwgrond|perceel|bouwkavel|kavel'],
 ['type','bina','komple bina|bina*|whole building|apartment building|building|gebäude|mehrfamilienhaus|immeuble|здание|مبنی|عماره|ساختمان|gebouw|appartementencomplex'],
 ['type','devremulk','devre mülk|devremülk|devremulk|timeshare|timesharing|time share|multipropriété|таймшер|تایم شیر|تایم شر|timeshare'],
 ['type','ticari:Dükkan & Mağaza','dükkan*|dukkan*|mağaza*|magaza*|shop|shops|store|retail|laden|geschäft|ladenlokal|boutique|magasin|local commercial|магазин|محل تجاری|محل|متجر|مغازه|winkel|winkelpand'],
 ['type','ticari:Ofis & Büro','ofis*|büro*|buro|office*|bureau*|офис*|مکتب|دفتر کار|دفتر|kantoor*'],
 ['type','ticari:Depo & Antrepo','depo|antrepo|warehouse|storage|lager|lagerhalle|entrepôt|склад|مستودع|انبار|magazijn|opslag'],
 ['type','ticari:Fabrika & Üretim Tesisi','fabrika|factory|fabrik|usine|завод|фабрика|مصنع|کارخانه|fabriek'],
 ['type','ticari:Plaza Katı & Ofisi','plaza katı|plaza'],
 ['type','ticari:Atölye','atölye|atolye|workshop|werkstatt|atelier|мастерская|ورشه|کارگاه|werkplaats'],
 ['type','ticari','iş yeri|işyeri|isyeri|ticari|commercial property|commercial|business premises|gewerbe*|gewerbeimmobilie|commerce|local professionnel|коммерческ*|تجاری|تجاري|bedrijfspand|commercieel'],
 ['type','turistik:Apart Otel','apart otel|aparthotel|apart hotel|апарт отель|апарт-отель'],
 ['type','turistik:Butik Otel','butik otel|boutique hotel|boutique hôtel|бутик отель'],
 ['type','turistik:Tatil Köyü','tatil köyü|holiday village|resort|feriendorf|village de vacances|курорт*|منتجع|دهکده تفریحی|vakantiepark'],
 ['type','turistik:Pansiyon','pansiyon|guesthouse|guest house|pension|гостевой дом|بیت ضیافه|مهمانپذیر|pension'],
 ['type','turistik:Motel','motel'],
 ['type','turistik:Kamp Yeri (Mocamp)','kamp yeri|kamp|camping|campsite|campingplatz|кемпинг|کمپینگ'],
 ['type','turistik:Otel','otel*|hotel*|hôtel|отел*|гостиниц*|فندق|هتل'],
 ['type','turistik','turistik tesis|tourist facility|tourism property|touristische anlage'],
 ['category','konut','konut|ev|evi|evler|house|houses|home|homes|haus|häuser|maison|maisons|logement|дом|дома|жилье|жильё|منزل|بيت|منازل|خانه|مسکونی|huis|huizen|woning*'],
 // Amenities (lib/listings.ts AMENITIES) and other real filters
 ['amenity','Özel havuz','özel havuz*|ozel havuz*|private pool|privatpool|eigener pool|privater pool|piscine privée|piscine privative|частный бассейн|собственный бассейн|свой бассейн|مسبح خاص|استخر اختصاصی|استخر خصوصی|privé zwembad|eigen zwembad'],
 ['amenity','Deniz manzarası','deniz manzara*|denize nazır|sea view*|seaview|ocean view|view of the sea|meerblick|meeresblick|vue mer|vue sur la mer|vue sur mer|вид на море|видом на море|اطلاله بحریه|اطلاله علی البحر|إطلالة بحرية|منظره دریا|ویو دریا|چشم انداز دریا|zeezicht|uitzicht op zee'],
 ['amenity','Boğaz manzarası','boğaz manzara*|bogaz manzara*|bosphorus view*|bosporusblick|blick auf den bosporus|vue sur le bosphore|вид на босфор|اطلاله علی البوسفور|منظره بسفر|uitzicht op de bosporus'],
 ['amenity','Havuz','havuz*|pool|pools|swimming pool|schwimmbad|swimmingpool|piscine|бассейн*|مسبح|حمام سباحه|استخر*|zwembad'],
 ['amenity','Bahçe','bahçe*|bahce*|garden|gardens|garten|jardin|сад|садом|حدیقه|حديقة|باغ|حیاط|tuin'],
 ['amenity','Teras','teras*|terrace|terrasse|террас*|تراس|terras'],
 ['amenity','Balkon','balkon*|balcony|balcon|балкон*|شرفه|بالکن|بالكون'],
 ['amenity','Otopark','otopark*|kapalı otopark|garaj*|parking|car park|parking space|garage|parkplatz|stellplatz|tiefgarage|stationnement|парковк*|гараж*|موقف سیارات|موقف|مواقف|پارکینگ|parkeerplaats|parkeren'],
 ['amenity','Asansör','asansör*|asansor*|elevator|lift|aufzug|fahrstuhl|ascenseur|лифт*|مصعد|اسانسور|آسانسور'],
 ['amenity','Güvenlik','güvenlik*|guvenlik*|security|guarded|sicherheitsdienst|bewacht|sécurité|gardien|охрана|охраняем*|حراسه|امن|نگهبانی|نگهبان|beveiliging|bewaakt'],
 ['amenity','Şömine','şömine*|somine*|fireplace|kamin|cheminée|камин*|مدفاه|شومینه|open haard|haard'],
 ['furnished','1','eşyalı|esyali|mobilyalı|mobilyali|furnished|möbliert|moebliert|meublé|meuble|меблирован*|с мебелью|مفروش*|مبله|مبلمان|gemeubileerd|gemeubeld'],
 ['detail','detailSite=Evet','site içi|site içinde|site içerisinde|sitede|site içerisinde|gated community|compound|residential complex|wohnanlage|résidence fermée|résidence sécurisée|жилой комплекс|в комплексе|комплекс|مجمع سکنی|مجمع سكني|کمپلکس|شهرک|wooncomplex'],
 ['detail','detailCredit=Evet','krediye uygun|mortgage eligible|suitable for mortgage|kreditfähig|finanzierbar|éligible au crédit|под ипотеку|ипотека|قابل للتمویل|قابل وام|hypotheek mogelijk'],
 ['detail','detailSwap=Evet','takaslı|takas|swap|exchange possible|tausch|échange|обмен|مبادله|معاوضه|ruil'],
 ['detail','detailUsage=Kiracılı','kiracılı|tenanted|with tenant|vermietet|loué|с арендатором|مؤجر|مستاجر دار|verhuurd'],
 ['detail','detailKitchen=Açık (Amerikan)','amerikan mutfak*|açık mutfak*|open kitchen|offene küche|cuisine ouverte|cuisine américaine|открытая кухня|مطبخ مفتوح|آشپزخانه اپن|open keuken'],
 ['from','owner','sahibinden|from owner|by owner|private seller|von privat|privatverkauf|de particulier|particulier|от собственника|от хозяина|от владельца|من المالک|من المالك|از مالک|van eigenaar|particuliere verkoop'],
 ['from','agent','emlakçıdan|emlakcidan|emlak ofisinden|from agent|from an agent|vom makler|makler|agence immobilière|par agence|от агентства|من مکتب عقاری|از مشاور املاک|via makelaar|makelaar'],
 ['newBuild','0','sıfır bina|sifir bina|sıfır|sifir|yeni bina|yeni yapı|new build|new-build|newly built|brand new|new construction|neubau|neubauwohnung|neuf|construction neuve|neuve|новостро*|новый дом|новое здание|جدید البناء|بناء جديد|نوساز|nieuwbouw'],
 ['foreign','1','yabancıya satışa uygun|yabancıya uygun|vatandaşlık*|vatandaslik*|citizenship|for foreigners|suitable for foreigners|staatsbürgerschaft|einbürgerung|für ausländer|citoyenneté|nationalité|pour étrangers|гражданство|гражданства|для иностранцев|الجنسیه|الجنسية|للاجانب|شهروندی|تابعیت|برای خارجی ها|staatsburgerschap|voor buitenlanders'],
 ['heating','Kombi (Doğalgaz)','doğalgaz*|dogalgaz*|kombi*|natural gas|gas heating|combi boiler|gasheizung|erdgas|chauffage au gaz|gaz naturel|газовое отопление|газ|گاز|غاز|gasverwarming|cv ketel'],
 ['heating','Yerden ısıtma','yerden ısıtma*|yerden isitma*|underfloor heating|floor heating|fußbodenheizung|fussbodenheizung|chauffage au sol|plancher chauffant|теплый пол|теплые полы|تدفئه ارضیه|گرمایش از کف|vloerverwarming'],
 ['heating','Klima','klima*|air conditioning|air conditioner|air con|aircon|klimaanlage|climatisation|climatisé|кондиционер*|تکییف|تكييف|کولر|airco|airconditioning'],
 ['heating','Merkezi','merkezi ısıtma|merkezi sistem|central heating|zentralheizung|chauffage central|центральное отопление|تدفئه مرکزیه|شوفاژ|centrale verwarming'],
 ['video','1','videolu|with video|video tour|mit video|avec vidéo|с видео|مع فیدیو|با ویدیو|met video'],
 ['tour','1','sanal tur*|virtual tour|360 tour|virtuelle tour|virtueller rundgang|visite virtuelle|виртуальный тур|جوله افتراضیه|تور مجازی|virtuele tour'],
 ['studio','','stüdyo|studyo|studio|studios|студия|استودیو|ستودیو'],
 // Recognised wishes without a filter on /ilanlar (reported, never applied)
 ['unsupported','','denize yakın|denize yakin|denize sıfır|denize sifir|denize yürüme mesafesinde|plaja yakın|sahile yakın|merkeze yakın|metroya yakın|okula yakın|hastaneye yakın|havalimanına yakın|sessiz|sakin|eşyasız|esyasiz|yatırımlık|manzaralı|near the sea|close to the sea|near sea|by the sea|near the beach|close to the beach|beachfront|seafront|sea front|walking distance|city centre|city center|near metro|near the metro|near school|quiet|unfurnished|investment|strandnah|meernah|in meeresnähe|am meer|nähe strand|zentral|zentrumsnah|ruhig|unmöbliert|près de la mer|proche de la mer|proche plage|bord de mer|pieds dans l eau|centre ville|calme|non meublé|у моря|рядом с морем|близко к морю|недалеко от моря|первая линия|первой линии|в центре|тихий|тихом|без мебели|قریب من البحر|بالقرب من البحر|علی البحر|قريب من البحر|وسط المدينه|هادئ|غیر مفروش|نزدیک دریا|کنار دریا|مرکز شهر|آرام|بدون مبلمان|dicht bij zee|bij de zee|aan zee|bij het strand|centrum|rustig|ongemeubileerd'],
 // Number words and units
 ['mult','tr:1000','bin'],['mult','tr:1000000','milyon*|mlyn'],['mult','tr:1000000000','milyar*'],
 ['mult','1000','k|thousand|tausend|tsd|mille|тыс*|тысяч*|الف|آلاف|هزار|duizend'],
 ['mult','1000000','m|mn|mio|mln|million*|millionen|миллион*|млн|ملیون|ملايين|ملایین|میلیون*|miljoen'],
 ['mult','1000000000','bn|billion*|milliard*|млрд|ملیار|میلیارد|miljard'],
 ['currency','TRY','tl|try|₺|lira|liras|türk lirası|turkish lira|turkish liras|türkische lira|livre turque|livres turques|лир*|турецких лир|لیره|ليره|لیر|ليرة تركية|turkse lira'],
 ['currency','EUR','euro|euros|eur|€|avro|евро|یورو|اليورو|يورو'],
 ['currency','USD','dolar|dollar|dollars|usd|$|доллар*|دولار|دلار'],
 ['currency','GBP','sterlin|pound|pounds|gbp|£|pfund|livre sterling|livres sterling|фунт*|جنیه|استرلینی|پوند|pond'],
 ['currency','RUB','ruble|rubles|rouble|roubles|rubel|rub|₽|рубл*|руб|روبل'],
 ['currency','SAR','riyal|riyals|sar|ریال'],
 ['currency','AED','dirham|dirhams|aed|درهم'],
 ['currency','IRR','toman|تومان'],
 ['area','','m2|m²|metrekare*|metre kare|sqm|sq m|square meter*|square metre*|qm|quadratmeter|mètres carrés|metres carres|mètre carré|м2|кв м|квм|кв|квадрат*|م2|متر مربع|مترمربع|متر|vierkante meter|meter|metre|metr'],
 ['bedroom','','yatak odası*|yatak odasi*|yatak odalı|yatak|bedroom*|bed|beds|bhk|br|schlafzimmer*|chambre*|спальн*|غرف نوم|غرفه نوم|غرف|غرفه|خوابه|خواب|اتاق خواب|اتاق|slaapkamer*|oda|odalı|odali|room|rooms'],
 ['total','','zimmer*|pièces|piece|pièce|комнатн*|комнат*|kamer|kamers|kamerappartement'],
 ['bath','','banyo*|bathroom*|bath|baths|badezimmer|bäder|bad|salle de bain*|salles de bain|ванн*|санузл*|حمام*|سرویس بهداشتی|سرویس|badkamer*'],
 ['salon','','salon|salonlu'],
 ['bedroomN','2','غرفتين نوم|غرفتان نوم|غرفتين|غرفتان|دوخوابه'],['bedroomN','3','سهخوابه'],['bedroomN','1','یکخوابه'],
 ['totalN','1','однокомнатн*|однушк*|einzimmer*|eenkamer*'],['totalN','2','двухкомнатн*|двушк*|zweizimmer*|tweekamer*'],['totalN','3','трехкомнатн*|трешк*|dreizimmer*|driekamer*'],['totalN','4','четырехкомнатн*|vierzimmer*|vierkamer*'],
 ['num','1','one|одна|один|واحد|یک|tek'],['num','2','two|zwei|deux|два|две|اثنین|اثنان|دو|twee|iki'],['num','3','three|drei|trois|три|ثلاث|ثلاثه|سه|drie|üç|uc'],['num','4','four|vier|quatre|четыре|اربع|اربعه|چهار|dört|dort'],['num','5','five|fünf|cinq|пять|خمس|خمسه|پنج|vijf|beş|bes'],
 // Range words
 ['max','','kadar|altı|altında|altinda|alti|maksimum|maks|max|en fazla|en çok|bütçe*|butce*|under|below|up to|upto|maximum|less than|budget|within|not more than|no more than|bis|unter|höchstens|maximal|unterhalb|jusqu a|jusqu à|moins de|max|sous|до|не дороже|максимум|бюджет*|дешевле|حتی|حتى|اقل من|أقل من|بحد اقصی|حد اقصی|حداکثر|ميزانيه|میزانیه|لا یتجاوز|زیر|کمتر از|بودجه|tot|onder|maximaal|hooguit|niet meer dan'],
 ['min','','en az|üzeri|uzeri|üstü|ustu|üzerinde|minimum|min|başlayan|over|above|at least|more than|starting|starting at|from|ab|über|ueber|mindestens|à partir de|a partir de|plus de|au moins|dès|от|более|больше|не менее|минимум|اکثر من|أكثر من|علی الاقل|بدءا من|بیشتر از|حداقل|بالای|vanaf|boven|minimaal|minstens|meer dan'],
 ['between','','arası|arasi|arasında|arasinda|between|zwischen|entre|между|بین|tussen'],
 ['joiner','','-|ile|and|to|und|bis|et|à|a|и|до|و|تا|en|tot|or|oder|ou|или|veya|ya da|of'],
 // Fillers in each language
 ['stop','','bir|ve|ile|için|icin|olan|arıyorum|ariyorum|istiyorum|bakıyorum|lütfen|bana|göster|ilan*|emlak|gayrimenkul|civarı|civarında|bölgesinde|yakınında|tarafında|veya|ya|da|de|mi|bu|şu|lık|lik|luk|lük|li|lı|lu|lü|tane|fiyat*|fiyatlı|price|priced|cost|costing|preis|prix|цена|ценой|стоимость|بسعر|سعر|قیمت|prijs|نوم|türkiye|turkiye|turkey|türkei|turquie|турция|турции|ترکیه|تركيا|turkije|a|an|the|in|on|at|of|for|with|and|or|to|i|im|am|looking|look|want|need|find|show|me|please|property|properties|real estate|estate|that|has|have|is|are|some|any|around|area|near|ein|eine|einen|einem|mit|im|und|oder|für|zu|ich|suche|bitte|der|die|das|den|dem|am|an|von|nahe|immobilie*|un|une|des|de|du|le|la|les|l|d|avec|en|pour|et|ou|je|cherche|dans|au|aux|bien|immobilier|в|во|на|с|со|и|или|для|ищу|хочу|нужна|нужен|нужно|у|к|недвижимость|объект|في|فی|مع|او|أو|عن|ابحث|أبحث|ارید|أريد|اريد|علی|من|عقار|عقارات|در|با|یا|برای|میخواهم|میخوام|دنبال|هستم|به|را|ملک|که|een|met|zoek|ik|het|op|voor|naar|woningen|vastgoed|te|op zoek'],
];
type Word={text:string;star:boolean};
type Entry={kind:Kind;value:string;words:Word[];order:number};
const ENTRIES:Entry[]=LEXICON.flatMap(([kind,value,phrases],order)=>phrases.split('|').map(phrase=>({kind,value,order,words:phrase.trim().split(/\s+/).map(word=>({text:fold(word.replace(/\*$/,'')),star:word.endsWith('*')}))})).filter(entry=>entry.words.every(word=>word.text)));
const BY_FIRST=new Map<string,Entry[]>();
for(const entry of ENTRIES){const key=entry.words[0].text.slice(0,2);BY_FIRST.set(key,[...(BY_FIRST.get(key)||[]),entry]);}
function wordScore(word:Word,token:Token){
 let best=0;
 for(const form of token.alts){
  if(form===word.text)return 3;
  if(!form.startsWith(word.text))continue;
  const rest=form.length-word.text.length;
  if(word.star&&rest<=9||word.text.length>=4&&rest<=4&&!/\d/.test(form))best=Math.max(best,word.star?2:1);
 }
 return best;
}
function lexiconAt(tokens:Token[],i:number):{entry:Entry;length:number}|null{
 let found:{entry:Entry;length:number;score:number}|null=null;
 const candidates=new Set<Entry>();for(const form of tokens[i].alts)for(const entry of BY_FIRST.get(form.slice(0,2))||[])candidates.add(entry);
 for(const entry of candidates){
  if(i+entry.words.length>tokens.length)continue;
  let score=entry.words.length*10;
  for(let k=0;k<entry.words.length;k++){const t=tokens[i+k];if(t.kind){score=-1;break;}const s=wordScore(entry.words[k],t);if(!s){score=-1;break;}score+=s;}
  if(score<0)continue;
  if(!found||score>found.score||score===found.score&&entry.order<found.entry.order)found={entry,length:entry.words.length,score};
 }
 return found;
}
const damerau1=(a:string,b:string)=>{
 if(a===b)return true;if(Math.abs(a.length-b.length)>1)return false;
 let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;
 if(a.length===b.length)return a.slice(i+1)===b.slice(i+1)||a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2);
 return a.length>b.length?a.slice(i+1)===b.slice(i):a.slice(i)===b.slice(i+1);
};

// ---------------------------------------------------------------- places
type Place={city:string;district?:string;q?:string};
// Common foreign spellings and resort areas (area → district, area name kept as keyword for /ilanlar ?q=).
const PLACE_ALIASES:[string,Place][]=[
 ['stambul|стамбул|استانبول|اسطنبول|إسطنبول|constantinople|estambul',{city:'İstanbul'}],
 ['анталия|анталья|انطاليا|أنطاليا|آنتالیا|انتالیا',{city:'Antalya'}],['измир|ازمیر|إزمير|ازمير|smyrna|smyrne',{city:'İzmir'}],
 ['анкара|انقره|أنقرة|آنکارا',{city:'Ankara'}],['бурса|بورصه|بورسا',{city:'Bursa'}],['мугла|موغلا',{city:'Muğla'}],['мерсин|مرسین|مرسين',{city:'Mersin'}],
 ['трабзон|طرابزون|ترابزون',{city:'Trabzon'}],['ялова|یالوا|يالوفا',{city:'Yalova'}],['айдын|آیدین',{city:'Aydın'}],['сакарья|سکاریا',{city:'Sakarya'}],
 ['kapadokya|cappadocia|kappadokien|cappadoce|каппадокия|کاپادوکیا|كابادوكيا',{city:'Nevşehir'}],
 ['аланья|алания|الانیا|ألانيا|آلانیا|الانيا',{city:'Antalya',district:'Alanya'}],['кемер',{city:'Antalya',district:'Kemer'}],['каш',{city:'Antalya',district:'Kaş'}],
 ['манавгат|مانافغات',{city:'Antalya',district:'Manavgat'}],['коньяалты',{city:'Antalya',district:'Konyaaltı'}],['муратпаша',{city:'Antalya',district:'Muratpaşa'}],['кепез',{city:'Antalya',district:'Kepez'}],
 ['белек|belek',{city:'Antalya',district:'Serik',q:'Belek'}],['сиде',{city:'Antalya',district:'Manavgat',q:'Side'}],['махмутлар|mahmutlar',{city:'Antalya',district:'Alanya',q:'Mahmutlar'}],
 ['авсаллар|avsallar',{city:'Antalya',district:'Alanya',q:'Avsallar'}],['kargıcak|каргыджак',{city:'Antalya',district:'Alanya',q:'Kargıcak'}],['kalkan|калкан',{city:'Antalya',district:'Kaş',q:'Kalkan'}],
 ['бодрум|بودروم|بدروم',{city:'Muğla',district:'Bodrum'}],['фетхие|فتحیه|فتحية',{city:'Muğla',district:'Fethiye'}],['мармарис|مرمریس|مارماریس',{city:'Muğla',district:'Marmaris'}],
 ['yalıkavak|яликавак',{city:'Muğla',district:'Bodrum',q:'Yalıkavak'}],['gümüşlük',{city:'Muğla',district:'Bodrum',q:'Gümüşlük'}],['türkbükü',{city:'Muğla',district:'Bodrum',q:'Türkbükü'}],['bitez',{city:'Muğla',district:'Bodrum',q:'Bitez'}],['turgutreis|тургутрейс',{city:'Muğla',district:'Bodrum',q:'Turgutreis'}],
 ['göcek|гёджек',{city:'Muğla',district:'Fethiye',q:'Göcek'}],['ölüdeniz|олюдениз',{city:'Muğla',district:'Fethiye',q:'Ölüdeniz'}],
 ['чешме',{city:'İzmir',district:'Çeşme'}],['кушадасы|کوشآداسی|كوشاداسي',{city:'Aydın',district:'Kuşadası'}],['дидим|دیدیم',{city:'Aydın',district:'Didim'}],
 ['бейликдюзю|بیلیک دوزو|بيليك دوزو',{city:'İstanbul',district:'Beylikdüzü'}],['эсеньюрт|اسنیورت|اسنيورت',{city:'İstanbul',district:'Esenyurt'}],['кадыкёй|кадыкей|کادیکوی',{city:'İstanbul',district:'Kadıköy'}],
 ['бешикташ|بشیکتاش|بشكتاش',{city:'İstanbul',district:'Beşiktaş'}],['шишли|شیشلی',{city:'İstanbul',district:'Şişli'}],['башакшехир|باشاک شهیر|باشاكشهير',{city:'İstanbul',district:'Başakşehir'}],
 ['сарыер|ساریر',{city:'İstanbul',district:'Sarıyer'}],['ускюдар|اسکودار|أوسكودار',{city:'İstanbul',district:'Üsküdar'}],['бакыркёй|بакыркей',{city:'İstanbul',district:'Bakırköy'}],['бейоглу|بی اوغلو|بيوغلو',{city:'İstanbul',district:'Beyoğlu'}],
 ['аташехир|آتاشهیر',{city:'İstanbul',district:'Ataşehir'}],['бююкчекмедже|بیوک چکمجه|بيوك شكمجة',{city:'İstanbul',district:'Büyükçekmece'}],['чанкая',{city:'Ankara',district:'Çankaya'}],
];
// Ambiguous district names resolved to the best-known one when no province is given.
const PREFERRED:Record<string,string>={Kemer:'Antalya',Aksu:'Antalya',Edremit:'Balıkesir',Gölbaşı:'Ankara',Kemalpaşa:'İzmir',Ayvacık:'Çanakkale',Ereğli:'Zonguldak'};
// District names that are also everyday words: only a capitalised spelling counts.
const COMMON_WORDS=new Set(['bahce','konak','akdeniz','saray','pazar','kale','guney','han','ulus','yenice','bala','sur','of','tut','bor','ula','mut','merkez','ova','center','derik','hani','lice','kulp','eruh','yenisehir','ortakoy','gonen','bayat','altinyayla','ilica','bozkurt','sason','kocaali','cay','ceylanpinar','talas','kiraz']);
const PLACES=new Map<string,Place[]>();
const addPlace=(name:string,place:Place)=>{const key=fold(name).replace(/\s+/g,' ');PLACES.set(key,[...(PLACES.get(key)||[]),place]);};
for(const city of CITIES)addPlace(city,{city});
for(const [city,list] of Object.entries(DISTRICTS))for(const district of list)if(district!=='Merkez')addPlace(district,{city,district});
for(const [names,place] of PLACE_ALIASES)for(const name of names.split('|'))addPlace(name,place);
const MAX_PLACE_WORDS=Math.max(...[...PLACES.keys()].map(key=>key.split(' ').length));
const TR_SUFFIX=new Set(['da','de','ta','te','dan','den','tan','ten','nda','nde','ndan','nden','ya','ye','a','e','yi','yu','i','u','nin','nun','in','un','daki','deki','taki','teki','ndaki','ndeki','li','lu','dir','dur','ki']);
const CYRILLIC_END=/[аяеиоуыйь]$/;
function placeWordMatch(name:string,token:Token){
 for(const form of token.alts){
  if(form===name)return true;
  if(form.startsWith(name)&&TR_SUFFIX.has(form.slice(name.length))&&/^[a-z]/.test(name))return true;
  if(/^[Ѐ-ӿ]/.test(name)){const stem=name.length>=5?name.replace(CYRILLIC_END,''):name;if(form.startsWith(stem)&&form.length-stem.length<=3)return true;}
 }
 return false;
}
const realPlace=(name:string)=>name.length>3&&!COMMON_WORDS.has(name)&&PLACES.has(name);
const isPlaceName=(token:Token)=>token.alts.some(form=>realPlace(form)||[...TR_SUFFIX].some(suffix=>form.endsWith(suffix)&&realPlace(form.slice(0,-suffix.length))));
function placeAt(tokens:Token[],i:number,fuzzy:boolean):{places:Place[];length:number}|null{
 for(let n=Math.min(MAX_PLACE_WORDS,tokens.length-i);n>=1;n--){
  const slice=tokens.slice(i,i+n);if(slice.some(t=>t.kind))continue;
  if(n===1){
   const token=slice[0];
   for(const [name,places] of PLACES){if(name.includes(' '))continue;
    const ok=fuzzy?name.length>=6&&token.f.length>=6&&damerau1(name,token.f):placeWordMatch(name,token);
    if(!ok)continue;
    if(COMMON_WORDS.has(name)&&!/^\p{Lu}/u.test(token.raw))continue;
    if(name.length<=3&&!/^\p{Lu}/u.test(token.raw))continue;
    return {places,length:1};
   }
  }else if(!fuzzy){
   const words=slice.map(t=>t.f);const places=PLACES.get(words.join(' '));if(places)return {places,length:n};
   const last=slice[n-1],head=slice.slice(0,-1).map(t=>t.f).join(' ');
   for(const [name,list] of PLACES){if(name.split(' ').length!==n||!name.startsWith(head+' '))continue;if(placeWordMatch(name.split(' ')[n-1],last))return {places:list,length:n};}
  }
 }
 return null;
}

// ---------------------------------------------------------------- numbers
function parseNumber(text:string,hasMultiplier:boolean){
 if(/^\d{1,3}([.,]\d{3})+$/.test(text)&&!(hasMultiplier&&/^\d{1,3}[.,]\d{3}$/.test(text)))return Number(text.replace(/[.,]/g,''));
 if(/^\d+[.,]\d+$/.test(text))return Number(text.replace(',','.'));
 if(/^\d+$/.test(text))return Number(text);
 return NaN;
}
const bedroomLayout=(n:number)=>n<=0?'1+0':n>9?'10 Üzeri':`${n}+1`;
const totalLayout=(n:number)=>n<=1?'1+0':bedroomLayout(n-1);
const bedroomsOf=(room:string)=>room==='10 Üzeri'?10:Number.parseFloat(room);
/** Layouts with at least `n` bedrooms ("en az 3 oda", "3+ bedrooms"). */
export const roomsAtLeast=(n:number)=>(ROOM_OPTIONS as readonly string[]).filter(room=>!/\+0$/.test(room)&&bedroomsOf(room)>=n);

// ---------------------------------------------------------------- parser
const TYPE_VALUES=PROPERTY_TYPES.map(item=>item.value as string);
type Options={locale?:string;currency?:string|null};
export function parseNlQuery(text:string,options:Options={}):NlParse{
 const locale=options.locale||'tr';
 const tokens=tokenize(String(text||'').slice(0,300)).slice(0,60);
 const filters:NlFilters={};const ignored:string[]=[];const unsupported:string[]=[];
 const conflict=(start:number,length:number)=>ignored.push(tokens.slice(start,start+length).map(t=>t.raw).join(' '));
 // 1. Lexicon, longest phrase first at each position.
 for(let i=0;i<tokens.length;i++){
  if(tokens[i].kind||ROOMS.test(tokens[i].f)||NUMBER.test(tokens[i].f))continue;
  const hit=lexiconAt(tokens,i);if(!hit)continue;
  // A place name wins over a loose prefix match ("Bahçelievler" is not "bahçe*").
  if(hit.length===1&&!hit.entry.words.every((w,k)=>tokens[i+k].alts.includes(w.text))&&isPlaceName(tokens[i]))continue;
  for(let k=0;k<hit.length;k++){tokens[i+k].kind=k?'part':hit.entry.kind;tokens[i+k].value=hit.entry.value;tokens[i+k].soft=SOFT.has(hit.entry.kind);}
  (tokens[i] as Token&{length?:number}).length=hit.length;
 }
 // 2. Places on the remaining words (exact, then one typo).
 const places:{place:Place[];index:number;length:number}[]=[];
 for(const fuzzy of [false,true])for(let i=0;i<tokens.length;i++){if(tokens[i].kind||NUMBER.test(tokens[i].f))continue;const hit=placeAt(tokens,i,fuzzy);if(!hit)continue;for(let k=0;k<hit.length;k++)tokens[i+k].kind=k?'part':'place';places.push({place:hit.places,index:i,length:hit.length});}
 // A capitalised type/amenity word that is a district of a province in the query is the district ("İzmir Konak").
 const queryCities=new Set(places.flatMap(p=>p.place.filter(x=>!x.district).map(x=>x.city)));
 for(let i=0;i<tokens.length;i++){const t=tokens[i];if(!t.kind||!['type','amenity'].includes(t.kind)||!/^\p{Lu}/u.test(t.raw))continue;
  for(const city of queryCities){const district=(DISTRICTS[city]||[]).find(name=>fold(name)===t.f);if(district){t.kind='place';t.value='';places.push({place:[{city,district}],index:i,length:1});break;}}}
 places.sort((a,b)=>a.index-b.index);
 // 3. One-typo lexicon match for words still unknown (purpose, type, amenity...).
 for(const token of tokens){
  if(token.kind||token.f.length<4||/\d/.test(token.f))continue;
  const entry=ENTRIES.find(e=>e.words.length===1&&e.words[0].text.length>=5&&['purpose','type','amenity','furnished','category'].includes(e.kind)&&damerau1(e.words[0].text,token.f));
  if(entry){token.kind=entry.kind;token.value=entry.value;}
 }
 const len=(t:Token)=>(t as Token&{length?:number}).length||1;
 // 4. Words → filters.
 for(let i=0;i<tokens.length;i++){
  const t=tokens[i],v=t.value||'';
  switch(t.kind){
   case 'purpose':if(filters.purpose&&filters.purpose!==v)conflict(i,len(t));else filters.purpose=v;break;
   case 'type':{const [type,sub]=v.split(':');if(filters.type&&filters.type!==type)conflict(i,len(t));else{filters.type=type;if(sub)filters[type==='ticari'?'businessType':'tourismType']=filters[type==='ticari'?'businessType':'tourismType']||sub;}break;}
   case 'category':if(!filters.category)filters.category=v;break;
   case 'amenity':filters.amenities=[...new Set([...(filters.amenities||[]),v])];break;
   case 'furnished':filters.furnished=true;break;
   case 'detail':{const [key,value]=v.split('=') as [keyof NlFilters,string];(filters as Record<string,unknown>)[key]=value;break;}
   case 'from':filters.from=filters.from||v;break;
   case 'newBuild':filters.maxAge=0;break;
   case 'foreign':filters.foreignSale=true;break;
   case 'heating':filters.heating=[...new Set([...(filters.heating||[]),v])];break;
   case 'video':filters.video=true;break;
   case 'tour':filters.tour=true;break;
   case 'studio':filters.rooms=[...new Set([...(filters.rooms||[]),'1+0'])];break;
   case 'unsupported':unsupported.push(tokens.slice(i,i+len(t)).map(x=>x.raw).join(' '));break;
  }
 }
 // "Bodrum'da villa" with a type word: a residential type also implies nothing else; "ev" only when no type.
 if(filters.type)delete filters.category;
 // 5. Numbers: rooms, bathrooms, prices and areas.
 const at=(i:number)=>tokens[i];
 const isNum=(i:number)=>at(i)&&!at(i).kind&&NUMBER.test(at(i).f);
 const numWord=(i:number)=>at(i)&&at(i).kind==='num'&&!at(i).value?.startsWith('used')?Number(at(i).value):NaN;
 const take=(i:number)=>{const t=at(i);if(!t)return;if(!t.kind||t.soft||t.kind==='num')t.kind='used';t.value='used';t.soft=false;};
 const kindAt=(i:number)=>at(i)&&!at(i).value?.startsWith('used')?at(i).kind:undefined;
 // Start of the phrase that ends at i ("en fazla", "less than", "أقل من").
 const head=(i:number)=>{while(i>0&&at(i)?.kind==='part')i--;return i;};
 let minRooms=0;const rooms:string[]=[];
 // explicit layouts
 for(let i=0;i<tokens.length;i++){
  const t=at(i);if(t.kind)continue;
  const m=ROOMS.exec(t.f);if(m&&t.f===m[0]){rooms.push(`${m[1].replace(',','.')}+${m[2]}`);t.kind='used';continue;}
  if(/^\d{1,2}\+$/.test(t.f)){minRooms=Number(t.f.slice(0,-1));t.kind='used';continue;}
  if(/^[tf][1-6]$/.test(t.f)&&locale==='fr'||/^[tf][1-6]$/.test(t.f)&&/^[TF]/.test(t.raw)){rooms.push(totalLayout(Number(t.f[1])));t.kind='used';continue;}
  if(isNum(i)&&at(i+1)?.f==='+'&&isNum(i+2)&&Number(t.f)<=10&&Number(at(i+2).f)<=5){rooms.push(`${t.f}+${at(i+2).f}`);take(i);take(i+1);take(i+2);}
 }
 for(let i=0;i<tokens.length;i++){if(at(i).f==='+'&&!at(i).kind)at(i).kind='used';}
 for(let i=0;i<tokens.length;i++){
  const k=kindAt(i);
  if(k==='bedroomN'){rooms.push(bedroomLayout(Number(at(i).value)));take(i);continue;}
  if(k==='totalN'){rooms.push(totalLayout(Number(at(i).value)));take(i);continue;}
 }
 // N + room/bath words ("3 yatak odalı", "2-bedroom", "3 Zimmer", "dört oda")
 for(let i=0;i<tokens.length;i++){
  const n=isNum(i)?parseNumber(at(i).f,false):numWord(i);if(!Number.isFinite(n)||n>20)continue;
  let j=i+1;const next=kindAt(j);
  // "3-4 yatak odası", "2 or 3 bedrooms": every layout in between.
  if((next==='bedroom'||next==='total')&&kindAt(i-1)==='joiner'&&isNum(i-2)){const low=parseNumber(at(i-2).f,false);if(low>=0&&low<n&&n-low<=4){for(let k=low;k<n;k++)rooms.push(next==='bedroom'?bedroomLayout(k):totalLayout(k));take(i-2);take(i-1);}}
  const atLeast=kindAt(head(i-1))==='min';
  if(next==='bedroom'||next==='total'){
   if(next==='bedroom'&&isNum(j+1)&&kindAt(j+2)==='salon'){rooms.push(`${n}+${at(j+1).f}`);take(i);take(j);take(j+1);take(j+2);continue;}
   const layout=next==='bedroom'?bedroomLayout(n):totalLayout(n);
   if(atLeast||at(i).f.endsWith('+')){minRooms=Math.max(minRooms,next==='bedroom'?n:n-1);take(head(i-1));}else rooms.push(layout);
   take(i);take(j);if(kindAt(j+1)==='part')j++;continue;
  }
  if(next==='bath'){filters.bathrooms=Math.max(1,Math.min(10,n));take(i);take(j);continue;}
 }
 // bare room words: "studio" handled; "yatak odası" without number is a filler
 if(minRooms)rooms.push(...roomsAtLeast(minRooms));
 if(rooms.length)filters.rooms=[...new Set([...(filters.rooms||[]),...rooms])].slice(0,22);
 // prices and areas
 let trWords=false;
 type Amount={value:number;currency?:string;mult:number;tr:boolean;area:boolean;end:number};
 const readAmount=(i:number):Amount|null=>{
  if(!isNum(i))return null;
  let j=i+1,mult=1,tr=false,currency:string|undefined,area=false;
  if(kindAt(j)==='mult'){const [flag,value]=at(j).value!.includes(':')?at(j).value!.split(':'):['',at(j).value!];if(!(value==='1000000'&&at(j).f==='m'&&kindAt(j+1)==='area')){mult=Number(value);tr=flag==='tr';j++;}}
  if(kindAt(j)==='currency'){currency=at(j).value;j++;}
  if(kindAt(j)==='area'){area=true;j++;while(kindAt(j)==='part')j++;}
  if(!currency&&kindAt(i-1)==='currency'&&at(i-1).value!=='used')currency=at(i-1).value;
  const value=parseNumber(at(i).f,mult>1);if(!Number.isFinite(value))return null;
  return {value,mult,tr,currency,area,end:j};
 };
 // "أقل من مليون دولار", "under a million": a number word without digits is one.
 for(let i=0;i<tokens.length;i++)if(kindAt(i)==='mult'&&!isNum(i-1)&&at(i).f!=='m'&&at(i).f!=='k'&&(['max','min','between','currency'].includes(kindAt(head(i-1))||'')||at(i-1)?.f==='a'||at(i-1)?.f==='bir')){tokens.splice(i,0,{raw:'',f:'1',alts:['1']});i++;}
 const priceWords:string[]=[];
 const consume=(from:number,to:number,price:boolean)=>{for(let k=from;k<to;k++){if(price&&at(k))priceWords.push(at(k).raw);take(k);}};
 for(let i=0;i<tokens.length;i++){
  const first=readAmount(i);if(!first)continue;
  const pre=kindAt(i-1)==='currency'?head(i-2):head(i-1);
  let second:Amount|null=null;
  const link=kindAt(first.end);
  if(link==='joiner'||link==='max'&&['min','between'].includes(kindAt(pre)||'')){const next=kindAt(first.end+1)==='currency'&&isNum(first.end+2)?first.end+2:first.end+1;second=readAmount(next);}
  let mode:''|'max'|'min'|'range'='';
  const after=second?second.end:first.end;
  let keyword=-1;
  if(second){mode='range';if(kindAt(after)==='between')keyword=after;else if(['min','between'].includes(kindAt(pre)||''))keyword=pre;}
  else{
   const post=kindAt(after),pre1=kindAt(pre),pre2=kindAt(head(pre-1));
   if(post==='max'||post==='min'){mode=post;keyword=after;}
   else if(pre1==='max'||pre1==='min'){mode=pre1;keyword=pre;}
   else if(pre2==='max'||pre2==='min'){mode=pre2;keyword=head(pre-1);}
  }
  if(second){if(second.mult>1&&first.mult===1){first.mult=second.mult;first.tr=second.tr;}first.currency=first.currency||second.currency;first.area=first.area||second.area;}
  const isArea=first.area;
  const priceLike=first.mult>1||Boolean(first.currency)||mode!==''&&first.value>=1000||first.value>=10000;
  if(!isArea&&!priceLike)continue;
  const lo=Math.round(first.value*first.mult),hi=second?Math.round(second.value*(second.mult>1?second.mult:first.mult)):lo;
  if(kindAt(i-1)==='currency')consume(i-1,i,!isArea);
  consume(i,after,!isArea);if(keyword>=0)take(keyword);
  if(isArea){
   if(mode==='range'){if(filters.minArea===undefined&&filters.maxArea===undefined){filters.minArea=Math.min(lo,hi);filters.maxArea=Math.max(lo,hi);}}
   else if(mode==='max'){if(filters.maxArea===undefined)filters.maxArea=lo;}
   else if(filters.minArea===undefined)filters.minArea=lo;
   continue;
  }
  trWords=trWords||first.tr;
  if(first.currency&&filters.currency&&filters.currency!==first.currency){conflict(i,first.end-i);continue;}
  if(first.currency)filters.currency=first.currency;
  if(mode==='range'){if(filters.minPrice===undefined&&filters.maxPrice===undefined){filters.minPrice=Math.min(lo,hi);filters.maxPrice=Math.max(lo,hi);}}
  else if(mode==='min'){if(filters.minPrice===undefined)filters.minPrice=lo;}
  else if(filters.maxPrice===undefined)filters.maxPrice=lo;
 }
 if(filters.minPrice!==undefined||filters.maxPrice!==undefined){
  if(!filters.currency)filters.currency=trWords?'TRY':nlDefaultCurrency(locale,options.currency);
  // Iranian rial/toman: not in the TCMB bulletin, so no TL range can be computed.
  if(filters.currency==='SAR'&&locale==='fa'||filters.currency==='IRR'){
   unsupported.push(priceWords.join(' ')||'IRR');
   delete filters.minPrice;delete filters.maxPrice;delete filters.currency;
  }
 }
 // 6. Places: first province wins; a district must belong to it.
 for(const {place,index,length} of places){
  const raw=tokens.slice(index,index+length).map(t=>t.raw).join(' ');
  const cityOnly=place.find(p=>!p.district);
  if(cityOnly){if(filters.city&&filters.city!==cityOnly.city){if(!filters.district||!DISTRICTS[cityOnly.city]?.includes(filters.district))conflict(index,length);continue;}filters.city=cityOnly.city;if(filters.district&&!DISTRICTS[cityOnly.city]?.includes(filters.district)){delete filters.district;delete filters.q;}continue;}
  if(filters.district){if(filters.district!==place[0].district)conflict(index,length);continue;}
  const match=place.find(p=>p.city===filters.city)||(filters.city?undefined:place.length===1?place[0]:place.find(p=>PREFERRED[p.district!]===p.city));
  if(!match){if(filters.city){conflict(index,length);}else ignored.push(raw);continue;}
  filters.city=match.city;filters.district=match.district;if(match.q)filters.q=match.q;
 }
 // Late province check for districts read before the province ("Bodrum Muğla" is fine, "Bodrum İzmir" is not).
 if(filters.city&&filters.district&&!DISTRICTS[filters.city]?.includes(filters.district)){ignored.push(filters.district);delete filters.district;delete filters.q;}
 // 7. Leftovers.
 for(const t of tokens){if(!t.kind&&!/^[+\-]$/.test(t.f))ignored.push(t.raw);}
 if(filters.amenities?.length===0)delete filters.amenities;
 if(filters.amenities?.includes('Eşyalı')){filters.furnished=true;filters.amenities=filters.amenities.filter(a=>a!=='Eşyalı');}
 return {filters:validateNlFilters(filters,{allowQ:true}).filters,ignored:[...new Set(ignored.filter(Boolean))].slice(0,20),unsupported:[...new Set(unsupported.filter(Boolean))].slice(0,10)};
}

/** Words the parser could not use that look like content (for deciding whether the AI step is worth it). */
export const significantIgnored=(ignored:string[])=>ignored.filter(word=>/\p{L}{3,}/u.test(word));
export const hasFilters=(filters:NlFilters)=>Object.keys(filters).some(key=>key!=='currency');

// ---------------------------------------------------------------- whitelist validation (deterministic and AI output)
const DETAIL_OPTIONS=Object.fromEntries(DETAIL_FIELDS.map(field=>[field.form,field.options as readonly string[]])) as Record<string,readonly string[]>;
const ROOM_FORMAT=/^\d{1,2}(\.5)?\+\d{1,2}$/;
const int=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isInteger(value)&&value>=min&&value<=max?value:undefined;
const oneOf=(value:unknown,options:readonly string[])=>typeof value==='string'&&options.includes(value)?value:undefined;
const listOf=(value:unknown,check:(item:string)=>boolean,max:number)=>Array.isArray(value)&&value.length<=max*2&&value.every(item=>typeof item==='string')?[...new Set((value as string[]).filter(check))].slice(0,max):undefined;
/**
 * Keeps only known keys with allowed values. Unknown keys, values outside the enums, wrong types,
 * markup or instructions in strings are dropped and reported in `rejected`. Null means "not set".
 */
export function validateNlFilters(input:unknown,{allowQ=false}:{allowQ?:boolean}={}):{filters:NlFilters;rejected:string[]}{
 const rejected:string[]=[],out:NlFilters={};
 if(!input||typeof input!=='object'||Array.isArray(input))return {filters:out,rejected:['(input)']};
 const source=input as Record<string,unknown>;
 const set=<K extends keyof NlFilters>(key:K,value:NlFilters[K]|undefined)=>{if(value===undefined||Array.isArray(value)&&!value.length)rejected.push(key);else out[key]=value;};
 for(const [key,value] of Object.entries(source)){
  if(value===null||value===undefined)continue;
  switch(key){
   case 'purpose':set(key,oneOf(value,NL_PURPOSES));break;
   case 'category':set(key,oneOf(value,PROPERTY_CATEGORIES.map(c=>c.value)));break;
   case 'type':set(key,oneOf(value,TYPE_VALUES));break;
   case 'businessType':set(key,oneOf(value,BUSINESS_TYPES));break;
   case 'tourismType':set(key,oneOf(value,TOURISM_TYPES));break;
   case 'city':set(key,typeof value==='string'?CITIES.find(city=>fold(city)===fold(value)):undefined);break;
   case 'district':break;
   case 'rooms':set(key,listOf(value,item=>(ROOM_OPTIONS as readonly string[]).includes(item)||ROOM_FORMAT.test(item),22));break;
   case 'minPrice':case 'maxPrice':set(key,int(value,0,999_999_999_999));break;
   case 'currency':set(key,oneOf(value,NL_CURRENCIES));break;
   case 'minArea':case 'maxArea':set(key,int(value,1,1_000_000));break;
   case 'bathrooms':set(key,int(value,1,10));break;
   case 'maxAge':set(key,int(value,0,100));break;
   case 'heating':set(key,listOf(value,item=>(HEATING_OPTIONS as readonly string[]).includes(item),HEATING_OPTIONS.length));break;
   case 'amenities':set(key,listOf(value,item=>AMENITIES.includes(item),AMENITIES.length));break;
   case 'furnished':case 'foreignSale':case 'video':case 'tour':if(value===true)out[key]=true;else if(value!==false)rejected.push(key);break;
   case 'detailSite':case 'detailCredit':case 'detailSwap':case 'detailUsage':case 'detailKitchen':set(key,oneOf(value,DETAIL_OPTIONS[key]||[]));break;
   case 'from':set(key,oneOf(value,['owner','agent']));break;
   case 'q':if(allowQ&&typeof value==='string'&&/^[\p{L}\p{M} .'-]{2,40}$/u.test(value))out.q=value;else rejected.push(key);break;
   default:rejected.push(key);
  }
 }
 if(source.district!=null){
  const value=source.district;
  const matches=typeof value==='string'?Object.entries(DISTRICTS).flatMap(([city,list])=>list.filter(d=>d!=='Merkez'&&fold(d)===fold(value)).map(district=>({city,district}))):[];
  const match=out.city?matches.find(m=>m.city===out.city):matches.length===1?matches[0]:undefined;
  if(match){out.city=match.city;out.district=match.district;}else rejected.push('district');
 }
 if(out.businessType&&out.type!=='ticari'){if(out.type)delete out.businessType;else out.type='ticari';}
 if(out.tourismType&&out.type!=='turistik'){if(out.type)delete out.tourismType;else out.type='turistik';}
 if(out.type&&out.category)delete out.category;
 if(out.minPrice!==undefined&&out.maxPrice!==undefined&&out.minPrice>out.maxPrice){delete out.minPrice;delete out.maxPrice;rejected.push('price');}
 if(out.minArea!==undefined&&out.maxArea!==undefined&&out.minArea>out.maxArea){delete out.minArea;delete out.maxArea;rejected.push('area');}
 if(out.minPrice===undefined&&out.maxPrice===undefined)delete out.currency;
 if(out.purpose&&out.foreignSale&&!(FOREIGN_SALE.purposes as readonly string[]).includes(out.purpose))delete out.foreignSale;
 return {filters:out,rejected};
}

/** Deterministic result wins; AI only fills keys the parser left empty (lists are merged). */
export function mergeNlFilters(base:NlFilters,extra:NlFilters):NlFilters{
 const out:NlFilters={...base};
 for(const [key,value] of Object.entries(extra) as [keyof NlFilters,unknown][]){
  if(key==='q')continue;
  if(key==='amenities'||key==='heating'){if(!(base[key]as string[]|undefined)?.length)(out as Record<string,unknown>)[key]=value;else (out as Record<string,unknown>)[key]=[...new Set([...(base[key] as string[]),...(value as string[])])];continue;}
  if(key==='rooms'&&base.rooms?.length)continue;
  if((key==='minPrice'||key==='maxPrice'||key==='currency')&&(base.minPrice!==undefined||base.maxPrice!==undefined))continue;
  if((key==='minArea'||key==='maxArea')&&(base.minArea!==undefined||base.maxArea!==undefined))continue;
  if((key==='district'||key==='city')&&base.city){if(key==='district'&&!base.district&&DISTRICTS[base.city]?.includes(value as string))out.district=value as string;continue;}
  if((key==='businessType'||key==='tourismType')&&base.type&&base.type!==(key==='businessType'?'ticari':'turistik'))continue;
  if(key==='type'&&base.type)continue;
  if(out[key]===undefined)(out as Record<string,unknown>)[key]=value;
 }
 if(out.city&&!base.city&&extra.district)out.district=extra.district;
 return validateNlFilters(out,{allowQ:true}).filters;
}

// ---------------------------------------------------------------- URL and chips
/** Order of the /ilanlar query parameters (names as read by components/Explorer.tsx). */
export const NL_URL_KEYS=['purpose','category','type','businessType','tourismType','city','district','rooms','minPrice','maxPrice','currency','minArea','maxArea','bathrooms','maxAge','heating','furnished','amenities','detailSite','detailCredit','detailSwap','detailUsage','detailKitchen','from','foreignSale','video','tour','q'] as const;
export function nlSearchUrl(filters:NlFilters){
 const params=new URLSearchParams();
 for(const key of NL_URL_KEYS){
  const value=filters[key];if(value===undefined||value===false||Array.isArray(value)&&!value.length)continue;
  if(key==='currency'&&filters.minPrice===undefined&&filters.maxPrice===undefined)continue;
  params.set(key,value===true?'1':Array.isArray(value)?value.join(','):String(value));
 }
 const query=params.toString();
 return `/ilanlar${query?`?${query}`:''}`;
}
export type NlChip={key:string;label:string};
type Translate=(key:string)=>string;
export function nlSearchChips(filters:NlFilters,t:Translate,locale:string,rates:RateSnapshot|null=null):NlChip[]{
 const chips:NlChip[]=[];const add=(key:string,label:string)=>{if(label)chips.push({key,label});};
 const money=(amount:number)=>{try{return formatMoney(amount,filters.currency||'TRY',locale);}catch{return `${amount} ${filters.currency||'TRY'}`;}};
 if(filters.purpose)add('purpose',t(purposeLabel(filters.purpose)));
 if(filters.type)add('type',t(PROPERTY_TYPES.find(item=>item.value===filters.type)?.label||filters.type));
 else if(filters.category)add('category',t(PROPERTY_CATEGORIES.find(item=>item.value===filters.category)?.label||filters.category));
 if(filters.businessType)add('businessType',t(filters.businessType));
 if(filters.tourismType)add('tourismType',t(filters.tourismType));
 if(filters.district)add('district',`${filters.district}, ${filters.city}`);else if(filters.city)add('city',filters.city);
 if(filters.rooms?.length){const rooms=filters.rooms.map(room=>room==='1+0'?`${t('Stüdyo')} (1+0)`:t(room));add('rooms',filters.rooms.length>4?`≥ ${rooms[0]}`:rooms.join(', '));}
 if(filters.minPrice!==undefined||filters.maxPrice!==undefined){
  const label=filters.minPrice!==undefined&&filters.maxPrice!==undefined?`${money(filters.minPrice)} – ${money(filters.maxPrice)}`:filters.maxPrice!==undefined?`≤ ${money(filters.maxPrice)}`:`≥ ${money(filters.minPrice!)}`;
  const rate=filters.currency&&filters.currency!=='TRY'?tlPerUnit(filters.currency,rates):undefined;
  const tl=rate?(filters.maxPrice??filters.minPrice!)*rate:undefined;
  add('price',tl?`${label} (≈ ${formatMoney(Math.round(tl/1000)*1000,'TRY',locale)})`:label);
 }
 if(filters.minArea!==undefined||filters.maxArea!==undefined)add('area',filters.minArea!==undefined&&filters.maxArea!==undefined?`${filters.minArea}–${filters.maxArea} m²`:filters.maxArea!==undefined?`≤ ${filters.maxArea} m²`:`≥ ${filters.minArea} m²`);
 if(filters.bathrooms)add('bathrooms',t('En az {count} banyo').replace('{count}',String(filters.bathrooms)));
 if(filters.maxAge===0)add('maxAge',t('Sıfır bina'));
 for(const item of filters.heating||[])add(`heating:${item}`,t(item));
 if(filters.furnished)add('furnished',t('Eşyalı'));
 for(const item of filters.amenities||[])add(`amenity:${item}`,t(item));
 for(const field of DETAIL_FIELDS){const value=filters[field.form as keyof NlFilters];if(typeof value==='string')add(field.form,value==='Evet'?t(field.label):`${t(field.label)}: ${t(value)}`);}
 if(filters.from)add('from',t(filters.from==='owner'?'Sahibinden':'Emlak Ofisinden'));
 if(filters.foreignSale)add('foreignSale',t(FOREIGN_SALE.label));
 if(filters.video)add('video',t('Videolu ilanlar'));
 if(filters.tour)add('tour',t('Sanal tura sahip ilanlar'));
 if(filters.q)add('q',`${t('Kelime')}: ${filters.q}`);
 return chips;
}
