// Dictionnaire de positions d'accords pour ukulélé GCEA + recherche automatique.
import { parseChord, noteAt, mod12, STRINGS } from './theory.js';

// Format : 'cases/doigts' pour les cordes G C E A (0 = corde à vide).
// Doigts : 1 index, 2 majeur, 3 annulaire, 4 auriculaire. Même doigt sur plusieurs cordes = barré.
const RAW = {
  C: '0003/0003', Cm: '0333/0123', C7: '0001/0001', Cm7: '3333/1111', Cmaj7: '0002/0002',
  C6: '0000/0000', Csus4: '0013/0013', Csus2: '0233/0123', Cadd9: '0203/0102', Caug: '1003/1004',
  'C#': '1114/1114', 'C#m': '1104/1204', 'C#7': '1112/1112',
  D: '2220/1230', Dm: '2210/2310', D7: '2020/1020', Dm7: '2213/2314', Dmaj7: '2224/1113',
  Dsus4: '0230/0120', Dsus2: '2200/1200',
  Eb: '0331/0231', Ebm: '3321/3421', Eb7: '3334/1112',
  E: '1402/1402', Em: '0432/0321', E7: '1202/1203', Em7: '0202/0102', Emaj7: '1302/1302',
  Esus4: '2402/1302',
  F: '2010/2010', Fm: '1013/1024', F7: '2313/2314', Fmaj7: '2410/2410', Fm7: '1313/1314',
  'F#': '3121/3121', 'F#m': '2120/2130', 'F#7': '3424/1324', 'F#m7': '2424/1324',
  G: '0232/0132', Gm: '0231/0231', G7: '0212/0213', Gm7: '0211/0211', Gmaj7: '0222/0123',
  Gsus4: '0233/0123', G6: '0202/0102',
  Ab: '5343/3121', Abm: '4342/3241', Ab7: '1323/1324',
  A: '2100/2100', Am: '2000/2000', A7: '0100/0100', Am7: '0000/0000', Amaj7: '1100/1200',
  Asus4: '2200/1200',
  Bb: '3211/3211', Bbm: '3111/3111', Bb7: '1211/1211', Bbmaj7: '3210/3210',
  B: '4322/3211', Bm: '4222/3111', B7: '2322/1211', Bm7: '2222/1111',
};

// Les enharmonies (C# = Db, etc.) partagent les mêmes positions.
const SHAPES = new Map();
for (const [name, def] of Object.entries(RAW)) {
  const c = parseChord(name);
  const [f, d] = def.split('/');
  SHAPES.set(`${c.root}:${c.quality}`, {
    frets: [...f].map(Number),
    fingers: [...d].map(Number),
    source: 'dico',
  });
}

/** Attribue des doigts à une position trouvée automatiquement. */
function assignFingers(frets) {
  const fretted = frets
    .map((f, s) => ({ f, s }))
    .filter((x) => x.f > 0)
    .sort((a, b) => a.f - b.f || a.s - b.s);
  const fingers = [0, 0, 0, 0];
  if (!fretted.length) return fingers;
  const min = fretted[0].f;
  const atMin = fretted.filter((x) => x.f === min);
  let next = 1;
  if (fretted.length === 4 || (atMin.length >= 2 && fretted.length > 3)) {
    atMin.forEach((x) => (fingers[x.s] = 1));
    next = 2;
    fretted.filter((x) => x.f !== min).forEach((x) => (fingers[x.s] = Math.min(4, next++)));
  } else {
    fretted.forEach((x) => (fingers[x.s] = Math.min(4, next++)));
  }
  return fingers;
}

/** Note de difficulté d'une position (plus c'est haut, plus c'est dur). */
export function voicingDifficulty(v) {
  const fretted = v.frets.filter((f) => f > 0);
  if (!fretted.length) return 0.5;
  const min = Math.min(...fretted);
  const max = Math.max(...fretted);
  const span = max - min;
  const used = new Set(v.fingers.filter((x) => x > 0));
  const barre = used.size < fretted.length;
  let d = used.size + Math.max(0, span - 1) + (barre ? 1 : 0);
  if (min >= 4) d += 1.5;
  if (max >= 5) d += 0.5;
  return d;
}

export function stars(d) {
  if (d <= 2) return 1;
  if (d <= 3) return 2;
  if (d <= 4.5) return 3;
  return 4;
}

/** Recherche automatique de positions pour les accords absents du dictionnaire. */
function findVoicings(chord, limit = 4) {
  const pcs = new Set(chord.pcs);
  const req = chord.required;
  const res = [];
  const MAX = 9;
  for (let a = 0; a <= MAX; a++)
    for (let b = 0; b <= MAX; b++)
      for (let c = 0; c <= MAX; c++)
        for (let d = 0; d <= MAX; d++) {
          const frets = [a, b, c, d];
          const notes = frets.map((f, s) => mod12(noteAt(s, f)));
          if (!notes.every((n) => pcs.has(n))) continue;
          const set = new Set(notes);
          if (!req.every((r) => set.has(r))) continue;
          const fr = frets.filter((f) => f > 0);
          const span = fr.length ? Math.max(...fr) - Math.min(...fr) : 0;
          if (span > 3) continue;
          const v = { frets, fingers: assignFingers(frets), source: 'auto' };
          let score = voicingDifficulty(v) + (fr.length ? Math.max(...fr) * 0.25 : 0);
          if (chord.bass !== null && mod12(noteAt(1, b)) !== chord.bass) score += 0.3;
          if (!set.has(chord.root)) score += 5;
          v.score = score;
          res.push(v);
        }
  res.sort((x, y) => x.score - y.score);
  return res.slice(0, limit);
}

const voicingCache = new Map();

/** Toutes les positions connues/calculées pour un accord, la plus simple d'abord. */
export function getVoicings(name) {
  if (voicingCache.has(name)) return voicingCache.get(name);
  const c = parseChord(name);
  let list = [];
  if (c) {
    const known = SHAPES.get(`${c.root}:${c.quality}`);
    if (known) list.push(known);
    for (const v of findVoicings(c, 5)) {
      if (!list.some((k) => k.frets.join() === v.frets.join())) list.push(v);
    }
    list = list.slice(0, 4);
  }
  voicingCache.set(name, list);
  return list;
}

export function getVoicing(name) {
  return getVoicings(name)[0] || null;
}

export function chordDifficulty(name) {
  const v = getVoicing(name);
  return v ? voicingDifficulty(v) : 99;
}

/** Notes MIDI à jouer pour une position (pour le son). */
export function voicingMidis(v) {
  return v ? v.frets.map((f, s) => (f >= 0 ? STRINGS[s].midi + f : null)).filter((x) => x !== null) : [];
}

// Accords "essentiels" dans l'ordre d'apprentissage conseillé.
export const ESSENTIALS = ['C', 'Am', 'F', 'G7', 'G', 'C7', 'A7', 'Am7', 'Em', 'Dm', 'D', 'A', 'E7', 'D7', 'Bb', 'Em7'];

export const CHORD_TIPS = {
  C: 'Un seul doigt ! L’annulaire (3) sur la 3e case de la corde de La (la plus fine, en bas).',
  Am: 'Le majeur (2) sur la 2e case de la corde de Sol (la plus proche de ton visage).',
  F: 'Deux doigts : l’index (1) sur la corde de Mi case 1, le majeur (2) sur la corde de Sol case 2. Facile depuis La mineur : ajoute juste l’index !',
  G7: 'Trois doigts en petit triangle : index case 1 (Mi), majeur case 2 (Do), annulaire case 2 (La).',
  G: 'Trois doigts en triangle : index case 2 (Do), majeur case 2 (La), annulaire case 3 (Mi). Le plus dur des 4 accords magiques, prends ton temps.',
  C7: 'Un seul doigt : l’index sur la 1re case de la corde de La.',
  A7: 'Un seul doigt : l’index sur la 1re case de la corde de Do.',
  Am7: 'Aucun doigt ! Gratte simplement les 4 cordes à vide.',
  Em: 'Index case 2 (La), majeur case 3 (Mi), annulaire case 4 (Do). Les doigts forment une diagonale.',
  Dm: 'Comme F mais avec l’annulaire en plus sur la corde de Do, case 2.',
  D: 'Trois doigts côte à côte sur la case 2 (Sol, Do, Mi). Astuce : tu peux aussi faire un petit barré avec l’index.',
  A: 'Majeur case 2 (Sol) et index case 1 (Do).',
  E7: 'Index case 1 (Sol), majeur case 2 (Do), annulaire case 2 (La).',
  D7: 'Index case 2 (Sol) et majeur case 2 (Mi), les cordes de Do et La restent à vide.',
  Bb: 'Accord avec barré : l’index couche les cordes de Mi et La en case 1. Garde-le pour plus tard !',
  Em7: 'Deux doigts : index case 2 sur la corde de Do, majeur case 2 sur la corde de La.',
};
