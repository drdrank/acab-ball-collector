// ============================================================
// WALLET.JS — Pera Wallet connection
// ============================================================

const Wallet = (() => {
  let _pera    = null;   // single instance, never re-created
  let _address = null;
  let _name    = null;

  // ---- Create ONE instance and keep it --------------------
  function _initPera() {
    if (_pera) return _pera;
    const pkg = window['@perawallet/connect'];
    if (!pkg || !pkg.PeraWalletConnect) {
      console.warn('[Wallet] @perawallet/connect not loaded yet');
      return null;
    }
    try {
      _pera = new pkg.PeraWalletConnect();
      // Handle wallet-side disconnects (e.g. user disconnects in app)
      _pera.connector?.on('disconnect', () => {
        _address = null;
        _name    = null;
        _updateUI();
      });
      return _pera;
    } catch (e) {
      console.warn('[Wallet] init error:', e);
      return null;
    }
  }

  // ---- Restore existing session on page load --------------
  async function reconnectSession() {
    const pera = _initPera();
    if (!pera) return null;
    try {
      const accounts = await pera.reconnectSession();
      if (accounts && accounts.length > 0) {
        await _setAddress(accounts[0]);
        return _address;
      }
    } catch (e) {
      // No saved session — normal, not an error
    }
    return null;
  }

  // ---- Connect wallet -------------------------------------
  async function connectWallet() {
    const pera = _initPera();
    if (!pera) {
      alert('Pera Wallet could not be loaded.\nTry refreshing the page.');
      return null;
    }
    try {
      const accounts = await pera.connect();
      if (accounts && accounts.length > 0) {
        await _setAddress(accounts[0]);
        Audio.play('unlock');
        return _address;
      }
    } catch (e) {
      const msg = (e?.message || '').toLowerCase();
      if (!msg.includes('closed') && !msg.includes('cancel') && !msg.includes('reject')) {
        console.warn('[Wallet] connect error:', e);
      }
    }
    return null;
  }

  // ---- Disconnect wallet ----------------------------------
  async function disconnectWallet() {
    if (_pera) {
      try { await _pera.disconnect(); } catch (e) {}
      // Keep _pera alive — reconnect needs the same instance
    }
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
    } else if (typeof DB !== 'undefined' && DB.isReady()) {
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
