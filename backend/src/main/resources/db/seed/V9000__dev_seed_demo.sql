WITH ensured_user AS (
  INSERT INTO users (email, email_normalized, password_hash)
  VALUES ('demo@example.com', 'demo@example.com', '{noop}demo')
  ON CONFLICT (email_normalized) DO UPDATE
    SET email = EXCLUDED.email
  RETURNING id
), u AS (
  SELECT id FROM ensured_user
  UNION ALL
  SELECT id FROM users WHERE email_normalized = 'demo@example.com'
)
INSERT INTO accounts (id, user_id, name, type, opening_balance, is_active, order_index)
SELECT 100, (SELECT id FROM u LIMIT 1), '국민 주거래', 'CHECKING', 1000000, true, 10
ON CONFLICT (id) DO NOTHING;

WITH u AS (SELECT id FROM users WHERE email_normalized = 'demo@example.com')
INSERT INTO accounts (id, user_id, name, type, opening_balance, is_active, order_index)
SELECT 101, (SELECT id FROM u LIMIT 1), '카카오 비상금', 'SAVINGS', 300000, true, 20
ON CONFLICT (id) DO NOTHING;

WITH u AS (SELECT id FROM users WHERE email_normalized = 'demo@example.com')
INSERT INTO accounts (id, user_id, name, type, opening_balance, is_active, order_index)
SELECT 102, (SELECT id FROM u LIMIT 1), '증권 계좌', 'INVESTMENT', 0, true, 30
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, user_id, type, name, name_normalized, parent_id, is_active, order_index)
VALUES (200, NULL, 'INCOME', '급여', '급여', NULL, true, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, user_id, type, name, name_normalized, parent_id, is_active, order_index)
VALUES (201, NULL, 'INCOME', '기타수입', '기타수입', NULL, true, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, user_id, type, name, name_normalized, parent_id, is_active, order_index)
VALUES (210, NULL, 'EXPENSE', '식비', '식비', NULL, true, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, user_id, type, name, name_normalized, parent_id, is_active, order_index)
VALUES (211, NULL, 'EXPENSE', '카페/간식', '카페/간식', 210, true, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, user_id, type, name, name_normalized, parent_id, is_active, order_index)
VALUES (212, NULL, 'EXPENSE', '교통', '교통', NULL, true, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO categories (id, user_id, type, name, name_normalized, parent_id, is_active, order_index)
VALUES (220, NULL, 'TRANSFER', '투자이동', '투자이동', NULL, true, NULL)
ON CONFLICT DO NOTHING;

WITH u AS (SELECT id FROM users WHERE email_normalized = 'demo@example.com')
INSERT INTO transactions (
  id, user_id, tx_date, type, amount,
  account_id, from_account_id, to_account_id,
  description, category_id,
  needs_review, exclude_from_reports, source
)
SELECT
  1000, (SELECT id FROM u LIMIT 1), DATE '2026-02-10', 'INCOME', 3200000,
  100, NULL, NULL,
  '월급', NULL,
  true, false, 'MANUAL'
ON CONFLICT (id) DO NOTHING;

WITH u AS (SELECT id FROM users WHERE email_normalized = 'demo@example.com')
INSERT INTO transactions (
  id, user_id, tx_date, type, amount,
  account_id, from_account_id, to_account_id,
  description, category_id,
  needs_review, exclude_from_reports, source
)
SELECT
  1001, (SELECT id FROM u LIMIT 1), DATE '2026-02-12', 'EXPENSE', 12500,
  100, NULL, NULL,
  '스타벅스', NULL,
  true, false, 'MANUAL'
ON CONFLICT (id) DO NOTHING;

WITH u AS (SELECT id FROM users WHERE email_normalized = 'demo@example.com')
INSERT INTO transactions (
  id, user_id, tx_date, type, amount,
  account_id, from_account_id, to_account_id,
  description, category_id,
  needs_review, exclude_from_reports, source
)
SELECT
  1002, (SELECT id FROM u LIMIT 1), DATE '2026-02-15', 'TRANSFER', 300000,
  NULL, 100, 102,
  '투자계좌로 이동', NULL,
  true, false, 'MANUAL'
ON CONFLICT (id) DO NOTHING;

WITH u AS (SELECT id FROM users WHERE email_normalized = 'demo@example.com')
INSERT INTO transactions (
  id, user_id, tx_date, type, amount,
  account_id, from_account_id, to_account_id,
  description, category_id,
  needs_review, exclude_from_reports, source
)
SELECT
  1003, (SELECT id FROM u LIMIT 1), DATE '2026-02-18', 'EXPENSE', 8900,
  100, NULL, NULL,
  '개인정산', NULL,
  true, true, 'MANUAL'
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('accounts_id_seq', (SELECT COALESCE(MAX(id), 1) FROM accounts));
SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id), 1) FROM categories));
SELECT setval('transactions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM transactions));
