// Mélodies note par note (tablature animée) avec mode « j'attends que tu joues la note » au micro.
import { Clock, click, playNote, keepAwake, startPitchListener, micAvailable } from './audio.js';
import { STRING_INDEX, STRINGS, noteAt, freqToMidi } from './theory.js';
import { esc, Fretboard, noteName, STRING_CLASS } from './ui.js';
import { store } from './store.js';

// Format : "corde+case:durée(en temps):syllabe"  — ex. "C0:1:Frè". R = silence.
export const MELODIES = [
  {
    id: 'frere-jacques',
    title: 'Frère Jacques',
    bpm: 80,
    beatsPerBar: 4,
    level: 1,
    desc: 'Seulement les cordes de Do et de Mi, avec 3 cases. Idéal pour commencer.',
    notes: `C0:1:Frè C2:1:re E0:1:Jac C0:1:ques C0:1:frè C2:1:re E0:1:Jac C0:1:ques
E0:1:Dor E1:1:mez E3:2:vous E0:1:dor E1:1:mez E3:2:vous
E3:0.5:Son A0:0.5:nez E3:0.5:les E1:0.5:ma E0:1:ti C0:1:nes E3:0.5:son A0:0.5:nez E3:0.5:les E1:0.5:ma E0:1:ti C0:1:nes
C0:1:Ding G0:1:dang C0:2:dong C0:1:ding G0:1:dang C0:2:dong`,
  },
  {
    id: 'au-clair',
    title: 'Au clair de la lune',
    bpm: 80,
    beatsPerBar: 4,
    level: 1,
    desc: 'En tonalité de Sol : beaucoup de cordes à vide, parfait pour débuter.',
    notes: `G0:1:Au G0:1:clair G0:1:de A0:1:la A2:2:lu A0:2:ne G0:1:mon A2:1:a A0:1:mi A0:1:Pier G0:4:rot
G0:1:Prê G0:1:te G0:1:moi A0:1:ta A2:2:plu A0:2:me G0:1:pour A2:1:é A0:1:crire A0:1:un G0:4:mot
A0:1:Ma A0:1:chan A0:1:del A0:1:le E0:2:est E0:2:morte A0:1:je E3:1:n'ai E2:1:plus E0:1:de C2:4:feu
G0:1:Ou G0:1:vre G0:1:moi A0:1:ta A2:2:por A0:2:te G0:1:pour A2:1:l'a A0:1:mour A0:1:de G0:4:Dieu`,
  },
  {
    id: 'twinkle',
    title: 'Ah ! vous dirai-je, maman',
    bpm: 90,
    beatsPerBar: 4,
    level: 1,
    desc: 'La célèbre « Twinkle twinkle little star ». Toutes les notes sont sous les 3 premières cases.',
    notes: `C0:1:Ah C0:1:vous E3:1:di E3:1:rai A0:1:je A0:1:ma E3:2:man
E1:1:ce E1:1:qui E0:1:cau E0:1:se C2:1:mon C2:1:tour C0:2:ment
E3:1:Pa E3:1:pa E1:1:veut E1:1:que E0:1:je E0:1:rai C2:2:sonne
E3:1:comme E3:1:u E1:1:ne E1:1:gran E0:1:de E0:1:per C2:2:sonne
C0:1:Moi C0:1:je E3:1:dis E3:1:que A0:1:les A0:1:bon E3:2:bons
E1:1:va E1:1:lent E0:1:mieux E0:1:que C2:1:la C2:1:rai C0:2:son`,
  },
  {
    id: 'ode-joie',
    title: 'Hymne à la joie',
    bpm: 92,
    beatsPerBar: 4,
    level: 2,
    desc: 'Beethoven ! Les notes avancent pas à pas, une bonne façon de mémoriser le manche.',
    notes: `E0:1 E0:1 E1:1 E3:1 E3:1 E1:1 E0:1 C2:1 C0:1 C0:1 C2:1 E0:1 E0:1.5 C2:0.5 C2:2
E0:1 E0:1 E1:1 E3:1 E3:1 E1:1 E0:1 C2:1 C0:1 C0:1 C2:1 E0:1 C2:1.5 C0:0.5 C0:2
C2:1 C2:1 E0:1 C0:1 C2:1 E0:0.5 E1:0.5 E0:1 C0:1 C2:1 E0:0.5 E1:0.5 E0:1 C2:1 C0:1 C2:1 G0:2
E0:1 E0:1 E1:1 E3:1 E3:1 E1:1 E0:1 C2:1 C0:1 C0:1 C2:1 E0:1 C2:1.5 C0:0.5 C0:2`,
  },
  {
    id: 'joyeux-anniv',
    title: 'Joyeux anniversaire',
    bpm: 100,
    beatsPerBar: 3,
    level: 2,
    desc: 'En 3 temps, tonalité de Fa. Le saut vers la case 3 de La demande un peu d’entraînement.',
    notes: `C0:0.75:Joy C0:0.25:eux C2:1:an C0:1:ni E1:1:ver E0:2:saire
C0:0.75:joy C0:0.25:eux C2:1:an C0:1:ni E3:1:ver E1:2:saire
C0:0.75:joy C0:0.25:eux A3:1:an A0:1:ni E1:1:ver E0:1:sai C2:1:re
A1:0.75:joy A1:0.25:eux A0:1:an E1:1:ni E3:1:ver E1:2:saire`,
  },
  {
    id: 'jingle',
    title: 'Jingle Bells',
    bpm: 112,
    beatsPerBar: 4,
    level: 2,
    desc: 'Le refrain, presque entièrement sur la corde de Mi.',
    notes: `E0:1:Jin E0:1:gle E0:2:bells E0:1:jin E0:1:gle E0:2:bells E0:1:jin E3:1:gle C0:1.5:all C2:0.5:the E0:4:way
E1:1:Oh E1:1:what E1:1.5:fun E1:0.5:it E1:1:is E0:1:to E0:1:ride E0:0.5:in E0:0.5:a E0:1:one C2:1:horse C2:1:o E0:1:pen C2:2:sleigh E3:2:hey
E0:1:Jin E0:1:gle E0:2:bells E0:1:jin E0:1:gle E0:2:bells E0:1:jin E3:1:gle C0:1.5:all C2:0.5:the E0:4:way
E1:1:Oh E1:1:what E1:1.5:fun E1:0.5:it E1:1:is E0:1:to E0:1:ride E0:0.5:in E0:0.5:a E3:1:one E3:1:horse E1:1:o C2:1:pen C0:4:sleigh`,
  },
];

export function parseMelody(m) {
  const notes = [];
  let t = 0;
  m.notes
    .trim()
    .split(/\s+/)
    .forEach((tok) => {
      const [pos, dur, ...syl] = tok.split(':');
      const d = parseFloat(dur) || 1;
      if (pos === 'R') {
        notes.push({ rest: true, start: t, dur: d });
      } else {
        const s = STRING_INDEX[pos[0]];
        const f = parseInt(pos.slice(1), 10);
        notes.push({ string: s, fret: f, midi: noteAt(s, f), start: t, dur: d, syl: syl.join(':') });
      }
      t += d;
    });
  return { ...m, list: notes, total: t };
}

export function mountMelody(el, melody) {
  const mel = parseMelody(melody);
  const PX = 70; // pixels par temps
  const st = { speed: 1, metro: true, hear: true, mode: 'play' }; // mode: 'play' | 'wait'
  let clock = null;
  let raf = 0;
  let playing = false;
  let idx = 0;
  let stopMic = null;
  let stable = 0;

  el.classList.add('melody');
  el.innerHTML = `
    <div class="pl-top"><div><h1>${esc(mel.title)}</h1><div class="muted">${esc(mel.desc || '')}</div></div></div>
    <div class="card mel-help">
      <b>Comment lire :</b> chaque ligne est une corde (avec son nom à gauche), le chiffre est la <b>case</b> où poser le doigt
      (<b>0</b> = corde à vide, sans appuyer). La note à jouer arrive sous la <span class="hl-now">ligne orange</span>.
    </div>
    <div class="card mel-stage">
      <div class="mel-now"><div class="pl-label">Note à jouer</div><div class="mel-big"></div></div>
      <div class="mel-tab-wrap"><div class="mel-playhead"></div><div class="mel-tab"></div></div>
    </div>
    <div class="card"><div class="mel-board"></div></div>
    <div class="card pl-controls">
      <div class="row">
        <button class="btn primary big mel-play">▶ Jouer</button>
        <button class="btn mel-restart">⏮</button>
        <span class="seg-toggle">
          <button class="btn sm mel-mode on" data-mode="play">⏱ Au tempo</button>
          <button class="btn sm mel-mode" data-mode="wait">🎤 J’attends ta note</button>
        </span>
      </div>
      <div class="row mel-play-opts">
        <label class="tempo">Vitesse <input type="range" class="mel-speed" min="0.4" max="1.3" step="0.05" value="1"> <b class="mel-speed-v">100 %</b></label>
        <label class="chk"><input type="checkbox" class="mel-metro" checked> Métronome</label>
        <label class="chk"><input type="checkbox" class="mel-hear" checked> Entendre la mélodie</label>
      </div>
      <div class="row mel-wait-opts" hidden>
        <span class="mel-mic-status muted"></span>
        <button class="btn sm mel-skip">J’ai joué la note ✓</button>
        <button class="btn sm mel-hint">🔊 Écouter la note</button>
      </div>
    </div>`;
  const q = (s) => el.querySelector(s);
  const board = new Fretboard(q('.mel-board'), { frets: 7, compact: true });

  // ---- tablature
  function renderTab() {
    const order = store.settings.view === 'tab' ? [3, 2, 1, 0] : [0, 1, 2, 3];
    const width = mel.total * PX + 400;
    const rowY = (s) => 22 + order.indexOf(s) * 34;
    let svg = `<svg width="${width}" height="${22 + 3 * 34 + 50}" class="tab-svg">`;
    // barres de mesure
    for (let b = 0; b <= mel.total; b += mel.beatsPerBar) {
      svg += `<line x1="${b * PX}" y1="${rowY(order[0])}" x2="${b * PX}" y2="${rowY(order[3])}" class="tab-bar"/>`;
    }
    STRINGS.forEach((s, i) => {
      svg += `<line x1="0" y1="${rowY(i)}" x2="${width}" y2="${rowY(i)}" class="tab-line ${STRING_CLASS[i]}"/>`;
    });
    mel.list.forEach((n, k) => {
      if (n.rest) return;
      const x = n.start * PX + 4;
      svg += `<g class="tab-note" data-k="${k}"><rect x="${x - 2}" y="${rowY(n.string) - 13}" width="${Math.max(26, n.dur * PX - 6)}" height="26" rx="8" class="tab-pill ${STRING_CLASS[n.string]}"/>
        <text x="${x + 11}" y="${rowY(n.string) + 6}" class="tab-fret">${n.fret}</text></g>`;
      if (n.syl) svg += `<text x="${x + 2}" y="${rowY(order[3]) + 38}" class="tab-syl" data-k="${k}">${esc(n.syl)}</text>`;
    });
    svg += '</svg>';
    const labels = order
      .map((s) => `<div class="tab-sname ${STRING_CLASS[s]}" style="top:${rowY(s) - 11}px">${store.settings.names === 'en' ? STRINGS[s].name : STRINGS[s].fr}</div>`)
      .join('');
    q('.mel-tab').innerHTML = `<div class="tab-scroll">${svg}</div>${labels}`;
  }
  renderTab();

  function setTabPos(pos) {
    const sc = q('.tab-scroll svg');
    if (sc) sc.style.transform = `translateX(${-pos * PX}px)`;
  }

  function showNote(k) {
    idx = k;
    el.querySelectorAll('.tab-note.now, .tab-syl.now').forEach((n) => n.classList.remove('now'));
    const n = mel.list[k];
    if (!n) {
      q('.mel-big').innerHTML = '<div class="pl-end">🎉 Bravo !</div>';
      board.setMarkers([]);
      return;
    }
    el.querySelectorAll(`[data-k="${k}"]`).forEach((e) => e.classList.add('now'));
    if (n.rest) {
      q('.mel-big').innerHTML = '<div class="mel-rest">Silence</div>';
      board.setMarkers([]);
      return;
    }
    const sname = store.settings.names === 'en' ? STRINGS[n.string].name : STRINGS[n.string].fr;
    q('.mel-big').innerHTML = `<div class="mel-note">${esc(noteName(n.midi, store.settings.names, true))}</div>
      <div class="mel-where"><span class="badge ${STRING_CLASS[n.string]}">corde ${esc(sname)}</span> ${n.fret === 0 ? '<b>à vide</b>' : `case <b>${n.fret}</b>`}</div>`;
    const next = mel.list.slice(k + 1).find((x) => !x.rest);
    const markers = [{ string: n.string, fret: n.fret, label: n.fret === 0 ? '0' : noteName(n.midi).slice(0, 3), finger: n.fret ? Math.min(4, n.fret) : 0, cls: 'now' }];
    if (next && !(next.string === n.string && next.fret === n.fret)) markers.push({ string: next.string, fret: next.fret, label: '', cls: 'ghost' });
    board.setMarkers(markers);
  }

  function noteIndexAt(pos) {
    for (let k = 0; k < mel.list.length; k++) if (pos < mel.list[k].start + mel.list[k].dur) return k;
    return mel.list.length;
  }

  // ---- mode tempo
  function start(from = 0) {
    playing = true;
    q('.mel-play').textContent = '⏸ Pause';
    keepAwake(true);
    const countIn = mel.beatsPerBar;
    let nextNote = noteIndexAt(from);
    if (mel.list[nextNote] && mel.list[nextNote].start < from) nextNote++;
    clock = new Clock({
      bpm: mel.bpm * st.speed,
      slotsPerBeat: 4,
      onSlot: (v, t) => {
        const onBeat = Math.abs(v - Math.round(v)) < 0.01;
        if (v < 0) {
          if (onBeat) click(t, Math.round(v) === -countIn, 0.5);
          return;
        }
        const p = v + from;
        if (p >= mel.total) return false;
        if (st.metro && onBeat) click(t, Math.round(p) % mel.beatsPerBar === 0, 0.3);
        while (nextNote < mel.list.length && mel.list[nextNote].start <= p + 0.001) {
          const n = mel.list[nextNote];
          if (st.hear && !n.rest) playNote(n.midi, t, 0.55, Math.max(0.3, (n.dur * 60) / (mel.bpm * st.speed)));
          nextNote++;
        }
      },
      onEnd: () => {
        stop();
        showNote(mel.list.length);
        q('.mel-play').textContent = '↻ Rejouer';
        resumeAt = 0;
      },
    });
    clock.start(-countIn);
    const loop = () => {
      const raw = clock.now();
      if (raw !== null) {
        const pos = Math.max(0, raw + from);
        setTabPos(raw < 0 ? from + raw : pos);
        if (raw >= 0) {
          const k = noteIndexAt(pos);
          if (k !== idx) showNote(k);
          resumeAt = pos;
        }
      }
      if (playing) raf = requestAnimationFrame(loop);
    };
    loop();
  }
  let resumeAt = 0;
  function stop() {
    playing = false;
    clock && clock.stop();
    cancelAnimationFrame(raf);
    q('.mel-play').textContent = '▶ Reprendre';
    keepAwake(false);
  }

  // ---- mode attente (micro)
  async function startWait() {
    const status = q('.mel-mic-status');
    if (!micAvailable()) {
      status.innerHTML = '⚠️ Micro indisponible (il faut une adresse <b>https</b>). Utilise le bouton « J’ai joué la note ✓ » pour avancer.';
      return;
    }
    try {
      status.textContent = 'Micro activé : joue la note indiquée…';
      stopMic = await startPitchListener(({ freq }) => {
        const n = mel.list[idx];
        if (!n) return;
        if (n.rest) return advance();
        if (!freq) {
          stable = 0;
          return;
        }
        const m = freqToMidi(freq);
        if (Math.abs(m - n.midi) < 0.5) {
          stable++;
          if (stable >= 3) {
            status.innerHTML = '✅ <b>Bravo !</b>';
            advance();
          }
        } else {
          stable = 0;
          status.textContent = `J’entends : ${noteName(Math.round(m), store.settings.names, true)}`;
        }
      });
    } catch {
      status.textContent = '⚠️ Accès au micro refusé. Utilise le bouton « J’ai joué la note ✓ ».';
    }
  }
  function advance() {
    stable = -8; // petit délai avant d'écouter la note suivante
    const k = idx + 1;
    showNote(k);
    const n = mel.list[k];
    setTabPos(n ? n.start : mel.total);
  }
  function stopWait() {
    stopMic && stopMic();
    stopMic = null;
  }

  function setMode(mode) {
    st.mode = mode;
    stop();
    stopWait();
    el.querySelectorAll('.mel-mode').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    q('.mel-play-opts').hidden = mode !== 'play';
    q('.mel-wait-opts').hidden = mode !== 'wait';
    q('.mel-play').hidden = mode !== 'play';
    resumeAt = 0;
    showNote(0);
    setTabPos(0);
    if (mode === 'wait') startWait();
    else q('.mel-play').textContent = '▶ Jouer';
  }

  q('.mel-play').onclick = () => {
    if (playing) stop();
    else start(resumeAt >= mel.total ? 0 : Math.floor(resumeAt));
  };
  q('.mel-restart').onclick = () => {
    const m = st.mode;
    setMode(m);
  };
  el.querySelectorAll('.mel-mode').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  q('.mel-speed').oninput = (e) => {
    st.speed = +e.target.value;
    q('.mel-speed-v').textContent = `${Math.round(st.speed * 100)} %`;
    if (clock) clock.bpm = mel.bpm * st.speed;
  };
  q('.mel-metro').onchange = (e) => (st.metro = e.target.checked);
  q('.mel-hear').onchange = (e) => (st.hear = e.target.checked);
  q('.mel-skip').onclick = () => advance();
  q('.mel-hint').onclick = () => {
    const n = mel.list[idx];
    if (n && !n.rest) playNote(n.midi, 0, 0.6);
  };
  q('.mel-tab').addEventListener('click', (e) => {
    const g = e.target.closest('[data-k]');
    if (!g) return;
    const k = +g.dataset.k;
    stop();
    showNote(k);
    resumeAt = mel.list[k].start;
    setTabPos(resumeAt);
    const n = mel.list[k];
    if (!n.rest) playNote(n.midi, 0, 0.6);
  });

  showNote(0);
  setTabPos(0);
  return () => {
    stop();
    stopWait();
  };
}
