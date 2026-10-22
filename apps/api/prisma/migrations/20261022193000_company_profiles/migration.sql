-- Additive membership metadata. Authorization continues through agencies.owner_id.
CREATE TABLE IF NOT EXISTS company_profiles(user_id TEXT PRIMARY KEY,city TEXT NOT NULL,website TEXT NOT NULL DEFAULT '',address TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
