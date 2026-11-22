// Théorie musicale : notes, cordes du ukulélé, accords, transposition.

export const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const FR_LETTER = { C: 'Do', D: 'Ré', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Accordage standard GCEA "ré-entrant" : la corde de Sol est aiguë (G4).
// Index 0..3 = ordre des cordes de gauche à droite sur un diagramme d'accord.
export const STRINGS = [
  { id: 0, name: 'G', fr: 'Sol', midi: 67 },
  { id: 1, name: 'C', fr: 'Do', midi: 60 },
  { id: 2, name: 'E', fr: 'Mi', midi: 64 },
  { id: 3, name: 'A', fr: 'La', midi: 69 },
];
export const STRING_INDEX = { G: 0, C: 1, E: 2, A: 3 };

export const mod12 = (n) => ((n % 12) + 12) % 12;
export const noteAt = (s, fret) => STRINGS[s].midi + fret;
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const pcToName = (pc, flat = false) => (flat ? FLAT : SHARP)[mod12(pc)];

/** 'C#' -> 'Do♯', 'Bb' -> 'Si♭' */
export function frenchOf(name) {
  const m = /^([A-G])([#b]?)/.exec(name);
  if (!m) return name;
  return FR_LETTER[m[1]] + (m[2] === '#' ? '♯' : m[2] === 'b' ? '♭' : '');
}

/** Remplace # et b (altérations) par les vrais symboles, sans toucher au "b5" des suffixes. */
export function pretty(name) {
  if (!name) return '';
  return name
    .replace(/^([A-G])#/, '$1♯')
    .replace(/^([A-G])b/, '$1♭')
    .replace(/\/([A-G])#/, '/$1♯')
    .replace(/\/([A-G])b/, '/$1♭');
}

/** Nom d'une note selon le réglage : 'fr' | 'en' | 'both' */
export function noteLabel(pcOrName, mode = 'both', flat = false) {
  const en = typeof pcOrName === 'number' ? pcToName(pcOrName, flat) : pcOrName;
  const fr = frenchOf(en);
  if (mode === 'fr') return fr;
  if (mode === 'en') return pretty(en);
  return `${fr} (${pretty(en)})`;
}

// ---------------------------------------------------------------- Accords

export const QUALITIES = {
  '': { iv: [0, 4, 7], fr: 'majeur' },
  m: { iv: [0, 3, 7], fr: 'mineur' },
  '7': { iv: [0, 4, 7, 10], req: [0, 4, 10], fr: 'septième' },
  m7: { iv: [0, 3, 7, 10], req: [0, 3, 10], fr: 'mineur septième' },
  maj7: { iv: [0, 4, 7, 11], req: [0, 4, 11], fr: 'majeur septième' },
  '6': { iv: [0, 4, 7, 9], req: [0, 4, 9], fr: 'sixte' },
  m6: { iv: [0, 3, 7, 9], req: [0, 3, 9], fr: 'mineur sixte' },
  '9': { iv: [0, 4, 7, 10, 2], req: [0, 4, 10, 2], fr: 'neuvième' },
  m9: { iv: [0, 3, 7, 10, 2], req: [0, 3, 10, 2], fr: 'mineur neuvième' },
  maj9: { iv: [0, 4, 7, 11, 2], req: [0, 4, 11, 2], fr: 'majeur neuvième' },
  add9: { iv: [0, 4, 7, 2], req: [0, 4, 2], fr: 'add9' },
  sus2: { iv: [0, 2, 7], fr: 'sus2' },
  sus4: { iv: [0, 5, 7], fr: 'sus4' },
  '7sus4': { iv: [0, 5, 7, 10], req: [0, 5, 10], fr: 'septième sus4' },
  dim: { iv: [0, 3, 6], fr: 'diminué' },
  dim7: { iv: [0, 3, 6, 9], fr: 'diminué septième' },
  m7b5: { iv: [0, 3, 6, 10], fr: 'demi-diminué' },
  aug: { iv: [0, 4, 8], fr: 'augmenté' },
  '5': { iv: [0, 7], fr: 'quinte (power chord)' },
};

const ALIASES = {
  M: '', maj: '', major: '', min: 'm', mi: 'm', '-': 'm', minor: 'm',
  min7: 'm7', mi7: 'm7', '-7': 'm7',
  M7: 'maj7', Maj7: 'maj7', ma7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', '7M': 'maj7', j7: 'maj7',
  M9: 'maj9', Maj9: 'maj9',
  min6: 'm6', '-6': 'm6',
  sus: 'sus4', '4': 'sus4', '2': 'sus2', add2: 'add9', '(add9)': 'add9', add: 'add9',
  '7sus': '7sus4', sus7: '7sus4', '7sus2': '7sus4',
  '°': 'dim', o: 'dim', '°7': 'dim7', o7: 'dim7',
  'ø': 'm7b5', 'ø7': 'm7b5', 'm7-5': 'm7b5', 'm7(b5)': 'm7b5', '-7b5': 'm7b5',
  '+': 'aug', '+5': 'aug', '#5': 'aug',
  '7(9)': '9', '79': '9',
};

const FR_ROOTS = [['Sol', 7], ['Do', 0], ['Ré', 2], ['Re', 2], ['Mi', 4], ['Fa', 5], ['La', 9], ['Si', 11]];

function parseRoot(s) {
  // noms français d'abord (sinon « Do » serait lu comme « D » + « o » = D diminué)
  for (const [fr, pc] of FR_ROOTS) {
    if (s.startsWith(fr)) {
      let len = fr.length;
      const accCh = s[len];
      const acc = accCh === '#' ? 1 : accCh === 'b' ? -1 : 0;
      if (acc) len++;
      const p = mod12(pc + acc);
      return { pc: p, name: pcToName(p, acc < 0), len, flat: acc < 0 };
    }
  }
  const m = /^([A-G])([#b]?)/.exec(s);
  if (m) {
    const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
    return { pc: mod12(LETTER_PC[m[1]] + acc), name: m[1] + m[2], len: m[0].length, flat: acc < 0 };
  }
  return null;
}

const chordCache = new Map();

/**
 * Analyse un nom d'accord ("Am7", "F#m", "Bb/D", "Lam", "Sol7"...).
 * Retourne null si ce n'est pas un accord reconnu.
 */
export function parseChord(raw) {
  if (!raw) return null;
  const key = raw;
  if (chordCache.has(key)) return chordCache.get(key);
  const s = raw.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  let res = null;
  const root = parseRoot(s);
  if (root) {
    let rest = s.slice(root.len);
    let bass = null;
    const sl = rest.lastIndexOf('/');
    let ok = true;
    if (sl >= 0) {
      const b = parseRoot(rest.slice(sl + 1));
      if (b && b.len === rest.length - sl - 1) {
        bass = b;
        rest = rest.slice(0, sl);
      } else ok = false;
    }
    if (ok) {
      let q = rest;
      if (q in ALIASES) q = ALIASES[q];
      if (q in QUALITIES) {
        const Q = QUALITIES[q];
        res = {
          root: root.pc,
          rootName: root.name,
          flat: root.flat,
          quality: q,
          bass: bass ? bass.pc : null,
          bassName: bass ? bass.name : null,
          name: root.name + q + (bass ? '/' + bass.name : ''),
          pcs: [...new Set(Q.iv.map((i) => mod12(root.pc + i)))],
          required: [...new Set((Q.req || Q.iv).map((i) => mod12(root.pc + i)))],
          fr: frenchOf(root.name) + ' ' + Q.fr + (bass ? ' / basse ' + frenchOf(bass.name) : ''),
        };
      }
    }
  }
  chordCache.set(key, res);
  return res;
}

export const isChord = (s) => !!parseChord(s);

const FLAT_KEYS = new Set([5, 10, 3, 8, 1]); // F, Bb, Eb, Ab, Db

/** Transpose un accord de `semis` demi-tons. */
export function transposeChord(name, semis, preferFlat = null) {
  const c = parseChord(name);
  if (!c) return name;
  if (!semis) return c.name;
  const r = mod12(c.root + semis);
  const flat = preferFlat ?? FLAT_KEYS.has(r);
  let out = pcToName(r, flat) + c.quality;
  if (c.bass !== null) out += '/' + pcToName(c.bass + semis, flat);
  return out;
}

/** Version simplifiée d'un accord (Cmaj9 -> C, Am9 -> Am7, Bb/D -> Bb...). */
export function simplifyChord(name) {
  const c = parseChord(name);
  if (!c) return name;
  const map = {
    maj7: '', maj9: '', add9: '', '6': '', sus2: '', sus4: '', '5': '',
    '9': '7', '7sus4': '7', m9: 'm7', m6: 'm', dim7: 'dim',
  };
  const q = c.quality in map ? map[c.quality] : c.quality;
  return c.rootName + q;
}

/** Description d'une note midi */
export function midiInfo(midi, flat = false) {
  const pc = mod12(midi);
  const name = pcToName(pc, flat);
  return { pc, name, octave: Math.floor(midi / 12) - 1, fr: frenchOf(name) };
}

/** Position la plus simple pour jouer une note (corde, case), en restant bas sur le manche. */
export function positionsForMidi(midi, maxFret = 12) {
  const out = [];
  STRINGS.forEach((s, i) => {
    const f = midi - s.midi;
    if (f >= 0 && f <= maxFret) out.push({ string: i, fret: f });
  });
  return out.sort((a, b) => a.fret - b.fret);
}
