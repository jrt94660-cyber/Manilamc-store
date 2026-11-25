CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  username VARCHAR(16) NOT NULL,
  items JSONB NOT NULL,
  total_php INTEGER NOT NULL CHECK (total_php > 0),
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  delivery_status TEXT NOT NULL DEFAULT 'not_started',
  paymongo_session_id TEXT UNIQUE,
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_error TEXT
);
CREATE TABLE IF NOT EXISTS processed_webhooks (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON orders(payment_status);
