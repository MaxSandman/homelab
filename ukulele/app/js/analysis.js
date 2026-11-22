// Décodage des fichiers audio + lancement de l'analyse en arrière-plan + stockage local (IndexedDB).
import { getCtx } from './audio.js';

export const ANALYSIS_SR = 22050;

/** Décode un fichier (mp3, m4a, wav, ogg…) en mono 22 050 Hz. */
export async function decodeToMono(blob, maxSeconds = 600) {
  const ctx = getCtx();
  const data = await blob.arrayBuffer();
  const buf = await new Promise((res, rej) => {
    const p = ctx.decodeAudioData(data, res, rej);
    if (p && p.then) p.then(res, rej);
  });
  const dur = Math.min(buf.duration, maxSeconds);
  const off = new OfflineAudioContext(1, Math.ceil(dur * ANALYSIS_SR), ANALYSIS_SR);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start();
  const out = await off.startRendering();
  return { samples: out.getChannelData(0), duration: buf.duration, truncated: buf.duration > maxSeconds };
}

/** Lance l'analyse ('chords' ou 'melody'). onProgress(p 0..1, message). */
export function analyze(type, samples, { bpm = null, onProgress = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./analysis-worker.js', import.meta.url));
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.p, m.msg);
      else {
        w.terminate();
        m.type === 'done' ? resolve(m.result) : reject(new Error(m.message));
      }
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || 'Erreur d’analyse'));
    };
    const copy = new Float32Array(samples);
    w.postMessage({ type, samples: copy, sr: ANALYSIS_SR, bpm }, [copy.buffer]);
  });
}

// ------------------------------------------------------------ IndexedDB (morceaux + fichiers audio)
const DB = 'ukulele';
function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('tracks', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('tracks', mode);
    const store = t.objectStore('tracks');
    const req = fn(store);
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
  });
}
export const tracks = {
  put: (track) => tx('readwrite', (s) => s.put(track)),
  get: (id) => tx('readonly', (s) => s.get(id)),
  delete: (id) => tx('readwrite', (s) => s.delete(id)),
  list: async () => {
    const all = (await tx('readonly', (s) => s.getAll())) || [];
    return all.map(({ blob, ...rest }) => rest).sort((a, b) => b.created - a.created);
  },
};
