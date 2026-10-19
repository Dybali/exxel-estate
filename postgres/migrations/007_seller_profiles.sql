CREATE TABLE IF NOT EXISTS seller_profiles (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, bio text NOT NULL DEFAULT '', updated_at text NOT NULL);
