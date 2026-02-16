// server.js — Express + Socket.IO server for Minesweeper

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Load .env if present (for Supabase credentials)
try { require('dotenv').config(); } catch (_) { /* dotenv not installed yet */ }

const {
  DIFFICULTIES,
  generateBoard,
  revealCell,
  flagCell,
  checkWin,
  getClientView,
} = require('./game');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

const db = require('./db');

// ── REST API for leaderboard ────────────────────────────────
app.get('/api/leaderboard/sp/:difficulty', async (req, res) => {
  const diff = req.params.difficulty;
  if (!['easy', 'medium'].includes(diff)) return res.status(400).json({ error: 'Invalid difficulty' });
  try {
    res.json(await db.getSPBestTimes(diff));
  } catch (e) {
    console.error('Leaderboard fetch error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/leaderboard/mp/:difficulty', async (req, res) => {
  const diff = req.params.difficulty;
  if (!['easy', 'medium'].includes(diff)) return res.status(400).json({ error: 'Invalid difficulty' });
  try {
    res.json(await db.getMPBestTimes(diff));
  } catch (e) {
    console.error('Leaderboard fetch error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/leaderboard/mp-wins/:difficulty', async (req, res) => {
  const diff = req.params.difficulty;
  if (!['easy', 'medium'].includes(diff)) return res.status(400).json({ error: 'Invalid difficulty' });
  try {
    res.json(await db.getMPMostWins(diff));
  } catch (e) {
    console.error('Leaderboard fetch error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  const { name, difficulty, time, mode } = req.body;
  if (!name || !difficulty || time == null || !mode) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  if (!['easy', 'medium'].includes(difficulty)) {
    return res.status(400).json({ error: 'Invalid difficulty' });
  }
  try {
    await db.addEntry({
      name: String(name).slice(0, 16),
      difficulty,
      time: Number(time),
      mode,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Leaderboard submit error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// ── In-memory room store ────────────────────────────────────────────
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

// ── Socket.IO events ───────────────────────────────────────────────
io.on('connection', (socket) => {
  let currentRoom = null;
  let playerName = null;

  socket.on('create-room', ({ difficulty, name }) => {
    const code = generateRoomCode();
    const seed = Date.now();
    const config = DIFFICULTIES[difficulty];
    if (!config) return socket.emit('error-msg', 'Invalid difficulty');

    const room = {
      code,
      difficulty,
      seed,
      config,
      host: socket.id,
      players: new Map(),
      started: false,
      startTime: null,
    };

    // Add host as a player
    const boardData = generateBoard(difficulty, seed);
    room.players.set(socket.id, {
      name: name || 'Player 1',
      board: boardData.board,
      rows: boardData.rows,
      cols: boardData.cols,
      finished: false,
      won: false,
      time: null,
      startTime: null,
    });

    rooms.set(code, room);
    socket.join(code);
    currentRoom = code;
    playerName = name || 'Player 1';

    socket.emit('room-created', {
      code,
      difficulty,
      timeLimit: config.timeLimit,
      players: getPlayerList(room),
    });
  });

  socket.on('join-room', ({ code, name }) => {
    const room = rooms.get(code);
    if (!room) return socket.emit('error-msg', 'Room not found');
    if (room.started) return socket.emit('error-msg', 'Game already in progress');
    if (room.players.size >= 8) return socket.emit('error-msg', 'Room is full');

    const boardData = generateBoard(room.difficulty, room.seed);
    room.players.set(socket.id, {
      name: name || `Player ${room.players.size + 1}`,
      board: boardData.board,
      rows: boardData.rows,
      cols: boardData.cols,
      finished: false,
      won: false,
      time: null,
      startTime: null,
    });

    socket.join(code);
    currentRoom = code;
    playerName = name || `Player ${room.players.size}`;

    socket.emit('room-joined', {
      code,
      difficulty: room.difficulty,
      timeLimit: room.config.timeLimit,
      players: getPlayerList(room),
    });

    io.to(code).emit('player-list', getPlayerList(room));
  });

  socket.on('start-game', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.host !== socket.id) return;

    room.started = true;
    room.startTime = Date.now();

    // Give each player their own start time
    for (const [, player] of room.players) {
      player.startTime = Date.now();
    }

    // Emit to each player their own client view
    for (const [sid, player] of room.players) {
      const view = getClientView(player.board, player.rows, player.cols, false);
      io.to(sid).emit('game-started', {
        board: view,
        rows: player.rows,
        cols: player.cols,
        timeLimit: room.config.timeLimit,
        players: getPlayerList(room),
      });
    }
  });

  socket.on('reveal', ({ row, col }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.started) return;
    const player = room.players.get(socket.id);
    if (!player || player.finished) return;

    const result = revealCell(player.board, player.rows, player.cols, row, col);

    if (result.hitMine) {
      player.finished = true;
      player.won = false;
      player.time = (Date.now() - player.startTime) / 1000;

      const view = getClientView(player.board, player.rows, player.cols, true);
      socket.emit('game-over', {
        won: false,
        board: view,
        time: player.time,
        explodedCell: { r: row, c: col },
      });

      io.to(currentRoom).emit('player-update', getPlayerList(room));
      checkAllFinished(room);
      return;
    }

    if (checkWin(player.board, player.rows, player.cols)) {
      player.finished = true;
      player.won = true;
      player.time = (Date.now() - player.startTime) / 1000;

      // Record to leaderboard
      db.addEntry({
        name: player.name,
        difficulty: room.difficulty,
        time: player.time,
        mode: 'multiplayer',
      });

      const view = getClientView(player.board, player.rows, player.cols, true);
      socket.emit('game-over', {
        won: true,
        board: view,
        time: player.time,
      });

      io.to(currentRoom).emit('player-update', getPlayerList(room));
      checkAllFinished(room);
      return;
    }

    socket.emit('reveal-result', {
      cells: result.revealedCells,
    });
  });

  socket.on('flag', ({ row, col }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.started) return;
    const player = room.players.get(socket.id);
    if (!player || player.finished) return;

    const result = flagCell(player.board, row, col);
    if (result.changed) {
      socket.emit('flag-result', { row, col, flagged: result.flagged });
    }
  });

  socket.on('timeout', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !room.started) return;
    const player = room.players.get(socket.id);
    if (!player || player.finished) return;

    player.finished = true;
    player.won = false;
    player.time = room.config.timeLimit;

    const view = getClientView(player.board, player.rows, player.cols, true);
    socket.emit('game-over', {
      won: false,
      board: view,
      time: player.time,
      timeout: true,
    });

    io.to(currentRoom).emit('player-update', getPlayerList(room));
    checkAllFinished(room);
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.players.delete(socket.id);
    if (room.players.size === 0) {
      rooms.delete(currentRoom);
    } else {
      // Transfer host if needed
      if (room.host === socket.id) {
        room.host = room.players.keys().next().value;
      }
      io.to(currentRoom).emit('player-list', getPlayerList(room));
    }
  });
});

function getPlayerList(room) {
  const list = [];
  for (const [sid, player] of room.players) {
    list.push({
      id: sid,
      name: player.name,
      finished: player.finished,
      won: player.won,
      time: player.time,
      isHost: sid === room.host,
    });
  }
  return list;
}

function checkAllFinished(room) {
  for (const [, player] of room.players) {
    if (!player.finished) return;
  }
  // All players done — send final leaderboard
  const leaderboard = getPlayerList(room)
    .sort((a, b) => {
      if (a.won && !b.won) return -1;
      if (!a.won && b.won) return 1;
      return (a.time || Infinity) - (b.time || Infinity);
    });
  io.to(room.code).emit('match-complete', { leaderboard });
}

// ── Start server ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Minesweeper server running at http://localhost:${PORT}`);
});
