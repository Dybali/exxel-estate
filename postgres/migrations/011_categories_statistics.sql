ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_purpose_check;
ALTER TABLE listings ADD CONSTRAINT listings_purpose_check CHECK (purpose IN ('satilik','kiralik','gunluk','devren'));
CREATE TABLE IF NOT EXISTS listing_view_daily (listing_id TEXT NOT NULL,day TEXT NOT NULL,visitor_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(listing_id,day,visitor_hash));
CREATE INDEX IF NOT EXISTS favorites_listing_stats_idx ON favorites(listing_id);
