CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(320) NOT NULL,
  email_normalized VARCHAR(320) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (email_normalized)
);

CREATE TABLE accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER,
  opening_balance BIGINT NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  type VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
  name VARCHAR(100) NOT NULL,
  name_normalized VARCHAR(100) NOT NULL,
  parent_id BIGINT REFERENCES categories(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  tx_date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('INCOME', 'EXPENSE', 'TRANSFER')),
  amount BIGINT NOT NULL CHECK (amount > 0),
  account_id BIGINT REFERENCES accounts(id),
  from_account_id BIGINT REFERENCES accounts(id),
  to_account_id BIGINT REFERENCES accounts(id),
  description VARCHAR(255) NOT NULL DEFAULT '',
  category_id BIGINT REFERENCES categories(id),
  needs_review BOOLEAN NOT NULL DEFAULT false,
  exclude_from_reports BOOLEAN NOT NULL DEFAULT false,
  source VARCHAR(20) NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'CSV')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (type = 'TRANSFER' AND account_id IS NULL AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL AND from_account_id <> to_account_id)
    OR
    (type IN ('INCOME', 'EXPENSE') AND account_id IS NOT NULL AND from_account_id IS NULL AND to_account_id IS NULL)
  ),
  CHECK (type = 'EXPENSE' OR exclude_from_reports = false)
);

CREATE TABLE transaction_tags (
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_name VARCHAR(30) NOT NULL,
  PRIMARY KEY (transaction_id, tag_name)
);

CREATE TABLE backups (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  version VARCHAR(40) NOT NULL,
  exported_at TIMESTAMPTZ NOT NULL,
  currency VARCHAR(10) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_categories_user_parent_name
ON categories (user_id, type, COALESCE(parent_id, 0), name_normalized)
WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX uq_categories_system_parent_name
ON categories (type, COALESCE(parent_id, 0), name_normalized)
WHERE user_id IS NULL;

CREATE INDEX idx_tx_date_live
ON transactions (user_id, tx_date)
WHERE deleted_at IS NULL;

CREATE INDEX idx_tx_account_date_live
ON transactions (user_id, account_id, tx_date)
WHERE deleted_at IS NULL AND type IN ('INCOME', 'EXPENSE');

CREATE INDEX idx_tx_from_date_live
ON transactions (user_id, from_account_id, tx_date)
WHERE deleted_at IS NULL AND type = 'TRANSFER';

CREATE INDEX idx_tx_to_date_live
ON transactions (user_id, to_account_id, tx_date)
WHERE deleted_at IS NULL AND type = 'TRANSFER';
