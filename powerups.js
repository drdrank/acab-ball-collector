// ============================================================
// POWERUPS.JS — Power-up types, active state, world objects, HUD
// ============================================================
// To add a new power-up: add entry to POWERUP_TYPES, add a case
// in activatePowerup(), and handle the effect in script.js update().

const POWERUP_TYPES = {
  shield: { emoji: '🛡️', color: '#4ECDC4', label: 'Shield',      duration: 0  }, // 0 = until-hit
  speed:  { emoji: '⚡',  color: '#FFD700', label: 'Speed Boost', duration: 8  },
  magnet: { emoji: '🧲',  color: '#FF69B4', label: 'Magnet',      duration: 8  },
  freeze: { emoji: '❄️',  color: '#87CEEB', label: 'Freeze',      duration: 5  },
  double: { emoji: '💎',  color: '#9B59B6', label: '2× Score',    duration: 10 },
};

// Active power-up timers (seconds remaining; shield is bool)
const PowerupState = {
  shield: false,
  speed:  0,
  magnet: 0,
  freeze: 0,
  double: 0,
};

// Power-up items placed in the world each level
let worldPowerups = [];

// ---- Spawning ----

function spawnLevelPowerups(lvl) {
  worldPowerups = [];
  const types   = Object.keys(POWERUP_TYPES);
  const count   = Math.min(2 + Math.floor((lvl.id - 1) / 3), 4); // 2–4 per level
  const padding = 65;

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    let x, y, safe = false, attempts = 0;
    do {
      x = padding + Math.random() * (CONFIG.CANVAS_W - padding * 2);
      y = padding + Math.random() * (CONFIG.CANVAS_H - padding * 2);
      // isCollidingWithWalls is defined in script.js (loaded after this file, called at runtime)
      safe = !isCollidingWithWalls(x, y, 18);
      attempts++;
    } while (!safe && attempts < 50);

    worldPowerups.push({
      type, x, y,
      radius: 14,
      pulse:  Math.random() * Math.PI * 2,
      ...POWERUP_TYPES[type],
    });
  }
}

function resetPowerupState() {
  worldPowerups = [];
  PowerupState.shield = false;
  PowerupState.speed  = 0;
  PowerupState.magnet = 0;
  PowerupState.freeze = 0;
  PowerupState.double = 0;
  renderPowerupHUD();
}

// ---- Update ----

function updatePowerupTimers(dt) {
  let changed = false;
  ['speed', 'magnet', 'freeze', 'double'].forEach(k => {
    if (PowerupState[k] > 0) { PowerupState[k] = Math.max(0, PowerupState[k] - dt); changed = true; }
  });
  if (changed) renderPowerupHUD();
}

function activatePowerup(type) {
  const def = POWERUP_TYPES[type];
  if (type === 'shield') {
    PowerupState.shield = true;
  } else {
    // Stacking: add time on top of remaining (up to 1.5× duration)
    PowerupState[type] = Math.min((PowerupState[type] || 0) + def.duration, def.duration * 1.5);
  }
  renderPowerupHUD();
}

// Returns true if shield absorbed the hit
function tryShieldAbsorb() {
  if (!PowerupState.shield) return false;
  PowerupState.shield = false;
  Audio.play('collect');
  renderPowerupHUD();
  return true;
}

// ---- Pickup detection (called from script.js update) ----

function checkPowerupPickups(playerX, playerY, playerRadius) {
  for (let i = worldPowerups.length - 1; i >= 0; i--) {
    const p = worldPowerups[i];
    if (distTo(playerX, playerY, p.x, p.y) < playerRadius + p.radius) {
      activatePowerup(p.type);
      Audio.play('powerup');
      spawnPickupParticles(p.x, p.y, p.color);
      showScorePopup(p.x, p.y - 10, `${p.emoji} ${p.label}!`);
      worldPowerups.splice(i, 1);
    }
  }
}

// ---- Magnet physics (called from script.js update) ----

function applyMagnet(collectibles, playerX, playerY, dt) {
  if (PowerupState.magnet <= 0) return;
  const R     = 115;
  const force = 4.0;
  collectibles.forEach(c => {
    const d = distTo(playerX, playerY, c.x, c.y);
    if (d < R && d > 1) {
      const angle = Math.atan2(playerY - c.y, playerX - c.x);
      c.x += Math.cos(angle) * force * dt * 60;
      c.y += Math.sin(angle) * force * dt * 60;
    }
  });
}

// ---- Canvas effects ----

function drawWorldPowerups(ctx, now) {
  worldPowerups.forEach(p => {
    const pulse = 1 + 0.14 * Math.sin(now * 4 + p.pulse);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(pulse, pulse);
    // Outer ring
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 4, 0, Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 16;
    ctx.stroke();
    // Icon
    ctx.font          = `${Math.round(p.radius * 1.9)}px serif`;
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.shadowBlur    = 0;
    ctx.fillText(p.emoji, 0, 0);
    ctx.restore();
  });
}

function drawShieldEffect(ctx, px, py, now) {
  if (!PowerupState.shield) return;
  const pulse = 1 + 0.07 * Math.sin(now * 5);
  ctx.save();
  ctx.translate(px, py);
  ctx.beginPath();
  ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = '#4ECDC4';
  ctx.lineWidth   = 3.5;
  ctx.shadowColor = '#4ECDC4';
  ctx.shadowBlur  = 22;
  ctx.globalAlpha = 0.9;
  ctx.stroke();
  ctx.restore();
}

function drawMagnetRing(ctx, px, py) {
  if (PowerupState.magnet <= 0) return;
  ctx.save();
  ctx.translate(px, py);
  ctx.beginPath();
  ctx.arc(0, 0, 115, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,105,180,0.22)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([7, 7]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ---- HUD ----

function renderPowerupHUD() {
  const container = document.getElementById('powerup-hud');
  if (!container) return;
  container.innerHTML = '';

  const entries = [
    { key: 'shield', active: PowerupState.shield,    timer: null                 },
    { key: 'speed',  active: PowerupState.speed  > 0, timer: PowerupState.speed  },
    { key: 'magnet', active: PowerupState.magnet > 0, timer: PowerupState.magnet },
    { key: 'freeze', active: PowerupState.freeze > 0, timer: PowerupState.freeze },
    { key: 'double', active: PowerupState.double > 0, timer: PowerupState.double },
  ];

  entries.filter(e => e.active).forEach(e => {
    const def = POWERUP_TYPES[e.key];
    const pct = e.timer !== null ? Math.max(0, (e.timer / def.duration) * 100) : 100;
    const el  = document.createElement('div');
    el.className = 'powerup-pill';
    el.style.setProperty('--pu-color', def.color);
    el.innerHTML = `
      <span class="pu-icon">${def.emoji}</span>
      <div class="pu-bar"><div class="pu-fill" style="width:${pct}%; background:${def.color}"></div></div>
    `;
    container.appendChild(el);
  });
}
