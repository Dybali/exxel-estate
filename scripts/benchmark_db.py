"""Local index smoke test with 1,000 accounts and 10,000 listings.

This measures SQLite query cost only. It is not an end-to-end load test for Sites.
"""
from pathlib import Path
import random
import sqlite3
import statistics
import time
import uuid

root = Path(__file__).resolve().parents[1]
connection = sqlite3.connect(":memory:")
for migration in sorted((root / "drizzle").glob("*.sql")):
    connection.executescript(migration.read_text(encoding="utf-8"))

users = [(str(uuid.uuid4()), f"user{i}@example.test", "hash", f"User {i}", "buyer", "none", "2026-10-13T00:00:00Z") for i in range(1000)]
connection.executemany("INSERT INTO users(id,email,password_hash,name,role,agent_status,created_at) VALUES(?,?,?,?,?,?,?)", users)
cities = ["İstanbul", "İzmir", "Muğla", "Antalya"]
types = ["daire", "villa", "mustakil", "rezidans"]
rows = []
for i in range(10000):
    rows.append((str(uuid.uuid4()), users[i % 1000][0], f"İlan {i}", "Açıklama", "satilik" if i % 3 else "kiralik", types[i % 4], random.randint(500_000, 90_000_000), "TRY", cities[i % 4], "Merkez", random.randint(60, 350), "[]", "[]", "published", "2026-10-13T00:00:00Z", "2026-10-13T00:00:00Z"))
connection.executemany("INSERT INTO listings(id,owner_id,title,description,purpose,property_type,price,currency,city,district,gross_area,amenities,images,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
query = "SELECT id,title,price FROM listings WHERE status='published' AND purpose=? AND property_type=? AND city=? AND price>=? AND price<=? ORDER BY price LIMIT 12"
values = ("satilik", "daire", "İstanbul", 1_000_000, 60_000_000)
plan = connection.execute("EXPLAIN QUERY PLAN " + query, values).fetchall()
durations = []
for _ in range(1000):
    start = time.perf_counter()
    connection.execute(query, values).fetchall()
    durations.append((time.perf_counter() - start) * 1000)
print({"users": len(users), "listings": len(rows), "index_plan": plan, "p50_ms": round(statistics.median(durations), 3), "p95_ms": round(sorted(durations)[949], 3)})
