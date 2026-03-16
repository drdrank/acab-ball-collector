// ============================================================
// WALLET.JS — Pera Wallet connection
// ============================================================
// Pera Wallet is loaded on-demand via dynamic import() from
// esm.sh — no CDN script tag needed, works in any browser.
// ============================================================

const Wallet = (() => {
  let _pera    = null;
  let _PeraCls = null;
  let _address = null;
  let _name    = null;

  // ---- Get Pera class from UMD global ---------------------
  function _getPeraCls() {
    // UMD bundle exposes window["@perawallet/connect"].PeraWalletConnect
    const pkg = window['@perawallet/connect'];
    if (pkg && pkg.PeraWalletConnect) return pkg.PeraWalletConnect;
    return null;
  }

  function _getPera() {
    if (_pera) return _pera;
    const Cls = _getPeraCls();
    if (!Cls) return null;
    try {
      _pera = new Cls();
      return _pera;
    } catch (e) {
      console.warn('[Wallet] PeraWalletConnect init error:', e);
      return null;
    }
  }

  // ---- Session restore on page load -----------------------
  async function reconnectSession() {
    const pera = _getPera();
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
    const pera = _getPera();
    if (!pera) {
      alert('Could not load Pera Wallet.\nMake sure you have an internet connection and try again.');
      return null;
    }
    try {
      const accounts = await pera.connect();
      if (accounts && accounts[0]) {
        await _setAddress(accounts[0]);
        Audio.play('unlock');
        return _address;
      }
    } catch (e) {
      // User closed modal — not an error worth alerting
      const msg = e?.message || '';
      if (!msg.includes('closed') && !msg.includes('cancelled') && !msg.includes('rejected')) {
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
    _pera    = null;
    _address = null;
    _name    = null;
    _updateUI();
  }

  // ---- Internal -------------------------------------------
  async function _setAddress(addr) {
    _address = addr;
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

    document.querySelectorAll('.btn-wallet-connect').forEach(el => {
      el.style.display = connected ? 'none' : '';
    });
    document.querySelectorAll('.wallet-pill').forEach(el => {
      el.style.display = connected ? '' : 'none';
    });
    document.querySelectorAll('.wallet-addr').forEach(el => {
      el.textContent = short;
    });
  }

  // ---- Public API -----------------------------------------
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
    isConnected,
    getAddress,
    getDisplayName,
    setDisplayName,
    getShortAddress,
  };
})();
