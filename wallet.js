// ============================================================
// WALLET.JS — Pera Wallet connection
// ============================================================
// Uses @perawallet/connect loaded via CDN as window.PeraWalletConnect
// Falls back gracefully if the library is unavailable.
// ============================================================

const Wallet = (() => {
  let _pera    = null;
  let _address = null;
  let _name    = null;    // display name (from DB or user-set)

  // ---- Init -----------------------------------------------
  function _initPera() {
    if (_pera) return _pera;
    const Cls = (typeof PeraWalletConnect !== 'undefined')
      ? (PeraWalletConnect.default || PeraWalletConnect)
      : null;
    if (!Cls) { console.warn('[Wallet] PeraWalletConnect not loaded'); return null; }
    try {
      _pera = new Cls({ shouldShowSignTxnToast: false });
      return _pera;
    } catch (e) {
      console.warn('[Wallet] Pera init error:', e);
      return null;
    }
  }

  // ---- Session restore on page load -----------------------
  async function reconnectSession() {
    const pera = _initPera();
    if (!pera) return null;
    try {
      const accounts = await pera.reconnectSession();
      if (accounts && accounts[0]) {
        await _setAddress(accounts[0]);
        return _address;
      }
    } catch (e) { /* no saved session — fine */ }
    return null;
  }

  // ---- Connect wallet -------------------------------------
  async function connectWallet() {
    const pera = _initPera();
    if (!pera) { alert('Pera Wallet library not loaded. Check your internet connection.'); return null; }
    try {
      const accounts = await pera.connect();
      if (accounts && accounts[0]) {
        await _setAddress(accounts[0]);
        Audio.play('unlock');
        return _address;
      }
    } catch (e) {
      if (!e.message?.includes('Modal closed') && !e.message?.includes('cancelled')) {
        console.warn('[Wallet] connect error:', e);
      }
    }
    return null;
  }

  // ---- Disconnect -----------------------------------------
  async function disconnectWallet() {
    if (_pera) {
      try { await _pera.disconnect(); } catch (e) {}
    }
    _address = null;
    _name    = null;
    _updateUI();
  }

  // ---- Internal helpers -----------------------------------
  async function _setAddress(addr) {
    _address = addr;
    // Try to load saved display name
    const local = localStorage.getItem('acab_wallet_name_' + addr);
    if (local) {
      _name = local;
    } else if (DB.isReady()) {
      const profile = await DB.getProfile(addr);
      if (profile && profile.display_name) {
        _name = profile.display_name;
        localStorage.setItem('acab_wallet_name_' + addr, _name);
      }
    }
    _updateUI();
  }

  function _updateUI() {
    const connected = !!_address;
    const short     = connected ? getShortAddress(_address) : '';

    // All connect buttons
    document.querySelectorAll('.btn-wallet-connect').forEach(el => {
      el.style.display = connected ? 'none' : '';
    });
    // All wallet status pills
    document.querySelectorAll('.wallet-pill').forEach(el => {
      el.style.display = connected ? '' : 'none';
    });
    // Address spans
    document.querySelectorAll('.wallet-addr').forEach(el => {
      el.textContent = short;
    });
    // Pera label
    document.querySelectorAll('.wallet-label').forEach(el => {
      el.textContent = connected ? 'Pera ✓' : '';
    });
  }

  // ---- Public API -----------------------------------------
  function isAvailable() {
    return typeof PeraWalletConnect !== 'undefined';
  }

  function isConnected()   { return !!_address; }
  function getAddress()    { return _address; }

  function getDisplayName() {
    if (_name && _name.length > 0) return _name;
    return getShortAddress(_address);
  }

  function setDisplayName(name) {
    if (!_address) return;
    _name = name.trim();
    if (_name) localStorage.setItem('acab_wallet_name_' + _address, _name);
  }

  function getShortAddress(addr) {
    if (!addr || addr.length < 8) return addr || '';
    return addr.slice(0, 5) + '...' + addr.slice(-4);
  }

  return {
    reconnectSession,
    connectWallet,
    disconnectWallet,
    isAvailable,
    isConnected,
    getAddress,
    getDisplayName,
    setDisplayName,
    getShortAddress,
  };
})();
