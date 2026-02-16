# 💣 Minesweeper

A real-time Minesweeper web game with **singleplayer** and **multiplayer** modes, built with Node.js, Express, and Socket.IO.

## ✨ Features

### Core Gameplay
- **Singleplayer** — Classic Minesweeper with flood-fill reveal, flagging, and countdown timer
- **Multiplayer** — Create/join rooms with a 6-char code; everyone plays the same board and races for the fastest time
- **Difficulties**: Easy (9×9, 10 mines, 2 min) and Medium (16×16, 40 mines, 10 min)

### Multiplayer Features
- **Live Opponent Progress** — See opponents' reveal progress in real-time with progress bars
- **Spectator Mode** — Join any room as a spectator to watch all players' progress
- **Chat System** — Text chat in the lobby + emoji reactions during gameplay (😱 💀 🎉 😤 🔥 👀)

### Visual & Audio
- **4 Themes** — Midnight (default), Neon, Ocean, and Retro — persisted across sessions
- **Sound Effects** — Synthesized Web Audio API sounds: click, reveal, flag, explosion, win, timer tick
- **Animated Mine Explosions** — Chain-reaction BFS explosion spreading outward from the detonated mine
- **Confetti** — Canvas particle celebration on wins

### Leaderboard & Records
- **Smart Leaderboard** — Only keeps each player's best time per difficulty/mode
- **Personal Best Tracking** — Shows "Previous Best → New Best!" or "First Win!" after each game
- **Mandatory Name** — Ensures all players are identified for a fair leaderboard

## 📁 Project Structure

```
├── public/             # Frontend (served as static files)
│   ├── index.html      # App shell with all screens
│   ├── app.js          # Client logic, SFX, themes, game engine
│   └── style.css       # Full CSS with 4 theme variants
├── src/                # Backend
│   ├── server.js       # Express + Socket.IO server
│   ├── game.js         # Minesweeper game logic (shared)
│   └── db.js           # Storage layer (Supabase or in-memory)
├── package.json
└── README.md
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or with auto-reload during development
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 💾 Database (optional)

By default, the leaderboard uses in-memory storage. To persist data, configure your database credentials in a `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
```

See `schema.sql` for the database schema.

## 🌐 Deployment

Deploy to any Node.js hosting platform (Railway, Render, Fly.io, Heroku, etc.):

1. Push to a Git repository
2. Connect to your hosting provider
3. Set the start command to `npm start`
4. Optionally set database environment variables

The app runs on the port specified by `PORT` env variable (default: 3000).

## 🛠 Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JS, CSS3 with custom properties
- **Audio**: Web Audio API (no external sound files)
- **Database**: Supabase (optional) or in-memory fallback
