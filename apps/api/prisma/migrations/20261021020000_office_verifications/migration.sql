CREATE TABLE IF NOT EXISTS office_verifications (
 user_id TEXT PRIMARY KEY,document_id TEXT NOT NULL UNIQUE,document_number TEXT NOT NULL,company_snapshot TEXT NOT NULL,
 object_key TEXT NOT NULL,content_type TEXT NOT NULL,byte_size INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending',
 note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 reviewer_id TEXT,reviewed_at TEXT,last_action TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS office_verifications_state ON office_verifications(state,updated_at);
