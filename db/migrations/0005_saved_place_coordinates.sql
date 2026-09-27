ALTER TABLE user_saved_places
  ADD COLUMN IF NOT EXISTS home_canonical_label text,
  ADD COLUMN IF NOT EXISTS home_position geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS home_source text,
  ADD COLUMN IF NOT EXISTS home_matched_location_id text,
  ADD COLUMN IF NOT EXISTS home_approximate boolean,
  ADD COLUMN IF NOT EXISTS school_canonical_label text,
  ADD COLUMN IF NOT EXISTS school_position geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS school_source text,
  ADD COLUMN IF NOT EXISTS school_matched_location_id text,
  ADD COLUMN IF NOT EXISTS school_approximate boolean;

CREATE INDEX IF NOT EXISTS user_saved_places_home_position_gix
  ON user_saved_places USING gist (home_position);
CREATE INDEX IF NOT EXISTS user_saved_places_school_position_gix
  ON user_saved_places USING gist (school_position);
