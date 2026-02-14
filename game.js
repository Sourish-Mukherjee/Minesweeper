// game.js — Minesweeper game logic

/**
 * Simple seeded PRNG (mulberry32) so multiplayer boards are deterministic.
 */
function seededRandom(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10, timeLimit: 120 },
  medium: { rows: 16, cols: 16, mines: 40, timeLimit: 600 },
};

/**
 * Generate a board. Each cell: { mine, revealed, flagged, adjacentMines }
 * @param {string} difficulty - 'easy' or 'medium'
 * @param {number} seed - numeric seed for deterministic generation
 * @returns {{ board: object[][], rows: number, cols: number, mines: number, timeLimit: number }}
 */
function generateBoard(difficulty, seed) {
  const config = DIFFICULTIES[difficulty];
  if (!config) throw new Error(`Unknown difficulty: ${difficulty}`);

  const { rows, cols, mines, timeLimit } = config;
  const rand = seededRandom(seed);

  // Initialise empty board
  const board = [];
  for (let r = 0; r < rows; r++) {
    board[r] = [];
    for (let c = 0; c < cols; c++) {
      board[r][c] = {
        mine: false,
        revealed: false,
        flagged: false,
        adjacentMines: 0,
      };
    }
  }

  // Place mines
  let placed = 0;
  while (placed < mines) {
    const r = Math.floor(rand() * rows);
    const c = Math.floor(rand() * cols);
    if (!board[r][c].mine) {
      board[r][c].mine = true;
      placed++;
    }
  }

  // Compute adjacent mine counts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].mine) {
            count++;
          }
        }
      }
      board[r][c].adjacentMines = count;
    }
  }

  return { board, rows, cols, mines, timeLimit };
}

/**
 * Reveal a cell. Returns { hitMine, revealedCells: [{r, c, adjacentMines}] }
 */
function revealCell(board, rows, cols, row, col) {
  const cell = board[row][col];
  if (cell.revealed || cell.flagged) return { hitMine: false, revealedCells: [] };

  if (cell.mine) {
    cell.revealed = true;
    return { hitMine: true, revealedCells: [{ r: row, c: col, mine: true }] };
  }

  // BFS flood-fill for empty cells
  const revealed = [];
  const queue = [[row, col]];
  const visited = new Set();
  visited.add(`${row},${col}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift();
    const current = board[r][c];
    if (current.revealed || current.mine) continue;

    current.revealed = true;
    current.flagged = false;
    revealed.push({ r, c, adjacentMines: current.adjacentMines });

    if (current.adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          const key = `${nr},${nc}`;
          if (
            nr >= 0 &&
            nr < rows &&
            nc >= 0 &&
            nc < cols &&
            !visited.has(key)
          ) {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
  }

  return { hitMine: false, revealedCells: revealed };
}

/**
 * Toggle flag on a cell.
 */
function flagCell(board, row, col) {
  const cell = board[row][col];
  if (cell.revealed) return { changed: false, flagged: false };
  cell.flagged = !cell.flagged;
  return { changed: true, flagged: cell.flagged };
}

/**
 * Check win: all non-mine cells are revealed.
 */
function checkWin(board, rows, cols) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!board[r][c].mine && !board[r][c].revealed) return false;
    }
  }
  return true;
}

/**
 * Serialise board to a client-safe view (hides mine locations for unrevealed cells).
 */
function getClientView(board, rows, cols, gameOver) {
  const view = [];
  for (let r = 0; r < rows; r++) {
    view[r] = [];
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (cell.revealed) {
        view[r][c] = {
          revealed: true,
          mine: cell.mine,
          adjacentMines: cell.adjacentMines,
          flagged: false,
        };
      } else if (gameOver) {
        // Show everything on game over
        view[r][c] = {
          revealed: false,
          mine: cell.mine,
          adjacentMines: cell.adjacentMines,
          flagged: cell.flagged,
        };
      } else {
        view[r][c] = {
          revealed: false,
          mine: false,
          adjacentMines: 0,
          flagged: cell.flagged,
        };
      }
    }
  }
  return view;
}

module.exports = {
  DIFFICULTIES,
  generateBoard,
  revealCell,
  flagCell,
  checkWin,
  getClientView,
  seededRandom,
};
