# 💣 Minesweeper

A real-time Minesweeper web game with **singleplayer** and **multiplayer** modes, built with Node.js.

## Features

- **Singleplayer** — Classic Minesweeper with flood-fill reveal, flagging, and countdown timer
- **Multiplayer** — Create/join rooms with a 6-char code; everyone plays the **same board** and races for the fastest time
- **Difficulties**:
  | Difficulty | Grid | Mines | Time Limit |
  |-----------|------|-------|-----------|
  | Easy | 9×9 | 10 | 2 min |
  | Medium | 16×16 | 40 | 10 min |
- **Leaderboard** — Multiplayer results ranked by completion time
- **Premium UI** — Dark glassmorphism theme, neon accents, cell animations, confetti on win 🎉

## Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla HTML / CSS / JS

## Getting Started

```bash
# Install dependencies
npm install

# Start the server
npm run dev

# Open in browser
open http://localhost:3000
```

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
├── server.js          # Express + Socket.IO server
├── game.js            # Core game logic (board gen, reveal, flag, win check)
├── package.json
└── public/
    ├── index.html     # Game UI (menu, lobby, board, results)
    ├── style.css      # Dark glassmorphism theme
    └── app.js         # Client-side game logic & Socket.IO integration
```

## License

MIT
