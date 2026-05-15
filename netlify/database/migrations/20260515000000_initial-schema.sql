-- ============================================================
-- Lusik & Sons — Initial database schema
-- ============================================================
-- Creates all tables for the e-commerce backend:
--   profiles, addresses, saved_carts, orders, order_items,
--   product_waitlist
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE profiles (
  id             UUID PRIMARY KEY,
  email          TEXT NOT NULL,
  full_name      TEXT,
  phone          TEXT,
  avatar_url     TEXT,
  saved_designs  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_email ON profiles (lower(email));

-- ============================================================
-- addresses
-- ============================================================
CREATE TABLE addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label        TEXT,
  recipient    TEXT NOT NULL,
  line1        TEXT NOT NULL,
  line2        TEXT,
  city         TEXT NOT NULL,
  state        TEXT NOT NULL,
  postal_code  TEXT NOT NULL,
  country      TEXT NOT NULL DEFAULT 'US',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addresses_user ON addresses (user_id, is_default DESC, created_at DESC);

-- ============================================================
-- saved_carts
-- ============================================================
CREATE TABLE saved_carts (
  user_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  cart_data   JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- orders
-- ============================================================
CREATE TABLE orders (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number                TEXT NOT NULL UNIQUE,
  stripe_session_id           TEXT UNIQUE,
  stripe_payment_intent       TEXT,
  refunded_cents              INTEGER NOT NULL DEFAULT 0,
  user_id                     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_email              TEXT NOT NULL,
  status                      TEXT NOT NULL DEFAULT 'paid',
  fulfillment_status          TEXT NOT NULL DEFAULT 'in_progress',
  subtotal_cents              INTEGER NOT NULL,
  shipping_cents              INTEGER NOT NULL DEFAULT 0,
  tax_cents                   INTEGER NOT NULL DEFAULT 0,
  total_cents                 INTEGER NOT NULL,
  shipping_address            JSONB,
  carrier                     TEXT,
  tracking_number             TEXT,
  estimated_ship_date         DATE,
  social_consent              JSONB,
  gift                        JSONB,
  finished_photo_key          TEXT,
  finished_photo_emailed_at   TIMESTAMPTZ,
  admin_notes                 TEXT,
  customer_notes              TEXT,
  shipped_at                  TIMESTAMPTZ,
  gift_reminder_opt_in        BOOLEAN NOT NULL DEFAULT false,
  gift_reminder_sent_at       TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT orders_status_check CHECK (
    status IN ('paid', 'refunded', 'partially_refunded', 'cancelled')
  ),
  CONSTRAINT orders_fulfillment_status_check CHECK (
    fulfillment_status IN (
      'in_progress',
      'awaiting_lusik',
      'in_production',
      'quality_check',
      'ready_to_ship',
      'shipped',
      'delivered',
      'refunded'
    )
  )
);

CREATE INDEX idx_orders_user ON orders (user_id, created_at DESC);
CREATE INDEX idx_orders_email ON orders (lower(customer_email));
CREATE INDEX idx_orders_session ON orders (stripe_session_id);
CREATE INDEX idx_orders_payment_intent ON orders (stripe_payment_intent);

CREATE INDEX idx_orders_gift_reminder_pending
  ON orders (created_at)
  WHERE gift_reminder_opt_in = true AND gift_reminder_sent_at IS NULL;

-- ============================================================
-- order_items
-- ============================================================
CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_key         TEXT NOT NULL,
  product_name        TEXT NOT NULL,
  variant_label       TEXT,
  quantity            INTEGER NOT NULL DEFAULT 1,
  unit_price_cents    INTEGER NOT NULL,
  is_custom           BOOLEAN NOT NULL DEFAULT false,
  custom_image_url    TEXT,
  custom_metadata     JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items (order_id);

-- ============================================================
-- product_waitlist
-- ============================================================
CREATE TABLE product_waitlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  product_key  TEXT NOT NULL,
  product_name TEXT,
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_product_waitlist_email_product
  ON product_waitlist (lower(email), product_key);

CREATE INDEX idx_product_waitlist_pending
  ON product_waitlist (product_key)
  WHERE notified_at IS NULL;
