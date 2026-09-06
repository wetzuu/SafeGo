ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS display_payload jsonb NOT NULL DEFAULT '{}';
