// Analyse audio (exécutée en arrière-plan, dans le navigateur, rien n'est envoyé sur internet).
// - "chords" : tempo, temps, accords d'un morceau complet
// - "melody" : transcription d'une mélodie jouée/chantée seule (une note à la fois)
/* eslint-disable no-restricted-globals */

self.onmessage = (e) => {
  const { type, samples, sr, bpm } = e.data;
  try {
    const result = type === 'chords' ? analyzeChords(samples, sr) : analyzeMelody(samples, sr, bpm);
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
  }
};
const progress = (p, msg) => self.postMessage({ type: 'progress', p, msg });

// ------------------------------------------------------------ FFT
const fftCache = new Map();
function getFFT(N) {
  if (fftCache.has(N)) return fftCache.get(N);
  const cos = new Float64Array(N / 2);
  const sin = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / N);
    sin[i] = Math.sin((2 * Math.PI * i) / N);
  }
  const bits = Math.log2(N);
  const rev = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const fft = (re, im) => {
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1;
      const step = N / size;
      for (let i = 0; i < N; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre = re[l] * cos[k] + im[l] * sin[k];
          const tim = -re[l] * sin[k] + im[l] * cos[k];
          re[l] = re[j] - tre; im[l] = im[j] - tim;
          re[j] += tre; im[j] += tim;
        }
      }
    }
  };
  fftCache.set(N, fft);
  return fft;
}
const hann = (N) => {
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  return w;
};

/** Spectres d'amplitude de toutes les trames. */
function spectra(x, N, hop, onFrame) {
  const fft = getFFT(N);
  const w = hann(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const mag = new Float64Array(N / 2);
  const frames = Math.max(0, Math.floor((x.length - N) / hop) + 1);
  for (let f = 0; f < frames; f++) {
    const o = f * hop;
    for (let i = 0; i < N; i++) {
      re[i] = x[o + i] * w[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    onFrame(f, mag);
  }
  return frames;
}

// ------------------------------------------------------------ tempo et temps
function onsetEnvelope(x, sr) {
  const N = 1024;
  const hop = 512;
  let prev = null;
  const env = [];
  spectra(x, N, hop, (f, mag) => {
    let s = 0;
    const cur = new Float64Array(N / 2);
    for (let k = 1; k < N / 2; k++) {
      cur[k] = Math.log(1 + 100 * mag[k]);
      if (prev) s += Math.max(0, cur[k] - prev[k]);
    }
    prev = cur;
    env.push(s);
    if (f % 400 === 0) progress(0.05 + 0.25 * (f * hop) / x.length, 'Recherche du tempo…');
  });
  // retirer la moyenne locale
  const fps = sr / hop;
  const win = Math.round(fps * 0.5);
  const out = new Float64Array(env.length);
  let acc = 0;
  for (let i = 0; i < env.length; i++) {
    acc += env[i];
    if (i >= win) acc -= env[i - win];
    out[i] = Math.max(0, env[i] - acc / Math.min(i + 1, win));
  }
  let sd = 0;
  for (const v of out) sd += v * v;
  sd = Math.sqrt(sd / out.length) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= sd;
  return { env: out, fps };
}

function estimateTempo(env, fps, lo = 60, hi = 180) {
  let best = 0;
  let bestLag = 0;
  const minLag = Math.floor((60 * fps) / hi);
  const maxLag = Math.ceil((60 * fps) / lo);
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = lag; i < env.length; i++) s += env[i] * env[i - lag];
    ac[lag] = s / (env.length - lag);
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag;
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 110) / 0.9, 2));
    // les multiples du tempo renforcent le score
    const score = (ac[lag] + 0.5 * (ac[Math.min(maxLag, lag * 2)] || 0)) * w;
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  const a = ac[bestLag - 1];
  const b = ac[bestLag];
  const c = ac[bestLag + 1];
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
  const lag = bestLag + Math.max(-0.5, Math.min(0.5, shift));
  return { bpm: (60 * fps) / lag, period: lag };
}

/** Suivi des temps par programmation dynamique (méthode d'Ellis). */
function trackBeats(env, period) {
  const n = env.length;
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const tight = 6;
  for (let t = 0; t < n; t++) {
    let best = 0;
    let arg = -1;
    const from = Math.max(0, Math.floor(t - 2 * period));
    const to = Math.floor(t - period / 2);
    for (let p = from; p <= to; p++) {
      const d = Math.log((t - p) / period);
      const s = score[p] - tight * d * d;
      if (arg < 0 || s > best) {
        best = s;
        arg = p;
      }
    }
    score[t] = env[t] + (arg >= 0 ? Math.max(0, best) : 0);
    back[t] = arg >= 0 && best > 0 ? arg : -1;
  }
  let t = n - 1;
  let bestEnd = score[t];
  for (let i = Math.max(0, Math.floor(n - period)); i < n; i++) if (score[i] > bestEnd) {
    bestEnd = score[i];
    t = i;
  }
  const beats = [];
  while (t >= 0) {
    beats.push(t);
    t = back[t];
  }
  beats.reverse();
  // combler les trous éventuels au début
  while (beats.length && beats[0] > period * 1.5) beats.unshift(Math.round(beats[0] - period));
  return beats;
}

// ------------------------------------------------------------ accords
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function templates() {
  const out = [];
  for (let r = 0; r < 12; r++) {
    for (const [q, iv] of [['', [0, 4, 7]], ['m', [0, 3, 7]]]) {
      const t = new Float64Array(12);
      t[r] = 1;
      t[(r + iv[1]) % 12] = 0.85;
      t[(r + iv[2]) % 12] = 0.9;
      let n = 0;
      for (const v of t) n += v * v;
      n = Math.sqrt(n);
      for (let i = 0; i < 12; i++) t[i] /= n;
      out.push({ name: NAMES[r] + q, t });
    }
  }
  return out;
}

const KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function corr(a, b) {
  const ma = a.reduce((x, y) => x + y) / 12;
  const mb = b.reduce((x, y) => x + y) / 12;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < 12; i++) {
    s += (a[i] - ma) * (b[i] - mb);
    sa += (a[i] - ma) ** 2;
    sb += (b[i] - mb) ** 2;
  }
  return s / Math.sqrt(sa * sb || 1);
}

function analyzeChords(x, sr) {
  progress(0.02, 'Préparation…');
  const duration = x.length / sr;
  const { env, fps } = onsetEnvelope(x, sr);
  const { bpm, period } = estimateTempo(env, fps);
  const beatFrames = trackBeats(env, period);
  const beats = beatFrames.map((f) => (f * 512 + 512) / sr);
  progress(0.35, 'Écoute des accords…');

  // chromagramme
  const N = 8192;
  const hop = 2048;
  const binPc = new Int16Array(N / 2).fill(-1);
  const binW = new Float64Array(N / 2);
  for (let k = 1; k < N / 2; k++) {
    const f = (k * sr) / N;
    if (f < 65 || f > 2100) continue;
    const m = 69 + 12 * Math.log2(f / 440);
    const dev = Math.abs(m - Math.round(m));
    if (dev > 0.4) continue;
    binPc[k] = ((Math.round(m) % 12) + 12) % 12;
    binW[k] = (1 - dev / 0.4) * (f < 200 ? 0.8 : 1);
  }
  const chroma = [];
  const energy = [];
  spectra(x, N, hop, (f, mag) => {
    const c = new Float64Array(12);
    let e = 0;
    for (let k = 1; k < N / 2; k++) {
      e += mag[k] * mag[k];
      if (binPc[k] >= 0) c[binPc[k]] += binW[k] * Math.log(1 + 50 * mag[k]);
    }
    chroma.push(c);
    energy.push(e);
    if (f % 100 === 0) progress(0.35 + 0.45 * (f * hop) / x.length, 'Écoute des accords…');
  });
  const frameTime = (f) => (f * hop + N / 2) / sr;
  const eSorted = [...energy].sort((a, b) => a - b);
  const silence = eSorted[Math.floor(eSorted.length * 0.5)] * 0.02;

  // chroma par temps
  const grid = beats.length > 4 ? [...beats, Math.min(duration, beats[beats.length - 1] + period / fps)] : [];
  const beatChroma = [];
  const beatSilent = [];
  let fi = 0;
  for (let b = 0; b < grid.length - 1; b++) {
    const c = new Float64Array(12);
    let e = 0;
    let n = 0;
    while (fi < chroma.length && frameTime(fi) < grid[b]) fi++;
    let j = fi;
    while (j < chroma.length && frameTime(j) < grid[b + 1]) {
      for (let i = 0; i < 12; i++) c[i] += chroma[j][i];
      e += energy[j];
      n++;
      j++;
    }
    let norm = 0;
    for (const v of c) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < 12; i++) c[i] /= norm;
    beatChroma.push(c);
    beatSilent.push(n === 0 || e / n < silence);
  }
  progress(0.85, 'Choix des accords…');

  // similarité avec les modèles + lissage (Viterbi)
  const T = templates();
  const S = T.length;
  const sims = beatChroma.map((c, b) =>
    T.map((t) => {
      if (beatSilent[b]) return 0;
      let s = 0;
      for (let i = 0; i < 12; i++) s += c[i] * t.t[i];
      return s;
    })
  );
  const NB = sims.length;
  const penalty = 0.9;
  const scale = 10;
  let prev = new Float64Array(S);
  const bp = [];
  for (let b = 0; b < NB; b++) {
    const cur = new Float64Array(S);
    const ptr = new Int16Array(S);
    let bestPrev = 0;
    let bestIdx = 0;
    for (let s = 0; s < S; s++) if (prev[s] > prev[bestIdx]) bestIdx = s;
    bestPrev = prev[bestIdx];
    for (let s = 0; s < S; s++) {
      const stay = prev[s];
      const sw = bestPrev - penalty;
      cur[s] = sims[b][s] * scale + Math.max(stay, sw);
      ptr[s] = stay >= sw ? s : bestIdx;
    }
    bp.push(ptr);
    prev = cur;
  }
  const labels = new Array(NB);
  let s = 0;
  for (let i = 1; i < S; i++) if (prev[i] > prev[s]) s = i;
  for (let b = NB - 1; b >= 0; b--) {
    labels[b] = s;
    s = bp[b][s];
  }

  // premier temps de la mesure : là où les changements d'accords tombent le plus
  let downbeat = 0;
  let bestCount = -1;
  for (let ph = 0; ph < 4; ph++) {
    let cnt = 0;
    for (let b = 1; b < NB; b++) if (labels[b] !== labels[b - 1] && (b - ph) % 4 === 0) cnt++;
    if (cnt > bestCount) {
      bestCount = cnt;
      downbeat = ph;
    }
  }
  // regroupement par demi-mesure (2 temps), vote pondéré
  const blocks = [];
  const starts = [0];
  for (let b = downbeat === 0 ? 2 : downbeat; b < NB; b += 2) if (b > 0) starts.push(b);
  for (let i = 0; i < starts.length; i++) {
    const a = starts[i];
    const z = i + 1 < starts.length ? starts[i + 1] : NB;
    const tot = new Float64Array(S);
    let silent = true;
    for (let b = a; b < z; b++) {
      if (!beatSilent[b]) silent = false;
      for (let k = 0; k < S; k++) tot[k] += sims[b][k] + (labels[b] === k ? 0.15 : 0);
    }
    const order = [...tot.keys()].sort((p, q) => tot[q] - tot[p]);
    blocks.push({ a, z, chord: silent ? 'N' : T[order[0]].name, alts: order.slice(0, 4).map((k) => T[k].name) });
  }
  // fusion
  const segments = [];
  for (const bl of blocks) {
    const last = segments[segments.length - 1];
    if (last && last.chord === bl.chord) {
      last.z = bl.z;
      continue;
    }
    segments.push({ ...bl });
  }
  const out = segments.map((sg) => ({
    start: sg.a === 0 ? 0 : grid[sg.a],
    end: grid[Math.min(sg.z, grid.length - 1)],
    chord: sg.chord,
    alts: sg.alts,
    beats: sg.z - sg.a,
  }));
  if (out.length) out[out.length - 1].end = duration;

  // tonalité
  const tot = new Array(12).fill(0);
  beatChroma.forEach((c) => c.forEach((v, i) => (tot[i] += v)));
  let key = null;
  let kBest = -2;
  for (let r = 0; r < 12; r++) {
    const rot = (p) => tot.map((_, i) => tot[(i + r) % 12]);
    const ma = corr(rot(), KS_MAJ);
    const mi = corr(rot(), KS_MIN);
    if (ma > kBest) {
      kBest = ma;
      key = NAMES[r];
    }
    if (mi > kBest) {
      kBest = mi;
      key = NAMES[r] + 'm';
    }
  }
  progress(1, 'Terminé');
  return { duration, bpm: Math.round(bpm), beats: grid.slice(0, -1), downbeat, segments: out, key };
}

// ------------------------------------------------------------ mélodie (une note à la fois)
function analyzeMelody(x, sr, bpmGiven) {
  const W = 1024;
  const N = 2048;
  const hop = 256;
  const fft = getFFT(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const minLag = Math.floor(sr / 1400);
  const maxLag = Math.ceil(sr / 75);
  const frames = Math.max(0, Math.floor((x.length - W) / hop));
  const pitch = new Float64Array(frames);
  const rms = new Float64Array(frames);
  const nsdf = new Float64Array(maxLag + 2);
  for (let f = 0; f < frames; f++) {
    const o = f * hop;
    let e = 0;
    for (let i = 0; i < W; i++) {
      const v = x[o + i];
      re[i] = v;
      im[i] = 0;
      e += v * v;
    }
    for (let i = W; i < N; i++) re[i] = im[i] = 0;
    rms[f] = Math.sqrt(e / W);
    if (rms[f] < 0.01) {
      pitch[f] = 0;
      continue;
    }
    fft(re, im);
    for (let k = 0; k < N; k++) {
      re[k] = re[k] * re[k] + im[k] * im[k];
      im[k] = 0;
    }
    // transformée inverse (fft du conjugué) -> autocorrélation
    fft(re, im);
    // nsdf
    let m = 2 * e;
    for (let lag = 0; lag <= maxLag + 1 && lag < W; lag++) {
      if (lag > 0) m -= x[o + lag - 1] ** 2 + x[o + W - lag] ** 2;
      nsdf[lag] = m > 0 ? (2 * (re[lag] / N)) / m : 0;
    }
    let gmax = 0;
    for (let lag = minLag; lag <= maxLag; lag++) gmax = Math.max(gmax, nsdf[lag]);
    let bl = -1;
    for (let lag = minLag + 1; lag <= maxLag; lag++) {
      if (nsdf[lag] > nsdf[lag - 1] && nsdf[lag] >= nsdf[lag + 1] && nsdf[lag] > 0.88 * gmax) {
        bl = lag;
        break;
      }
    }
    if (bl < 0 || gmax < 0.6) {
      pitch[f] = 0;
      continue;
    }
    const a = nsdf[bl - 1];
    const b = nsdf[bl];
    const c = nsdf[bl + 1];
    const sh = (a - c) / (2 * (a - 2 * b + c) || 1);
    pitch[f] = 69 + 12 * Math.log2(sr / (bl + sh) / 440);
    if (f % 300 === 0) progress((0.8 * f) / frames, 'Écoute des notes…');
  }
  // médiane sur 5 trames
  const med = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    const w = [];
    for (let k = -2; k <= 2; k++) if (pitch[f + k]) w.push(pitch[f + k]);
    w.sort((p, q) => p - q);
    med[f] = w.length >= 3 ? w[w.length >> 1] : 0;
  }
  // segmentation en notes
  const dt = hop / sr;
  const notes = [];
  let cur = null;
  let cand = null;
  let candN = 0;
  const close = (f) => {
    if (cur && (f - cur.f0) * dt >= 0.06) notes.push({ midi: cur.midi, t0: cur.f0 * dt, t1: f * dt });
    cur = null;
  };
  for (let f = 0; f < frames; f++) {
    const m = med[f] ? Math.round(med[f]) : 0;
    const reattack = cur && f > 3 && rms[f] > 1.7 * rms[f - 3] && rms[f] > 0.02;
    if (!m) {
      if (cur && ++cur.gap > 3) close(f - cur.gap);
      continue;
    }
    if (cur && m === cur.midi && !reattack) {
      cur.gap = 0;
      continue;
    }
    if (cand === m) candN++;
    else {
      cand = m;
      candN = 1;
    }
    if (candN >= 3 || reattack) {
      close(f - candN + 1);
      cur = { midi: m, f0: f - candN + 1, gap: 0 };
      cand = null;
      candN = 0;
    }
  }
  close(frames);
  progress(0.9, 'Mise en rythme…');
  if (!notes.length) return { bpm: bpmGiven || 80, notes: [] };

  // tempo : fourni, ou estimé à partir des débuts de notes
  let bpm = bpmGiven;
  if (!bpm) {
    const fps = 100;
    const env = new Float64Array(Math.ceil(notes[notes.length - 1].t1 * fps) + 2);
    notes.forEach((n) => (env[Math.round(n.t0 * fps)] = 1));
    const rough = estimateTempo(env, fps, 50, 160).bpm;
    // affinage : le tempo qui aligne le mieux les débuts de notes sur une grille de croches
    const on = notes.map((n) => n.t0 - notes[0].t0);
    let best = rough;
    let bestErr = Infinity;
    for (let b = rough * 0.95; b <= rough * 1.05; b += 0.05) {
      const g = 60 / b / 2;
      const err = on.reduce((a, t) => a + Math.pow(t / g - Math.round(t / g), 2), 0) + Math.abs(b - Math.round(b)) * 0.01;
      if (err < bestErr) {
        bestErr = err;
        best = b;
      }
    }
    bpm = best;
  }
  const beat = 60 / bpm;
  const t0 = notes[0].t0;
  const q = (v) => Math.round(v * 4) / 4;
  let out = notes.map((n) => ({ midi: n.midi, start: q((n.t0 - t0) / beat), end: q((n.t1 - t0) / beat) }));
  out = out
    .map((n, i) => {
      const next = out[i + 1];
      let end = Math.max(n.end, n.start + 0.25);
      if (next && end > next.start) end = next.start;
      return { midi: n.midi, start: n.start, dur: Math.max(0.25, end - n.start) };
    })
    .filter((n, i, arr) => !(i > 0 && arr[i - 1].start === n.start));
  // ramener dans la tessiture du ukulélé (Do4 à La5)
  let bestShift = 0;
  let bestScore = -1;
  for (let k = -4; k <= 3; k++) {
    const med = [...out].map((n) => n.midi).sort((a, b) => a - b)[out.length >> 1] + 12 * k;
    const sc = out.reduce((a, n) => a + (n.midi + 12 * k >= 60 && n.midi + 12 * k <= 81 ? 1 : 0), 0) - Math.abs(med - 67) * 0.05;
    if (sc > bestScore) {
      bestScore = sc;
      bestShift = k;
    }
  }
  out.forEach((n) => (n.midi += 12 * bestShift));
  progress(1, 'Terminé');
  return { bpm: Math.round(bpm), notes: out, octaveShift: bestShift };
}
