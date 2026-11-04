-- Individual members: 1 listing every 45 days (was 3 calendar months); mirrors
-- postgres/migrations/018_individual_listing_45_days.sql. Publication stays 20 days.
DROP TRIGGER IF EXISTS individual_submission_guard;
--> statement-breakpoint
CREATE TRIGGER individual_submission_guard BEFORE INSERT ON listings
 WHEN (SELECT role FROM users WHERE id=NEW.owner_id)='individual'
 BEGIN
  SELECT CASE WHEN EXISTS(
   SELECT 1 FROM individual_listing_quota q WHERE q.user_id=NEW.owner_id
    AND strftime('%Y-%m-%dT%H:%M:%fZ','now') < strftime('%Y-%m-%dT%H:%M:%fZ',q.last_submitted_at,'+45 days')
  ) THEN RAISE(ABORT,'individual_listing_quota') END;
 END;
