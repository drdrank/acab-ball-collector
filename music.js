// ============================================================
// MUSIC.JS — Lo-fi hip-hop background music (Web Audio API)
// J Dilla / Madlib style: warm, dusty, soulful beats.
// No external files needed — generated entirely in the browser.
// ============================================================

const MusicPlayer = (() => {
  let _ctx        = null;
  let _master     = null;
  let _noiseCache = null;   // pre-built noise buffer
  let _schedId    = null;
  let _nextTime   = 0;
  let _step       = 0;
  let _playing    = false;
  let _muted      = false;

  const BPM         = 82;
  const STEP_TIME   = 60 / BPM / 4;   // 16th-note duration in seconds
  const LOOKAHEAD   = 0.12;            // schedule this many seconds ahead
  const TICK_MS     = 40;              // scheduler tick interval
  const TARGET_VOL  = 0.40;

  // ── Lo-fi chord progression: Am7 → Fmaj7 → Dm7 → E7 ──────
  const CHORDS = [
    [220.00, 261.63, 329.63, 392.00],  // Am7  (A3 C4 E4 G4)
    [174.61, 220.00, 261.63, 329.63],  // Fmaj7(F3 A3 C4 E4)
    [146.83, 174.61, 220.00, 261.63],  // Dm7  (D3 F3 A3 C4)
    [164.81, 207.65, 246.94, 293.66],  // E7   (E3 G#3 B3 D4)
  ];
  const BASS = [110.00, 87.31, 73.42, 82.41]; // A2 F2 D2 E2

  // ── 16-step drum pattern ───────────────────────────────────
  //                1  e  +  a  2  e  +  a  3  e  +  a  4  e  +  a
  const PAT_KICK  = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0];
  const PAT_SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];
  const PAT_HIHAT = [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0];
  const PAT_OPEN  = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // ── Initialise AudioContext ────────────────────────────────
  function _init() {
    if (_ctx) return;
    _ctx    = new (window.AudioContext || window.webkitAudioContext)();
    _master = _ctx.createGain();
    _master.gain.setValueAtTime(0.0001, _ctx.currentTime);
    _master.connect(_ctx.destination);

    // Pre-build a 2-second stereo noise buffer (reused for all drums)
    const len   = _ctx.sampleRate * 2;
    _noiseCache = _ctx.createBuffer(1, len, _ctx.sampleRate);
    const data  = _noiseCache.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  // ── Drum voices ───────────────────────────────────────────

  function _kick(t) {
    const osc = _ctx.createOscillator();
    const env = _ctx.createGain();
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.18);
    env.gain.setValueAtTime(0.9, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(env);  env.connect(_master);
    osc.start(t);      osc.stop(t + 0.45);
  }

  function _snare(t) {
    // Noise body
    const ns  = _ctx.createBufferSource();
    ns.buffer = _noiseCache;
    ns.loop   = false;
    const bpf = _ctx.createBiquadFilter();
    bpf.type  = 'bandpass';
    bpf.frequency.value = 1600;
    bpf.Q.value         = 0.6;
    const env = _ctx.createGain();
    env.gain.setValueAtTime(0.45, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    ns.connect(bpf);  bpf.connect(env);  env.connect(_master);
    ns.start(t);      ns.stop(t + 0.18);

    // Tone crack
    const osc  = _ctx.createOscillator();
    const oenv = _ctx.createGain();
    osc.frequency.value = 185;
    oenv.gain.setValueAtTime(0.22, t);
    oenv.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    osc.connect(oenv);  oenv.connect(_master);
    osc.start(t);       osc.stop(t + 0.09);
  }

  function _hihat(t, open) {
    const ns  = _ctx.createBufferSource();
    ns.buffer = _noiseCache;
    ns.loop   = false;
    const hpf = _ctx.createBiquadFilter();
    hpf.type  = 'highpass';
    hpf.frequency.value = 8500;
    const dur = open ? 0.22 : 0.035;
    const env = _ctx.createGain();
    env.gain.setValueAtTime(open ? 0.14 : 0.10, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    ns.connect(hpf);  hpf.connect(env);  env.connect(_master);
    ns.start(t);      ns.stop(t + dur + 0.01);
  }

  // ── Chord pad (plays for a full bar, triggered on step 0) ──

  function _chordPad(t, freqs) {
    const dur = STEP_TIME * 16;
    const lpf = _ctx.createBiquadFilter();
    lpf.type  = 'lowpass';
    lpf.frequency.value = 820;
    lpf.Q.value         = 0.4;
    const env = _ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.13, t + 0.12);
    env.gain.setValueAtTime(0.13, t + dur - 0.18);
    env.gain.linearRampToValueAtTime(0.0001, t + dur);
    lpf.connect(env);  env.connect(_master);

    freqs.forEach((f, i) => {
      const osc    = _ctx.createOscillator();
      osc.type     = 'triangle';
      osc.frequency.value = f;
      osc.detune.value    = (i % 2 === 0 ? -4 : 4);   // warm detuning
      osc.connect(lpf);
      osc.start(t);  osc.stop(t + dur + 0.05);
    });
  }

  // ── Bass note ─────────────────────────────────────────────

  function _bassNote(t, freq) {
    const dur  = STEP_TIME * 14;
    const lpf  = _ctx.createBiquadFilter();
    lpf.type   = 'lowpass';
    lpf.frequency.value = 280;

    const env  = _ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.30, t + 0.025);
    env.gain.exponentialRampToValueAtTime(0.10, t + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    // Fundamental + sub-octave
    [freq, freq / 2].forEach((f, i) => {
      const osc = _ctx.createOscillator();
      const g   = _ctx.createGain();
      osc.type  = 'sine';
      osc.frequency.value = f;
      g.gain.value = i === 0 ? 1.0 : 0.45;
      osc.connect(g);  g.connect(lpf);
      osc.start(t);    osc.stop(t + dur + 0.05);
    });

    lpf.connect(env);  env.connect(_master);
  }

  // ── Vinyl crackle ─────────────────────────────────────────

  function _crackle(t) {
    if (Math.random() > 0.25) return;
    const ns  = _ctx.createBufferSource();
    ns.buffer = _noiseCache;
    ns.loop   = false;
    const env = _ctx.createGain();
    env.gain.setValueAtTime(0.025, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.004);
    ns.connect(env);  env.connect(_master);
    ns.start(t);      ns.stop(t + 0.008);
  }

  // ── Scheduler ─────────────────────────────────────────────

  function _schedule() {
    while (_nextTime < _ctx.currentTime + LOOKAHEAD) {
      const step      = _step % 16;
      const chordIdx  = Math.floor(_step / 32) % CHORDS.length; // chord every 2 bars

      // Swing: push off-beat 16th notes ~9% of a step late
      const swing = (step % 2 === 1) ? STEP_TIME * 0.09 : 0;
      const t     = _nextTime + swing;

      // Drums
      if (PAT_KICK[step])  _kick(t);
      if (PAT_SNARE[step]) _snare(t);
      if (PAT_HIHAT[step]) _hihat(t, PAT_OPEN[step] === 1);

      // Vinyl texture on every step
      _crackle(t);

      // Chord pad on bar start
      if (step === 0) _chordPad(t, CHORDS[chordIdx]);

      // Bass on beat 1 and beat 3 of each bar
      if (step === 0) _bassNote(t,          BASS[chordIdx]);
      if (step === 8) _bassNote(t, BASS[chordIdx] * 1.125); // up a step for movement

      _nextTime += STEP_TIME;
      _step++;
    }
  }

  // ── Public API ────────────────────────────────────────────

  function start() {
    if (_playing) return;
    _init();
    if (_ctx.state === 'suspended') _ctx.resume();

    _playing   = true;
    _nextTime  = _ctx.currentTime + 0.08;
    _step      = 0;

    // Fade in (unless muted)
    _master.gain.cancelScheduledValues(_ctx.currentTime);
    _master.gain.setValueAtTime(0.0001, _ctx.currentTime);
    if (!_muted) {
      _master.gain.linearRampToValueAtTime(TARGET_VOL, _ctx.currentTime + 2.5);
    }

    _schedId = setInterval(_schedule, TICK_MS);
  }

  function stop() {
    if (!_playing) return;
    clearInterval(_schedId);
    _playing = false;
    if (_master && _ctx) {
      _master.gain.linearRampToValueAtTime(0.0001, _ctx.currentTime + 0.5);
    }
  }

  function mute() {
    _muted = true;
    if (_ctx && _master) {
      _master.gain.cancelScheduledValues(_ctx.currentTime);
      _master.gain.setValueAtTime(_master.gain.value, _ctx.currentTime);
      _master.gain.linearRampToValueAtTime(0.0001, _ctx.currentTime + 0.8);
    }
    localStorage.setItem('acab_music_muted', '1');
    _updateBtn();
  }

  function unmute() {
    _muted = false;
    if (_ctx) {
      if (_ctx.state === 'suspended') _ctx.resume();
      _master.gain.cancelScheduledValues(_ctx.currentTime);
      _master.gain.setValueAtTime(_master.gain.value, _ctx.currentTime);
      _master.gain.linearRampToValueAtTime(TARGET_VOL, _ctx.currentTime + 0.8);
    }
    if (!_playing) start();
    localStorage.setItem('acab_music_muted', '0');
    _updateBtn();
  }

  function toggle() {
    if (_muted) unmute(); else mute();
  }

  function _updateBtn() {
    const btn = document.getElementById('music-btn');
    if (!btn) return;
    btn.textContent = _muted ? '🔇' : '🎵';
    btn.classList.toggle('playing', !_muted);
  }

  // Start on first user gesture (browser autoplay policy)
  function _tryStart() {
    _muted = localStorage.getItem('acab_music_muted') === '1';
    start();
    _updateBtn();
  }

  document.addEventListener('DOMContentLoaded', () => {
    ['click', 'keydown', 'touchstart'].forEach(ev =>
      document.addEventListener(ev, _tryStart, { once: true })
    );
  });

  return { start, stop, mute, unmute, toggle };
})();
