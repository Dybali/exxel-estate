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
  purpose text NOT NULL CHECK (purpose IN ('satilik','kiralik')),
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

