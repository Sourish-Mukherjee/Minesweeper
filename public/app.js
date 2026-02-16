/* ═══════════════════════════════════════════════════════════════
   MINESWEEPER — Client-side Application
   Features: SP/MP, themes, sound, opponent progress, spectator,
   chat/reactions, animated explosions, personal bests
   ═══════════════════════════════════════════════════════════════ */

// ── Constants ────────────────────────────────────────────────
const DIFFICULTIES = {
  easy:   { rows: 9,  cols: 9,  mines: 10, timeLimit: 120 },
  medium: { rows: 16, cols: 16, mines: 40, timeLimit: 600 },
};

// ── DOM References ───────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = {
  menu:      $('#menu-screen'),
  lobby:     $('#lobby-screen'),
  game:      $('#game-screen'),
  spectator: $('#spectator-screen'),
  result:    $('#result-screen'),
};

const dom = {
  playerName:     $('#player-name'),
  nameError:      $('#name-error'),
  diffBtns:       $$('.select-btn'),
  btnSingle:      $('#btn-singleplayer'),
  btnCreate:      $('#btn-create-room'),
  btnJoin:        $('#btn-join-room'),
  joinModal:      $('#join-modal'),
  joinTabs:       $$('.join-tab'),
  roomCodeInput:  $('#room-code-input'),
  btnJoinConfirm: $('#btn-join-confirm'),
  btnJoinCancel:  $('#btn-join-cancel'),
  // Theme
  themeBtns:      $$('.theme-swatch'),
  // Lobby
  lobbyRoomCode:  $('#lobby-room-code'),
  lobbyDiff:      $('#lobby-difficulty'),
  lobbyTime:      $('#lobby-time'),
  lobbyPlayers:   $('#lobby-players'),
  btnStartGame:   $('#btn-start-game'),
  lobbyWaiting:   $('#lobby-waiting'),
  btnCopyCode:    $('#btn-copy-code'),
  chatMessages:   $('#chat-messages'),
  chatInput:      $('#chat-input'),
  btnChatSend:    $('#btn-chat-send'),
  // Game
  mineCount:      $('#mine-count'),
  timer:          $('#timer'),
  flagCount:      $('#flag-count'),
  boardContainer: $('#board-container'),
  mpSidebar:      $('#mp-sidebar'),
  mpPlayerList:   $('#mp-player-list'),
  btnSoundToggle: $('#btn-sound-toggle'),
  reactionBar:    $('#reaction-bar'),
  floatingReactions: $('#floating-reactions'),
  // Spectator
  spectatorRoomCode: $('#spectator-room-code'),
  spectatorBoards:   $('#spectator-boards'),
  spectatorChatMsgs: $('#spectator-chat-messages'),
  spectatorChatInput:$('#spectator-chat-input'),
  btnSpectatorChat:  $('#btn-spectator-chat-send'),
  // Result
  resultIcon:     $('#result-icon'),
  resultTitle:    $('#result-title'),
  resultTime:     $('#result-time'),
  personalBestInfo: $('#personal-best-info'),
  resultLB:       $('#result-leaderboard'),
  btnPlayAgain:   $('#btn-play-again'),
  // Confetti
  confettiCanvas: $('#confetti-canvas'),
  // Home Leaderboard
  homeLBList:     $('#home-lb-list'),
  homeLBModeTabs: $$('[data-lb-mode]'),
  homeLBDiffTabs: $$('[data-lb-diff]'),
};

// ── State ────────────────────────────────────────────────────
let socket = null;
let gameMode = null;            // 'singleplayer' | 'multiplayer'
let difficulty = 'easy';
let lbDifficulty = 'easy';
let lbMode = 'sp';
let board = null;
let rows = 0, cols = 0, totalMines = 0;
let timeLimit = 0;
let timeRemaining = 0;
let timerInterval = null;
let flagsPlaced = 0;
let gameActive = false;
let firstClick = true;
let startTimestamp = null;
let isSpectator = false;
let joinMode = 'player'; // 'player' | 'spectator'

// ── Seeded PRNG (same as server) ─────────────────────────────
function seededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ═══════════════════════════════════════════════════════════════
//  SOUND EFFECTS (Web Audio API)
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
    try { fn(getCtx()); } catch (_) { /* audio not available */ }
  }

  return {
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      localStorage.setItem('sfx-muted', muted);
      return muted;
    },

    click() {
      play(ctx => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
      });
    },

    reveal() {
      play(ctx => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      });
    },

    flag() {
      play(ctx => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, ctx.currentTime);
        osc.frequency.setValueAtTime(700, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      });
    },

    explosion() {
      play(ctx => {
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);
        noise.connect(filter).connect(gain).connect(ctx.destination);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + 0.4);
      });
    },

    win() {
      play(ctx => {
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain).connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
          gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
          gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.12 + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
          osc.start(ctx.currentTime + i * 0.12);
          osc.stop(ctx.currentTime + i * 0.12 + 0.3);
        });
      });
    },

    tick() {
      play(ctx => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain).connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.05);
      });
    },
  };
})();

// ═══════════════════════════════════════════════════════════════
//  THEME SYSTEM
// ═══════════════════════════════════════════════════════════════

function initTheme() {
  const saved = localStorage.getItem('theme') || 'midnight';
  document.documentElement.setAttribute('data-theme', saved);
  dom.themeBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.theme === saved);
  });
}

dom.themeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    dom.themeBtns.forEach(b => b.classList.toggle('active', b === btn));
  });
});

initTheme();

// ═══════════════════════════════════════════════════════════════
//  SCREEN NAVIGATION
// ═══════════════════════════════════════════════════════════════

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ═══════════════════════════════════════════════════════════════
//  NAME VALIDATION
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
  if (dom.playerName.value.trim()) {
    dom.nameError.classList.add('hidden');
    dom.playerName.classList.remove('input-error');
  }
});

// ═══════════════════════════════════════════════════════════════
//  MENU SCREEN
// ═══════════════════════════════════════════════════════════════

// Sound toggle
dom.btnSoundToggle.textContent = SFX.muted ? '🔇' : '🔊';
dom.btnSoundToggle.addEventListener('click', () => {
  const muted = SFX.toggle();
  dom.btnSoundToggle.textContent = muted ? '🔇' : '🔊';
});

// Difficulty selection
dom.diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    dom.diffBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
  });
});

// Singleplayer
dom.btnSingle.addEventListener('click', () => {
  if (!validateName()) return;
  gameMode = 'singleplayer';
  startSingleplayer();
});

// Create Room
dom.btnCreate.addEventListener('click', () => {
  if (!validateName()) return;
  gameMode = 'multiplayer';
  connectSocket();
  const name = dom.playerName.value.trim();
  socket.emit('create-room', { difficulty, name });
});

// Join Room
dom.btnJoin.addEventListener('click', () => {
  dom.joinModal.classList.remove('hidden');
  dom.roomCodeInput.value = '';
  dom.roomCodeInput.focus();
  joinMode = 'player';
  dom.joinTabs.forEach(t => t.classList.toggle('active', t.dataset.joinMode === 'player'));
});

// Join tabs (player/spectator)
dom.joinTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.joinTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    joinMode = tab.dataset.joinMode;
  });
});

dom.btnJoinCancel.addEventListener('click', () => {
  dom.joinModal.classList.add('hidden');
});

dom.btnJoinConfirm.addEventListener('click', () => {
  const code = dom.roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 6) return;

  if (joinMode === 'spectator') {
    isSpectator = true;
    connectSocket();
    socket.emit('spectate-room', { code });
  } else {
    if (!validateName()) return;
    gameMode = 'multiplayer';
    connectSocket();
    const name = dom.playerName.value.trim();
    socket.emit('join-room', { code, name });
  }
  dom.joinModal.classList.add('hidden');
});

dom.roomCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.btnJoinConfirm.click();
});

// Play Again
dom.btnPlayAgain.addEventListener('click', () => {
  cleanup();
  showScreen('menu');
  fetchLeaderboard();
});

// Home Leaderboard Mode Tabs
dom.homeLBModeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.homeLBModeTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    lbMode = tab.dataset.lbMode;
    fetchLeaderboard();
  });
});

// Home Leaderboard Difficulty Tabs
dom.homeLBDiffTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.homeLBDiffTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    lbDifficulty = tab.dataset.lbDiff;
    fetchLeaderboard();
  });
});

// Fetch leaderboard on page load
fetchLeaderboard();

// Copy code
dom.btnCopyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(dom.lobbyRoomCode.textContent);
  dom.btnCopyCode.textContent = '✅ Copied!';
  setTimeout(() => { dom.btnCopyCode.textContent = '📋 Copy'; }, 1500);
});

// ═══════════════════════════════════════════════════════════════
//  SINGLEPLAYER
// ═══════════════════════════════════════════════════════════════

function startSingleplayer() {
  const config = DIFFICULTIES[difficulty];
  rows = config.rows;
  cols = config.cols;
  totalMines = config.mines;
  timeLimit = config.timeLimit;
  timeRemaining = timeLimit;
  flagsPlaced = 0;
  gameActive = true;
  firstClick = true;
  startTimestamp = null;

  const seed = Date.now();
  board = generateBoardClient(rows, cols, totalMines, seed);

  dom.mineCount.textContent = totalMines;
  dom.flagCount.textContent = '0';
  dom.mpSidebar.classList.add('hidden');
  dom.reactionBar.classList.add('hidden');
  updateTimerDisplay();
  renderBoard();
  showScreen('game');
}

function generateBoardClient(r, c, mines, seed) {
  const rand = seededRandom(seed);
  const b = [];
  for (let i = 0; i < r; i++) {
    b[i] = [];
    for (let j = 0; j < c; j++) {
      b[i][j] = { mine: false, revealed: false, flagged: false, adjacentMines: 0 };
    }
  }
  let placed = 0;
  while (placed < mines) {
    const ri = Math.floor(rand() * r);
    const ci = Math.floor(rand() * c);
    if (!b[ri][ci].mine) { b[ri][ci].mine = true; placed++; }
  }
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      if (b[i][j].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = i + dr, nc = j + dc;
          if (nr >= 0 && nr < r && nc >= 0 && nc < c && b[nr][nc].mine) count++;
        }
      }
      b[i][j].adjacentMines = count;
    }
  }
  return b;
}

function startTimer() {
  if (timerInterval) return;
  startTimestamp = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTimestamp) / 1000;
    timeRemaining = Math.max(0, timeLimit - elapsed);
    updateTimerDisplay();

    // Tick sound at 10 seconds
    if (timeRemaining <= 10 && timeRemaining > 0 && Math.floor(timeRemaining * 10) % 10 === 0) {
      SFX.tick();
    }

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      gameActive = false;

      if (gameMode === 'multiplayer' && socket) {
        socket.emit('timeout');
      } else {
        SFX.explosion();
        showResult(false, timeLimit, true);
      }
    }
  }, 100);
}

function updateTimerDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = Math.floor(timeRemaining % 60);
  dom.timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

  const timerBox = dom.timer.closest('.timer-box');
  timerBox.classList.remove('warning', 'danger');
  if (timeRemaining <= 10) timerBox.classList.add('danger');
  else if (timeRemaining <= 30) timerBox.classList.add('warning');
}

// ═══════════════════════════════════════════════════════════════
//  BOARD RENDERING
// ═══════════════════════════════════════════════════════════════

function renderBoard(clientBoard) {
  const b = clientBoard || board;
  dom.boardContainer.innerHTML = '';
  dom.boardContainer.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.row = r;
      cell.dataset.col = c;

      applyCellState(cell, b[r][c]);

      cell.addEventListener('click', () => handleClick(r, c));
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleRightClick(r, c);
      });

      dom.boardContainer.appendChild(cell);
    }
  }
}

function applyCellState(cellEl, data) {
  cellEl.className = 'cell';
  if (data.revealed) {
    if (data.mine) {
      cellEl.classList.add('mine-cell');
    } else {
      cellEl.classList.add('revealed-cell');
      if (data.adjacentMines > 0) {
        cellEl.textContent = data.adjacentMines;
        cellEl.classList.add(`num-${data.adjacentMines}`);
      }
    }
  } else if (data.flagged) {
    cellEl.classList.add('hidden-cell', 'flagged');
  } else {
    cellEl.classList.add('hidden-cell');
  }
}

function getCellEl(r, c) {
  return dom.boardContainer.querySelector(`[data-row="${r}"][data-col="${c}"]`);
}

// ═══════════════════════════════════════════════════════════════
//  GAME ACTIONS
// ═══════════════════════════════════════════════════════════════

function handleClick(r, c) {
  if (!gameActive) return;

  if (gameMode === 'singleplayer') {
    if (firstClick) {
      ensureSafeFirstClick(r, c);
      firstClick = false;
      startTimer();
    }

    const cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    SFX.click();

    if (cell.mine) {
      cell.revealed = true;
      gameActive = false;
      clearInterval(timerInterval);
      timerInterval = null;
      SFX.explosion();
      animateExplosionChain(r, c);
      const elapsed = (Date.now() - startTimestamp) / 1000;
      setTimeout(() => showResult(false, elapsed), 1200);
      return;
    }

    // Flood fill
    floodFill(r, c);
    SFX.reveal();

    // Check win
    if (checkWinClient()) {
      gameActive = false;
      clearInterval(timerInterval);
      timerInterval = null;
      const elapsed = (Date.now() - startTimestamp) / 1000;
      SFX.win();

      // Submit score to leaderboard
      const pName = dom.playerName.value.trim();
      submitScore(pName, difficulty, elapsed, 'singleplayer');

      showResult(true, elapsed);
    }
  } else {
    // Multiplayer — send to server
    if (firstClick) {
      firstClick = false;
      startTimer();
    }
    SFX.click();
    socket.emit('reveal', { row: r, col: c });
  }
}

function handleRightClick(r, c) {
  if (!gameActive) return;

  if (gameMode === 'singleplayer') {
    const cell = board[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    flagsPlaced += cell.flagged ? 1 : -1;
    dom.flagCount.textContent = flagsPlaced;
    const cellEl = getCellEl(r, c);
    applyCellState(cellEl, cell);
    SFX.flag();
  } else {
    socket.emit('flag', { row: r, col: c });
  }
}

function ensureSafeFirstClick(r, c) {
  if (!board[r][c].mine) return;
  board[r][c].mine = false;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (!board[i][j].mine && !(i === r && j === c)) {
        board[i][j].mine = true;
        recalcAdjacent();
        return;
      }
    }
  }
}

function recalcAdjacent() {
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (board[i][j].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = i + dr, nc = j + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) count++;
        }
      }
      board[i][j].adjacentMines = count;
    }
  }
}

function floodFill(r, c) {
  const queue = [[r, c]];
  const visited = new Set([`${r},${c}`]);

  while (queue.length > 0) {
    const [cr, cc] = queue.shift();
    const cell = board[cr][cc];
    if (cell.revealed || cell.mine) continue;
    cell.revealed = true;
    cell.flagged = false;

    const cellEl = getCellEl(cr, cc);
    applyCellState(cellEl, cell);

    if (cell.adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = cr + dr, nc = cc + dc;
          const key = `${nr},${nc}`;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(key)) {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  ANIMATED MINE EXPLOSION CHAIN
// ═══════════════════════════════════════════════════════════════

function animateExplosionChain(startR, startC) {
  // BFS from the exploded cell — mines reveal in waves
  const minePositions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine && !(r === startR && c === startC)) {
        minePositions.push({ r, c });
      }
    }
  }

  // Sort by distance from start
  minePositions.sort((a, b) => {
    const dA = Math.abs(a.r - startR) + Math.abs(a.c - startC);
    const dB = Math.abs(b.r - startR) + Math.abs(b.c - startC);
    return dA - dB;
  });

  // Mark the exploded cell immediately
  const startEl = getCellEl(startR, startC);
  if (startEl) {
    board[startR][startC].revealed = true;
    applyCellState(startEl, board[startR][startC]);
    startEl.classList.add('exploded', 'shockwave');
  }

  // Animate remaining mines with staggered delays
  minePositions.forEach((pos, i) => {
    setTimeout(() => {
      board[pos.r][pos.c].revealed = true;
      const cellEl = getCellEl(pos.r, pos.c);
      if (cellEl) {
        applyCellState(cellEl, board[pos.r][pos.c]);
        cellEl.classList.add('mine-chain', 'shockwave');
      }
    }, 80 + i * 60);
  });
}

function checkWinClient() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c].mine && !board[r][c].revealed) return false;
    }
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  MULTIPLAYER — SOCKET.IO
// ═══════════════════════════════════════════════════════════════

function connectSocket() {
  if (socket) return;
  socket = io();

  socket.on('error-msg', (msg) => {
    alert(msg);
  });

  socket.on('room-created', ({ code, difficulty: diff, timeLimit: tl, players }) => {
    showLobby(code, diff, tl, players, true);
  });

  socket.on('room-joined', ({ code, difficulty: diff, timeLimit: tl, players }) => {
    showLobby(code, diff, tl, players, false);
  });

  socket.on('player-list', (players) => {
    renderLobbyPlayers(players);
  });

  socket.on('game-started', ({ board: boardView, rows: r, cols: c, timeLimit: tl, players }) => {
    rows = r;
    cols = c;
    totalMines = DIFFICULTIES[difficulty]?.mines || 10;
    timeLimit = tl;
    timeRemaining = tl;
    flagsPlaced = 0;
    gameActive = true;
    firstClick = true;
    board = boardView;

    dom.mineCount.textContent = totalMines;
    dom.flagCount.textContent = '0';
    dom.mpSidebar.classList.remove('hidden');
    dom.reactionBar.classList.remove('hidden');
    renderMPPlayers(players);
    updateTimerDisplay();
    renderBoard(boardView);
    showScreen('game');
  });

  // ── Spectator ────────────────────────────────────────────
  socket.on('spectate-joined', ({ code, difficulty: diff, players, started, rows: r, cols: c }) => {
    difficulty = diff;
    dom.spectatorRoomCode.textContent = code;
    showScreen('spectator');
    renderSpectatorBoards(players, r, c);
  });

  socket.on('game-started-spectator', ({ rows: r, cols: c, players }) => {
    renderSpectatorBoards(players, r, c);
  });

  // ── Opponent progress ────────────────────────────────────
  socket.on('opponent-progress', (progressList) => {
    if (isSpectator) {
      updateSpectatorProgress(progressList);
    } else {
      renderMPPlayersWithProgress(progressList);
    }
  });

  socket.on('reveal-result', ({ cells }) => {
    for (const c of cells) {
      if (board[c.r] && board[c.r][c.c]) {
        board[c.r][c.c].revealed = true;
        board[c.r][c.c].adjacentMines = c.adjacentMines;
        board[c.r][c.c].flagged = false;
        const cellEl = getCellEl(c.r, c.c);
        if (cellEl) applyCellState(cellEl, board[c.r][c.c]);
      }
    }
    SFX.reveal();
  });

  socket.on('flag-result', ({ row, col, flagged }) => {
    if (board[row] && board[row][col]) {
      board[row][col].flagged = flagged;
      flagsPlaced += flagged ? 1 : -1;
      dom.flagCount.textContent = Math.max(0, flagsPlaced);
      const cellEl = getCellEl(row, col);
      if (cellEl) applyCellState(cellEl, board[row][col]);
      SFX.flag();
    }
  });

  socket.on('game-over', ({ won, board: fullBoard, time, explodedCell, timeout, isNewBest, previousBest }) => {
    gameActive = false;
    clearInterval(timerInterval);
    timerInterval = null;

    if (explodedCell) {
      SFX.explosion();
      // Animate chain explosion for multiplayer game over
      board = fullBoard;
      renderBoard(fullBoard);
      animateExplosionChainFromBoard(fullBoard, explodedCell.r, explodedCell.c);
    } else {
      board = fullBoard;
      renderBoard(fullBoard);
    }

    if (!won) {
      dom.resultIcon.textContent = timeout ? '⏱️' : '💥';
      dom.resultTitle.textContent = timeout ? 'Time\'s Up!' : 'Boom!';
    } else {
      dom.resultIcon.textContent = '🏆';
      dom.resultTitle.textContent = 'You Win!';
      SFX.win();
    }
    dom.resultTime.textContent = `Time: ${formatTime(time)}`;

    // Show personal best info for MP wins
    if (won && isNewBest !== undefined) {
      showPersonalBestInfo(isNewBest, previousBest, time);
    }
  });

  socket.on('player-update', (players) => {
    renderMPPlayers(players);
  });

  socket.on('match-complete', ({ leaderboard }) => {
    showMultiplayerResult(leaderboard);
  });

  // ── Chat ─────────────────────────────────────────────────
  socket.on('chat-msg', ({ name, text }) => {
    appendChatMessage(name, text);
  });

  // ── Reactions ────────────────────────────────────────────
  socket.on('reaction', ({ name, emoji }) => {
    showFloatingReaction(emoji);
  });
}

// ═══════════════════════════════════════════════════════════════
//  ANIMATED EXPLOSION (from full board — multiplayer)
// ═══════════════════════════════════════════════════════════════

function animateExplosionChainFromBoard(fullBoard, startR, startC) {
  const minePositions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (fullBoard[r][c].mine && !(r === startR && c === startC)) {
        minePositions.push({ r, c });
      }
    }
  }

  minePositions.sort((a, b) => {
    const dA = Math.abs(a.r - startR) + Math.abs(a.c - startC);
    const dB = Math.abs(b.r - startR) + Math.abs(b.c - startC);
    return dA - dB;
  });

  const startEl = getCellEl(startR, startC);
  if (startEl) startEl.classList.add('exploded', 'shockwave');

  minePositions.forEach((pos, i) => {
    setTimeout(() => {
      const cellEl = getCellEl(pos.r, pos.c);
      if (cellEl) cellEl.classList.add('mine-chain', 'shockwave');
    }, 80 + i * 60);
  });
}

// ═══════════════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════════════

function appendChatMessage(name, text) {
  // Append to all visible chat panels
  const containers = [dom.chatMessages, dom.spectatorChatMsgs].filter(Boolean);
  containers.forEach(container => {
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<span class="chat-name">${escapeHtml(name)}</span><span class="chat-text">${escapeHtml(text)}</span>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    // Keep last 50 messages
    while (container.children.length > 50) container.removeChild(container.firstChild);
  });
}

function sendChat(inputEl) {
  const text = inputEl.value.trim();
  if (!text || !socket) return;
  socket.emit('chat-msg', { text });
  inputEl.value = '';
}

dom.btnChatSend.addEventListener('click', () => sendChat(dom.chatInput));
dom.chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(dom.chatInput); });
dom.btnSpectatorChat.addEventListener('click', () => sendChat(dom.spectatorChatInput));
dom.spectatorChatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(dom.spectatorChatInput); });

// ═══════════════════════════════════════════════════════════════
//  REACTIONS
// ═══════════════════════════════════════════════════════════════

$$('.reaction-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!socket) return;
    const emoji = btn.dataset.emoji;
    socket.emit('reaction', { emoji });
    // Show it locally too
    showFloatingReaction(emoji);
    SFX.click();
  });
});

function showFloatingReaction(emoji) {
  const el = document.createElement('div');
  el.className = 'floating-emoji';
  el.textContent = emoji;
  el.style.left = `${30 + Math.random() * 40}%`;
  el.style.top = `${40 + Math.random() * 30}%`;
  dom.floatingReactions.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// ═══════════════════════════════════════════════════════════════
//  LOBBY
// ═══════════════════════════════════════════════════════════════

function showLobby(code, diff, tl, players, isHost) {
  dom.lobbyRoomCode.textContent = code;
  dom.lobbyDiff.textContent = diff.charAt(0).toUpperCase() + diff.slice(1);
  dom.lobbyTime.textContent = formatTime(tl);
  difficulty = diff;

  if (isHost) {
    dom.btnStartGame.classList.remove('hidden');
    dom.lobbyWaiting.classList.add('hidden');
  } else {
    dom.btnStartGame.classList.add('hidden');
    dom.lobbyWaiting.classList.remove('hidden');
  }

  // Clear chat
  dom.chatMessages.innerHTML = '';

  renderLobbyPlayers(players);
  showScreen('lobby');
}

dom.btnStartGame.addEventListener('click', () => {
  if (socket) socket.emit('start-game');
});

function renderLobbyPlayers(players) {
  dom.lobbyPlayers.innerHTML = '';
  for (const p of players) {
    const item = document.createElement('div');
    item.className = 'player-item';
    item.innerHTML = `
      <span class="player-name">${escapeHtml(p.name)}</span>
      ${p.isHost ? '<span class="host-badge">👑 Host</span>' : ''}
    `;
    dom.lobbyPlayers.appendChild(item);
  }
}

function renderMPPlayers(players) {
  dom.mpPlayerList.innerHTML = '';
  for (const p of players) {
    const div = document.createElement('div');
    div.className = 'mp-player';
    let statusText = 'Playing…';
    let statusClass = '';
    if (p.finished) {
      statusText = p.won ? `✅ ${formatTime(p.time)}` : '💥 Lost';
      statusClass = p.won ? 'won' : 'lost';
    }
    div.innerHTML = `
      <div class="player-header">
        <span>${escapeHtml(p.name)}</span>
        <span class="status ${statusClass}">${statusText}</span>
      </div>
    `;
    dom.mpPlayerList.appendChild(div);
  }
}

// ── Opponent Progress with Mini-boards ──────────────────────

function renderMPPlayersWithProgress(progressList) {
  dom.mpPlayerList.innerHTML = '';
  const myId = socket?.id;

  for (const p of progressList) {
    if (p.id === myId) continue; // skip self

    const div = document.createElement('div');
    div.className = 'mp-player';

    let statusText = 'Playing…';
    let statusClass = '';
    if (p.finished) {
      statusText = p.won ? `✅ ${formatTime(p.time)}` : '💥 Lost';
      statusClass = p.won ? 'won' : 'lost';
    }

    const pct = p.total > 0 ? Math.round((p.revealed / p.total) * 100) : 0;

    div.innerHTML = `
      <div class="player-header">
        <span>${escapeHtml(p.name)}</span>
        <span class="status ${statusClass}">${statusText}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${pct}%"></div>
      </div>
    `;
    dom.mpPlayerList.appendChild(div);
  }
}

// ═══════════════════════════════════════════════════════════════
//  SPECTATOR VIEW
// ═══════════════════════════════════════════════════════════════

function renderSpectatorBoards(players, r, c) {
  dom.spectatorBoards.innerHTML = '';
  for (const p of players) {
    const card = document.createElement('div');
    card.className = 'spectator-card';
    card.id = `spec-${p.id}`;
    card.innerHTML = `
      <h4>${escapeHtml(p.name)}${p.isHost ? ' 👑' : ''}</h4>
      <div class="mini-board" style="grid-template-columns: repeat(${c}, 5px)" id="mini-${p.id}"></div>
      <div class="progress-bar"><div class="progress-fill" id="prog-${p.id}" style="width: 0%"></div></div>
    `;

    // Init mini-board
    const miniBoard = card.querySelector('.mini-board');
    for (let i = 0; i < r * c; i++) {
      const cell = document.createElement('div');
      cell.className = 'mini-cell mini-hidden';
      miniBoard.appendChild(cell);
    }

    dom.spectatorBoards.appendChild(card);
  }
}

function updateSpectatorProgress(progressList) {
  for (const p of progressList) {
    const progFill = document.getElementById(`prog-${p.id}`);
    if (progFill) {
      const pct = p.total > 0 ? Math.round((p.revealed / p.total) * 100) : 0;
      progFill.style.width = `${pct}%`;
    }

    // Update card status
    const card = document.getElementById(`spec-${p.id}`);
    if (card) {
      const h4 = card.querySelector('h4');
      if (p.finished) {
        h4.innerHTML = `${escapeHtml(p.name)} ${p.won ? '✅' : '💥'}`;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  RESULT SCREEN
// ═══════════════════════════════════════════════════════════════

function showResult(won, time, timeout) {
  if (won) {
    dom.resultIcon.textContent = '🏆';
    dom.resultTitle.textContent = 'You Win!';
    launchConfetti();
  } else {
    dom.resultIcon.textContent = timeout ? '⏱️' : '💥';
    dom.resultTitle.textContent = timeout ? 'Time\'s Up!' : 'Game Over';
  }
  dom.resultTime.textContent = `Time: ${formatTime(time)}`;
  dom.resultLB.classList.add('hidden');
  dom.personalBestInfo.classList.add('hidden');
  showScreen('result');
}

function showPersonalBestInfo(isNewBest, previousBest, currentTime) {
  dom.personalBestInfo.classList.remove('hidden');

  if (previousBest === null) {
    // First ever win
    dom.personalBestInfo.innerHTML = `
      <div class="pb-first-win">🎉 First Win! Your best time: ${formatTime(currentTime)}</div>
    `;
  } else if (isNewBest) {
    dom.personalBestInfo.innerHTML = `
      <div class="pb-new-best">🏆 New Personal Best!</div>
      <div class="pb-previous">Previous: ${formatTime(previousBest)} → Now: ${formatTime(currentTime)}</div>
    `;
  } else {
    dom.personalBestInfo.innerHTML = `
      <div class="pb-not-best">Your best: ${formatTime(previousBest)}</div>
      <div class="pb-previous">Current: ${formatTime(currentTime)}</div>
    `;
  }
}

function showMultiplayerResult(leaderboard) {
  dom.resultLB.classList.remove('hidden');
  dom.resultLB.innerHTML = '<h3>🏅 Leaderboard</h3>';

  leaderboard.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = `lb-row ${i === 0 && p.won ? 'winner' : ''}`;
    const rankEmojis = ['🥇', '🥈', '🥉'];
    row.innerHTML = `
      <span class="lb-rank">${rankEmojis[i] || (i + 1)}</span>
      <span class="lb-name">${escapeHtml(p.name)}</span>
      <span class="lb-result ${p.won ? 'won' : 'lost'}">${p.won ? formatTime(p.time) : 'Lost'}</span>
    `;
    dom.resultLB.appendChild(row);
  });

  if (leaderboard[0]?.won) launchConfetti();
  showScreen('result');
}

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════

function formatTime(seconds) {
  if (seconds == null) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function cleanup() {
  clearInterval(timerInterval);
  timerInterval = null;
  gameActive = false;
  board = null;
  firstClick = true;
  flagsPlaced = 0;
  isSpectator = false;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  dom.boardContainer.innerHTML = '';
  dom.mpSidebar.classList.add('hidden');
  dom.reactionBar.classList.add('hidden');
  dom.resultLB.classList.add('hidden');
  dom.personalBestInfo.classList.add('hidden');
  dom.floatingReactions.innerHTML = '';

  const timerBox = dom.timer.closest('.timer-box');
  timerBox.classList.remove('warning', 'danger');
}

// ═══════════════════════════════════════════════════════════════
//  LEADERBOARD
// ═══════════════════════════════════════════════════════════════

async function fetchLeaderboard() {
  try {
    let url;
    if (lbMode === 'sp') url = `/api/leaderboard/sp/${lbDifficulty}`;
    else if (lbMode === 'mp') url = `/api/leaderboard/mp/${lbDifficulty}`;
    else url = `/api/leaderboard/mp-wins/${lbDifficulty}`;

    const res = await fetch(url);
    const data = await res.json();

    if (lbMode === 'mp-wins') {
      renderWinsLeaderboard(data);
    } else {
      renderHomeLeaderboard(data);
    }
  } catch (e) {
    console.error('Failed to fetch leaderboard:', e);
  }
}

function renderHomeLeaderboard(entries) {
  dom.homeLBList.innerHTML = '';
  if (!entries || entries.length === 0) {
    dom.homeLBList.innerHTML = '<div class="home-lb-empty">No games played yet. Be the first!</div>';
    return;
  }
  const rankEmojis = ['🥇', '🥈', '🥉'];
  entries.slice(0, 10).forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (i === 0 ? ' winner' : '');
    row.innerHTML = `
      <span class="lb-rank">${rankEmojis[i] || (i + 1)}</span>
      <span class="lb-name">${escapeHtml(e.name)}</span>
      <span class="lb-result won">${formatTime(e.time)}</span>
    `;
    dom.homeLBList.appendChild(row);
  });
}

function renderWinsLeaderboard(entries) {
  dom.homeLBList.innerHTML = '';
  if (!entries || entries.length === 0) {
    dom.homeLBList.innerHTML = '<div class="home-lb-empty">No multiplayer wins yet!</div>';
    return;
  }
  const rankEmojis = ['🥇', '🥈', '🥉'];
  entries.slice(0, 10).forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (i === 0 ? ' winner' : '');
    row.innerHTML = `
      <span class="lb-rank">${rankEmojis[i] || (i + 1)}</span>
      <span class="lb-name">${escapeHtml(e.name)}</span>
      <span class="lb-result won">${e.wins} win${e.wins !== 1 ? 's' : ''}</span>
    `;
    dom.homeLBList.appendChild(row);
  });
}

async function submitScore(name, diff, time, mode) {
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, difficulty: diff, time, mode }),
    });
    const data = await res.json();
    // Show personal best info for singleplayer
    if (data.ok) {
      showPersonalBestInfo(data.isNewBest, data.previousBest, time);
    }
  } catch (e) {
    console.error('Failed to submit score:', e);
  }
}

// ═══════════════════════════════════════════════════════════════
//  CONFETTI 🎉
// ═══════════════════════════════════════════════════════════════

function launchConfetti() {
  const canvas = dom.confettiCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055', '#00b894', '#f472b6', '#60a5fa'];
  const particles = [];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 5,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frame++;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rotation += p.rotationSpeed;
      if (frame > 80) p.opacity -= 0.01;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (frame < 200) {
      requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  animate();
}

// Handle window resize for confetti canvas
window.addEventListener('resize', () => {
  dom.confettiCanvas.width = window.innerWidth;
  dom.confettiCanvas.height = window.innerHeight;
});
