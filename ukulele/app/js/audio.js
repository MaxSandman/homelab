// Son : synthèse de corde pincée (Karplus-Strong), grattage, métronome, horloge, micro.
import { midiToFreq } from './theory.js';

let ctx = null;
let master = null;
let volume = 0.8;

export function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = v;
}

const bufferCache = new Map();

/** Fabrique (une fois) le son d'une corde pincée pour une note MIDI. */
function pluckBuffer(midi) {
  if (bufferCache.has(midi)) return bufferCache.get(midi);
  const c = getCtx();
  const sr = c.sampleRate;
  const freq = midiToFreq(midi);
  const N = Math.max(2, Math.floor(sr / freq - 0.5));
  const actual = sr / (N + 0.5);
  const len = Math.floor(sr * 2.2);
  const buf = c.createBuffer(1, len, sr);
  const y = buf.getChannelData(0);
  // excitation : bruit adouci (son plus "nylon")
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const r = Math.random() * 2 - 1;
    prev = prev * 0.5 + r * 0.5;
    y[i] = prev;
  }
  const decay = 0.9965 - (midi - 60) * 0.00004;
  for (let i = N; i < len; i++) {
    y[i] = decay * 0.5 * (y[i - N] + y[i - N - 1 >= 0 ? i - N - 1 : 0]);
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
  for (let i = 0; i < len; i++) y[i] /= peak || 1;
  const entry = { buf, rate: freq / actual };
  bufferCache.set(midi, entry);
  return entry;
}

/** Joue une note. `when` en temps AudioContext (0 = maintenant). */
export function playNote(midi, when = 0, gain = 0.5, duration = 2) {
  const c = getCtx();
  const t = Math.max(when, c.currentTime);
  const { buf, rate } = pluckBuffer(midi);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3800;
  g.gain.setValueAtTime(gain, t);
  g.gain.setTargetAtTime(0, t + duration, 0.08);
  src.connect(lp).connect(g).connect(master);
  src.start(t);
  src.stop(t + duration + 0.6);
  return src;
}

/** Gratte un accord. dir 'D' = vers le bas (Sol -> La), 'U' = vers le haut. */
export function strum(midis, when = 0, dir = 'D', gain = 0.32, duration = 1.6) {
  if (!midis || !midis.length) return;
  const order = dir === 'U' ? [...midis].reverse() : midis;
  const spread = dir === 'U' ? 0.012 : 0.018;
  const g = dir === 'U' ? gain * 0.75 : gain;
  order.forEach((m, i) => playNote(m, when + i * spread, g, duration));
}

/** Clic de métronome. */
export function click(when = 0, accent = false, gain = 0.5) {
  const c = getCtx();
  const t = Math.max(when, c.currentTime);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.value = accent ? 1760 : 1175;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? gain : gain * 0.6, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.08);
}

/**
 * Horloge précise basée sur l'horloge audio. Appelle onSlot(position, temps) à chaque
 * croche (2 par temps). onSlot peut renvoyer un nombre (position suivante, pour boucler)
 * ou false (arrêt).
 */
export class Clock {
  constructor({ bpm = 80, onSlot, slotsPerBeat = 2, onEnd } = {}) {
    this.bpm = bpm;
    this.onSlot = onSlot;
    this.onEnd = onEnd;
    this.slotsPerBeat = slotsPerBeat;
    this.running = false;
    this.history = [];
  }
  get slotDur() {
    return 60 / this.bpm / this.slotsPerBeat;
  }
  start(pos = 0) {
    const c = getCtx();
    this.stop();
    this.pos = pos;
    this.nextTime = c.currentTime + 0.08;
    this.history = [];
    this.running = true;
    this.ended = false;
    this.timer = setInterval(() => this._tick(), 20);
    this._tick();
  }
  _tick() {
    const c = getCtx();
    while (this.running && this.nextTime < c.currentTime + 0.12) {
      const p = this.pos;
      const t = this.nextTime;
      const next = this.onSlot ? this.onSlot(p, t) : undefined;
      this.history.push({ t, p, d: this.slotDur });
      if (this.history.length > 48) this.history.shift();
      if (next === false) {
        this.running = false;
        clearInterval(this.timer);
        const wait = Math.max(0, (t - c.currentTime) * 1000 + this.slotDur * 1000);
        this.endTimer = setTimeout(() => {
          this.ended = true;
          this.onEnd && this.onEnd();
        }, wait);
        break;
      }
      this.pos = typeof next === 'number' ? next : p + 1 / this.slotsPerBeat;
      this.nextTime += this.slotDur;
    }
  }
  /** Position actuelle (en temps), interpolée. null avant le premier temps. */
  now() {
    if (!ctx) return null;
    const t = ctx.currentTime;
    let last = null;
    for (const h of this.history) {
      if (h.t <= t) last = h;
      else break;
    }
    if (!last) return null;
    const frac = Math.min((t - last.t) / last.d, 0.999);
    return last.p + frac / this.slotsPerBeat;
  }
  stop() {
    this.running = false;
    clearInterval(this.timer);
    clearTimeout(this.endTimer);
  }
}

// ------------------------------------------------------------ Micro / hauteur

export function micAvailable() {
  return !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/** Ouvre le micro et appelle onPitch({freq, clarity, rms}) ~ 30 fois par seconde. */
export async function startPitchListener(onPitch) {
  const c = getCtx();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const src = c.createMediaStreamSource(stream);
  const analyser = c.createAnalyser();
  analyser.fftSize = 4096;
  src.connect(analyser);
  const data = new Float32Array(analyser.fftSize);
  let raf = 0;
  let stopped = false;
  let frame = 0;
  const loop = () => {
    if (stopped) return;
    if (frame++ % 2 === 0) {
      analyser.getFloatTimeDomainData(data);
      onPitch(detectPitch(data, c.sampleRate));
    }
    raf = requestAnimationFrame(loop);
  };
  loop();
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    src.disconnect();
  };
}

/** Détection de hauteur par autocorrélation (adaptée au ukulélé : ~250 Hz à 1200 Hz). */
export function detectPitch(buf, sr) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return { freq: 0, clarity: 0, rms };
  const minLag = Math.floor(sr / 1400);
  const maxLag = Math.floor(sr / 180);
  const size = Math.min(n - maxLag, 2048);
  let best = -1;
  let bestLag = -1;
  const corr = new Float32Array(maxLag + 2);
  let e0 = 0;
  for (let i = 0; i < size; i++) e0 += buf[i] * buf[i];
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0;
    let e1 = 0;
    for (let i = 0; i < size; i++) {
      s += buf[i] * buf[i + lag];
      e1 += buf[i + lag] * buf[i + lag];
    }
    corr[lag] = (2 * s) / (e0 + e1 || 1);
  }
  // premier pic suffisamment haut (évite les erreurs d'octave)
  let globalMax = 0;
  for (let lag = minLag; lag <= maxLag; lag++) globalMax = Math.max(globalMax, corr[lag]);
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1] && corr[lag] > globalMax * 0.9) {
      best = corr[lag];
      bestLag = lag;
      break;
    }
  }
  if (bestLag < 0 || best < 0.6) return { freq: 0, clarity: best, rms };
  const a = corr[bestLag - 1];
  const b = corr[bestLag];
  const c2 = corr[bestLag + 1];
  const shift = (a - c2) / (2 * (a - 2 * b + c2) || 1);
  return { freq: sr / (bestLag + shift), clarity: best, rms };
}

// ------------------------------------------------------- Garder l'écran allumé

let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* non disponible (http) : pas grave */
  }
}
