// ============================================================
// WALLET.JS — Pera Wallet Connect
// Ref: https://github.com/perawallet/connect
// SDK: pera-wallet.js (self-hosted esbuild bundle → window.__PeraPkg)
// ============================================================

// IMPORTANT: peraWallet is initialised LAZILY (inside _getWallet).
// Do NOT call new PeraWalletConnect() at the top level — if the bundle
// hasn't loaded yet the TypeError kills this entire script silently.
let _peraWallet = null;

function _getWallet() {
  if (_peraWallet) return _peraWallet;

  if (!window.PeraWalletConnect) {
    const detail = window._peraLoadError
      ? `Bundle error: ${window._peraLoadError}`
      : 'pera-wallet.js did not load correctly. Please refresh.';
    _showError(detail);
    return null;
  }

  try {
    _peraWallet = new window.PeraWalletConnect({
      chainId: 416001,             // MainNet (416002 = TestNet)
      shouldShowSignTxnToast: false,
    });
    return _peraWallet;
  } catch (e) {
    _showError('Pera Wallet init failed: ' + (e?.message || e));
    return null;
  }
}

// ============================================================
// RECONNECT SESSION — restore session on every page load
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const pw = _getWallet();
  if (!pw) return;

  pw.reconnectSession()
    .then((accounts) => {
      pw.connector?.on('disconnect', handleDisconnectWalletClick);
      if (accounts.length) _setAccountAddress(accounts[0]);
    })
    .catch(console.log);
});

// ============================================================
// CONNECT — opens QR code / deep-links to Pera Wallet app
// ============================================================
function handleConnectWalletClick() {
  const btns = document.querySelectorAll('.btn-wallet-connect');
  btns.forEach(b => { b.textContent = '⏳ Connecting…'; b.disabled = true; });
  _clearError();

  const pw = _getWallet();
  if (!pw) {
    btns.forEach(b => { b.textContent = '🔗 Connect Wallet'; b.disabled = false; });
    return;
  }

  // Pera injects a wrapper div into <body> containing a
  // <pera-wallet-connect-modal> Web Component for the QR code.
  // Our game screens sit at z-index 10–30; force any new body
  // child to appear above them the instant it is injected.
  const obs = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        node.style.setProperty('z-index',        '2147483647', 'important');
        node.style.setProperty('position',       'fixed',      'important');
        node.style.setProperty('top',            '0',          'important');
        node.style.setProperty('left',           '0',          'important');
        node.style.setProperty('width',          '100%',       'important');
        node.style.setProperty('height',         '100%',       'important');
        node.style.setProperty('display',        'block',      'important');
        node.style.setProperty('visibility',     'visible',    'important');
        node.style.setProperty('opacity',        '1',          'important');
        node.style.setProperty('pointer-events', 'all',        'important');
      });
    });
  });
  obs.observe(document.body, { childList: true });

  // Timeout: if no modal appears within 12 s the bridge is unreachable
  const timeoutId = setTimeout(() => {
    btns.forEach(b => { b.textContent = '🔗 Connect Wallet'; b.disabled = false; });
    _showError('Connection timed out. Make sure Pera Wallet is installed and try again.');
    obs.disconnect();
  }, 12000);

  pw.connect()
    .then((newAccounts) => {
      clearTimeout(timeoutId);
      pw.connector?.on('disconnect', handleDisconnectWalletClick);
      console.log('[Wallet] platform:', pw.platform);
      _setAccountAddress(newAccounts[0]);
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      btns.forEach(b => { b.textContent = '🔗 Connect Wallet'; b.disabled = false; });
      // CONNECT_MODAL_CLOSED = user dismissed on purpose, not an error
      if (error?.data?.type !== 'CONNECT_MODAL_CLOSED') {
        _showError('Connect failed: ' + (error?.message || String(error)));
        console.log('[Wallet] connect error:', error);
      }
    })
    .finally(() => { clearTimeout(timeoutId); obs.disconnect(); });
}

// ============================================================
// DISCONNECT
// ============================================================
function handleDisconnectWalletClick() {
  const pw = _getWallet();
  if (pw) pw.disconnect();
  _setAccountAddress(null);
}

// ============================================================
// SIGN TRANSACTION  (for future on-chain features)
// txGroups: SignerTransaction[][]   signerAddress?: string
// Returns: Promise<Uint8Array[]>
// ============================================================
async function signTransaction(txGroups, signerAddress) {
  const pw = _getWallet();
  if (!pw || !pw.isConnected) throw new Error('Wallet not connected');
  return pw.signTransaction(txGroups, signerAddress);
}

// ============================================================
// ADDRESS STATE
// ============================================================
function _setAccountAddress(address) {
  window._walletAddress = address || null;

  if (address) {
    const short = _short(address);
    document.querySelectorAll('.btn-wallet-connect').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.wallet-pill').forEach(el => el.style.display = '');
    document.querySelectorAll('.wallet-addr').forEach(el => el.textContent = short);
    _clearError();

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

  } else {
    Wallet._name = null;
    document.querySelectorAll('.btn-wallet-connect').forEach(el => el.style.display = '');
    document.querySelectorAll('.wallet-pill').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.wallet-addr').forEach(el => el.textContent = '');
  }
}

// ============================================================
// HELPERS
// ============================================================
function _short(addr) {
  if (!addr || addr.length < 10) return addr || '';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}
function _showError(msg) {
  const el = document.getElementById('wallet-error-msg');
  if (el) el.textContent = msg;
}
function _clearError() {
  const el = document.getElementById('wallet-error-msg');
  if (el) el.textContent = '';
}

// ============================================================
// PUBLIC ALIASES — called from HTML onclick & online-leaderboard.js
// ============================================================
function connectWallet()    { handleConnectWalletClick(); }
function disconnectWallet() { handleDisconnectWalletClick(); }

// ============================================================
// WALLET OBJECT — used by online-leaderboard.js and db.js
// ============================================================
const Wallet = {
  _name: null,

  isConnected()  { return !!(_getWallet()?.isConnected); },
  getAddress()   { return window._walletAddress || null; },
  getPlatform()  { return _getWallet()?.platform || null; },

  getShortAddress(addr) { return _short(addr); },

  getDisplayName() {
    return this._name || _short(window._walletAddress);
  },

  setDisplayName(name) {
    const addr = window._walletAddress;
    if (!addr) return;
    this._name = name.trim();
    if (this._name) localStorage.setItem('acab_wallet_name_' + addr, this._name);
  },

  connectWallet:    connectWallet,
  disconnectWallet: disconnectWallet,
  signTransaction:  signTransaction,
  reconnectSession: () => Promise.resolve(null),
};
