import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
// Map pin, map search box and neighbourhood block (lib/listing-location.ts, lib/neighborhood-info.ts,
// lib/geocode.ts, app/api/listings routes). No network: every fetch is mocked.
const requireNative=createRequire(import.meta.url);
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const json=file=>JSON.parse(read(file));
function load(file,overrides={}){
 const m={exports:{}};
 const resolve=name=>{
  if(overrides[name])return overrides[name];
  if(name.endsWith('.json'))return {default:json(name.replace(/^@\//,''))};
  if(name.startsWith('./'))return load('lib/'+name.slice(2)+'.ts',overrides);
  if(name.startsWith('@/lib/'))return load(name.slice(2)+'.ts',overrides);
  if(name.startsWith('@/'))return {};
  return requireNative(name);
 };
 new Function('require','module','exports',ts.transpile(read(file),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}))(resolve,m,m.exports);
 return m.exports;
}
const loc=load('lib/listing-location.ts');
const nearby=load('lib/neighborhood-info.ts');
// Real parseListing from lib/server.ts (the function only), with its helpers.
const serverTree=ts.createSourceFile('server.ts',read('lib/server.ts'),ts.ScriptTarget.ES2022,true);
const parseSource=serverTree.statements.find(n=>n.name?.text==='parseListing').getText(serverTree);
const {parseListing}=new Function('publicPresentation','publicPrecision','listingExpired','recentPriceDrop',ts.transpile(parseSource.replace(/^export /,'')+';return {parseListing};',{target:ts.ScriptTarget.ES2022}))(loc.publicPresentation,loc.publicPrecision,()=>false,()=>undefined);
const sequence=values=>{let i=0;return ()=>values[i++%values.length];};
function sqliteDb(sql){let lane=Promise.resolve();return {prepare(query){let values=[];return {bind(...v){values=v;return this;},async first(){return sql.prepare(query).get(...values)||null;},async all(){return {results:sql.prepare(query).all(...values)};},async run(){try{return sql.prepare(query).run(...values);}catch(e){e.message+=' in '+query.slice(0,120)+' '+JSON.stringify(values);throw e;}}};},batch(statements){const run=lane.then(async()=>{sql.exec('BEGIN');try{for(const s of statements)await s.run();sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}});lane=run.catch(()=>{});return run;}};}
function schema(){const sql=new DatabaseSync(':memory:');for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sql.exec(read('drizzle/'+file));sql.exec('CREATE TABLE IF NOT EXISTS listing_moderation_holds(listing_id TEXT,active INTEGER)');return sql;}

// Bebek, Beşiktaş (İstanbul)
const BEBEK={lat:41.07712,lng:29.04321};

test('pin input: Türkiye bounding box, rough province check, precision default and clearing',()=>{
 assert.deepEqual(loc.parseLocationInput({},'İstanbul'),{kind:'none'});
 assert.deepEqual(loc.parseLocationInput({latitude:'',longitude:''},'İstanbul'),{kind:'clear'});
 assert.deepEqual(loc.parseLocationInput({latitude:null,longitude:null},'İstanbul'),{kind:'clear'});
 assert.deepEqual(loc.parseLocationInput({latitude:'41.077123456',longitude:'29.043214'},'İstanbul'),{kind:'set',lat:41.07712,lng:29.04321,precision:'approximate'});
 assert.equal(loc.parseLocationInput({latitude:41.07,longitude:29.04,locationPrecision:'exact'},'İstanbul').precision,'exact');
 // Outside Türkiye (Athens, Tbilisi), malformed values, and a point in the wrong province (Bebek for Antalya).
 for(const [lat,lng] of [[37.98,23.72],[41.71,45.2],[34.9,33.0],['x','29'],[41,''],[Infinity,29]])assert.throws(()=>loc.parseLocationInput({latitude:lat,longitude:lng},'İstanbul'),/Türkiye sınırları/);
 assert.throws(()=>loc.parseLocationInput({latitude:BEBEK.lat,longitude:BEBEK.lng},'Antalya'),/seçtiğiniz ilin/);
 assert.throws(()=>loc.parseLocationInput({latitude:BEBEK.lat,longitude:BEBEK.lng},'Bilinmeyen'),/seçtiğiniz ilin/);
 // Every province centroid is accepted for its own province.
 for(const [city,[lat,lng]] of Object.entries(json('data/province-centers.json')))assert.equal(loc.parseLocationInput({latitude:lat,longitude:lng},city).kind,'set',city);
});

test('approximate pins are moved 250–600 m and rounded; the exact pin only stays private',()=>{
 for(let i=0;i<500;i++){const p=loc.approximatePoint(BEBEK.lat,BEBEK.lng);const d=loc.distanceMeters(BEBEK.lat,BEBEK.lng,p.lat,p.lng);assert.ok(d>=250&&d<=600,`moved ${d} m`);assert.equal(Math.round(p.lat*1000)/1000,p.lat);assert.equal(Math.round(p.lng*1000)/1000,p.lng);}
 const input=loc.parseLocationInput({latitude:BEBEK.lat,longitude:BEBEK.lng},'İstanbul');
 const saved=loc.resolveLocation(input,null,sequence([0.5,0.25]));
 assert.notEqual(saved.latitude,BEBEK.lat);assert.deepEqual(saved.location,{precision:'approximate',exact:{lat:BEBEK.lat,lng:BEBEK.lng}});
 // Saving the same pin again keeps the same public point (no cloud of offsets to average).
 const again=loc.resolveLocation(input,saved,sequence([0.9,0.9]));
 assert.equal(again.latitude,saved.latitude);assert.equal(again.longitude,saved.longitude);
 const moved=loc.resolveLocation(loc.parseLocationInput({latitude:41.08,longitude:29.05},'İstanbul'),saved,sequence([0.1,0.6]));
 assert.notEqual(moved.latitude,saved.latitude);assert.deepEqual(moved.location.exact,{lat:41.08,lng:29.05});
 // Exact: the columns hold the pin and no private copy is kept.
 assert.deepEqual(loc.resolveLocation(loc.parseLocationInput({latitude:BEBEK.lat,longitude:BEBEK.lng,locationPrecision:'exact'},'İstanbul'),saved),{latitude:BEBEK.lat,longitude:BEBEK.lng,location:{precision:'exact'}});
 assert.deepEqual(loc.resolveLocation({kind:'clear'},saved),{latitude:null,longitude:null,location:null});
 assert.equal(loc.resolveLocation({kind:'none'},saved),null);
 // What leaves the server.
 assert.deepEqual(loc.publicPresentation({videoUrl:'',location:saved.location}),{videoUrl:'',location:{precision:'approximate'}});
 assert.deepEqual(loc.publicPresentation({videoUrl:''}),{videoUrl:''});
 assert.equal(loc.publicPrecision({location:saved.location},saved.latitude,saved.longitude),'approximate');
 assert.equal(loc.publicPrecision({},41,29),'approximate');
 assert.equal(loc.publicPrecision({location:{precision:'exact'}},41,29),'exact');
 assert.equal(loc.publicPrecision({},null,null),undefined);
 assert.deepEqual(loc.ownerPin({latitude:saved.latitude,longitude:saved.longitude,presentation:JSON.stringify({location:saved.location})}),{latitude:BEBEK.lat,longitude:BEBEK.lng,precision:'approximate'});
 assert.equal(loc.ownerPin({latitude:null,longitude:null,presentation:'{}'}),null);
});

test('map search box: parsing, index-friendly ranges on the public point, saved searches',()=>{
 assert.deepEqual(loc.parseBbox('28.9,40.9,29.1,41.1'),[28.9,40.9,29.1,41.1]);
 for(const bad of ['','1,2,3','29.1,40.9,28.9,41.1','28.9,41.1,29.1,40.9','a,b,c,d','-181,0,1,1','28.9,,29.1,41.1',null])assert.equal(loc.parseBbox(bad),null,String(bad));
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE listings(id TEXT,status TEXT,latitude REAL,longitude REAL,presentation TEXT);CREATE INDEX listings_point ON listings(latitude,longitude)");
 // "approx" has its exact pin inside the box but its public (offset) point outside: it must not match.
 const approx=loc.resolveLocation({kind:'set',lat:41.0995,lng:29.0995,precision:'approximate'},null,sequence([1,0.125]));
 assert.ok(approx.latitude>41.1||approx.longitude>29.1);
 const rows=[['inside',41.0,29.0],['edge',41.1,29.1],['outside',41.2,29.0],['nopin',null,null],['approx',approx.latitude,approx.longitude]];
 for(const [id,lat,lng] of rows)sql.prepare("INSERT INTO listings VALUES(?,'published',?,?,'{}')").run(id,lat,lng);
 const box=loc.bboxSql([28.9,40.9,29.1,41.1]);
 assert.doesNotMatch(box.where,/ OR /);
 assert.deepEqual(sql.prepare(`SELECT id FROM listings l WHERE l.status='published' AND ${box.where} ORDER BY id`).all(...box.values).map(r=>r.id),['edge','inside']);
 assert.match(sql.prepare(`EXPLAIN QUERY PLAN SELECT id FROM listings l WHERE ${box.where}`).all(...box.values).map(r=>r.detail).join(' '),/USING INDEX listings_point/);
 assert.equal(loc.inBbox([28.9,40.9,29.1,41.1],41,29),true);assert.equal(loc.inBbox([28.9,40.9,29.1,41.1],null,null),false);
 const search=load('lib/search-filters.ts');
 assert.equal(search.cleanSearch('bbox=28.9,40.9,29.1,41.1&city=İstanbul'),'bbox=28.9%2C40.9%2C29.1%2C41.1&city=%C4%B0stanbul');
 assert.equal(search.cleanSearch('bbox=bad'),'');
 const saved=search.searchSql('bbox=28.9,40.9,29.1,41.1');
 assert.match(saved.where,/l\.latitude BETWEEN \? AND \? AND l\.longitude BETWEEN \? AND \?/);assert.deepEqual(saved.values,[40.9,41.1,28.9,29.1]);
});

// POST and PATCH /api/listings with a real SQLite schema (drizzle/) and only the outside services mocked.
function routeDeps(sql,user,scheduled){
 const database=sqliteDb(sql);
 return {
  '@/lib/server':{sameOrigin:()=>true,currentUser:async()=>user,isAdmin:()=>false,db:()=>database,bucket:()=>null,listingById:async()=>null,body:r=>r.json(),error:(message,status=400)=>Response.json({error:message},{status}),ok:(data,init)=>Response.json(data,init),str:(v,n)=>typeof v==='string'?v.trim().slice(0,n):'',num:v=>Number(v),now:()=>new Date().toISOString(),parseListing,OWNER_VERIFIED_SQL:'0 AS owner_verified'},
  '@/lib/company-team-server':{activeTeamCompany:async()=>null},
  '@/lib/listing-submissions':{submissionTicket:async()=>null},
  '@/lib/office-verification-server':{officeDB:async()=>{},officePublicationAllowed:async()=>false},
  '@/lib/agent-plan':{agentPlanAccess:async()=>({allowed:true}),agentInsertGuard:'1=1'},
  '@/lib/publication-policy':{AGENT_PLANS_ENABLED:false},
  '@/lib/listing-video-server':{videoFeatureEnabled:()=>false,removeVideoById:async()=>{}},
  '@/lib/listing-video-store':{videoAttachProblem:async()=>null,attachVideoStatement:()=>null},
  '@/lib/translation-runtime':{queueListingTranslation:async()=>{}},
  '@/lib/neighborhood-info-server':{scheduleListingNearby:id=>scheduled.push(id)},
  '@/lib/external-r2':{externalR2BucketName:()=>'test-bucket',headExternalImage:async()=>({contentType:'image/jpeg',size:1,checksum:'x'}),deleteExternalImage:async()=>{}},
  '@/lib/reports-server':{reportsDB:async()=>{}},
  '@/lib/tcmb-server':{currentRates:async()=>null},
  '@/lib/listings':{AMENITIES:[],PUBLIC_DEMO_LISTINGS:[],PROPERTY_TYPES:[{value:'daire'}],publicListing:l=>l},
  '@/lib/listing-media':{listingMediaKeys:()=>[],removeListingMedia:async()=>0},
  '@/lib/turkey-locations':{validDistrict:()=>true},
  '@/lib/turkey-neighborhoods':{findNeighborhood:(city,district,id)=>({id,name:'Bebek',postalCode:'34342'})},
  '@/lib/listing-details':{validRooms:()=>true,detailsFrom:()=>undefined},
  '@/lib/presentation':{presentationFrom:()=>({floorPlan:'',videoUrl:'',tourUrl:'',panoramas:[]})},
  '@/lib/price-filters':{CURRENCIES:['TRY'],TL_ONLY_MESSAGE:'TL',listingCurrencyAllowed:v=>v==null||v===''||v==='TRY',tlPriceRange:()=>({})},
 };
}
function seedUser(sql){const user={id:crypto.randomUUID(),email:'owner@example.test',name:'Owner',role:'individual',email_verified:1,agent_status:'none',company:''};sql.prepare('INSERT INTO users(id,email,password_hash,name,role,created_at) VALUES(?,?,?,?,?,?)').run(user.id,user.email,'not-a-password',user.name,user.role,new Date().toISOString());return user;}
const listingBody=(user,extra={})=>({title:'Bebek’te deniz manzaralı daire',description:'Boğaz’a yakın, ferah ve aydınlık bir daire; test açıklaması.',purpose:'satilik',propertyType:'daire',city:'İstanbul',district:'Beşiktaş',neighborhoodId:40219,price:1000000,grossArea:100,images:[`/api/media/listings/${user.id}/${crypto.randomUUID()}.jpg`],...extra});
// Individual accounts may post once in 45 days; the quota is reset so one account can post several test listings.
const post=(route,payload)=>route.POST(new Request('https://site.test/api/listings',{method:'POST',body:JSON.stringify(payload)}));

test('POST stores the public point in the columns and keeps the exact pin private',async()=>{
 const sql=schema(),user=seedUser(sql),scheduled=[],route=load('app/api/listings/route.ts',routeDeps(sql,user,scheduled));
 const response=await post(route,listingBody(user,{latitude:String(BEBEK.lat),longitude:String(BEBEK.lng)}));
 assert.equal(response.status,201,JSON.stringify(await response.clone().json()));
 const {id}=await response.json(),row=sql.prepare('SELECT * FROM listings WHERE id=?').get(id);
 const moved=loc.distanceMeters(BEBEK.lat,BEBEK.lng,row.latitude,row.longitude);
 assert.ok(moved>=250&&moved<=600,`public point moved ${moved} m`);
 assert.deepEqual(JSON.parse(row.presentation).location,{precision:'approximate',exact:{lat:BEBEK.lat,lng:BEBEK.lng}});
 assert.deepEqual(scheduled,[id]);
 // Everything built from the row for visitors (parseListing) lacks the exact pin.
 const visible=JSON.stringify(parseListing({...row,owner_name:'Owner'}));
 assert.ok(!visible.includes(String(BEBEK.lat))&&!visible.includes(String(BEBEK.lng)),visible);
 assert.equal(parseListing(row).locationPrecision,'approximate');
 // Exact choice, no pin, and invalid pins.
 sql.exec('DELETE FROM individual_listing_quota');
 const exact=await post(route,listingBody(user,{latitude:BEBEK.lat,longitude:BEBEK.lng,locationPrecision:'exact'}));
 const exactRow=sql.prepare('SELECT * FROM listings WHERE id=?').get((await exact.json()).id);
 assert.equal(exactRow.latitude,BEBEK.lat);assert.equal(exactRow.longitude,BEBEK.lng);assert.deepEqual(JSON.parse(exactRow.presentation).location,{precision:'exact'});assert.equal(parseListing(exactRow).locationPrecision,'exact');
 sql.exec('DELETE FROM individual_listing_quota');
 const plain=await post(route,listingBody(user));
 const plainRow=sql.prepare('SELECT * FROM listings WHERE id=?').get((await plain.json()).id);
 assert.equal(plainRow.latitude,null);assert.equal(JSON.parse(plainRow.presentation).location,undefined);assert.equal(scheduled.length,2);
 for(const [lat,lng,message] of [[37.98,23.72,/Türkiye/],[36.88,30.70,/ilin/]]){sql.exec('DELETE FROM individual_listing_quota');const bad=await post(route,listingBody(user,{latitude:lat,longitude:lng}));assert.equal(bad.status,400);assert.match((await bad.json()).error,message);}
 assert.equal(sql.prepare('SELECT count(*) AS n FROM listings').get().n,3);
});

test('PATCH keeps the public point for an unchanged pin, moves it for a new one, clears it on a province change',async()=>{
 const sql=schema(),user=seedUser(sql),scheduled=[],deps=routeDeps(sql,user,scheduled),create=load('app/api/listings/route.ts',deps),route=load('app/api/listings/[id]/route.ts',deps);
 const {id}=await (await post(create,listingBody(user,{latitude:BEBEK.lat,longitude:BEBEK.lng}))).json();
 const first=sql.prepare('SELECT latitude,longitude,presentation FROM listings WHERE id=?').get(id);
 // Store a neighbourhood block as the background job would.
 sql.prepare('UPDATE listings SET presentation=? WHERE id=?').run(JSON.stringify({...JSON.parse(first.presentation),nearby:{fetchedAt:new Date().toISOString(),point:[first.latitude,first.longitude],radiusM:2000,approximate:true,items:[{type:'park',name:'Bebek Parkı',distanceM:120}]}}),id);
 const patch=payload=>route.PATCH(new Request('https://site.test/api/listings/'+id,{method:'PATCH',body:JSON.stringify(payload)}),{params:Promise.resolve({id})});
 const base={...listingBody(user),neighborhoodId:40219};
 let response=await patch({...base,latitude:String(BEBEK.lat),longitude:String(BEBEK.lng),locationPrecision:'approximate'});
 assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
 let row=sql.prepare('SELECT latitude,longitude,presentation FROM listings WHERE id=?').get(id);
 assert.equal(row.latitude,first.latitude);assert.equal(row.longitude,first.longitude);assert.equal(JSON.parse(row.presentation).nearby.items[0].name,'Bebek Parkı');
 // Untouched pin when the form does not send it.
 await patch({title:base.title+' yeni'});
 row=sql.prepare('SELECT latitude,longitude,presentation FROM listings WHERE id=?').get(id);
 assert.equal(row.latitude,first.latitude);assert.equal(JSON.parse(row.presentation).location.exact.lat,BEBEK.lat);
 // A moved pin gets a new offset and drops the old neighbourhood block.
 scheduled.length=0;
 response=await patch({...base,latitude:41.0851,longitude:29.0442});
 row=sql.prepare('SELECT latitude,longitude,presentation FROM listings WHERE id=?').get(id);
 assert.equal(response.status,200);assert.deepEqual(JSON.parse(row.presentation).location.exact,{lat:41.0851,lng:29.0442});assert.equal(JSON.parse(row.presentation).nearby,undefined);assert.deepEqual(scheduled,[id]);
 // Exact now: columns hold the pin.
 await patch({...base,latitude:41.0851,longitude:29.0442,locationPrecision:'exact'});
 row=sql.prepare('SELECT latitude,longitude,presentation FROM listings WHERE id=?').get(id);
 assert.equal(row.latitude,41.0851);assert.deepEqual(JSON.parse(row.presentation).location,{precision:'exact'});
 // A pin outside the province is refused; moving the listing to another province clears the stored pin.
 assert.equal((await patch({...base,latitude:36.88,longitude:30.70})).status,400);
 await patch({...base,city:'Antalya',district:'Muratpaşa'});
 row=sql.prepare('SELECT latitude,longitude,presentation FROM listings WHERE id=?').get(id);
 assert.equal(row.latitude,null);assert.equal(row.longitude,null);assert.equal(JSON.parse(row.presentation).location,undefined);
});

test('owner read returns the exact pin, other visitors only the public point',async()=>{
 const sql=schema(),user=seedUser(sql),scheduled=[],deps=routeDeps(sql,user,scheduled),create=load('app/api/listings/route.ts',deps);
 const {id}=await (await post(create,listingBody(user,{latitude:BEBEK.lat,longitude:BEBEK.lng}))).json();
 sql.prepare("UPDATE listings SET status='published'").run();
 const byId=async()=>parseListing({...sql.prepare('SELECT * FROM listings WHERE id=?').get(id),owner_name:'Owner'});
 for(const [viewer,own] of [[user,true],[{...user,id:crypto.randomUUID()},false],[null,false]]){
  const route=load('app/api/listings/[id]/route.ts',{...deps,'@/lib/server':{...deps['@/lib/server'],currentUser:async()=>viewer,listingById:byId}});
  const body=await (await route.GET(new Request('https://site.test/api/listings/'+id),{params:Promise.resolve({id})})).json();
  const text=JSON.stringify(body.listing);
  assert.ok(!text.includes(String(BEBEK.lat)),'listing payload never holds the exact pin');
  if(own)assert.deepEqual(body.pin,{latitude:BEBEK.lat,longitude:BEBEK.lng,precision:'approximate'});else assert.equal('pin' in body,false);
 }
});

const OVERPASS_FIXTURE={elements:[
 {type:'node',lat:41.0779,lon:29.0432,tags:{amenity:'school',name:'Bebek İlkokulu'}},
 {type:'way',center:{lat:41.0800,lon:29.0432},tags:{amenity:'school',name:'Uzak Lise'}},
 {type:'node',lat:41.0772,lon:29.0440,tags:{amenity:'pharmacy'}},
 {type:'node',lat:41.0773,lon:29.0442,tags:{amenity:'pharmacy',name:'Bebek Eczanesi'}},
 {type:'node',lat:41.0790,lon:29.0420,tags:{highway:'bus_stop',name:'Bebek'}},
 {type:'node',lat:41.0850,lon:29.0300,tags:{railway:'subway_entrance',name:'Etiler'}},
 {type:'node',lat:41.0690,lon:29.0300,tags:{railway:'station',name:'Tren'}},
 {type:'way',center:{lat:41.0760,lon:29.0450},tags:{leisure:'park',name:'Bebek Parkı'}},
 {type:'node',lat:41.0775,lon:29.0438,tags:{amenity:'place_of_worship',religion:'muslim',name:'Bebek Camii'}},
 {type:'node',lat:41.0776,lon:29.0438,tags:{amenity:'place_of_worship',religion:'christian',name:'Kilise'}},
 {type:'node',lat:41.2000,lon:29.0432,tags:{shop:'supermarket',name:'Çok uzak'}},
 {type:'way',geometry:[{lat:41.0770,lon:29.0460},{lat:41.0780,lon:29.0460},null],tags:{natural:'coastline'}},
 {type:'node',tags:{amenity:'hospital',name:'Konumsuz'}},
]};

test('Overpass answer → nearest place of each type within 2 km, with distances',()=>{
 assert.equal(nearby.nearbyType({tags:{railway:'tram_stop'}}),'tram');assert.equal(nearby.nearbyType({tags:{amenity:'ferry_terminal'}}),'ferry');assert.equal(nearby.nearbyType({tags:{shop:'bakery'}}),null);
 const items=nearby.parseOverpass(BEBEK.lat,BEBEK.lng,OVERPASS_FIXTURE.elements);
 const by=Object.fromEntries(items.map(i=>[i.type,i]));
 assert.deepEqual(items.map(i=>i.type),['school','pharmacy','metro','rail','bus','sea','park','mosque']);
 assert.equal(by.school.name,'Bebek İlkokulu');assert.ok(Math.abs(by.school.distanceM-87)<=2,String(by.school.distanceM));
 // A named pharmacy a few metres further wins over an unnamed one.
 assert.equal(by.pharmacy.name,'Bebek Eczanesi');
 // Coastline distance to the segment, without a name.
 assert.equal(by.sea.name,'');assert.ok(by.sea.distanceM>225&&by.sea.distanceM<245,String(by.sea.distanceM));
 assert.equal(by.supermarket,undefined);assert.equal(by.hospital,undefined);assert.equal(by.mosque.name,'Bebek Camii');
 assert.match(nearby.overpassQuery(41.1,29.05),/around:2000,41\.1,29\.05/);assert.match(nearby.overpassQuery(41.1,29.05),/out geom\(41\.08\d+,29\.02\d+,41\.11\d+,29\.07\d+\)/);
});

test('distance and walking time',()=>{
 assert.ok(Math.abs(loc.distanceMeters(41,29,42,29)-111195)<50);assert.equal(loc.distanceMeters(41,29,41,29),0);
 assert.equal(nearby.walkingMinutes(0),1);assert.equal(nearby.walkingMinutes(640),10);assert.equal(nearby.walkingMinutes(2000),31);
});

test('refresh decisions: missing, moved, older than 30 days, failed more than 6 hours ago',()=>{
 const now=Date.parse('2026-11-06T12:00:00Z'),at=days=>new Date(now-days*864e5).toISOString();
 const stored=(extra={})=>({fetchedAt:at(1),point:[41.077,29.043],radiusM:2000,approximate:true,items:[],...extra});
 assert.equal(nearby.nearbyNeedsRefresh(null,41.077,29.043,now),true);
 assert.equal(nearby.nearbyNeedsRefresh(stored(),41.077,29.043,now),false);
 assert.equal(nearby.nearbyNeedsRefresh(stored(),41.08,29.043,now),true);
 assert.equal(nearby.nearbyNeedsRefresh(stored({fetchedAt:at(29)}),41.077,29.043,now),false);
 assert.equal(nearby.nearbyNeedsRefresh(stored({fetchedAt:at(31)}),41.077,29.043,now),true);
 assert.equal(nearby.nearbyNeedsRefresh(stored({failed:true,fetchedAt:at(5/24)}),41.077,29.043,now),false);
 assert.equal(nearby.nearbyNeedsRefresh(stored({failed:true,fetchedAt:at(7/24)}),41.077,29.043,now),true);
 assert.equal(nearby.nearbyNeedsRefresh(stored({fetchedAt:'bad'}),41.077,29.043,now),true);
 assert.equal(nearby.storedNearby(stored(),41.09,29.043),null);assert.equal(nearby.storedNearby({items:'x'}),null);assert.ok(nearby.storedNearby(stored(),41.077,29.043));
});

test('lookups are stored once per location, shared by concurrent visitors and retried after failures',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE listings(id TEXT PRIMARY KEY,latitude REAL,longitude REAL,presentation TEXT)');
 const presentation={videoUrl:'',location:{precision:'approximate',exact:{lat:41.07712,lng:29.04321}}};
 sql.prepare('INSERT INTO listings VALUES(?,?,?,?)').run('a',41.079,29.046,JSON.stringify(presentation));
 sql.prepare('INSERT INTO listings VALUES(?,?,?,?)').run('none',null,null,'{}');
 const db=sqliteDb(sql),calls=[];let clock=Date.parse('2026-11-06T12:00:00Z'),answer=()=>Response.json(OVERPASS_FIXTURE);
 const fetch=async(url,init)=>{calls.push({url,init});return answer();};
 const options={fetch,endpoint:'https://overpass.test/api/interpreter',userAgent:'EstateMarket24/1.0 (+https://site.test/iletisim)',now:()=>new Date(clock)};
 const [one,two]=await Promise.all([nearby.refreshNearby(db,'a',options),nearby.refreshNearby(db,'a',options)]);
 assert.equal(calls.length,1);assert.equal(one,two);
 assert.equal(calls[0].url,'https://overpass.test/api/interpreter');assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.headers['User-Agent'],options.userAgent);
 // The query is built from the PUBLIC point, never the private exact pin.
 const body=decodeURIComponent(calls[0].init.body);assert.match(body,/around:2000,41\.079,29\.046/);assert.ok(!body.includes('41.07712'));
 let stored=JSON.parse(sql.prepare("SELECT presentation FROM listings WHERE id='a'").get().presentation);
 assert.equal(stored.nearby.approximate,true);assert.ok(stored.nearby.items.length>3);assert.deepEqual(stored.location,presentation.location,'private pin preserved');
 await nearby.refreshNearby(db,'a',options);assert.equal(calls.length,1,'cached');
 clock+=31*864e5;answer=()=>new Response('busy',{status:429});
 const failed=await nearby.refreshNearby(db,'a',options);assert.equal(calls.length,2);
 // Overpass down: the earlier good result is kept and retried in 6 hours.
 assert.ok(failed.items.length>3);assert.equal(nearby.nearbyNeedsRefresh(failed,41.079,29.046,clock),false);assert.equal(nearby.nearbyNeedsRefresh(failed,41.079,29.046,clock+7*3600e3),true);
 clock+=7*3600e3;answer=()=>{throw new TypeError('network down');};
 await nearby.refreshNearby(db,'a',options);assert.equal(calls.length,3);
 assert.equal(await nearby.refreshNearby(db,'none',options),null);assert.equal(calls.length,3);
 // A brand-new point that fails gets an empty "failed" marker.
 sql.prepare("UPDATE listings SET latitude=41.1, presentation='{}' WHERE id='a'").run();
 const empty=await nearby.refreshNearby(db,'a',options);assert.equal(empty.failed,true);assert.deepEqual(empty.items,[]);
 // Malformed answers count as failures too.
 answer=()=>Response.json({remark:'runtime error'});
 await assert.rejects(()=>nearby.fetchNearby(41,29,{approximate:false,fetch,endpoint:'https://overpass.test'}),/overpass_shape/);
});

test('map centre: Nominatim with our User-Agent, cached, spaced ≥1 s, province fallback',async()=>{
 const geo=load('lib/geocode.ts');geo.resetGeocodeCache();
 let clock=1_000_000;const waits=[],calls=[];
 const options={userAgent:'EstateMarket24/1.0 (+https://site.test/iletisim)',now:()=>clock,sleep:async ms=>{waits.push(ms);clock+=ms;},fetch:async(url,init)=>{calls.push({url,init});return Response.json(url.includes('Bebek')?[{lat:'41.0771',lon:'29.0432'}]:url.includes('Bodrum')?[{lat:'41.0',lon:'29.0'}]:[]);}};
 assert.deepEqual(await geo.mapCenter('İstanbul','Beşiktaş','Bebek',options),{lat:41.0771,lng:29.0432,zoom:15,source:'neighborhood'});
 assert.equal(calls[0].init.headers['User-Agent'],options.userAgent);
 const url=new URL(calls[0].url);assert.equal(url.origin+url.pathname,'https://nominatim.openstreetmap.org/search');assert.equal(url.searchParams.get('countrycodes'),'tr');assert.equal(url.searchParams.get('q'),'Bebek, Beşiktaş, İstanbul');
 await geo.mapCenter('İstanbul','Beşiktaş','Bebek',options);assert.equal(calls.length,1,'cached');
 // Unknown neighbourhood → district → province centroid; each request waits for its 1.1 s slot.
 const fallback=await geo.mapCenter('İstanbul','Şile','Yok',options);
 assert.equal(fallback.source,'province');assert.equal(calls.length,3);assert.ok(waits.length>=2&&waits.every(ms=>ms<=1100));
 // An answer outside the chosen province is ignored.
 assert.equal((await geo.mapCenter('Muğla','Bodrum','',options)).source,'province');
 assert.equal(geo.parseNominatim('İstanbul',[{lat:'36.9',lon:'30.7'}]),null);assert.equal(geo.parseNominatim('İstanbul','x'),null);
 // Nominatim errors fall back without throwing.
 geo.resetGeocodeCache();const down={...options,fetch:async()=>new Response('',{status:503})};
 assert.equal((await geo.mapCenter('İzmir','Urla','İskele',down)).source,'province');
 assert.equal(await geo.mapCenter('Bilinmeyen','X','',down),null);
});

test('map labels: compact price in the display currency, safe card images',()=>{
 const {compactMoney,mapImage}=load('lib/listing-map.ts');
 const label=compactMoney(12800000,'TRY','tr');assert.match(label,/₺/);assert.match(label,/12,8/);assert.ok(label.length<16,label);
 assert.match(compactMoney(250000,'EUR','en',true),/^⁨≈ €250K⁩$/);
 assert.equal(mapImage('/api/media/listings/u/1.webp'),'/api/media/listings/u/1.webp');assert.equal(mapImage('//evil.test/x.jpg'),null);assert.equal(mapImage('javascript:alert(1)'),null);assert.equal(mapImage('https://images.example.com/a.jpg'),'https://images.example.com/a.jpg');
});
