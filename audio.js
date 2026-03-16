// ============================================================
// AUDIO.JS — Lightweight Web Audio API sound effects
// ============================================================
// FUTURE: Replace with Howler.js + real assets when custom
//         ACAB audio is ready.

const Audio = (() => {
  let ctx   = null;
  let muted = false;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function play(type) {
    if (muted) return;
    try {
      const c   = getCtx();
      const o   = c.createOscillator();
      const g   = c.createGain();
      o.connect(g);
      g.connect(c.destination);
      const now = c.currentTime;

      switch (type) {

        case 'collect': {
          // Basketball bounce thud — low thump then pitch rises
          const o2 = c.createOscillator(); const g2 = c.createGain();
          o2.connect(g2); g2.connect(c.destination);
          o2.type = 'sine';
          o2.frequency.setValueAtTime(160, now);
          o2.frequency.exponentialRampToValueAtTime(80, now + 0.09);
          g2.gain.setValueAtTime(0.45, now);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          o2.start(now); o2.stop(now + 0.12);
          // High collect ping on top
          o.type = 'sine';
          o.frequency.setValueAtTime(520, now + 0.04);
          o.frequency.exponentialRampToValueAtTime(880, now + 0.16);
          g.gain.setValueAtTime(0.18, now + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          o.start(now + 0.04); o.stop(now + 0.22);
          break;
        }

        case 'smile': {
          // Net swish micro-burst for smile token
          const sbuf = c.createBuffer(1, c.sampleRate * 0.18, c.sampleRate);
          const sd   = sbuf.getChannelData(0);
          for (let i = 0; i < sd.length; i++) sd[i] = (Math.random() * 2 - 1);
          const ss = c.createBufferSource(); ss.buffer = sbuf;
          const sf = c.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 4000; sf.Q.value = 1.5;
          const sg = c.createGain();
          sg.gain.setValueAtTime(0.22, now);
          sg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          ss.connect(sf); sf.connect(sg); sg.connect(c.destination);
          ss.start(now); ss.stop(now + 0.18);
          // Happy jingle on top
          o.type = 'triangle';
          o.frequency.setValueAtTime(660, now);
          o.frequency.setValueAtTime(880, now + 0.07);
          o.frequency.setValueAtTime(1100, now + 0.14);
          g.gain.setValueAtTime(0.24, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          o.start(now); o.stop(now + 0.25);
          break;
        }

        case 'hit':
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(220, now);
          o.frequency.exponentialRampToValueAtTime(80, now + 0.22);
          g.gain.setValueAtTime(0.35, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          o.start(now); o.stop(now + 0.22);
          break;

        case 'level': {
          const notes = [523, 659, 784, 1047];
          notes.forEach((freq, i) => {
            const o2 = c.createOscillator(); const g2 = c.createGain();
            o2.connect(g2); g2.connect(c.destination);
            o2.type = 'sine';
            const t = now + i * 0.12;
            o2.frequency.setValueAtTime(freq, t);
            g2.gain.setValueAtTime(0.25, t);
            g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            o2.start(t); o2.stop(t + 0.22);
          });
          return;
        }

        case 'unlock':
          o.type = 'sine';
          [440, 550, 660, 880].forEach((f, i) => {
            o.frequency.setValueAtTime(f, now + i * 0.1);
          });
          g.gain.setValueAtTime(0.28, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
          o.start(now); o.stop(now + 0.45);
          break;

        case 'powerup':
          o.type = 'triangle';
          o.frequency.setValueAtTime(400, now);
          o.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
          g.gain.setValueAtTime(0.3, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          o.start(now); o.stop(now + 0.25);
          break;

        case 'combo':  // milestone combo jingle
          o.type = 'square';
          [600, 800, 1000].forEach((f, i) => {
            o.frequency.setValueAtTime(f, now + i * 0.07);
          });
          g.gain.setValueAtTime(0.18, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          o.start(now); o.stop(now + 0.28);
          break;

        case 'gate': {  // exit gate opens — net swish sound
          // Crowd "swish" — quick filtered noise burst
          const buf  = c.createBuffer(1, c.sampleRate * 0.35, c.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
          const src  = c.createBufferSource();
          src.buffer = buf;
          const bpf  = c.createBiquadFilter();
          bpf.type            = 'bandpass';
          bpf.frequency.value = 3200;
          bpf.Q.value         = 1.2;
          const swishGain = c.createGain();
          swishGain.gain.setValueAtTime(0.28, now);
          swishGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          src.connect(bpf); bpf.connect(swishGain); swishGain.connect(c.destination);
          src.start(now); src.stop(now + 0.35);
          // Rising tone underneath
          o.type = 'sine';
          o.frequency.setValueAtTime(300, now);
          o.frequency.exponentialRampToValueAtTime(900, now + 0.3);
          g.gain.setValueAtTime(0.2, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          o.start(now); o.stop(now + 0.4);
          break;
        }

        case 'checkpoint':
          o.type = 'sine';
          o.frequency.setValueAtTime(740, now);
          o.frequency.setValueAtTime(990, now + 0.1);
          g.gain.setValueAtTime(0.25, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          o.start(now); o.stop(now + 0.22);
          break;

        case 'gameover':
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(400, now);
          o.frequency.exponentialRampToValueAtTime(100, now + 0.6);
          g.gain.setValueAtTime(0.3, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
          o.start(now); o.stop(now + 0.65);
          break;

        case 'click':
        default:
          o.type = 'sine';
          o.frequency.setValueAtTime(400, now);
          g.gain.setValueAtTime(0.12, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          o.start(now); o.stop(now + 0.06);
      }
    } catch(e) { /* silently fail */ }
  }

  function toggleMute() {
    muted = !muted;
    const btn = document.getElementById('muteBtn');
    if (btn) btn.textContent = muted ? '🔇' : '🔊';
    return muted;
  }

  function isMuted() { return muted; }

  return { play, toggleMute, isMuted };
})();

function toggleMute() { Audio.toggleMute(); }
