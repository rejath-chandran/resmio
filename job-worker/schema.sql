-- Jobs store owned by job-worker. The TanStack app reads this read-only.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS jobs (
  id           text PRIMARY KEY,            -- sha1(source:external_id)
  source       text NOT NULL,               -- 'greenhouse' | 'lever' | ...
  external_id  text NOT NULL,
  title        text NOT NULL,
  company      text NOT NULL DEFAULT '',
  location     text NOT NULL DEFAULT '',
  remote       boolean NOT NULL DEFAULT false,
  description  text NOT NULL DEFAULT '',
  url          text NOT NULL,               -- apply/origin link (never a mirror)
  salary_min   integer,
  salary_max   integer,
  currency     text,
  posted_at    timestamptz,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  active       boolean NOT NULL DEFAULT true,
  embedding    vector(384),                 -- bge-small-en-v1.5; NULL until embedded
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS jobs_active_idx  ON jobs (active, posted_at DESC);
-- Cosine ANN index. ivfflat needs ANALYZE after bulk load; fine for our volume.
CREATE INDEX IF NOT EXISTS jobs_embed_idx
  ON jobs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
