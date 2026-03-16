// ============================================================
// WALLET.JS — Pera Wallet Connect
// Follows the exact pattern from Pera Wallet documentation.
// CDN must be loaded first (see index.html script tags).
// ============================================================

// Single persistent instance
let peraWallet = null;

// ---- SDK check -------------------------------------------
function _sdkReady() {
  return !!(window['@perawallet/connect'] && window['@perawallet/connect'].PeraWalletConnect);
}

// ---- Create instance once --------------------------------
function _getInstance() {
  if (peraWallet) return peraWallet;

  if (!_sdkReady()) {
    _showWalletError('Pera Wallet SDK not loaded. Please refresh the page.');
    return null;
  }

  const { PeraWalletConnect } = window['@perawallet/connect'];
  peraWallet = new PeraWalletConnect();
  return peraWallet;
}

// ---- Reconnect on page load ------------------------------
window.addEventListener('load', () => {
  const pera = _getInstance();
  if (!pera) return;

  pera.reconnectSession()
    .then(accounts => {
      if (accounts && accounts.length > 0) {
        _onConnected(accounts[0]);
      }
    })
    .catch(() => {
      // No previous session — expected, not an error
    });
});

// ---- Connect wallet (called from button) -----------------
async function connectWallet() {
  const pera = _getInstance();
  if (!pera) return;

  _clearWalletError();

  try {
    const accounts = await pera.connect();
    if (accounts && accounts.length > 0) {
      _onConnected(accounts[0]);
    }
  } catch (error) {
    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('closed') || msg.includes('cancel') || msg.includes('reject')) {
      // User closed the modal — not an error
      return;
    }
    console.error('[Wallet] Connection failed:', error);
    _showWalletError('Connection failed. Please try again.');
  }
}

// ---- Disconnect ------------------------------------------
async function disconnectWallet() {
  if (peraWallet) {
    try { await peraWallet.disconnect(); } catch (e) {}
    // Keep instance alive for future reconnects
  }
  _onDisconnected();
}

// ---- Internal state handlers ----------------------------
function _onConnected(address) {
  _clearWalletError();

  // Show address in all wallet UI elements
  const short = _shortAddress(address);
  document.querySelectorAll('.btn-wallet-connect').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.wallet-pill').forEach(el => el.style.display = '');
  document.querySelectorAll('.wallet-addr').forEach(el => el.textContent = short);

  // Store for other systems
  window._walletAddress = address;

  // Notify Wallet object if it exists
  if (typeof Wallet !== 'undefined' && Wallet._onConnectedExternal) {
    Wallet._onConnectedExternal(address);
  }

  if (typeof Audio !== 'undefined') Audio.play('unlock');
  console.log('[Wallet] Connected:', address);
}

function _onDisconnected() {
  window._walletAddress = null;
  document.querySelectorAll('.btn-wallet-connect').forEach(el => el.style.display = '');
  document.querySelectorAll('.wallet-pill').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.wallet-addr').forEach(el => el.textContent = '');
  console.log('[Wallet] Disconnected');
}

function _showWalletError(msg) {
  document.querySelectorAll('.wallet-error').forEach(el => {
    el.textContent = msg;
    el.style.display = '';
  });
  console.warn('[Wallet]', msg);
}

function _clearWalletError() {
  document.querySelectorAll('.wallet-error').forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });
}

function _shortAddress(addr) {
  if (!addr || addr.length < 8) return addr || '';
  return addr.slice(0, 5) + '...' + addr.slice(-4);
}

// ---- Wallet object (used by online-leaderboard.js) -------
const Wallet = {
  _address: null,
  _name:    null,

  _onConnectedExternal(addr) {
    this._address = addr;
    const local = localStorage.getItem('acab_wallet_name_' + addr);
    if (local) this._name = local;
    else if (typeof DB !== 'undefined' && DB.isReady()) {
      DB.getProfile(addr).then(p => {
        if (p?.display_name) {
          this._name = p.display_name;
          localStorage.setItem('acab_wallet_name_' + addr, this._name);
        }
      }).catch(() => {});
    }
  },

  isConnected()    { return !!(window._walletAddress); },
  getAddress()     { return window._walletAddress || null; },
  getShortAddress(addr) { return _shortAddress(addr); },

  getDisplayName() {
    if (this._name) return this._name;
    return _shortAddress(window._walletAddress);
  },

  setDisplayName(name) {
    const addr = window._walletAddress;
    if (!addr) return;
    this._name = name.trim();
    if (this._name) localStorage.setItem('acab_wallet_name_' + addr, this._name);
  },

  connectWallet:    () => connectWallet(),
  disconnectWallet: () => disconnectWallet(),
  reconnectSession: () => Promise.resolve(null), // handled by window.load above
};
