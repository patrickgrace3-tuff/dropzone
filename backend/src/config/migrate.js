// Run with: node src/config/migrate.js
// Creates all tables if they don't exist

import { query, connectDB } from './db.js';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
  console.log('Running migrations...');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id              TEXT PRIMARY KEY,
      username        TEXT UNIQUE NOT NULL,
      email           TEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL,
      display_name    TEXT DEFAULT '',
      avatar          TEXT DEFAULT '',
      bio             TEXT DEFAULT '',
      role            TEXT DEFAULT 'buyer',
      stripe_account  TEXT,
      seller_verified BOOLEAN DEFAULT false,
      seller_rating   REAL DEFAULT 0,
      seller_reviews  INTEGER DEFAULT 0,
      seller_sales    INTEGER DEFAULT 0,
      seller_revenue  REAL DEFAULT 0,
      is_banned       BOOLEAN DEFAULT false,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS listings (
      id                TEXT PRIMARY KEY,
      seller_id         TEXT NOT NULL REFERENCES users(id),
      title             TEXT NOT NULL,
      description       TEXT NOT NULL,
      category          TEXT NOT NULL,
      condition         TEXT NOT NULL,
      images            JSONB DEFAULT '[]',
      type              TEXT NOT NULL,
      auction_start     REAL DEFAULT 0,
      auction_current   REAL DEFAULT 0,
      auction_bidder    TEXT,
      auction_bids      INTEGER DEFAULT 0,
      auction_reserve   REAL,
      auction_ends      TIMESTAMPTZ,
      auction_duration  INTEGER DEFAULT 7,
      buynow_price      REAL,
      buynow_qty        INTEGER DEFAULT 1,
      buynow_sold       INTEGER DEFAULT 0,
      live_show_id      TEXT,
      is_live_active    BOOLEAN DEFAULT false,
      status            TEXT DEFAULT 'draft',
      tags              JSONB DEFAULT '[]',
      views             INTEGER DEFAULT 0,
      shipping_free     BOOLEAN DEFAULT false,
      shipping_weight   REAL,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bids (
      id          TEXT PRIMARY KEY,
      listing_id  TEXT NOT NULL REFERENCES listings(id),
      bidder_id   TEXT NOT NULL REFERENCES users(id),
      amount      REAL NOT NULL,
      is_winning  BOOLEAN DEFAULT false,
      is_live     BOOLEAN DEFAULT false,
      show_id     TEXT,
      status      TEXT DEFAULT 'active',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS live_shows (
      id                  TEXT PRIMARY KEY,
      seller_id           TEXT NOT NULL REFERENCES users(id),
      title               TEXT NOT NULL,
      description         TEXT DEFAULT '',
      scheduled_at        TIMESTAMPTZ NOT NULL,
      started_at          TIMESTAMPTZ,
      ended_at            TIMESTAMPTZ,
      status              TEXT DEFAULT 'scheduled',
      stream_key          TEXT,
      playback_id         TEXT,
      inventory           JSONB DEFAULT '[]',
      current_item_index  INTEGER DEFAULT -1,
      viewer_count        INTEGER DEFAULT 0,
      total_revenue       REAL DEFAULT 0,
      chat_enabled        BOOLEAN DEFAULT true,
      category            TEXT DEFAULT '',
      tags                JSONB DEFAULT '[]',
      thumbnail           TEXT DEFAULT '',
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS orders (
      id              TEXT PRIMARY KEY,
      buyer_id        TEXT NOT NULL REFERENCES users(id),
      seller_id       TEXT NOT NULL REFERENCES users(id),
      listing_id      TEXT NOT NULL REFERENCES listings(id),
      type            TEXT NOT NULL,
      amount          REAL NOT NULL,
      platform_fee    REAL DEFAULT 0,
      total           REAL NOT NULL,
      status          TEXT DEFAULT 'pending_payment',
      shipping_addr   JSONB DEFAULT '{}',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_listings_status   ON listings(status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category, status)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_listings_seller   ON listings(seller_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bids_listing      ON bids(listing_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_bids_bidder       ON bids(bidder_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_buyer      ON orders(buyer_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_orders_seller     ON orders(seller_id)`);

  console.log('✅ All migrations complete');
  process.exit(0);
}

connectDB().then(migrate).catch(err => { console.error(err); process.exit(1); });
