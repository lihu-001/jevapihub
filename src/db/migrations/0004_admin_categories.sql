ALTER TABLE interfaces ADD COLUMN admin_hidden boolean NOT NULL DEFAULT false;

CREATE TABLE hub_categories (
  slug varchar(64) PRIMARY KEY,
  name varchar(120) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO hub_categories(slug, name, sort_order) VALUES
  ('general', '通用', 0),
  ('writing', '写作与内容', 10),
  ('research', '研究与分析', 20),
  ('education', '教育与学习', 30);
