// ============================================================
// UNLOCKS.JS — Ball skin unlock system
// ============================================================
// To add skins: add entry to BALL_SKINS with an unlock condition.
// unlockType: 'default' | 'level' | 'tokens' | 'stars' | 'score' | 'complete'

const BALL_SKINS = [
  {
    id: 'classic', name: 'Classic',
    emoji: '🏀', color: '#E87722',
    description: 'The OG orange ball.',
    unlockType: 'default', unlockValue: 0,
  },
  {
    id: 'tennis', name: 'Neon Tennis',
    emoji: '🎾', color: '#CCDD00',
    description: 'Fast and fuzzy.',
    unlockType: 'level', unlockValue: 2,
  },
  {
    id: 'smile', name: 'Smile Ball',
    emoji: '😊', color: '#FFD700',
    description: 'Keep smiling.',
    unlockType: 'tokens', unlockValue: 10,
  },
  {
    id: 'blue', name: 'Blue Court',
    emoji: '🔵', color: '#1565C0',
    description: 'Indoor court vibes.',
    unlockType: 'level', unlockValue: 4,
  },
  {
    id: 'gold', name: 'Gold Baseball',
    emoji: '⭐', color: '#FFD700',
    description: 'All that glitters.',
    unlockType: 'tokens', unlockValue: 25,
  },
  {
    id: 'neon', name: 'Neon Glow',
    emoji: '💚', color: '#00FF88',
    description: 'Night court energy.',
    unlockType: 'level', unlockValue: 6,
  },
  {
    id: 'graffiti', name: 'Graffiti Ball',
    emoji: '🎨', color: '#FF66CC',
    description: 'Street art drip.',
    unlockType: 'stars', unlockValue: 9,  // 9 total stars
  },
  {
    id: 'rainbow', name: 'Rainbow',
    emoji: '🌈', color: '#FF66CC',
    description: 'All courts are beautiful.',
    unlockType: 'tokens', unlockValue: 50,
  },
  {
    id: 'fire', name: 'Fire Ball',
    emoji: '🔥', color: '#FF3300',
    description: 'Too hot to handle.',
    unlockType: 'level', unlockValue: 8,
  },
  {
    id: 'crown', name: 'Crown Ball',
    emoji: '👑', color: '#FFD700',
    description: 'Champions only.',
    unlockType: 'score', unlockValue: 5000, // total score milestone
  },
  {
    id: 'acab', name: 'ACAB Legend',
    emoji: '🏆', color: '#7C4DFF',
    description: 'Complete all 10 levels.',
    unlockType: 'complete', unlockValue: 10,
  },
];

// ---- Persistence ----

function getUnlockState() {
  const raw = localStorage.getItem('acab_unlocks');
  return raw ? JSON.parse(raw) : { unlockedIds: ['classic'], equippedId: 'classic' };
}

function saveUnlockState(state) {
  localStorage.setItem('acab_unlocks', JSON.stringify(state));
}

function getTotalScore() {
  return parseInt(localStorage.getItem('acab_total_score') || '0');
}

function addToTotalScore(pts) {
  const current = getTotalScore();
  localStorage.setItem('acab_total_score', current + pts);
}

// Called after each level complete or on game state change.
// Returns array of newly unlocked skins.
function checkAndUnlock(level, totalTokens, gameComplete) {
  const state      = getUnlockState();
  const totalStars = Progress.getTotalStars();
  const totalScore = getTotalScore();
  const newUnlocks = [];

  BALL_SKINS.forEach(skin => {
    if (state.unlockedIds.includes(skin.id)) return;
    let unlock = false;
    if (skin.unlockType === 'default')   unlock = true;
    if (skin.unlockType === 'level'    && level      >= skin.unlockValue) unlock = true;
    if (skin.unlockType === 'tokens'   && totalTokens >= skin.unlockValue) unlock = true;
    if (skin.unlockType === 'stars'    && totalStars  >= skin.unlockValue) unlock = true;
    if (skin.unlockType === 'score'    && totalScore  >= skin.unlockValue) unlock = true;
    if (skin.unlockType === 'complete' && gameComplete)                    unlock = true;

    if (unlock) {
      state.unlockedIds.push(skin.id);
      newUnlocks.push(skin);
    }
  });

  if (newUnlocks.length) {
    saveUnlockState(state);
    Audio.play('unlock');
  }
  return newUnlocks;
}

function getEquippedSkin() {
  const state = getUnlockState();
  return BALL_SKINS.find(s => s.id === state.equippedId) || BALL_SKINS[0];
}

function equipSkin(id) {
  const state = getUnlockState();
  if (state.unlockedIds.includes(id)) {
    state.equippedId = id;
    saveUnlockState(state);
    Audio.play('click');
    return true;
  }
  return false;
}

// ---- UI Rendering ----

function renderUnlocksScreen() {
  const state = getUnlockState();
  const grid  = document.getElementById('unlocks-grid');
  grid.innerHTML = '';

  BALL_SKINS.forEach(skin => {
    const unlocked = state.unlockedIds.includes(skin.id);
    const equipped  = state.equippedId === skin.id;

    const card = document.createElement('div');
    card.className = 'skin-card' + (unlocked ? ' unlocked' : ' locked') + (equipped ? ' equipped' : '');

    let lockLabel = '';
    if (!unlocked) {
      if (skin.unlockType === 'level')    lockLabel = `Reach level ${skin.unlockValue}`;
      if (skin.unlockType === 'tokens')   lockLabel = `Collect ${skin.unlockValue} 😊`;
      if (skin.unlockType === 'stars')    lockLabel = `Earn ${skin.unlockValue} ⭐ total`;
      if (skin.unlockType === 'score')    lockLabel = `Score ${skin.unlockValue.toLocaleString()} pts`;
      if (skin.unlockType === 'complete') lockLabel = 'Complete all 10 levels';
    }

    card.innerHTML = `
      <div class="skin-emoji">${unlocked ? skin.emoji : '🔒'}</div>
      <div class="skin-name">${skin.name}</div>
      <div class="skin-desc">${unlocked ? skin.description : lockLabel}</div>
      ${unlocked && !equipped ? `<button class="btn btn-sm" onclick="handleEquip('${skin.id}')">Equip</button>` : ''}
      ${equipped ? '<div class="equipped-badge">Equipped ✓</div>' : ''}
    `;
    grid.appendChild(card);
  });
}

function handleEquip(id) {
  equipSkin(id);
  renderUnlocksScreen();
  const skin = getEquippedSkin();
  const el   = document.getElementById('hud-ball-val');
  if (el) el.textContent = skin.name;
  const msg = document.getElementById('equip-msg');
  if (msg) msg.textContent = `Equipped: ${skin.name} ${skin.emoji}`;
}
