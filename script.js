// ============================================================
// SCRIPT.JS — Main game engine
// ============================================================
// FUTURE hooks (search these tags):
//   FUTURE_WALLET     — connect wallet / Web3
//   FUTURE_ONLINE_LB  — replace localStorage leaderboard with API
//   FUTURE_ASSETS     — swap emoji graphics with custom sprites
//   FUTURE_MAP        — real-world court map integration
//   FUTURE_STORY      — story mode / dialogue system
//   FUTURE_MOBILE     — mobile virtual joystick

// ============================================================
// GAME STATE
// ============================================================
const Game = {
  running:  false,
  paused:   false,
  level:    1,
  score:    0,
  tokens:   0,        // smile tokens this run
  totalTokens: 0,     // lifetime (for unlock checks)
  lives:    CONFIG.STARTING_LIVES,
  playerName: 'Player',

  // Combo
  combo:      0,
  comboTimer: 0,

  // Progress tracking for star calculation
  livesLostThisLevel: 0,
  goalsMet: false,

  // Speed timer
  levelTimer: 0,

  // Frame timing
  lastTime: 0,
  animId:   null,

  // Screen shake
  shake: { timer: 0, intensity: 0 },
};

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ============================================================
// INPUT
// ============================================================
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && Game.running) {
    Game.paused ? resumeGame() : pauseGame();
  }
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

// ============================================================
// PLAYER
// ============================================================
const player = {
  x: 100, y: 100,
  radius: CONFIG.PLAYER_RADIUS,
  speed:  CONFIG.PLAYER_SPEED,

  knockbackX: 0,
  knockbackY: 0,
  hitStun:    0,
  hitFlash:   0,

  invincible:  false,
  invTimer:    0,
  slowTimer:   0,

  respawnX: 60,
  respawnY: 60,
  fadeIn:   0,
  pendingRespawn: false,
};

// ============================================================
// WORLD OBJECTS
// ============================================================
let walls        = [];
let collectibles = [];
let hazards      = [];
let checkpoints  = [];
let particles    = [];
let exitGate     = null;  // { x, y, radius, open, openTimer }

// ============================================================
// SCREEN MANAGEMENT
// ============================================================
function showScreen(id) {
  Audio.play('click');
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  if (id === 'screen-unlocks')     renderUnlocksScreen();
  if (id === 'screen-leaderboard') renderLeaderboard();
  if (id === 'screen-levelselect') Progress.renderLevelSelect();
}

function goBackFromUnlocks() {
  showScreen(Game.running ? 'screen-pause' : 'screen-start');
}

// ============================================================
// GAME START
// ============================================================
function startGame() {
  const input     = document.getElementById('playerNameInput');
  Game.playerName = (input && input.value.trim()) || 'Player';
  _beginRun(1);
}

function startLevelFromSelect(levelNum) {
  if (!Progress.isUnlocked(levelNum)) return;
  _beginRun(levelNum);
}

function _beginRun(levelNum) {
  Game.level       = levelNum;
  Game.score       = 0;
  Game.tokens      = 0;
  Game.totalTokens = parseInt(localStorage.getItem('acab_total_tokens') || '0');
  Game.lives       = CONFIG.STARTING_LIVES;
  loadLevel(levelNum);
  showScreen('screen-game');
  Game.running  = true;
  Game.paused   = false;
  Game.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// ============================================================
// LOAD LEVEL
// ============================================================
function loadLevel(levelNum) {
  const lvl = LEVELS[levelNum - 1];
  if (!lvl) return;

  resizeCanvas();

  walls        = [];
  collectibles = [];
  hazards      = [];
  checkpoints  = [];
  particles    = [];
  exitGate     = null;

  Game.combo              = 0;
  Game.comboTimer         = 0;
  Game.goalsMet           = false;
  Game.livesLostThisLevel = 0;
  Game.shake.timer        = 0;
  Game.levelTimer         = 0;

  // Build walls
  lvl.walls.forEach(w => walls.push({
    x: w.x * CONFIG.TILE, y: w.y * CONFIG.TILE,
    w: w.w * CONFIG.TILE, h: w.h * CONFIG.TILE,
  }));

  // Checkpoints
  (lvl.checkpoints || []).forEach(cp => {
    checkpoints.push({ x: cp.x, y: cp.y, radius: 18, activated: false });
  });

  // Exit gate (closed until goals met)
  exitGate = { x: lvl.exitGate.x, y: lvl.exitGate.y,
               radius: CONFIG.EXIT_RADIUS, open: false, openTimer: 0 };

  // Collectibles
  spawnCollectibles(lvl);

  // Hazards
  lvl.hazards.forEach(h => {
    const def = CONFIG.HAZARDS[h.type];
    hazards.push({
      type:            h.type,
      x: h.x, y: h.y,
      dx: h.dx || 0, dy: h.dy || 0,
      radius:          def.radius,
      color:           def.color,
      emoji:           def.emoji,
      ai:              def.ai,
      slows:           def.slows,
      damage:          def.damage,
      detectionRadius: def.detectionRadius || 0,
      chaseSpeed:      def.chaseSpeed      || 0,
      speedMult:       def.speedMult       || 1,
      angle:           Math.random() * Math.PI * 2,
    });
  });

  // Power-ups
  resetPowerupState();
  spawnLevelPowerups(lvl);

  // Player
  player.x = 60; player.y = 60;
  player.knockbackX = 0; player.knockbackY = 0;
  player.hitStun    = 0; player.hitFlash   = 0;
  player.invincible = false; player.invTimer = 0;
  player.slowTimer  = 0;
  player.respawnX   = 60; player.respawnY = 60;
  player.fadeIn     = 0;
  player.pendingRespawn = false;

  updateHUD();
}

function spawnCollectibles(lvl) {
  const padding = 55;
  Object.entries(lvl.ballCounts).forEach(([type, count]) => {
    for (let i = 0; i < count; i++) {
      let x, y, safe = false, attempts = 0;
      do {
        x = padding + Math.random() * (CONFIG.CANVAS_W - padding * 2);
        y = padding + Math.random() * (CONFIG.CANVAS_H - padding * 2);
        safe = !isCollidingWithWalls(x, y, 12)
             && distTo(x, y, player.x, player.y) > 80
             && distTo(x, y, exitGate.x, exitGate.y) > 50
             && hazards.every(h => distTo(x, y, h.x, h.y) > h.radius + 35);
        attempts++;
      } while (!safe && attempts < 100);

      collectibles.push({
        type, x, y,
        radius: CONFIG.COLLECTIBLES[type].radius,
        ...CONFIG.COLLECTIBLES[type],
        pulse: Math.random() * Math.PI * 2,
      });
    }
  });
}

// ============================================================
// GAME LOOP
// ============================================================
function gameLoop(timestamp) {
  if (!Game.running) return;
  if (Game.paused) { Game.animId = requestAnimationFrame(gameLoop); return; }

  const dt = Math.min((timestamp - Game.lastTime) / 1000, 0.05);
  Game.lastTime = timestamp;

  update(dt);
  render();

  Game.animId = requestAnimationFrame(gameLoop);
}

function update(dt) {
  Game.levelTimer += dt;
  updatePlayer(dt);
  updateHazards(dt);
  // Update HUD every frame so the timer ticks smoothly
  const timerEl = document.getElementById('hud-timer');
  if (timerEl) timerEl.textContent = '⏱ ' + _formatTime(Game.levelTimer);
  updateParticles(dt);
  updateShake(dt);
  updatePowerupTimers(dt);
  updateCombo(dt);
  applyMagnet(collectibles, player.x, player.y, dt);
  checkCollectibles();
  checkHazards();
  checkCheckpoints();
  checkPowerupPickups(player.x, player.y, player.radius);
  checkGoals();
  checkExitGate();
  if (exitGate && exitGate.open) exitGate.openTimer += dt;
}

// ============================================================
// PLAYER UPDATE
// ============================================================
function updatePlayer(dt) {
  player.slowTimer  = Math.max(0, player.slowTimer - dt);
  player.hitFlash   = Math.max(0, player.hitFlash  - dt * 2.5);
  player.fadeIn     = Math.max(0, player.fadeIn    - dt * 1.5);

  if (player.invincible) {
    player.invTimer -= dt;
    if (player.invTimer <= 0) { player.invincible = false; player.invTimer = 0; }
  }

  // Hit stun: apply knockback, no input
  if (player.hitStun > 0) {
    player.hitStun    -= dt;
    player.knockbackX *= 0.80;
    player.knockbackY *= 0.80;
    player.x = clamp(player.x + player.knockbackX, player.radius, CONFIG.CANVAS_W - player.radius);
    player.y = clamp(player.y + player.knockbackY, player.radius, CONFIG.CANVAS_H - player.radius);

    if (player.hitStun <= 0 && player.pendingRespawn) {
      player.pendingRespawn = false;
      player.x = player.respawnX; player.y = player.respawnY;
      player.knockbackX = 0; player.knockbackY = 0;
      player.fadeIn = 1.0;
    }
    return;
  }

  // Speed power-up multiplier
  const speedMult = PowerupState.speed > 0 ? 1.6 : 1.0;
  const speed     = player.slowTimer > 0 ? player.speed * 0.45 : player.speed * speedMult;

  let dx = 0, dy = 0;
  if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
  if (keys['ArrowUp']    || keys['w'] || keys['W']) dy -= 1;
  if (keys['ArrowDown']  || keys['s'] || keys['S']) dy += 1;

  // FUTURE_MOBILE — virtual joystick input
  if (typeof Joystick !== 'undefined' && Joystick.active) {
    dx += Joystick.dx;
    dy += Joystick.dy;
  }

  const dLen = Math.sqrt(dx * dx + dy * dy);
  if (dLen > 1) { dx /= dLen; dy /= dLen; }

  player.knockbackX *= 0.85;
  player.knockbackY *= 0.85;

  const nx = player.x + dx * speed * 60 * dt + player.knockbackX;
  const ny = player.y + dy * speed * 60 * dt + player.knockbackY;

  if (!isCollidingWithWalls(nx, player.y, player.radius)) player.x = nx;
  if (!isCollidingWithWalls(player.x, ny, player.radius)) player.y = ny;

  player.x = clamp(player.x, player.radius, CONFIG.CANVAS_W - player.radius);
  player.y = clamp(player.y, player.radius, CONFIG.CANVAS_H - player.radius);
}

// ============================================================
// HAZARD UPDATE
// ============================================================
function updateHazards(dt) {
  // Freeze power-up: stop all movement (spinners still visually rotate)
  if (PowerupState.freeze > 0) {
    hazards.forEach(h => { if (h.ai === 'spin' || h.ai === 'boss') h.angle += dt * 3.5; });
    return;
  }

  hazards.forEach(h => {
    switch (h.ai) {

      case 'static': break; // puddles etc.

      case 'spin':
        h.angle += dt * 3.5;
        break;

      case 'bounce':
      case 'roller': {
        const s = h.speedMult || 1;
        h.x += h.dx * s * 60 * dt;
        h.y += h.dy * s * 60 * dt;
        bounceHazardOffEdges(h);
        bounceHazardOffWalls(h);
        break;
      }

      case 'chase':
      case 'boss': {
        const dist = distTo(h.x, h.y, player.x, player.y);
        const R    = h.detectionRadius;

        if (dist < R && dist > 1) {
          // Chase player
          const angle = Math.atan2(player.y - h.y, player.x - h.x);
          h.x += Math.cos(angle) * h.chaseSpeed * 60 * dt;
          h.y += Math.sin(angle) * h.chaseSpeed * 60 * dt;
          h.angle = angle; // face player
        } else if (h.dx !== 0 || h.dy !== 0) {
          // Fall back to patrol
          h.x += h.dx * 60 * dt;
          h.y += h.dy * 60 * dt;
          bounceHazardOffEdges(h);
        }
        h.x = clamp(h.x, h.radius, CONFIG.CANVAS_W - h.radius);
        h.y = clamp(h.y, h.radius, CONFIG.CANVAS_H - h.radius);
        break;
      }
    }
  });
}

function bounceHazardOffEdges(h) {
  const minX = h.radius, maxX = CONFIG.CANVAS_W - h.radius;
  const minY = h.radius, maxY = CONFIG.CANVAS_H - h.radius;
  if (h.x < minX || h.x > maxX) { h.dx *= -1; h.x = clamp(h.x, minX, maxX); }
  if (h.y < minY || h.y > maxY) { h.dy *= -1; h.y = clamp(h.y, minY, maxY); }
}

function bounceHazardOffWalls(h) {
  walls.forEach(w => {
    if (circleRect(h.x, h.y, h.radius, w)) {
      const overlapX = h.x < w.x + w.w / 2
        ? (h.x + h.radius - w.x) : (w.x + w.w - h.x + h.radius);
      const overlapY = h.y < w.y + w.h / 2
        ? (h.y + h.radius - w.y) : (w.y + w.h - h.y + h.radius);
      if (overlapX < overlapY) h.dx *= -1; else h.dy *= -1;
    }
  });
}

// ============================================================
// COMBO
// ============================================================
function updateCombo(dt) {
  if (Game.comboTimer > 0) {
    Game.comboTimer -= dt;
    if (Game.comboTimer <= 0 && Game.combo > 0) {
      Game.combo = 0;
      updateHUD();
    }
  }
}

function getComboMultiplier() {
  for (const tier of CONFIG.COMBO_TIERS) {
    if (Game.combo >= tier.min) return tier.mult;
  }
  return 1.0;
}

function incrementCombo() {
  Game.combo++;
  Game.comboTimer = CONFIG.COMBO_WINDOW;
  // Milestone audio & popup
  if (Game.combo === 3) { Audio.play('combo'); showComboAnnounce('🔥 3 COMBO!'); }
  if (Game.combo === 5) { Audio.play('combo'); showComboAnnounce('🔥🔥 5 COMBO!'); }
  if (Game.combo === 8) { Audio.play('combo'); showComboAnnounce('💥 8 COMBO! ×3!'); }
  updateHUD();
}

function resetCombo() {
  Game.combo      = 0;
  Game.comboTimer = 0;
  updateHUD();
}

function showComboAnnounce(text) {
  const el = document.createElement('div');
  el.className   = 'combo-announce';
  el.textContent = text;
  document.getElementById('score-popup-container').appendChild(el);
  setTimeout(() => el.remove(), 1300);
}

// ============================================================
// COLLECTIBLES
// ============================================================
function checkCollectibles() {
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    if (distTo(player.x, player.y, c.x, c.y) < player.radius + c.radius) {
      incrementCombo();

      const basePts = CONFIG.POINTS[c.type];
      const mult    = getComboMultiplier();
      const pts     = Math.round(basePts * mult * (PowerupState.double > 0 ? 2 : 1));

      Game.score += pts;

      if (c.type === 'smile') {
        Game.tokens++;
        Game.totalTokens++;
        localStorage.setItem('acab_total_tokens', Game.totalTokens);
        Audio.play('smile');
      } else {
        Audio.play('collect');
      }

      spawnPickupParticles(c.x, c.y, c.color);
      haptic(20);  // short buzz on collect

      const multLabel = mult > 1 ? ` ×${mult.toFixed(1)}` : '';
      const dblLabel  = PowerupState.double > 0 ? ' 💎' : '';
      showScorePopup(c.x, c.y, `+${pts}${multLabel}${dblLabel} ${c.emoji}`);

      collectibles.splice(i, 1);
      updateHUD();
    }
  }
}

// ============================================================
// HAZARDS — COLLISION
// ============================================================
function checkHazards() {
  if (player.invincible || player.hitStun > 0) return;

  for (const h of hazards) {
    const dist = distTo(player.x, player.y, h.x, h.y);

    if (h.slows && dist < player.radius + h.radius) {
      player.slowTimer = 1.5;
      continue;
    }

    if (h.damage && dist < player.radius + h.radius) {
      // Shield absorbs hit
      if (tryShieldAbsorb()) {
        player.invincible = true;
        player.invTimer   = CONFIG.INVINCIBILITY_DURATION;
        Game.shake.timer     = 0.2;
        Game.shake.intensity = 4;
        Audio.play('hit');
        showScorePopup(player.x, player.y - 24, '🛡️ Shield blocked!');
        // Burst of teal shield particles
        spawnPickupParticles(player.x, player.y, '#4ECDC4');
        spawnPickupParticles(player.x, player.y, '#FFFFFF');
        return;
      }
      playerHit(h);
      return;
    }
  }
}

// ============================================================
// PLAYER HIT
// ============================================================
function playerHit(hazard) {
  Audio.play('hit');
  resetCombo();

  // Knockback away from hazard
  const angle = Math.atan2(player.y - hazard.y, player.x - hazard.x);
  player.knockbackX = Math.cos(angle) * CONFIG.KNOCKBACK_FORCE;
  player.knockbackY = Math.sin(angle) * CONFIG.KNOCKBACK_FORCE;

  player.hitFlash       = 1.0;
  player.hitStun        = CONFIG.RESPAWN_DELAY;
  player.pendingRespawn = true;
  player.invincible     = true;
  player.invTimer       = CONFIG.INVINCIBILITY_DURATION;

  Game.shake.timer     = 0.4;
  Game.shake.intensity = 9;
  haptic([80, 40, 80]);  // double-buzz on hit

  Game.lives--;
  Game.livesLostThisLevel++;
  updateHUD();

  showScorePopup(player.x, player.y - 24, '💔 -1 Life');

  if (Game.lives <= 0) {
    setTimeout(() => gameOver(), 450);
  }
}

// ============================================================
// CHECKPOINTS
// ============================================================
function checkCheckpoints() {
  if (!CONFIG.CHECKPOINT_ENABLED) return;
  checkpoints.forEach(cp => {
    if (cp.activated) return;
    if (distTo(player.x, player.y, cp.x, cp.y) < player.radius + cp.radius) {
      cp.activated    = true;
      player.respawnX = cp.x;
      player.respawnY = cp.y;
      Audio.play('checkpoint');
      spawnPickupParticles(cp.x, cp.y, '#FFD700');
      showScorePopup(cp.x, cp.y - 10, '⭐ Checkpoint!');
    }
  });
}

// ============================================================
// GOALS & EXIT GATE
// ============================================================
function checkGoals() {
  if (Game.goalsMet) return;
  const lvl      = LEVELS[Game.level - 1];
  const scoreOk  = Game.score    >= lvl.targetScore;
  const smileOk  = !lvl.targetSmiles || Game.tokens >= lvl.targetSmiles;
  const ballsOk  = collectibles.length === 0;

  if (scoreOk && smileOk && ballsOk) {
    Game.goalsMet    = true;
    exitGate.open    = true;
    exitGate.openTimer = 0;
    Audio.play('gate');
    spawnPickupParticles(exitGate.x, exitGate.y, '#00FF88');
    showScorePopup(exitGate.x, exitGate.y - 40, '🚪 Exit Open!');
  }
}

function checkExitGate() {
  if (!exitGate || !exitGate.open) return;
  if (distTo(player.x, player.y, exitGate.x, exitGate.y) < player.radius + exitGate.radius) {
    levelComplete();
  }
}

// ============================================================
// LEVEL COMPLETE
// ============================================================
let levelCompleteTriggered = false;

function levelComplete() {
  if (levelCompleteTriggered) return;
  levelCompleteTriggered = true;
  Game.paused = true;
  Audio.play('level');

  // Speed bonus: par time scales with level; bonus up to level×500 pts
  const parTime   = 30 + Game.level * 15;  // level 1 = 45s … level 10 = 180s
  const timePct   = Math.max(0, 1 - Game.levelTimer / parTime);
  const timeBonus = Math.round(Game.level * 500 * timePct);
  if (timeBonus > 0) {
    Game.score += timeBonus;
    addToTotalScore(timeBonus);
  }

  // Stars
  const stars = calculateStars();
  Progress.setStars(Game.level, stars);
  Progress.setBestScore(Game.level, Game.score);
  addToTotalScore(Game.score);

  // Unlock next level
  if (Game.level < 10) Progress.unlockLevel(Game.level + 1);

  // Skin unlocks
  const isComplete   = Game.level === 10;
  const newUnlocks   = checkAndUnlock(Game.level, Game.totalTokens, isComplete);
  const unlockMsg    = newUnlocks.length
    ? `🎁 Unlocked: ${newUnlocks.map(u => u.name + ' ' + u.emoji).join(', ')}!`
    : '';

  document.getElementById('lc-score').textContent      = Game.score;
  document.getElementById('lc-tokens').textContent     = Game.tokens;
  document.getElementById('lc-time').textContent       = _formatTime(Game.levelTimer);
  document.getElementById('lc-time-bonus').textContent = timeBonus > 0 ? `+${timeBonus} pts` : 'No bonus';
  document.getElementById('lc-unlock-msg').textContent = unlockMsg;

  // Animate stars
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`lc-star-${i}`);
    if (!el) continue;
    el.textContent = '☆';
    if (i <= stars) {
      setTimeout(() => { el.textContent = '⭐'; el.classList.add('star-pop'); }, i * 280);
    }
  }

  const nextBtn = document.getElementById('nextLevelBtn');
  if (Game.level >= 10) {
    nextBtn.textContent = 'Finish Game 🏆';
    nextBtn.onclick     = gameComplete;
  } else {
    nextBtn.textContent = 'Next Level →';
    nextBtn.onclick     = nextLevel;
  }

  spawnConfetti('confettiContainer');
  showScreen('screen-level-complete');
}

function calculateStars() {
  const lvl = LEVELS[Game.level - 1];
  let stars = 1; // always 1 for completion
  if (lvl.targetSmiles && Game.tokens >= lvl.targetSmiles) stars++;
  if (Game.livesLostThisLevel === 0) stars++;
  return Math.min(stars, 3);
}

function nextLevel() {
  if (Game.level >= 10) { gameComplete(); return; }
  levelCompleteTriggered = false;
  Game.level++;
  loadLevel(Game.level);
  Game.paused   = false;
  showScreen('screen-game');
  Game.lastTime = performance.now();
}

function gameOver() {
  Game.running = false;
  cancelAnimationFrame(Game.animId);
  Audio.play('gameover');

  document.getElementById('go-score').textContent  = Game.score;
  document.getElementById('go-level').textContent  = Game.level;
  document.getElementById('go-tokens').textContent = Game.tokens;
  showScreen('screen-gameover');
}

function gameComplete() {
  Game.running = false;
  cancelAnimationFrame(Game.animId);

  document.getElementById('complete-score').textContent  = Game.score;
  document.getElementById('complete-tokens').textContent = Game.totalTokens;
  document.getElementById('complete-stars').textContent  = Progress.getTotalStars();
  checkAndUnlock(10, Game.totalTokens, true);
  spawnConfetti('confettiContainer2');
  showScreen('screen-complete');
}

function restartLevel() {
  levelCompleteTriggered = false;
  Game.lives   = CONFIG.STARTING_LIVES;
  loadLevel(Game.level);
  Game.paused  = false;
  Game.running = true;
  showScreen('screen-game');
  Game.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function pauseGame() {
  Game.paused = true;
  showScreen('screen-pause');
}

function resumeGame() {
  Game.paused   = false;
  Game.lastTime = performance.now();
  showScreen('screen-game');
}

function quitToMenu() {
  Game.running = false;
  Game.paused  = false;
  levelCompleteTriggered = false;
  cancelAnimationFrame(Game.animId);
  showScreen('screen-start');
}

// ============================================================
// SCORE SAVING
// ============================================================
function saveScoreAndLeaderboard() {
  const inp = document.getElementById('saveNameInput');
  if (inp) inp.value = Game.playerName;
  showScreen('screen-savescore');
}

function confirmSaveScore() {
  const name = document.getElementById('saveNameInput').value.trim() || Game.playerName;
  saveScore(name, Game.score, Game.level, Game.totalTokens);
  showScreen('screen-leaderboard');
}

// ============================================================
// SCREEN SHAKE
// ============================================================
function updateShake(dt) {
  Game.shake.timer = Math.max(0, Game.shake.timer - dt);
}

// ============================================================
// RENDER
// ============================================================
function render() {
  const lvl = LEVELS[Game.level - 1];
  const now  = performance.now() / 1000;

  ctx.save();
  // Apply screen shake
  if (Game.shake.timer > 0) {
    const t = Game.shake.timer / 0.4;
    const i = Game.shake.intensity * t;
    ctx.translate((Math.random() - 0.5) * i, (Math.random() - 0.5) * i);
  }

  // Background — drawn inside drawCourtLines (hardwood + paint)
  drawCourtLines(lvl.bg);

  // Walls
  walls.forEach(w => {
    ctx.fillStyle   = '#1a1a2e';
    ctx.strokeStyle = '#2d2d50';
    roundRect(ctx, w.x, w.y, w.w, w.h, 4);
    ctx.fill(); ctx.stroke();
  });

  // Exit gate
  drawExitGate(now);

  // Checkpoints
  drawCheckpoints(now);

  // Collectibles
  collectibles.forEach(c => {
    const pulse = 1 + 0.1 * Math.sin(now * 3 + c.pulse);
    ctx.save();
    ctx.translate(c.x, c.y); ctx.scale(pulse, pulse);
    ctx.font = `${c.radius * 2}px serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = c.color; ctx.shadowBlur = 10;
    ctx.fillText(c.emoji, 0, 0);
    ctx.restore();
  });

  // World power-ups
  drawWorldPowerups(ctx, now);

  // Hazards
  hazards.forEach(h => {
    ctx.save();
    ctx.translate(h.x, h.y);
    const isChasing = (h.ai === 'chase' || h.ai === 'boss') &&
      distTo(h.x, h.y, player.x, player.y) < h.detectionRadius;

    if (h.ai === 'spin' || h.ai === 'boss') {
      drawSpinner(ctx, h, now);
    } else {
      if (h.ai !== 'static') ctx.rotate(now * (h.ai === 'roller' ? 4 : 2));
      ctx.font          = `${h.radius * 2}px serif`;
      ctx.textAlign     = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor   = isChasing ? '#FF0000' : h.color;
      ctx.shadowBlur    = isChasing ? 22 : 8;
      ctx.fillText(h.emoji, 0, 0);
    }
    ctx.restore();
  });

  // Particles
  renderParticles();

  // Magnet ring
  drawMagnetRing(ctx, player.x, player.y);

  // Shield ring (draw before player so player is on top)
  drawShieldEffect(ctx, player.x, player.y, now);

  // Player
  drawPlayer(now);

  // Freeze overlay
  if (PowerupState.freeze > 0) {
    ctx.fillStyle = 'rgba(100, 180, 255, 0.09)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }

  // Hit flash vignette
  if (player.hitFlash > 0) {
    const grad = ctx.createRadialGradient(
      CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2, 60,
      CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2, CONFIG.CANVAS_W * 0.75
    );
    grad.addColorStop(0, `rgba(255,30,30,0)`);
    grad.addColorStop(1, `rgba(255,30,30,${player.hitFlash * 0.4})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
  }

  ctx.restore();
}

// ---- Exit Gate ----
function drawExitGate(now) {
  if (!exitGate) return;
  ctx.save();
  ctx.translate(exitGate.x, exitGate.y);

  if (exitGate.open) {
    const t     = exitGate.openTimer;
    const pulse = 1 + 0.2 * Math.sin(now * 5);
    // Outer glow
    ctx.beginPath();
    ctx.arc(0, 0, exitGate.radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(0,255,136,0.18)';
    ctx.strokeStyle = '#00FF88';
    ctx.lineWidth   = 3;
    ctx.shadowColor = '#00FF88';
    ctx.shadowBlur  = 28;
    ctx.fill(); ctx.stroke();
    // Rotating ring
    ctx.rotate(now * 1.5);
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 / 6) * i;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (exitGate.radius - 4), Math.sin(a) * (exitGate.radius - 4), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#00FF88';
      ctx.fill();
    }
    ctx.rotate(-now * 1.5);
    // Icon
    ctx.font = '22px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText('🪣', 0, 0);
  } else {
    // Closed: dim
    ctx.beginPath();
    ctx.arc(0, 0, exitGate.radius, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(80,80,80,0.3)';
    ctx.strokeStyle = 'rgba(150,150,150,0.5)';
    ctx.lineWidth   = 2;
    ctx.fill(); ctx.stroke();
    ctx.font = '18px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(200,200,200,0.6)';
    ctx.fillText('🪣', 0, 0);
  }
  ctx.restore();
}

// ---- Spinner ----
function drawSpinner(ctx, h, now) {
  const armLen   = h.radius;
  const armCount = h.type === 'boss' ? 6 : 4;
  const pulse    = 1 + 0.12 * Math.sin(now * 6);

  ctx.beginPath();
  ctx.arc(0, 0, h.radius * pulse, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${h.type === 'boss' ? '255,0,0' : '255,153,0'},0.4)`;
  ctx.lineWidth   = h.type === 'boss' ? 4 : 3;
  ctx.shadowColor = h.color;
  ctx.shadowBlur  = h.type === 'boss' ? 24 : 14;
  ctx.stroke();

  ctx.strokeStyle = h.color;
  ctx.lineWidth   = h.type === 'boss' ? 5 : 4;
  ctx.lineCap     = 'round';
  for (let i = 0; i < armCount; i++) {
    const a = h.angle + (Math.PI * 2 / armCount) * i;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * armLen, Math.sin(a) * armLen);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(0, 0, h.type === 'boss' ? 7 : 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

// ---- Checkpoints ----
function drawCheckpoints(now) {
  checkpoints.forEach(cp => {
    ctx.save();
    ctx.translate(cp.x, cp.y);
    const activated = cp.activated;
    const pulse     = activated ? 1.0 : 1 + 0.18 * Math.sin(now * 4);
    const color     = activated ? '#00FF88' : '#FFD700';

    ctx.beginPath();
    ctx.arc(0, 0, cp.radius * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = color; ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, cp.radius * pulse, 0, Math.PI * 2);
    ctx.fillStyle = activated ? 'rgba(0,255,136,0.12)' : 'rgba(255,215,0,0.1)';
    ctx.fill();

    ctx.font = '16px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillText(activated ? '✅' : '⭐', 0, 0);
    ctx.restore();
  });
}

// ---- Player ----
function drawPlayer(now) {
  const skin = getEquippedSkin();
  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.hitStun > 0) {
    ctx.globalAlpha = 1.0;
  } else if (player.invincible && Math.floor(now * 8) % 2 === 0) {
    ctx.globalAlpha = 0.3;
  } else if (player.fadeIn > 0) {
    ctx.globalAlpha = 1 - player.fadeIn * 0.85;
  }

  // Speed boost: blue trail tint
  if (PowerupState.speed > 0) {
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 24;
  } else if (player.slowTimer > 0) {
    ctx.shadowColor = '#4499FF'; ctx.shadowBlur = 16;
  } else {
    ctx.shadowColor = skin.color; ctx.shadowBlur = 18;
  }

  ctx.font = `${player.radius * 2.2}px serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(skin.emoji, 0, 0);

  // Direction dot
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(0, -player.radius * 0.5, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---- Court lines ----
function drawCourtLines(paintColor) {
  const W  = CONFIG.CANVAS_W;   // 800
  const H  = CONFIG.CANVAS_H;   // 560
  const cx = W / 2;             // 400
  const cy = H / 2;             // 280

  ctx.save();

  // ── Hardwood floor ──────────────────────────────────────────
  // Dark base, then lighter planks
  ctx.fillStyle = '#A0611A';
  ctx.fillRect(0, 0, W, H);
  // Light plank strips alternating
  for (let y = 0; y < H; y += 18) {
    ctx.fillStyle = (Math.floor(y / 18) % 2 === 0) ? 'rgba(255,200,100,0.22)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(0, y, W, 18);
  }
  // Subtle grain lines
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 0.8;
  for (let y = 18; y < H; y += 18) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // ── Paint areas (key / lane) ─────────────────────────────────
  // Use the level's accent colour so each court feels unique
  ctx.fillStyle = paintColor ? paintColor + '88' : 'rgba(180,60,30,0.50)';
  ctx.fillRect(40,  215, 150, 130);   // left key
  ctx.fillRect(610, 215, 150, 130);   // right key

  // ── Court markings ───────────────────────────────────────────
  const LINE = 'rgba(255,255,255,0.85)';
  ctx.strokeStyle = LINE;
  ctx.fillStyle   = LINE;
  ctx.lineWidth   = 2.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  // Outer boundary (play area inside wall tiles)
  ctx.strokeRect(40, 40, 720, 480);

  // Half-court line
  ctx.beginPath(); ctx.moveTo(cx, 40); ctx.lineTo(cx, H - 40); ctx.stroke();

  // Centre circle + jump-ball dot
  ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 5,  0, Math.PI * 2); ctx.fill();

  // ── Helper: draw one basket end ─────────────────────────────
  // dir = +1 for left basket, -1 for right basket
  function _end(rimX, baseX, dir) {
    const kH  = 65;   // half key width
    const kD  = 150;  // key depth (baseline → free-throw line)
    const ftX = baseX + dir * kD;
    const ftR = 54;
    const tpR = 200;  // three-point radius

    // Key rectangle
    ctx.strokeRect(
      dir > 0 ? baseX : ftX,
      cy - kH,
      kD,
      kH * 2
    );

    // Free-throw circle — solid half toward court
    ctx.beginPath();
    ctx.arc(ftX, cy, ftR,
      dir > 0 ? -Math.PI/2 : Math.PI/2,
      dir > 0 ?  Math.PI/2 : -Math.PI/2,
      false);
    ctx.stroke();
    // Dashed half inside key
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(ftX, cy, ftR,
      dir > 0 ?  Math.PI/2 : -Math.PI/2,
      dir > 0 ? -Math.PI/2 :  Math.PI/2,
      false);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Three-point arc — meets baseline at ≈ y = cy ± 192
    // Angles pre-calculated: at baseline dx=55 from rim, dy=192
    const tpAng = 1.848;   // atan2(192, -55) for left  / clockwise through 0
    const tpAng2 = 1.294;  // atan2(192,  55) for right / clockwise through π
    ctx.beginPath();
    if (dir > 0) {
      ctx.arc(rimX, cy, tpR, -tpAng,  tpAng,  false);
    } else {
      ctx.arc(rimX, cy, tpR,  tpAng2, -tpAng2, false);
    }
    ctx.stroke();

    // Backboard (thick short line)
    ctx.lineWidth = 5;
    const bbX = dir > 0 ? baseX + 14 : baseX - 14;
    ctx.beginPath(); ctx.moveTo(bbX, cy - 22); ctx.lineTo(bbX, cy + 22); ctx.stroke();
    ctx.lineWidth = 2.5;

    // Rim circle
    ctx.beginPath(); ctx.arc(rimX, cy, 13, 0, Math.PI * 2); ctx.stroke();

    // Restricted-area arc (no-charge zone)
    ctx.beginPath();
    ctx.arc(rimX, cy, 28,
      dir > 0 ? -Math.PI/2 :  Math.PI/2,
      dir > 0 ?  Math.PI/2 : -Math.PI/2,
      false);
    ctx.stroke();

    // Lane hash marks (stubs perpendicular to key edges)
    const hPos = dir > 0
      ? [baseX+35, baseX+65, baseX+100, baseX+130]
      : [baseX-35, baseX-65, baseX-100, baseX-130];
    hPos.forEach(x => {
      ctx.beginPath(); ctx.moveTo(x, cy - kH);     ctx.lineTo(x, cy - kH - 11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, cy + kH);     ctx.lineTo(x, cy + kH + 11); ctx.stroke();
    });
  }

  _end(/*rimX*/95,  /*baseX*/40,  +1);  // left basket  (rim 55px from baseline)
  _end(/*rimX*/705, /*baseX*/760, -1);  // right basket

  ctx.restore();
}

// ============================================================
// PARTICLES
// ============================================================
function spawnPickupParticles(x, y, color) {
  const count = (typeof MOBILE_CONFIG !== 'undefined' && MOBILE_CONFIG.isMobile) ? 4 : 8;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i;
    particles.push({
      x, y,
      vx: Math.cos(angle) * (2 + Math.random() * 2),
      vy: Math.sin(angle) * (2 + Math.random() * 2),
      color,
      life: 0.6, maxLife: 0.6,
      radius: 4 + Math.random() * 3,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function renderParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ============================================================
// SCORE POPUPS (DOM)
// ============================================================
function showScorePopup(x, y, text) {
  const el       = document.createElement('div');
  el.className   = 'score-popup';
  el.textContent = text;
  if (text.includes('💔')) el.classList.add('score-popup-dmg');

  const rect   = canvas.getBoundingClientRect();
  const scaleX = rect.width  / CONFIG.CANVAS_W;
  const scaleY = rect.height / CONFIG.CANVAS_H;

  el.style.left = (rect.left + x * scaleX) + 'px';
  el.style.top  = (rect.top  + y * scaleY) + 'px';

  document.getElementById('score-popup-container').appendChild(el);
  setTimeout(() => el.remove(), 950);
}

// ============================================================
// CONFETTI
// ============================================================
function spawnConfetti(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = '';
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8'];
  for (let i = 0; i < 44; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 0.5}s;
      animation-duration: ${0.8 + Math.random() * 0.7}s;
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    c.appendChild(el);
  }
}

// ============================================================
// HUD
// ============================================================
function updateHUD() {
  const lvl = LEVELS[Game.level - 1];

  document.getElementById('hud-level-val').textContent  = Game.level;
  document.getElementById('hud-level-name').textContent = lvl.name;
  document.getElementById('hud-score-val').textContent  = Game.score;
  document.getElementById('hud-tokens-val').textContent = Game.tokens;

  // Lives as hearts
  const h = '❤️'.repeat(Math.max(0, Game.lives)) +
            '🖤'.repeat(Math.max(0, CONFIG.STARTING_LIVES - Game.lives));
  document.getElementById('hud-lives-val').textContent = h;

  // Goal progress bar
  const pct  = Math.min(100, Math.round((Game.score / lvl.targetScore) * 100));
  const fill = document.getElementById('hud-goal-fill');
  if (fill) fill.style.width = pct + '%';
  document.getElementById('hud-goal-text').textContent = `${Game.score}/${lvl.targetScore}`;

  // Combo badge
  const badge = document.getElementById('hud-combo-badge');
  if (badge) {
    if (Game.combo >= 2) {
      badge.style.display = 'flex';
      badge.querySelector('#hud-combo-count').textContent = Game.combo;
      badge.querySelector('#hud-combo-mult').textContent  = `×${getComboMultiplier().toFixed(1)}`;
    } else {
      badge.style.display = 'none';
    }
  }

  // Timer
  const timerEl = document.getElementById('hud-timer');
  if (timerEl) timerEl.textContent = '⏱ ' + _formatTime(Game.levelTimer);

  // Ball skin
  const skin = getEquippedSkin();
  document.getElementById('hud-ball-val').textContent = skin.name;
}

function _formatTime(s) {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ============================================================
// CANVAS
// ============================================================
function resizeCanvas() {
  canvas.width  = CONFIG.CANVAS_W;
  canvas.height = CONFIG.CANVAS_H;
}

window.addEventListener('resize', () => { if (Game.running) resizeCanvas(); });

// ============================================================
// HELPERS
// ============================================================
function distTo(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function circleRect(cx, cy, cr, r) {
  return distTo(cx, cy, clamp(cx, r.x, r.x + r.w), clamp(cy, r.y, r.y + r.h)) < cr;
}

function isCollidingWithWalls(x, y, r) {
  return walls.some(w => circleRect(x, y, r, w));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);     ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);     ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);         ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}

// ============================================================
// MOBILE CONTROLS (FUTURE_MOBILE)
// ============================================================
// To add mobile: create a virtual joystick that writes to:
//   keys['ArrowLeft'], keys['ArrowRight'], keys['ArrowUp'], keys['ArrowDown']
// or directly sets player.knockbackX / player.knockbackY from joystick delta.

// ============================================================
// INIT
// ============================================================
resizeCanvas();
showScreen('screen-start');
