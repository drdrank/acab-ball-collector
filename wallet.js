// ============================================================
// WALLET.JS — Pera Wallet Connect
// The SDK is loaded as an ES module in index.html and exposed
// as window.PeraWalletConnect once ready.
// ============================================================

let peraWallet   = null;   // single persistent instance
let _sdkLoaded   = false;  // true once pera-sdk-ready fires

// ---- Wait for the module script to finish ----------------
window.addEventListener('pera-sdk-ready', () => {
  _sdkLoaded = true;
  // If SDK loaded successfully, try to restore a previous session
  if (window.PeraWalletConnect) {
    _getInstance();   // create instance eagerly
    peraWallet.reconnectSession()
      .then(accounts => {
        if (accounts && accounts.length > 0) _onConnected(accounts[0]);
      })
      .catch(() => {}); // no saved session — not an error
  }
});

// ---- Create instance once --------------------------------
function _getInstance() {
  if (peraWallet) return peraWallet;
  if (!window.PeraWalletConnect) return null;
  peraWallet = new window.PeraWalletConnect();
  return peraWallet;
}

// ---- Wait for SDK (up to 8s) then connect ---------------
async function _waitForSDK() {
  if (_sdkLoaded) return !!window.PeraWalletConnect;
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 8000);
    window.addEventListener('pera-sdk-ready', () => {
      clearTimeout(timer);
      resolve(!!window.PeraWalletConnect);
    }, { once: true });
  });
}

// ---- Connect wallet (called from button) -----------------
async function connectWallet() {
  _clearWalletError();

  const ready = await _waitForSDK();
  if (!ready) {
    _showWalletError('Pera Wallet failed to load. Check your connection and refresh.');
    return;
  }

  const pera = _getInstance();
  if (!pera) return;

  try {
    const accounts = await pera.connect();
    if (accounts && accounts.length > 0) _onConnected(accounts[0]);
  } catch (error) {
    const msg = (error?.message || '').toLowerCase();
    if (!msg.includes('closed') && !msg.includes('cancel') && !msg.includes('reject')) {
      _showWalletError('Connection failed. Please try again.');
      console.error('[Wallet] connect error:', error);
    }
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
  _clearWalletError();
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

function _showWalletError(msg) {
  document.querySelectorAll('.wallet-error').forEach(el => {
    el.textContent = msg; el.style.display = '';
  });
  console.warn('[Wallet]', msg);
}

function _clearWalletError() {
  document.querySelectorAll('.wallet-error').forEach(el => {
    el.textContent = ''; el.style.display = 'none';
  });
}

function _short(addr) {
  if (!addr || addr.length < 8) return addr || '';
  return addr.slice(0, 5) + '...' + addr.slice(-4);
}

// ---- Wallet object (used by online-leaderboard.js) ------
const Wallet = {
  _name: null,

  isConnected()    { return !!window._walletAddress; },
  getAddress()     { return window._walletAddress || null; },
  getShortAddress: _short,

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
  reconnectSession: () => Promise.resolve(null), // handled via pera-sdk-ready event
};
