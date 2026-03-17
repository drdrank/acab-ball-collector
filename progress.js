// ============================================================
// PROGRESS.JS — Level unlock, star ratings, best scores
// ============================================================
// FUTURE: Replace _load/_save with a Supabase/Firebase API call
//         to sync progress across devices.

const Progress = (() => {
  const KEY = 'acab_progress_v2';

  function _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return { unlockedLevels: [1], stars: {}, bestScores: {} };
  }

  function _save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function isUnlocked(level) {
    if (level === 1) return true;
    return _load().unlockedLevels.includes(level);
  }

  function unlockLevel(level) {
    const d = _load();
    if (!d.unlockedLevels.includes(level)) {
      d.unlockedLevels.push(level);
      _save(d);
    }
  }

  function getStars(level) {
    return _load().stars[String(level)] || 0;
  }

  // Returns true if this is a new personal best star count
  function setStars(level, stars) {
    const d       = _load();
    const current = d.stars[String(level)] || 0;
    if (stars > current) {
      d.stars[String(level)] = stars;
      _save(d);
      return true;
    }
    return false;
  }

  function getBestScore(level) {
    return _load().bestScores[String(level)] || 0;
  }

  function setBestScore(level, score) {
    const d       = _load();
    const current = d.bestScores[String(level)] || 0;
    if (score > current) {
      d.bestScores[String(level)] = score;
      _save(d);
    }
  }

  function getTotalStars() {
    const d = _load();
    return Object.values(d.stars).reduce((a, b) => a + b, 0);
  }

  // ---- Level Select UI ----
  function renderLevelSelect() {
    const grid = document.getElementById('level-select-grid');
    if (!grid) return;
    grid.innerHTML = '';

    LEVELS.forEach(lvl => {
      const unlocked = isUnlocked(lvl.id);
      const stars    = getStars(lvl.id);
      const best     = getBestScore(lvl.id);
      const starStr  = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

      const ct = lvl.courtTheme || {};
      const card = document.createElement('div');
      card.className = `level-card ${unlocked ? 'lc-unlocked' : 'lc-locked'} lc-court-${lvl.id}`;
      card.innerHTML = `
        <div class="lc-court-icon">${ct.icon || ''}</div>
        <div class="lc-content">
          <div class="lc-num">${lvl.id}</div>
          <div class="lc-name">${unlocked ? lvl.name : '???'}</div>
          <div class="lc-stars">${starStr}</div>
          ${best > 0 ? `<div class="lc-best">Best: ${best}</div>` : ''}
          ${!unlocked ? '<div class="lc-lock">🔒</div>' : ''}
        </div>
      `;
      if (unlocked) card.onclick = () => startLevelFromSelect(lvl.id);
      grid.appendChild(card);
    });
  }

  return { isUnlocked, unlockLevel, getStars, setStars, getBestScore, setBestScore, getTotalStars, renderLevelSelect };
})();
