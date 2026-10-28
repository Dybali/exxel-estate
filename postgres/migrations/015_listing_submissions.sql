CREATE TABLE IF NOT EXISTS listing_submissions (
 user_id TEXT NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
 listing_id TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,request_id)
);
