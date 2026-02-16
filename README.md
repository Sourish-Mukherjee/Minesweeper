# 💣 Minesweeper

A real-time Minesweeper web game with **singleplayer** and **multiplayer** modes, built with Node.js.

## Features

- **Singleplayer** — Classic Minesweeper with flood-fill reveal, flagging, and countdown timer
- **Multiplayer** — Create/join rooms with a 6-char code; everyone plays the **same board** and races for the fastest time
- **Difficulties**:
  | Difficulty | Grid | Mines | Time Limit |
  |-----------|------|-------|-----------:|
  | Easy | 9×9 | 10 | 2 min |
  | Medium | 16×16 | 40 | 10 min |
- **Leaderboard** — Home screen shows three views:
  - 🎮 **SP Best** — Singleplayer fastest completion times
  - 👥 **MP Best** — Multiplayer fastest completion times
  - 🏆 **MP Wins** — Players with the most multiplayer victories
- **Premium UI** — Dark glassmorphism theme, neon accents, cell animations, confetti on win 🎉

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla HTML / CSS / JS
- **Database**: Supabase (PostgreSQL) — optional, falls back to in-memory

## Getting Started

```bash
# Install dependencies
npm install

# Start the server (with hot reload)
npm run dev

# Open in browser
open http://localhost:3000
```

## Supabase Setup (optional)

Leaderboard data persists when connected to Supabase. Without it, scores are stored in-memory and reset on restart.

1. Create a project at [supabase.com](https://supabase.com)
2. Run `db/schema.sql` in the Supabase SQL Editor
3. Copy `.env.example` → `.env` and fill in your credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Deploy to Render.com

1. Connect your GitHub repo as a **Web Service**
2. Set **Build Command**: `npm install` · **Start Command**: `npm start`
3. Add environment variables: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## How to Play

### Singleplayer
1. Enter your name, pick a difficulty, and click **Singleplayer**
2. **Left-click** to reveal a cell · **Right-click** to flag
3. Reveal all non-mine cells before time runs out!

### Multiplayer
1. **Player 1**: Click **Create Room** → share the 6-char room code
2. **Player 2+**: Click **Join Room** → enter the code
3. Host clicks **Start Game** → everyone plays the same board
4. Fastest solver wins! 🏆

## Project Structure

```
├── src/
│   ├── server.js      # Express + Socket.IO server
│   ├── game.js        # Core game logic (board gen, reveal, flag, win check)
│   └── db.js          # Storage layer (Supabase or in-memory fallback)
├── public/
│   ├── index.html     # Game UI (menu, lobby, board, results)
│   ├── style.css      # Dark glassmorphism theme
│   └── app.js         # Client-side game logic & Socket.IO integration
├── db/
│   └── schema.sql     # Supabase table & index definitions
├── .env.example       # Environment variable template
├── package.json
└── README.md
```

## License

MIT
