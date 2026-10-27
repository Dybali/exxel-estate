import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

const base = process.env.API_TEST_BASE_URL || "http://127.0.0.1:4000";
const database = new PrismaClient();

test("health checks the live database", async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("public catalogue exposes only approved or labeled sample listings", async () => {
  const response = await fetch(`${base}/api/listings?page=1`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(Number.isInteger(data.total));
  assert.ok(data.listings.every((listing) => listing.status === "published" || listing.source === "demo"));
  const pending = await database.listings.findFirst({ where: { status: "pending" }, select: { id: true } });
  if (pending) {
    const detail = await fetch(`${base}/api/listings/${pending.id}`);
    assert.equal(detail.status, 404);
  }
});

test("protected routes reject anonymous access", async () => {
  for (const route of ["favorites", "messages", "mine"]) {
    const response = await fetch(`${base}/api/${route}`);
    assert.equal(response.status, 401);
  }
  const admin = await fetch(`${base}/api/admin`);
  assert.equal(admin.status, 403);
});

test("location catalogue includes Beşiktaş neighborhoods", async () => {
  const response = await fetch(`${base}/api/locations?city=${encodeURIComponent("İstanbul")}&district=${encodeURIComponent("Beşiktaş")}`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(data.neighborhoods.length > 10);
});

test("city counts include published listings only", async () => {
  const response = await fetch(`${base}/api/city-counts`);
  assert.equal(response.status, 200);
  const data = await response.json();
  const grouped = await database.listings.groupBy({ by: ["city"], where: { status: "published" }, _count: { id: true } });
  assert.deepEqual(Object.fromEntries(data.cities.map((item) => [item.city, item.count])), Object.fromEntries(grouped.map((item) => [item.city, item._count.id])));
});

test("company directory distinguishes approved firms from sample profiles", async () => {
  const response = await fetch(`${base}/api/companies?page=1`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(Number.isInteger(data.total));
  assert.ok(Array.isArray(data.companies));
  for (const company of data.companies) {
    assert.equal(company.listingCount, company.saleCount + company.rentCount);
    const detail = await fetch(`${base}/api/companies/${company.id}`);
    assert.equal(detail.status, 200);
    const profile = await detail.json();
    assert.equal(profile.company.listingCount, company.listingCount);
    assert.ok(profile.listings.every((listing) => company.sample ? listing.source === "demo" : listing.status === "published"));
  }
  const pending = await database.agencies.findFirst({ where: { status: { not: "approved" } }, select: { id: true } });
  if (pending) assert.equal((await fetch(`${base}/api/companies/${pending.id}`)).status, 404);
});

test("profile consent and favorite payload persist without granting listing ownership",async()=>{
  let id;
  try{
    const email=`feature-${randomBytes(8).toString("hex")}@example.invalid`,password=randomBytes(18).toString("hex");
    const registered=await fetch(`${base}/api/account`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"register",email,password,name:"Temporary API Test",role:"buyer"})});
    assert.equal(registered.status,201);id=(await registered.json()).user.id;
    const cookie=registered.headers.getSetCookie().map(value=>value.split(";")[0]).join("; ");
    const send=(path,method,data)=>fetch(`${base}/api${path}`,{method,headers:{cookie,"content-type":"application/json"},body:data?JSON.stringify(data):undefined});
    const profile=await send("/account","POST",{action:"update_profile",name:"Updated API Test",phone:"05551112233",whatsappEnabled:true,role:"admin"});assert.equal(profile.status,200);
    const saved=(await profile.json()).user;assert.equal(saved.role,"buyer");assert.equal(saved.phone,"+905551112233");assert.equal(saved.whatsapp_enabled,1);
    assert.equal((await send("/favorites","POST",{id:"ex-1001"})).status,200);
    const favorites=await (await send("/favorites","GET")).json();assert.ok(favorites.listings.some(item=>item.id==="ex-1001"));
    assert.equal((await send("/favorites","POST",{id:"invalid-id"})).status,404);
    const listing=await database.listings.findFirst({where:{status:"published"},select:{id:true}});
    if(listing)assert.equal((await send(`/listings/${listing.id}`,"PATCH",{price:1})).status,403);
    const optedOut=await send("/account","POST",{action:"update_profile",whatsappEnabled:false});assert.equal((await optedOut.json()).user.whatsapp_enabled,0);
  }finally{if(id){await database.favorites.deleteMany({where:{user_id:id}});await database.sessions.deleteMany({where:{user_id:id}});await database.users.delete({where:{id}});}}
});

test.after(async () => database.$disconnect());
