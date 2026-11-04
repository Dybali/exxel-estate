-- Individual members: 1 listing every 45 days (was 3 calendar months); publication stays 20 days.
-- Same function as 013 except the interval and the first-listing seed (stamp-interval '46 days').
-- Applied on the Mittwald container by the startup migration runner (lib/postgres-migrations.ts).
CREATE OR REPLACE FUNCTION enforce_individual_listing_policy() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_role text; previous_submission timestamptz; stamp timestamptz:=clock_timestamp();
BEGIN
 SELECT role INTO account_role FROM users WHERE id=NEW.owner_id;
 IF TG_OP='INSERT' AND account_role='individual' THEN
   INSERT INTO individual_listing_quota(user_id,last_submitted_at) VALUES(NEW.owner_id,stamp-interval '46 days') ON CONFLICT DO NOTHING;
   SELECT last_submitted_at INTO previous_submission FROM individual_listing_quota WHERE user_id=NEW.owner_id FOR UPDATE;
   IF stamp<previous_submission+interval '45 days' THEN RAISE EXCEPTION 'individual_listing_quota' USING ERRCODE='P0001'; END IF;
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
