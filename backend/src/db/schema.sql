-- Re-export of migrations/001_initial_schema.sql for convenient Supabase SQL Editor execution
-- Copy and paste the contents of this file directly into the Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_store_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(128),
    category VARCHAR(128),
    sku VARCHAR(64),
    store_url TEXT NOT NULL,
    image_url TEXT,
    tracking_status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (tracking_status IN ('active', 'paused', 'untracked')),
    last_scraped_at TIMESTAMPTZ,
    last_price NUMERIC(10, 2) CHECK (last_price IS NULL OR last_price > 0),
    last_stock INTEGER CHECK (last_stock IS NULL OR last_stock >= 0),
    last_scrape_status VARCHAR(32) DEFAULT 'pending' CHECK (last_scrape_status IN ('pending', 'success', 'retried', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_products_external_id ON tracked_products (external_store_id);
CREATE INDEX IF NOT EXISTS idx_tracked_products_tracking_status ON tracked_products (tracking_status);
CREATE INDEX IF NOT EXISTS idx_tracked_products_schedule ON tracked_products (tracking_status, last_scraped_at);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_tracked_products_updated_at ON tracked_products;
CREATE TRIGGER trigger_tracked_products_updated_at
    BEFORE UPDATE ON tracked_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    stock INTEGER NOT NULL CHECK (stock >= 0),
    stock_status VARCHAR(32) NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'out_of_stock', 'unknown')),
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_time ON price_history (product_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped_at ON price_history (scraped_at DESC);

CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL CHECK (status IN ('success', 'retried', 'failed')),
    attempt_number INTEGER NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
    duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    http_status_code INTEGER,
    error_type VARCHAR(64),
    error_message TEXT,
    extracted_price NUMERIC(10, 2),
    extracted_stock INTEGER,
    engine VARCHAR(32) DEFAULT 'playwright'
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_time ON scrape_logs (product_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_status ON scrape_logs (status);
