// ============================================================
// DB.JS — On-chain leaderboard via Algorand + Algonode
// ============================================================
// No backend required. Scores are stored as signed Algorand
// transactions with a JSON note. Reading uses Algonode's free
// public indexer. Writing uses Pera Wallet to sign + submit.
//
// Note format (JSON, stored as tx note bytes):
//   {"g":"acab","s":1234,"l":5,"t":10,"n":"PlayerName"}
//
// Submitting costs ~0.001 ALGO (network fee only).
// ============================================================

const DB = (() => {
  const ALGOD   = 'https://mainnet-api.algonode.cloud';
  const INDEXER = 'https://mainnet-idx.algonode.cloud/v2';

  // Note prefix: base64 of '{"g":"acab",' (12 bytes, clean base64)
  const NOTE_TAG    = '{"g":"acab",';
  const NOTE_PREFIX = btoa(NOTE_TAG); // eyJnIjoiYWNhYiIs

  // ---- always ready (uses public APIs) ----------------------
  function isReady() { return true; }
  function init()    {}  // no-op

  // ---- Fetch top scores from indexer ------------------------
  async function fetchTopScores(limit = 50) {
    try {
      const url = `${INDEXER}/transactions` +
        `?note-prefix=${encodeURIComponent(NOTE_PREFIX)}` +
        `&limit=500&tx-type=pay`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Indexer ${resp.status}`);
      const data = await resp.json();

      // Keep best score per wallet address
      const best = {};
      for (const txn of (data.transactions || [])) {
        if (!txn.note || !txn.sender) continue;
        try {
          const raw  = atob(txn.note);
          const note = JSON.parse(raw);
          if (note.g !== 'acab') continue;

          const addr = txn.sender;
          if (!best[addr] || note.s > best[addr].score) {
            best[addr] = {
              wallet_address: addr,
              display_name:   note.n || null,
              score:          Number(note.s) || 0,
              level_reached:  Number(note.l) || 1,
              smile_tokens:   Number(note.t) || 0,
              updated_at:     txn['round-time']
                ? new Date(txn['round-time'] * 1000).toISOString()
                : null,
            };
          }
        } catch (_) {}
      }

      return Object.values(best)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (e) {
      console.warn('[DB] fetchTopScores error:', e);
      return null;
    }
  }

  // ---- Get a wallet's current best from the indexer ---------
  async function _getBestForWallet(wallet) {
    try {
      const url = `${INDEXER}/accounts/${wallet}/transactions` +
        `?note-prefix=${encodeURIComponent(NOTE_PREFIX)}&limit=100&tx-type=pay`;
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const data = await resp.json();

      let best = 0;
      for (const txn of (data.transactions || [])) {
        if (!txn.note) continue;
        try {
          const note = JSON.parse(atob(txn.note));
          if (note.g === 'acab' && note.s > best) best = note.s;
        } catch (_) {}
      }
      return best;
    } catch (_) { return null; }
  }

  // ---- Submit score as a signed Algorand transaction --------
  async function submitScore(wallet, displayName, score, level, tokens) {
    if (!window.algosdk) {
      return { success: false, reason: 'algosdk not loaded — refresh the page' };
    }
    if (!Wallet.isConnected()) {
      return { success: false, reason: 'wallet_not_connected' };
    }

    // Client-side check: only submit if a new personal best
    const currentBest = await _getBestForWallet(wallet);
    if (currentBest !== null && currentBest >= score) {
      return {
        success:       true,
        updated:       false,
        reason:        'not_a_new_best',
        existingScore: currentBest,
      };
    }

    try {
      // 1. Get suggested params
      const pResp = await fetch(`${ALGOD}/v2/transactions/params`);
      if (!pResp.ok) throw new Error('Could not fetch tx params');
      const p = await pResp.json();

      // 2. Build note
      const noteObj = {
        g: 'acab',
        s: Math.round(score),
        l: level,
        t: tokens,
        n: (displayName || '').substring(0, 20),
      };
      const noteBytes = new TextEncoder().encode(JSON.stringify(noteObj));

      // 3. Build transaction (self-send, 0 ALGO, just the fee)
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: wallet,
        to:   wallet,
        amount: 0,
        note:   noteBytes,
        suggestedParams: {
          fee:        1000,
          flatFee:    true,
          firstRound: p['last-round'],
          lastRound:  p['last-round'] + 1000,
          genesisID:  p['genesis-id'],
          genesisHash: p['genesis-hash'],
        },
      });

      // 4. Sign with Pera Wallet (opens Pera sign modal)
      const signedArr = await Wallet.signTransaction(
        [[{ txn, signers: [wallet] }]]
      );

      // 5. Submit to network
      const sResp = await fetch(`${ALGOD}/v2/transactions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-binary' },
        body:    signedArr[0],
      });

      if (!sResp.ok) {
        const err = await sResp.json().catch(() => ({}));
        throw new Error(err.message || `Submit failed (${sResp.status})`);
      }

      const result = await sResp.json();
      console.log('[DB] Score on-chain, txId:', result.txId);
      return { success: true, updated: true, txId: result.txId };

    } catch (e) {
      // User cancelled the Pera sign modal
      if (String(e).includes('CANCELLED') || String(e?.data?.type).includes('CANCELLED')) {
        return { success: false, reason: 'cancelled' };
      }
      console.warn('[DB] submitScore error:', e);
      return { success: false, reason: e.message || 'unknown_error' };
    }
  }

  // ---- Get profile (best score) for a wallet ----------------
  async function getProfile(wallet) {
    const best = await _getBestForWallet(wallet);
    return best ? { score: best } : null;
  }

  // ---- Poll for new scores every 30 s -----------------------
  function subscribeLeaderboard(callback) {
    return setInterval(callback, 30000);
  }

  return { init, isReady, fetchTopScores, submitScore, getProfile, subscribeLeaderboard };
})();

DB.init();
