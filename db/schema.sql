-- ═══════════════════════════════════════════════════════════════
--  MINESWEEPER — Supabase Database Schema
--  Run this in the Supabase SQL Editor to set up tables.
-- ═══════════════════════════════════════════════════════════════

-- ── Game Results ─────────────────────────────────────────────
-- Stores every completed game (singleplayer & multiplayer)
CREATE TABLE IF NOT EXISTS game_results (
    id          BIGSERIAL PRIMARY KEY,
    player_name TEXT        NOT NULL,
    difficulty  TEXT        NOT NULL CHECK (difficulty IN ('easy', 'medium')),
    time_secs   NUMERIC(8,3) NOT NULL,          -- completion time in seconds
    won         BOOLEAN     NOT NULL DEFAULT true,
    mode        TEXT        NOT NULL CHECK (mode IN ('singleplayer', 'multiplayer')),
    room_code   TEXT,                             -- NULL for singleplayer
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for singleplayer leaderboard (fastest wins per difficulty)
CREATE INDEX IF NOT EXISTS idx_game_results_sp_leaderboard
    ON game_results (difficulty, time_secs ASC)
    WHERE won = true AND mode = 'singleplayer';

-- Index for multiplayer leaderboard (fastest wins per difficulty)
CREATE INDEX IF NOT EXISTS idx_game_results_mp_leaderboard
    ON game_results (difficulty, time_secs ASC)
    WHERE won = true AND mode = 'multiplayer';

-- Index for multiplayer most-wins aggregation
CREATE INDEX IF NOT EXISTS idx_game_results_mp_wins
    ON game_results (difficulty, player_name)
    WHERE won = true AND mode = 'multiplayer';

-- Index for recent games
CREATE INDEX IF NOT EXISTS idx_game_results_recent
    ON game_results (created_at DESC);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe to re-run)
DROP POLICY IF EXISTS "Public read access" ON game_results;
DROP POLICY IF EXISTS "Server insert access" ON game_results;

-- Allow anyone to read (public leaderboard)
CREATE POLICY "Public read access" ON game_results
    FOR SELECT USING (true);

-- Allow inserts from the server (using service role key)
CREATE POLICY "Server insert access" ON game_results
    FOR INSERT WITH CHECK (true);
