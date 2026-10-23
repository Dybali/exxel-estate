-- Individual submission quota is durable even when a listing is withdrawn/deleted.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS expires_at text;
CREATE TABLE IF NOT EXISTS individual_listing_quota(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,last_submitted_at timestamptz NOT NULL);
INSERT INTO individual_listing_quota(user_id,last_submitted_at)
SELECT l.owner_id,max(l.created_at::timestamptz) FROM listings l JOIN users u ON u.id=l.owner_id WHERE u.role='individual' GROUP BY l.owner_id
ON CONFLICT(user_id) DO UPDATE SET last_submitted_at=greatest(individual_listing_quota.last_submitted_at,excluded.last_submitted_at);
UPDATE listings l SET expires_at=to_char((coalesce(l.published_at,l.created_at)::timestamptz+interval '20 days') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM users u WHERE u.id=l.owner_id AND u.role='individual' AND l.status='published' AND l.expires_at IS NULL;
CREATE INDEX IF NOT EXISTS listings_expiry_idx ON listings(expires_at) WHERE expires_at IS NOT NULL;
CREATE OR REPLACE FUNCTION enforce_individual_listing_policy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_role text; previous_submission timestamptz; stamp timestamptz:=clock_timestamp();
BEGIN
 SELECT role INTO account_role FROM users WHERE id=NEW.owner_id;
 IF TG_OP='INSERT' AND account_role='individual' THEN
   INSERT INTO individual_listing_quota(user_id,last_submitted_at) VALUES(NEW.owner_id,stamp-interval '4 months') ON CONFLICT DO NOTHING;
   SELECT last_submitted_at INTO previous_submission FROM individual_listing_quota WHERE user_id=NEW.owner_id FOR UPDATE;
   IF stamp<previous_submission+interval '3 months' THEN RAISE EXCEPTION 'individual_listing_quota' USING ERRCODE='P0001'; END IF;
   UPDATE individual_listing_quota SET last_submitted_at=stamp WHERE user_id=NEW.owner_id;
 END IF;
 IF TG_OP='UPDATE' THEN
   IF OLD.expires_at IS NOT NULL THEN NEW.expires_at:=OLD.expires_at; END IF;
   IF OLD.owner_id<>NEW.owner_id THEN RAISE EXCEPTION 'listing_owner_immutable'; END IF;
 END IF;
 IF NEW.status='published' THEN
   IF TG_OP='UPDATE' AND OLD.published_at IS NOT NULL THEN NEW.published_at:=OLD.published_at; END IF;
   IF NEW.published_at IS NULL THEN NEW.published_at:=to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); END IF;
   IF NEW.expires_at IS NULL AND account_role='individual' THEN NEW.expires_at:=to_char((stamp+interval '20 days') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'); END IF;
   IF NEW.expires_at IS NOT NULL AND NEW.expires_at::timestamptz<=stamp THEN RAISE EXCEPTION 'individual_listing_expired' USING ERRCODE='P0001'; END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS individual_listing_policy ON listings;
CREATE TRIGGER individual_listing_policy BEFORE INSERT OR UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION enforce_individual_listing_policy();
