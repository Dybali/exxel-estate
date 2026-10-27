CREATE TABLE IF NOT EXISTS admin_audit (id uuid PRIMARY KEY, actor_id uuid NOT NULL, actor_name text NOT NULL, action text NOT NULL, target_id text NOT NULL, summary text NOT NULL, created_at text NOT NULL);
CREATE INDEX IF NOT EXISTS admin_audit_time_idx ON admin_audit(created_at DESC);
