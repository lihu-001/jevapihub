CREATE TABLE password_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX password_accounts_email_unique ON password_accounts (lower(email));
