// Lecteur « Joue avec moi » : accord actuel + suivant, temps, rythme, paroles synchronisées.
import { Clock, click, strum, keepAwake } from './audio.js';
import { getVoicing, voicingMidis } from './chords.js';
import { parseSong, buildTimeline } from './parser.js';
import { PATTERNS, patternFor, patternHtml } from './rhythm.js';
import { esc, chordDiagram, chordLabel, Fretboard, fingerLegend } from './ui.js';
import { pretty } from './theory.js';

/**
 * Monte le lecteur dans `el`.
 * source : texte ChordPro. opts : { title, backHref, transpose, onTransposeSave }
 */
export function mountPlayer(el, source, opts = {}) {
  let transpose = opts.transpose || 0;
  let song;
  let tl;
  let pattern;
  const st = {
    speed: opts.speed || 1,
    metro: true,
    accomp: true,
    step: false,
    loop: false,
    showBoard: window.innerWidth > 700,
    patternId: null,
  };
  let clock = null;
  let raf = 0;
  let playing = false;
  let pausedAt = null; // position où reprendre
  let offset = 0;
  let curEv = -2;
  let stepIdx = 0;
  let board = null;

  function prepare() {
    song = parseSong(source, { transpose });
    tl = buildTimeline(song);
    if (!st.patternId) st.patternId = song.pattern || (song.beatsPerBar === 3 ? 'waltz' : 'd4');
    pattern = patternFor(st.patternId, song.beatsPerBar);
  }
  prepare();

  const bpm = () => Math.round(song.bpm * st.speed);

  el.classList.add('player');
  el.innerHTML = `
    <div class="pl-top">
      <div>
        <h1 class="pl-title">${esc(opts.title || song.title || 'Chanson')}</h1>
        <div class="muted">${esc(song.artist || '')}</div>
      </div>
      <div class="pl-top-actions">${opts.extraActions || ''}</div>
    </div>
    ${song.notes ? `<p class="pl-note">💡 ${esc(song.notes)}</p>` : ''}
    <div class="pl-stage">
      <div class="pl-now card">
        <div class="pl-label">Maintenant</div>
        <div class="pl-now-diagram"></div>
        <div class="pl-now-name"></div>
      </div>
      <div class="pl-next card">
        <div class="pl-label">Ensuite</div>
        <div class="pl-next-diagram"></div>
        <div class="pl-next-when"></div>
      </div>
      <div class="pl-beat card">
        <div class="pl-label">Temps</div>
        <div class="pl-beats"></div>
        <div class="pl-label" style="margin-top:.8rem">Rythme <select class="pl-pattern" aria-label="Rythme"></select></div>
        <div class="pl-pattern-view"></div>
      </div>
    </div>
    <div class="pl-board-wrap" ${st.showBoard ? '' : 'hidden'}><div class="pl-board"></div>${fingerLegend()}</div>
    <div class="pl-controls card">
      <div class="row">
        <button class="btn primary big pl-play" title="Espace">▶ Jouer</button>
        <button class="btn pl-restart" title="Recommencer">⏮</button>
        <button class="btn pl-prev" title="Accord précédent (←)" hidden>◀ Précédent</button>
        <button class="btn primary pl-nextbtn" title="Accord suivant (→ ou Espace)" hidden>Suivant ▶</button>
      </div>
      <div class="row">
        <label class="tempo">Vitesse <input type="range" class="pl-speed" min="0.4" max="1.3" step="0.05" value="${st.speed}"> <b class="pl-speed-v"></b></label>
        <span class="transpose">Tonalité <button class="btn sm pl-tdown" title="Descendre d'un demi-ton">−</button> <b class="pl-tval"></b> <button class="btn sm pl-tup" title="Monter d'un demi-ton">+</button></span>
      </div>
      <div class="row toggles">
        <label class="chk"><input type="checkbox" class="pl-metro" checked> Métronome</label>
        <label class="chk"><input type="checkbox" class="pl-accomp" checked> Le ukulélé joue avec moi</label>
        <label class="chk"><input type="checkbox" class="pl-step"> Pas-à-pas (j’avance moi-même)</label>
        <label class="chk"><input type="checkbox" class="pl-loop"> Répéter la ligne</label>
        <label class="chk"><input type="checkbox" class="pl-showboard" ${st.showBoard ? 'checked' : ''}> Voir le manche</label>
      </div>
    </div>
    <div class="pl-chords card"><div class="pl-label">Accords de la chanson <span class="muted">(clique pour écouter)</span></div><div class="pl-chord-list"></div></div>
    <div class="pl-lyrics card"></div>
    <div class="pl-countin" hidden></div>`;

  const q = (s) => el.querySelector(s);
  board = new Fretboard(q('.pl-board'), { frets: 7, compact: true });

  function renderStatic() {
    q('.pl-pattern').innerHTML = PATTERNS.filter((p) => p.beats === song.beatsPerBar || (song.beatsPerBar !== 3 && song.beatsPerBar !== 4 && p.id === 'd4'))
      .map((p) => `<option value="${p.id}" ${p.id === pattern.id ? 'selected' : ''}>${esc(p.name)}</option>`)
      .join('');
    q('.pl-pattern-view').innerHTML = patternHtml(pattern);
    q('.pl-chord-list').innerHTML = song.chords.map((c) => chordDiagram(c, { size: 'sm', play: true })).join('');
    q('.pl-tval').textContent = transpose > 0 ? `+${transpose}` : String(transpose);
    q('.pl-speed-v').textContent = `${Math.round(st.speed * 100)} % (${bpm()} BPM)`;
    // paroles
    let html = '';
    let lineNo = 0;
    song.sections.forEach((sec, sIdx) => {
      html += `<section class="ly-sec">${sec.label ? `<h3 class="ly-label">${esc(sec.label)}</h3>` : ''}`;
      sec.lines.forEach((l) => {
        if (!l) {
          html += '<div class="ly-gap"></div>';
          return;
        }
        const line = tl.lines[lineNo];
        html += `<div class="ly-line" data-line="${lineNo}">`;
        line.segs.forEach((s) => {
          const txt = s.text.replace(/^ /, ' ').replace(/ $/, ' ') || ' ';
          html += `<span class="seg ${s.ev >= 0 ? 'has' : ''}" ${s.ev >= 0 ? `data-ev="${s.ev}"` : ''}>
            <span class="ch">${s.chord ? esc(pretty(s.chord)) : s.bad ? `<i class="bad">${esc(s.bad)}?</i>` : ' '}</span>
            <span class="tx">${esc(txt)}</span><span class="bar"></span></span>`;
        });
        html += '</div>';
        lineNo++;
      });
      html += '</section>';
    });
    if (!tl.events.length) html += '<p class="muted">Aucun accord trouvé dans cette chanson.</p>';
    q('.pl-lyrics').innerHTML = html;
    beatsDots(0, 0);
    curEv = -2;
    showEvent(st.step ? stepIdx : 0, true);
  }

  function beatsDots(n, active) {
    const ev = tl.events[Math.max(0, curEv)];
    const total = ev ? Math.ceil(ev.beats) : song.beatsPerBar;
    let h = '';
    for (let i = 0; i < total; i++) h += `<span class="bd ${i < active ? 'done' : ''} ${i === active - 1 ? 'now' : ''}">${i + 1}</span>`;
    q('.pl-beats').innerHTML = h;
  }

  function showEvent(i, force = false) {
    if (i === curEv && !force) return;
    curEv = i;
    const ev = tl.events[i];
    const next = tl.events[i + 1];
    el.querySelectorAll('.seg.cur').forEach((s) => s.classList.remove('cur'));
    el.querySelectorAll('.ly-line.cur').forEach((s) => s.classList.remove('cur'));
    if (!ev) {
      q('.pl-now-diagram').innerHTML = '<div class="pl-end">🎉 Bravo !</div>';
      q('.pl-now-name').textContent = '';
      q('.pl-next-diagram').innerHTML = '';
      q('.pl-next-when').textContent = '';
      board.setMarkers([]);
      return;
    }
    const lab = chordLabel(ev.chord);
    q('.pl-now-diagram').innerHTML = chordDiagram(ev.chord, { size: 'xl', play: true });
    q('.pl-now-name').innerHTML = `<b>${esc(lab.main)}</b> <span class="muted">${esc(lab.sub)}</span>`;
    if (next) {
      const same = next.chord === ev.chord;
      q('.pl-next-diagram').innerHTML = chordDiagram(next.chord, { size: 'md', play: true });
      q('.pl-next-when').innerHTML = same ? '<span class="muted">même accord, continue !</span>' : '';
    } else {
      q('.pl-next-diagram').innerHTML = '<div class="pl-end sm">Fin</div>';
      q('.pl-next-when').textContent = '';
    }
    board.setChord(ev.chord);
    const seg = el.querySelector(`.seg[data-ev="${i}"]`);
    if (seg) {
      seg.classList.add('cur');
      const line = seg.closest('.ly-line');
      line.classList.add('cur');
      const box = q('.pl-lyrics');
      const top = line.offsetTop - box.clientHeight / 3;
      box.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function eventAt(pos) {
    // recherche dichotomique
    let lo = 0;
    let hi = tl.events.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const e = tl.events[mid];
      if (pos < e.start) hi = mid - 1;
      else if (pos >= e.start + e.beats) lo = mid + 1;
      else return mid;
    }
    return pos >= tl.total ? tl.events.length : 0;
  }

  // ------------------------------------------------------------ lecture
  function start(fromPos = 0) {
    if (!tl.events.length) return;
    playing = true;
    q('.pl-play').textContent = '⏸ Pause';
    keepAwake(true);
    const countIn = song.beatsPerBar;
    offset = fromPos;
    let loopLine = null;
    clock = new Clock({
      bpm: bpm(),
      onSlot: (v, t) => {
        if (v < 0) {
          if (Math.abs(v - Math.round(v)) < 0.01) click(t, Math.round(v) === -countIn, 0.5);
          return;
        }
        const p = v + offset;
        if (p >= tl.total) return false;
        const i = eventAt(p);
        const ev = tl.events[i];
        const inBar = p % song.beatsPerBar;
        const slot = Math.round(inBar * 2) % (pattern.beats * 2);
        const onBeat = Math.abs(p - Math.round(p)) < 0.01;
        if (st.metro && onBeat) click(t, Math.round(inBar) === 0, 0.4);
        const c = pattern.slots[slot];
        if (st.accomp && ev && (c === 'D' || c === 'U' || Math.abs(p - ev.start) < 0.01)) {
          strum(voicingMidis(getVoicing(ev.chord)), t, c === 'U' ? 'U' : 'D', 0.26, 1.1);
        }
        const nextP = p + 0.5;
        if (st.loop && ev) {
          const line = tl.lines[ev.line];
          if (loopLine === null || loopLine.start > p || loopLine.end <= p) loopLine = line;
          if (nextP >= loopLine.end - 0.001) return loopLine.start - offset;
        } else loopLine = null;
        return nextP - offset;
      },
      onEnd: () => {
        stop(true);
        showEvent(tl.events.length, true);
      },
    });
    clock.start(-countIn);
    loop();
  }

  function loop() {
    const raw = clock ? clock.now() : null;
    const ci = q('.pl-countin');
    if (raw !== null) {
      const pos = raw + offset;
      if (raw < 0) {
        ci.hidden = false;
        ci.textContent = String(Math.ceil(-raw));
      } else {
        ci.hidden = true;
        const i = eventAt(pos);
        showEvent(i);
        const ev = tl.events[i];
        if (ev) {
          const into = pos - ev.start;
          const left = ev.beats - into;
          beatsDots(ev.beats, Math.floor(into) + 1);
          const seg = el.querySelector(`.seg[data-ev="${i}"] .bar`);
          if (seg) seg.style.width = `${Math.min(100, (into / ev.beats) * 100)}%`;
          const next = tl.events[i + 1];
          const nw = q('.pl-next-when');
          const nc = q('.pl-next');
          if (next && next.chord !== ev.chord) {
            const n = Math.ceil(left);
            nw.innerHTML = n <= 1 ? '<b class="get-ready">Prépare-toi !</b>' : `dans <b>${n}</b> temps`;
            nc.classList.toggle('soon', left <= 1);
          } else nc.classList.remove('soon');
          const slot = Math.floor((pos % song.beatsPerBar) * 2) % (pattern.beats * 2);
          el.querySelectorAll('.pl-pattern-view .slot').forEach((s, k) => s.classList.toggle('now', k === slot));
        }
        pausedAt = pos;
      }
    }
    if (playing) raf = requestAnimationFrame(loop);
  }

  function stop(ended = false) {
    playing = false;
    clock && clock.stop();
    cancelAnimationFrame(raf);
    q('.pl-play').textContent = ended ? '↻ Rejouer' : '▶ Reprendre';
    q('.pl-countin').hidden = true;
    keepAwake(false);
    if (ended) pausedAt = null;
  }

  function restart() {
    stop();
    pausedAt = null;
    stepIdx = 0;
    showEvent(0, true);
    q('.pl-lyrics').scrollTo({ top: 0 });
    q('.pl-play').textContent = '▶ Jouer';
    el.querySelectorAll('.seg .bar').forEach((b) => (b.style.width = '0'));
  }

  // ------------------------------------------------------------ pas-à-pas
  function stepTo(i) {
    stepIdx = Math.max(0, Math.min(tl.events.length, i));
    showEvent(stepIdx, true);
    const ev = tl.events[stepIdx];
    if (ev && st.accomp) strum(voicingMidis(getVoicing(ev.chord)), 0, 'D', 0.35);
  }

  function setStep(on) {
    st.step = on;
    stop();
    q('.pl-play').hidden = on;
    q('.pl-prev').hidden = !on;
    q('.pl-nextbtn').hidden = !on;
    if (on) {
      stepIdx = Math.max(0, curEv < tl.events.length ? curEv : 0);
      showEvent(stepIdx, true);
    } else q('.pl-play').textContent = '▶ Jouer';
  }

  // ------------------------------------------------------------ événements
  q('.pl-play').onclick = () => {
    if (playing) stop();
    else if (pausedAt !== null && pausedAt < tl.total) start(Math.floor(pausedAt));
    else {
      pausedAt = null;
      start(0);
    }
  };
  q('.pl-restart').onclick = restart;
  q('.pl-prev').onclick = () => stepTo(stepIdx - 1);
  q('.pl-nextbtn').onclick = () => stepTo(stepIdx + 1);
  q('.pl-speed').oninput = (e) => {
    st.speed = +e.target.value;
    q('.pl-speed-v').textContent = `${Math.round(st.speed * 100)} % (${bpm()} BPM)`;
    if (clock) clock.bpm = bpm();
  };
  const retranspose = (d) => {
    transpose = Math.max(-11, Math.min(11, transpose + d));
    const wasPlaying = playing;
    const pos = pausedAt;
    stop();
    prepare();
    renderStatic();
    opts.onTranspose && opts.onTranspose(transpose);
    if (wasPlaying && pos !== null) start(Math.floor(pos));
  };
  q('.pl-tdown').onclick = () => retranspose(-1);
  q('.pl-tup').onclick = () => retranspose(1);
  q('.pl-metro').onchange = (e) => (st.metro = e.target.checked);
  q('.pl-accomp').onchange = (e) => (st.accomp = e.target.checked);
  q('.pl-loop').onchange = (e) => (st.loop = e.target.checked);
  q('.pl-step').onchange = (e) => {
    setStep(e.target.checked);
    e.target.blur();
  };
  q('.pl-showboard').onchange = (e) => {
    st.showBoard = e.target.checked;
    q('.pl-board-wrap').hidden = !st.showBoard;
  };
  q('.pl-pattern').onchange = (e) => {
    st.patternId = e.target.value;
    pattern = patternFor(st.patternId, song.beatsPerBar);
    q('.pl-pattern-view').innerHTML = patternHtml(pattern);
  };
  q('.pl-lyrics').addEventListener('click', (e) => {
    const seg = e.target.closest('.seg[data-ev]');
    if (!seg) return;
    const i = +seg.dataset.ev;
    if (st.step) return stepTo(i);
    const was = playing;
    stop();
    pausedAt = tl.events[i].start;
    showEvent(i, true);
    if (was) start(pausedAt);
  });
  el.addEventListener('click', (e) => {
    const d = e.target.closest('.diagram[data-play]');
    if (d) {
      const v = getVoicing(d.dataset.chord);
      strum(voicingMidis(v), 0, 'D', 0.4);
    }
  });
  const onKey = (e) => {
    if (e.target.closest('textarea, select, input[type=text], input[type=search], input[type=number]')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (st.step) stepTo(stepIdx + 1);
      else q('.pl-play').click();
    } else if (e.code === 'ArrowRight' && st.step) stepTo(stepIdx + 1);
    else if (e.code === 'ArrowLeft' && st.step) stepTo(stepIdx - 1);
  };
  document.addEventListener('keydown', onKey);

  renderStatic();

  return () => {
    stop();
    document.removeEventListener('keydown', onKey);
  };
}
