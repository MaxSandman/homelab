// Application : navigation et pages.
import { store } from './store.js';
import { setVolume, playNote, strum, getCtx } from './audio.js';
import { STRINGS, parseChord, pretty, noteAt, midiInfo, mod12, frenchOf, SHARP } from './theory.js';
import { getVoicings, getVoicing, voicingMidis, ESSENTIALS, CHORD_TIPS, voicingDifficulty, stars } from './chords.js';
import { esc, $, $$, chordDiagram, chordLabel, Fretboard, fingerLegend, starsHtml, chordStars, wireDiagrams, toast, STRING_CLASS, noteName } from './ui.js';
import { BUILTIN_SONGS } from './songs.js';
import { parseSong, toChordPro, easiestTranspose, rewriteSource, setDirective, songDifficulty } from './parser.js';
import { mountPlayer } from './player.js';
import { PATTERNS, patternHtml, mountStrumTrainer } from './rhythm.js';
import { LESSONS } from './lessons.js';
import { MELODIES, mountMelody } from './melodies.js';
import { mountTuner } from './tuner.js';
import { PIECES } from './arrange.js';
import { mountFingerstyle } from './fingerstyle.js';
import { translatePage, trackPage, melodyPage } from './translate.js';

const main = $('#main');
let cleanups = [];
const onCleanup = (fn) => fn && cleanups.push(fn);

// ------------------------------------------------------------ données chansons
function allSongs() {
  const custom = store.state.songs.map((s) => ({ ...s, custom: true }));
  return [...BUILTIN_SONGS, ...custom].map((s) => {
    const p = parseSong(s.source);
    return { ...s, parsed: p, difficulty: songDifficulty(p.chords) };
  });
}
const findSong = (id) => allSongs().find((s) => s.id === id);

function canPlay(song) {
  const known = new Set(store.state.known);
  return song.parsed.chords.length > 0 && song.parsed.chords.every((c) => known.has(c));
}

function songLevel(song) {
  const max = Math.max(0, ...song.parsed.chords.map((c) => chordStars(c)));
  return Math.max(1, Math.min(4, max + (song.parsed.chords.length > 4 ? 1 : 0)));
}

// ------------------------------------------------------------ widgets des leçons
const UKE_PARTS_SVG = `
<svg viewBox="0 0 640 220" class="uke-parts" role="img" aria-label="Les parties du ukulélé">
  <g class="uke">
    <path d="M330 110c0-52 40-86 92-86 36 0 56 18 76 18s40-18 76-18c44 0 66 40 66 86s-22 86-66 86c-36 0-56-18-76-18s-40 18-76 18c-52 0-92-34-92-86z" class="uke-body"/>
    <circle cx="470" cy="110" r="30" class="uke-hole"/>
    <rect x="560" y="92" width="20" height="36" rx="4" class="uke-bridge"/>
    <rect x="96" y="92" width="250" height="36" class="uke-neck"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => `<line x1="${110 + i * 20 - i * i * 0.35}" y1="92" x2="${110 + i * 20 - i * i * 0.35}" y2="128" class="uke-fret"/>`).join('')}
    <path d="M20 84h80v52H20z" rx="8" class="uke-head"/>
    ${[0, 1].map((i) => `<circle cx="${40 + i * 40}" cy="76" r="9" class="uke-peg"/><circle cx="${40 + i * 40}" cy="144" r="9" class="uke-peg"/>`).join('')}
    ${[0, 1, 2, 3].map((i) => `<line x1="100" y1="${97 + i * 9}" x2="570" y2="${97 + i * 9}" class="uke-str ${STRING_CLASS[3 - i]}"/>`).join('')}
  </g>
  <g class="uke-labels">
    <text x="60" y="40">Tête</text><line x1="60" y1="46" x2="60" y2="66"/>
    <text x="60" y="190">Mécaniques</text><line x1="60" y1="170" x2="60" y2="154"/>
    <text x="200" y="64">Manche</text><line x1="200" y1="70" x2="200" y2="90"/>
    <text x="210" y="168">Frettes &amp; cases</text><line x1="190" y1="152" x2="172" y2="130"/>
    <text x="470" y="18">Rosace</text><line x1="470" y1="24" x2="470" y2="78"/>
    <text x="590" y="214">Chevalet</text><line x1="580" y1="200" x2="572" y2="130"/>
    <text x="380" y="214">Caisse</text>
  </g>
</svg>`;

function mountWidgets(root) {
  $$('[data-w]', root).forEach((el) => {
    const [type, a, b] = el.dataset.w.split(':');
    if (type === 'chord') {
      el.innerHTML = `<div class="chord-widget">${chordDiagram(a, { size: 'lg', play: true })}
        <button class="btn sm" data-listen="${esc(a)}">🔊 Écouter ${esc(pretty(a))}</button></div>`;
      el.querySelector('[data-listen]').onclick = () => strum(voicingMidis(getVoicing(a)), 0, 'D', 0.4);
    } else if (type === 'fretboard') {
      el.classList.add('card');
      const fb = new Fretboard(el.appendChild(document.createElement('div')), { frets: a === 'notes' ? 12 : 5, showNotes: false });
      if (a === 'open') fb.setMarkers(STRINGS.map((s, i) => ({ string: i, fret: 0, label: s.name })));
      if (a === 'chord') fb.setChord(b);
      if (a === 'notes') {
        const info = document.createElement('div');
        info.className = 'fb-info';
        info.innerHTML = `<label class="chk"><input type="checkbox"> Afficher le nom des notes</label> <span class="fb-picked muted">Clique sur une case…</span>`;
        el.appendChild(info);
        info.querySelector('input').onchange = (e) => {
          fb.showNotes = e.target.checked;
          fb.render();
        };
        fb.onPick = ({ string, fret, midi }) => {
          info.querySelector('.fb-picked').innerHTML = `<b>${esc(noteName(midi, 'both', true))}</b> : corde ${STRINGS[string].fr}, ${fret ? 'case ' + fret : 'à vide'}`;
          fb.setMarkers([{ string, fret, label: noteName(midi).slice(0, 3), finger: 0, cls: 'now' }]);
        };
      }
    } else if (type === 'strings') {
      el.innerHTML = `<div class="tn-refs">${STRINGS.map((s, i) => `<button class="btn ref ${STRING_CLASS[i]}" data-s="${i}">🔊 ${s.fr} (${s.name})</button>`).join('')}</div>`;
      el.querySelectorAll('button').forEach((bt) => (bt.onclick = () => playNote(STRINGS[+bt.dataset.s].midi, 0, 0.7)));
    } else if (type === 'strum') {
      el.classList.add('card');
      onCleanup(mountStrumTrainer(el, { patternId: a, chord: b || 'C', bpm: 60, choosable: false }));
    } else if (type === 'legend') {
      el.innerHTML = fingerLegend();
    } else if (type === 'parts') {
      el.innerHTML = UKE_PARTS_SVG;
    }
  });
}

// ------------------------------------------------------------ pages
const views = {};

views.home = () => {
  const done = LESSONS.filter((l) => store.state.lessons[l.id]).length;
  const next = LESSONS.find((l) => !store.state.lessons[l.id]);
  const playable = allSongs().filter(canPlay);
  main.innerHTML = `
  <section class="hero">
    <div>
      <h1>Apprendre le ukulélé 🌺</h1>
      <p class="lead">Depuis zéro, sans solfège : des leçons courtes, un manche interactif, et des chansons qui défilent au bon rythme
      pour savoir quoi jouer, et quand.</p>
      ${next ? `<a class="btn primary big" href="#/lecons/${next.id}">${done ? '▶ Continuer' : '▶ Commencer'} : ${esc(next.title)}</a>` : '<a class="btn primary big" href="#/chansons">🎉 Parcours terminé : place aux chansons !</a>'}
      <div class="progress"><div style="width:${(done / LESSONS.length) * 100}%"></div></div>
      <div class="muted">${done} / ${LESSONS.length} leçons terminées</div>
    </div>
    <div class="hero-chord">${chordDiagram(next && next.learn ? next.learn[0] : 'C', { size: 'lg', play: true })}<div class="muted">Clique sur l’accord pour l’entendre</div></div>
  </section>
  <section class="grid tiles">
    ${tile('#/lecons', '📚', 'Leçons', 'Le parcours pas à pas, depuis zéro.')}
    ${tile('#/chansons', '🎤', 'Chansons', 'Joue avec le lecteur synchronisé.')}
    ${tile('#/importer', '✍️', 'Ajouter une chanson', 'Colle les accords d’une chanson que tu aimes.')}
    ${tile('#/accords', '🖐️', 'Accords', 'Tous les accords, doigtés et sons.')}
    ${tile('#/manche', '🎸', 'Le manche', 'Explore les notes, case par case.')}
    ${tile('#/rythme', '🥁', 'Rythmes', 'Les grattages avec métronome.')}
    ${tile('#/melodies', '🎼', 'Mélodies', 'Joue note par note avec la tablature.')}
    ${tile('#/niveau2', '🎶', 'Niveau 2 : accords + mélodie', 'Tetris, Satie, Joplin… le pouce accompagne, les doigts chantent.')}
    ${tile('#/traduire', '🎧', 'Traduire un morceau', 'Donne un fichier audio : l’outil trouve les accords.')}
    ${tile('#/entrainement', '🔁', 'Entraînement', 'Changements d’accords, quiz des notes.')}
    ${tile('#/accordeur', '🎚️', 'Accordeur', 'Accorde ton ukulélé au micro ou à l’oreille.')}
  </section>
  ${playable.length ? `<section><h2>Chansons que tu peux déjà jouer</h2><div class="grid songs">${playable.slice(0, 6).map(songCard).join('')}</div></section>` : ''}`;
  wireDiagrams(main);
};
const tile = (href, icon, title, txt) => `<a class="tile card" href="${href}"><span class="ti">${icon}</span><b>${title}</b><span class="muted">${txt}</span></a>`;

views.lessons = () => {
  main.innerHTML = `<h1>Leçons</h1><p class="lead">Suis-les dans l’ordre : chaque leçon prend 5 à 15 minutes. Tu peux les refaire autant que tu veux.</p>
  <ol class="lesson-list">${LESSONS.map(
    (l, i) => `<li><a class="card lesson-item ${store.state.lessons[l.id] ? 'done' : ''}" href="#/lecons/${l.id}">
      <span class="li-num">${store.state.lessons[l.id] ? '✓' : i + 1}</span>
      <span class="li-icon">${l.icon}</span>
      <span class="li-txt"><b>${esc(l.title)}</b><span class="muted">${l.minutes} min${l.learn ? ' · accords : ' + l.learn.map(pretty).join(', ') : ''}</span></span></a></li>`
  ).join('')}</ol>`;
};

views.lesson = (id) => {
  const i = LESSONS.findIndex((l) => l.id === id);
  const l = LESSONS[i];
  if (!l) return views.notFound();
  const prev = LESSONS[i - 1];
  const next = LESSONS[i + 1];
  main.innerHTML = `<article class="lesson">
    <div class="crumbs"><a href="#/lecons">← Leçons</a> · Leçon ${i + 1} / ${LESSONS.length}</div>
    <h1>${l.icon} ${esc(l.title)}</h1>
    <div class="lesson-body">${l.body}</div>
    <div class="lesson-nav">
      ${prev ? `<a class="btn" href="#/lecons/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}
      <button class="btn primary big ls-done">${store.state.lessons[l.id] ? '✓ Leçon terminée' : 'J’ai terminé cette leçon ✓'}</button>
      ${next ? `<a class="btn" href="#/lecons/${next.id}">${esc(next.title)} →</a>` : '<span></span>'}
    </div></article>`;
  mountWidgets(main);
  wireDiagrams(main);
  $('.ls-done').onclick = () => {
    store.update((s) => {
      s.lessons[l.id] = true;
      s.known = [...new Set([...s.known, ...(l.learn || [])])];
    });
    toast(l.learn ? `Bravo ! Accord${l.learn.length > 1 ? 's' : ''} ${l.learn.map(pretty).join(', ')} ajouté${l.learn.length > 1 ? 's' : ''} à tes accords connus.` : 'Bravo ! Leçon terminée.');
    location.hash = next ? `#/lecons/${next.id}` : '#/chansons';
  };
};

// ---- Accords
views.chords = (params) => {
  const filter = params.get('f') || 'essentiels';
  main.innerHTML = `<h1>Accords</h1>
  <p class="lead">Clique sur un diagramme pour l’entendre, ou sur « Détails » pour le voir sur le manche. Marque ceux que tu sais jouer : l’outil te proposera les chansons adaptées.</p>
  ${fingerLegend()}
  <div class="toolbar">
    <div class="seg-toggle">
      <a class="btn sm ${filter === 'essentiels' ? 'on' : ''}" href="#/accords?f=essentiels">Les essentiels</a>
      <a class="btn sm ${filter === 'connus' ? 'on' : ''}" href="#/accords?f=connus">Mes accords</a>
      ${['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((n) => `<a class="btn sm ${filter === n ? 'on' : ''}" href="#/accords?f=${n}">${n} · ${frenchOf(n)}</a>`).join('')}
    </div>
    <form class="chord-search"><input type="search" placeholder="Chercher un accord (ex : F#m7, Bb, Lam)" aria-label="Chercher un accord"><button class="btn sm">OK</button></form>
  </div>
  <div class="grid chords-grid"></div>`;
  let list;
  if (filter === 'essentiels') list = ESSENTIALS;
  else if (filter === 'connus') list = store.state.known;
  else {
    const roots = [filter, filter + 'b', filter + '#'].filter((r) => parseChord(r) && !['Cb', 'Fb', 'E#', 'B#'].includes(r));
    list = roots.flatMap((r) => ['', 'm', '7', 'm7', 'maj7', 'sus4', 'dim', 'aug'].map((q) => r + q));
  }
  const grid = $('.chords-grid');
  grid.innerHTML = list.length ? list.map(chordCard).join('') : '<p class="muted">Aucun accord marqué pour l’instant : termine les leçons ou clique sur « Je le connais » sur un accord.</p>';
  wireDiagrams(main);
  grid.addEventListener('change', (e) => {
    const cb = e.target.closest('input[data-known]');
    if (cb) store.setKnown(cb.dataset.known, cb.checked);
  });
  $('.chord-search').onsubmit = (e) => {
    e.preventDefault();
    const v = $('.chord-search input').value.trim();
    const c = parseChord(v);
    if (!c) return toast(`« ${v} » n’est pas un accord reconnu`);
    location.hash = `#/accords/${encodeURIComponent(c.name)}`;
  };
};
function chordCard(name) {
  const lab = chordLabel(name);
  return `<div class="card chord-card">
    ${chordDiagram(name, { size: 'md', play: true })}
    <div class="cc-name"><b>${esc(lab.main)}</b> ${starsHtml(chordStars(name))}<div class="muted">${esc(lab.sub)}</div></div>
    <div class="cc-actions"><a class="btn sm" href="#/accords/${encodeURIComponent(name)}">Détails</a>
    <label class="chk sm"><input type="checkbox" data-known="${esc(name)}" ${store.isKnown(name) ? 'checked' : ''}> Je le connais</label></div></div>`;
}

views.chord = (name) => {
  name = decodeURIComponent(name);
  const c = parseChord(name);
  if (!c) return views.notFound();
  const vs = getVoicings(c.name);
  const lab = chordLabel(c.name);
  main.innerHTML = `<div class="crumbs"><a href="#/accords">← Accords</a></div>
  <h1>${esc(lab.main)} <span class="muted">${esc(lab.sub)}</span></h1>
  <div class="chord-detail">
    <div class="card">${chordDiagram(c.name, { size: 'xl', play: true })}
      <button class="btn primary cd-play">🔊 Écouter</button>
      <button class="btn cd-arp">🎵 Note par note</button>
      <label class="chk"><input type="checkbox" class="cd-known" ${store.isKnown(c.name) ? 'checked' : ''}> Je le connais</label>
    </div>
    <div class="card cd-info">
      <p>${CHORD_TIPS[c.name] ? esc(CHORD_TIPS[c.name]) : 'Place tes doigts comme indiqué par les chiffres (1 = index, 2 = majeur, 3 = annulaire, 4 = auriculaire).'}</p>
      <p><b>Notes de l’accord :</b> ${c.pcs.map((p) => `<span class="badge">${esc(frenchOf(SHARP[p]))} (${pretty(SHARP[p])})</span>`).join(' ')}</p>
      <p><b>Difficulté :</b> ${starsHtml(chordStars(c.name))}</p>
      ${vs[0] && vs[0].source === 'auto' ? '<p class="muted">ℹ️ Position calculée automatiquement par l’outil.</p>' : ''}
    </div>
  </div>
  <div class="card"><h3>Sur le manche</h3><div class="cd-board"></div>${fingerLegend()}</div>
  ${vs.length > 1 ? `<div class="card"><h3>Autres façons de le jouer</h3><div class="row wrap cd-alts">${vs.map((v, i) => `<div class="cd-alt" data-i="${i}">${chordDiagram(c.name, { voicing: v, size: 'sm', title: false })}<button class="btn sm">Voir</button></div>`).join('')}</div></div>` : ''}`;
  let cur = vs[0];
  const fb = new Fretboard($('.cd-board'), { frets: 9 });
  fb.setChord(c.name, cur);
  $('.cd-play').onclick = () => strum(voicingMidis(cur), 0, 'D', 0.4);
  $('.cd-arp').onclick = () => {
    const t = getCtx().currentTime;
    voicingMidis(cur).forEach((m, i) => playNote(m, t + i * 0.45, 0.6));
  };
  $('.cd-known').onchange = (e) => store.setKnown(c.name, e.target.checked);
  $$('.cd-alt').forEach(
    (a) =>
      (a.onclick = () => {
        cur = vs[+a.dataset.i];
        fb.setChord(c.name, cur);
        strum(voicingMidis(cur), 0, 'D', 0.4);
      })
  );
  wireDiagrams(main);
};

// ---- Manche
views.board = () => {
  main.innerHTML = `<h1>Le manche</h1>
  <p class="lead">Clique sur une case pour entendre la note. Chaque case fait monter le son d’un <b>demi-ton</b>.
  Il y a 12 notes différentes en musique : Do, Do♯, Ré, Ré♯, Mi, Fa, Fa♯, Sol, Sol♯, La, La♯, Si… puis ça recommence.</p>
  <div class="card">
    <div class="toolbar">
      <label class="chk"><input type="checkbox" class="b-notes" checked> Afficher le nom des notes</label>
      <label>Montrer : <select class="b-show">
        <option value="">— rien —</option>
        <option value="scale:0:major">Gamme de Do majeur (Do Ré Mi…)</option>
        <option value="scale:7:major">Gamme de Sol majeur</option>
        <option value="scale:5:major">Gamme de Fa majeur</option>
        <option value="scale:9:penta">Pentatonique de La mineur (pour improviser)</option>
        <option value="note:0">Tous les Do</option>
        <option value="chordtones:C">Notes de l’accord C</option>
        <option value="chordtones:Am">Notes de l’accord Am</option>
        <option value="chordtones:F">Notes de l’accord F</option>
        <option value="chordtones:G">Notes de l’accord G</option>
      </select></label>
      <button class="btn sm b-playscale" hidden>▶ Jouer la gamme</button>
    </div>
    <div class="b-board"></div>
    <div class="fb-info"><span class="b-picked muted">Clique sur une case…</span></div>
  </div>
  <div class="card"><h3>Le savais-tu ?</h3>
    <ul>
      <li>La <b>case 5</b> d’une corde donne la même note que la corde à vide suivante (sauf pour la corde de Sol, plus aiguë). C’est une astuce pour accorder.</li>
      <li>À la <b>case 12</b> (deux points), on retrouve la note de la corde à vide, une octave plus haut.</li>
      <li>Les petits points sur le manche (cases 5, 7, 10, 12) servent de repères pour ne pas se perder.</li>
    </ul>
    <p><a class="btn" href="#/entrainement?mode=quiz">🎯 Quiz : trouve la note sur le manche</a></p>
  </div>`;
  const fb = new Fretboard($('.b-board'), { frets: 12, showNotes: true });
  $('.b-notes').onchange = (e) => {
    fb.showNotes = e.target.checked;
    fb.render();
  };
  let scaleNotes = [];
  fb.onPick = ({ string, fret, midi }) => {
    $('.b-picked').innerHTML = `<b>${esc(noteName(midi, 'both', true))}</b> : corde ${STRINGS[string].fr}, ${fret ? 'case ' + fret : 'à vide'}`;
  };
  $('.b-show').onchange = (e) => {
    const [kind, a, b] = e.target.value.split(':');
    let pcs = [];
    let root = null;
    scaleNotes = [];
    if (kind === 'scale') {
      root = +a;
      const iv = b === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 3, 5, 7, 10];
      pcs = iv.map((i) => mod12(root + i));
      scaleNotes = [...iv, 12].map((i) => 60 + root + i);
    } else if (kind === 'note') {
      pcs = [+a];
      root = +a;
    } else if (kind === 'chordtones') {
      const c = parseChord(a);
      pcs = c.pcs;
      root = c.root;
    }
    const markers = [];
    if (pcs.length)
      for (let s = 0; s < 4; s++)
        for (let f = 0; f <= 12; f++) {
          const pc = mod12(noteAt(s, f));
          if (pcs.includes(pc)) markers.push({ string: s, fret: f, label: frenchOf(SHARP[pc]).slice(0, 3), finger: 0, cls: pc === root ? 'root' : 'tone' });
        }
    fb.setMarkers(markers);
    $('.b-playscale').hidden = !scaleNotes.length;
  };
  $('.b-playscale').onclick = () => {
    const t = getCtx().currentTime;
    scaleNotes.forEach((m, i) => playNote(m, t + i * 0.4, 0.6, 0.6));
  };
};

// ---- Rythmes
views.rhythm = () => {
  main.innerHTML = `<h1>Rythmes</h1>
  <p class="lead">↓ = gratter vers le bas (ongle de l’index), ↑ = vers le haut (pulpe de l’index), · = la main bouge mais ne touche pas les cordes.
  Compte à voix haute « 1 et 2 et 3 et 4 et » : les ↓ tombent sur les chiffres, les ↑ sur les « et ».</p>
  <div class="card st-main"></div>
  <h2>Tous les rythmes</h2>
  <div class="grid patterns">${PATTERNS.map((p) => `<div class="card"><b>${esc(p.name)}</b> ${starsHtml(p.level, 3)}<p class="muted">${esc(p.desc)}</p>${patternHtml(p)}</div>`).join('')}</div>`;
  onCleanup(mountStrumTrainer($('.st-main'), { patternId: 'd4', bpm: 70 }));
};

// ---- Chansons
function songCard(s) {
  const p = s.parsed;
  return `<div class="card song-card">
    <a href="#/chansons/${encodeURIComponent(s.id)}" class="sc-main">
      <b>${esc(p.title || 'Sans titre')}</b><span class="muted">${esc(p.artist || '')}</span>
      <span class="sc-chords">${p.chords.map((c) => `<span class="chip ${store.isKnown(c) ? 'known' : ''}">${esc(pretty(c))}</span>`).join('')}</span>
    </a>
    <div class="sc-foot">${starsHtml(songLevel(s))} ${s.custom ? '<span class="badge">perso</span>' : ''}
      <a class="btn sm primary" href="#/chansons/${encodeURIComponent(s.id)}">▶ Jouer</a></div>
  </div>`;
}

views.songs = (params) => {
  const f = params.get('f') || 'all';
  main.innerHTML = `<h1>Chansons</h1>
  <p class="lead">Choisis une chanson : le lecteur t’affiche l’accord à jouer, le suivant, le rythme et les paroles, au bon tempo.
  Les accords <span class="chip known">en vert</span> sont ceux que tu connais déjà.</p>
  <div class="toolbar">
    <div class="seg-toggle">
      <a class="btn sm ${f === 'all' ? 'on' : ''}" href="#/chansons">Toutes</a>
      <a class="btn sm ${f === 'ok' ? 'on' : ''}" href="#/chansons?f=ok">Je peux les jouer</a>
      <a class="btn sm ${f === 'mine' ? 'on' : ''}" href="#/chansons?f=mine">Mes chansons</a>
    </div>
    <input type="search" class="s-search" placeholder="Rechercher…" aria-label="Rechercher une chanson">
    <a class="btn primary" href="#/importer">＋ Ajouter une chanson</a>
  </div>
  <div class="grid songs"></div>`;
  let list = allSongs();
  if (f === 'ok') list = list.filter(canPlay);
  if (f === 'mine') list = list.filter((s) => s.custom);
  list.sort((a, b) => songLevel(a) - songLevel(b) || a.difficulty - b.difficulty);
  const grid = $('.songs');
  const draw = (term = '') => {
    const t = term.toLowerCase();
    const l = list.filter((s) => !t || (s.parsed.title + ' ' + s.parsed.artist).toLowerCase().includes(t));
    grid.innerHTML = l.length
      ? l.map(songCard).join('')
      : `<p class="muted">${f === 'ok' ? 'Termine les premières leçons (ou coche les accords que tu connais) pour voir les chansons que tu peux jouer.' : f === 'mine' ? 'Tu n’as pas encore ajouté de chanson. Clique sur « Ajouter une chanson » !' : 'Aucune chanson trouvée.'}</p>`;
  };
  draw();
  $('.s-search').oninput = (e) => draw(e.target.value);
};

views.play = (id) => {
  id = decodeURIComponent(id);
  const s = findSong(id);
  if (!s) return views.notFound();
  main.innerHTML = `<div class="crumbs"><a href="#/chansons">← Chansons</a></div><div class="pl-host"></div>`;
  const extra = s.custom
    ? `<a class="btn sm" href="#/importer?edit=${encodeURIComponent(s.id)}">✏️ Modifier</a> <button class="btn sm danger pl-del">🗑 Supprimer</button>`
    : `<a class="btn sm" href="#/importer?copy=${encodeURIComponent(s.id)}">✏️ Copier et modifier</a>`;
  onCleanup(mountPlayer($('.pl-host'), s.source, { extraActions: extra }));
  const del = $('.pl-del');
  if (del)
    del.onclick = () => {
      if (!confirm(`Supprimer « ${s.parsed.title} » de ton carnet ?`)) return;
      store.update((st) => (st.songs = st.songs.filter((x) => x.id !== s.id)));
      toast('Chanson supprimée');
      location.hash = '#/chansons?f=mine';
    };
};

// ---- Import / traduction
const IMPORT_EXAMPLE = `Colle ici les paroles avec les accords, par exemple :

C                 G
Quand il me prend dans ses bras
Am               F
Il me parle tout bas…

ou au format [C]paroles [G]avec accords.`;

views.import = (params) => {
  const editId = params.get('edit');
  const copyId = params.get('copy');
  const base = editId ? store.state.songs.find((s) => s.id === editId) : copyId ? findSong(copyId) : null;
  let transpose = 0;
  let simplify = false;
  main.innerHTML = `<h1>${editId ? 'Modifier une chanson' : 'Ajouter une chanson'}</h1>
  <p class="lead">Trouve une chanson que tu aimes sur internet (cherche « <i>titre</i> accords » ou « <i>titre</i> ukulele chords »),
  copie les paroles <b>avec les accords</b> et colle-les ci-dessous. L’outil la « traduit » en partition ukulélé : diagrammes, rythme, défilement.</p>
  <div class="import">
    <div class="card">
      <div class="form-grid">
        <label>Titre <input class="im-title" placeholder="Titre de la chanson"></label>
        <label>Artiste <input class="im-artist" placeholder="Artiste"></label>
        <label>Tempo (BPM) <input class="im-bpm" type="number" min="40" max="200" value="80"></label>
        <label>Mesure <select class="im-time"><option value="4">4 temps (le plus courant)</option><option value="3">3 temps (valse)</option><option value="2">2 temps</option><option value="6">6 temps</option></select></label>
        <label>Temps par accord <select class="im-beats"><option value="">1 mesure (par défaut)</option><option value="2">2 temps</option><option value="4">4 temps</option><option value="8">8 temps (2 mesures)</option></select></label>
        <label>Rythme <select class="im-pattern">${PATTERNS.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      </div>
      <textarea class="im-text" spellcheck="false" placeholder="${esc(IMPORT_EXAMPLE)}"></textarea>
      <details class="help"><summary>Formats acceptés et astuces</summary>
        <ul>
          <li><b>Accords au-dessus des paroles</b> (le format de la plupart des sites) : la position de l’accord au-dessus du mot est conservée.</li>
          <li><b>ChordPro</b> : <code>[C]Frère Jacques [G7]dormez-vous</code>.</li>
          <li>Noms anglais (<code>C, Am, F#m7, Bb</code>) ou français (<code>Do, Lam, Fa#m, Sib</code>).</li>
          <li>Les titres de parties (<code>[Refrain]</code>, <code>Couplet 2 :</code>…) sont reconnus ; les lignes de tablature sont ignorées.</li>
          <li>Pour qu’un accord dure plus ou moins longtemps qu’une mesure : <code>[C:2]</code> = 2 temps, <code>[G:8]</code> = 8 temps.</li>
          <li>Le tempo d’une chanson se trouve souvent en cherchant « <i>titre</i> BPM ».</li>
        </ul>
      </details>
    </div>
    <div class="card im-preview"><p class="muted">L’aperçu apparaîtra ici.</p></div>
  </div>`;
  const ta = $('.im-text');
  if (base) {
    const p = parseSong(base.source);
    $('.im-title').value = p.title;
    $('.im-artist').value = p.artist;
    $('.im-bpm').value = p.bpm;
    $('.im-time').value = String(p.beatsPerBar);
    if (p.beatsPerChord) $('.im-beats').value = String(p.beatsPerChord);
    if (p.pattern) $('.im-pattern').value = p.pattern;
    ta.value = base.source
      .split('\n')
      .filter((l) => !/^\{\s*(t|title|artist|a|st|subtitle|tempo|bpm|time|beats|strum|pattern|rythme)\s*:/i.test(l.trim()))
      .join('\n')
      .trim();
  }
  const fields = ['.im-title', '.im-artist', '.im-bpm', '.im-time', '.im-beats', '.im-pattern'];

  function buildSource() {
    let src = toChordPro(ta.value);
    src = rewriteSource(src, { transpose, simplify });
    // supprimer d'éventuelles directives collées, puis mettre les nôtres
    src = src
      .split('\n')
      .filter((l) => !/^\{\s*(t|title|artist|a|st|subtitle|tempo|bpm|time|beats|strum|pattern|rythme)\s*:/i.test(l.trim()))
      .join('\n');
    const head = [
      `{title: ${$('.im-title').value.trim() || 'Ma chanson'}}`,
      $('.im-artist').value.trim() ? `{artist: ${$('.im-artist').value.trim()}}` : '',
      `{tempo: ${parseInt($('.im-bpm').value, 10) || 80}}`,
      `{time: ${$('.im-time').value}/4}`,
      $('.im-beats').value ? `{beats: ${$('.im-beats').value}}` : '',
      `{strum: ${$('.im-time').value === '3' ? 'waltz' : $('.im-pattern').value}}`,
    ].filter(Boolean);
    return head.join('\n') + '\n' + src;
  }

  function preview() {
    const pv = $('.im-preview');
    if (!ta.value.trim()) {
      pv.innerHTML = '<p class="muted">L’aperçu apparaîtra ici dès que tu auras collé une chanson.</p>';
      return;
    }
    const src = buildSource();
    const song = parseSong(src);
    const orig = parseSong(rewriteSource(toChordPro(ta.value), { simplify })).chords;
    const easy = easiestTranspose(orig);
    const hard = song.chords.filter((c) => chordStars(c) >= 3);
    pv.innerHTML = `
      <h3>Accords trouvés (${song.chords.length})</h3>
      ${song.chords.length ? `<div class="row wrap">${song.chords.map((c) => `<div class="pv-chord">${chordDiagram(c, { size: 'sm', play: true })}${starsHtml(chordStars(c))}</div>`).join('')}</div>` : '<p class="warn">Aucun accord reconnu. Vérifie que les accords sont bien sur leur propre ligne au-dessus des paroles, ou entre crochets [C].</p>'}
      ${song.unknown.length ? `<p class="warn">⚠️ Non reconnus (ignorés) : ${song.unknown.map((u) => `<code>${esc(u)}</code>`).join(' ')}</p>` : ''}
      <div class="row wrap pv-tools">
        <span class="transpose">Transposer <button class="btn sm im-tdown">−</button> <b>${transpose > 0 ? '+' + transpose : transpose}</b> <button class="btn sm im-tup">+</button></span>
        ${easy.t !== transpose && easy.t !== 0 ? `<button class="btn sm primary im-easy">✨ Rendre plus facile (${easy.t > 0 ? '+' : ''}${easy.t} : ${easy.chords.map(pretty).join(', ')})</button>` : ''}
        <label class="chk"><input type="checkbox" class="im-simplify" ${simplify ? 'checked' : ''}> Simplifier les accords compliqués (Cmaj7 → C…)</label>
      </div>
      ${hard.length ? `<p class="muted">💡 Accords plus difficiles : ${hard.map(pretty).join(', ')}. ${easy.t && easy.t !== transpose ? 'Essaie « Rendre plus facile » : la chanson sera plus aiguë ou plus grave, mais avec des accords plus simples.' : ''}</p>` : ''}
      <h3>Aperçu</h3>
      <div class="pv-lyrics">${song.sections
        .map(
          (s) =>
            `${s.label ? `<h4>${esc(s.label)}</h4>` : ''}${s.lines
              .map((l) => (l ? `<div class="ly-line">${l.map((g) => `<span class="seg"><span class="ch">${g.chord ? esc(pretty(g.chord)) : ' '}</span><span class="tx">${esc(g.text || ' ')}</span></span>`).join('')}</div>` : '<div class="ly-gap"></div>'))
              .join('')}`
        )
        .join('')}</div>
      <div class="row pv-actions">
        <button class="btn primary big im-save" ${song.chords.length ? '' : 'disabled'}>💾 Enregistrer dans mon carnet</button>
        <button class="btn im-try" ${song.chords.length ? '' : 'disabled'}>▶ Essayer sans enregistrer</button>
      </div>`;
    wireDiagrams(pv);
    pv.querySelector('.im-tdown').onclick = () => ((transpose = Math.max(-11, transpose - 1)), preview());
    pv.querySelector('.im-tup').onclick = () => ((transpose = Math.min(11, transpose + 1)), preview());
    const ez = pv.querySelector('.im-easy');
    if (ez) ez.onclick = () => ((transpose = easy.t), preview());
    pv.querySelector('.im-simplify').onchange = (e) => ((simplify = e.target.checked), preview());
    pv.querySelector('.im-save').onclick = () => {
      const id = editId || 'perso-' + Date.now().toString(36);
      store.update((st) => {
        const entry = { id, source: src, updated: Date.now() };
        const i = st.songs.findIndex((x) => x.id === id);
        if (i >= 0) st.songs[i] = entry;
        else st.songs.push(entry);
      });
      toast('Chanson enregistrée dans ton carnet 🎉');
      location.hash = `#/chansons/${id}`;
    };
    pv.querySelector('.im-try').onclick = () => {
      main.innerHTML = `<div class="crumbs"><a href="#/importer" class="back-edit">← Revenir à l’édition</a></div><div class="pl-host"></div>`;
      onCleanup(mountPlayer($('.pl-host'), src, {}));
      sessionStorage.setItem('uku-draft', ta.value);
    };
  }
  let tmr;
  const schedule = () => {
    clearTimeout(tmr);
    tmr = setTimeout(preview, 250);
  };
  ta.addEventListener('input', schedule);
  fields.forEach((f) => $(f).addEventListener('input', schedule));
  if (!base) {
    const draft = sessionStorage.getItem('uku-draft');
    if (draft) ta.value = draft;
  }
  ta.addEventListener('input', () => sessionStorage.setItem('uku-draft', ta.value));
  preview();
};

// ---- Mélodies
views.melodies = () => {
  main.innerHTML = `<h1>Mélodies</h1>
  <p class="lead">Joue un air note par note grâce à la tablature animée. Le manche te montre où poser ton doigt pour la note actuelle
  (et en transparence, la suivante).</p>
  <div class="grid songs">${MELODIES.map(
    (m) => `<a class="card song-card" href="#/melodies/${m.id}"><div class="sc-main"><b>${esc(m.title)}</b><span class="muted">${esc(m.desc)}</span></div>
    <div class="sc-foot">${starsHtml(m.level, 3)} <span class="btn sm primary">▶ Jouer</span></div></a>`
  ).join('')}</div>`;
};
views.melody = (id) => {
  const m = MELODIES.find((x) => x.id === id);
  if (!m) return views.notFound();
  main.innerHTML = `<div class="crumbs"><a href="#/melodies">← Mélodies</a></div><div class="mel-host"></div>`;
  onCleanup(mountMelody($('.mel-host'), m));
};

// ---- Accordeur
views.tuner = () => {
  main.innerHTML = `<h1>Accordeur</h1>
  <p class="lead">Gratte une seule corde à la fois et laisse-la sonner. L’aiguille doit arriver au centre (vert).
  Ordre des cordes, de la plus proche de ton visage à la plus proche du sol : Sol, Do, Mi, La.</p><div class="tn-host"></div>`;
  onCleanup(mountTuner($('.tn-host')));
};

// ---- Entraînement
views.practice = (params) => {
  const mode = params.get('mode') || 'drill';
  main.innerHTML = `<h1>Entraînement</h1>
  <div class="seg-toggle"><a class="btn ${mode === 'drill' ? 'on' : ''}" href="#/entrainement">🔁 Changements d’accords</a>
  <a class="btn ${mode === 'quiz' ? 'on' : ''}" href="#/entrainement?mode=quiz">🎯 Quiz des notes</a></div>
  <div class="pr-host"></div>`;
  if (mode === 'quiz') return quiz($('.pr-host'));
  drill($('.pr-host'), params);
};

function drill(host, params) {
  const chosen = (params.get('chords') || 'C,Am').split(',').filter((c) => parseChord(c));
  const bpm = +(params.get('bpm') || 60);
  host.innerHTML = `<p class="lead">Choisis 2 à 4 accords : l’outil te les fait enchaîner au tempo. C’est <b>l’exercice le plus utile</b> pour progresser !</p>
  <div class="card dr-setup">
    <div class="dr-chips">${[...new Set([...ESSENTIALS, ...chosen])].map((c) => `<button class="chip-btn ${chosen.includes(c) ? 'on' : ''}" data-c="${esc(c)}">${esc(pretty(c))}</button>`).join('')}</div>
    <div class="row wrap">
      <label>Temps par accord <select class="dr-beats"><option value="8">8 (très lent)</option><option value="4" selected>4</option><option value="2">2 (rapide)</option></select></label>
      <label>Tempo <input type="number" class="dr-bpm" value="${bpm}" min="40" max="160"> BPM</label>
      <label>Ordre <select class="dr-order"><option value="seq">Dans l’ordre</option><option value="rand">Au hasard</option></select></label>
      <label>Durée <select class="dr-len"><option value="8">8 changements</option><option value="16" selected>16 changements</option><option value="32">32 changements</option></select></label>
      <button class="btn primary dr-go">▶ C’est parti</button>
    </div>
  </div>
  <div class="dr-player"></div>`;
  const sel = new Set(chosen);
  host.querySelector('.dr-chips').onclick = (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    const c = b.dataset.c;
    if (sel.has(c)) sel.delete(c);
    else sel.add(c);
    b.classList.toggle('on', sel.has(c));
  };
  let cleanup = null;
  const go = () => {
    const list = [...sel];
    if (list.length < 1) return toast('Choisis au moins un accord');
    const beats = +host.querySelector('.dr-beats').value;
    const n = +host.querySelector('.dr-len').value;
    const rand = host.querySelector('.dr-order').value === 'rand';
    const seq = [];
    for (let i = 0; i < n; i++) {
      if (rand && list.length > 1) {
        let c;
        do c = list[Math.floor(Math.random() * list.length)];
        while (c === seq[seq.length - 1]);
        seq.push(c);
      } else seq.push(list[i % list.length]);
    }
    const lines = [];
    for (let i = 0; i < seq.length; i += 4) lines.push(seq.slice(i, i + 4).map((c) => `[${c}:${beats}]${pretty(c)}   `).join(''));
    const src = `{title: Exercice ${list.map(pretty).join(' → ')}}\n{tempo: ${+host.querySelector('.dr-bpm').value || 60}}\n{time: 4/4}\n{strum: ${beats >= 8 ? 'd2' : 'd4'}}\n${lines.join('\n')}`;
    cleanup && cleanup();
    cleanup = mountPlayer(host.querySelector('.dr-player'), src, {});
    host.querySelector('.dr-player').scrollIntoView({ behavior: 'smooth' });
  };
  host.querySelector('.dr-go').onclick = go;
  onCleanup(() => cleanup && cleanup());
  if (params.get('chords')) go();
}

function quiz(host) {
  let target = null;
  let score = 0;
  let total = 0;
  let streak = 0;
  host.innerHTML = `<p class="lead">L’outil te donne une note : trouve-la sur le manche (cases 0 à 5) ! Il y a souvent plusieurs bonnes réponses.</p>
  <div class="card quiz">
    <div class="qz-head"><div class="qz-target"></div><div class="qz-score"></div></div>
    <div class="qz-board"></div>
    <div class="qz-msg muted"></div>
    <div class="row"><button class="btn qz-skip">Passer / montrer la réponse</button> <button class="btn qz-hear">🔊 Écouter la note</button></div>
  </div>`;
  const fb = new Fretboard(host.querySelector('.qz-board'), { frets: 5 });
  const PCS = [0, 2, 4, 5, 7, 9, 11];
  const newQ = () => {
    let pc;
    do pc = PCS[Math.floor(Math.random() * PCS.length)];
    while (target && pc === target.pc);
    target = { pc };
    host.querySelector('.qz-target').innerHTML = `Trouve un <b>${frenchOf(SHARP[pc])}</b> <span class="muted">(${SHARP[pc]})</span>`;
    host.querySelector('.qz-score').textContent = `Score : ${score} / ${total} · Série : ${streak} 🔥`;
    fb.setMarkers([]);
  };
  const reveal = (cls = 'tone') => {
    const m = [];
    for (let s = 0; s < 4; s++) for (let f = 0; f <= 5; f++) if (mod12(noteAt(s, f)) === target.pc) m.push({ string: s, fret: f, label: frenchOf(SHARP[target.pc]).slice(0, 3), cls });
    fb.setMarkers(m);
  };
  fb.onPick = ({ midi, string, fret }) => {
    total++;
    const msg = host.querySelector('.qz-msg');
    if (mod12(midi) === target.pc) {
      score++;
      streak++;
      msg.innerHTML = `✅ Oui ! Corde ${STRINGS[string].fr}, ${fret ? 'case ' + fret : 'à vide'}. ${streak >= 3 ? 'Super série !' : ''}`;
      reveal('root');
      setTimeout(newQ, 1300);
    } else {
      streak = 0;
      msg.innerHTML = `❌ Ça, c’est un <b>${esc(midiInfo(midi).fr)}</b>. Essaie encore !`;
      host.querySelector('.qz-score').textContent = `Score : ${score} / ${total} · Série : ${streak}`;
    }
  };
  host.querySelector('.qz-skip').onclick = () => {
    reveal();
    streak = 0;
    setTimeout(newQ, 2000);
  };
  host.querySelector('.qz-hear').onclick = () => playNote(60 + target.pc, 0, 0.6);
  newQ();
}

// ---- Réglages
views.settings = () => {
  const s = store.settings;
  main.innerHTML = `<h1>Réglages</h1>
  <div class="card settings">
    <label>Nom des notes
      <select class="se-names"><option value="both">Do, Ré, Mi (et C, D, E)</option><option value="fr">Do, Ré, Mi seulement</option><option value="en">C, D, E (anglais)</option></select></label>
    <label>Affichage du manche
      <select class="se-view"><option value="player">Corde de Sol en haut (comme en regardant ton ukulélé)</option><option value="tab">Corde de La en haut (comme les tablatures internet)</option></select></label>
    <label class="chk"><input type="checkbox" class="se-lefty" ${s.lefty ? 'checked' : ''}> Je suis gauchère / gaucher (manche inversé)</label>
    <label>Volume <input type="range" class="se-vol" min="0" max="1" step="0.05" value="${s.volume}"></label>
    <label>Thème <select class="se-theme"><option value="auto">Automatique</option><option value="light">Clair</option><option value="dark">Sombre</option></select></label>
  </div>
  <div class="card"><h3>Aperçu</h3><div class="se-board"></div></div>
  <div class="card"><h3>Sauvegarde</h3>
    <p class="muted">Ta progression et tes chansons sont enregistrées dans ce navigateur. Exporte-les pour les garder ou les transférer sur un autre appareil (tablette, ordinateur…).</p>
    <div class="row wrap"><button class="btn se-export">⬇️ Exporter</button>
    <label class="btn">⬆️ Importer <input type="file" accept=".json,application/json" class="se-import" hidden></label>
    <button class="btn danger se-reset">Tout effacer</button></div>
  </div>`;
  $('.se-names').value = s.names;
  $('.se-view').value = s.view;
  $('.se-theme').value = s.theme;
  const fb = new Fretboard($('.se-board'), { frets: 5 });
  fb.setChord('C');
  const set = (k, v) => {
    store.update((st) => (st.settings[k] = v));
    fb.setChord('C');
  };
  $('.se-names').onchange = (e) => set('names', e.target.value);
  $('.se-view').onchange = (e) => set('view', e.target.value);
  $('.se-lefty').onchange = (e) => set('lefty', e.target.checked);
  $('.se-theme').onchange = (e) => {
    set('theme', e.target.value);
    applyTheme();
  };
  $('.se-vol').oninput = (e) => {
    setVolume(+e.target.value);
    store.update((st) => (st.settings.volume = +e.target.value));
  };
  $('.se-vol').onchange = () => strum(voicingMidis(getVoicing('C')), 0, 'D', 0.4);
  $('.se-export').onclick = () => {
    const blob = new Blob([store.export()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ukulele-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('.se-import').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      store.import(await f.text());
      toast('Sauvegarde importée ✓');
      views.settings();
    } catch (err) {
      toast('Fichier invalide : ' + err.message);
    }
  };
  $('.se-reset').onclick = () => {
    if (confirm('Effacer toute ta progression et tes chansons perso ?')) {
      store.reset();
      toast('Tout a été effacé');
      views.settings();
    }
  };
};

// ---- Niveau 2 : accords + mélodie
const allPieces = () => [...PIECES, ...(store.state.arrangements || []).map((p) => ({ ...p, custom: true }))];
views.level2 = () => {
  main.innerHTML = `<h1>Niveau 2 : accords + mélodie</h1>
  <p class="lead">Comme au piano avec deux mains : au ukulélé, le <b>pouce</b> joue l’accompagnement (ta « main gauche » de pianiste)
  et l’<b>index / majeur</b> jouent la mélodie (ta « main droite »), pendant que la main gauche tient la forme de l’accord.
  Tout est en couleurs, sans solfège. Commence par la leçon :</p>
  <p><a class="btn" href="#/lecons/niveau2">📚 Leçon : jouer accords + mélodie</a> <a class="btn" href="#/traduire/melodie">🎹 Transcrire ta propre mélodie</a></p>
  <div class="grid songs">${allPieces()
    .map(
      (p) => `<div class="card song-card"><a class="sc-main" href="#/niveau2/${encodeURIComponent(p.id)}"><b>${esc(p.title)}</b>
      <span class="muted">${esc(p.composer || '')}</span><span>${esc(p.desc || '')}</span>
      <span class="sc-chords">${[...new Set((p.chords || '').replace(/[|,]/g, ' ').split(/\s+/).filter((c) => parseChord(c)))].map((c) => `<span class="chip ${store.isKnown(c) ? 'known' : ''}">${esc(pretty(c))}</span>`).join('')}</span></a>
      <div class="sc-foot">${starsHtml(p.level || 2, 3)} ${p.custom ? `<span class="badge">perso</span> <button class="btn sm danger" data-del="${esc(p.id)}">🗑</button>` : ''}
      <a class="btn sm primary" href="#/niveau2/${encodeURIComponent(p.id)}">▶ Jouer</a></div></div>`
    )
    .join('')}</div>`;
  main.querySelectorAll('[data-del]').forEach(
    (b) =>
      (b.onclick = () => {
        if (!confirm('Supprimer ce morceau ?')) return;
        store.update((st) => (st.arrangements = st.arrangements.filter((a) => a.id !== b.dataset.del)));
        views.level2();
      })
  );
};
views.piece = (id) => {
  id = decodeURIComponent(id);
  const p = allPieces().find((x) => x.id === id);
  if (!p) return views.notFound();
  main.innerHTML = `<div class="crumbs"><a href="#/niveau2">← Niveau 2</a></div><div class="fs-host"></div>`;
  onCleanup(mountFingerstyle($('.fs-host'), p));
  wireDiagrams(main);
};

// ---- Traduire
views.translate = () => translatePage(main, onCleanup);
views.track = (id) => (id === 'melodie' ? melodyPage(main, onCleanup) : trackPage(main, id, onCleanup));

views.notFound = () => {
  main.innerHTML = `<h1>Page introuvable</h1><p><a href="#/">← Retour à l’accueil</a></p>`;
};

// ------------------------------------------------------------ routeur
const ROUTES = [
  [/^\/?$/, views.home, 'home'],
  [/^\/lecons$/, views.lessons, 'lecons'],
  [/^\/lecons\/([\w-]+)$/, views.lesson, 'lecons'],
  [/^\/accords$/, views.chords, 'accords'],
  [/^\/accords\/(.+)$/, views.chord, 'accords'],
  [/^\/manche$/, views.board, 'manche'],
  [/^\/rythme$/, views.rhythm, 'rythme'],
  [/^\/chansons$/, views.songs, 'chansons'],
  [/^\/chansons\/(.+)$/, views.play, 'chansons'],
  [/^\/importer$/, views.import, 'chansons'],
  [/^\/melodies$/, views.melodies, 'melodies'],
  [/^\/melodies\/([\w-]+)$/, views.melody, 'melodies'],
  [/^\/accordeur$/, views.tuner, 'accordeur'],
  [/^\/entrainement$/, views.practice, 'entrainement'],
  [/^\/reglages$/, views.settings, 'reglages'],
  [/^\/niveau2$/, views.level2, 'niveau2'],
  [/^\/niveau2\/(.+)$/, views.piece, 'niveau2'],
  [/^\/traduire$/, views.translate, 'traduire'],
  [/^\/traduire\/([\w-]+)$/, views.track, 'traduire'],
];

function route() {
  cleanups.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
  cleanups = [];
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = hash.split('?');
  const params = new URLSearchParams(qs || '');
  for (const [re, view, nav] of ROUTES) {
    const m = re.exec(path);
    if (m) {
      try {
        if (m[1] !== undefined) view(m[1], params);
        else view(params);
      } catch (e) {
        console.error(e);
        main.innerHTML = `<h1>Oups…</h1><p>Une erreur est survenue : ${esc(e.message)}</p><p><a href="#/">← Accueil</a></p>`;
      }
      $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
      document.body.classList.remove('nav-open');
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
      return;
    }
  }
  views.notFound();
}

function applyTheme() {
  const t = store.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

applyTheme();
setVolume(store.settings.volume);
window.addEventListener('hashchange', route);
$('.nav-toggle').onclick = () => document.body.classList.toggle('nav-open');
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
