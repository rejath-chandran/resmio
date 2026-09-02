-- Built-in Pro plan. Re-runnable: INSERT OR IGNORE leaves admin price/duration edits alone.
-- created_at / updated_at fall back to their unixepoch() defaults.
INSERT OR IGNORE INTO plans (id, name, price_inr, currency, duration_days, is_active)
VALUES ('pro', 'Pro', 499, 'INR', 60, 1);
