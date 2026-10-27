ALTER TABLE listings ADD COLUMN IF NOT EXISTS presentation text NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS appointments (id uuid PRIMARY KEY,listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot_at text NOT NULL,message text NOT NULL,status text NOT NULL DEFAULT 'requested',stage text NOT NULL DEFAULT 'new',private_note text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,created_at text NOT NULL,updated_at text NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_unique ON appointments(buyer_id,listing_id) WHERE status IN ('requested','confirmed');
CREATE INDEX IF NOT EXISTS appointments_buyer_idx ON appointments(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS appointments_seller_idx ON appointments(seller_id,created_at DESC);
