import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {S3Client,DeleteObjectCommand} from "@aws-sdk/client-s3";

// Disposable accounts in the local D1 database; R2 objects are removed on exit.
const base="http://127.0.0.1:8787",stamp=Date.now(),password="Local-Feature-Test-123456";
const accounts={},keys=[];
async function call(path,method="GET",body,cookie,extraHeaders={},retry=0){const response=await fetch(base+path,{method,headers:{connection:"close",...(body?{"content-type":"application/json"}:{}),...(cookie?{cookie}:{}),...extraHeaders},body:body?JSON.stringify(body):undefined});const text=await response.text();if(response.status===503&&text.includes("worker restarted")&&retry<1&&!(method==="POST"&&(path==="/api/listings"||body?.action==="register")))return call(path,method,body,cookie,extraHeaders,retry+1);let data;try{data=JSON.parse(text);}catch{throw new Error(`${method} ${path}: HTTP ${response.status}: ${text.slice(0,200)}`);}return {status:response.status,data,cookie:response.headers.get("set-cookie")?.split(";")[0]};}

async function upload(account){const form=new FormData();form.append("file",new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==","base64")],{type:"image/png"}),"test.png");const response=await fetch(base+"/api/media",{method:"POST",headers:{connection:"close",cookie:account.cookie},body:form});const data=await response.json();assert.equal(response.status,201,JSON.stringify(data));keys.push(data.url.slice("/api/media/".length));return data.url;}
try{
  for(const [name,role] of [["agent","agent"],["owner","individual"],["buyer","buyer"],["other","buyer"]]){const email=`feature-${name}-${stamp}@example.test`;const result=await call("/api/account","POST",{action:"register",name:`Feature ${name}`,email,password,role,company:role==="agent"?"Local Feature Agency":undefined});assert.equal(result.status,201,JSON.stringify(result.data));accounts[name]={...result.data.user,email,cookie:result.cookie};}
  const buyer=accounts.buyer,agent=accounts.agent;
  assert.equal((await call("/api/account","POST",{action:"update_profile",name:"No Auth"})).status,401);
  assert.equal((await call("/api/account","POST",{action:"update_profile",phone:"bad",whatsappEnabled:true},buyer.cookie)).status,400);
  let result=await call("/api/account","POST",{action:"update_profile",name:"Updated Buyer",phone:"05551112233",whatsappEnabled:true,role:"admin"},buyer.cookie);
  assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.user.role,"buyer");assert.equal(result.data.user.phone,"+905551112233");assert.equal(result.data.user.whatsapp_enabled,1);
  assert.equal((await call("/api/listings","POST",{},agent.cookie)).status,403);
  const localAdmin=JSON.parse(await readFile("work/feature-admin.json","utf8"));assert.equal((await call("/api/admin","POST",{kind:"agent",id:agent.id,status:"approved"},localAdmin.cookie)).status,200);
  const locations=await call("/api/locations?city=%C4%B0stanbul&district=Kad%C4%B1k%C3%B6y");const neighborhoodId=locations.data.neighborhoods[0].id;
  const image=await upload(agent);
  const payload={title:"Yerel güvenlik testi için daire ilanı",description:"Bu geçici ilan yalnızca yerel hesap ve ilan yönetimi testleri için oluşturulmuştur.",purpose:"satilik",propertyType:"daire",price:2500000,currency:"TRY",city:"İstanbul",district:"Kadıköy",neighborhoodId,grossArea:120,netArea:100,bedrooms:3,bathrooms:2,floor:3,totalFloors:6,images:[image],amenities:["Balkon"]};
  result=await call("/api/listings","POST",payload,agent.cookie);assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.status,"published");const listingId=result.data.id;
  let listing=(await call(`/api/listings/${listingId}`)).data.listing;assert.equal(listing.totalFloors,6);
  assert.equal((await call(`/api/listings/${listingId}`,"PATCH",{price:3000000},accounts.other.cookie)).status,403);
  assert.equal((await call(`/api/listings/${listingId}`,"PATCH",{price:3000000})).status,401);
  assert.equal((await call(`/api/listings/${listingId}`,"PATCH",{price:-5},agent.cookie)).status,400);
  result=await call(`/api/listings/${listingId}`,"PATCH",{price:3000000,expectedUpdatedAt:listing.updatedAt},agent.cookie);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.status,"published");
  assert.equal((await call(`/api/listings/${listingId}`,"PATCH",{price:4000000,expectedUpdatedAt:listing.updatedAt},agent.cookie)).status,409);
  listing=(await call(`/api/listings/${listingId}`)).data.listing;assert.equal(listing.price,3000000);assert.equal(listing.totalFloors,6);assert.equal(listing.bedrooms,3);assert.equal(listing.floor,3);assert.equal(listing.title,payload.title);
  result=await call(`/api/listings/${listingId}`,"PATCH",{...payload,price:3200000,title:"Güncellenmiş yerel test dairesi ilanı",expectedUpdatedAt:listing.updatedAt},agent.cookie);assert.equal(result.status,200,JSON.stringify(result.data));
  const ownerImage=await upload(accounts.owner);result=await call("/api/listings","POST",{...payload,images:[ownerImage]},accounts.owner.cookie);assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.status,"pending");const pendingId=result.data.id;assert.equal((await call(`/api/listings/${pendingId}`)).status,404);assert.equal((await call(`/api/listings/${pendingId}`,"GET",undefined,accounts.owner.cookie)).status,200);assert.equal((await call(`/api/listings/${pendingId}`,"PATCH",{price:3500000},accounts.owner.cookie)).data.status,"pending");
  assert.equal((await call("/api/favorites","POST",{id:listingId},buyer.cookie)).status,200);assert.equal((await call("/api/favorites","POST",{id:"ex-1001"},buyer.cookie)).status,200);assert.equal((await call("/api/favorites","POST",{id:pendingId},buyer.cookie)).status,404);
  result=await call("/api/favorites","GET",undefined,buyer.cookie);assert.equal(result.data.listings.find(item=>item.id===listingId)?.price,3200000);assert.ok(result.data.listings.some(item=>item.id==="ex-1001"));
  assert.equal((await call(`/api/listings/${listingId}/contact`)).status,401);
  await call("/api/account","POST",{action:"update_profile",phone:"+905559998877",whatsappEnabled:true},agent.cookie);result=await call(`/api/listings/${listingId}/contact`,"GET",undefined,buyer.cookie);assert.equal(result.data.seller.whatsappEnabled,true);assert.equal(result.data.seller.phone,"+905559998877");
  await call("/api/account","POST",{action:"update_profile",whatsappEnabled:false},agent.cookie);assert.equal((await call(`/api/listings/${listingId}/contact`,"GET",undefined,buyer.cookie)).data.seller.whatsappEnabled,false);
  result=await call("/api/messages","POST",{listingId,peerId:agent.id,message:"Merhaba, yerel test görüşmesi."},buyer.cookie);assert.ok(result.status===200||result.status===201,JSON.stringify(result.data));
  result=await call("/api/messages","GET",undefined,agent.cookie);assert.equal(result.data.conversations.find(item=>item.peer_id===buyer.id)?.peer_whatsapp_phone,"+905551112233");
  await call("/api/account","POST",{action:"update_profile",whatsappEnabled:false},buyer.cookie);result=await call("/api/messages","GET",undefined,agent.cookie);assert.equal(result.data.conversations.find(item=>item.peer_id===buyer.id)?.peer_whatsapp_phone,null);
  assert.equal((await call(`/api/favorites?id=${listingId}`,"DELETE",undefined,buyer.cookie)).status,200);assert.ok(!(await call("/api/favorites","GET",undefined,buyer.cookie)).data.ids.includes(listingId));
  assert.equal((await call("/api/account","POST",{action:"update_profile",name:"CSRF"},buyer.cookie,{origin:"https://untrusted.example"})).status,403);
  await writeFile("work/feature-fixture.json",JSON.stringify({accounts,password,listingId,pendingId,keys},null,2));
  console.log("PASS: profile persistence, phone validation, role protection, approved-agent publication, individual moderation, ownership guards, full edits, price preservation, stale-write rejection, real/demo favorites, authenticated contact and WhatsApp opt-in/out in conversations.");
}finally{
  if(process.env.KEEP_FEATURE_FIXTURE!=="1"){
    const secrets=Object.fromEntries((await readFile("work/integration-secrets.env","utf8")).split(/\r?\n/).filter(line=>/^[A-Z0-9_]+=/.test(line)).map(line=>[line.slice(0,line.indexOf("=")),line.slice(line.indexOf("=")+1).trim().replace(/^['"]|['"]$/g,"")]));
    const s3=new S3Client({region:"auto",endpoint:secrets.R2_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:secrets.R2_ACCESS_KEY_ID,secretAccessKey:secrets.R2_SECRET_ACCESS_KEY}});
    for(const key of keys)await s3.send(new DeleteObjectCommand({Bucket:secrets.R2_BUCKET_NAME,Key:key}));

  }
}
