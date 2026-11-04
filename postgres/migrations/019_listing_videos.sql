-- Self-hosted listing videos (docs/listing-videos.md): one row per upload. The raw file goes to the
-- private bucket, the worker in the Mittwald container makes an MP4 + poster in the photo bucket.
-- listing_id stays NULL until a listing is saved with the video; unattached rows older than 2 days
-- and failed rows are removed by the daily job. Timestamps are ISO text like the other tables.
CREATE TABLE IF NOT EXISTS listing_videos (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','queued','processing','ready','failed')),
  upload_id text,
  raw_key text NOT NULL,
  mp4_key text,
  poster_key text,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL,
  duration_seconds double precision,
  width integer,
  height integer,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  locked_until text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS listing_videos_owner_idx ON listing_videos(owner_id, created_at);
CREATE INDEX IF NOT EXISTS listing_videos_listing_idx ON listing_videos(listing_id);
CREATE INDEX IF NOT EXISTS listing_videos_queue_idx ON listing_videos(status, updated_at);
