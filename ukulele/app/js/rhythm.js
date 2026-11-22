// Rythmes de grattage + petit entraîneur de rythme réutilisable.
import { Clock, click, strum, keepAwake } from './audio.js';
import { getVoicing, voicingMidis } from './chords.js';
import { esc, chordDiagram } from './ui.js';

// Chaque case = une croche. D = vers le bas, U = vers le haut, - = on ne gratte pas (la main bouge quand même).
export const PATTERNS = [
  { id: 'd4', name: 'Quatre coups vers le bas', level: 1, beats: 4, slots: 'D-D-D-D-', desc: 'Un coup vers le bas sur chaque temps. Le rythme parfait pour débuter.' },
  { id: 'd2', name: 'Un coup par accord (très lent)', level: 1, beats: 4, slots: 'D-------', desc: 'Un seul coup au début de la mesure, et on laisse sonner. Idéal pour apprendre à changer d’accord.' },
  { id: 'd8', name: 'Bas-Haut régulier', level: 2, beats: 4, slots: 'DUDUDUDU', desc: 'Bas sur les temps, haut sur les « et ». La main fait un mouvement de balancier.' },
  { id: 'ddu', name: 'Bas, Bas-Haut', level: 2, beats: 4, slots: 'D-DUD-DU', desc: 'Un grand classique des chansons folk, simple et entraînant.' },
  { id: 'ballad', name: 'Ballade', level: 2, beats: 4, slots: 'D---D-DU', desc: 'Pour les chansons calmes : on laisse respirer.' },
  { id: 'island', name: 'Island (le rythme du ukulélé)', level: 3, beats: 4, slots: 'D-DU-UDU', desc: 'LE rythme typique du ukulélé. Attention : sur le temps 3 la main descend dans le vide !' },
  { id: 'waltz', name: 'Valse (3 temps)', level: 1, beats: 3, slots: 'D-D-D-', desc: 'Pour les chansons en 3 temps : « UN, deux, trois ».' },
  { id: 'waltz2', name: 'Valse Bas, Bas-Haut', level: 2, beats: 3, slots: 'D-DUDU', desc: 'Une valse un peu plus vivante.' },
];

export const patternById = (id) => PATTERNS.find((p) => p.id === id);

export function patternFor(id, beatsPerBar) {
  const p = patternById(id);
  if (p && p.beats === beatsPerBar) return p;
  if (beatsPerBar === 3) return patternById('waltz');
  if (p && p.beats === 4) return p;
  // mesure inhabituelle : un coup par temps
  return { id: 'auto', name: 'Un coup par temps', beats: beatsPerBar, slots: 'D-'.repeat(beatsPerBar) };
}

export function countLabels(beats) {
  const out = [];
  for (let i = 1; i <= beats; i++) out.push(String(i), 'et');
  return out;
}

/** Affichage des flèches d'un rythme. */
export function patternHtml(p, { big = false } = {}) {
  const labels = countLabels(p.beats);
  return `<div class="pattern ${big ? 'big' : ''}">${[...p.slots]
    .map(
      (c, i) =>
        `<div class="slot ${c === 'D' ? 'down' : c === 'U' ? 'up' : 'rest'} ${i % 2 ? 'off' : 'on'}" data-i="${i}">
          <span class="arrow">${c === 'D' ? '↓' : c === 'U' ? '↑' : '·'}</span>
          <span class="count">${labels[i]}</span></div>`
    )
    .join('')}</div>`;
}

/**
 * Entraîneur de rythme : métronome + grattage d'exemple + flèches qui s'allument.
 * Retourne une fonction de nettoyage.
 */
export function mountStrumTrainer(el, { patternId = 'd4', chord = 'C', bpm = 70, choosable = true } = {}) {
  let pattern = patternById(patternId) || PATTERNS[0];
  let clock = null;
  let raf = 0;
  let playing = false;
  let hearStrum = true;
  let metro = true;
  let curChord = chord;

  el.classList.add('strum-trainer');
  el.innerHTML = `
    <div class="st-head">
      ${choosable ? `<select class="st-pattern" aria-label="Rythme">${PATTERNS.map((p) => `<option value="${p.id}" ${p.id === pattern.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : `<strong>${esc(pattern.name)}</strong>`}
      <select class="st-chord" aria-label="Accord">${['Am7', 'C', 'Am', 'F', 'G', 'G7'].map((c) => `<option ${c === curChord ? 'selected' : ''}>${c}</option>`).join('')}</select>
    </div>
    <p class="st-desc muted"></p>
    <div class="st-pattern-view"></div>
    <div class="st-controls">
      <button class="btn primary st-play">▶ Démarrer</button>
      <label class="tempo">Tempo <input type="range" min="40" max="140" value="${bpm}" class="st-bpm"> <b class="st-bpm-v">${bpm}</b> BPM</label>
      <label class="chk"><input type="checkbox" class="st-metro" checked> Métronome</label>
      <label class="chk"><input type="checkbox" class="st-hear" checked> Entendre l’exemple</label>
    </div>`;
  const view = el.querySelector('.st-pattern-view');
  const desc = el.querySelector('.st-desc');
  const draw = () => {
    view.innerHTML = patternHtml(pattern, { big: true });
    desc.textContent = pattern.desc || '';
  };
  draw();

  const stop = () => {
    playing = false;
    clock && clock.stop();
    cancelAnimationFrame(raf);
    el.querySelector('.st-play').textContent = '▶ Démarrer';
    el.querySelectorAll('.slot.now').forEach((s) => s.classList.remove('now'));
    keepAwake(false);
  };
  const start = () => {
    playing = true;
    const midis = voicingMidis(getVoicing(curChord));
    clock = new Clock({
      bpm: +el.querySelector('.st-bpm').value,
      onSlot: (p, t) => {
        const slot = Math.round(p * 2) % (pattern.beats * 2);
        if (metro && slot % 2 === 0) click(t, slot === 0, 0.35);
        const c = pattern.slots[slot];
        if (hearStrum && (c === 'D' || c === 'U')) strum(midis, t, c, 0.28, 0.9);
      },
    });
    clock.start(0);
    el.querySelector('.st-play').textContent = '■ Arrêter';
    keepAwake(true);
    const loop = () => {
      const pos = clock.now();
      if (pos !== null) {
        const slot = Math.floor(pos * 2) % (pattern.beats * 2);
        view.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('now', i === slot));
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
  };
  el.querySelector('.st-play').onclick = () => (playing ? stop() : start());
  el.querySelector('.st-bpm').oninput = (e) => {
    el.querySelector('.st-bpm-v').textContent = e.target.value;
    if (clock) clock.bpm = +e.target.value;
  };
  el.querySelector('.st-metro').onchange = (e) => (metro = e.target.checked);
  el.querySelector('.st-hear').onchange = (e) => (hearStrum = e.target.checked);
  const ps = el.querySelector('.st-pattern');
  if (ps)
    ps.onchange = (e) => {
      pattern = patternById(e.target.value);
      const was = playing;
      stop();
      draw();
      if (was) start();
    };
  el.querySelector('.st-chord').onchange = (e) => {
    curChord = e.target.value;
    if (playing) {
      stop();
      start();
    }
  };
  return stop;
}

export { chordDiagram };
