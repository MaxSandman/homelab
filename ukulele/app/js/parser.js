// "Traducteur" de chansons : accepte le format ChordPro ([C]paroles) ou le format
// "accords au-dessus des paroles" (copié depuis un site de tablatures) et produit
// une structure jouable par le lecteur.
import { parseChord, transposeChord, simplifyChord } from './theory.js';
import { chordDifficulty } from './chords.js';

const IGNORABLE = /^(\||\|\||\/|-+|x\d+|\(x?\d+x?\)|\d+x|n\.?c\.?|\(|\)|%|:\|\|?|\|\|?:|\.+|→)$/i;
const SECTION_WORDS =
  /^(intro|outro|couplet|refrain|pont|chorus|verse|bridge|pre-?chorus|pré-?refrain|solo|interlude|fin|ending|instrumental|coda)(\s*\d+)?(\s*[(]?x\s*\d+[)]?)?$/i;

function directive(line) {
  const m = /^\{\s*([\w-]+)\s*(?::\s*(.*?))?\s*\}$/.exec(line.trim());
  return m ? { key: m[1].toLowerCase(), value: (m[2] || '').trim() } : null;
}

/** Une ligne ne contient-elle que des accords (format "accords au-dessus") ? */
function isChordLine(line) {
  const toks = line.trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return false;
  let chords = 0;
  let odd = 0;
  for (const t of toks) {
    const clean = t.replace(/^\(|\)$/g, '');
    if (parseChord(clean)) chords++;
    else if (IGNORABLE.test(t)) continue;
    // mot inconnu court commençant par une majuscule (ex. accord exotique) : toléré
    else if (/^[A-G][^\s]{0,7}$/.test(clean)) odd++;
    else return false;
  }
  return chords > 0 && chords >= odd * 2;
}

function isTabLine(line) {
  return /^\s*[GCEAgcea]?\s*[|:][-\d|hpbr/\\~x ]{4,}$/.test(line);
}

function sectionLabel(line) {
  const t = line.trim();
  let m = /^\[([^\]]+)\]$/.exec(t);
  if (m && !parseChord(m[1])) return m[1].trim();
  m = /^\{\s*(c|comment|ci|soc|start_of_chorus|sov|start_of_verse|sob|start_of_bridge)\s*(?::\s*(.*?))?\s*\}$/i.exec(t);
  if (m) {
    const k = m[1].toLowerCase();
    if (m[2]) return m[2];
    if (k === 'soc' || k === 'start_of_chorus') return 'Refrain';
    if (k === 'sov' || k === 'start_of_verse') return 'Couplet';
    if (k === 'sob' || k === 'start_of_bridge') return 'Pont';
    return null;
  }
  const noColon = t.replace(/[:\s]+$/, '');
  if (SECTION_WORDS.test(noColon) && noColon.length < 24 && !/[,.!?]/.test(noColon)) return noColon;
  return undefined;
}

/** Convertit une ligne d'accords + une ligne de paroles en une ligne ChordPro. */
function mergeChordLyric(chordLine, lyric) {
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(chordLine))) {
    const clean = m[0].replace(/^\(|\)$/g, '');
    if (parseChord(clean) || /^[A-G][^\s]{0,7}$/.test(clean)) tokens.push({ pos: m.index, chord: clean });
  }
  let text = lyric || '';
  const maxPos = tokens.length ? tokens[tokens.length - 1].pos : 0;
  if (text.length < maxPos) text = text.padEnd(maxPos, ' ');
  let out = '';
  let last = 0;
  for (const t of tokens) {
    // éviter de couper un mot en plein milieu si l'accord tombe juste avant
    out += text.slice(last, t.pos) + `[${t.chord}]`;
    last = t.pos;
  }
  out += text.slice(last);
  return out.replace(/\s+$/, '');
}

/** Transforme n'importe quel texte collé en source ChordPro propre. */
export function toChordPro(text) {
  const lines = text.replace(/\r/g, '').replace(/\t/g, '    ').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      out.push('');
      continue;
    }
    if (directive(line) || /\[[^\]]+\]/.test(line)) {
      out.push(line.trimEnd());
      continue;
    }
    if (isTabLine(line)) continue;
    const label = sectionLabel(line);
    if (label !== undefined && label !== null && !isChordLine(line)) {
      out.push(`{c: ${label}}`);
      continue;
    }
    if (isChordLine(line)) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() && !isChordLine(next) && !directive(next) && sectionLabel(next) === undefined && !isTabLine(next)) {
        out.push(mergeChordLyric(line, next));
        i++;
      } else {
        out.push(
          line
            .trim()
            .split(/\s+/)
            .map((t) => t.replace(/^\(|\)$/g, ''))
            .filter((t) => parseChord(t) || /^[A-G][^\s]{0,7}$/.test(t))
            .map((t) => `[${t}]`)
            .join(' ')
        );
      }
      continue;
    }
    out.push(line.trimEnd());
  }
  // compacter les lignes vides multiples
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Analyse une source ChordPro. Retourne :
 * { title, artist, bpm, beatsPerBar, pattern, beatsPerChord, sections:[{label, lines:[[{chord, beats, text}]]}],
 *   chords:[...], unknown:[...] }
 */
export function parseSong(source, { transpose = 0, simplify = false } = {}) {
  const song = {
    title: '',
    artist: '',
    bpm: 80,
    beatsPerBar: 4,
    beatsPerChord: null,
    pattern: null,
    level: null,
    key: null,
    sections: [],
    chords: [],
    unknown: [],
    notes: '',
  };
  let section = { label: '', lines: [] };
  song.sections.push(section);
  const chordSet = new Set();
  const unknown = new Set();
  const conv = (c) => {
    let n = c;
    if (simplify) n = bestSimple(n);
    return transposeChord(n, transpose);
  };

  for (const raw of source.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const d = directive(line);
    const label = sectionLabel(line);
    if (label !== undefined) {
      if (label) {
        section = { label, lines: [] };
        song.sections.push(section);
      }
      continue;
    }
    if (d) {
      const v = d.value;
      switch (d.key) {
        case 't': case 'title': song.title = v; break;
        case 'st': case 'subtitle': case 'artist': case 'a': song.artist = v; break;
        case 'tempo': case 'bpm': song.bpm = Math.max(30, Math.min(220, parseInt(v, 10) || 80)); break;
        case 'time': {
          const m = /^(\d+)\s*\/\s*\d+/.exec(v);
          if (m) song.beatsPerBar = Math.max(2, Math.min(6, +m[1]));
          break;
        }
        case 'beats': case 'beats_per_chord': song.beatsPerChord = Math.max(1, parseInt(v, 10) || 4); break;
        case 'strum': case 'rythme': case 'pattern': song.pattern = v; break;
        case 'level': case 'niveau': song.level = parseInt(v, 10) || null; break;
        case 'key': song.key = v; break;
        case 'note': case 'notes': song.notes = v; break;
        case 'eoc': case 'end_of_chorus': case 'eov': case 'end_of_verse': case 'eob': case 'end_of_bridge':
          section = { label: '', lines: [] };
          song.sections.push(section);
          break;
        default: break;
      }
      continue;
    }
    if (!line.trim()) {
      section.lines.push(null); // ligne vide = respiration visuelle
      continue;
    }
    // découpage en segments [accord]texte
    const segs = [];
    const re = /\[([^\]]+)\]/g;
    let m;
    let last = 0;
    let pre = '';
    const parts = [];
    while ((m = re.exec(line))) {
      parts.push({ idx: m.index, end: re.lastIndex, tok: m[1] });
    }
    if (!parts.length) {
      segs.push({ chord: null, beats: 0, text: line });
    } else {
      pre = line.slice(0, parts[0].idx);
      if (pre) segs.push({ chord: null, beats: 0, text: pre });
      parts.forEach((p, i) => {
        const text = line.slice(p.end, i + 1 < parts.length ? parts[i + 1].idx : line.length);
        let tok = p.tok.trim();
        let beats = null;
        const bm = /^(.*?)\s*[:*]\s*(\d+(?:\.\d+)?)$/.exec(tok);
        if (bm) {
          tok = bm[1];
          beats = parseFloat(bm[2]);
        }
        if (parseChord(tok)) {
          const name = conv(parseChord(tok).name);
          chordSet.add(name);
          segs.push({ chord: name, beats, text });
        } else {
          unknown.add(tok);
          segs.push({ chord: null, beats: 0, text: `${text}`, bad: tok });
        }
        last = p.end;
      });
    }
    section.lines.push(segs);
  }
  // durée par défaut = une mesure
  const def = song.beatsPerChord || song.beatsPerBar;
  for (const s of song.sections)
    for (const l of s.lines) if (l) for (const seg of l) if (seg.chord && seg.beats == null) seg.beats = def;
  song.sections = song.sections.filter((s) => s.lines.some((l) => l));
  song.sections.forEach((s) => {
    while (s.lines.length && !s.lines[0]) s.lines.shift();
    while (s.lines.length && !s.lines[s.lines.length - 1]) s.lines.pop();
  });
  song.chords = [...chordSet];
  song.unknown = [...unknown];
  return song;
}

function bestSimple(name) {
  const s = simplifyChord(name);
  return chordDifficulty(s) < chordDifficulty(name) ? s : name;
}

/** Construit la ligne du temps : [{chord, start, beats, li, si}] + infos de lignes. */
export function buildTimeline(song) {
  const events = [];
  const lines = [];
  let pos = 0;
  song.sections.forEach((sec, sIdx) => {
    sec.lines.forEach((l, lIdx) => {
      if (!l) return;
      const line = { sIdx, lIdx, start: pos, segs: [] };
      l.forEach((seg) => {
        const s = { ...seg, ev: -1 };
        if (seg.chord && seg.beats > 0) {
          s.ev = events.length;
          events.push({ chord: seg.chord, start: pos, beats: seg.beats, line: lines.length });
          pos += seg.beats;
        }
        line.segs.push(s);
      });
      line.end = pos;
      lines.push(line);
    });
  });
  return { events, lines, total: pos };
}

/** Score de difficulté global d'une chanson (somme des accords différents). */
export function songDifficulty(chords) {
  return chords.reduce((a, c) => a + chordDifficulty(c), 0);
}

/** Cherche la transposition qui donne les accords les plus faciles. */
export function easiestTranspose(chords) {
  let best = { t: 0, score: songDifficulty(chords) };
  for (let t = -6; t <= 6; t++) {
    const tr = chords.map((c) => transposeChord(c, t));
    const sc = songDifficulty(tr) + Math.abs(t) * 0.05;
    if (sc < best.score - 0.01) best = { t, score: sc, chords: tr };
  }
  best.chords ||= chords;
  return best;
}

/** Applique transposition/simplification à une source ChordPro (pour l'enregistrer). */
export function rewriteSource(source, { transpose = 0, simplify = false } = {}) {
  if (!transpose && !simplify) return source;
  return source
    .split('\n')
    .map((line) => {
      if (directive(line) || sectionLabel(line) !== undefined) return line;
      return line.replace(/\[([^\]]+)\]/g, (all, tok) => {
        const bm = /^(.*?)(\s*[:*]\s*\d+(?:\.\d+)?)?$/.exec(tok.trim());
        const c = parseChord(bm[1]);
        if (!c) return all;
        let n = c.name;
        if (simplify) n = bestSimple(n);
        return `[${transposeChord(n, transpose)}${bm[2] || ''}]`;
      });
    })
    .join('\n');
}

/** Met à jour (ou ajoute) une directive {clé: valeur} en tête de source. */
export function setDirective(source, key, value) {
  const re = new RegExp(`^\\{\\s*${key}\\s*:.*\\}$`, 'mi');
  const line = `{${key}: ${value}}`;
  if (re.test(source)) return source.replace(re, value === '' ? '' : line).replace(/^\n+/, '');
  if (value === '' || value == null) return source;
  return `${line}\n${source}`;
}
