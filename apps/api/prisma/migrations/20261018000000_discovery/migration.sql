ALTER TABLE listings ADD COLUMN IF NOT EXISTS published_at text;
UPDATE listings SET published_at=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') WHERE status='published' AND published_at IS NULL;
CREATE INDEX IF NOT EXISTS listings_published_at_idx ON listings(status,published_at);
CREATE TABLE IF NOT EXISTS saved_searches(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,name text NOT NULL,query text NOT NULL,enabled integer NOT NULL DEFAULT 1,created_at text NOT NULL,seen_at text NOT NULL,UNIQUE(user_id,query));
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON saved_searches(user_id);
CREATE TABLE IF NOT EXISTS discovery_preferences(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,price_seen_at text NOT NULL,price_enabled integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS price_history(id uuid PRIMARY KEY,listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,old_price bigint NOT NULL,new_price bigint NOT NULL,currency text NOT NULL,purpose text NOT NULL,changed_at text NOT NULL);
CREATE INDEX IF NOT EXISTS price_history_listing_idx ON price_history(listing_id,changed_at);
