-- Exxel Estate portable PostgreSQL schema. PostgreSQL 16+ recommended.
-- Photos live in object storage; images JSONB stores ordered object URLs.
CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  email_verified boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('buyer','individual','agent','admin')),
  agent_status text NOT NULL DEFAULT 'none' CHECK (agent_status IN ('none','pending','approved','rejected')),
  company text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE TABLE oauth_accounts (
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider, provider_user_id),
  UNIQUE(user_id, provider)
);
CREATE TABLE oauth_flows (
  state_hash text PRIMARY KEY,
  code_verifier text NOT NULL,
  role text NOT NULL,
  next_path text NOT NULL,
  link_user_id uuid,
  expires_at timestamptz NOT NULL
);
CREATE INDEX oauth_flows_expiry_idx ON oauth_flows(expires_at);
CREATE TABLE auth_limits (
  key text PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL
);
CREATE TABLE admin_setup (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  completed_at timestamptz NOT NULL
);
CREATE TABLE listings (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  description text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('satilik','kiralik')),
  property_type text NOT NULL CHECK (property_type IN ('daire','villa','mustakil','rezidans','arsa','ticari')),
  price bigint NOT NULL CHECK (price>0),
  currency char(3) NOT NULL DEFAULT 'TRY',
  city text NOT NULL,
  district text NOT NULL,
  neighborhood text,
  latitude double precision,
  longitude double precision,
  gross_area integer NOT NULL CHECK (gross_area>0),
  net_area integer,
  rooms text,
  bedrooms integer,
  bathrooms integer,
  building_age integer,
  floor integer,
  total_floors integer,
  heating text,
  furnished boolean NOT NULL DEFAULT false,
  amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  translations jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected')),
  review_note text,
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX listings_public_search_idx ON listings(purpose,property_type,city,price) WHERE status='published';
CREATE INDEX listings_area_idx ON listings(gross_area) WHERE status='published';
CREATE INDEX listings_owner_idx ON listings(owner_id);
CREATE INDEX listings_amenities_idx ON listings USING gin (amenities);
CREATE INDEX listings_geo_idx ON listings(latitude,longitude) WHERE status='published';
CREATE TABLE favorites (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,listing_id)
);
CREATE TABLE messages (
  id uuid PRIMARY KEY,
  listing_id text NOT NULL,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id uuid REFERENCES users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_recipient_idx ON messages(recipient_id,created_at DESC);
CREATE INDEX messages_sender_idx ON messages(sender_id,created_at DESC);
CREATE INDEX messages_thread_idx ON messages(listing_id,sender_id,recipient_id,created_at DESC);
CREATE TABLE packages (
  id text PRIMARY KEY,
  name text NOT NULL,
  listing_limit integer NOT NULL,
  duration_days integer NOT NULL,
  featured_days integer NOT NULL DEFAULT 0,
  price bigint NOT NULL,
  currency char(3) NOT NULL DEFAULT 'TRY',
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE purchases (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  package_id text NOT NULL REFERENCES packages(id),
  status text NOT NULL DEFAULT 'pending',
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE country_settings (
  country_code char(2) PRIMARY KEY,
  locale text NOT NULL,
  legal_text text NOT NULL DEFAULT '',
  payment_provider text,
  enabled boolean NOT NULL DEFAULT false
);
