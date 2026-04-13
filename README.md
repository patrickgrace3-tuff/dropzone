# ⚡ Dropzone — Live Auction Marketplace

Full-stack auction + live show marketplace. **No MongoDB, no Docker, no external database needed** — uses SQLite (a file on your computer).

## Requirements
- Node.js 18+ (you already have this ✅)
- That's it!

## Setup (3 steps)

### 1. Install dependencies
```bash
npm run install:all
```

### 2. Create your .env file
```bash
cp backend/.env.example backend/.env
```
The defaults work out of the box. Optionally add your `ANTHROPIC_API_KEY` for AI features.

### 3. Start the app
```bash
npm run dev
```

Open **http://localhost:5173** — register an account and you're live!

The SQLite database file (`dropzone.db`) is auto-created in the `backend/` folder on first run.

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand |
| Backend | Node.js, Express, Socket.io |
| Database | SQLite via better-sqlite3 (zero setup) |
| Auth | JWT + bcryptjs |
| Realtime | WebSockets (Socket.io) |
| AI | Anthropic Claude API (optional) |
| Payments | Stripe (optional) |
| Images | Cloudinary (optional) |

## Optional Features
These work without any extra config in dev mode:
- **AI pricing/descriptions** — add `ANTHROPIC_API_KEY` to `backend/.env`
- **Payments** — add `STRIPE_SECRET_KEY` to `backend/.env`  
- **Image uploads** — add Cloudinary keys to `backend/.env`
- **Live video** — integrate Mux or Agora (placeholder in the UI)

## Project Structure
```
dropzone/
├── backend/              # Node.js + Express API
│   ├── src/
│   │   ├── index.js      # Server entry
│   │   ├── config/db.js  # SQLite setup + schema
│   │   ├── routes/       # API routes
│   │   ├── middleware/   # Auth, errors
│   │   └── socket/       # WebSocket handlers
│   └── .env.example
└── frontend/             # React + Vite
    └── src/
        ├── pages/        # All pages
        ├── components/   # Shared components
        ├── services/     # API + socket clients
        └── context/      # Auth store (Zustand)
```

## API
- `POST /api/auth/register` — create account
- `POST /api/auth/login` — login
- `GET  /api/listings` — browse marketplace
- `POST /api/listings` — create listing (sellers)
- `POST /api/bids/:id` — place a bid
- `GET  /api/shows` — list live shows
- `POST /api/shows` — create a show
- `POST /api/ai/pricing` — AI price suggestions
