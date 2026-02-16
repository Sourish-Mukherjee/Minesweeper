// app.js — Minesweeper client

// ═══════════════════════════════════════════════════════════════
// DOM Elements
// ═══════════════════════════════════════════════════════════════
const dom = {
  // screens
  menuScreen: document.getElementById('menu-screen'),
  lobbyScreen: document.getElementById('lobby-screen'),
  gameScreen: document.getElementById('game-screen'),
  spectatorScreen: document.getElementById('spectator-screen'),
  resultScreen: document.getElementById('result-screen'),

  // menu
  playerName: document.getElementById('player-name'),
  nameError: document.getElementById('name-error'),
  btnSingleplayer: document.getElementById('btn-singleplayer'),
  btnCreateRoom: document.getElementById('btn-create-room'),
  btnJoinRoom: document.getElementById('btn-join-room'),
  joinModal: document.getElementById('join-modal'),
  roomCodeInput: document.getElementById('room-code-input'),
  btnJoinConfirm: document.getElementById('btn-join-confirm'),
  btnJoinCancel: document.getElementById('btn-join-cancel'),

  // lobby
  lobbyRoomCode: document.getElementById('lobby-room-code'),
  lobbyDifficulty: document.getElementById('lobby-difficulty'),
  lobbyTime: document.getElementById('lobby-time'),
  lobbyPlayers: document.getElementById('lobby-players'),
  btnStartGame: document.getElementById('btn-start-game'),
  lobbyWaiting: document.getElementById('lobby-waiting'),
  btnCopyCode: document.getElementById('btn-copy-code'),

  // lobby chat
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input'),
  btnChatSend: document.getElementById('btn-chat-send'),

  // game
  boardContainer: document.getElementById('board-container'),
  mineCount: document.getElementById('mine-count'),
  timer: document.getElementById('timer'),
  flagCount: document.getElementById('flag-count'),
  btnSoundToggle: document.getElementById('btn-sound-toggle'),

  // game MP sidebar
  mpSidebar: document.getElementById('mp-sidebar'),
  mpPlayerList: document.getElementById('mp-player-list'),
  watchSection: document.getElementById('watch-section'),
  watchPlayerSelect: document.getElementById('watch-player-select'),
  watchedBoardContainer: document.getElementById('watched-board-container'),
  gameChatMessages: document.getElementById('game-chat-messages'),
  gameChatInput: document.getElementById('game-chat-input'),
  btnGameChatSend: document.getElementById('btn-game-chat-send'),

  // spectate banner
  spectateBanner: document.getElementById('spectate-banner'),
  btnWatchOthers: document.getElementById('btn-watch-others'),

  // spectator screen
  spectatorRoomCode: document.getElementById('spectator-room-code'),
  spectatorPlayerSelect: document.getElementById('spectator-player-select'),
  spectatorWatchedBoard: document.getElementById('spectator-watched-board'),
  spectatorPlayerList: document.getElementById('spectator-player-list'),
  spectatorProgressFill: document.getElementById('spectator-progress-fill'),
  spectatorChatMessages: document.getElementById('spectator-chat-messages'),
  spectatorChatInput: document.getElementById('spectator-chat-input'),
  btnSpectatorChatSend: document.getElementById('btn-spectator-chat-send'),

  // result
  resultIcon: document.getElementById('result-icon'),
  resultTitle: document.getElementById('result-title'),
  resultTime: document.getElementById('result-time'),
  personalBestInfo: document.getElementById('personal-best-info'),
  resultLeaderboard: document.getElementById('result-leaderboard'),
  btnPlayAgain: document.getElementById('btn-play-again'),

  // leaderboard
  homeLBList: document.getElementById('home-lb-list'),

  // confetti
  confettiCanvas: document.getElementById('confetti-canvas'),
};

// ═══════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════
let state = {
  mode: null,          // 'singleplayer' | 'multiplayer' | 'spectator'
  difficulty: 'easy',
  board: null,
  rows: 0, cols: 0,
  mines: 0, timeLimit: 0,
  flags: 0,
  revealedCount: 0,
  gameOver: false,
  timerInterval: null,
  timeRemaining: 0,
  roomCode: null,
  isHost: false,
  socketId: null,
  playerFinished: false,
  currentLBMode: 'sp',
  currentLBDiff: 'easy',
};

const socket = io();
socket.on('connect', () => { state.socketId = socket.id; });

// ═══════════════════════════════════════════════════════════════
// SFX Manager (Web Audio API)
// ═══════════════════════════════════════════════════════════════
const SFX = (() => {
  let ctx = null;
  let muted = localStorage.getItem('sfx-muted') === 'true';

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play(fn) {
    if (muted) return;
    try { fn(getCtx()); } catch (e) { /* ignore */ }
  }

  return {
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      localStorage.setItem('sfx-muted', muted);
      dom.btnSoundToggle.textContent = muted ? '🔇' : '🔊';
    },
    click() { play((c) => { const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 600; g.gain.setValueAtTime(0.08, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08); o.start(c.currentTime); o.stop(c.currentTime + 0.08); }); },
    reveal() { play((c) => { const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = 'sine'; o.frequency.setValueAtTime(800, c.currentTime); o.frequency.exponentialRampToValueAtTime(1200, c.currentTime + 0.1); g.gain.setValueAtTime(0.06, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15); o.start(c.currentTime); o.stop(c.currentTime + 0.15); }); },
    flag() { play((c) => { const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = 'triangle'; o.frequency.setValueAtTime(500, c.currentTime); o.frequency.exponentialRampToValueAtTime(700, c.currentTime + 0.12); g.gain.setValueAtTime(0.1, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15); o.start(c.currentTime); o.stop(c.currentTime + 0.15); }); },
    explode() { play((c) => { const bufSize = c.sampleRate * 0.4; const buf = c.createBuffer(1, bufSize, c.sampleRate); const data = buf.getChannelData(0); for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize); const n = c.createBufferSource(); const g = c.createGain(); n.buffer = buf; n.connect(g); g.connect(c.destination); g.gain.setValueAtTime(0.3, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4); n.start(c.currentTime); }); },
    win() { play((c) => { [523, 659, 784, 1047].forEach((f, i) => { const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, c.currentTime + i * 0.12); g.gain.linearRampToValueAtTime(0.1, c.currentTime + i * 0.12 + 0.05); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.12 + 0.3); o.start(c.currentTime + i * 0.12); o.stop(c.currentTime + i * 0.12 + 0.3); }); }); },
    tick() { play((c) => { const o = c.createOscillator(); const g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = 'sine'; o.frequency.value = 440; g.gain.setValueAtTime(0.03, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05); o.start(c.currentTime); o.stop(c.currentTime + 0.05); }); },
  };
})();

dom.btnSoundToggle.textContent = SFX.muted ? '🔇' : '🔊';
dom.btnSoundToggle.addEventListener('click', () => SFX.toggle());

// ═══════════════════════════════════════════════════════════════
// Theme Manager
// ═══════════════════════════════════════════════════════════════
const savedTheme = localStorage.getItem('minesweeper-theme') || 'midnight';
document.documentElement.setAttribute('data-theme', savedTheme);
document.querySelectorAll('.theme-swatch').forEach(btn => {
  if (btn.dataset.theme === savedTheme) btn.classList.add('active');
  else btn.classList.remove('active');
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-swatch').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.documentElement.setAttribute('data-theme', btn.dataset.theme);
    localStorage.setItem('minesweeper-theme', btn.dataset.theme);
  });
});

// ═══════════════════════════════════════════════════════════════
// Screen Navigation
// ═══════════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ═══════════════════════════════════════════════════════════════
// Difficulty selection
// ═══════════════════════════════════════════════════════════════
document.querySelectorAll('.select-btn[data-diff]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.select-btn[data-diff]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.diff;
  });
});

// ═══════════════════════════════════════════════════════════════
// Name Validation
// ═══════════════════════════════════════════════════════════════
function validateName() {
  const name = dom.playerName.value.trim();
  if (!name) {
    dom.nameError.classList.remove('hidden');
    dom.playerName.classList.add('input-error');
    dom.playerName.focus();
    return false;
  }
  dom.nameError.classList.add('hidden');
  dom.playerName.classList.remove('input-error');
  return true;
}
dom.playerName.addEventListener('input', () => {
  dom.nameError.classList.add('hidden');
  dom.playerName.classList.remove('input-error');
});

// ═══════════════════════════════════════════════════════════════
// Singleplayer
// ═══════════════════════════════════════════════════════════════
const CONFIGS = { easy: { rows: 9, cols: 9, mines: 10, timeLimit: 120 }, medium: { rows: 16, cols: 16, mines: 40, timeLimit: 600 } };

dom.btnSingleplayer.addEventListener('click', () => {
  if (!validateName()) return;
  state.mode = 'singleplayer';
  const config = CONFIGS[state.difficulty];
  state.rows = config.rows; state.cols = config.cols;
  state.mines = config.mines; state.timeLimit = config.timeLimit;
  state.flags = 0; state.revealedCount = 0; state.gameOver = false;
  state.playerFinished = false;

  // Generate client-side board (simplified — mine placement hidden until reveal)
  state.board = [];
  for (let r = 0; r < state.rows; r++) {
    state.board[r] = [];
    for (let c = 0; c < state.cols; c++) {
      state.board[r][c] = { revealed: false, mine: false, adjacentMines: 0, flagged: false };
    }
  }

  // Actually place mines using simple random
  let placed = 0;
  while (placed < state.mines) {
    const r = Math.floor(Math.random() * state.rows);
    const c = Math.floor(Math.random() * state.cols);
    if (!state.board[r][c].mine) {
      state.board[r][c].mine = true;
      placed++;
    }
  }
  // Compute adjacency
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (state.board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols && state.board[nr][nc].mine) count++;
        }
      }
      state.board[r][c].adjacentMines = count;
    }
  }

  dom.mpSidebar.classList.add('hidden');
  dom.spectateBanner.classList.add('hidden');
  dom.mineCount.textContent = state.mines;
  dom.flagCount.textContent = '0';
  renderBoard();
  startTimer();
  showScreen('game-screen');
});

// ═══════════════════════════════════════════════════════════════
// Board Rendering
// ═══════════════════════════════════════════════════════════════
function renderBoard() {
  const container = dom.boardContainer;
  container.innerHTML = '';
  container.style.gridTemplateColumns = `repeat(${state.cols}, var(--cell-size))`;

  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell hidden-cell';
      cell.dataset.r = r;
      cell.dataset.c = c;

      cell.addEventListener('click', () => handleCellClick(r, c));
      cell.addEventListener('contextmenu', (e) => { e.preventDefault(); handleFlag(r, c); });

      container.appendChild(cell);
    }
  }
}

function updateCellView(r, c) {
  const cellData = state.board[r][c];
  const cellEl = dom.boardContainer.children[r * state.cols + c];
  if (!cellEl) return;

  cellEl.className = 'cell';

  if (cellData.revealed) {
    if (cellData.mine) {
      cellEl.classList.add('revealed-cell', 'mine-cell');
    } else {
      cellEl.classList.add('revealed-cell');
      if (cellData.adjacentMines > 0) {
        cellEl.textContent = cellData.adjacentMines;
        cellEl.classList.add(`num-${cellData.adjacentMines}`);
      }
    }
  } else if (cellData.flagged) {
    cellEl.classList.add('hidden-cell', 'flagged');
  } else {
    cellEl.classList.add('hidden-cell');
  }
}

// ═══════════════════════════════════════════════════════════════
// Cell Interactions
// ═══════════════════════════════════════════════════════════════
function handleCellClick(r, c) {
  if (state.gameOver) return;
  const cell = state.board[r][c];
  if (cell.revealed || cell.flagged) return;

  SFX.click();

  if (state.mode === 'singleplayer') {
    spReveal(r, c);
  } else {
    socket.emit('reveal', { row: r, col: c });
  }
}

function handleFlag(r, c) {
  if (state.gameOver) return;
  const cell = state.board[r][c];
  if (cell.revealed) return;

  if (state.mode === 'singleplayer') {
    cell.flagged = !cell.flagged;
    state.flags += cell.flagged ? 1 : -1;
    dom.flagCount.textContent = state.flags;
    updateCellView(r, c);
    SFX.flag();
  } else {
    socket.emit('flag', { row: r, col: c });
    SFX.flag();
  }
}

// ── SP reveal (local BFS) ──
function spReveal(r, c) {
  const cell = state.board[r][c];
  if (cell.mine) {
    state.gameOver = true;
    cell.revealed = true;
    clearInterval(state.timerInterval);
    SFX.explode();

    // Show all mines with chain explosion
    chainExplosion(r, c);
    const elapsed = state.timeLimit - state.timeRemaining;
    setTimeout(() => showResult(false, elapsed), 1200);
    return;
  }

  const revealed = bfsReveal(r, c);
  revealed.forEach(pos => updateCellView(pos.r, pos.c));
  SFX.reveal();

  // Check win
  let unrevealed = 0;
  for (let rr = 0; rr < state.rows; rr++)
    for (let cc = 0; cc < state.cols; cc++)
      if (!state.board[rr][cc].mine && !state.board[rr][cc].revealed) unrevealed++;

  if (unrevealed === 0) {
    state.gameOver = true;
    clearInterval(state.timerInterval);
    SFX.win();
    const elapsed = state.timeLimit - state.timeRemaining;
    submitScore(elapsed);
    showResult(true, elapsed);
  }
}

function bfsReveal(startR, startC) {
  const revealed = [];
  const queue = [[startR, startC]];
  const visited = new Set([`${startR},${startC}`]);

  while (queue.length) {
    const [r, c] = queue.shift();
    const cell = state.board[r][c];
    if (cell.revealed || cell.mine) continue;
    cell.revealed = true;
    cell.flagged = false;
    revealed.push({ r, c });

    if (cell.adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          const key = `${nr},${nc}`;
          if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols && !visited.has(key)) {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
  }
  return revealed;
}

// ═══════════════════════════════════════════════════════════════
// Chain Explosion Animation
// ═══════════════════════════════════════════════════════════════
function chainExplosion(startR, startC) {
  const mines = [];
  for (let r = 0; r < state.rows; r++)
    for (let c = 0; c < state.cols; c++)
      if (state.board[r][c].mine && !(r === startR && c === startC))
        mines.push({ r, c });

  // BFS from exploded cell, ordered by Manhattan distance
  mines.sort((a, b) => {
    const da = Math.abs(a.r - startR) + Math.abs(a.c - startC);
    const db = Math.abs(b.r - startR) + Math.abs(b.c - startC);
    return da - db;
  });

  // Show exploded cell immediately
  const explodedEl = dom.boardContainer.children[startR * state.cols + startC];
  if (explodedEl) {
    explodedEl.className = 'cell revealed-cell mine-cell exploded';
  }

  mines.forEach((m, i) => {
    setTimeout(() => {
      state.board[m.r][m.c].revealed = true;
      const el = dom.boardContainer.children[m.r * state.cols + m.c];
      if (el) {
        el.className = 'cell revealed-cell mine-cell mine-chain shockwave';
      }
    }, 60 + i * 80);
  });
}

// ═══════════════════════════════════════════════════════════════
// Timer
// ═══════════════════════════════════════════════════════════════
function startTimer() {
  clearInterval(state.timerInterval);
  state.timeRemaining = state.timeLimit;
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.timeRemaining--;
    updateTimerDisplay();
    if (state.timeRemaining <= 10) SFX.tick();

    const timerBox = dom.timer.closest('.stat-box');
    if (state.timeRemaining <= 10) { timerBox.className = 'stat-box timer-box danger'; }
    else if (state.timeRemaining <= 30) { timerBox.className = 'stat-box timer-box warning'; }
    else { timerBox.className = 'stat-box timer-box'; }

    if (state.timeRemaining <= 0) {
      clearInterval(state.timerInterval);
      state.gameOver = true;
      if (state.mode === 'multiplayer') socket.emit('timeout');
      else showResult(false, state.timeLimit, true);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(state.timeRemaining / 60);
  const s = state.timeRemaining % 60;
  dom.timer.textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// Multiplayer — Create & Join
// ═══════════════════════════════════════════════════════════════
dom.btnCreateRoom.addEventListener('click', () => {
  if (!validateName()) return;
  const name = dom.playerName.value.trim().slice(0, 16);
  socket.emit('create-room', { difficulty: state.difficulty, name });
});

let joinMode = 'player';
dom.btnJoinRoom.addEventListener('click', () => {
  dom.joinModal.classList.remove('hidden');
  dom.roomCodeInput.value = '';
  dom.roomCodeInput.focus();
});
dom.btnJoinCancel.addEventListener('click', () => dom.joinModal.classList.add('hidden'));

document.querySelectorAll('.join-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.join-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    joinMode = tab.dataset.joinMode;
  });
});

dom.btnJoinConfirm.addEventListener('click', () => {
  const code = dom.roomCodeInput.value.trim().toUpperCase();
  if (!code || code.length !== 6) return;
  dom.joinModal.classList.add('hidden');
  if (joinMode === 'spectator') {
    state.mode = 'spectator';
    socket.emit('spectate-room', { code });
  } else {
    if (!validateName()) return;
    const name = dom.playerName.value.trim().slice(0, 16);
    socket.emit('join-room', { code, name });
  }
});

dom.btnCopyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(state.roomCode || '');
  dom.btnCopyCode.textContent = '✅ Copied!';
  setTimeout(() => dom.btnCopyCode.textContent = '📋 Copy', 2000);
});

// ═══════════════════════════════════════════════════════════════
// Socket.IO — Room Events
// ═══════════════════════════════════════════════════════════════
socket.on('room-created', ({ code, difficulty, timeLimit, players }) => {
  state.mode = 'multiplayer';
  state.roomCode = code;
  state.isHost = true;
  dom.lobbyRoomCode.textContent = code;
  dom.lobbyDifficulty.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  dom.lobbyTime.textContent = formatTime(timeLimit);
  dom.btnStartGame.classList.remove('hidden');
  dom.lobbyWaiting.classList.add('hidden');
  renderLobbyPlayers(players);
  clearChat(dom.chatMessages);
  showScreen('lobby-screen');
});

socket.on('room-joined', ({ code, difficulty, timeLimit, players }) => {
  state.mode = 'multiplayer';
  state.roomCode = code;
  state.isHost = false;
  dom.lobbyRoomCode.textContent = code;
  dom.lobbyDifficulty.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  dom.lobbyTime.textContent = formatTime(timeLimit);
  dom.btnStartGame.classList.add('hidden');
  dom.lobbyWaiting.classList.remove('hidden');
  renderLobbyPlayers(players);
  clearChat(dom.chatMessages);
  showScreen('lobby-screen');
});

socket.on('player-list', (players) => renderLobbyPlayers(players));

socket.on('error-msg', (msg) => alert(msg));

function renderLobbyPlayers(players) {
  dom.lobbyPlayers.innerHTML = '';
  players.forEach(p => {
    const el = document.createElement('div');
    el.className = 'player-item';
    el.innerHTML = `<span class="player-name">${esc(p.name)}</span>${p.isHost ? '<span class="host-badge">👑 Host</span>' : ''}`;
    dom.lobbyPlayers.appendChild(el);
  });
}

dom.btnStartGame.addEventListener('click', () => socket.emit('start-game'));

// ═══════════════════════════════════════════════════════════════
// Socket.IO — Game Events
// ═══════════════════════════════════════════════════════════════
socket.on('game-started', ({ board, rows, cols, timeLimit, players }) => {
  state.rows = rows; state.cols = cols;
  state.timeLimit = timeLimit;
  state.board = board;
  state.flags = 0; state.revealedCount = 0;
  state.gameOver = false;
  state.playerFinished = false;

  // Count mines in board
  let mines = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c].mine) mines++;
  state.mines = mines || (state.difficulty === 'easy' ? 10 : 40);

  dom.mineCount.textContent = state.mines;
  dom.flagCount.textContent = '0';
  dom.spectateBanner.classList.add('hidden');
  dom.mpSidebar.classList.remove('hidden');
  dom.watchSection.classList.add('hidden');
  clearChat(dom.gameChatMessages);
  renderBoard();
  renderBoardFromData(board);
  startTimer();
  renderMPPlayerList(players);
  showScreen('game-screen');
});

socket.on('reveal-result', ({ cells }) => {
  cells.forEach(({ r, c, adjacentMines, mine }) => {
    state.board[r][c].revealed = true;
    state.board[r][c].adjacentMines = adjacentMines;
    if (mine) state.board[r][c].mine = true;
    updateCellView(r, c);
  });
  SFX.reveal();
});

socket.on('flag-result', ({ row, col, flagged }) => {
  state.board[row][col].flagged = flagged;
  state.flags += flagged ? 1 : -1;
  dom.flagCount.textContent = state.flags;
  updateCellView(row, col);
});

socket.on('game-over', ({ won, board, time, isNewBest, previousBest, explodedCell, timeout }) => {
  state.gameOver = true;
  state.playerFinished = true;
  clearInterval(state.timerInterval);

  if (board) {
    state.board = board;
    if (!won && explodedCell) {
      chainExplosion(explodedCell.r, explodedCell.c);
      SFX.explode();
      setTimeout(() => renderBoardFromData(board), 1000);
    } else {
      renderBoardFromData(board);
    }
  }

  if (won) {
    SFX.win();
    showResult(true, time, false, isNewBest, previousBest, true);
  } else {
    showResult(false, time, timeout, undefined, undefined, true);
  }
});

socket.on('player-update', (players) => renderMPPlayerList(players));
socket.on('match-complete', ({ leaderboard }) => {
  showMatchLeaderboard(leaderboard);
  if (state.mode === 'spectator') {
    showScreen('result-screen');
    dom.resultTitle.textContent = 'Match Finished';
    dom.resultIcon.textContent = '🏁';
    dom.resultTime.textContent = '';
    dom.personalBestInfo.classList.add('hidden');
    dom.btnPlayAgain.textContent = 'Back to Menu';
    dom.spectateBanner.classList.add('hidden');
  }
});

// ═══════════════════════════════════════════════════════════════
// MP Player Progress
// ═══════════════════════════════════════════════════════════════
socket.on('opponent-progress', (progressList) => {
  renderMPPlayerListWithProgress(progressList);
});

function renderMPPlayerList(players) {
  dom.mpPlayerList.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'mp-player';
    let statusText = 'Playing…';
    let statusClass = '';
    if (p.finished) {
      statusText = p.won ? `✅ Won — ${formatTime(p.time)}` : '💀 Lost';
      statusClass = p.won ? 'won' : 'lost';
    }
    div.innerHTML = `<div class="player-header"><span>${esc(p.name)}</span><span class="status ${statusClass}">${statusText}</span></div>`;
    dom.mpPlayerList.appendChild(div);
  });
}

function renderMPPlayerListWithProgress(progressList) {
  dom.mpPlayerList.innerHTML = '';
  progressList.forEach(p => {
    const div = document.createElement('div');
    div.className = 'mp-player';
    let statusText = 'Playing…';
    let statusClass = '';
    if (p.finished) {
      statusText = p.won ? `✅ Won — ${formatTime(p.time)}` : '💀 Lost';
      statusClass = p.won ? 'won' : 'lost';
    }
    const safeTotal = p.total - (state.mines || 0);
    const pct = safeTotal > 0 ? Math.min(100, Math.round((p.revealed / safeTotal) * 100)) : 0;
    div.innerHTML = `
      <div class="player-header"><span>${esc(p.name)}</span><span class="status ${statusClass}">${statusText}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>
    `;
    dom.mpPlayerList.appendChild(div);
  });

  // Also update spectator player list if on spectator screen
  if (state.mode === 'spectator' || state.playerFinished) {
    updateSpectatorProgress(progressList);
  }
}

function updateSpectatorProgress(progressList) {
  // Update spectator screen player list
  const listEl = state.mode === 'spectator' ? dom.spectatorPlayerList : null;
  if (listEl) {
    listEl.innerHTML = '';
    progressList.forEach(p => {
      const div = document.createElement('div');
      div.className = 'mp-player';
      let statusText = 'Playing…';
      let statusClass = '';
      if (p.finished) {
        statusText = p.won ? `✅ ${formatTime(p.time)}` : '💀 Lost';
        statusClass = p.won ? 'won' : 'lost';
      }
      const safeTotal = p.total - (state.mines || 0);
      const pct = safeTotal > 0 ? Math.min(100, Math.round((p.revealed / safeTotal) * 100)) : 0;
      div.innerHTML = `
        <div class="player-header"><span>${esc(p.name)}</span><span class="status ${statusClass}">${statusText}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width: ${pct}%"></div></div>
      `;
      listEl.appendChild(div);
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// Spectator — Join
// ═══════════════════════════════════════════════════════════════
socket.on('spectate-joined', ({ code, players, started, rows, cols }) => {
  state.mode = 'spectator';
  state.roomCode = code;
  state.rows = rows; state.cols = cols;
  dom.spectatorRoomCode.textContent = code;

  populatePlayerSelect(dom.spectatorPlayerSelect, players);
  renderSpectatorPlayerList(players);

  if (started && players.length > 0) {
    socket.emit('watch-player', { targetId: players[0].id });
  }
  showScreen('spectator-screen');
});

socket.on('game-started-spectator', ({ rows, cols, timeLimit, players }) => {
  state.rows = rows; state.cols = cols;
  populatePlayerSelect(dom.spectatorPlayerSelect, players);
  renderSpectatorPlayerList(players);
  if (players.length > 0) {
    socket.emit('watch-player', { targetId: players[0].id });
  }
});

function renderSpectatorPlayerList(players) {
  dom.spectatorPlayerList.innerHTML = '';
  players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'mp-player';
    let statusText = p.finished ? (p.won ? `✅ ${formatTime(p.time)}` : '💀') : 'Playing…';
    div.innerHTML = `<div class="player-header"><span>${esc(p.name)}</span><span class="status">${statusText}</span></div>`;
    dom.spectatorPlayerList.appendChild(div);
  });
}

function populatePlayerSelect(selectEl, players) {
  selectEl.innerHTML = '';
  players.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + (p.finished ? (p.won ? ' ✅' : ' 💀') : '');
    selectEl.appendChild(opt);
  });
}

dom.spectatorPlayerSelect.addEventListener('change', () => {
  const targetId = dom.spectatorPlayerSelect.value;
  if (targetId) socket.emit('watch-player', { targetId });
});

// ═══════════════════════════════════════════════════════════════
// Post-Finish Spectating (from game screen)
// ═══════════════════════════════════════════════════════════════
dom.btnWatchOthers.addEventListener('click', () => {
  socket.emit('start-spectating');
});

socket.on('spectate-ready', ({ players, rows, cols }) => {
  state.rows = rows; state.cols = cols;
  // Filter to only players still playing
  const activePlayers = players.filter(p => !p.finished);
  if (activePlayers.length === 0) return;

  // Show the watch section in sidebar
  dom.watchSection.classList.remove('hidden');
  populatePlayerSelect(dom.watchPlayerSelect, activePlayers);
  socket.emit('watch-player', { targetId: activePlayers[0].id });
});

dom.watchPlayerSelect.addEventListener('change', () => {
  const targetId = dom.watchPlayerSelect.value;
  if (targetId) socket.emit('watch-player', { targetId });
});

// ═══════════════════════════════════════════════════════════════
// Watched Board Update (received from server)
// ═══════════════════════════════════════════════════════════════
socket.on('watched-board-update', ({ playerId, name, board, rows, cols, finished, won }) => {
  // Determine which container to render into
  const isOnSpectatorScreen = state.mode === 'spectator' && document.getElementById('spectator-screen').classList.contains('active');
  const container = isOnSpectatorScreen ? dom.spectatorWatchedBoard : dom.watchedBoardContainer;

  renderWatchedBoard(container, board, rows, cols, isOnSpectatorScreen);

  // Update progress bar if spectator
  if (isOnSpectatorScreen) {
    let revealed = 0, total = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        total++;
        if (board[r][c].revealed && !board[r][c].mine) revealed++;
      }
    }
    const mines = board.flat().filter(c => c.mine).length || 0;
    const safeTotal = total - mines;
    const pct = safeTotal > 0 ? Math.min(100, Math.round((revealed / safeTotal) * 100)) : 0;
    dom.spectatorProgressFill.style.width = pct + '%';
  }
});

function renderWatchedBoard(container, board, rows, cols, large) {
  container.innerHTML = '';
  const cellSize = large ? 24 : 12;
  container.style.gridTemplateColumns = `repeat(${cols}, ${cellSize}px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      const div = document.createElement('div');
      div.className = 'watched-cell';
      div.style.width = cellSize + 'px';
      div.style.height = cellSize + 'px';

      if (cell.revealed) {
        if (cell.mine) {
          div.classList.add('wc-mine');
          div.textContent = '💣';
        } else if (cell.adjacentMines > 0) {
          div.classList.add('wc-number', `num-${cell.adjacentMines}`);
          div.textContent = cell.adjacentMines;
        } else {
          div.classList.add('wc-revealed');
        }
      } else if (cell.flagged) {
        div.classList.add('wc-flagged');
        div.textContent = '🚩';
      } else {
        div.classList.add('wc-hidden');
      }
      container.appendChild(div);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Render Board from Server Data (update all cells)
// ═══════════════════════════════════════════════════════════════
function renderBoardFromData(board) {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      state.board[r][c] = board[r][c];
      updateCellView(r, c);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Chat System (shared across lobby, game, spectator)
// ═══════════════════════════════════════════════════════════════
function sendChat(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  socket.emit('chat-msg', { text });
  inputEl.value = '';
}

function clearChat(container) {
  container.innerHTML = '';
}

function appendChatMsg(containers, name, text) {
  containers.forEach(container => {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-name">${esc(name)}</span><span class="chat-text">${esc(text)}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  });
}

// Lobby chat
dom.btnChatSend.addEventListener('click', () => sendChat(dom.chatInput));
dom.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(dom.chatInput); });

// Game chat
dom.btnGameChatSend.addEventListener('click', () => sendChat(dom.gameChatInput));
dom.gameChatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(dom.gameChatInput); });

// Spectator chat
dom.btnSpectatorChatSend.addEventListener('click', () => sendChat(dom.spectatorChatInput));
dom.spectatorChatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(dom.spectatorChatInput); });

socket.on('chat-msg', ({ name, text }) => {
  // Show in all visible chat containers
  const containers = [dom.chatMessages, dom.gameChatMessages, dom.spectatorChatMessages];
  appendChatMsg(containers, name, text);
});

// ═══════════════════════════════════════════════════════════════
// Result / Score
// ═══════════════════════════════════════════════════════════════
async function submitScore(time) {
  const name = dom.playerName.value.trim().slice(0, 16);
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, difficulty: state.difficulty, time, mode: state.mode }),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('Score submit error:', e);
    return null;
  }
}

function showResult(won, time, timeout, isNewBest, previousBest, isMultiplayer) {
  clearInterval(state.timerInterval);

  dom.resultIcon.textContent = won ? '🏆' : (timeout ? '⏰' : '💥');
  dom.resultTitle.textContent = won ? 'You Win!' : (timeout ? 'Time\'s Up!' : 'Game Over');
  dom.resultTime.textContent = `Time: ${formatTime(time)}`;

  // Show spectate banner for MP if others still playing
  if (isMultiplayer && state.playerFinished) {
    dom.spectateBanner.classList.remove('hidden');
  }

  if (won && state.mode === 'singleplayer') {
    submitScore(time).then(data => {
      if (data) showPersonalBestInfo(data.isNewBest, data.previousBest, time);
    });
    launchConfetti();
  } else if (won) {
    showPersonalBestInfo(isNewBest, previousBest, time);
    launchConfetti();
  } else {
    dom.personalBestInfo.classList.add('hidden');
  }

  dom.resultLeaderboard.classList.add('hidden');
  showScreen('result-screen');
}

function showPersonalBestInfo(isNewBest, previousBest, currentTime) {
  dom.personalBestInfo.classList.remove('hidden');
  if (previousBest === null) {
    dom.personalBestInfo.innerHTML = `<div class="pb-first-win">🎉 First Win! Your best time: ${formatTime(currentTime)}</div>`;
  } else if (isNewBest) {
    dom.personalBestInfo.innerHTML = `<div class="pb-new-best">🏆 New Personal Best!</div><div class="pb-previous">Previous: ${formatTime(previousBest)} → Now: ${formatTime(currentTime)}</div>`;
  } else {
    dom.personalBestInfo.innerHTML = `<div class="pb-not-best">Your best: ${formatTime(previousBest)}</div><div class="pb-previous">Current: ${formatTime(currentTime)}</div>`;
  }
}

function showMatchLeaderboard(leaderboard) {
  dom.resultLeaderboard.classList.remove('hidden');
  dom.resultLeaderboard.innerHTML = '<h3>Match Results</h3>';
  leaderboard.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = `lb-row${p.won ? ' winner' : ''}`;
    row.innerHTML = `
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name">${esc(p.name)}</span>
      <span class="lb-result ${p.won ? 'won' : 'lost'}">${p.won ? formatTime(p.time) : '💀'}</span>
    `;
    dom.resultLeaderboard.appendChild(row);
  });
}

dom.btnPlayAgain.addEventListener('click', () => {
  state.gameOver = false;
  state.playerFinished = false;
  clearInterval(state.timerInterval);
  dom.spectateBanner.classList.add('hidden');
  showScreen('menu-screen');
  loadHomeLeaderboard();
});

// ═══════════════════════════════════════════════════════════════
// Home Leaderboard
// ═══════════════════════════════════════════════════════════════
document.querySelectorAll('.home-lb-tab[data-lb-mode]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.home-lb-tab[data-lb-mode]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentLBMode = tab.dataset.lbMode;
    loadHomeLeaderboard();
  });
});

document.querySelectorAll('.home-lb-tab[data-lb-diff]').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.home-lb-tab[data-lb-diff]').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.currentLBDiff = tab.dataset.lbDiff;
    loadHomeLeaderboard();
  });
});

async function loadHomeLeaderboard() {
  const mode = state.currentLBMode;
  const diff = state.currentLBDiff;
  let url = '';
  if (mode === 'sp') url = `/api/leaderboard/sp/${diff}`;
  else if (mode === 'mp') url = `/api/leaderboard/mp/${diff}`;
  else url = `/api/leaderboard/mp-wins/${diff}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    renderHomeLeaderboard(data, mode);
  } catch (_) {
    dom.homeLBList.innerHTML = '<div class="home-lb-empty">Could not load leaderboard.</div>';
  }
}

function renderHomeLeaderboard(entries, mode) {
  if (!entries || entries.length === 0) {
    dom.homeLBList.innerHTML = '<div class="home-lb-empty">No games played yet. Be the first!</div>';
    return;
  }
  dom.homeLBList.innerHTML = '';
  entries.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row';
    const medals = ['🥇', '🥈', '🥉'];
    const rank = i < 3 ? medals[i] : `${i + 1}`;
    const value = mode === 'mp-wins' ? `${e.wins || e.count || 0} wins` : formatTime(e.time_secs || e.time || 0);
    row.innerHTML = `<span class="lb-rank">${rank}</span><span class="lb-name">${esc(e.player_name || e.name || 'Unknown')}</span><span class="lb-result">${value}</span>`;
    dom.homeLBList.appendChild(row);
  });
}

// Load leaderboard on page load
loadHomeLeaderboard();

// ═══════════════════════════════════════════════════════════════
// Confetti
// ═══════════════════════════════════════════════════════════════
function launchConfetti() {
  const canvas = dom.confettiCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#6c5ce7', '#00cec9', '#00b894', '#fdcb6e', '#e17055', '#ff6b6b', '#74b9ff', '#a29bfe'];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * canvas.height * 0.5,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 3 + 2,
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
      gravity: 0.05 + Math.random() * 0.05,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach(p => {
      p.x += p.vx; p.vy += p.gravity; p.y += p.vy;
      p.rotation += p.rotSpeed;
      if (p.y < canvas.height + 20) alive = true;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    frame++;
    if (alive && frame < 300) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}

window.addEventListener('resize', () => {
  dom.confettiCanvas.width = window.innerWidth;
  dom.confettiCanvas.height = window.innerHeight;
});

// ═══════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
