import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {load} from './nl-search-loader.mjs';
// Natural-language search (lib/nl-search.ts, lib/nl-search-server.ts, app/api/search/parse).
// No network: Gemini is always a mocked fetch.
const nl=load('lib/nl-search.ts');
const server=load('lib/nl-search-server.ts');
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const parse=(query,locale='tr',currency)=>nl.parseNlQuery(query,{locale,currency});
const subset=(actual,expected,label)=>{for(const [key,value] of Object.entries(expected))assert.deepEqual(actual[key],value,`${label} → ${key}: ${JSON.stringify(actual)}`);};

// [locale, query, expected filters (subset), expected unsupported (optional)]
const CASES=[
 // Turkish
 ['tr',"Bodrum'da denize yakın, havuzlu, 3+1, 15 milyona kadar satılık villa",{purpose:'satilik',type:'villa',city:'Muğla',district:'Bodrum',rooms:['3+1'],maxPrice:15000000,currency:'TRY',amenities:['Havuz']},['denize yakın']],
 ['tr',"Kadıköy'de kiralık 2+1 daire 5-10 bin TL arası eşyalı",{purpose:'kiralik',type:'daire',city:'İstanbul',district:'Kadıköy',rooms:['2+1'],minPrice:5000,maxPrice:10000,currency:'TRY',furnished:true}],
 ['tr','kiralik daire istanbul kadikoy',{purpose:'kiralik',type:'daire',city:'İstanbul',district:'Kadıköy'}],
 ['tr','Alanyada sahibinden devren kiralık dükkan',{purpose:'devren',type:'ticari',businessType:'Dükkan & Mağaza',city:'Antalya',district:'Alanya',from:'owner'}],
 ['tr','İzmir Konak satılık daire',{purpose:'satilik',type:'daire',city:'İzmir',district:'Konak'}],
 ['tr','satılık konak İstanbul',{purpose:'satilik',type:'kosk-konak',city:'İstanbul'}],
 ['tr','Bahçelievler kiralık daire',{purpose:'kiralik',type:'daire',city:'İstanbul',district:'Bahçelievler',amenities:undefined}],
 ['tr','bahçeli müstakil ev satlık Antlaya',{purpose:'satilik',type:'mustakil',city:'Antalya',amenities:['Bahçe']}],
 ['tr','en fazla 15 milyon satılık daire',{purpose:'satilik',type:'daire',maxPrice:15000000,currency:'TRY'}],
 ['tr','2.5 milyon - 4 milyon arası villa',{type:'villa',minPrice:2500000,maxPrice:4000000,currency:'TRY'}],
 ['tr','3-4 yatak odalı daire',{type:'daire',rooms:['3+1','4+1']}],
 ['tr','denize sıfır yazlık Didim 3 milyon TL üzeri',{type:'yazlik',city:'Aydın',district:'Didim',minPrice:3000000,currency:'TRY'},['denize sıfır']],
 ['tr','günlük kiralık daire Kemer',{purpose:'gunluk',type:'daire',city:'Antalya',district:'Kemer'}],
 ['tr','Istanbul Sisli 1+1 kiralik residence',{purpose:'kiralik',type:'rezidans',city:'İstanbul',district:'Şişli',rooms:['1+1']}],
 ['tr','satılık arsa 500 m2',{purpose:'satilik',type:'arsa',minArea:500}],
 ['tr','sıfır bina site içinde asansörlü otoparklı 2+1 kiralık',{maxAge:0,detailSite:'Evet',amenities:['Asansör','Otopark'],rooms:['2+1'],purpose:'kiralik'}],
 ['tr','3 oda 1 salon kiralık Ankara Çankaya',{rooms:['3+1'],purpose:'kiralik',city:'Ankara',district:'Çankaya'}],
 ['tr','satılık otel Antalya',{purpose:'satilik',type:'turistik',tourismType:'Otel',city:'Antalya'}],
 // English
 ['en','2-bedroom flat for rent in Antalya under 1000 euro',{purpose:'kiralik',type:'daire',city:'Antalya',rooms:['2+1'],maxPrice:1000,currency:'EUR'}],
 ['en','between €200k and €300k villa in Kalkan with private pool',{type:'villa',city:'Antalya',district:'Kaş',q:'Kalkan',minPrice:200000,maxPrice:300000,currency:'EUR',amenities:['Özel havuz']}],
 ['en','house for sale Fethiye 3 bed 2 bath pool 400k GBP',{purpose:'satilik',category:'konut',city:'Muğla',district:'Fethiye',rooms:['3+1'],bathrooms:2,maxPrice:400000,currency:'GBP',amenities:['Havuz']}],
 ['en','new build apartments in Mersin with citizenship',{type:'daire',city:'Mersin',maxAge:0,foreignSale:true}],
 ['en','office for rent Şişli',{purpose:'kiralik',type:'ticari',businessType:'Ofis & Büro',city:'İstanbul',district:'Şişli'}],
 ['en','studio for rent in Beylikduzu',{purpose:'kiralik',rooms:['1+0'],city:'İstanbul',district:'Beylikdüzü'}],
 ['en','under a million dollar villa Bodrum',{type:'villa',maxPrice:1000000,currency:'USD',district:'Bodrum'}],
 ['en','sea view apartment for sale in Alanya under 300k',{purpose:'satilik',type:'daire',district:'Alanya',maxPrice:300000,currency:'GBP',amenities:['Deniz manzarası']}],
 ['en','more than 150 sqm house less than 2 million euro',{category:'konut',minArea:150,maxPrice:2000000,currency:'EUR'}],
 ['en','3+ bedrooms house for sale in Istanbul over 5m TL',{purpose:'satilik',city:'İstanbul',minPrice:5000000,currency:'TRY'}],
 // German
 ['de','3-Zimmer-Wohnung kaufen in Alanya mit Meerblick bis 200.000 €',{purpose:'satilik',type:'daire',district:'Alanya',rooms:['2+1'],maxPrice:200000,currency:'EUR',amenities:['Deniz manzarası']}],
 ['de','Wohnung mieten Antalya Konyaaltı 2 Zimmer bis 800 €',{purpose:'kiralik',type:'daire',district:'Konyaaltı',rooms:['1+1'],maxPrice:800,currency:'EUR'}],
 ['de','Haus mit Garten ab 300.000 Euro in Antalya, mindestens 120 m²',{category:'konut',city:'Antalya',minPrice:300000,currency:'EUR',minArea:120,amenities:['Bahçe']}],
 ['de','Ferienwohnung in Kemer mit Pool',{purpose:'gunluk',district:'Kemer',amenities:['Havuz']}],
 ['de','Wohnung zwischen 100.000 und 150.000 Euro Mersin',{type:'daire',city:'Mersin',minPrice:100000,maxPrice:150000,currency:'EUR'}],
 // French
 ['fr','Appartement à louer à Istanbul 2 chambres moins de 20 000 TL avec parking',{purpose:'kiralik',type:'daire',city:'İstanbul',rooms:['2+1'],maxPrice:20000,currency:'TRY',amenities:['Otopark']}],
 ['fr','T3 à vendre à Antalya vue mer 250 000 €',{purpose:'satilik',city:'Antalya',rooms:['2+1'],maxPrice:250000,currency:'EUR',amenities:['Deniz manzarası']}],
 ['fr','maison individuelle avec piscine à Bodrum entre 300 000 et 500 000 euros',{type:'mustakil',district:'Bodrum',minPrice:300000,maxPrice:500000,currency:'EUR',amenities:['Havuz']}],
 ['fr','villa à vendre à Bodrum avec piscine, jusqu’à 500 000 €',{purpose:'satilik',type:'villa',district:'Bodrum',maxPrice:500000,currency:'EUR',amenities:['Havuz']}],
 // Russian
 ['ru','Купить квартиру 2+1 в Алании до 150 тыс. евро с бассейном',{purpose:'satilik',type:'daire',city:'Antalya',district:'Alanya',rooms:['2+1'],maxPrice:150000,currency:'EUR',amenities:['Havuz']}],
 ['ru','от 5 до 10 млн рублей вилла Бодрум',{type:'villa',district:'Bodrum',minPrice:5000000,maxPrice:10000000,currency:'RUB'}],
 ['ru','снять квартиру в Стамбуле с мебелью',{purpose:'kiralik',type:'daire',city:'İstanbul',furnished:true}],
 ['ru','двухкомнатная квартира в Анталии до 100000 долларов',{type:'daire',city:'Antalya',rooms:['1+1'],maxPrice:100000,currency:'USD'}],
 // Arabic
 ['ar','شقة للإيجار في إسطنبول بغرفتين نوم حتى 5000 دولار',{purpose:'kiralik',type:'daire',city:'İstanbul',rooms:['2+1'],maxPrice:5000,currency:'USD'}],
 ['ar','فيلا للبيع في بودروم مع مسبح وإطلالة بحرية بسعر أقل من مليون دولار',{purpose:'satilik',type:'villa',district:'Bodrum',maxPrice:1000000,currency:'USD',amenities:['Havuz','Deniz manzarası']}],
 ['ar','شقة للبيع في اسطنبول 500 ألف ريال',{purpose:'satilik',type:'daire',city:'İstanbul',maxPrice:500000,currency:'SAR'}],
 ['ar','بين 100 و 200 ألف دولار شقة',{type:'daire',minPrice:100000,maxPrice:200000,currency:'USD'}],
 // Persian
 ['fa','آپارتمان دو خوابه اجاره‌ای در آنتالیا تا ۱۰۰۰ یورو',{purpose:'kiralik',type:'daire',city:'Antalya',rooms:['2+1'],maxPrice:1000,currency:'EUR'}],
 ['fa','بین ۱۰۰ تا ۲۰۰ هزار دلار آپارتمان',{type:'daire',minPrice:100000,maxPrice:200000,currency:'USD'}],
 ['fa','ویلا فروشی در بدروم تا ۲۰ میلیارد تومان',{purpose:'satilik',type:'villa',district:'Bodrum',maxPrice:undefined,currency:undefined},['20 میلیارد تومان']],
 ['fa','آپارتمان فروشی در استانبول ۵ میلیارد ریال',{purpose:'satilik',type:'daire',city:'İstanbul',maxPrice:undefined},['5 میلیارد ریال']],
 // Dutch
 ['nl','Villa te koop in Fethiye met zwembad en zeezicht tot 500.000 euro',{purpose:'satilik',type:'villa',district:'Fethiye',maxPrice:500000,currency:'EUR',amenities:['Havuz','Deniz manzarası']}],
 ['nl','appartement te huur Alanya 2 slaapkamers max 900 euro',{purpose:'kiralik',type:'daire',district:'Alanya',rooms:['2+1'],maxPrice:900,currency:'EUR'}],
 ['nl','huis te koop Bodrum vanaf 200.000 tot 400.000 euro',{purpose:'satilik',category:'konut',district:'Bodrum',minPrice:200000,maxPrice:400000,currency:'EUR'}],
];

test(`deterministic parser: ${CASES.length} phrases in all 8 languages`,()=>{
 assert.ok(CASES.length>=40);
 assert.deepEqual([...new Set(CASES.map(c=>c[0]))].sort(),['ar','de','en','fa','fr','nl','ru','tr']);
 for(const [locale,query,expected,unsupported] of CASES){
  const result=parse(query,locale);
  subset(result.filters,expected,`${locale}: ${query}`);
  if(unsupported)assert.deepEqual(result.unsupported,unsupported,`${query} unsupported`);
  assert.deepEqual(nl.validateNlFilters(result.filters,{allowQ:true}).rejected,[],`${query} passes the whitelist`);
 }
});

test('typos, missing diacritics and Turkish suffixes still match',()=>{
 subset(parse('satlık vila Fethie').filters,{purpose:'satilik',type:'villa',city:'Muğla',district:'Fethiye'},'typos');
 subset(parse('KİRALIK DAİRE İZMİR KARŞIYAKA').filters,{purpose:'kiralik',type:'daire',city:'İzmir',district:'Karşıyaka'},'upper case');
 subset(parse('kiralik daire izmir karsiyaka').filters,{purpose:'kiralik',type:'daire',city:'İzmir',district:'Karşıyaka'},'no diacritics');
 subset(parse("Antalya'nın Muratpaşa ilçesinde havuzlu site içi daire").filters,{city:'Antalya',district:'Muratpaşa',amenities:['Havuz'],detailSite:'Evet',type:'daire'},'suffixes');
 subset(parse('bodrumda villa').filters,{district:'Bodrum'},'locative without apostrophe');
});

test('places: ambiguous districts, province conflicts and common words',()=>{
 subset(parse('Kemer villa').filters,{city:'Antalya',district:'Kemer'},'preferred Kemer');
 subset(parse('Burdur Kemer daire').filters,{city:'Burdur',district:'Kemer'},'Kemer in Burdur');
 const conflict=parse('Bodrum İzmir villa');
 subset(conflict.filters,{city:'Muğla',district:'Bodrum'},'first province wins');assert.ok(conflict.ignored.includes('İzmir'));
 // "bahçe" (garden) is not the Osmaniye district Bahçe; "of" is not the Trabzon district Of.
 const garden=parse('bahçe ve havuz of the villa');assert.equal(garden.filters.city,undefined);assert.deepEqual(garden.filters.amenities,['Bahçe','Havuz']);
});

test('rooms rule: bedrooms N → N+1, room counts with living room → (N-1)+1, studio → 1+0, minimum lists',()=>{
 assert.deepEqual(parse('3 bedrooms','en').filters.rooms,['3+1']);
 assert.deepEqual(parse('three bedroom villa','en').filters.rooms,['3+1']);
 assert.deepEqual(parse('4 Zimmer','de').filters.rooms,['3+1']);
 assert.deepEqual(parse('1 Zimmer Wohnung','de').filters.rooms,['1+0']);
 assert.deepEqual(parse('3 pièces','fr').filters.rooms,['2+1']);
 assert.deepEqual(parse('трехкомнатная квартира','ru').filters.rooms,['2+1']);
 assert.deepEqual(parse('studio','en').filters.rooms,['1+0']);
 const atLeast=parse('en az 3 odalı villa').filters.rooms;assert.ok(atLeast.includes('3+1')&&atLeast.includes('4+1')&&!atLeast.includes('2+1'));
 assert.deepEqual(nl.roomsAtLeast(9),['9+1','10 Üzeri']);
});

test('price units, currency words and default currency',()=>{
 const cases=[['15 milyon','tr',15000000,'TRY'],['1,5 milyon €','tr',1500000,'EUR'],['500 bin TL','tr',500000,'TRY'],['300k','en',300000,'GBP'],['$1.2m','en',1200000,'USD'],['£500,000','en',500000,'GBP'],
  ['2 Mio. Euro','de',2000000,'EUR'],['3 млн','ru',3000000,'RUB'],['200 тыс. долларов','ru',200000,'USD'],['مليون درهم','ar',undefined,undefined],['2 مليون درهم','ar',2000000,'AED'],['500 هزار یورو','fa',500000,'EUR'],
  ['1 miljoen euro','nl',1000000,'EUR'],['250.000 sterlin','tr',250000,'GBP'],['5 milyon ₺','en',5000000,'TRY'],['10 milyon','en',10000000,'TRY'],['2500 ₽','ru',2500,'RUB'],['1 500 000 TL','tr',1500000,'TRY']];
 for(const [query,locale,max,currency] of cases){const f=parse(query,locale).filters;assert.equal(f.maxPrice,max,query);assert.equal(f.currency,currency,query);}
 // An amount with no currency word uses the display currency the visitor chose.
 assert.equal(parse('villa under 400000','en','USD').filters.currency,'USD');
 assert.equal(parse('villa under 400000','en','JPY').filters.currency,'GBP');
 // Plain small numbers and years are not prices.
 const year=parse('2020 yapımı daire');assert.equal(year.filters.maxPrice,undefined);
});

test('URL uses the /ilanlar parameter names only and survives Explorer round trips',()=>{
 const extra=[...read('lib/search-categories.ts').matchAll(/EXTRA_FILTERS=\[([^\]]+)\]/g)][0][1].match(/'(\w+)'/g).map(s=>s.slice(1,-1));
 const explorer=read('components/Explorer.tsx');
 const known=new Set(['q','category','currency','purpose','city','district','type','minPrice','maxPrice','minArea','maxArea','bathrooms','furnished','amenities',...extra]);
 for(const key of nl.NL_URL_KEYS){assert.ok(known.has(key),`unknown /ilanlar param ${key}`);assert.ok(explorer.includes(`"${key}"`)||extra.includes(key),`Explorer reads ${key}`);}
 const url=nl.nlSearchUrl(parse("Bodrum'da havuzlu 3+1 satılık villa, 15 milyona kadar").filters);
 assert.equal(url,'/ilanlar?purpose=satilik&type=villa&city=Mu%C4%9Fla&district=Bodrum&rooms=3%2B1&maxPrice=15000000&currency=TRY&amenities=Havuz');
 const params=new URLSearchParams(url.split('?')[1]);
 assert.equal(params.get('rooms'),'3+1');
 assert.equal(nl.nlSearchUrl({}),'/ilanlar');
 assert.equal(nl.nlSearchUrl({currency:'EUR',city:'Antalya'}),'/ilanlar?city=Antalya','currency only with a price');
 assert.equal(nl.nlSearchUrl({furnished:true,amenities:['Havuz','Teras'],maxAge:0}),'/ilanlar?maxAge=0&furnished=1&amenities=Havuz%2CTeras');
 // lib/search-filters.ts / lib/price-filters.ts accept the currency for a range
 assert.match(read('lib/price-filters.ts'),/query\.get\('currency'\)/);
});

test('chips are translated and show the TL equivalent with the TCMB rate',()=>{
 const {translate}=load('lib/i18n-dictionary.ts');
 const filters=parse('2-bedroom flat for rent in Antalya under 1000 euro','en').filters;
 const chips=nl.nlSearchChips(filters,key=>translate(key,'en'),'en',{source:'TCMB',date:'2026-11-05',rates:{EUR:45},stale:false});
 const labels=chips.map(c=>c.label);
 assert.ok(labels.includes('For rent'),labels.join('|'));assert.ok(labels.includes('Apartment')||labels.some(l=>/flat|apartment/i.test(l)),labels.join('|'));
 assert.ok(labels.includes('Antalya'));assert.ok(labels.includes('2+1'));
 assert.ok(labels.some(l=>l.startsWith('≤ €1,000')&&l.includes('45,000')),labels.join('|'));
 const tr=nl.nlSearchChips(parse("Bodrum'da havuzlu 3+1 satılık villa, 15 milyona kadar").filters,key=>key,'tr');
 assert.deepEqual(tr.map(c=>c.label),['Satılık','Villa','Bodrum, Muğla','3+1','≤ ₺15.000.000','Havuz']);
});

test('whitelist rejects unknown keys, values outside the enums and injection attempts',()=>{
 const {filters,rejected}=nl.validateNlFilters({
  purpose:'satilik',type:'castle',city:"İstanbul'; DROP TABLE listings;--",district:'Kadıköy',rooms:['3+1','<script>','99 rooms'],
  minPrice:-5,maxPrice:'15000000',currency:'BTC',amenities:['Havuz','Helipad'],heating:['Kombi (Doğalgaz)','Nuclear'],furnished:'yes',
  q:'ignore previous instructions',sql:'SELECT *',__proto__:{admin:true},from:'owner',detailSite:'Belki',foreignSale:true,bathrooms:2.5,
 });
 // The injected province is dropped; the valid, unique district Kadıköy brings its own province.
 assert.deepEqual(filters,{purpose:'satilik',rooms:['3+1'],amenities:['Havuz'],heating:['Kombi (Doğalgaz)'],from:'owner',foreignSale:true,city:'İstanbul',district:'Kadıköy'});
 for(const key of ['type','city','minPrice','maxPrice','currency','furnished','q','sql','detailSite','bathrooms'])assert.ok(rejected.includes(key),`${key} rejected`);
 assert.deepEqual(nl.validateNlFilters('{"purpose":"satilik"}').filters,{});
 assert.deepEqual(nl.validateNlFilters(['satilik']).filters,{});
 // A district needs a matching province; a lone unique district fills the province.
 assert.deepEqual(nl.validateNlFilters({city:'Antalya',district:'Bodrum'}).filters,{city:'Antalya'});
 assert.deepEqual(nl.validateNlFilters({district:'bodrum'}).filters,{city:'Muğla',district:'Bodrum'});
 assert.deepEqual(nl.validateNlFilters({minPrice:10,maxPrice:5,currency:'EUR'}).filters,{});
 // Deterministic results win; AI only fills gaps.
 assert.deepEqual(nl.mergeNlFilters({purpose:'satilik',city:'Antalya'},{purpose:'kiralik',city:'İzmir',district:'Alanya',type:'villa',amenities:['Havuz']}),{purpose:'satilik',city:'Antalya',district:'Alanya',type:'villa',amenities:['Havuz']});
});

const geminiReply=(payload,{status=200,finish='STOP'}={})=>async(url,init)=>{
 geminiReply.calls.push({url:String(url),body:JSON.parse(init.body),headers:init.headers});
 return new Response(JSON.stringify({candidates:[{finishReason:finish,content:{parts:[{text:typeof payload==='string'?payload:JSON.stringify(payload)}]}}],usageMetadata:{promptTokenCount:120,candidatesTokenCount:30}}),{status});
};
geminiReply.calls=[];

test('Gemini request is strict (temperature 0, enum schema, contact details redacted) and its answer is whitelisted',async()=>{
 geminiReply.calls=[];let usage;
 const result=await server.geminiNlFilters({GEMINI_API_KEY:'test-key'},'villa yakın okul imarlı mail me a@b.com +90 555 111 22 33',{type:'villa'},async u=>{usage=u;},geminiReply({purpose:'satilik',city:'Muğla',evil:'x',amenities:['Havuz','Jacuzzi'],understood:['imarlı',7]}));
 assert.deepEqual(result.filters,{purpose:'satilik',city:'Muğla',amenities:['Havuz']});
 assert.ok(result.rejected.includes('evil'));assert.deepEqual(result.understood,['imarlı']);
 const call=geminiReply.calls[0];
 assert.match(call.url,/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-[\w.-]+:generateContent$/);
 assert.equal(call.body.generationConfig.temperature,0);
 assert.deepEqual(call.body.generationConfig.responseSchema.properties.purpose.enum,['satilik','kiralik','gunluk','devren']);
 assert.ok(call.body.generationConfig.responseSchema.properties.city.enum.includes('İstanbul'));
 const sent=call.body.contents[0].parts[0].text;assert.ok(!sent.includes('a@b.com')&&!sent.includes('555 111'),sent);
 assert.deepEqual(usage,{input:120,output:30});
 await assert.rejects(server.geminiNlFilters({GEMINI_API_KEY:'k'},'x',{},async()=>{},geminiReply('not json')));
 await assert.rejects(server.geminiNlFilters({GEMINI_API_KEY:'k'},'x',{},async()=>{},geminiReply({},{finish:'SAFETY'})));
 await assert.rejects(server.geminiNlFilters({GEMINI_API_KEY:'k'},'x',{},async()=>{},geminiReply({},{status:429})));
 await assert.rejects(server.geminiNlFilters({},'x',{},async()=>{},geminiReply({})),/unavailable/);
});

test('AI only runs for leftover words, fills gaps, and any failure falls back to the parser',async()=>{
 const t=key=>key,rates=null;
 let calls=0;
 const clear=await server.resolveNlSearch({query:"Bodrum'da havuzlu satılık villa",locale:'tr',t,rates,ai:async()=>{calls++;return null;}});
 assert.equal(calls,0);assert.equal(clear.ai,'skipped');
 const query='satılık arsa Muğla imarlı yola cepheli';
 const base=await server.resolveNlSearch({query,locale:'tr',t,rates,ai:null});
 assert.equal(base.ai,'unavailable');assert.deepEqual(base.ignored,['imarlı','yola','cepheli']);
 assert.equal(base.url,'/ilanlar?purpose=satilik&type=arsa&city=Mu%C4%9Fla');
 for(const failing of [async()=>{throw new Error('timeout');},async()=>null]){
  const result=await server.resolveNlSearch({query,locale:'tr',t,rates,ai:failing});
  assert.equal(result.url,base.url);assert.ok(['failed','limit'].includes(result.ai));
 }
 const used=await server.resolveNlSearch({query,locale:'tr',t,rates,ai:async(text,recognized)=>{assert.equal(recognized.type,'arsa');return {filters:{purpose:'kiralik',district:'Bodrum',maxPrice:900000},understood:['imarlı']};}});
 assert.equal(used.ai,'used');assert.equal(used.filters.purpose,'satilik','parser wins');assert.equal(used.filters.district,'Bodrum');
 assert.equal(used.filters.currency,'TRY');assert.deepEqual(used.ignored,['yola','cepheli']);
});

test('per-IP rate limit and AI quota accounting',async()=>{
 const limiter=server.createRateLimiter(3,60000);
 assert.deepEqual([1,2,3,4].map(()=>limiter.take('ip-a',1000)),[true,true,true,false]);
 assert.equal(limiter.take('ip-b',1000),true,'separate per key');
 assert.equal(limiter.take('ip-a',61001),true,'window resets');
 const small=server.createRateLimiter(1,1000,2);small.take('a',0);small.take('b',0);small.take('c',5000);assert.ok(small.size()<=2);
 const sql=new DatabaseSync(':memory:');
 const database={prepare(q){const s={values:[],bind(...v){s.values=v;return s;},async run(){return sql.prepare(q).run(...s.values);},async first(){return sql.prepare(q).get(...s.values)||null;},async all(){return {results:sql.prepare(q).all(...s.values)};}};return s;}};
 const at=new Date('2026-11-06T10:00:00Z');
 const settings={AI_DAILY_CALL_LIMIT:'400',NL_SEARCH_DAILY_AI_LIMIT:'3'};
 const first=await server.reserveNlSearchAi(database,'client-1',settings,at);assert.equal(typeof first,'function');
 await first({input:100,output:20});
 assert.equal(sql.prepare("SELECT requests,input_tokens FROM ai_usage_limits WHERE key='assistant:global:2026-11-06'").get().requests,1,'shared with the assistant counter');
 assert.equal(sql.prepare("SELECT requests,input_tokens FROM ai_monthly_usage WHERE month='2026-11'").get().input_tokens,100);
 assert.ok(await server.reserveNlSearchAi(database,'client-2',settings,at));
 assert.ok(await server.reserveNlSearchAi(database,'client-3',settings,at));
 assert.equal(await server.reserveNlSearchAi(database,'client-4',settings,at),null,'own daily cap');
 for(let i=0;i<10;i++)await server.reserveNlSearchAi(database,'client-5',{NL_SEARCH_DAILY_AI_LIMIT:'500'},at);
 assert.equal(await server.reserveNlSearchAi(database,'client-5',{NL_SEARCH_DAILY_AI_LIMIT:'500'},at),null,'per-visitor daily cap');
 sql.prepare("UPDATE ai_monthly_usage SET requests=50 WHERE month='2026-11'").run();
 assert.equal(await server.reserveNlSearchAi(database,'client-6',{AI_MONTHLY_CALL_LIMIT:'50'},at),null,'monthly limit');
 // Only hashed keys and counters are stored, never the query.
 assert.ok(sql.prepare('SELECT key FROM ai_usage_limits').all().every(r=>/^(nl-search:(client:client-\d|global)|assistant:global):|^nl-search:/.test(r.key)));
});

test('route: same-origin, rate limit, no query logging, AI off by request',()=>{
 const route=read('app/api/search/parse/route.ts');
 assert.match(route,/sameOrigin\(request\)/);assert.match(route,/sec-fetch-site/);
 assert.match(route,/createRateLimiter\(30,10\*60_000\)/);assert.match(route,/sha256\('nl-search:'\+clientIp\(request\)\)/);
 assert.match(route,/input\.ai!==false/);
 assert.doesNotMatch(route,/console\.|recordOperation\([^)]*query/);
 assert.doesNotMatch(read('lib/nl-search-server.ts'),/console\./);
});

test('placeholder examples parse in every language',()=>{
 const {aiSearchWords}=load('lib/ai-search-translations.ts');
 const placeholder=aiSearchWords['Ne arıyorsunuz? Örn: Bodrum’da havuzlu 3+1 satılık villa, 15 milyona kadar'];
 const examples={tr:'Bodrum’da havuzlu 3+1 satılık villa, 15 milyona kadar',...Object.fromEntries(Object.entries(placeholder).map(([locale,text])=>[locale,text.replace(/^[^:：]*[:：]\s*|^[^.]*\.\s*/,'')]))};
 for(const [locale,example] of Object.entries(examples)){
  const result=parse(example,locale);
  assert.ok(result.filters.purpose&&(result.filters.city||result.filters.district),`${locale}: ${example} → ${JSON.stringify(result)}`);
  assert.ok(result.filters.maxPrice,`${locale} price: ${example}`);
 }
});
