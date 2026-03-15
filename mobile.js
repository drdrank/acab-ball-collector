// ============================================================
// MOBILE.JS — Touch controls, virtual joystick, device utils
// ============================================================

const MOBILE_CONFIG = (() => {
  const touch   = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const mobile  = touch && Math.min(screen.width, screen.height) < 768;
  return { isTouch: touch, isMobile: mobile };
})();

// Expose flags on body for CSS hooks
if (MOBILE_CONFIG.isTouch)  document.body.classList.add('is-touch');
if (MOBILE_CONFIG.isMobile) document.body.classList.add('is-mobile');

// ============================================================
// JOYSTICK STATE
// ============================================================
const Joystick = {
  active:   false,
  touchId:  null,
  baseX:    0, baseY:    0,   // where finger first landed
  knobX:    0, knobY:    0,   // current knob position
  dx:       0, dy:       0,   // normalised direction [-1..1]
  MAX_RADIUS: 52,
};

// ============================================================
// HAPTICS
// ============================================================
function haptic(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ============================================================
// INIT — call once after DOM ready
// ============================================================
function initMobileControls() {
  if (!MOBILE_CONFIG.isTouch) return;

  const zone = document.getElementById('joystick-zone');
  if (!zone) return;

  zone.addEventListener('touchstart',  _onTouchStart, { passive: false });
  zone.addEventListener('touchmove',   _onTouchMove,  { passive: false });
  zone.addEventListener('touchend',    _onTouchEnd,   { passive: false });
  zone.addEventListener('touchcancel', _onTouchEnd,   { passive: false });
}

function _onTouchStart(e) {
  e.preventDefault();
  // Only grab the first free finger for the joystick
  if (Joystick.active) return;

  const t = e.changedTouches[0];
  Joystick.active  = true;
  Joystick.touchId = t.identifier;
  Joystick.baseX   = t.clientX;
  Joystick.baseY   = t.clientY;
  Joystick.knobX   = t.clientX;
  Joystick.knobY   = t.clientY;
  Joystick.dx      = 0;
  Joystick.dy      = 0;

  _showJoystick(t.clientX, t.clientY);
}

function _onTouchMove(e) {
  e.preventDefault();
  if (!Joystick.active) return;

  // Find the right touch
  let t = null;
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === Joystick.touchId) {
      t = e.changedTouches[i]; break;
    }
  }
  if (!t) return;

  const rawDx = t.clientX - Joystick.baseX;
  const rawDy = t.clientY - Joystick.baseY;
  const dist  = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  const clamped = Math.min(dist, Joystick.MAX_RADIUS);

  if (dist > 0) {
    Joystick.dx = (rawDx / dist) * (clamped / Joystick.MAX_RADIUS);
    Joystick.dy = (rawDy / dist) * (clamped / Joystick.MAX_RADIUS);
  } else {
    Joystick.dx = 0; Joystick.dy = 0;
  }

  // Move knob visually (clamped)
  const angle  = Math.atan2(rawDy, rawDx);
  Joystick.knobX = Joystick.baseX + Math.cos(angle) * clamped;
  Joystick.knobY = Joystick.baseY + Math.sin(angle) * clamped;
  _updateJoystickDOM();
}

function _onTouchEnd(e) {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === Joystick.touchId) {
      Joystick.active  = false;
      Joystick.touchId = null;
      Joystick.dx      = 0;
      Joystick.dy      = 0;
      _hideJoystick();
      return;
    }
  }
}

function _showJoystick(cx, cy) {
  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  if (!base || !knob) return;

  base.style.left    = (cx - 56) + 'px';
  base.style.top     = (cy - 56) + 'px';
  base.style.opacity = '1';
  knob.style.left    = '50%';
  knob.style.top     = '50%';
  knob.style.transform = 'translate(-50%, -50%)';
}

function _updateJoystickDOM() {
  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');
  if (!base || !knob) return;

  const offsetX = Joystick.knobX - Joystick.baseX;
  const offsetY = Joystick.knobY - Joystick.baseY;
  knob.style.left      = (56 + offsetX) + 'px';
  knob.style.top       = (56 + offsetY) + 'px';
  knob.style.transform = 'translate(-50%, -50%)';
}

function _hideJoystick() {
  const base = document.getElementById('joystick-base');
  if (base) base.style.opacity = '0';
}

// ============================================================
// PREVENT UNWANTED BROWSER BEHAVIOURS ON TOUCH
// ============================================================
function initTouchPrevention() {
  // Prevent pinch-zoom and double-tap zoom on the game canvas
  const canvas = document.getElementById('gameCanvas');
  if (canvas) {
    canvas.addEventListener('touchstart',  e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove',   e => e.preventDefault(), { passive: false });
  }

  // Prevent context menu on long press
  document.addEventListener('contextmenu', e => e.preventDefault());
}

// ============================================================
// PAUSE ON VISIBILITY CHANGE (tab switch / phone lock)
// ============================================================
function initVisibilityPause() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && typeof Game !== 'undefined' && Game.running && !Game.paused) {
      pauseGame();
    }
  });
}

// ============================================================
// ROTATE PROMPT
// ============================================================
function initRotatePrompt() {
  const prompt = document.getElementById('rotate-prompt');
  if (!prompt) return;

  function check() {
    // Show prompt only on small phones in portrait mode
    const isPortrait = window.innerHeight > window.innerWidth;
    const isSmall    = Math.min(window.innerWidth, window.innerHeight) < 500;
    prompt.style.display = (MOBILE_CONFIG.isMobile && isPortrait && isSmall) ? 'flex' : 'none';
  }

  window.addEventListener('resize', check);
  check();
}

// ============================================================
// BOOTSTRAP — runs after all scripts are loaded
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  initMobileControls();
  initTouchPrevention();
  initVisibilityPause();
  initRotatePrompt();
});
