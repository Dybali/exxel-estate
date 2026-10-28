ALTER TABLE listings ADD COLUMN agency_id TEXT REFERENCES agencies(id);
--> statement-breakpoint
CREATE INDEX listings_agency_portfolio_idx ON listings(agency_id,status,created_at DESC);
