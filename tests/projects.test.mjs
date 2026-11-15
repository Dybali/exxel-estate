import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import ts from 'typescript';
const transpile=p=>ts.transpile(readFileSync(new URL('../lib/'+p+'.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const details=url(transpile('listing-details').replace("'./property-categories'",JSON.stringify(url(transpile('property-categories')))));
const stubs={'"./listing-details"':details,'"./phone"':url(transpile('phone')),'"./listings"':'data:text/javascript,'+encodeURIComponent("export const AMENITIES=['Havuz','Otopark','Güvenlik'];"),'"./turkey-locations"':'data:text/javascript,'+encodeURIComponent("export const validDistrict=(c,d)=>c==='Muğla'&&d==='Bodrum'||c==='İzmir'&&d==='Urla';")};
let code=transpile('projects');for(const [from,to] of Object.entries(stubs)){assert.ok(code.includes(from),from);code=code.replace(from,JSON.stringify(to));}
const P=await import(url(code));

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
const photo=(user=owner)=>`/api/media/listings/${user}/${crypto.randomUUID()}.webp`;
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE users(id TEXT,name TEXT,company TEXT,role TEXT,agent_status TEXT);CREATE TABLE office_verifications(user_id TEXT,state TEXT);CREATE TABLE property_images(object_key TEXT)");
 sql.prepare("INSERT INTO users VALUES(?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?)").run(owner,'Ayşe','Deniz İnşaat','agent','approved',other,'Can','','agent','approved',admin,'Admin','','admin','approved');
 sql.prepare("INSERT INTO office_verifications VALUES(?,'approved')").run(owner);
 const db={prepare(q){let values=[];return {bind(...v){values=v;return this},async first(){return sql.prepare(q).get(...values)||null},async all(){return {results:sql.prepare(q).all(...values)}},async run(){return sql.prepare(q).run(...values)}}}};
 return {sql,db};
}
const valid=(user=owner,extra={})=>({name:'Deniz Konakları',description:'Bodrum merkezde deniz manzaralı, havuzlu ve güvenlikli yeni bir konut projesi.',city:'Muğla',district:'Bodrum',status:'ongoing',deliveryDate:'2027-06',totalUnits:'48',
 unitTypes:[{rooms:'2+1',minArea:'90',maxArea:'110',priceFrom:'7500000',currency:'TRY'},{rooms:'3+1',minArea:130,maxArea:150,priceFrom:250000,currency:'EUR'}],amenities:['Havuz','Güvenlik'],images:[photo(user)],website:'https://example.com/proje',...extra});
const person={name:'Mehmet Yılmaz',phone:'0532 123 45 67',email:'Mehmet@Example.com',unitType:'2+1',message:'Deniz manzaralı daire istiyorum.',consent:true};
const rejects=(promise,status,pattern)=>assert.rejects(promise,e=>e instanceof P.ProjectError&&e.status===status&&(!pattern||pattern.test(e.message)));

test('validation rejects unknown values, bad lengths, foreign photos and invalid unit types',async()=>{
 const {sql,db}=fixture();try{
  const me={id:owner,admin:false};
  await rejects(P.createProject(db,me,valid(owner,{name:'Kısa'})),400,/Proje adı/);
  await rejects(P.createProject(db,me,valid(owner,{description:'çok kısa'})),400,/açıklaması/);
  await rejects(P.createProject(db,me,valid(owner,{city:'Muğla',district:'Urla'})),400,/il ve ilçe/);
  await rejects(P.createProject(db,me,valid(owner,{status:'planned'})),400,/durumunu/);
  await rejects(P.createProject(db,me,valid(owner,{deliveryDate:'2027-13'})),400,/Teslim/);
  await rejects(P.createProject(db,me,valid(owner,{amenities:['Havuz','Helipad']})),400,/Özellik/);
  await rejects(P.createProject(db,me,valid(owner,{images:[photo(other)]})),403);
  await rejects(P.createProject(db,me,valid(owner,{images:['https://evil.test/x.jpg']})),403);
  await rejects(P.createProject(db,me,valid(owner,{images:[]})),400,/fotoğraf/);
  await rejects(P.createProject(db,me,valid(owner,{website:'http://example.com'})),400,/https/);
  await rejects(P.createProject(db,me,valid(owner,{unitTypes:[]})),400,/konut tipi/);
  await rejects(P.createProject(db,me,valid(owner,{unitTypes:[{rooms:'üç oda',minArea:1,maxArea:2,priceFrom:1,currency:'TRY'}]})),400,/Oda/);
  await rejects(P.createProject(db,me,valid(owner,{unitTypes:[{rooms:'2+1',minArea:120,maxArea:100,priceFrom:1,currency:'TRY'}]})),400,/metrekare/);
  await rejects(P.createProject(db,me,valid(owner,{unitTypes:[{rooms:'2+1',minArea:100,maxArea:120,priceFrom:1.5,currency:'TRY'}]})),400,/fiyat/);
  await rejects(P.createProject(db,me,valid(owner,{unitTypes:[{rooms:'2+1',minArea:100,maxArea:120,priceFrom:1,currency:'JPY'}]})),400,/para birimi/);
  await rejects(P.createProject(db,me,valid(owner,{unitTypes:[{rooms:'2+1',minArea:100,maxArea:120,priceFrom:1,currency:'TRY'},{rooms:'2+1',minArea:100,maxArea:120,priceFrom:2,currency:'TRY'}]})),400,/bir kez/);
  const used=photo();sql.prepare('INSERT INTO property_images VALUES(?)').run(used.slice('/api/media/'.length));
  await rejects(P.createProject(db,me,valid(owner,{images:[used]})),409);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM projects').get().n,0);
 }finally{sql.close()}
});

test('new projects wait for review and only approved ones are public',async()=>{
 const {sql,db}=fixture();try{
  const created=await P.createProject(db,{id:owner,admin:false},valid());
  assert.equal(created.moderation,'pending');
  assert.equal((await P.publicProjects(db)).total,0);
  assert.equal(await P.projectById(db,created.id),null);
  assert.equal(await P.projectById(db,created.id,{id:other,admin:false}),null);
  assert.equal((await P.projectById(db,created.id,{id:owner,admin:false})).moderation,'pending');
  const image=(await P.projectById(db,created.id,{id:owner,admin:false})).images[0].slice('/api/media/'.length);
  assert.equal(await P.projectMediaPublic(db,image),false);
  assert.deepEqual((await P.adminPendingProjects(db)).map(p=>p.id),[created.id]);
  await rejects(P.reviewProject(db,admin,created.id,'rejected',''),400,/Reddetme/);
  await rejects(P.reviewProject(db,admin,created.id,'published','ok'),400);
  await P.reviewProject(db,admin,created.id,'approved','');
  const listed=await P.publicProjects(db);
  assert.equal(listed.total,1);assert.equal(listed.projects[0].ownerName,'Deniz İnşaat');assert.equal(listed.projects[0].ownerVerified,true);assert.equal(listed.projects[0].reviewNote,undefined);
  assert.equal(await P.projectMediaPublic(db,image),true);
  assert.equal((await P.publicProjects(db,{city:'İzmir'})).total,0);
  assert.equal((await P.publicProjects(db,{status:'completed'})).total,0);
  assert.equal((await P.publicProjects(db,{rooms:'3+1'})).total,1);
  assert.equal((await P.publicProjects(db,{rooms:'4+1'})).total,0);
  assert.equal((await P.publicProjects(db,{maxPrice:'8000000'})).total,1);
  assert.equal((await P.publicProjects(db,{maxPrice:'7000000'})).total,0);
  assert.equal((await P.publicProjects(db,{maxPrice:'300000',currency:'EUR'})).total,1);
  assert.equal((await P.publicProjects(db,{maxPrice:'8000000',rooms:'3+1'})).total,0);
  assert.deepEqual(P.priceFrom(listed.projects[0]),[{currency:'TRY',amount:7500000},{currency:'EUR',amount:250000}]);
  const byAdmin=await P.createProject(db,{id:admin,admin:true},valid(admin));
  assert.equal(byAdmin.moderation,'approved');
 }finally{sql.close()}
});

test('only the owner or an administrator can edit or delete; owner edits go back to review',async()=>{
 const {sql,db}=fixture();try{
  const {id}=await P.createProject(db,{id:owner,admin:false},valid());
  await P.reviewProject(db,admin,id,'approved','');
  await rejects(P.updateProject(db,{id:other,admin:false},id,{name:'Başkasının projesi'}),403);
  await rejects(P.deleteProject(db,{id:other,admin:false},id),403);
  await rejects(P.updateProject(db,{id:owner,admin:false},'not-a-uuid',{name:'Yeni ad burada'}),404);
  const oldImage=(await P.projectById(db,id)).images[0],newImage=photo();
  const edited=await P.updateProject(db,{id:owner,admin:false},id,{name:'Deniz Konakları 2. Etap',images:[newImage]});
  assert.equal(edited.moderation,'pending');assert.deepEqual(edited.removedKeys,[oldImage.slice('/api/media/'.length)]);assert.deepEqual(edited.addedKeys,[newImage.slice('/api/media/'.length)]);
  assert.equal(await P.projectById(db,id),null);
  const stored=await P.projectById(db,id,{id:owner,admin:false});assert.equal(stored.name,'Deniz Konakları 2. Etap');assert.equal(stored.district,'Bodrum');
  await P.reviewProject(db,admin,id,'rejected','Fotoğraflar eksik.');
  assert.equal((await P.ownerProjects(db,owner))[0].reviewNote,'Fotoğraflar eksik.');
  await P.updateProject(db,{id:admin,admin:true},id,{status:'completed'});
  assert.equal((await P.projectById(db,id,{id:admin,admin:true})).moderation,'rejected');
  await rejects(P.updateProject(db,{id:admin,admin:true},id,{images:[photo(admin)]}),403);
  const removed=await P.deleteProject(db,{id:owner,admin:false},id);
  assert.deepEqual(removed.imageKeys,[newImage.slice('/api/media/'.length)]);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM projects').get().n,0);
 }finally{sql.close()}
});

test('reservations target approved projects and real unit types, with a daily limit',async()=>{
 const {sql,db}=fixture();try{
  const {id}=await P.createProject(db,{id:owner,admin:false},valid());
  await rejects(P.createReservation(db,id,person,null),404);
  await P.reviewProject(db,admin,id,'approved','');
  await rejects(P.createReservation(db,id,{...person,unitType:'5+1'}),400,/konut tipi/);
  await rejects(P.createReservation(db,id,{...person,phone:'12'}),400,/telefon/);
  await rejects(P.createReservation(db,id,{...person,email:'not-mail'}),400,/e-posta/);
  await rejects(P.createReservation(db,id,{...person,message:'x'.repeat(1001)}),400,/1000/);
  await rejects(P.createReservation(db,id,{...person,consent:false}),400,/onaylayın/);
  const at=new Date('2026-10-30T10:00:00Z');
  const first=await P.createReservation(db,id,person,other,at);
  assert.equal(first.ownerId,owner);assert.equal(first.projectName,'Deniz Konakları');
  const row=sql.prepare('SELECT * FROM project_reservations WHERE id=?').get(first.id);
  assert.equal(row.email,'mehmet@example.com');assert.equal(row.phone,'+905321234567');assert.equal(row.user_id,other);assert.equal(row.status,'new');
  for(let i=0;i<4;i++)await P.createReservation(db,id,{...person,email:'MEHMET@example.com'},null,new Date(at.getTime()+i*60000));
  await rejects(P.createReservation(db,id,person,null,new Date(at.getTime()+3600000)),429);
  await P.createReservation(db,id,{...person,email:'baska@example.com'},null,new Date(at.getTime()+3600000));
  await P.createReservation(db,id,person,null,new Date(at.getTime()+86400000+60000));
  assert.equal((await P.ownerReservations(db,owner)).length,7);
  assert.equal((await P.ownerReservations(db,other)).length,0);
  const counts=(await P.ownerProjects(db,owner))[0];assert.equal(counts.reservations,7);assert.equal(counts.newReservations,7);
 }finally{sql.close()}
});

test('reservation status changes are limited to the owner and known statuses',async()=>{
 const {sql,db}=fixture();try{
  const {id}=await P.createProject(db,{id:owner,admin:false},valid());
  await P.reviewProject(db,admin,id,'approved','');
  const request=await P.createReservation(db,id,person,null);
  await rejects(P.updateReservationStatus(db,owner,request.id,'paid'),400);
  await rejects(P.updateReservationStatus(db,other,request.id,'reserved'),404);
  assert.deepEqual(await P.updateReservationStatus(db,owner,request.id,'reserved'),{id:request.id,status:'reserved'});
  assert.equal((await P.ownerReservations(db,owner))[0].status,'reserved');
  assert.equal((await P.ownerProjects(db,owner))[0].newReservations,0);
  await P.deleteProject(db,{id:owner,admin:false},id);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM project_reservations').get().n,0);
 }finally{sql.close()}
});

test('sitemap lists approved projects only, newest first',async()=>{
 const {sql,db}=fixture();try{
  const pending=await P.createProject(db,{id:owner,admin:false},valid());
  assert.deepEqual(await P.projectSitemapEntries(db),[]);
  const approved=await P.createProject(db,{id:admin,admin:true},valid(admin));
  const rows=await P.projectSitemapEntries(db);
  assert.deepEqual(rows.map(r=>r.path),['/projeler/'+approved.id]);assert.ok(Number.isFinite(Date.parse(rows[0].updatedAt)));
  assert.ok(!rows.some(r=>r.path.endsWith(pending.id)));
  const source=readFileSync(new URL('../app/sitemap.ts',import.meta.url),'utf8');
  assert.match(source,/projectSitemapEntries\(projectsDB\(\)\)/);assert.doesNotMatch(source,/"\/asistan"/);
 }finally{sql.close()}
});
