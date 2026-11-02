import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import ts from 'typescript';
const transpile=p=>ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const compile=p=>url(transpile(p));
const detailsURL=url(transpile('listing-details').replace("'./property-categories'",JSON.stringify(compile('property-categories'))));
const searchCode=transpile('search-categories').replace("'./land'",JSON.stringify(compile('land'))).replace("'./property-subtypes'",JSON.stringify(compile('property-subtypes'))).replace("'./listings'",JSON.stringify('data:text/javascript,'+encodeURIComponent("export const AMENITIES=['Havuz'];"))).replace("'./listing-details'",JSON.stringify(detailsURL));
const {EXTRA_FILTERS,extraFilterSql,extraFilterMatches}=await import(url(searchCode));
const {detailsFrom,foreignSaleOf,FOREIGN_SALE}=await import(detailsURL);
const {pgPresentationJson}=await import(compile('pg-json'));
const {validateDraft}=await import(url(transpile('listing-drafts').replace("'./panoramas'",JSON.stringify(compile('panoramas')))));
const {convertPrice,defaultDisplayCurrency,roundApprox,isDisplayChoice}=await import(compile('display-currency'));
const query=o=>new URLSearchParams(o);

test('foreign sale flag is validated for sale listings of every category only',()=>{
 assert.deepEqual(detailsFrom({purpose:'satilik',propertyType:'daire',foreignSale:'Evet'}),{foreignSale:'Evet'});
 for(const propertyType of ['ticari','arsa','bina','devremulk','turistik','villa'])assert.equal(detailsFrom({purpose:'satilik',propertyType,foreignSale:'Bilinmiyor'})?.foreignSale,'Bilinmiyor',propertyType);
 for(const purpose of ['kiralik','gunluk','devren'])assert.equal(detailsFrom({purpose,propertyType:'daire',foreignSale:'Evet'}),undefined,purpose);
 assert.equal(detailsFrom({purpose:'satilik',propertyType:'daire',foreignSale:''}),undefined);
 assert.throws(()=>detailsFrom({purpose:'satilik',propertyType:'daire',foreignSale:'Belki'}),/Yabancıya satışa uygun/);
 assert.deepEqual(detailsFrom({purpose:'satilik',propertyType:'daire',detailSite:'Evet',foreignSale:'Hayır'}),{site:'Evet',foreignSale:'Hayır'});
 assert.equal(foreignSaleOf({purpose:'satilik',propertyType:'daire',presentation:{details:{foreignSale:'Evet'}}}),'Evet');
 assert.equal(foreignSaleOf({purpose:'kiralik',propertyType:'daire',presentation:{details:{foreignSale:'Evet'}}}),'');
 assert.deepEqual([...FOREIGN_SALE.options],['Evet','Hayır','Bilinmiyor']);
});

test('drafts keep the foreign sale answer',()=>{
 assert.equal(validateDraft({fields:{foreignSale:'Evet'},images:[],amenities:[]},'owner').fields.foreignSale,'Evet');
});

test('foreign sale filter runs in SQLite, matches in memory and rewrites for PostgreSQL',()=>{
 assert.ok(EXTRA_FILTERS.includes('foreignSale'));
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE listings(id TEXT,purpose TEXT,presentation TEXT)');
 const add=db.prepare('INSERT INTO listings VALUES(?,?,?)');
 add.run('a','satilik',JSON.stringify({details:{foreignSale:'Evet'}}));
 add.run('b','satilik',JSON.stringify({details:{foreignSale:'Hayır'}}));
 add.run('c','kiralik',JSON.stringify({details:{foreignSale:'Evet'}}));
 add.run('d','satilik',JSON.stringify({}));
 const ids=o=>{const f=extraFilterSql(query(o));return db.prepare(`SELECT id FROM listings l${f.where.length?' WHERE '+f.where.join(' AND '):''} ORDER BY id`).all(...f.values).map(r=>r.id);};
 assert.deepEqual(ids({foreignSale:'1'}),['a']);
 assert.deepEqual(ids({foreignSale:"1' OR 1=1 --"}),['a','b','c','d']);
 assert.deepEqual(ids({}),['a','b','c','d']);
 assert.equal(extraFilterMatches(query({foreignSale:'1'}),{purpose:'satilik',presentation:{details:{foreignSale:'Evet'}}}),true);
 assert.equal(extraFilterMatches(query({foreignSale:'1'}),{purpose:'kiralik',presentation:{details:{foreignSale:'Evet'}}}),false);
 assert.equal(extraFilterMatches(query({foreignSale:'1'}),{purpose:'satilik',presentation:{}}),false);
 assert.equal(pgPresentationJson(extraFilterSql(query({foreignSale:'1'})).where[0]),"(l.purpose IN (?) AND (l.presentation::jsonb->'details'->>'foreignSale')=?)");
});

test('approximate prices convert through Turkish lira and stay off when not useful',()=>{
 const rates={eurTry:50,usdTry:40,gbpTry:60};
 assert.equal(convertPrice(5_000_000,'TRY','EUR',rates),100_000);
 assert.equal(convertPrice(100_000,'EUR','USD',rates),125_000);
 assert.equal(convertPrice(100_000,'GBP','TRY',rates),6_000_000);
 assert.equal(convertPrice(100_000,'EUR','EUR',rates),null);
 assert.equal(convertPrice(100_000,'EUR','off',rates),null);
 assert.equal(convertPrice(100_000,'EUR','USD',null),null);
 assert.equal(convertPrice(100_000,'TRY','GBP',{eurTry:50,usdTry:40}),null);
 assert.equal(convertPrice(100_000,'JPY','EUR',rates),null);
 assert.equal(roundApprox(123_456),123_000);assert.equal(roundApprox(4_567_890),4_568_000);assert.equal(roundApprox(987.6),988);
 assert.equal(defaultDisplayCurrency('tr'),'off');
 for(const locale of ['de','fr','nl'])assert.equal(defaultDisplayCurrency(locale),'EUR');
 for(const locale of ['en','ar','fa','ru'])assert.equal(defaultDisplayCurrency(locale),'USD');
 assert.equal(isDisplayChoice('GBP'),true);assert.equal(isDisplayChoice('JPY'),false);assert.equal(isDisplayChoice(null),false);
});

test('citizenship guide is complete in every language and cites official sources',async()=>{
 const {citizenshipGuide,CITIZENSHIP_SOURCES,CITIZENSHIP_AS_OF}=await import(compile('citizenship-guide'));
 assert.match(CITIZENSHIP_AS_OF,/^\d{4}-\d{2}-\d{2}$/);
 const tr=citizenshipGuide.tr;
 for(const locale of ['tr','de','fr','en','ar','fa','ru','nl']){
  const guide=citizenshipGuide[locale];assert.ok(guide,locale);
  assert.equal(guide.sources.length,CITIZENSHIP_SOURCES.length,locale);
  assert.equal(guide.facts.length,tr.facts.length,locale);assert.equal(guide.steps.length,tr.steps.length,locale);
  assert.deepEqual(guide.sections.map(s=>s.items.length),tr.sections.map(s=>s.items.length),locale);
  for(const value of JSON.stringify(guide).match(/"(?:[^"\\]|\\.)*"/g))assert.notEqual(value,'""',locale);
  assert.match(JSON.stringify(guide),/400[.,  ٬]?000|۴۰۰٬۰۰۰/,locale);
 }
 for(const link of CITIZENSHIP_SOURCES)assert.match(link,/^https:\/\/(www\.)?(mevzuat|resmigazete|nvi|tkgm|invest)\.gov\.tr\//);
});

test('foreign buyer strings have every language',async()=>{
 const {foreignBuyerWords}=await import(compile('foreign-buyer-translations'));
 for(const [key,row] of Object.entries(foreignBuyerWords))for(const locale of ['de','fr','en','ar','fa','ru','nl'])assert.ok(row[locale]?.trim(),`${locale}: ${key}`);
 for(const [key,row] of Object.entries(foreignBuyerWords))assert.doesNotMatch(row.fa,/[يك]/,`Persian letters: ${key}`);
 assert.match(readFileSync(new URL('../lib/i18n-dictionary.ts',import.meta.url),'utf8'),/Object\.assign\(words,foreignBuyerWords\)/);
});
