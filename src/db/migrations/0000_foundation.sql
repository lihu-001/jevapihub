CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE,
  avatar_url text,
  role varchar(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interfaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id),
  name varchar(120) NOT NULL,
  slug varchar(120) NOT NULL,
  description text NOT NULL DEFAULT '',
  category varchar(64) NOT NULL,
  language varchar(32) NOT NULL,
  visibility varchar(16) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  forked_from_interface_id uuid,
  forked_from_version_id uuid,
  published_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

CREATE TABLE interface_drafts (
  interface_id uuid PRIMARY KEY REFERENCES interfaces(id),
  manifest_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interface_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interface_id uuid NOT NULL REFERENCES interfaces(id),
  version_number integer NOT NULL CHECK (version_number > 0),
  manifest_json jsonb NOT NULL,
  changelog text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interface_id, version_number)
);

ALTER TABLE interfaces
  ADD CONSTRAINT interfaces_forked_from_interface_fk FOREIGN KEY (forked_from_interface_id) REFERENCES interfaces(id),
  ADD CONSTRAINT interfaces_forked_from_version_fk FOREIGN KEY (forked_from_version_id) REFERENCES interface_versions(id),
  ADD CONSTRAINT interfaces_published_version_fk FOREIGN KEY (published_version_id) REFERENCES interface_versions(id);

CREATE FUNCTION forbid_interface_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Published Interface Version is immutable';
END;
$$;

CREATE TRIGGER interface_versions_immutable
  BEFORE UPDATE OR DELETE ON interface_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_interface_version_mutation();

CREATE TABLE stars (
  user_id uuid NOT NULL REFERENCES users(id),
  interface_id uuid NOT NULL REFERENCES interfaces(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, interface_id)
);

CREATE TABLE run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interface_id uuid REFERENCES interfaces(id),
  interface_version_id uuid REFERENCES interface_versions(id),
  user_id uuid REFERENCES users(id),
  anonymous_session_hash text,
  success boolean NOT NULL,
  provider_model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer NOT NULL,
  provider_status integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
