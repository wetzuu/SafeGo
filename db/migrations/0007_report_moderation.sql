-- Moderators can reject a community report, and each review records who did it and when.
ALTER TABLE community_reports DROP CONSTRAINT IF EXISTS community_reports_verification_status_check;
ALTER TABLE community_reports
  ADD CONSTRAINT community_reports_verification_status_check
  CHECK (verification_status IN ('verified', 'pending', 'unverified', 'rejected'));

ALTER TABLE community_reports
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by text;
