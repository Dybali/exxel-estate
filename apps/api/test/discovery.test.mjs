import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import {PrismaClient} from "@prisma/client";
import {randomUUID} from "node:crypto";
const base=process.env.API_TEST_BASE_URL||"http://127.0.0.1:4000";
const db=new PrismaClient();
async function call(path,method="GET",data,cookie,headers={},retry=0){const r=await fetch(base+"/api/"+path,{method,headers:{...(data?{"content-type":"application/json"}:{}),...(cookie?{cookie}:{}),...headers},body:data?JSON.stringify(data):undefined});const text=await r.text();if(r.status===503&&text.includes("worker restarted")&&retry<1&&data?.action!=="register")return call(path,method,data,cookie,headers,retry+1);return {status:r.status,data:JSON.parse(text),cookie:r.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ")};}
test("account searches, publication alerts, price drops, privacy and map bounds",async()=>{
 const ids=[],listingId=randomUUID(),stamp=Date.now();
 try{
  assert.equal((await call("discovery")).status,401);
  const first=await call("account","POST",{action:"register",name:"Discovery Test",email:`discovery-${stamp}@example.test`,password:`Test-${stamp}-Password!`,role:"agent",company:"Temporary QA"});assert.equal(first.status,201);ids.push(first.data.user.id);const cookie=first.cookie,owner=ids[0];
  const second=await call("account","POST",{action:"register",name:"Other Test",email:`discovery-other-${stamp}@example.test`,password:`Test-${stamp}-Password!`,role:"buyer"});assert.equal(second.status,201);ids.push(second.data.user.id);
  assert.equal((await call("discovery","POST",{action:"save",name:"İstanbul",query:"city=%C4%B0stanbul&type=daire&minArea=80&amenities=Balkon"},cookie)).status,200);
  let feed=(await call("discovery","GET",undefined,cookie)).data;assert.equal(feed.searches.length,1);const savedId=feed.searches[0].id;
  assert.equal((await call("discovery","GET",undefined,second.cookie)).data.searches.length,0);
  assert.equal((await call("discovery","POST",{action:"delete",id:savedId},second.cookie)).status,404);
  assert.equal((await call("discovery","POST",{action:"save",name:"CSRF",query:""},cookie,{origin:"https://untrusted.example"})).status,403);
  await call("discovery","POST",{action:"save",name:"Renamed search",query:"amenities=Balkon&minArea=80&type=daire&city=%C4%B0stanbul"},cookie);feed=(await call("discovery","GET",undefined,cookie)).data;assert.equal(feed.searches.length,1);assert.equal(feed.searches[0].name,"Renamed search");
  const created=new Date().toISOString();
  await db.users.update({where:{id:owner},data:{agent_status:"approved"}});
  await db.listings.create({data:{id:listingId,owner_id:owner,title:"Temporary discovery integration listing",description:"Temporary listing for automated integration verification only.",purpose:"satilik",property_type:"daire",price:10000000n,currency:"TRY",city:"İstanbul",district:"Kadıköy",gross_area:100,amenities:'["Balkon"]',images:JSON.stringify([`/api/media/listings/${owner}/${randomUUID()}.jpg`]),translations:"{}",status:"pending",featured:0,furnished:0,latitude:41,longitude:29,created_at:created,updated_at:created}});
  assert.equal((await call("discovery","GET",undefined,cookie)).data.unread,0);
  await db.listings.update({where:{id:listingId},data:{status:"published",published_at:new Date().toISOString()}});
  feed=(await call("discovery","GET",undefined,cookie)).data;assert.equal(feed.alerts.filter(a=>a.kind==="search").length,1);assert.equal(feed.alerts[0].count,1);
  assert.equal((await call("favorites","POST",{id:listingId},cookie)).status,200);
  assert.equal((await call(`listings/${listingId}`,"PATCH",{price:9000000},cookie)).status,200);
  feed=(await call("discovery","GET",undefined,cookie)).data;let prices=feed.alerts.filter(a=>a.kind==="price");assert.equal(prices.length,1);assert.equal(prices[0].oldPrice,10000000);assert.equal(prices[0].newPrice,9000000);
  await call("discovery","POST",{action:"read",checkedAt:feed.checkedAt},cookie);assert.equal((await call("discovery","GET",undefined,cookie)).data.unread,0);
  await call(`listings/${listingId}`,"PATCH",{price:9500000},cookie);assert.equal((await call("discovery","GET",undefined,cookie)).data.unread,0);
  await call(`listings/${listingId}`,"PATCH",{price:8000000,currency:"EUR"},cookie);assert.equal((await call("discovery","GET",undefined,cookie)).data.unread,0);
  await call("discovery","POST",{action:"price_preference",enabled:false},cookie);await call(`listings/${listingId}`,"PATCH",{price:7000000},cookie);assert.equal((await call("discovery","GET",undefined,cookie)).data.alerts.filter(a=>a.kind==="price").length,0);
  const bounded=(await call("listings?bounds=28.99,40.99,29.01,41.01&map=1")).data;assert.ok(bounded.listings.some(l=>l.id===listingId));assert.ok(bounded.listings.every(l=>l.latitude>=40.99&&l.latitude<=41.01&&l.longitude>=28.99&&l.longitude<=29.01));
  assert.ok(!(await call("listings?bounds=30,36,31,37")).data.listings.some(l=>l.id===listingId));
  await db.listings.update({where:{id:listingId},data:{latitude:null,longitude:null}});
  const province=(await call("listings?map=1")).data.listings.find(l=>l.id===listingId);assert.equal(province.locationPrecision,"province");assert.ok(Number.isFinite(province.latitude)&&Number.isFinite(province.longitude));
  const approximate=(await call(`listings?bounds=${province.longitude-.01},${province.latitude-.01},${province.longitude+.01},${province.latitude+.01}`)).data;assert.ok(approximate.listings.some(l=>l.id===listingId));
  assert.equal((await call("discovery","POST",{action:"save",name:"Invalid",query:"x".repeat(3001)},cookie)).status,400);
  assert.equal((await call("discovery","POST",{action:"delete",id:"-".repeat(36)},cookie)).status,400);
  for(let n=0;n<9;n++)assert.equal((await call("discovery","POST",{action:"save",name:`Search ${n}`,query:`minPrice=${n+1}`},cookie)).status,200);
  assert.equal((await call("discovery","POST",{action:"save",name:"Over limit",query:"minPrice=9999"},cookie)).status,409);
  await call("discovery","POST",{action:"delete",id:savedId},cookie);assert.equal((await call("discovery","GET",undefined,cookie)).data.searches.length,9);
 }finally{await db.listings.deleteMany({where:{id:listingId}});await db.agencies.deleteMany({where:{owner_id:{in:ids}}});await db.favorites.deleteMany({where:{user_id:{in:ids}}});await db.users.deleteMany({where:{id:{in:ids}}});await db.$disconnect();}
});
