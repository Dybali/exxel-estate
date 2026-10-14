import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const base = process.env.API_TEST_BASE_URL || "http://127.0.0.1:4000";
const database = new PrismaClient();

test("health checks the live database", async () => {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("public catalogue exposes only approved listings", async () => {
  const response = await fetch(`${base}/api/listings?page=1`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.ok(Number.isInteger(data.total));
  assert.ok(data.listings.every((listing) => listing.status === "published"));
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

test.after(async () => database.$disconnect());
