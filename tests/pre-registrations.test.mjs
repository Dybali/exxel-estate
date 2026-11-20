import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const mod=(file,replace=s=>s)=>import('data:text/javascript;base64,'+Buffer.from(ts.transpile(replace(readFileSync(new URL('../lib/'+file+'.ts',import.meta.url),'utf8')),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})).toString('base64'));
const P=await mod('pre-registrations');
const cities=await mod('landing-cities');
const hosts=await mod('landing-hosts',s=>s.replace('from "./landing-cities"',`from "data:text/javascript;base64,${Buffer.from(ts.transpile(readFileSync(new URL('../lib/landing-cities.ts',import.meta.url),'utf8'),{module:ts.ModuleKind.ES2022})).toString('base64')}"`));
const db=()=>{const sql=new DatabaseSync(':memory:');return {sql,prepare(q){let v=[];return {bind(...a){v=a;return this},async first(){return sql.prepare(q).get(...v)||null},async all(){return {results:sql.prepare(q).all(...v)}},async run(){return sql.prepare(q).run(...v)}}}};};
const agent=(extra={})=>({role:'agent',city:'adana',name:'Ayşe Yılmaz',company:'Yılmaz Emlak',phone:'0532 123 45 67',email:'Ayse@Example.com',district:'Seyhan',portfolio:'11–50',foreignSales:'Evet',package:'Premium',notice:true,marketing:true,utm_source:'google',utm_campaign:'adana-emlakci',...extra});
const owner=(extra={})=>({role:'owner',city:'izmir',name:'Can Demir',phone:'+49 151 2345 6789',email:'can@example.com',propertyType:'Villa',propertyCount:'1',purpose:'Satılık',timeline:'Hemen',notice:true,...extra});
const SLUGS=['adana','izmir'];
test('30 landing cities with images, credits and Turkish forms',()=>{
  assert.equal(cities.LANDING_CITIES.length,30);
  for(const c of cities.LANDING_CITIES){assert.match(c.image,/^https:\/\//);assert.ok(c.credit.license&&c.credit.source.startsWith('https://commons.wikimedia.org/'),c.slug);assert.ok(c.locative.includes('’')&&c.genitive.includes('’'),c.slug);}
  assert.equal(cities.landingCity('istanbul').genitive,'İstanbul’un');
});
test('subdomains map to their city, nothing else does',()=>{
  assert.equal(hosts.landingSlugForHost('adana.estatemarket24.com'),'adana');
  assert.equal(hosts.landingSlugForHost('Izmir.EstateMarket24.com:443'),'izmir');
  assert.equal(hosts.landingSlugForHost('estatemarket24.com'),null);
  assert.equal(hosts.landingSlugForHost('www.estatemarket24.com'),null);
  assert.equal(hosts.landingSlugForHost('paris.estatemarket24.com'),null);
  assert.equal(hosts.landingSlugForHost('adana.evil.example'),null);
  assert.equal(hosts.landingSlugForHost('a.b.adana.estatemarket24.com'),null);
  assert.equal(hosts.landingSlugForHost('van.test.example','test.example'),'van');
});
test('agents and owners are stored with only their own answers; consent and UTM are kept',async()=>{
  const d=db();
  assert.deepEqual(await P.savePreRegistration(d,agent(),SLUGS,'adana.estatemarket24.com').then(r=>[r.gift,r.updated]),[true,false]);
  await P.savePreRegistration(d,owner({portfolio:'200+'}),SLUGS,null);
  const {entries,counts}=await P.listPreRegistrations(d);
  assert.deepEqual(counts,{agent:1,owner:1});
  const a=entries.find(e=>e.role==='agent'),o=entries.find(e=>e.role==='owner');
  assert.equal(a.email,'ayse@example.com');assert.equal(a.phone,'05321234567');assert.equal(a.package,'Premium');assert.equal(a.marketing,true);assert.equal(a.utmCampaign,'adana-emlakci');assert.equal(a.host,'adana.estatemarket24.com');
  assert.equal(o.phone,'+4915123456789');assert.equal(o.portfolio,null,'agent-only answers are dropped for owners');assert.equal(o.propertyType,'Villa');assert.equal(o.marketing,false);assert.equal(o.gift,false);
});
test('invalid input is refused with a clear message',async()=>{
  const d=db();
  for(const [extra,re] of [[{notice:false},/Aydınlatma/],[{phone:'123'},/telefon/],[{email:'x@'},/e-posta/],[{company:''},/ofisinizin/],[{name:'A'},/soyadınızı/],[{city:'paris'},/kontrol/],[{role:'buyer'},/kontrol/]])
    await assert.rejects(P.savePreRegistration(d,agent(extra),SLUGS,null),e=>e instanceof P.PreRegistrationError&&re.test(e.message));
  await assert.rejects(P.savePreRegistration(d,agent({package:'Ücretsiz'}),SLUGS,null).then(async()=>{const {entries}=await P.listPreRegistrations(d);if(entries[0].package!==null)throw Error('unknown option stored');throw Error('ok');}),/ok/);
});
test('the same person registering again updates the entry and keeps the gift; the gift stops after 1000 agents',async()=>{
  const d=db();
  const first=await P.savePreRegistration(d,agent(),SLUGS,null);
  const again=await P.savePreRegistration(d,agent({phone:'0533 000 00 00',marketing:false}),SLUGS,null);
  assert.equal(again.id,first.id);assert.equal(again.updated,true);assert.equal(again.gift,true);
  assert.equal((await P.listPreRegistrations(d)).entries.length,1);
  d.sql.exec(`WITH RECURSIVE n(v) AS (SELECT 1 UNION ALL SELECT v+1 FROM n WHERE v<999) INSERT INTO pre_registrations(id,role,city,name,phone,email,notice_version,notice_at,gift,created_at,updated_at) SELECT 'g'||v,'agent','adana','X','05320000000','g'||v||'@x.com','v','t',1,'t','t' FROM n`);
  assert.equal((await P.savePreRegistration(d,agent({email:'late@example.com'}),SLUGS,null)).gift,false);
});
test('CSV opens in Excel and cannot run formulas',()=>{
  const csv=P.preRegistrationsCsv([{id:'1',role:'agent',city:'adana',name:'=HYPERLINK("x")',company:'A;B',phone:'+905321234567',email:'a@b.com',district:null,portfolio:null,foreignSales:null,package:null,propertyType:null,propertyCount:null,purpose:null,timeline:null,marketing:true,gift:false,source:null,utmSource:null,utmMedium:null,utmCampaign:null,host:null,createdAt:'2026-11-20',contactedAt:null}]);
  assert.ok(csv.startsWith('﻿Tarih;Tür;'));assert.match(csv,/"'=HYPERLINK\(""x""\)"/);assert.match(csv,/"A;B"/);assert.match(csv,/'\+905321234567/);assert.match(csv,/Emlakçı/);assert.match(csv,/;Evet;Hayır;/);
});
