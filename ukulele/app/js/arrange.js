// Niveau 2 « accords + mélodie » (fingerstyle) : la mélodie est placée automatiquement
// sur le manche, et l'accompagnement (joué au pouce) est généré à partir des formes d'accords.
import { STRINGS, noteAt, parseChord, mod12, SHARP } from './theory.js';
import { getVoicing } from './chords.js';

// ------------------------------------------------------------ notes
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteToMidi(tok) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  return (+m[3] + 1) * 12 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
export function midiToNote(m) {
  return SHARP[mod12(m)] + (Math.floor(m / 12) - 1);
}
const fmt = (x) => String(+x.toFixed(3));

// ------------------------------------------------------------ styles d'accompagnement
export const ACC_STYLES = [
  { id: 'none', name: 'Aucun (mélodie seule)' },
  { id: 'bass1', name: 'Une basse au début de chaque mesure' },
  { id: 'bass2', name: 'Une basse à chaque accord / temps 1 et 3' },
  { id: 'thumb', name: 'Pouce sur chaque temps' },
  { id: 'valse', name: 'Basse + accord (comme la main gauche du piano)' },
  { id: 'arp', name: 'Arpège en croches (avancé)' },
];

function accSlots(style, bpb) {
  const out = [];
  if (style === 'none') return out;
  if (style === 'bass1') out.push({ t: 0, prefs: [1, 0], n: 1 });
  if (style === 'bass2') {
    out.push({ t: 0, prefs: [1, 0], n: 1 });
    if (bpb === 4) out.push({ t: 2, prefs: [0, 1], n: 1 });
  }
  if (style === 'thumb') for (let b = 0; b < bpb; b++) out.push({ t: b, prefs: b % 2 ? [0, 1] : [1, 0], n: 1 });
  if (style === 'valse')
    for (let b = 0; b < bpb; b++) {
      const bass = bpb === 4 ? b % 2 === 0 : b === 0;
      out.push(bass ? { t: b, prefs: [1, 0], n: 1 } : { t: b, prefs: [0, 2, 1], n: 2 });
    }
  if (style === 'arp') {
    const cyc = [[1, 0], [0, 2], [2, 0], [0, 1]];
    for (let i = 0; i < bpb * 2; i++) out.push({ t: i / 2, prefs: cyc[i % 4], n: 1 });
  }
  return out;
}

// ------------------------------------------------------------ lecture d'un morceau
/**
 * piece : { title, bpm, beatsPerBar, chords: "Am C | G,Em …" (une mesure par mot, "A,B" = 2 accords),
 *           melody: "A4:1 C5:2 R:1 …", acc: 'bass2' }
 */
export function parsePiece(piece, { acc = piece.acc || 'bass2', transpose = 0 } = {}) {
  const bpb = piece.beatsPerBar || 4;
  // mélodie
  const melody = [];
  let t = 0;
  for (const tok of (piece.melody || '').trim().split(/\s+/).filter(Boolean)) {
    const [n, d] = tok.split(':');
    const dur = parseFloat(d) || 1;
    if (n !== 'R') {
      const midi = noteToMidi(n);
      if (midi !== null) melody.push({ midi: midi + transpose, start: t, dur });
    }
    t += dur;
  }
  const melTotal = t;
  // accords
  const tokens = (piece.chords || '').replace(/\|/g, ' ').trim().split(/\s+/).filter(Boolean);
  const nBars = Math.max(tokens.length, Math.ceil(melTotal / bpb - 0.001));
  const bars = [];
  const chordEvents = [];
  let prev = 'N';
  for (let b = 0; b < nBars; b++) {
    const tok = tokens[b] || '-';
    const parts = tok.split(',');
    const each = bpb / parts.length;
    const bar = { start: b * bpb, beats: bpb, chords: [] };
    parts.forEach((p, i) => {
      let name = p === '-' ? prev : p;
      if (name !== 'N' && name !== 'NC') {
        const c = parseChord(name);
        name = c ? c.name : 'N';
      } else name = 'N';
      prev = name;
      const ev = { name, start: b * bpb + i * each, dur: each };
      if (transpose && name !== 'N') {
        const c = parseChord(name);
        ev.name = SHARP[mod12(c.root + transpose)].replace('A#', 'Bb').replace('D#', 'Eb') + c.quality;
      }
      ev.voicing = ev.name === 'N' ? null : getVoicing(ev.name);
      bar.chords.push(ev);
      chordEvents.push(ev);
    });
    bars.push(bar);
  }
  const total = Math.max(melTotal, nBars * bpb);
  const chordAt = (time) => chordEvents.find((c) => time >= c.start - 1e-6 && time < c.start + c.dur - 1e-6) || null;

  // placement de la mélodie sur le manche
  let hand = 1;
  for (const n of melody) {
    const ch = chordAt(n.start);
    const shape = ch && ch.voicing ? ch.voicing.frets : null;
    let best = null;
    for (let s = 0; s < 4; s++) {
      const f = n.midi - STRINGS[s].midi;
      if (f < 0 || f > 12) continue;
      let cost = s === 0 ? 2.5 : s === 1 ? 1.6 : 0;
      if (f > 0) cost += 0.55 * Math.abs(f - hand);
      if (shape && shape[s] === f) cost -= 1.5;
      if (f > 7) cost += (f - 7) * 0.6;
      if (f === 0) cost -= 0.3;
      if (!best || cost < best.cost) best = { s, f, cost };
    }
    if (!best) {
      // hors tessiture : on ramène à l'octave jouable
      const m = n.midi < 60 ? n.midi + 12 * Math.ceil((60 - n.midi) / 12) : n.midi - 12 * Math.ceil((n.midi - 81) / 12);
      n.midi = m;
      const f = m - STRINGS[3].midi;
      best = f >= 0 ? { s: 3, f } : { s: 1, f: m - 60 };
    }
    n.string = best.s;
    n.fret = best.f;
    if (best.f > 0) hand = best.f;
  }

  // accompagnement
  const accNotes = [];
  const busy = (s, time) => melody.some((n) => n.string === s && n.start <= time + 0.01 && time < n.start + n.dur - 0.01);
  for (const bar of bars) {
    const slots = accSlots(acc, bpb).map((x) => ({ ...x, t: x.t + bar.start }));
    // une basse à chaque changement d'accord en cours de mesure
    if (acc !== 'none' && acc !== 'arp')
      bar.chords.slice(1).forEach((c) => {
        if (!slots.some((x) => Math.abs(x.t - c.start) < 0.01)) slots.push({ t: c.start, prefs: [1, 0], n: 1 });
      });
    slots.sort((a, b) => a.t - b.t);
    slots.forEach((slot, i) => {
      const ch = chordAt(slot.t);
      if (!ch || !ch.voicing) return;
      const next = slots[i + 1] ? slots[i + 1].t : bar.start + bpb;
      let placed = 0;
      for (const s of [...slot.prefs, 1, 0, 2]) {
        if (placed >= slot.n) break;
        if (accNotes.some((a) => a.start === slot.t && a.string === s)) continue;
        if (busy(s, slot.t)) continue;
        const f = ch.voicing.frets[s];
        if (f < 0) continue;
        accNotes.push({ midi: noteAt(s, f), string: s, fret: f, start: slot.t, dur: Math.max(0.5, next - slot.t), acc: true });
        placed++;
      }
    });
  }
  return { ...piece, beatsPerBar: bpb, bars, chordEvents, melody, acc: accNotes, accStyle: acc, total, chordAt };
}

/** Transforme une liste de notes {midi, start, dur} (en temps) en texte "A4:1 R:0.5 …". */
export function serializeMelody(notes) {
  const out = [];
  let t = 0;
  for (const n of [...notes].sort((a, b) => a.start - b.start)) {
    if (n.start > t + 0.01) out.push(`R:${fmt(n.start - t)}`);
    const start = Math.max(t, n.start);
    const dur = Math.max(0.25, n.start + n.dur - start);
    out.push(`${midiToNote(n.midi)}:${fmt(dur)}`);
    t = start + dur;
  }
  return out.join(' ');
}

// ------------------------------------------------------------ morceaux intégrés (domaine public)
export const PIECES = [
  {
    id: 'canon',
    title: 'Canon',
    composer: 'Johann Pachelbel (vers 1680)',
    level: 1,
    bpm: 66,
    beatsPerBar: 4,
    acc: 'bass2',
    desc: 'Le morceau idéal pour démarrer le niveau 2 : la mélodie descend tranquillement, une note par accord, puis s’anime.',
    chords: 'C,G Am,Em F,C F,G  C,G Am,Em F,C F,G  C,G Am,Em F,C F,G  C',
    melody: `E5:2 D5:2 C5:2 B4:2 A4:2 G4:2 A4:2 B4:2
             C5:2 B4:2 A4:2 G4:2 F4:2 E4:2 F4:2 G4:2
             E5:1 C5:1 D5:1 B4:1 C5:1 A4:1 B4:1 G4:1 A4:1 F4:1 G4:1 E4:1 F4:1 A4:1 G4:1 B4:1
             C5:4`,
  },
  {
    id: 'tetris',
    title: 'Korobeiniki (le thème de Tetris)',
    composer: 'Chanson populaire russe (XIXe siècle)',
    level: 2,
    bpm: 100,
    beatsPerBar: 4,
    acc: 'bass2',
    desc: 'Le célèbre thème de Tetris, en ré mineur : accords faciles (A7, Dm, Gm), mélodie rapide et entraînante.',
    chords: 'A7 Dm A7 Dm Gm Dm A7 Dm  Dm A7 Dm A7 Dm A7 Dm A7  A7 Dm A7 Dm Gm Dm A7 Dm',
    melody: `A4:1 E4:0.5 F4:0.5 G4:1 F4:0.5 E4:0.5  D4:1 D4:0.5 F4:0.5 A4:1 G4:0.5 F4:0.5
             E4:1.5 F4:0.5 G4:1 A4:1  F4:1 D4:1 D4:2
             R:0.5 G4:1 Bb4:0.5 D5:1 C5:0.5 Bb4:0.5  A4:1.5 F4:0.5 A4:1 G4:0.5 F4:0.5
             E4:1 E4:0.5 F4:0.5 G4:1 A4:1  F4:1 D4:1 D4:2
             A4:2 F4:2 G4:2 E4:2 F4:2 D4:2 C#4:2 E4:2
             A4:2 F4:2 G4:2 E4:2 F4:1 A4:1 D5:2 C#5:4
             A4:1 E4:0.5 F4:0.5 G4:1 F4:0.5 E4:0.5  D4:1 D4:0.5 F4:0.5 A4:1 G4:0.5 F4:0.5
             E4:1.5 F4:0.5 G4:1 A4:1  F4:1 D4:1 D4:2
             R:0.5 G4:1 Bb4:0.5 D5:1 C5:0.5 Bb4:0.5  A4:1.5 F4:0.5 A4:1 G4:0.5 F4:0.5
             E4:1 E4:0.5 F4:0.5 G4:1 A4:1  F4:1 D4:1 D4:2`,
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Traditionnel anglais (XVIe siècle)',
    level: 2,
    bpm: 84,
    beatsPerBar: 3,
    acc: 'valse',
    desc: 'Une ballade médiévale en la mineur, à 3 temps. Le refrain monte haut sur le manche : très joli au ukulélé.',
    chords: `Am Am C G Em Am E7 E7 Am Am C G Em Am E7 Am
             C G G Em Am E7 E7 E7 C G G Em Am E7 Am`,
    melody: `R:2 A4:1  C5:2 D5:1  E5:1.5 F5:0.5 E5:1  D5:2 B4:1  G4:1.5 A4:0.5 B4:1
             C5:2 A4:1  A4:1.5 G#4:0.5 A4:1  B4:2 G#4:1  E4:2 A4:1
             C5:2 D5:1  E5:1.5 F5:0.5 E5:1  D5:2 B4:1  G4:1.5 A4:0.5 B4:1
             C5:1.5 B4:0.5 A4:1  G#4:1.5 F#4:0.5 G#4:1  A4:3
             G5:3  G5:1.5 F#5:0.5 E5:1  D5:2 B4:1  G4:1.5 A4:0.5 B4:1
             C5:2 A4:1  A4:1.5 G#4:0.5 A4:1  B4:2 G#4:1  E4:3
             G5:3  G5:1.5 F#5:0.5 E5:1  D5:2 B4:1  G4:1.5 A4:0.5 B4:1
             C5:1.5 B4:0.5 A4:1  G#4:1.5 F#4:0.5 G#4:1  A4:3`,
  },
  {
    id: 'gymnopedie',
    title: 'Gymnopédie n°1',
    composer: 'Erik Satie (1888)',
    level: 2,
    bpm: 66,
    beatsPerBar: 3,
    acc: 'valse',
    desc: 'Lente et rêveuse : deux accords « majeur 7 » qui se balancent (comme la main gauche au piano) et une mélodie suspendue.',
    chords: 'Dmaj7 Amaj7 Dmaj7 Amaj7  Dmaj7 Amaj7 Dmaj7 Amaj7 Dmaj7 Amaj7  Dmaj7 Amaj7 Dmaj7 Amaj7 Dmaj7 Amaj7 Dmaj7',
    melody: `R:12
             R:1 C#5:1 E5:1  D5:1 C#5:1 G#4:1  F#4:1 G#4:1 A4:1  E4:3  C#4:3  C#4:3
             R:1 C#5:1 E5:1  D5:1 C#5:1 G#4:1  F#4:1 G#4:1 A4:1  E4:3  G#4:3  C#5:3  C#5:3`,
  },
  {
    id: 'entertainer',
    title: 'The Entertainer',
    composer: 'Scott Joplin (1902)',
    level: 3,
    bpm: 150,
    beatsPerBar: 4,
    acc: 'bass2',
    desc: 'Le ragtime le plus célèbre ! Syncopes et notes chromatiques (D, D♯, E) : un vrai défi rythmique. Ici, 1 temps = une croche.',
    chords: 'C C C G7 C C C D7 G7 C C G7 C',
    melody: `R:3 D4:0.5 D#4:0.5
             E4:0.5 C5:1 E4:0.5 C5:1 E4:0.5 C5:0.5  C5:2.5 C5:0.5 D5:0.5 D#5:0.5
             E5:0.5 C5:0.5 D5:0.5 E5:1 B4:0.5 D5:1  C5:3 D4:0.5 D#4:0.5
             E4:0.5 C5:1 E4:0.5 C5:1 E4:0.5 C5:0.5  C5:3 A4:0.5 G4:0.5
             F#4:0.5 A4:0.5 C5:0.5 E5:1 D5:0.5 C5:0.5 A4:0.5  D5:3 D4:0.5 D#4:0.5
             E4:0.5 C5:1 E4:0.5 C5:1 E4:0.5 C5:0.5  C5:2.5 C5:0.5 D5:0.5 D#5:0.5
             E5:0.5 C5:0.5 D5:0.5 E5:1 B4:0.5 D5:1  C5:4`,
  },
  {
    id: 'fur-elise',
    title: 'Lettre à Élise',
    composer: 'Ludwig van Beethoven (1810)',
    level: 3,
    bpm: 100,
    beatsPerBar: 3,
    acc: 'bass1',
    desc: 'Tu la connais sûrement au piano ! Les arpèges de la main gauche sont intégrés à la mélodie. Ici, 1 temps = une croche.',
    chords: 'N N Am E7 Am N Am E7 Am',
    melody: `R:2 E5:0.5 D#5:0.5
             E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5  A4:1 R:0.5 C4:0.5 E4:0.5 A4:0.5
             B4:1 R:0.5 E4:0.5 G#4:0.5 B4:0.5  C5:1 R:0.5 E4:0.5 E5:0.5 D#5:0.5
             E5:0.5 D#5:0.5 E5:0.5 B4:0.5 D5:0.5 C5:0.5  A4:1 R:0.5 C4:0.5 E4:0.5 A4:0.5
             B4:1 R:0.5 E4:0.5 C5:0.5 B4:0.5  A4:3`,
  },
];
