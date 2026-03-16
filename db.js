// ============================================================
// DB.JS — Supabase client + leaderboard operations
// ============================================================
// Loaded after env.js (which defines ENV) and after the
// Supabase CDN script (which defines window.supabase).
// ============================================================

const DB = (() => {
  let client = null;

  // ---- Init ------------------------------------------------
  function init() {
    if (typeof supabase === 'undefined') return;
    if (!ENV.SUPABASE_URL || ENV.SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') return;
    try {
      client = supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
      console.log('[DB] Supabase connected');
    } catch (e) {
      console.warn('[DB] Supabase init failed:', e);
    }
  }

  function isReady() { return !!client; }

  // ---- Validation (basic anti-cheat) -----------------------
  // NOTE: Add a Supabase Edge Function at /functions/v1/submit-score
  // to validate server-side and verify wallet signatures.
  // The client sends the same payload; the edge function checks
  // that score is achievable given level/tokens, then upserts.
  function _validate(payload) {
    const { score, level_reached, smile_tokens, wallet_address } = payload;
    if (typeof wallet_address !== 'string' || wallet_address.length < 8) return false;
    if (typeof score !== 'number' || score < 0 || score > 999999) return false;
    if (typeof level_reached !== 'number' || level_reached < 1 || level_reached > 10) return false;
    if (typeof smile_tokens !== 'number' || smile_tokens < 0 || smile_tokens > 9999) return false;
    return true;
  }

  // ---- Fetch top scores ------------------------------------
  async function fetchTopScores(limit = 50) {
    if (!client) return null;
    try {
      const { data, error } = await client
        .from('leaderboard_scores')
        .select('wallet_address, display_name, score, level_reached, smile_tokens, updated_at')
        .order('score', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    } catch (e) {
      console.warn('[DB] fetchTopScores error:', e);
      return null;
    }
  }

  // ---- Submit score (best-only per wallet) -----------------
  // WALLET SIGNATURE VERIFICATION can be added here:
  //   1. Before submitting, call Wallet.signMessage(nonce + score + level)
  //   2. Send { payload, signature } to a Supabase Edge Function
  //   3. Edge Function verifies signature via algosdk.verifyBytes
  //   4. Only then does it upsert into the DB
  // Until then, basic client-side + RLS validation is used.
  async function submitScore(wallet, displayName, score, level, tokens, skin) {
    if (!client) return { success: false, reason: 'not_configured' };

    const payload = {
      wallet_address: wallet,
      display_name:   displayName || null,
      score:          Math.round(score),
      level_reached:  level,
      smile_tokens:   tokens,
      selected_skin:  skin || 'classic',
      game_version:   ENV.GAME_VERSION || '1.0.0',
      updated_at:     new Date().toISOString(),
    };

    if (!_validate(payload)) {
      return { success: false, reason: 'invalid_payload' };
    }

    try {
      // Check if existing score is already higher
      const { data: existing } = await client
        .from('leaderboard_scores')
        .select('score')
        .eq('wallet_address', wallet)
        .maybeSingle();

      if (existing && existing.score >= score) {
        return { success: true, updated: false, reason: 'not_a_new_best', existingScore: existing.score };
      }

      const { error } = await client
        .from('leaderboard_scores')
        .upsert(payload, { onConflict: 'wallet_address' });

      if (error) throw error;
      return { success: true, updated: true };
    } catch (e) {
      console.warn('[DB] submitScore error:', e);
      return { success: false, reason: e.message || 'unknown_error' };
    }
  }

  // ---- Get profile for a wallet ----------------------------
  async function getProfile(wallet) {
    if (!client) return null;
    try {
      const { data } = await client
        .from('leaderboard_scores')
        .select('display_name, score')
        .eq('wallet_address', wallet)
        .maybeSingle();
      return data;
    } catch (e) { return null; }
  }

  // ---- Realtime subscription -------------------------------
  function subscribeLeaderboard(callback) {
    if (!client) return null;
    return client
      .channel('leaderboard-live')
      .on('postgres_changes',
          { event: '*', schema: 'public', table: 'leaderboard_scores' },
          callback)
      .subscribe();
  }

  return { init, isReady, fetchTopScores, submitScore, getProfile, subscribeLeaderboard };
})();

// Auto-init when this script loads
DB.init();
