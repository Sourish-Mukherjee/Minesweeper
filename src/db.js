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
const memoryStore = [];
const MAX_ENTRIES = 200;

// ── Public API ─────────────────────────────────────────────────

/**
 * Add a game result entry.
 */
async function addEntry({ name, difficulty, time, mode, won = true }) {
  if (useSupabase) {
    const { error } = await supabase.from('game_results').insert({
      player_name: name,
      difficulty,
      time_secs: time,
      won,
      mode,
    });
    if (error) console.error('Supabase insert error:', error.message);
  } else {
    memoryStore.push({ name, difficulty, time, mode, won, date: new Date().toISOString() });
    if (memoryStore.length > MAX_ENTRIES) memoryStore.shift();
  }
}

/**
 * Singleplayer best times for a difficulty.
 */
async function getSPBestTimes(difficulty, limit = 10) {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('game_results')
      .select('player_name, time_secs, created_at')
      .eq('difficulty', difficulty)
      .eq('won', true)
      .eq('mode', 'singleplayer')
      .order('time_secs', { ascending: true })
      .limit(limit);
    if (error) { console.error('Supabase query error:', error.message); return []; }
    return (data || []).map(r => ({ name: r.player_name, time: r.time_secs, date: r.created_at }));
  } else {
    return memoryStore
      .filter(e => e.difficulty === difficulty && e.mode === 'singleplayer' && e.won)
      .sort((a, b) => a.time - b.time)
      .slice(0, limit)
      .map(e => ({ name: e.name, time: e.time, date: e.date }));
  }
}

/**
 * Multiplayer best times for a difficulty.
 */
async function getMPBestTimes(difficulty, limit = 10) {
  if (useSupabase) {
    const { data, error } = await supabase
      .from('game_results')
      .select('player_name, time_secs, created_at')
      .eq('difficulty', difficulty)
      .eq('won', true)
      .eq('mode', 'multiplayer')
      .order('time_secs', { ascending: true })
      .limit(limit);
    if (error) { console.error('Supabase query error:', error.message); return []; }
    return (data || []).map(r => ({ name: r.player_name, time: r.time_secs, date: r.created_at }));
  } else {
    return memoryStore
      .filter(e => e.difficulty === difficulty && e.mode === 'multiplayer' && e.won)
      .sort((a, b) => a.time - b.time)
      .slice(0, limit)
      .map(e => ({ name: e.name, time: e.time, date: e.date }));
  }
}

/**
 * Multiplayer most wins for a difficulty.
 * Returns: [{ name, wins }]
 */
async function getMPMostWins(difficulty, limit = 10) {
  if (useSupabase) {
    // Use RPC or raw aggregation — Supabase JS doesn't support GROUP BY natively,
    // so we fetch all wins and aggregate client-side (fine for moderate data).
    const { data, error } = await supabase
      .from('game_results')
      .select('player_name')
      .eq('difficulty', difficulty)
      .eq('won', true)
      .eq('mode', 'multiplayer');
    if (error) { console.error('Supabase query error:', error.message); return []; }
    return aggregateWins(data.map(r => r.player_name), limit);
  } else {
    const names = memoryStore
      .filter(e => e.difficulty === difficulty && e.mode === 'multiplayer' && e.won)
      .map(e => e.name);
    return aggregateWins(names, limit);
  }
}

function aggregateWins(names, limit) {
  const counts = {};
  for (const n of names) counts[n] = (counts[n] || 0) + 1;
  return Object.entries(counts)
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, limit);
}

module.exports = { addEntry, getSPBestTimes, getMPBestTimes, getMPMostWins };
