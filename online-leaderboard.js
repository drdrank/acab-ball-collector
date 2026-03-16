// ============================================================
// ONLINE-LEADERBOARD.JS
// Loaded last — patches showScreen, handles online LB + submit
// ============================================================

let _lbTab          = 'online';   // 'online' | 'local'
let _realtimeSub    = null;
let _submitFrom     = null;       // which screen triggered Submit Online

// ---- Boot ---------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  // Try to restore Pera session silently
  Wallet.reconnectSession();

  // Start realtime subscription
  if (DB.isReady()) {
    _realtimeSub = DB.subscribeLeaderboard(() => {
      if (_lbTab === 'online') renderOnlineLeaderboard();
    });
  }

  // Patch showScreen to drive tab rendering + button visibility
  const _orig = window.showScreen;
  window.showScreen = function (id) {
    _orig(id);
    if (id === 'screen-leaderboard')   showLeaderboardTab(_lbTab);
    if (id === 'screen-gameover')      _updateSubmitButton('go-online-btn');
    if (id === 'screen-complete')      _updateSubmitButton('cp-online-btn');
  };
});

// ---- Leaderboard tabs ---------------------------------------
function showLeaderboardTab(tab) {
  _lbTab = tab;
  document.querySelectorAll('.lb-tab').forEach(t => {
    t.classList.toggle('lb-tab-active', t.dataset.tab === tab);
  });
  if (tab === 'online') {
    renderOnlineLeaderboard();
  } else {
    renderLeaderboard(); // local (from leaderboard.js)
  }
}

async function renderOnlineLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;

  if (!DB.isReady()) {
    list.innerHTML = `<div class="empty-msg">
      ⚙️ Online leaderboard not set up.<br>
      <span style="font-size:0.78rem;opacity:0.7">
        Add your Supabase keys in <b>env.js</b> to enable.
      </span>
    </div>`;
    return;
  }

  list.innerHTML = '<div class="empty-msg lb-loading">🔄 Loading scores…</div>';

  const scores = await DB.fetchTopScores(50);

  if (!scores || scores.length === 0) {
    list.innerHTML = '<div class="empty-msg">No scores yet — be the first! 🏀</div>';
    return;
  }

  const myAddr = Wallet.isConnected() ? Wallet.getAddress() : null;

  list.innerHTML = scores.map((row, i) => {
    const rank  = i + 1;
    const isMe  = myAddr && row.wallet_address === myAddr;
    const cls   = (rank === 1 ? 'lb-gold' : rank === 2 ? 'lb-silver' : rank === 3 ? 'lb-bronze' : '') +
                  (isMe ? ' lb-me' : '');
    const icon  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const name  = _escHtml(row.display_name || Wallet.getShortAddress(row.wallet_address));
    const date  = row.updated_at
      ? new Date(row.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : '';
    return `
      <div class="lb-row ${cls}">
        <span class="lb-rank">${icon}</span>
        <span class="lb-name">${name}${isMe ? ' <span class="lb-you">YOU</span>' : ''}</span>
        <span class="lb-score">${row.score.toLocaleString()}</span>
        <span class="lb-level">Lvl ${row.level_reached}</span>
        <span class="lb-tokens">${row.smile_tokens}😊</span>
        <span class="lb-date">${date}</span>
      </div>`;
  }).join('');
}

// ---- Submit Online button visibility ----------------------
function _updateSubmitButton(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.style.display = DB.isReady() ? '' : 'none';
}

// ---- Trigger submit from game-over / complete -------------
function openOnlineSubmit(fromScreen) {
  _submitFrom = fromScreen;

  if (!DB.isReady()) {
    alert('Online leaderboard not configured.\nAdd your Supabase keys in env.js.');
    return;
  }

  // Fill the submit panel
  document.getElementById('osub-score').textContent  = Game.score.toLocaleString();
  document.getElementById('osub-level').textContent  = Game.level;
  document.getElementById('osub-tokens').textContent = Game.tokens;

  // Wallet area
  _refreshOsubWallet();

  // Pre-fill name if we have one
  const nameInput = document.getElementById('osub-name');
  if (nameInput && Wallet.isConnected()) {
    const saved = Wallet.getDisplayName();
    nameInput.value = saved === Wallet.getShortAddress(Wallet.getAddress()) ? '' : saved;
  }

  const btn = document.getElementById('osub-submit-btn');
  if (btn) { btn.textContent = '🏆 Submit Score'; btn.disabled = false; }

  showScreen('screen-online-submit');
}

function _refreshOsubWallet() {
  const area = document.getElementById('osub-wallet-area');
  const connectArea = document.getElementById('osub-connect-area');
  if (!area || !connectArea) return;

  if (Wallet.isConnected()) {
    area.style.display = '';
    connectArea.style.display = 'none';
    document.getElementById('osub-wallet-addr').textContent = Wallet.getShortAddress(Wallet.getAddress());
  } else {
    area.style.display = 'none';
    connectArea.style.display = '';
  }
}

async function osubConnectWallet() {
  const addr = await Wallet.connectWallet();
  if (addr) _refreshOsubWallet();
}

async function confirmOnlineSubmit() {
  if (!Wallet.isConnected()) {
    const addr = await Wallet.connectWallet();
    if (!addr) return;
  }

  const nameInput = document.getElementById('osub-name');
  const typedName = nameInput ? nameInput.value.trim() : '';
  if (typedName) Wallet.setDisplayName(typedName);

  const btn = document.getElementById('osub-submit-btn');
  if (btn) { btn.textContent = '⏳ Submitting…'; btn.disabled = true; }

  const result = await DB.submitScore(
    Wallet.getAddress(),
    Wallet.getDisplayName(),
    Game.score,
    Game.level,
    Game.tokens,
    getEquippedSkin().id
  );

  if (btn) { btn.textContent = '🏆 Submit Score'; btn.disabled = false; }

  if (result.success) {
    if (result.updated) {
      showScreen('screen-leaderboard');
      showLeaderboardTab('online');
    } else {
      // Score was not a new best — show leaderboard anyway
      const msg = `Your best score is already ${result.existingScore?.toLocaleString() || 'higher'}. This run didn't beat it.`;
      alert(msg);
      showScreen('screen-leaderboard');
      showLeaderboardTab('online');
    }
  } else {
    alert('Could not submit: ' + (result.reason || 'unknown error'));
    if (btn) btn.disabled = false;
  }
}

function cancelOnlineSubmit() {
  showScreen(_submitFrom || 'screen-gameover');
}

// ---- Wallet connect/disconnect UI helpers -----------------
async function connectWalletUI() {
  await Wallet.connectWallet();
}

async function disconnectWalletUI() {
  await Wallet.disconnectWallet();
}

// ---- Utilities --------------------------------------------
function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
