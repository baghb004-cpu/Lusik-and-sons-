-- ============================================================
-- Lusik & Sons — Postgres schema for Netlify Database
-- ============================================================
-- Apply once after `netlify database init`:
--   netlify db query --file netlify/schema.sql
-- or via psql with the DATABASE_URL Netlify printed.
--
-- Differences from the old Supabase schema:
--   * No Row-Level Security. Supabase used RLS as the authorization layer
--     because the browser talked directly to Postgres. On the Netlify
--     stack, ALL access goes through Netlify Functions, which check the
--     Netlify Identity JWT themselves. Postgres trusts the Function.
--   * No auth.users mirror table. Netlify Identity owns user identity;
--     we store its UUID `sub` claim as `user_id` and key everything off
--     that. There is no FK to an auth table because the auth table
--     lives in a different system (Identity), not in our DB.
--   * `profiles.id` IS the Identity UUID, not a separate generated PK.
--     This keeps joins simple: `profiles.id = orders.user_id = ...`.
-- ============================================================

-- For gen_random_uuid() (used on rows that aren't keyed off Identity).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- profiles
-- ============================================================
-- One row per authenticated customer. Created lazily on first sign-in
-- by the `profile` Function (no DB trigger, because Identity events
-- don't fire into Postgres — the function does the upsert itself).
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id             UUID PRIMARY KEY,               -- == Netlify Identity sub
  email          TEXT NOT NULL,
  full_name      TEXT,
  phone          TEXT,
  avatar_url     TEXT,                           -- public URL into Netlify Blobs
  saved_designs  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of { id, label, design, created_at }
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotent column adds for previously-provisioned DBs.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS saved_designs JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (lower(email));

-- ============================================================
-- addresses
-- ============================================================
-- Shipping addresses customers save for re-use at checkout.
-- ============================================================
CREATE TABLE IF NOT EXISTS addresses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label        TEXT,                             -- "Home", "Mom's place", etc.
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

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id, is_default DESC, created_at DESC);

-- ============================================================
-- saved_carts
-- ============================================================
-- One row per user, upserted on every debounced cart change. The
-- cart shape is whatever the browser stores in local state, including
-- per-item color presets and custom-image references. We persist as
-- JSONB so the cart shape can evolve without DDL.
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_carts (
  user_id     UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  cart_data   JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- orders
-- ============================================================
-- One row per Stripe Checkout Session that completes successfully.
-- Written by the `stripe-webhook` Function on `checkout.session.completed`.
-- `user_id` is nullable: guest orders have NULL until link-guest-order
-- claims them after the customer creates an account with the same email.
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          TEXT NOT NULL UNIQUE,    -- human-friendly e.g. "LS-2026-0142"
  stripe_session_id     TEXT UNIQUE,             -- idempotency key for checkout.session.completed
  stripe_payment_intent TEXT,                    -- captured at insert; used to match refund webhooks back to the order
  refunded_cents        INTEGER NOT NULL DEFAULT 0,  -- running total of refunds applied to this order (partial refunds accumulate)
  user_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  customer_email        TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'paid',         -- paid | refunded | cancelled
  fulfillment_status    TEXT NOT NULL DEFAULT 'in_progress',  -- in_progress | shipped | delivered
  subtotal_cents        INTEGER NOT NULL,
  shipping_cents        INTEGER NOT NULL DEFAULT 0,
  tax_cents             INTEGER NOT NULL DEFAULT 0,
  total_cents           INTEGER NOT NULL,
  shipping_address      JSONB,                   -- frozen at time of order
  carrier               TEXT,
  tracking_number       TEXT,
  estimated_ship_date   DATE,
  social_consent        JSONB,                   -- {allowed, platforms, handles, consented_at}
  gift                  JSONB,                   -- {is_gift, message, hide_prices}
  finished_photo_key          TEXT,                    -- Netlify Blobs key for "Lusik's finished piece" photo
  finished_photo_emailed_at   TIMESTAMPTZ,             -- set when the customer was first emailed about the photo (dedupe gate)
  admin_notes                 TEXT,                    -- internal-only notes Lusik writes from the admin view
  shipped_at                  TIMESTAMPTZ,             -- set when fulfillment_status first transitions to "shipped"
  gift_reminder_opt_in        BOOLEAN NOT NULL DEFAULT false,  -- customer opted in at checkout to a 1-year-later reminder
  gift_reminder_sent_at       TIMESTAMPTZ,             -- set when the gift-reminder scheduled job emailed this customer (dedupe gate, one-shot)
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If the orders table already exists from a previous deploy, make
-- sure newer columns get added. All no-ops if the column is
-- already present.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift                       JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS social_consent             JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_photo_key         TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_photo_emailed_at  TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes                TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at                 TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent      TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_cents             INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_reminder_opt_in       BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gift_reminder_sent_at      TIMESTAMPTZ;

-- Partial index so the daily reminder job can scan only the small set
-- of pending reminders rather than the whole orders table.
CREATE INDEX IF NOT EXISTS idx_orders_gift_reminder_pending
  ON orders (created_at)
  WHERE gift_reminder_opt_in = true AND gift_reminder_sent_at IS NULL;

-- ============================================================
-- product_waitlist
-- ============================================================
-- One row per (email, product_key). Customers sign up via the
-- WaitlistModal for products still marked status: "placeholder"
-- in CATALOG. When Lusik launches the product she clicks "Notify"
-- in the admin panel; admin-waitlist-notify emails everyone with
-- notified_at IS NULL and stamps the timestamp.
--
-- UNIQUE (lower(email), product_key) means a customer who signs
-- up twice for the same product just updates their row — no
-- duplicate emails, no surprise re-notifications.
-- ============================================================
CREATE TABLE IF NOT EXISTS product_waitlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  product_key  TEXT NOT NULL,
  product_name TEXT,                  -- captured at signup for the email composer
  notified_at  TIMESTAMPTZ,           -- stamped after a successful Resend send
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lowercased email so case differences don't create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_waitlist_email_product
  ON product_waitlist (lower(email), product_key);

-- Partial index for the admin "notify" sweep — only scan rows that
-- still need a send.
CREATE INDEX IF NOT EXISTS idx_product_waitlist_pending
  ON product_waitlist (product_key)
  WHERE notified_at IS NULL;

-- Index on stripe_payment_intent so refund webhooks (which arrive
-- with a payment_intent reference) can find the matching order
-- without a full table scan.
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders (stripe_payment_intent);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders (lower(customer_email));
CREATE INDEX IF NOT EXISTS idx_orders_session ON orders (stripe_session_id);

-- ============================================================
-- order_items
-- ============================================================
-- One row per line item in an order. Custom-embroidery uploads are
-- stored as Netlify Blob keys in `custom_image_url`.
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_key         TEXT NOT NULL,             -- "blanket-...", "bib", "bib-hand", "towel"
  product_name        TEXT NOT NULL,
  variant_label       TEXT,
  quantity            INTEGER NOT NULL DEFAULT 1,
  unit_price_cents    INTEGER NOT NULL,
  is_custom           BOOLEAN NOT NULL DEFAULT false,
  custom_image_url    TEXT,
  custom_metadata     JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
