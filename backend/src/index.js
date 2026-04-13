import 'express-async-errors';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, query } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupSocketHandlers } from './socket/index.js';

import authRoutes    from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import bidRoutes     from './routes/bids.js';
import showRoutes    from './routes/shows.js';
import userRoutes    from './routes/users.js';
import paymentRoutes from './routes/payments.js';
import aiRoutes      from './routes/ai.js';
import uploadRoutes  from './routes/uploads.js';
import orderRoutes   from './routes/orders.js';

dotenv.config();

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const app        = express();
const httpServer = createServer(app);

// Allow all origins — works for any Render URL without needing exact config
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    // Allow any onrender.com subdomain and localhost
    if (!origin) return callback(null, true);
    const allowed =
      origin.endsWith('.onrender.com') ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1') ||
      origin === (process.env.FRONTEND_URL || '');
    if (allowed) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS','PATCH'],
  allowedHeaders: ['Content-Type','Authorization'],
};

const io = new Server(httpServer, {
  cors: corsOptions,
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // handle preflight for all routes
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, _res, next) => { req.io = io; next(); });

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.use('/api/auth',     authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/bids',     bidRoutes);
app.use('/api/shows',    showRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/ai',       aiRoutes);
app.use('/api/uploads',  uploadRoutes);
app.use('/api/orders',   orderRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));
app.use(errorHandler);

setupSocketHandlers(io);

const PORT = process.env.PORT || 3001;

connectDB()
  .then(() => query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, display_name TEXT DEFAULT '', avatar TEXT DEFAULT '',
      bio TEXT DEFAULT '', role TEXT DEFAULT 'buyer', seller_rating REAL DEFAULT 0,
      seller_reviews INTEGER DEFAULT 0, seller_sales INTEGER DEFAULT 0,
      seller_revenue REAL DEFAULT 0, is_banned BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, title TEXT NOT NULL,
      description TEXT NOT NULL, category TEXT NOT NULL, condition TEXT NOT NULL,
      images JSONB DEFAULT '[]', type TEXT NOT NULL,
      auction_start REAL DEFAULT 0, auction_current REAL DEFAULT 0,
      auction_bidder TEXT, auction_bids INTEGER DEFAULT 0,
      auction_reserve REAL, auction_ends TIMESTAMPTZ, auction_duration INTEGER DEFAULT 7,
      buynow_price REAL, buynow_qty INTEGER DEFAULT 1, buynow_sold INTEGER DEFAULT 0,
      live_show_id TEXT, is_live_active BOOLEAN DEFAULT false,
      status TEXT DEFAULT 'draft', tags JSONB DEFAULT '[]', views INTEGER DEFAULT 0,
      shipping_free BOOLEAN DEFAULT false, shipping_weight REAL,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, bidder_id TEXT NOT NULL,
      amount REAL NOT NULL, is_winning BOOLEAN DEFAULT false,
      is_live BOOLEAN DEFAULT false, show_id TEXT, status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS live_shows (
      id TEXT PRIMARY KEY, seller_id TEXT NOT NULL, title TEXT NOT NULL,
      description TEXT DEFAULT '', scheduled_at TIMESTAMPTZ NOT NULL,
      started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ, status TEXT DEFAULT 'scheduled',
      stream_key TEXT, playback_id TEXT, inventory JSONB DEFAULT '[]',
      current_item_index INTEGER DEFAULT -1, viewer_count INTEGER DEFAULT 0,
      total_revenue REAL DEFAULT 0, chat_enabled BOOLEAN DEFAULT true,
      category TEXT DEFAULT '', tags JSONB DEFAULT '[]', thumbnail TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, buyer_id TEXT NOT NULL, seller_id TEXT NOT NULL,
      listing_id TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL,
      platform_fee REAL DEFAULT 0, total REAL NOT NULL,
      status TEXT DEFAULT 'pending_payment', shipping_addr JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE listings ADD COLUMN IF NOT EXISTS auction_type TEXT DEFAULT 'standard';
    CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
    CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
    CREATE INDEX IF NOT EXISTS idx_bids_listing    ON bids(listing_id);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer    ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller   ON orders(seller_id);
  `))
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`\n🚀 Dropzone running on port ${PORT}`);
      console.log(`   CORS: allowing *.onrender.com + localhost\n`);
    });
  })
  .catch(err => { console.error('Startup error:', err); process.exit(1); });
