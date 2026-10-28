-- Private stage and note per enquiry (listing + contact) for listing owners.
-- The API also creates this table on first use (lib/leads.ts), so applying it is optional.
CREATE TABLE IF NOT EXISTS lead_notes (
  owner_id text NOT NULL,
  listing_id text NOT NULL,
  contact_id text NOT NULL,
  stage text NOT NULL DEFAULT 'new',
  private_note text NOT NULL DEFAULT '',
  updated_at text NOT NULL,
  PRIMARY KEY (owner_id, listing_id, contact_id)
);
