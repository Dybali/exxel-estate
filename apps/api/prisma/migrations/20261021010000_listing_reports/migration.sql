CREATE TABLE IF NOT EXISTS listing_reports(id TEXT PRIMARY KEY,listing_id TEXT NOT NULL,reporter_id TEXT NOT NULL,title_snapshot TEXT NOT NULL,reason TEXT NOT NULL,details TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'open',admin_note TEXT NOT NULL DEFAULT '',resolution TEXT NOT NULL DEFAULT '',reviewer_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,last_action TEXT NOT NULL DEFAULT '',UNIQUE(listing_id,reporter_id));
CREATE INDEX IF NOT EXISTS listing_reports_queue ON listing_reports(state,created_at);
CREATE INDEX IF NOT EXISTS listing_reports_owner ON listing_reports(reporter_id,created_at);
CREATE TABLE IF NOT EXISTS listing_report_events(id TEXT PRIMARY KEY,report_id TEXT NOT NULL,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS listing_report_events_report ON listing_report_events(report_id,created_at);
CREATE TABLE IF NOT EXISTS listing_report_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,window_started_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS listing_moderation_holds(listing_id TEXT PRIMARY KEY,report_id TEXT NOT NULL,active INTEGER NOT NULL,created_at TEXT NOT NULL,released_at TEXT);
CREATE TABLE IF NOT EXISTS admin_audit(id uuid PRIMARY KEY,actor_id uuid NOT NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,target_id TEXT NOT NULL,summary TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS admin_audit_time_idx ON admin_audit(created_at DESC);
