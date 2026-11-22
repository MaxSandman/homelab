// Composants graphiques : diagrammes d'accords, manche interactif, petits utilitaires.
import { STRINGS, noteAt, midiInfo, frenchOf, pretty, parseChord } from './theory.js';
import { getVoicing, voicingDifficulty, stars, voicingMidis } from './chords.js';
import { store } from './store.js';
import { playNote, strum } from './audio.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const FINGER_NAMES = { 1: 'Index', 2: 'Majeur', 3: 'Annulaire', 4: 'Auriculaire' };
export const STRING_CLASS = ['sg', 'sc', 'se', 'sa'];

export function starsHtml(n, max = 4) {
  return `<span class="stars" title="Difficulté ${n}/${max}">${'★'.repeat(n)}<span class="off">${'★'.repeat(max - n)}</span></span>`;
}

export function chordStars(name) {
  const v = getVoicing(name);
  return v ? stars(voicingDifficulty(v)) : 4;
}

/** Nom d'accord affiché : "Am" + "La mineur". */
export function chordLabel(name) {
  const c = parseChord(name);
  return { main: pretty(name), sub: c ? c.fr : 'accord inconnu' };
}

export function noteName(midi, mode = store.settings.names, full = false) {
  const i = midiInfo(midi);
  if (mode === 'fr') return i.fr;
  if (mode === 'en') return pretty(i.name);
  return full ? `${i.fr} (${pretty(i.name)})` : i.fr;
}

/**
 * Diagramme d'accord vertical (cordes G C E A de gauche à droite, comme sur tous les sites).
 */
export function chordDiagram(name, { voicing = null, size = 'md', title = true, play = false } = {}) {
  const v = voicing || getVoicing(name);
  const W = 140;
  const H = 180;
  const left = 25;
  const right = W - 25;
  const top = title ? 48 : 22;
  const nFrets = 4;
  const fretH = 26;
  const gap = (right - left) / 3;
  if (!v) {
    return `<div class="diagram ${size} unknown"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Accord inconnu">
      ${title ? `<text x="${W / 2}" y="28" class="d-title">${esc(pretty(name))}</text>` : ''}
      <text x="${W / 2}" y="${top + 50}" class="d-unknown">?</text></svg></div>`;
  }
  const fretted = v.frets.filter((f) => f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 1;
  const base = maxF > nFrets ? minF : 1;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagramme ${esc(name)}">`;
  if (title) s += `<text x="${W / 2}" y="28" class="d-title">${esc(pretty(name))}</text>`;
  // frettes
  for (let i = 0; i <= nFrets; i++) {
    const y = top + i * fretH;
    s += `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="${i === 0 && base === 1 ? 'd-nut' : 'd-fret'}"/>`;
  }
  if (base > 1) s += `<text x="${left - 8}" y="${top + fretH / 2 + 5}" class="d-base">${base}</text>`;
  // cordes
  STRINGS.forEach((st, i) => {
    const x = left + i * gap;
    s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + nFrets * fretH}" class="d-string"/>`;
    s += `<text x="${x}" y="${top + nFrets * fretH + 20}" class="d-sname ${STRING_CLASS[i]}">${st.name}</text>`;
    if (v.frets[i] === 0) s += `<circle cx="${x}" cy="${top - 10}" r="5" class="d-open"/>`;
    if (v.frets[i] < 0) s += `<text x="${x}" y="${top - 5}" class="d-mute">×</text>`;
  });
  // barrés
  const byFinger = {};
  v.frets.forEach((f, i) => {
    if (f > 0 && v.fingers[i]) (byFinger[v.fingers[i] + ':' + f] ||= []).push(i);
  });
  for (const [k, strs] of Object.entries(byFinger)) {
    if (strs.length < 2) continue;
    const [finger, f] = k.split(':').map(Number);
    const y = top + (f - base + 0.5) * fretH;
    const x1 = left + Math.min(...strs) * gap;
    const x2 = left + Math.max(...strs) * gap;
    s += `<rect x="${x1 - 10}" y="${y - 10}" width="${x2 - x1 + 20}" height="20" rx="10" class="d-barre f${finger}"/>`;
  }
  v.frets.forEach((f, i) => {
    if (f <= 0) return;
    const x = left + i * gap;
    const y = top + (f - base + 0.5) * fretH;
    const fg = v.fingers[i] || '';
    s += `<circle cx="${x}" cy="${y}" r="10" class="d-dot f${fg}"/>`;
    if (fg) s += `<text x="${x}" y="${y + 4.5}" class="d-finger">${fg}</text>`;
  });
  s += '</svg>';
  return `<div class="diagram ${size}" data-chord="${esc(name)}" ${play ? 'data-play="1" tabindex="0" title="Cliquer pour écouter"' : ''}>${s}</div>`;
}

/** Joue un accord (grattage vers le bas). */
export function playChord(name, voicing = null) {
  const v = voicing || getVoicing(name);
  strum(voicingMidis(v), 0, 'D', 0.4);
}

/** Active le clic-pour-écouter sur les diagrammes contenus dans root. */
export function wireDiagrams(root) {
  root.addEventListener('click', (e) => {
    const d = e.target.closest('.diagram[data-play]');
    if (d) {
      playChord(d.dataset.chord);
      d.classList.remove('pulse');
      void d.offsetWidth;
      d.classList.add('pulse');
    }
  });
}

export function fingerLegend() {
  return `<div class="finger-legend">${[1, 2, 3, 4]
    .map((f) => `<span><i class="dot f${f}">${f}</i>${FINGER_NAMES[f]}</span>`)
    .join('')}<span><i class="dot open"></i>Corde à vide</span></div>`;
}

// ------------------------------------------------------------------ Manche

/**
 * Manche horizontal interactif. La tête du ukulélé est à gauche (à droite pour les gauchers).
 * markers : [{string, fret, finger?, label?, cls?}]
 */
export class Fretboard {
  constructor(el, { frets = 12, onPick = null, showNotes = false, sound = true, compact = false } = {}) {
    this.el = el;
    this.frets = frets;
    this.onPick = onPick;
    this.showNotes = showNotes;
    this.sound = sound;
    this.compact = compact;
    this.markers = [];
    this.highlights = [];
    el.classList.add('fretboard');
    el.addEventListener('click', (e) => this._click(e));
    this.render();
  }
  setMarkers(m) {
    this.markers = m || [];
    this.render();
  }
  setHighlights(h) {
    this.highlights = h || [];
    this.render();
  }
  setChord(name, voicing = null) {
    const v = voicing || getVoicing(name);
    if (!v) return this.setMarkers([]);
    this.setMarkers(v.frets.map((f, s) => ({ string: s, fret: f, finger: f > 0 ? v.fingers[s] : 0 })));
  }
  _x(n) {
    // position réaliste des frettes ; 12e case à ~97 %
    const W = 1000;
    const nut = 92;
    const S = (W - 20 - nut) / (1 - Math.pow(2, -this.frets / 12));
    return nut + S * (1 - Math.pow(2, -n / 12));
  }
  _rows() {
    const order = store.settings.view === 'tab' ? [3, 2, 1, 0] : [0, 1, 2, 3];
    const H = this.compact ? 170 : 200;
    const pad = this.compact ? 30 : 36;
    const step = (H - pad * 2) / 3;
    const y = {};
    order.forEach((s, i) => (y[s] = pad + i * step));
    return { y, H, order };
  }
  _cellX(f) {
    return f === 0 ? 58 : (this._x(f - 1) + this._x(f)) / 2;
  }
  render() {
    const W = 1000;
    const { y, H, order } = this._rows();
    const lefty = store.settings.lefty;
    const X = (x) => (lefty ? W - x : x);
    const top = y[order[0]] - 18;
    const bottom = y[order[3]] + 18;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="fb-svg" role="img" aria-label="Manche du ukulélé">`;
    // bois
    const x0 = Math.min(X(this._x(0)), X(this._x(this.frets)));
    const x1 = Math.max(X(this._x(0)), X(this._x(this.frets)));
    s += `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bottom - top}" rx="6" class="fb-wood"/>`;
    // repères
    const midY = (y[order[1]] + y[order[2]]) / 2;
    for (const f of [5, 7, 10]) if (f <= this.frets) s += `<circle cx="${X(this._cellX(f))}" cy="${midY}" r="7" class="fb-inlay"/>`;
    if (this.frets >= 12) {
      s += `<circle cx="${X(this._cellX(12))}" cy="${(y[order[0]] + y[order[1]]) / 2}" r="7" class="fb-inlay"/>`;
      s += `<circle cx="${X(this._cellX(12))}" cy="${(y[order[2]] + y[order[3]]) / 2}" r="7" class="fb-inlay"/>`;
    }
    // frettes
    for (let f = 0; f <= this.frets; f++) {
      const x = X(this._x(f));
      s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" class="${f === 0 ? 'fb-nut' : 'fb-fret'}"/>`;
      if (f > 0) s += `<text x="${X(this._cellX(f))}" y="${H - 4}" class="fb-num">${f}</text>`;
    }
    s += `<text x="${X(58)}" y="${H - 4}" class="fb-num">à vide</text>`;
    // cordes
    STRINGS.forEach((st, i) => {
      const hl = this.highlights.includes(i) ? ' hl' : '';
      s += `<line x1="${X(this._x(0))}" y1="${y[i]}" x2="${X(this._x(this.frets))}" y2="${y[i]}" class="fb-string ${STRING_CLASS[i]}${hl}" style="stroke-width:${2 + (i === 1 ? 1.4 : i === 2 ? 0.9 : i === 0 ? 0.5 : 0)}"/>`;
      s += `<g class="fb-sname"><circle cx="${X(22)}" cy="${y[i]}" r="15" class="${STRING_CLASS[i]}"/><text x="${X(22)}" y="${y[i] + 5}">${store.settings.names === 'en' ? st.name : st.fr}</text></g>`;
    });
    // notes
    if (this.showNotes) {
      for (let st = 0; st < 4; st++)
        for (let f = 0; f <= this.frets; f++) {
          const m = noteAt(st, f);
          const info = midiInfo(m);
          const nat = !info.name.includes('#');
          s += `<text x="${X(this._cellX(f))}" y="${y[st] - 7}" class="fb-note${nat ? '' : ' sharp'}">${esc(noteName(m))}</text>`;
        }
    }
    // marqueurs
    for (const m of this.markers) {
      const cx = X(this._cellX(m.fret));
      const cy = y[m.string];
      if (m.fret === 0) {
        s += `<circle cx="${cx}" cy="${cy}" r="13" class="fb-open ${m.cls || ''}"/>`;
        if (m.label) s += `<text x="${cx}" y="${cy + 5}" class="fb-mlabel open">${esc(m.label)}</text>`;
      } else {
        s += `<circle cx="${cx}" cy="${cy}" r="15" class="fb-marker f${m.finger || 0} ${m.cls || ''}"/>`;
        const label = m.label ?? (m.finger || '');
        s += `<text x="${cx}" y="${cy + 5.5}" class="fb-mlabel">${esc(label)}</text>`;
      }
    }
    // zones cliquables
    for (let st = 0; st < 4; st++)
      for (let f = 0; f <= this.frets; f++) {
        const a = f === 0 ? 40 : this._x(f - 1);
        const b = f === 0 ? this._x(0) : this._x(f);
        const xa = Math.min(X(a), X(b));
        s += `<rect x="${xa}" y="${y[st] - 15}" width="${Math.abs(X(b) - X(a))}" height="30" class="fb-hit" data-s="${st}" data-f="${f}"><title>${esc(noteName(noteAt(st, f), 'both', true))} – corde ${STRINGS[st].fr}, ${f === 0 ? 'à vide' : 'case ' + f}</title></rect>`;
      }
    s += '</svg>';
    this.el.innerHTML = s;
  }
  _click(e) {
    const r = e.target.closest('.fb-hit');
    if (!r) return;
    const st = +r.dataset.s;
    const f = +r.dataset.f;
    const midi = noteAt(st, f);
    if (this.sound) playNote(midi, 0, 0.6);
    this.onPick && this.onPick({ string: st, fret: f, midi });
  }
}

/** Petit toast de notification */
export function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

export { frenchOf };
