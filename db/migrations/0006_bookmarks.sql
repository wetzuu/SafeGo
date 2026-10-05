CREATE TABLE IF NOT EXISTS user_bookmarks (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  label text NOT NULL,
  canonical_label text,
  position geography(Point, 4326) NOT NULL,
  source text,
  matched_location_id text,
  approximate boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_bookmarks_user_idx ON user_bookmarks (user_id, created_at);
