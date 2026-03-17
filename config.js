// ============================================================
// CONFIG.JS — All tunable constants, hazard types, level data
// ============================================================

const CONFIG = {
  CANVAS_W: 800,
  CANVAS_H: 560,
  TILE:     40,

  PLAYER_SPEED:  3.2,
  PLAYER_RADIUS: 14,

  // ---- Lives / damage (edit to rebalance) ----
  STARTING_LIVES:         3,
  INVINCIBILITY_DURATION: 2.0,   // seconds of invincibility after a hit
  RESPAWN_DELAY:          0.3,   // seconds of hit-stun before teleporting
  KNOCKBACK_FORCE:        7,     // knockback strength

  // ---- Combo system ----
  COMBO_WINDOW: 2.2,   // seconds before combo resets on no pickup
  // Multiplier thresholds: [minCombo, multiplier]
  COMBO_TIERS: [
    { min: 8, mult: 3.0 },
    { min: 5, mult: 2.0 },
    { min: 3, mult: 1.5 },
    { min: 1, mult: 1.0 },
  ],

  // ---- Checkpoint ----
  CHECKPOINT_ENABLED: true,

  // ---- Exit gate ----
  EXIT_RADIUS: 26,   // collision radius of the gate

  // ---- Points ----
  POINTS: {
    basketball: 30,
    tennis:     15,
    baseball:   20,
    soccer:     12,
    volleyball: 18,
    football:   22,
    bowling:    28,
    smile:       5,
  },

  // ---- Collectibles ----
  COLLECTIBLES: {
    basketball: { emoji: '🏀', radius: 12, color: '#E87722', points: 30 },
    tennis:     { emoji: '🎾', radius: 10, color: '#CCDD00', points: 15 },
    baseball:   { emoji: '⚾', radius: 10, color: '#FFFFFF', points: 20 },
    soccer:     { emoji: '⚽', radius: 11, color: '#222222', points: 12 },
    volleyball: { emoji: '🏐', radius: 11, color: '#3399FF', points: 18 },
    football:   { emoji: '🏈', radius: 11, color: '#8B4513', points: 22 },
    bowling:    { emoji: '🎳', radius: 12, color: '#000066', points: 28 },
    smile:      { emoji: '😊', radius: 11, color: '#FFD700', points: 5  },
  },

  // ---- Hazard types ----
  // ai: 'bounce' | 'static' | 'spin' | 'chase' | 'boss'
  // slows:  apply slow on contact (no damage)
  // damage: remove 1 life on contact
  HAZARDS: {
    cone:    { emoji: '🚧', radius: 13, color: '#FF6600', ai: 'bounce', slows: false, damage: true  },
    puddle:  { emoji: '💧', radius: 16, color: '#4499FF', ai: 'static', slows: true,  damage: false },
    enemy:   { emoji: '👾', radius: 13, color: '#FF3366', ai: 'bounce', slows: false, damage: true  },
    spinner: { emoji: '⚙️', radius: 20, color: '#FF9900', ai: 'spin',   slows: false, damage: true  },
    chaser:  { emoji: '👿', radius: 14, color: '#CC0033', ai: 'chase',  slows: false, damage: true,
               detectionRadius: 190, chaseSpeed: 1.7 },
    roller:  { emoji: '🪨', radius: 15, color: '#888888', ai: 'bounce', slows: false, damage: true,
               speedMult: 1.8 },
    boss:    { emoji: '🌀', radius: 30, color: '#FF0000', ai: 'boss',   slows: false, damage: true,
               detectionRadius: 320, chaseSpeed: 2.0 },
  },
};

// ============================================================
// LEVELS
// ============================================================
// Per-level fields:
//   targetScore  — score needed to open exit gate
//   targetSmiles — smile tokens needed for 2-star rating
//   ballCounts   — how many of each collectible to spawn
//   hazards      — array of { type, x, y, dx, dy }
//   checkpoints  — array of { x, y }
//   exitGate     — { x, y } pixel position
//   walls        — array of { x, y, w, h } in TILE units
//   bg           — court background color
//   theme        — flavor text

const LEVELS = [

  // ══════════════════════════════════════════════
  // 1 — Neighbourhood Court
  // ══════════════════════════════════════════════
  {
    id: 1, name: 'Neighbourhood Court', theme: 'Classic open court — learn the basics',
    targetScore: 100, targetSmiles: 2,
    ballCounts: { basketball: 3, tennis: 3, baseball: 2, soccer: 2, smile: 3 },
    hazards: [
      { type: 'cone', x: 300, y: 200, dx: 1.0, dy: 0 },
    ],
    checkpoints: [],
    exitGate: { x: 680, y: 460 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
    ],
    bg: '#4CAF50',
    courtTheme: { style:'hardwood', floorColor:'#B8732A', paintColor:'#C8102E', lineColor:'#FFFFFF', icon:'🏀', label:'NBA Hardwood' },
  },

  // ══════════════════════════════════════════════
  // 2 — Schoolyard
  // ══════════════════════════════════════════════
  {
    id: 2, name: 'Schoolyard', theme: 'Walls and obstacles appear',
    targetScore: 180, targetSmiles: 3,
    ballCounts: { basketball: 4, tennis: 4, baseball: 3, soccer: 3, volleyball: 2, smile: 4 },
    hazards: [
      { type: 'cone',   x: 200, y: 300, dx: 1.2, dy: 0 },
      { type: 'puddle', x: 450, y: 250, dx: 0,   dy: 0 },
    ],
    checkpoints: [],
    exitGate: { x: 130, y: 460 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  4, y:  3, w:  3, h:  1 },
      { x: 13, y:  9, w:  3, h:  1 },
    ],
    bg: '#43A047',
    courtTheme: { style:'blacktop', floorColor:'#282828', paintColor:'#1A4FA0', lineColor:'#DDDDDD', icon:'🏟️', label:'Blacktop' },
  },

  // ══════════════════════════════════════════════
  // 3 — Skate Spot
  // ══════════════════════════════════════════════
  {
    id: 3, name: 'Skate Spot', theme: 'Moving cones, first checkpoint',
    targetScore: 260, targetSmiles: 3,
    ballCounts: { basketball: 4, tennis: 5, baseball: 4, soccer: 3, volleyball: 3, smile: 5 },
    hazards: [
      { type: 'cone',   x: 150, y: 150, dx: 1.5, dy: 0   },
      { type: 'cone',   x: 500, y: 380, dx: 0,   dy: 1.5 },
      { type: 'puddle', x: 300, y: 300, dx: 0,   dy: 0   },
    ],
    checkpoints: [ { x: 400, y: 280 } ],
    exitGate: { x: 680, y: 120 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  5, y:  4, w:  1, h:  4 },
      { x: 13, y:  5, w:  1, h:  4 },
    ],
    bg: '#388E3C',
    courtTheme: { style:'stone', floorColor:'#6E6E72', paintColor:'#7B3F8C', lineColor:'#E8E8E8', icon:'🪨', label:'Stone Court' },
  },

  // ══════════════════════════════════════════════
  // 4 — Tight Alley
  // ══════════════════════════════════════════════
  {
    id: 4, name: 'Tight Alley', theme: 'First chaser enemy, tight spaces',
    targetScore: 350, targetSmiles: 4,
    ballCounts: { basketball: 5, tennis: 5, baseball: 4, soccer: 4, volleyball: 3, football: 2, smile: 6 },
    hazards: [
      { type: 'cone',   x: 200, y: 200, dx: 1.8, dy: 0   },
      { type: 'chaser', x: 600, y: 400, dx: 0,   dy: 0   },
      { type: 'puddle', x: 350, y: 350, dx: 0,   dy: 0   },
    ],
    checkpoints: [ { x: 500, y: 430 } ],
    exitGate: { x: 130, y: 120 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  3, y:  2, w:  5, h:  1 },
      { x:  3, y:  2, w:  1, h:  5 },
      { x: 11, y:  7, w:  5, h:  1 },
      { x: 15, y:  3, w:  1, h:  5 },
    ],
    bg: '#2E7D32',
    courtTheme: { style:'beach', floorColor:'#D4A76A', paintColor:'#2FA8A8', lineColor:'#FFFFFF', icon:'🌊', label:'Beach Court' },
  },

  // ══════════════════════════════════════════════
  // 5 — Playground Maze
  // ══════════════════════════════════════════════
  {
    id: 5, name: 'Playground Maze', theme: 'First spinner + speed pressure',
    targetScore: 460, targetSmiles: 5,
    ballCounts: { basketball: 5, tennis: 6, baseball: 4, soccer: 4, volleyball: 4, football: 3, smile: 7 },
    hazards: [
      { type: 'cone',    x: 150, y: 150, dx: 2.5, dy: 0   },
      { type: 'cone',    x: 500, y: 350, dx: 0,   dy: 2.5 },
      { type: 'chaser',  x: 400, y: 300, dx: 0,   dy: 0   },
      { type: 'puddle',  x: 200, y: 350, dx: 0,   dy: 0   },
      { type: 'puddle',  x: 550, y: 200, dx: 0,   dy: 0   },
      { type: 'spinner', x: 390, y: 270, dx: 0,   dy: 0   },
    ],
    checkpoints: [ { x: 200, y: 440 } ],
    exitGate: { x: 680, y: 100 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  7, y:  3, w:  6, h:  1 },
      { x:  7, y:  9, w:  6, h:  1 },
    ],
    bg: '#827717',
    courtTheme: { style:'forest', floorColor:'#3B5A2A', paintColor:'#7A4E2D', lineColor:'#D0E8C0', icon:'🌲', label:'Forest Court' },
  },

  // ══════════════════════════════════════════════
  // 6 — Park Loop
  // ══════════════════════════════════════════════
  {
    id: 6, name: 'Park Loop', theme: '2 chasers, 2 spinners, double checkpoint',
    targetScore: 600, targetSmiles: 6,
    ballCounts: { basketball: 5, tennis: 6, baseball: 5, soccer: 5, volleyball: 4, football: 4, bowling: 2, smile: 9 },
    hazards: [
      { type: 'cone',    x: 150, y: 200, dx:  2.0, dy:  0.5 },
      { type: 'cone',    x: 550, y: 300, dx: -1.5, dy:  1.0 },
      { type: 'chaser',  x: 350, y: 150, dx:  0,   dy:  0   },
      { type: 'chaser',  x: 200, y: 420, dx:  0,   dy:  0   },
      { type: 'puddle',  x: 400, y: 280, dx:  0,   dy:  0   },
      { type: 'spinner', x: 250, y: 150, dx:  0,   dy:  0   },
      { type: 'spinner', x: 560, y: 420, dx:  0,   dy:  0   },
    ],
    checkpoints: [ { x: 660, y: 140 }, { x: 130, y: 430 } ],
    exitGate: { x: 400, y: 100 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  4, y:  4, w:  1, h:  5 },
      { x: 14, y:  4, w:  1, h:  5 },
      { x:  7, y:  6, w:  6, h:  1 },
    ],
    bg: '#1565C0',
    courtTheme: { style:'ice', floorColor:'#B8D8F0', paintColor:'#78B4E0', lineColor:'#FFFFFF', icon:'❄️', label:'Ice Court' },
  },

  // ══════════════════════════════════════════════
  // 7 — Sunset Street Court
  // ══════════════════════════════════════════════
  {
    id: 7, name: 'Sunset Street', theme: 'Maze layout, roller enemies debut',
    targetScore: 760, targetSmiles: 7,
    ballCounts: { basketball: 6, tennis: 7, baseball: 5, soccer: 5, volleyball: 5, football: 4, bowling: 3, smile: 10 },
    hazards: [
      { type: 'cone',   x: 200, y: 200, dx:  2.2, dy:  0   },
      { type: 'roller', x: 500, y: 300, dx:  2.8, dy:  1.2 },
      { type: 'chaser', x: 350, y: 250, dx:  0,   dy:  0   },
      { type: 'chaser', x: 150, y: 380, dx:  0,   dy:  0   },
      { type: 'puddle', x: 300, y: 200, dx:  0,   dy:  0   },
      { type: 'puddle', x: 500, y: 400, dx:  0,   dy:  0   },
      { type: 'spinner',x: 630, y: 150, dx:  0,   dy:  0   },
    ],
    checkpoints: [ { x: 360, y: 430 } ],
    exitGate: { x: 680, y: 430 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  2, y:  2, w:  4, h:  1 },
      { x:  2, y:  2, w:  1, h:  4 },
      { x:  8, y:  2, w:  4, h:  1 },
      { x: 14, y:  2, w:  4, h:  1 },
      { x: 17, y:  2, w:  1, h:  4 },
      { x:  5, y:  5, w:  1, h:  4 },
      { x:  9, y:  5, w:  5, h:  1 },
      { x: 13, y:  5, w:  1, h:  4 },
      { x:  2, y:  9, w:  4, h:  1 },
      { x:  8, y:  8, w:  4, h:  1 },
      { x: 14, y:  9, w:  4, h:  1 },
    ],
    bg: '#4527A0',
    courtTheme: { style:'fire', floorColor:'#180800', paintColor:'#CC3300', lineColor:'#FF8800', icon:'🔥', label:'Fire Court' },
  },

  // ══════════════════════════════════════════════
  // 8 — Rooftop Play Zone  ★ MINI-BOSS LEVEL ★
  // ══════════════════════════════════════════════
  {
    id: 8, name: 'Rooftop Play Zone', theme: '⚠️ Boss Rush — a giant hunter patrols the roof',
    targetScore: 940, targetSmiles: 7,
    ballCounts: { basketball: 6, tennis: 7, baseball: 6, soccer: 6, volleyball: 5, football: 5, bowling: 4, smile: 10 },
    hazards: [
      { type: 'boss',   x: 400, y: 280, dx:  0,   dy:  0   }, // ← MINI-BOSS
      { type: 'cone',   x: 150, y: 150, dx:  2.5, dy:  1.0 },
      { type: 'cone',   x: 500, y: 200, dx: -2.5, dy:  1.5 },
      { type: 'roller', x: 300, y: 400, dx:  2.8, dy: -2.0 },
      { type: 'chaser', x: 250, y: 350, dx:  0,   dy:  0   },
      { type: 'puddle', x: 200, y: 200, dx:  0,   dy:  0   },
      { type: 'puddle', x: 500, y: 350, dx:  0,   dy:  0   },
      { type: 'spinner',x: 560, y: 130, dx:  0,   dy:  0   },
      { type: 'spinner',x: 160, y: 430, dx:  0,   dy:  0   },
    ],
    checkpoints: [ { x: 660, y: 430 }, { x: 130, y: 140 } ],
    exitGate: { x: 400, y: 460 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  5, y:  3, w:  3, h:  1 },
      { x: 12, y:  3, w:  3, h:  1 },
      { x:  5, y: 10, w:  3, h:  1 },
      { x: 12, y: 10, w:  3, h:  1 },
      { x:  8, y:  6, w:  4, h:  2 },
    ],
    bg: '#B71C1C',
    courtTheme: { style:'neon', floorColor:'#050510', paintColor:'#00CCCC', lineColor:'#FF00CC', icon:'🌙', label:'Night Neon' },
  },

  // ══════════════════════════════════════════════
  // 9 — Neon Court
  // ══════════════════════════════════════════════
  {
    id: 9, name: 'Neon Court', theme: 'Multiple bosses + deep corridors',
    targetScore: 1150, targetSmiles: 8,
    ballCounts: { basketball: 7, tennis: 8, baseball: 6, soccer: 6, volleyball: 6, football: 5, bowling: 4, smile: 12 },
    hazards: [
      { type: 'boss',    x: 400, y: 280, dx:  0,   dy:  0   },
      { type: 'cone',    x: 150, y: 120, dx:  2.8, dy:  0   },
      { type: 'cone',    x: 550, y: 420, dx:  0,   dy: -2.8 },
      { type: 'roller',  x: 350, y: 270, dx:  3.0, dy:  1.5 },
      { type: 'chaser',  x: 250, y: 180, dx:  0,   dy:  0   },
      { type: 'chaser',  x: 450, y: 350, dx:  0,   dy:  0   },
      { type: 'puddle',  x: 150, y: 300, dx:  0,   dy:  0   },
      { type: 'puddle',  x: 600, y: 300, dx:  0,   dy:  0   },
      { type: 'spinner', x: 400, y: 140, dx:  0,   dy:  0   },
      { type: 'spinner', x: 200, y: 430, dx:  0,   dy:  0   },
      { type: 'spinner', x: 620, y: 430, dx:  0,   dy:  0   },
    ],
    checkpoints: [ { x: 700, y: 270 }, { x: 100, y: 160 } ],
    exitGate: { x: 400, y: 100 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  3, y:  3, w:  2, h:  7 },
      { x: 15, y:  3, w:  2, h:  7 },
      { x:  7, y:  3, w:  6, h:  1 },
      { x:  7, y: 10, w:  6, h:  1 },
      { x:  9, y:  5, w:  2, h:  4 },
    ],
    bg: '#880E4F',
    courtTheme: { style:'luxury', floorColor:'#2A1A0E', paintColor:'#B8960C', lineColor:'#FFD700', icon:'🏛️', label:'Luxury Indoor' },
  },

  // ══════════════════════════════════════════════
  // 10 — Championship Playground  ★ FINAL LEVEL ★
  // ══════════════════════════════════════════════
  {
    id: 10, name: 'Championship Playground', theme: '🏆 All Courts Are Beautiful — ultimate challenge',
    targetScore: 1400, targetSmiles: 10,
    ballCounts: { basketball: 8, tennis: 8, baseball: 7, soccer: 7, volleyball: 6, football: 6, bowling: 5, smile: 15 },
    hazards: [
      { type: 'boss',    x: 250, y: 200, dx:  0,   dy:  0   },
      { type: 'boss',    x: 550, y: 380, dx:  0,   dy:  0   },
      { type: 'cone',    x: 150, y: 130, dx:  3.0, dy:  0.5 },
      { type: 'cone',    x: 580, y: 420, dx: -3.0, dy: -0.5 },
      { type: 'roller',  x: 350, y: 270, dx:  3.0, dy:  2.5 },
      { type: 'chaser',  x: 130, y: 280, dx:  0,   dy:  0   },
      { type: 'chaser',  x: 600, y: 200, dx:  0,   dy:  0   },
      { type: 'puddle',  x: 200, y: 200, dx:  0,   dy:  0   },
      { type: 'puddle',  x: 500, y: 300, dx:  0,   dy:  0   },
      { type: 'puddle',  x: 350, y: 420, dx:  0,   dy:  0   },
      { type: 'spinner', x: 400, y: 280, dx:  0,   dy:  0   },
      { type: 'spinner', x: 640, y: 130, dx:  0,   dy:  0   },
      { type: 'spinner', x: 160, y: 130, dx:  0,   dy:  0   },
    ],
    checkpoints: [ { x: 680, y: 440 }, { x: 110, y: 440 } ],
    exitGate: { x: 400, y: 280 },
    walls: [
      { x:  0, y:  0, w: 20, h:  1 },
      { x:  0, y: 13, w: 20, h:  1 },
      { x:  0, y:  0, w:  1, h: 14 },
      { x: 19, y:  0, w:  1, h: 14 },
      { x:  3, y:  2, w:  4, h:  1 },
      { x: 13, y:  2, w:  4, h:  1 },
      { x:  3, y: 11, w:  4, h:  1 },
      { x: 13, y: 11, w:  4, h:  1 },
      { x:  3, y:  2, w:  1, h:  4 },
      { x: 16, y:  2, w:  1, h:  4 },
      { x:  3, y:  7, w:  1, h:  4 },
      { x: 16, y:  7, w:  1, h:  4 },
      { x:  7, y:  5, w:  6, h:  1 },
      { x:  7, y:  8, w:  6, h:  1 },
      { x:  9, y:  5, w:  1, h:  4 },
      { x: 11, y:  5, w:  1, h:  4 },
    ],
    bg: '#1A237E',
    courtTheme: { style:'rainbow', floorColor:'#F0F0FF', paintColor:'#FF6B9D', lineColor:'#FFFFFF', icon:'🌈', label:'Rainbow Champion' },
  },
];
