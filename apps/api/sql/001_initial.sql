-- HomeBudget2 initial schema

CREATE TABLE locations (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  country       TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'EUR',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expense_categories (
  id            SERIAL PRIMARY KEY,
  location_id   INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  parent_id     INTEGER REFERENCES expense_categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  frequency     TEXT NOT NULL DEFAULT 'monthly',
  color         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Only one level of nesting: a parent must itself have no parent
  CONSTRAINT one_level_nesting CHECK (parent_id IS NULL OR parent_id != id)
);

CREATE TABLE salary_history (
  id              SERIAL PRIMARY KEY,
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  effective_from  DATE NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE price_history (
  id                    SERIAL PRIMARY KEY,
  expense_category_id   INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  amount                NUMERIC(12,2) NOT NULL,
  currency              TEXT NOT NULL,
  effective_from        DATE NOT NULL,
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE exchange_rate_history (
  id              SERIAL PRIMARY KEY,
  from_currency   TEXT NOT NULL DEFAULT 'EUR',
  to_currency     TEXT NOT NULL DEFAULT 'PHP',
  rate            NUMERIC(14,6) NOT NULL,
  effective_from  DATE NOT NULL,
  source          TEXT NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for "latest effective at date" queries
CREATE INDEX idx_salary_history_date ON salary_history(effective_from DESC);
CREATE INDEX idx_price_history_cat_date ON price_history(expense_category_id, effective_from DESC);
CREATE INDEX idx_exchange_rate_date ON exchange_rate_history(effective_from DESC);

-- Enforce single-level nesting: a parent category must not itself have a parent
CREATE OR REPLACE FUNCTION check_parent_is_group() RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM expense_categories WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Parent category must be a top-level group (parent_id must be NULL)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_parent_is_group
  BEFORE INSERT OR UPDATE ON expense_categories
  FOR EACH ROW EXECUTE FUNCTION check_parent_is_group();
