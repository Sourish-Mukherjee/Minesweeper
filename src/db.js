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
const MAX_ENTRIES = 500;

// ── Public API ─────────────────────────────────────────────────

/**
 * Add or update a game result — only keeps the best (fastest) time
 * per player/difficulty/mode combination.
 * Returns { isNewBest: boolean, previousBest: number|null }
 */
async function addOrUpdateEntry({ name, difficulty, time, mode, won = true }) {
  if (!won) return { isNewBest: false, previousBest: null };

  if (useSupabase) {
    // Check existing best for this player/difficulty/mode
    const { data: existing } = await supabase
      .from('game_results')
      .select('id, time_secs')
      .eq('player_name', name)
      .eq('difficulty', difficulty)
      .eq('mode', mode)
      .eq('won', true)
      .order('time_secs', { ascending: true })
      .limit(1);

    const previousBest = existing?.[0]?.time_secs ?? null;

    if (previousBest !== null && time >= previousBest) {
      // Not a new best — don't insert
      return { isNewBest: false, previousBest };
    }

    // Insert new best
    const { error } = await supabase.from('game_results').insert({
      player_name: name,
      difficulty,
      time_secs: time,
      won: true,
      mode,
    });
    if (error) console.error('Supabase insert error:', error.message);

    // Remove older entries for this player/difficulty/mode (keep only the new best)
    if (previousBest !== null && existing[0]?.id) {
      await supabase
        .from('game_results')
        .delete()
        .eq('id', existing[0].id);
    }

    return { isNewBest: true, previousBest };
  } else {
    // In-memory
    const existingIdx = memoryStore.findIndex(
      e => e.name === name && e.difficulty === difficulty && e.mode === mode && e.won
    );

    if (existingIdx >= 0) {
      const previousBest = memoryStore[existingIdx].time;
      if (time >= previousBest) {
        return { isNewBest: false, previousBest };
      }
      // Replace with better time
      memoryStore[existingIdx].time = time;
      memoryStore[existingIdx].date = new Date().toISOString();
      return { isNewBest: true, previousBest };
    }

    // Brand new entry
    memoryStore.push({ name, difficulty, time, mode, won: true, date: new Date().toISOString() });
    if (memoryStore.length > MAX_ENTRIES) memoryStore.shift();
    return { isNewBest: true, previousBest: null };
  }
}

/**
 * Get a player's personal best time for a difficulty + mode.
 * Returns time in seconds or null.
 */
async function getPersonalBest(name, difficulty, mode) {
  if (useSupabase) {
    const { data } = await supabase
      .from('game_results')
      .select('time_secs')
      .eq('player_name', name)
      .eq('difficulty', difficulty)
      .eq('mode', mode)
      .eq('won', true)
      .order('time_secs', { ascending: true })
      .limit(1);
    return data?.[0]?.time_secs ?? null;
  } else {
    const entries = memoryStore
      .filter(e => e.name === name && e.difficulty === difficulty && e.mode === mode && e.won)
      .sort((a, b) => a.time - b.time);
    return entries[0]?.time ?? null;
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

module.exports = { addOrUpdateEntry, getPersonalBest, getSPBestTimes, getMPBestTimes, getMPMostWins };
