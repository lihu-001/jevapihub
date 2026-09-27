ALTER TABLE interfaces ADD COLUMN featured boolean NOT NULL DEFAULT false;

CREATE INDEX interfaces_public_recent_idx ON interfaces (updated_at DESC)
  WHERE status = 'published' AND visibility = 'public';
CREATE INDEX run_events_interface_success_idx ON run_events (interface_id)
  WHERE success = true;
CREATE INDEX stars_interface_idx ON stars (interface_id);
