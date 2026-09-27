ALTER TABLE interface_drafts ADD COLUMN ai_generated boolean NOT NULL DEFAULT false;

CREATE TABLE ai_builder_usage (
  user_id uuid NOT NULL REFERENCES users(id),
  usage_date date NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (user_id, usage_date)
);
