ALTER TABLE community_reports
  ADD COLUMN IF NOT EXISTS submission_source text NOT NULL DEFAULT 'seed'
  CHECK (submission_source IN ('seed', 'community'));

CREATE INDEX IF NOT EXISTS community_reports_source_idx
  ON community_reports (submission_source, reported_at DESC);
