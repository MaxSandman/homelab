// Lecteur « Niveau 2 : accords + mélodie » : tablature en couleurs avec deux couches
// (mélodie = doigts, accompagnement = pouce), forme d'accord de la main gauche, mains séparées.
import { Clock, click, playNote, keepAwake } from './audio.js';
import { STRINGS } from './theory.js';
import { esc, Fretboard, chordDiagram, chordLabel, noteName, STRING_CLASS, fingerLegend } from './ui.js';
import { parsePiece, ACC_STYLES } from './arrange.js';
import { store } from './store.js';

export function mountFingerstyle(el, piece, opts = {}) {
  const st = {
    speed: 1,
    metro: true,
    part: 'both', // 'both' | 'mel' | 'acc'
    hearMine: true,
    hearOther: true,
    step: false,
    loop: false,
    acc: piece.acc || 'bass2',
  };
  let P;
  let onsets;
  let keys;
  const PX = piece.beatsPerBar === 3 && piece.bpm >= 90 ? 56 : 64;
  let clock = null;
  let raf = 0;
  let playing = false;
  let offset = 0;
  let resumeAt = 0;
  let stepK = 0;
  let lastKey = '';

  function prepare() {
    P = parsePiece(piece, { acc: st.acc });
    onsets = new Map();
    for (const n of [...P.melody, ...P.acc]) {
      const k = Math.round(n.start * 4);
      if (!onsets.has(k)) onsets.set(k, []);
      onsets.get(k).push(n);
    }
    keys = [...onsets.keys()].sort((a, b) => a - b);
  }
  prepare();

  el.classList.add('fingerstyle');
  el.innerHTML = `
    <div class="pl-top"><div>
      <h1 class="pl-title">${esc(piece.title)}</h1>
      <div class="muted">${esc(piece.composer || '')}</div></div>
      <div class="pl-top-actions">${opts.extraActions || ''}</div></div>
    ${piece.desc ? `<p class="pl-note">💡 ${esc(piece.desc)}</p>` : ''}
    <details class="card fs-how"><summary><b>Comment lire ?</b> (et le lien avec le piano)</summary>
      <ul>
        <li><b>Main gauche</b> : elle tient la <b>forme de l’accord</b> affiché à gauche (comme d’habitude). Pour certaines notes de mélodie, un doigt bouge un peu.</li>
        <li><b>Pouce de la main droite</b> = la <b>main gauche du piano</b> : il pince les notes d’accompagnement
          <span class="fs-key acc">petites cases « P »</span>, souvent sur les cordes de Sol et de Do.</li>
        <li><b>Index / majeur</b> = la <b>main droite du piano</b> : ils pincent la <b>mélodie</b>
          <span class="fs-key mel">grandes cases</span>, surtout sur les cordes de Mi et de La.</li>
        <li>Le chiffre = la case. Les couleurs = les cordes. Comme au piano, travaille d’abord <b>chaque main séparément</b> (boutons ci-dessous), puis les deux ensemble, lentement.</li>
      </ul></details>
    <div class="fs-stage">
      <div class="card fs-chord">
        <div class="pl-label">Main gauche</div>
        <div class="fs-now"></div>
        <div class="fs-now-name"></div>
        <div class="pl-label" style="margin-top:.5rem">Ensuite</div>
        <div class="fs-next"></div>
      </div>
      <div class="card fs-tabcard">
        <div class="fs-tab-wrap"><div class="mel-playhead"></div><div class="fs-tab"></div></div>
        <div class="fs-now-note"></div>
      </div>
    </div>
    <div class="card"><div class="fs-board"></div>${fingerLegend()}</div>
    <div class="card pl-controls">
      <div class="row">
        <button class="btn primary big fs-play">▶ Jouer</button>
        <button class="btn fs-restart" title="Recommencer">⏮</button>
        <button class="btn fs-prev" hidden>◀</button><button class="btn primary fs-nextbtn" hidden>Note suivante ▶</button>
      </div>
      <div class="row"><span class="pl-label">Je travaille :</span>
        <span class="seg-toggle fs-parts">
          <button class="btn sm on" data-part="both">🙌 Les deux</button>
          <button class="btn sm" data-part="mel">☝️ Mélodie seule</button>
          <button class="btn sm" data-part="acc">👍 Pouce seul</button>
        </span></div>
      <div class="row">
        <label class="tempo">Vitesse <input type="range" class="fs-speed" min="0.3" max="1.2" step="0.05" value="1"> <b class="fs-speed-v"></b></label>
        <label>Accompagnement <select class="fs-acc">${ACC_STYLES.map((a) => `<option value="${a.id}" ${a.id === st.acc ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      </div>
      <div class="row toggles">
        <label class="chk"><input type="checkbox" class="fs-metro" checked> Métronome</label>
        <label class="chk"><input type="checkbox" class="fs-hear-mine" checked> Entendre ma partie</label>
        <label class="chk fs-other-wrap" hidden><input type="checkbox" class="fs-hear-other" checked> L’appli joue l’autre partie</label>
        <label class="chk"><input type="checkbox" class="fs-step"> Pas-à-pas</label>
        <label class="chk"><input type="checkbox" class="fs-loop"> Répéter la phrase (4 mesures)</label>
      </div>
    </div>
    <div class="pl-countin" hidden></div>`;
  const q = (s) => el.querySelector(s);
  const board = new Fretboard(q('.fs-board'), { frets: 12, compact: true });

  const isMine = (n) => st.part === 'both' || (st.part === 'mel' ? !n.acc : n.acc);

  // ------------------------------------------------ tablature
  function renderTab() {
    const order = store.settings.view === 'tab' ? [3, 2, 1, 0] : [0, 1, 2, 3];
    const top = 34;
    const gap = 34;
    const rowY = (s) => top + order.indexOf(s) * gap;
    const width = P.total * PX + 500;
    const H = top + 3 * gap + 26;
    let s = `<svg width="${width}" height="${H}" class="tab-svg">`;
    for (const bar of P.bars) {
      s += `<line x1="${bar.start * PX}" y1="${rowY(order[0]) - 8}" x2="${bar.start * PX}" y2="${rowY(order[3]) + 8}" class="tab-bar"/>`;
      for (const c of bar.chords) {
        if (c.name === 'N') continue;
        s += `<text x="${c.start * PX + 4}" y="14" class="fs-cname">${esc(chordLabel(c.name).main)}</text>`;
      }
    }
    STRINGS.forEach((_, i) => (s += `<line x1="0" y1="${rowY(i)}" x2="${width}" y2="${rowY(i)}" class="tab-line ${STRING_CLASS[i]}"/>`));
    P.acc.forEach((n, k) => {
      const x = n.start * PX + 4;
      const y = rowY(n.string);
      s += `<g class="fs-n acc ${isMine(n) ? '' : 'dim'}" data-t="${n.start}"><rect x="${x - 2}" y="${y - 10}" width="24" height="20" rx="6" class="fs-accpill ${STRING_CLASS[n.string]}"/>
        <text x="${x + 10}" y="${y + 5}" class="fs-accfret">${n.fret}</text><text x="${x + 10}" y="${y - 13}" class="fs-p">P</text></g>`;
      void k;
    });
    P.melody.forEach((n) => {
      const x = n.start * PX + 4;
      const y = rowY(n.string);
      s += `<g class="fs-n mel ${isMine(n) ? '' : 'dim'}" data-t="${n.start}"><rect x="${x - 2}" y="${y - 14}" width="${Math.max(30, n.dur * PX - 6)}" height="28" rx="9" class="tab-pill ${STRING_CLASS[n.string]}"/>
        <text x="${x + 13}" y="${y + 6}" class="tab-fret">${n.fret}</text></g>`;
    });
    s += '</svg>';
    const labels = order
      .map((x) => `<div class="tab-sname ${STRING_CLASS[x]}" style="top:${rowY(x) - 11}px">${store.settings.names === 'en' ? STRINGS[x].name : STRINGS[x].fr}</div>`)
      .join('');
    q('.fs-tab').innerHTML = `<div class="tab-scroll" style="top:0">${s}</div>${labels}`;
    q('.fs-tab-wrap').style.height = `${H + 6}px`;
  }

  function setTabPos(pos) {
    const svg = q('.fs-tab svg');
    if (svg) svg.style.transform = `translateX(${-pos * PX}px)`;
  }

  // ------------------------------------------------ état affiché à une position
  function show(pos) {
    const ch = P.chordAt(pos + 1e-6);
    const sounding = [...P.melody, ...P.acc].filter((n) => n.start <= pos + 1e-6 && pos < n.start + Math.min(n.dur, 1) - 1e-6);
    const mel = P.melody.filter((n) => n.start <= pos + 1e-6 && pos < n.start + n.dur - 1e-6)[0];
    const key = `${ch ? ch.name + ch.start : ''}|${sounding.map((n) => n.string + ':' + n.fret + ':' + n.start).join(',')}`;
    if (key === lastKey) return;
    lastKey = key;
    // accord + suivant
    const idx = ch ? P.chordEvents.indexOf(ch) : -1;
    const next = P.chordEvents.slice(idx + 1).find((c) => c.name !== 'N' && (!ch || c.name !== ch.name));
    if (ch && ch.name !== 'N') {
      q('.fs-now').innerHTML = chordDiagram(ch.name, { size: 'lg', play: true });
      const l = chordLabel(ch.name);
      q('.fs-now-name').innerHTML = `<b>${esc(l.main)}</b> <span class="muted">${esc(l.sub)}</span>`;
    } else {
      q('.fs-now').innerHTML = '<div class="pl-end sm">Pas d’accord : mélodie seule</div>';
      q('.fs-now-name').textContent = '';
    }
    q('.fs-next').innerHTML = next ? chordDiagram(next.name, { size: 'sm' }) : '<span class="muted">—</span>';
    // note de mélodie
    if (mel) {
      q('.fs-now-note').innerHTML = `Mélodie : <b>${esc(noteName(mel.midi, store.settings.names, true))}</b> · <span class="badge ${STRING_CLASS[mel.string]}">corde ${esc(STRINGS[mel.string].fr)}</span> ${mel.fret ? `case <b>${mel.fret}</b>` : '<b>à vide</b>'}`;
    } else q('.fs-now-note').innerHTML = '<span class="muted">Mélodie : silence</span>';
    // manche : forme d'accord (petits points) + notes jouées maintenant
    const markers = [];
    if (ch && ch.voicing)
      ch.voicing.frets.forEach((f, s) => {
        if (f > 0) markers.push({ string: s, fret: f, finger: ch.voicing.fingers[s], cls: 'shape' });
      });
    for (const n of sounding) {
      const i = markers.findIndex((m) => m.string === n.string && m.fret === n.fret);
      const m = { string: n.string, fret: n.fret, label: n.acc ? 'P' : n.fret === 0 ? '0' : '♪', finger: 0, cls: n.acc ? 'acc-now' : 'now' };
      if (i >= 0) markers[i] = { ...markers[i], cls: m.cls, label: m.label };
      else markers.push(m);
    }
    board.setMarkers(markers);
    el.querySelectorAll('.fs-n.now').forEach((g) => g.classList.remove('now'));
    sounding.forEach((n) => el.querySelectorAll(`.fs-n[data-t="${n.start}"]`).forEach((g) => g.classList.add('now')));
  }

  // ------------------------------------------------ lecture
  const spb = () => P.bpm * st.speed;
  const shouldHear = (n) => (isMine(n) ? st.hearMine : st.hearOther);
  function playNotes(list, t) {
    for (const n of list) if (shouldHear(n)) playNote(n.midi, t, n.acc ? 0.32 : 0.6, Math.max(0.35, (Math.min(n.dur, 2) * 60) / spb()));
  }

  function start(from = 0) {
    playing = true;
    offset = from;
    q('.fs-play').textContent = '⏸ Pause';
    keepAwake(true);
    const countIn = P.beatsPerBar;
    let loopStart = null;
    clock = new Clock({
      bpm: spb(),
      slotsPerBeat: 4,
      onSlot: (v, t) => {
        const onBeat = Math.abs(v - Math.round(v)) < 0.01;
        if (v < 0) {
          if (onBeat) click(t, Math.round(v) === -countIn, 0.5);
          return;
        }
        const p = v + offset;
        if (p >= P.total - 1e-6) return false;
        if (st.metro && onBeat) click(t, Math.round(p) % P.beatsPerBar === 0, 0.3);
        const list = onsets.get(Math.round(p * 4));
        if (list) playNotes(list, t);
        const np = p + 0.25;
        if (st.loop) {
          const phrase = P.beatsPerBar * 4;
          if (loopStart === null) loopStart = Math.floor(p / phrase) * phrase;
          const end = Math.min(P.total, loopStart + phrase);
          if (np >= end - 1e-6) return loopStart - offset;
        } else loopStart = null;
        return np - offset;
      },
      onEnd: () => {
        stop();
        resumeAt = 0;
        q('.fs-play').textContent = '↻ Rejouer';
      },
    });
    clock.start(-countIn);
    const loop = () => {
      const raw = clock.now();
      const ci = q('.pl-countin');
      if (raw !== null) {
        if (raw < 0) {
          ci.hidden = false;
          ci.textContent = String(Math.ceil(-raw));
          setTabPos(offset + raw);
        } else {
          ci.hidden = true;
          const pos = raw + offset;
          setTabPos(pos);
          show(pos);
          resumeAt = pos;
        }
      }
      if (playing) raf = requestAnimationFrame(loop);
    };
    loop();
  }
  function stop() {
    playing = false;
    clock && clock.stop();
    cancelAnimationFrame(raf);
    q('.pl-countin').hidden = true;
    q('.fs-play').textContent = '▶ Reprendre';
    keepAwake(false);
  }

  // ------------------------------------------------ pas-à-pas
  function stepTo(k) {
    stepK = Math.max(0, Math.min(keys.length - 1, k));
    const pos = keys[stepK] / 4;
    setTabPos(pos);
    lastKey = '';
    show(pos);
    playNotes(onsets.get(keys[stepK]), 0);
  }

  function setPart(part) {
    st.part = part;
    el.querySelectorAll('.fs-parts .btn').forEach((b) => b.classList.toggle('on', b.dataset.part === part));
    q('.fs-other-wrap').hidden = part === 'both';
    el.querySelectorAll('.fs-n').forEach((g) => g.classList.remove('dim'));
    renderTab();
    setTabPos(resumeAt);
    lastKey = '';
    show(resumeAt);
  }

  q('.fs-play').onclick = () => (playing ? stop() : start(resumeAt >= P.total ? 0 : Math.floor(resumeAt * 2) / 2));
  q('.fs-restart').onclick = () => {
    stop();
    resumeAt = 0;
    stepK = 0;
    setTabPos(0);
    lastKey = '';
    show(0);
    q('.fs-play').textContent = '▶ Jouer';
  };
  el.querySelectorAll('.fs-parts .btn').forEach((b) => (b.onclick = () => setPart(b.dataset.part)));
  q('.fs-speed').oninput = (e) => {
    st.speed = +e.target.value;
    q('.fs-speed-v').textContent = `${Math.round(st.speed * 100)} % (${Math.round(spb())} BPM)`;
    if (clock) clock.bpm = spb();
  };
  q('.fs-speed').dispatchEvent(new Event('input'));
  q('.fs-acc').onchange = (e) => {
    st.acc = e.target.value;
    const was = playing;
    stop();
    prepare();
    renderTab();
    setTabPos(resumeAt);
    lastKey = '';
    show(resumeAt);
    if (was) start(Math.floor(resumeAt));
  };
  q('.fs-metro').onchange = (e) => (st.metro = e.target.checked);
  q('.fs-hear-mine').onchange = (e) => (st.hearMine = e.target.checked);
  q('.fs-hear-other').onchange = (e) => (st.hearOther = e.target.checked);
  q('.fs-loop').onchange = (e) => (st.loop = e.target.checked);
  q('.fs-step').onchange = (e) => {
    st.step = e.target.checked;
    e.target.blur();
    stop();
    q('.fs-play').hidden = st.step;
    q('.fs-prev').hidden = !st.step;
    q('.fs-nextbtn').hidden = !st.step;
    if (st.step) {
      stepK = Math.max(0, keys.findIndex((k) => k / 4 >= resumeAt - 1e-6));
      stepTo(stepK);
    }
  };
  q('.fs-prev').onclick = () => stepTo(stepK - 1);
  q('.fs-nextbtn').onclick = () => stepTo(stepK + 1);
  q('.fs-tab').addEventListener('click', (e) => {
    const g = e.target.closest('.fs-n');
    if (!g) return;
    const t = +g.dataset.t;
    stop();
    resumeAt = t;
    stepK = keys.indexOf(Math.round(t * 4));
    setTabPos(t);
    lastKey = '';
    show(t);
    playNotes(onsets.get(Math.round(t * 4)) || [], 0);
  });
  el.addEventListener('click', (e) => {
    const d = e.target.closest('.diagram[data-play]');
    if (d) {
      const ch = P.chordAt(resumeAt + 1e-6);
      if (ch && ch.voicing) ch.voicing.frets.forEach((f, s) => playNote(STRINGS[s].midi + f, 0, 0.4));
    }
  });
  const onKey = (e) => {
    if (e.target.closest('textarea, select, input[type=text], input[type=search], input[type=number]')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (st.step) stepTo(stepK + 1);
      else q('.fs-play').click();
    } else if (st.step && e.code === 'ArrowRight') stepTo(stepK + 1);
    else if (st.step && e.code === 'ArrowLeft') stepTo(stepK - 1);
  };
  document.addEventListener('keydown', onKey);

  renderTab();
  setTabPos(0);
  show(0);
  return () => {
    stop();
    document.removeEventListener('keydown', onKey);
  };
}
