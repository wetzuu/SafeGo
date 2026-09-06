CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('mock', 'active', 'degraded', 'disabled')),
  base_url text,
  polling_interval_seconds integer,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id text PRIMARY KEY,
  name text NOT NULL,
  city text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  position geography(Point, 4326) NOT NULL,
  is_approximate boolean NOT NULL DEFAULT true,
  updated_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  source_id uuid REFERENCES data_sources(id) ON DELETE SET NULL,
  factor_name text NOT NULL,
  normalized_score smallint NOT NULL CHECK (normalized_score BETWEEN 0 AND 100),
  confidence numeric(4, 3) NOT NULL DEFAULT 0.500
    CHECK (confidence BETWEEN 0 AND 1),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'pending', 'unverified')),
  payload jsonb NOT NULL DEFAULT '{}',
  observed_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  source_url text
);

CREATE TABLE IF NOT EXISTS advisories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  source_id uuid REFERENCES data_sources(id) ON DELETE SET NULL,
  source_kind text NOT NULL,
  title text NOT NULL,
  payload jsonb NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  title text NOT NULL,
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'pending', 'unverified')),
  payload jsonb NOT NULL,
  position geography(Point, 4326),
  reported_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  overall_score smallint NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  raw_score smallint NOT NULL CHECK (raw_score BETWEEN 0 AND 100),
  risk_key text NOT NULL CHECK (risk_key IN ('low', 'mod', 'high', 'crit')),
  model_version text NOT NULL,
  factors jsonb NOT NULL,
  assessment jsonb NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS locations_position_gix
  ON locations USING gist (position);
CREATE INDEX IF NOT EXISTS observations_location_time_idx
  ON observations (location_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS observations_expiry_idx
  ON observations (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS advisories_location_time_idx
  ON advisories (location_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS community_reports_location_time_idx
  ON community_reports (location_id, reported_at DESC);
CREATE INDEX IF NOT EXISTS community_reports_position_gix
  ON community_reports USING gist (position);
CREATE INDEX IF NOT EXISTS risk_assessments_location_time_idx
  ON risk_assessments (location_id, calculated_at DESC);
