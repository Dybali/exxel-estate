-- Manual promotional access while online package purchases are unavailable.
CREATE TABLE IF NOT EXISTS agent_plan_grants (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id text NOT NULL CHECK (plan_id IN ('professional','prestige')),
  listing_limit integer NOT NULL CHECK (listing_limit BETWEEN 1 AND 100),
  starts_at text NOT NULL,
  ends_at text NOT NULL,
  revoked_at text,
  note text NOT NULL DEFAULT '',
  granted_by uuid NOT NULL REFERENCES users(id),
  created_at text NOT NULL,
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS agent_plan_grants_user_idx ON agent_plan_grants(user_id,ends_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS agent_plan_grants_one_active_idx ON agent_plan_grants(user_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS agent_plan_rollout (id integer PRIMARY KEY CHECK (id=1), activated_at text NOT NULL);
INSERT INTO agent_plan_rollout(id,activated_at) VALUES(1,'2026-10-27T07:56:43.609Z') ON CONFLICT(id) DO NOTHING;
