-- Mirror the individual-account limits used by the production PostgreSQL trigger.
INSERT INTO individual_listing_quota(user_id,last_submitted_at)
 SELECT l.owner_id,MAX(l.created_at) FROM listings l JOIN users u ON u.id=l.owner_id
 WHERE u.role='individual' GROUP BY l.owner_id
 ON CONFLICT(user_id) DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER individual_submission_guard BEFORE INSERT ON listings
 WHEN (SELECT role FROM users WHERE id=NEW.owner_id)='individual'
 BEGIN
  SELECT CASE WHEN EXISTS(
   SELECT 1 FROM individual_listing_quota q WHERE q.user_id=NEW.owner_id
    AND strftime('%Y-%m-%dT%H:%M:%fZ','now') <
      date(q.last_submitted_at,'start of month','+3 months',
       '+'||(min(CAST(strftime('%d',q.last_submitted_at) AS INTEGER),
          CAST(strftime('%d',q.last_submitted_at,'start of month','+4 months','-1 day') AS INTEGER))-1)||' days')
        ||'T'||substr(q.last_submitted_at,12)
  ) THEN RAISE(ABORT,'individual_listing_quota') END;
 END;
--> statement-breakpoint
CREATE TRIGGER individual_submission_record AFTER INSERT ON listings
 WHEN (SELECT role FROM users WHERE id=NEW.owner_id)='individual'
 BEGIN
  INSERT INTO individual_listing_quota(user_id,last_submitted_at)
   VALUES(NEW.owner_id,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
   ON CONFLICT(user_id) DO UPDATE SET last_submitted_at=excluded.last_submitted_at;
 END;
--> statement-breakpoint
CREATE TRIGGER listing_owner_guard BEFORE UPDATE ON listings WHEN NEW.owner_id<>OLD.owner_id
 BEGIN SELECT RAISE(ABORT,'listing_owner_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER listing_expiry_guard BEFORE UPDATE ON listings
 WHEN (OLD.expires_at IS NOT NULL AND NEW.expires_at IS NOT OLD.expires_at)
   OR (NEW.status='published' AND NEW.expires_at IS NOT NULL AND NEW.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 BEGIN SELECT RAISE(ABORT,'individual_listing_expired'); END;
--> statement-breakpoint
CREATE TRIGGER listing_publication_insert AFTER INSERT ON listings WHEN NEW.status='published'
 BEGIN
  UPDATE listings SET published_at=COALESCE(published_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   expires_at= CASE WHEN (SELECT role FROM users WHERE id=NEW.owner_id)='individual'
    THEN COALESCE(expires_at,strftime('%Y-%m-%dT%H:%M:%fZ','now','+20 days')) ELSE expires_at END WHERE id=NEW.id;
 END;
--> statement-breakpoint
CREATE TRIGGER listing_publication_update AFTER UPDATE OF status ON listings WHEN NEW.status='published'
 BEGIN
  UPDATE listings SET published_at=COALESCE(OLD.published_at,NEW.published_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),
   expires_at= CASE WHEN (SELECT role FROM users WHERE id=NEW.owner_id)='individual'
    THEN COALESCE(OLD.expires_at,NEW.expires_at,strftime('%Y-%m-%dT%H:%M:%fZ','now','+20 days')) ELSE NEW.expires_at END WHERE id=NEW.id;
 END;
