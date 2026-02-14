-- ═══════════════════════════════════════════════════════════════
--  MINESWEEPER — Supabase Database Schema
--  Run this in the Supabase SQL Editor to set up tables.
-- ═══════════════════════════════════════════════════════════════

-- ── Game Results ─────────────────────────────────────────────
-- Stores every completed game (singleplayer & multiplayer wins)
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

-- Index for leaderboard queries (fastest wins per difficulty)
CREATE INDEX IF NOT EXISTS idx_game_results_leaderboard
    ON game_results (difficulty, won, time_secs ASC)
    WHERE won = true;

-- Index for recent games
CREATE INDEX IF NOT EXISTS idx_game_results_recent
    ON game_results (created_at DESC);

-- ── Leaderboard View (optional convenience) ──────────────────
-- Top 50 fastest wins per difficulty
CREATE OR REPLACE VIEW leaderboard_easy AS
    SELECT player_name, time_secs, mode, created_at
    FROM game_results
    WHERE difficulty = 'easy' AND won = true
    ORDER BY time_secs ASC
    LIMIT 50;

CREATE OR REPLACE VIEW leaderboard_medium AS
    SELECT player_name, time_secs, mode, created_at
    FROM game_results
    WHERE difficulty = 'medium' AND won = true
    ORDER BY time_secs ASC
    LIMIT 50;

-- ── Row Level Security ───────────────────────────────────────
-- Enable RLS on the table
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (public leaderboard)
CREATE POLICY "Public read access" ON game_results
    FOR SELECT USING (true);

-- Allow inserts from the server (using service role key)
-- The anon key can also insert if you prefer client-side submissions
CREATE POLICY "Server insert access" ON game_results
    FOR INSERT WITH CHECK (true);
