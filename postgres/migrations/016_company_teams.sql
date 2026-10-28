-- Draft for company staff and storefront ownership. Not applied automatically.
-- Invitations are bound to an already registered, verified email address.
CREATE TABLE IF NOT EXISTS company_team_invitations (
  id uuid PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES agencies(id),
  invited_email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES users(id),
  created_at text NOT NULL,
  expires_at text NOT NULL,
  accepted_at text,
  revoked_at text,
  CHECK (invited_email = lower(invited_email)),
  CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS company_team_invitation_email_idx ON company_team_invitations(invited_email, expires_at);
CREATE TABLE IF NOT EXISTS company_team_memberships (
  id uuid PRIMARY KEY,
  agency_id uuid NOT NULL REFERENCES agencies(id),
  user_id uuid NOT NULL REFERENCES users(id),
  invitation_id uuid NOT NULL UNIQUE REFERENCES company_team_invitations(id),
  joined_at text NOT NULL,
  ended_at text
);
CREATE UNIQUE INDEX IF NOT EXISTS company_team_one_active_company_idx ON company_team_memberships(user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS company_team_active_agency_idx ON company_team_memberships(agency_id) WHERE ended_at IS NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS agency_id uuid REFERENCES agencies(id);
-- listings.agency_id is the durable association; it does not change on departure.
CREATE INDEX IF NOT EXISTS listings_agency_portfolio_idx ON listings(agency_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS company_featured_listings (agency_id uuid NOT NULL REFERENCES agencies(id), listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE, created_at text NOT NULL, PRIMARY KEY(agency_id,listing_id));
