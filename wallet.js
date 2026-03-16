// ============================================================
// WALLET.JS — Pera Wallet Connect
// ============================================================

let peraWallet = null;
let _sdkReady  = false;

// ---- SDK becomes ready when module script fires event ----
window.addEventListener('pera-sdk-ready', () => {
  _sdkReady = true;
  if (!window.PeraWalletConnect) return;

  // Create single persistent instance
  try {
    peraWallet = new window.PeraWalletConnect();
  } catch (e) {
    console.warn('[Wallet] init failed:', e);
    return;
  }

  // Try to restore previous session silently
  peraWallet.reconnectSession()
    .then(accounts => {
      if (accounts && accounts.length > 0) _onConnected(accounts[0]);
    })
    .catch(() => {});
});

// ---- Connect (called from button) ------------------------
async function connectWallet() {
  // If SDK not ready yet, wait up to 8s
  if (!_sdkReady) {
    await new Promise(resolve => {
      const t = setTimeout(resolve, 8000);
      window.addEventListener('pera-sdk-ready', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }

  if (!peraWallet) {
    console.warn('[Wallet] SDK not available');
    return;
  }

  try {
    const accounts = await peraWallet.connect();
    if (accounts && accounts.length > 0) _onConnected(accounts[0]);
  } catch (e) {
    // User closed the modal — not an error worth showing
    console.warn('[Wallet] connect cancelled or failed:', e?.message);
  }
}

// ---- Disconnect ------------------------------------------
async function disconnectWallet() {
  if (peraWallet) {
    try { await peraWallet.disconnect(); } catch (e) {}
  }
  _onDisconnected();
}

// ---- State handlers -------------------------------------
function _onConnected(address) {
  window._walletAddress = address;
  const short = _short(address);

  document.querySelectorAll('.btn-wallet-connect').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.wallet-pill').forEach(el => el.style.display = '');
  document.querySelectorAll('.wallet-addr').forEach(el => el.textContent = short);

  // Load saved display name
  const saved = localStorage.getItem('acab_wallet_name_' + address);
  if (saved) Wallet._name = saved;
  else if (typeof DB !== 'undefined' && DB.isReady()) {
    DB.getProfile(address).then(p => {
      if (p?.display_name) {
        Wallet._name = p.display_name;
        localStorage.setItem('acab_wallet_name_' + address, Wallet._name);
      }
    }).catch(() => {});
  }

  if (typeof Audio !== 'undefined') Audio.play('unlock');
}

function _onDisconnected() {
  window._walletAddress = null;
  Wallet._name = null;
  document.querySelectorAll('.btn-wallet-connect').forEach(el => el.style.display = '');
  document.querySelectorAll('.wallet-pill').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.wallet-addr').forEach(el => el.textContent = '');
}

function _short(addr) {
  if (!addr || addr.length < 8) return addr || '';
  return addr.slice(0, 5) + '...' + addr.slice(-4);
}

// ---- Wallet object (used by online-leaderboard.js) ------
const Wallet = {
  _name: null,

  isConnected()         { return !!window._walletAddress; },
  getAddress()          { return window._walletAddress || null; },
  getShortAddress(addr) { return _short(addr); },

  getDisplayName() {
    if (this._name) return this._name;
    return _short(window._walletAddress);
  },

  setDisplayName(name) {
    const addr = window._walletAddress;
    if (!addr) return;
    this._name = name.trim();
    if (this._name) localStorage.setItem('acab_wallet_name_' + addr, this._name);
  },

  connectWallet:    connectWallet,
  disconnectWallet: disconnectWallet,
  reconnectSession: () => Promise.resolve(null),
};
