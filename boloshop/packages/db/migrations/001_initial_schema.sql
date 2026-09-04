-- 001_initial_schema.sql
-- BoloShop initial schema: users, sellers, products, videos, orders, team_purchases.
--
-- Conventions used throughout:
--   * UUID primary keys (gen_random_uuid) so ids can be minted client-side.
--   * PKR money as NUMERIC(12,2); never floating point.
--   * TIMESTAMPTZ for every timestamp; the app stores UTC and renders PKT.
--   * ON DELETE CASCADE for content a seller owns, ON DELETE RESTRICT for
--     anything an order references, so financial history is never orphaned.
--
-- The migration runner wraps each file in a transaction, so this file opens
-- none of its own. Applying it by hand: psql -1 -f 001_initial_schema.sql

-- gen_random_uuid() is built in from PostgreSQL 13; pgcrypto covers older servers.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');

-- Pakistan's major languages. Add values with ALTER TYPE ... ADD VALUE, never
-- by rewriting this file.
CREATE TYPE language_preference AS ENUM (
    'urdu',
    'pashto',
    'punjabi',
    'sindhi',
    'saraiki',
    'balochi',
    'english'
);

CREATE TYPE order_status AS ENUM ('pending', 'shipped', 'delivered', 'rto_returned');

-- Cash on delivery is the only method at launch. Easypaisa / JazzCash join this
-- enum when the payout pipeline lands.
CREATE TYPE payment_method AS ENUM ('cod');

CREATE TYPE team_purchase_status AS ENUM ('pending_join', 'completed', 'expired');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at honest
-- ---------------------------------------------------------------------------

CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number        TEXT NOT NULL,
    role                user_role NOT NULL DEFAULT 'buyer',
    language_preference language_preference NOT NULL DEFAULT 'urdu',
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- E.164, stored canonically (+923001234567). Normalise before insert.
    CONSTRAINT users_phone_number_e164 CHECK (phone_number ~ '^\+[1-9][0-9]{7,14}$')
);

-- Requested index on phone_number. Unique, because it is the login identity:
-- one btree serves both the constraint and the lookup.
CREATE UNIQUE INDEX idx_users_phone_number ON users (phone_number);

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- sellers
-- ---------------------------------------------------------------------------

CREATE TABLE sellers (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                    UUID NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    store_name                 TEXT NOT NULL,

    -- Return-to-origin risk, 0.00 (never returns) to 100.00 (always returns).
    -- Drives COD limits; recomputed by the order service, never set by hand.
    rto_risk_score             NUMERIC(5, 2) NOT NULL DEFAULT 0
                               CHECK (rto_risk_score BETWEEN 0 AND 100),

    -- { "bank_name": ..., "account_title": ..., "iban": ... }
    -- Sensitive: encrypt at the application layer before writing here, and
    -- never SELECT it into a response payload.
    bank_details               JSONB,

    -- Mobile-wallet payout number (Easypaisa or JazzCash), E.164.
    easypaisa_jazzcash_account TEXT
                               CHECK (easypaisa_jazzcash_account ~ '^\+[1-9][0-9]{7,14}$'),

    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT sellers_store_name_not_blank CHECK (btrim(store_name) <> '')
);

CREATE INDEX idx_sellers_rto_risk_score ON sellers (rto_risk_score DESC);

CREATE TRIGGER sellers_set_updated_at
    BEFORE UPDATE ON sellers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

CREATE TABLE products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id        UUID NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,
    title            TEXT NOT NULL,

    -- Urdu-language description shown in the app; the title stays as the
    -- seller typed it (often Roman Urdu or English).
    description_urdu TEXT,

    price_pkr        NUMERIC(12, 2) NOT NULL CHECK (price_pkr >= 0),
    category         TEXT NOT NULL,
    stock_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT products_title_not_blank CHECK (btrim(title) <> '')
);

-- Requested index on category (browse and filter path).
CREATE INDEX idx_products_category ON products (category);

-- Seller storefront listing, newest first.
CREATE INDEX idx_products_seller_id_created_at ON products (seller_id, created_at DESC);

CREATE TRIGGER products_set_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------

CREATE TABLE videos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- A video may outlive the product it was shot for, so the link is nullable
    -- and clears rather than cascading.
    product_id       UUID REFERENCES products (id) ON DELETE SET NULL,

    seller_id        UUID NOT NULL REFERENCES sellers (id) ON DELETE CASCADE,

    -- HLS manifest (.m3u8) produced by media-service; adaptive bitrate is the
    -- whole point on Pakistani mobile networks.
    hls_stream_url   TEXT NOT NULL,

    duration_seconds INTEGER CHECK (duration_seconds >= 0),
    is_promoted      BOOLEAN NOT NULL DEFAULT FALSE,
    boost_budget_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (boost_budget_pkr >= 0),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- A promoted video must be paid for.
    CONSTRAINT videos_promoted_requires_budget
        CHECK (NOT is_promoted OR boost_budget_pkr > 0)
);

CREATE INDEX idx_videos_seller_id_created_at ON videos (seller_id, created_at DESC);
CREATE INDEX idx_videos_product_id ON videos (product_id);

-- Promoted-feed ranking: only the promoted rows are indexed.
CREATE INDEX idx_videos_promoted ON videos (boost_budget_pkr DESC, created_at DESC)
    WHERE is_promoted;

CREATE TRIGGER videos_set_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- RESTRICT: an order is a financial record, so neither party can be
    -- deleted out from under it.
    buyer_id            UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    seller_id           UUID NOT NULL REFERENCES sellers (id) ON DELETE RESTRICT,

    total_amount_pkr    NUMERIC(12, 2) NOT NULL CHECK (total_amount_pkr >= 0),

    -- BoloShop's 1% platform commission, computed by the database so no caller
    -- can disagree with it. Changing the rate means a new migration.
    commission_fee_pkr  NUMERIC(12, 2)
                        GENERATED ALWAYS AS (round(total_amount_pkr * 0.01, 2)) STORED,

    status              order_status NOT NULL DEFAULT 'pending',
    payment_method      payment_method NOT NULL DEFAULT 'cod',

    -- Assigned when the courier accepts the parcel; null while pending.
    courier_tracking_id TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT orders_shipped_orders_have_tracking
        CHECK (status = 'pending' OR courier_tracking_id IS NOT NULL)
);

-- Requested index on order status (fulfilment and RTO dashboards).
CREATE INDEX idx_orders_order_status ON orders (status, created_at DESC);

CREATE INDEX idx_orders_buyer_id_created_at ON orders (buyer_id, created_at DESC);
CREATE INDEX idx_orders_seller_id_created_at ON orders (seller_id, created_at DESC);

-- Courier webhooks arrive keyed by tracking id.
CREATE UNIQUE INDEX idx_orders_courier_tracking_id ON orders (courier_tracking_id)
    WHERE courier_tracking_id IS NOT NULL;

CREATE TRIGGER orders_set_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- team_purchases
-- ---------------------------------------------------------------------------

CREATE TABLE team_purchases (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id             UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    inviter_id           UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,

    -- Null until somebody accepts the invite.
    invitee_id           UUID REFERENCES users (id) ON DELETE RESTRICT,

    status               team_purchase_status NOT NULL DEFAULT 'pending_join',
    discount_applied_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
                         CHECK (discount_applied_pct BETWEEN 0 AND 100),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT team_purchases_no_self_invite CHECK (inviter_id IS DISTINCT FROM invitee_id),

    -- A completed team purchase has somebody on the other side of it.
    CONSTRAINT team_purchases_completed_has_invitee
        CHECK (status <> 'completed' OR invitee_id IS NOT NULL)
);

CREATE INDEX idx_team_purchases_order_id ON team_purchases (order_id);
CREATE INDEX idx_team_purchases_status ON team_purchases (status);
CREATE INDEX idx_team_purchases_inviter_id ON team_purchases (inviter_id);

-- One person can only join a given team purchase once.
CREATE UNIQUE INDEX idx_team_purchases_order_invitee ON team_purchases (order_id, invitee_id)
    WHERE invitee_id IS NOT NULL;

CREATE TRIGGER team_purchases_set_updated_at
    BEFORE UPDATE ON team_purchases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
