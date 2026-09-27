CREATE TABLE oauth_accounts (
  provider varchar(32) NOT NULL,
  provider_account_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_account_id)
);

CREATE INDEX oauth_accounts_user_id_idx ON oauth_accounts(user_id);
