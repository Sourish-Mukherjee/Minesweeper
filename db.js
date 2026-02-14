// db.js — Storage abstraction layer
// Uses Supabase when configured, falls back to in-memory store

let supabase = null;
const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

if (useSupabase) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log('📦 Using Supabase for leaderboard storage');
} else {
  console.log('💾 Using in-memory leaderboard (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to persist)');
}

// ── In-memory fallback ─────────────────────────────────────────
const memoryStore = {
  easy: [],
  medium: [],
};
const MAX_ENTRIES = 50;

// ── Public API ─────────────────────────────────────────────────

/**
 * Add a leaderboard entry.
 * @param {{ name: string, difficulty: string, time: number, mode: string }} entry
 */
async function addEntry({ name, difficulty, time, mode }) {
  if (useSupabase) {
    const { error } = await supabase.from('game_results').insert({
      player_name: name,
      difficulty,
      time_secs: time,
      won: true,
      mode,
    });
    if (error) console.error('Supabase insert error:', error.message);
  } else {
    const list = memoryStore[difficulty];
    if (!list) return;
    list.push({ name, time, mode, date: new Date().toISOString() });
    list.sort((a, b) => a.time - b.time);
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
  }
}

/**
 * Get top leaderboard entries for a difficulty.
 * @param {string} difficulty - 'easy' or 'medium'
 * @param {number} [limit=50]
 * @returns {Promise<Array<{ name: string, time: number, mode: string, date: string }>>}
 */
async function getLeaderboard(difficulty, limit = 50) {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('game_results')
      .select('player_name, time_secs, mode, created_at')
      .eq('difficulty', difficulty)
      .eq('won', true)
      .order('time_secs', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('Supabase query error:', error.message);
      return [];
    }

    return (data || []).map(row => ({
      name: row.player_name,
      time: row.time_secs,
      mode: row.mode,
      date: row.created_at,
    }));
  } else {
    return (memoryStore[difficulty] || []).slice(0, limit);
  }
}

module.exports = { addEntry, getLeaderboard };
