/* ═══════════════════════════════════════════════════════════════
   MINESWEEPER — Client-side Application
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
  menu:   $('#menu-screen'),
  lobby:  $('#lobby-screen'),
  game:   $('#game-screen'),
  result: $('#result-screen'),
};

const dom = {
  playerName:     $('#player-name'),
  diffBtns:       $$('.select-btn'),
  btnSingle:      $('#btn-singleplayer'),
  btnCreate:      $('#btn-create-room'),
  btnJoin:        $('#btn-join-room'),
  joinModal:      $('#join-modal'),
  roomCodeInput:  $('#room-code-input'),
  btnJoinConfirm: $('#btn-join-confirm'),
  btnJoinCancel:  $('#btn-join-cancel'),
  // Lobby
  lobbyRoomCode:  $('#lobby-room-code'),
  lobbyDiff:      $('#lobby-difficulty'),
  lobbyTime:      $('#lobby-time'),
  lobbyPlayers:   $('#lobby-players'),
  btnStartGame:   $('#btn-start-game'),
  lobbyWaiting:   $('#lobby-waiting'),
  btnCopyCode:    $('#btn-copy-code'),
  // Game
  mineCount:      $('#mine-count'),
  timer:          $('#timer'),
  flagCount:      $('#flag-count'),
  boardContainer: $('#board-container'),
  mpSidebar:      $('#mp-sidebar'),
  mpPlayerList:   $('#mp-player-list'),
  // Result
  resultIcon:     $('#result-icon'),
  resultTitle:    $('#result-title'),
  resultTime:     $('#result-time'),
  resultLB:       $('#result-leaderboard'),
  btnPlayAgain:   $('#btn-play-again'),
  // Confetti
  confettiCanvas: $('#confetti-canvas'),
  // Home Leaderboard
  homeLBList:     $('#home-lb-list'),
  homeLBTabs:     $$('.home-lb-tab'),
};

// ── State ────────────────────────────────────────────────────
let socket = null;
let gameMode = null;            // 'singleplayer' | 'multiplayer'
let difficulty = 'easy';
let lbDifficulty = 'easy';      // which leaderboard tab is active
let board = null;               // client-side board for singleplayer
let rows = 0, cols = 0, totalMines = 0;
let timeLimit = 0;
let timeRemaining = 0;
let timerInterval = null;
let flagsPlaced = 0;
let gameActive = false;
let firstClick = true;
let startTimestamp = null;

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
//  SCREEN NAVIGATION
// ═══════════════════════════════════════════════════════════════

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ═══════════════════════════════════════════════════════════════
//  MENU SCREEN
// ═══════════════════════════════════════════════════════════════

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
  gameMode = 'singleplayer';
  startSingleplayer();
});

// Create Room
dom.btnCreate.addEventListener('click', () => {
  gameMode = 'multiplayer';
  connectSocket();
  const name = dom.playerName.value.trim() || 'Player';
  socket.emit('create-room', { difficulty, name });
});

// Join Room
dom.btnJoin.addEventListener('click', () => {
  dom.joinModal.classList.remove('hidden');
  dom.roomCodeInput.value = '';
  dom.roomCodeInput.focus();
});

dom.btnJoinCancel.addEventListener('click', () => {
  dom.joinModal.classList.add('hidden');
});

dom.btnJoinConfirm.addEventListener('click', () => {
  const code = dom.roomCodeInput.value.trim().toUpperCase();
  if (code.length !== 6) return;
  gameMode = 'multiplayer';
  connectSocket();
  const name = dom.playerName.value.trim() || 'Player';
  socket.emit('join-room', { code, name });
  dom.joinModal.classList.add('hidden');
});

dom.roomCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.btnJoinConfirm.click();
});

// Play Again
dom.btnPlayAgain.addEventListener('click', () => {
  cleanup();
  showScreen('menu');
  fetchLeaderboard(lbDifficulty);
});

// Home Leaderboard Tabs
dom.homeLBTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    dom.homeLBTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    lbDifficulty = tab.dataset.lbDiff;
    fetchLeaderboard(lbDifficulty);
  });
});

// Fetch leaderboard on page load
fetchLeaderboard('easy');

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

  // Generate board
  const seed = Date.now();
  board = generateBoardClient(rows, cols, totalMines, seed);

  dom.mineCount.textContent = totalMines;
  dom.flagCount.textContent = '0';
  dom.mpSidebar.classList.add('hidden');
  updateTimerDisplay();
  renderBoard();
  showScreen('game');

  // Timer starts on first click
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
    if (!b[ri][ci].mine) {
      b[ri][ci].mine = true;
      placed++;
    }
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

    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      gameActive = false;

      if (gameMode === 'multiplayer' && socket) {
        socket.emit('timeout');
      } else {
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
      // Ensure first click is safe
      ensureSafeFirstClick(r, c);
      firstClick = false;
      startTimer();
    }

    const cell = board[r][c];
    if (cell.revealed || cell.flagged) return;

    if (cell.mine) {
      cell.revealed = true;
      gameActive = false;
      clearInterval(timerInterval);
      timerInterval = null;
      revealAllMines();
      const cellEl = getCellEl(r, c);
      cellEl.classList.add('exploded');
      const elapsed = (Date.now() - startTimestamp) / 1000;
      setTimeout(() => showResult(false, elapsed), 600);
      return;
    }

    // Flood fill
    floodFill(r, c);

    // Check win
    if (checkWinClient()) {
      gameActive = false;
      clearInterval(timerInterval);
      timerInterval = null;
      const elapsed = (Date.now() - startTimestamp) / 1000;

      // Submit score to leaderboard
      const pName = dom.playerName.value.trim() || 'Player';
      submitScore(pName, difficulty, elapsed, 'singleplayer');

      showResult(true, elapsed);
    }
  } else {
    // Multiplayer — send to server
    if (firstClick) {
      firstClick = false;
      startTimer();
    }
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
  } else {
    socket.emit('flag', { row: r, col: c });
  }
}

function ensureSafeFirstClick(r, c) {
  if (!board[r][c].mine) return;
  // Move the mine somewhere else
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

function revealAllMines() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) {
        board[r][c].revealed = true;
        const cellEl = getCellEl(r, c);
        applyCellState(cellEl, board[r][c]);
      }
    }
  }
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
    renderMPPlayers(players);
    updateTimerDisplay();
    renderBoard(boardView);
    showScreen('game');
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
  });

  socket.on('flag-result', ({ row, col, flagged }) => {
    if (board[row] && board[row][col]) {
      board[row][col].flagged = flagged;
      flagsPlaced += flagged ? 1 : -1;
      dom.flagCount.textContent = Math.max(0, flagsPlaced);
      const cellEl = getCellEl(row, col);
      if (cellEl) applyCellState(cellEl, board[row][col]);
    }
  });

  socket.on('game-over', ({ won, board: fullBoard, time, explodedCell, timeout }) => {
    gameActive = false;
    clearInterval(timerInterval);
    timerInterval = null;

    // Re-render full board
    board = fullBoard;
    renderBoard(fullBoard);

    if (explodedCell) {
      const cellEl = getCellEl(explodedCell.r, explodedCell.c);
      if (cellEl) cellEl.classList.add('exploded');
    }

    // Don't show result yet — wait for match-complete for leaderboard
    // But show a mini status
    if (!won) {
      dom.resultIcon.textContent = timeout ? '⏱️' : '💥';
      dom.resultTitle.textContent = timeout ? 'Time\'s Up!' : 'Boom!';
    } else {
      dom.resultIcon.textContent = '🏆';
      dom.resultTitle.textContent = 'You Win!';
    }
    dom.resultTime.textContent = `Time: ${formatTime(time)}`;
  });

  socket.on('player-update', (players) => {
    renderMPPlayers(players);
  });

  socket.on('match-complete', ({ leaderboard }) => {
    showMultiplayerResult(leaderboard);
  });
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
      <span>${escapeHtml(p.name)}</span>
      <span class="status ${statusClass}">${statusText}</span>
    `;
    dom.mpPlayerList.appendChild(div);
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
  showScreen('result');
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
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  dom.boardContainer.innerHTML = '';
  dom.mpSidebar.classList.add('hidden');
  dom.resultLB.classList.add('hidden');

  const timerBox = dom.timer.closest('.timer-box');
  timerBox.classList.remove('warning', 'danger');
}

// ═══════════════════════════════════════════════════════════════
//  LEADERBOARD
// ═══════════════════════════════════════════════════════════════

async function fetchLeaderboard(diff) {
  try {
    const res = await fetch(`/api/leaderboard/${diff}`);
    const data = await res.json();
    renderHomeLeaderboard(data);
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

async function submitScore(name, diff, time, mode) {
  try {
    await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, difficulty: diff, time, mode }),
    });
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
