-- Exxel Estate production schema. IDs and media object keys survive website redesigns.
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, email text NOT NULL UNIQUE, password_hash text NOT NULL,
  email_verified integer NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
  name text NOT NULL, phone text, whatsapp_enabled integer NOT NULL DEFAULT 0 CHECK (whatsapp_enabled IN (0,1)),
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','individual','agent','admin')),
  agent_status text NOT NULL DEFAULT 'none' CHECK (agent_status IN ('none','pending','approved','rejected')),
  company text, avatar_url text, created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider text NOT NULL, provider_user_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at text NOT NULL,
  PRIMARY KEY(provider,provider_user_id), UNIQUE(user_id,provider)
);
CREATE TABLE IF NOT EXISTS oauth_flows (
  state_hash text PRIMARY KEY, code_verifier text NOT NULL, role text NOT NULL,
  next_path text NOT NULL, link_user_id uuid, expires_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_flows_expiry_idx ON oauth_flows(expires_at);
CREATE TABLE IF NOT EXISTS auth_limits (
  key text PRIMARY KEY, failures integer NOT NULL DEFAULT 0, window_started_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_setup (
  id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), completed_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS agencies (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), name text NOT NULL,
  phone text, email text, category text NOT NULL DEFAULT 'agency', status text NOT NULL DEFAULT 'pending', created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS agencies_owner_idx ON agencies(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS agencies_owner_unique ON agencies(owner_id);
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), agency_id uuid REFERENCES agencies(id),
  title text NOT NULL, description text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('satilik','kiralik','gunluk','devren')),
  property_type text NOT NULL, price bigint NOT NULL CHECK (price>0),
  currency text NOT NULL DEFAULT 'TRY', city text NOT NULL, district text NOT NULL,
  neighborhood text, neighborhood_id integer, postal_code text,
  latitude double precision, longitude double precision,
  gross_area integer NOT NULL CHECK (gross_area>0), net_area integer, rooms text,
  bedrooms integer, bathrooms integer, building_age integer, floor integer,
  total_floors integer, heating text, furnished integer NOT NULL DEFAULT 0 CHECK (furnished IN (0,1)),
  amenities text NOT NULL DEFAULT '[]', images text NOT NULL DEFAULT '[]',
  translations text NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','published','rejected','withdrawn')),
  review_note text, reviewed_by uuid REFERENCES users(id), reviewed_at text,
  featured integer NOT NULL DEFAULT 0 CHECK (featured IN (0,1)),
  created_at text NOT NULL, updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS listings_search_idx ON listings(status,purpose,property_type,city,price);
CREATE INDEX IF NOT EXISTS listings_location_idx ON listings(status,city,district);
CREATE INDEX IF NOT EXISTS listings_recent_idx ON listings(status,created_at DESC);
CREATE INDEX IF NOT EXISTS listings_owner_idx ON listings(owner_id);
CREATE TABLE IF NOT EXISTS property_images (
  id uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  storage_provider text NOT NULL DEFAULT 'r2', bucket text NOT NULL,
  object_key text NOT NULL UNIQUE, content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size>=0), checksum_sha256 text,
  sort_order integer NOT NULL, created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS property_images_property_idx ON property_images(property_id,sort_order);
CREATE TABLE IF NOT EXISTS favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id text NOT NULL, created_at text NOT NULL, PRIMARY KEY(user_id,listing_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY, listing_id text NOT NULL,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL, created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON messages(recipient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages(sender_id,created_at DESC);
CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages(listing_id,sender_id,recipient_id,created_at DESC);
CREATE TABLE IF NOT EXISTS packages (
  id text PRIMARY KEY, name text NOT NULL, listing_limit integer NOT NULL,
  duration_days integer NOT NULL, featured_days integer NOT NULL DEFAULT 0,
  price bigint NOT NULL, currency text NOT NULL DEFAULT 'TRY', active integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  package_id text NOT NULL REFERENCES packages(id), status text NOT NULL DEFAULT 'pending',
  provider_ref text, created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS country_settings (
  country_code text PRIMARY KEY, locale text NOT NULL, legal_text text NOT NULL DEFAULT '',
  payment_provider text, enabled integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS message_receipts (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at text NOT NULL,
  PRIMARY KEY(message_id,user_id)
);


ALTER TABLE listings ADD COLUMN IF NOT EXISTS published_at text;
UPDATE listings SET published_at=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') WHERE status='published' AND published_at IS NULL;
CREATE INDEX IF NOT EXISTS listings_published_at_idx ON listings(status,published_at);
CREATE TABLE IF NOT EXISTS saved_searches(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,name text NOT NULL,query text NOT NULL,enabled integer NOT NULL DEFAULT 1,created_at text NOT NULL,seen_at text NOT NULL,UNIQUE(user_id,query));
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON saved_searches(user_id);
CREATE TABLE IF NOT EXISTS discovery_preferences(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,price_seen_at text NOT NULL,price_enabled integer NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS price_history(id uuid PRIMARY KEY,listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,old_price bigint NOT NULL,new_price bigint NOT NULL,currency text NOT NULL,purpose text NOT NULL,changed_at text NOT NULL);
CREATE INDEX IF NOT EXISTS price_history_listing_idx ON price_history(listing_id,changed_at);

CREATE TABLE IF NOT EXISTS seller_profiles (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, bio text NOT NULL DEFAULT '', updated_at text NOT NULL);

CREATE TABLE IF NOT EXISTS listing_drafts (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, payload text NOT NULL, version integer NOT NULL DEFAULT 1 CHECK (version>0), updated_at text NOT NULL);

CREATE TABLE IF NOT EXISTS admin_audit (id uuid PRIMARY KEY, actor_id uuid NOT NULL, actor_name text NOT NULL, action text NOT NULL, target_id text NOT NULL, summary text NOT NULL, created_at text NOT NULL);
CREATE INDEX IF NOT EXISTS admin_audit_time_idx ON admin_audit(created_at DESC);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS presentation text NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS appointments (id uuid PRIMARY KEY,listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,slot_at text NOT NULL,message text NOT NULL,status text NOT NULL DEFAULT 'requested',stage text NOT NULL DEFAULT 'new',private_note text NOT NULL DEFAULT '',version integer NOT NULL DEFAULT 1,created_at text NOT NULL,updated_at text NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_unique ON appointments(buyer_id,listing_id) WHERE status IN ('requested','confirmed');
CREATE INDEX IF NOT EXISTS appointments_buyer_idx ON appointments(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS appointments_seller_idx ON appointments(seller_id,created_at DESC);

CREATE TABLE IF NOT EXISTS listing_view_daily (listing_id TEXT NOT NULL,day TEXT NOT NULL,visitor_hash TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(listing_id,day,visitor_hash));
CREATE INDEX IF NOT EXISTS favorites_listing_stats_idx ON favorites(listing_id);

-- Additive membership metadata. Authorization continues through agencies.owner_id.
CREATE TABLE IF NOT EXISTS company_profiles(user_id TEXT PRIMARY KEY,city TEXT NOT NULL,website TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);

-- Individual listing publication policy
-- Individual submission quota is durable even when a listing is withdrawn/deleted.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS expires_at text;
CREATE TABLE IF NOT EXISTS individual_listing_quota(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,last_submitted_at timestamptz NOT NULL);
INSERT INTO individual_listing_quota(user_id,last_submitted_at)
SELECT l.owner_id,max(l.created_at::timestamptz) FROM listings l JOIN users u ON u.id=l.owner_id WHERE u.role='individual' GROUP BY l.owner_id
ON CONFLICT(user_id) DO UPDATE SET last_submitted_at=greatest(individual_listing_quota.last_submitted_at,excluded.last_submitted_at);
UPDATE listings l SET expires_at=to_char((coalesce(l.published_at,l.created_at)::timestamptz+interval '20 days') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM users u WHERE u.id=l.owner_id AND u.role='individual' AND l.status='published' AND l.expires_at IS NULL;
CREATE INDEX IF NOT EXISTS listings_expiry_idx ON listings(expires_at) WHERE expires_at IS NOT NULL;
CREATE OR REPLACE FUNCTION enforce_individual_listing_policy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_role text; previous_submission timestamptz; stamp timestamptz:=clock_timestamp();
BEGIN
 SELECT role INTO account_role FROM users WHERE id=NEW.owner_id;
 IF TG_OP='INSERT' AND account_role='individual' THEN
   INSERT INTO individual_listing_quota(user_id,last_submitted_at) VALUES(NEW.owner_id,stamp-interval '4 months') ON CONFLICT DO NOTHING;
   SELECT last_submitted_at INTO previous_submission FROM individual_listing_quota WHERE user_id=NEW.owner_id FOR UPDATE;
   IF stamp<previous_submission+interval '3 months' THEN RAISE EXCEPTION 'individual_listing_quota' USING ERRCODE='P0001'; END IF;
   UPDATE individual_listing_quota SET last_submitted_at=stamp WHERE user_id=NEW.owner_id;
 END IF;
 IF TG_OP='UPDATE' THEN
   IF OLD.expires_at IS NOT NULL THEN NEW.expires_at:=OLD.expires_at; END IF;
   IF OLD.owner_id<>NEW.owner_id THEN RAISE EXCEPTION 'listing_owner_immutable'; END IF;
 END IF;
 IF NEW.status='published' THEN
   IF TG_OP='UPDATE' AND OLD.published_at IS NOT NULL THEN NEW.published_at:=OLD.published_at; END IF;
   IF NEW.published_at IS NULL THEN NEW.published_at:=to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); END IF;
   IF NEW.expires_at IS NULL AND account_role='individual' THEN NEW.expires_at:=to_char((stamp+interval '20 days') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); END IF;
   IF NEW.expires_at IS NOT NULL AND NEW.expires_at::timestamptz<=stamp THEN RAISE EXCEPTION 'individual_listing_expired' USING ERRCODE='P0001'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS individual_listing_policy ON listings;
CREATE TRIGGER individual_listing_policy BEFORE INSERT OR UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION enforce_individual_listing_policy();
