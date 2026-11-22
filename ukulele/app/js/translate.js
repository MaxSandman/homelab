// Pages « Traduire un morceau » : accords d'un fichier audio (et jeu par-dessus le vrai morceau),
// et transcription d'une mélodie jouée/chantée en tablature ukulélé.
import { decodeToMono, analyze, tracks } from './analysis.js';
import { keepAwake, micAvailable, playNote } from './audio.js';
import { transposeChord, pretty, parseChord } from './theory.js';
import { chordDifficulty } from './chords.js';
import { esc, chordDiagram, chordLabel, toast, wireDiagrams } from './ui.js';
import { serializeMelody, midiToNote } from './arrange.js';
import { mountFingerstyle } from './fingerstyle.js';
import { store } from './store.js';

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------ page principale
export function translatePage(main, onCleanup) {
  main.innerHTML = `<h1>Traduire un morceau</h1>
  <p class="lead">Donne un fichier audio à l’outil : il trouve le <b>tempo</b> et les <b>accords</b>, puis tu joues
  <b>par-dessus le vrai morceau</b> avec les accords qui défilent. Tout se passe sur cet appareil : le fichier n’est envoyé nulle part.</p>
  <div class="tr-grid">
    <div class="card">
      <h2>🎧 Les accords d’un morceau</h2>
      <p>Choisis un fichier audio (mp3, m4a, wav…) d’une chanson que tu aimes.</p>
      <label class="btn primary big">📂 Choisir un fichier <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac" class="tr-file" hidden></label>
      <div class="tr-progress" hidden><div class="progress"><div></div></div><span class="muted tr-msg"></span></div>
      <details class="help"><summary>Bon à savoir</summary>
        <ul>
          <li>L’analyse est <b>automatique</b> : elle trouve le bon accord la plupart du temps, mais pas toujours.
            Tu peux corriger un accord en cliquant dessus (l’outil propose ses autres hypothèses).</li>
          <li>Ça marche le mieux sur les chansons pop/folk avec des accords clairs (guitare, piano, ukulélé).</li>
          <li><b>YouTube</b> : l’outil ne peut pas lire une vidéo YouTube directement. Il faut un fichier audio,
            par exemple un morceau acheté ou que tu as déjà sur ton appareil.</li>
          <li>Les morceaux restent dans ce navigateur (ils ne sont pas copiés sur le NAS).</li>
        </ul></details>
    </div>
    <div class="card">
      <h2>🎹 Transcrire une mélodie</h2>
      <p>La mélodie d’une chanson complète est trop mélangée aux autres instruments pour être extraite seule.
      Mais toi, tu peux la <b>jouer au piano</b> (main droite seule), la <b>chanter</b> ou la siffler :
      l’outil la transforme en tablature ukulélé, et tu peux y ajouter les accords pour une version <b>niveau 2</b>.</p>
      <a class="btn primary big" href="#/traduire/melodie">🎹 Transcrire une mélodie</a>
    </div>
  </div>
  <h2>Mes morceaux traduits</h2>
  <div class="grid songs tr-list"><p class="muted">Chargement…</p></div>`;

  const list = main.querySelector('.tr-list');
  const drawList = async () => {
    let all = [];
    try {
      all = await tracks.list();
    } catch {
      list.innerHTML = '<p class="warn">Le stockage local n’est pas disponible dans ce navigateur (navigation privée ?).</p>';
      return;
    }
    list.innerHTML = all.length
      ? all
          .map(
            (t) => `<div class="card song-card"><a class="sc-main" href="#/traduire/${t.id}"><b>${esc(t.name)}</b>
            <span class="muted">${fmtTime(t.result.duration)} · ${t.result.bpm} BPM · tonalité ${esc(pretty(t.result.key || '?'))}</span>
            <span class="sc-chords">${[...new Set(t.result.segments.map((s) => s.chord).filter((c) => c !== 'N'))].slice(0, 8).map((c) => `<span class="chip">${esc(pretty(c))}</span>`).join('')}</span></a>
            <div class="sc-foot"><button class="btn sm danger" data-del="${t.id}">🗑</button><a class="btn sm primary" href="#/traduire/${t.id}">▶ Jouer avec</a></div></div>`
          )
          .join('')
      : '<p class="muted">Aucun morceau pour l’instant.</p>';
  };
  list.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b || !confirm('Supprimer ce morceau ?')) return;
    await tracks.delete(b.dataset.del);
    drawList();
  });
  drawList();

  main.querySelector('.tr-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const box = main.querySelector('.tr-progress');
    const bar = box.querySelector('.progress div');
    const msg = box.querySelector('.tr-msg');
    box.hidden = false;
    const set = (p, m) => {
      bar.style.width = `${Math.round(p * 100)}%`;
      msg.textContent = m;
    };
    try {
      set(0.01, 'Lecture du fichier…');
      const { samples, truncated } = await decodeToMono(file);
      const result = await analyze('chords', samples, { onProgress: set });
      if (!result.segments.length) throw new Error('aucun accord trouvé');
      const id = 't' + Date.now().toString(36);
      await tracks.put({ id, name: file.name.replace(/\.[^.]+$/, ''), blob: file, result, created: Date.now(), capo: null });
      if (truncated) toast('Seules les 10 premières minutes ont été analysées');
      location.hash = `#/traduire/${id}`;
    } catch (err) {
      set(0, `⚠️ Impossible d’analyser ce fichier (${err.message}). Essaie un mp3 ou un wav.`);
    }
  };
}

// ------------------------------------------------------------ jouer par-dessus le morceau
function bestCapo(chords) {
  let best = { capo: 0, score: Infinity };
  for (let c = 0; c <= 7; c++) {
    const sc = chords.reduce((a, ch) => a + chordDifficulty(transposeChord(ch, -c)), 0) + c * 0.3;
    if (sc < best.score - 0.01) best = { capo: c, score: sc };
  }
  return best.capo;
}

export async function trackPage(main, id, onCleanup) {
  main.innerHTML = '<p class="muted">Chargement…</p>';
  const t = await tracks.get(id);
  if (!t) {
    main.innerHTML = '<h1>Morceau introuvable</h1><p><a href="#/traduire">← Retour</a></p>';
    return;
  }
  const R = t.result;
  const uniq = () => [...new Set(R.segments.map((s) => s.chord).filter((c) => c !== 'N'))];
  const suggested = bestCapo(uniq());
  let capo = t.capo ?? suggested;
  const url = URL.createObjectURL(t.blob);
  const audio = new Audio(url);
  audio.preservesPitch = true;
  let raf = 0;
  let cur = -2;
  let loop = null;
  const PXS = 46; // pixels par seconde dans la frise
  const shape = (c) => (c === 'N' ? 'N' : transposeChord(c, -capo));

  main.innerHTML = `<div class="crumbs"><a href="#/traduire">← Traduire un morceau</a></div>
  <div class="pl-top"><div><h1 class="pl-title">${esc(t.name)}</h1>
    <div class="muted">${R.bpm} BPM · tonalité détectée : ${esc(pretty(R.key || '?'))} · ${fmtTime(R.duration)}</div></div>
    <div class="pl-top-actions"><button class="btn sm tk-export">📒 Ajouter au carnet de chansons</button></div></div>
  <div class="card tk-capo"></div>
  <div class="pl-stage">
    <div class="pl-now card"><div class="pl-label">Maintenant</div><div class="pl-now-diagram"></div><div class="pl-now-name"></div></div>
    <div class="pl-next card"><div class="pl-label">Ensuite</div><div class="pl-next-diagram"></div><div class="pl-next-when"></div></div>
    <div class="pl-beat card"><div class="pl-label">Temps</div><div class="pl-beats"></div>
      <div class="pl-label" style="margin-top:1rem">Accords du morceau <span class="muted">(clique pour écouter)</span></div><div class="pl-chord-list"></div></div>
  </div>
  <div class="card"><div class="tk-strip-wrap"><div class="mel-playhead"></div><div class="tk-strip"></div></div>
    <p class="muted tk-hint">Clique sur un accord de la frise pour y aller. Un accord semble faux ? Clique sur ✏️ pour le corriger.</p>
    <div class="tk-edit" hidden></div></div>
  <div class="card pl-controls">
    <div class="row">
      <button class="btn primary big tk-play">▶ Jouer</button>
      <button class="btn tk-back" title="Reculer de 5 s">⏪ 5 s</button>
      <button class="btn tk-fwd" title="Avancer de 5 s">5 s ⏩</button>
      <span class="tk-time muted"></span>
    </div>
    <div class="row">
      <label class="tempo">Vitesse <input type="range" class="tk-speed" min="0.5" max="1" step="0.05" value="1"> <b class="tk-speed-v">100 %</b></label>
      <label class="chk"><input type="checkbox" class="tk-loop"> Boucler le passage en cours (2 mesures)</label>
    </div>
  </div>`;
  const q = (s) => main.querySelector(s);

  function drawCapo() {
    const shapes = uniq().map(shape);
    q('.tk-capo').innerHTML = `<div class="row wrap">
      <b>🎚️ Capodastre :</b>
      <select class="tk-capo-sel">${[...Array(8).keys()].map((c) => `<option value="${c}" ${c === capo ? 'selected' : ''}>${c === 0 ? 'Sans capo' : 'Case ' + c}${c === suggested ? ' ✨ conseillé' : ''}</option>`).join('')}</select>
      <span class="muted">${capo ? `Pose le capodastre sur la case ${capo} : tu joues les formes ${shapes.map(pretty).join(', ')} et ça sonne comme le morceau.` : `Accords : ${shapes.map(pretty).join(', ')}.`}
      ${suggested && capo !== suggested ? ` Avec un capo en case ${suggested}, les accords seraient plus faciles.` : ''}</span></div>
      ${capo ? '<p class="muted tk-capo-help">Un capodastre (≈ 10 €) est une pince qui « raccourcit » les cordes. Sans capo, tu peux quand même jouer : choisis « Sans capo ».</p>' : ''}`;
    q('.tk-capo-sel').onchange = async (e) => {
      capo = +e.target.value;
      t.capo = capo;
      tracks.put(t);
      drawCapo();
      drawStrip();
      cur = -2;
      update(true);
    };
    q('.pl-chord-list').innerHTML = shapes.map((c) => chordDiagram(c, { size: 'sm', play: true })).join('');
  }

  function drawStrip() {
    q('.tk-strip').innerHTML = `<div class="tk-track" style="width:${R.duration * PXS + 600}px">${R.segments
      .map(
        (s, i) => `<div class="tk-seg ${s.chord === 'N' ? 'none' : ''}" data-i="${i}" style="left:${s.start * PXS}px;width:${Math.max(18, (s.end - s.start) * PXS - 3)}px">
          <b>${s.chord === 'N' ? '—' : esc(pretty(shape(s.chord)))}</b>${s.chord !== 'N' ? `<button class="tk-pen" data-edit="${i}" title="Corriger">✏️</button>` : ''}</div>`
      )
      .join('')}${R.beats.map((b, i) => `<i class="tk-beat ${(i - R.downbeat) % 4 === 0 ? 'bar' : ''}" style="left:${b * PXS}px"></i>`).join('')}</div>`;
  }

  const segAt = (time) => {
    for (let i = 0; i < R.segments.length; i++) if (time < R.segments[i].end) return i;
    return R.segments.length - 1;
  };
  const beatIdx = (time) => {
    let lo = 0;
    let hi = R.beats.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (R.beats[m] <= time) lo = m;
      else hi = m - 1;
    }
    return lo;
  };

  function update(force = false) {
    const time = audio.currentTime;
    q('.tk-strip .tk-track').style.transform = `translateX(${-time * PXS}px)`;
    q('.tk-time').textContent = `${fmtTime(time)} / ${fmtTime(R.duration)}`;
    const i = segAt(time);
    const s = R.segments[i];
    if (i !== cur || force) {
      cur = i;
      main.querySelectorAll('.tk-seg.cur').forEach((x) => x.classList.remove('cur'));
      const el = main.querySelector(`.tk-seg[data-i="${i}"]`);
      if (el) el.classList.add('cur');
      if (s.chord === 'N') {
        q('.pl-now-diagram').innerHTML = '<div class="pl-end sm">Pas d’accord</div>';
        q('.pl-now-name').textContent = '';
      } else {
        const c = shape(s.chord);
        q('.pl-now-diagram').innerHTML = chordDiagram(c, { size: 'xl', play: true });
        const l = chordLabel(c);
        q('.pl-now-name').innerHTML = `<b>${esc(l.main)}</b> <span class="muted">${esc(l.sub)}</span>`;
      }
      const nx = R.segments.slice(i + 1).find((x) => x.chord !== 'N');
      q('.pl-next-diagram').innerHTML = nx ? chordDiagram(shape(nx.chord), { size: 'md', play: true }) : '<div class="pl-end sm">Fin</div>';
    }
    // temps restants avant le changement
    const b = beatIdx(time);
    const endBeat = beatIdx(s.end - 0.01);
    const left = Math.max(0, endBeat - b + 1);
    const inBar = (((b - R.downbeat) % 4) + 4) % 4;
    q('.pl-beats').innerHTML = [0, 1, 2, 3].map((k) => `<span class="bd ${k < inBar ? 'done' : ''} ${k === inBar ? 'now' : ''}">${k + 1}</span>`).join('');
    const nextSeg = R.segments[i + 1];
    q('.pl-next-when').innerHTML = nextSeg && time > R.beats[0] ? (left <= 1 ? '<b class="get-ready">Prépare-toi !</b>' : `dans <b>${left}</b> temps`) : '';
    q('.pl-next').classList.toggle('soon', !!nextSeg && left <= 1);
    if (loop && time >= loop.end) audio.currentTime = loop.start;
  }
  const tick = () => {
    update();
    if (!audio.paused) raf = requestAnimationFrame(tick);
  };

  q('.tk-play').onclick = () => {
    if (audio.paused) {
      audio.play();
      q('.tk-play').textContent = '⏸ Pause';
      keepAwake(true);
      tick();
    } else {
      audio.pause();
      q('.tk-play').textContent = '▶ Jouer';
      keepAwake(false);
    }
  };
  audio.onended = () => {
    q('.tk-play').textContent = '↻ Rejouer';
    keepAwake(false);
  };
  q('.tk-back').onclick = () => {
    audio.currentTime = Math.max(0, audio.currentTime - 5);
    update();
  };
  q('.tk-fwd').onclick = () => {
    audio.currentTime = Math.min(R.duration, audio.currentTime + 5);
    update();
  };
  q('.tk-speed').oninput = (e) => {
    audio.playbackRate = +e.target.value;
    q('.tk-speed-v').textContent = `${Math.round(audio.playbackRate * 100)} %`;
  };
  q('.tk-loop').onchange = (e) => {
    if (!e.target.checked) return (loop = null);
    const b = beatIdx(audio.currentTime);
    const barStart = b - ((((b - R.downbeat) % 4) + 4) % 4);
    const a = R.beats[Math.max(0, barStart)] || 0;
    const z = R.beats[Math.min(R.beats.length - 1, barStart + 8)] || R.duration;
    loop = { start: a, end: z };
  };
  q('.tk-strip').addEventListener('click', (e) => {
    const pen = e.target.closest('[data-edit]');
    if (pen) return editSeg(+pen.dataset.edit);
    const seg = e.target.closest('.tk-seg');
    if (!seg) return;
    audio.currentTime = R.segments[+seg.dataset.i].start + 0.01;
    update(true);
  });
  function editSeg(i) {
    const s = R.segments[i];
    const box = q('.tk-edit');
    box.hidden = false;
    box.innerHTML = `<b>Corriger l’accord à ${fmtTime(s.start)}</b> (actuellement ${esc(pretty(s.chord))}) :
      <div class="row wrap">${s.alts.map((a) => `<button class="btn sm" data-pick="${esc(a)}">${esc(pretty(a))}</button>`).join('')}
      <input class="tk-custom" placeholder="autre (ex : G7)" size="10"><button class="btn sm primary tk-ok">OK</button>
      <button class="btn sm" data-pick="N">Pas d’accord</button><button class="btn sm tk-cancel">Annuler</button></div>`;
    const apply = async (c) => {
      if (c !== 'N' && !parseChord(c)) return toast('Accord non reconnu');
      s.chord = c === 'N' ? 'N' : parseChord(c).name;
      box.hidden = true;
      await tracks.put(t);
      drawCapo();
      drawStrip();
      update(true);
    };
    box.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => apply(b.dataset.pick)));
    box.querySelector('.tk-ok').onclick = () => apply(box.querySelector('.tk-custom').value.trim());
    box.querySelector('.tk-cancel').onclick = () => (box.hidden = true);
  }
  q('.tk-export').onclick = () => {
    // grille d'accords pour le lecteur classique (4 accords par ligne)
    const parts = R.segments.filter((s) => s.chord !== 'N').map((s) => `[${shape(s.chord)}:${s.beats}]${pretty(shape(s.chord))}   `);
    const lines = [];
    for (let i = 0; i < parts.length; i += 4) lines.push(parts.slice(i, i + 4).join(''));
    const src = `{title: ${t.name}}\n{tempo: ${R.bpm}}\n{time: 4/4}\n{strum: d4}\n${capo ? `{note: Capodastre en case ${capo}}\n` : ''}${lines.join('\n')}`;
    const sid = 'perso-' + Date.now().toString(36);
    store.update((st) => st.songs.push({ id: sid, source: src, updated: Date.now() }));
    toast('Ajouté au carnet : tu peux y ajouter les paroles avec « Modifier »');
    location.hash = `#/chansons/${sid}`;
  };
  wireDiagrams(main);
  drawCapo();
  drawStrip();
  update(true);
  onCleanup(() => {
    audio.pause();
    cancelAnimationFrame(raf);
    URL.revokeObjectURL(url);
    keepAwake(false);
  });
}

// ------------------------------------------------------------ transcription de mélodie
export function melodyPage(main, onCleanup) {
  let recorder = null;
  let chunks = [];
  let result = null;
  let fsClean = null;
  let left = false;
  main.innerHTML = `<div class="crumbs"><a href="#/traduire">← Traduire un morceau</a></div>
  <h1>Transcrire une mélodie</h1>
  <p class="lead">Joue la mélodie <b>une note à la fois</b> (au piano : la main droite seule), chante-la ou siffle-la.
  L’outil reconnaît les notes et les place sur le manche du ukulélé.</p>
  <div class="card">
    <div class="form-grid">
      <label>Titre <input class="me-title" placeholder="Ma mélodie"></label>
      <label>Tempo (BPM) <input class="me-bpm" type="number" min="40" max="200" placeholder="auto"></label>
      <label>Mesure <select class="me-time"><option value="4">4 temps</option><option value="3">3 temps</option></select></label>
    </div>
    <div class="row wrap">
      <button class="btn primary big me-rec">🎙️ Enregistrer</button>
      <label class="btn big">📂 Ou choisir un enregistrement <input type="file" accept="audio/*" class="me-file" hidden></label>
      <span class="muted me-status"></span>
    </div>
    <p class="muted">💡 Astuce : un mémo vocal du téléphone marche très bien. Joue régulièrement, sans pédale de piano, dans une pièce calme.
    Pour le tempo, tu peux jouer avec un métronome (page <a href="#/rythme">Rythmes</a>) et indiquer son BPM ci-dessus.</p>
  </div>
  <div class="me-result"></div>`;
  const q = (s) => main.querySelector(s);
  const status = (m) => (q('.me-status').innerHTML = m);

  async function process(blob) {
    try {
      status('Analyse en cours…');
      const { samples } = await decodeToMono(blob, 180);
      const bpm = parseInt(q('.me-bpm').value, 10) || null;
      result = await analyze('melody', samples, { bpm, onProgress: (p, m) => status(`${m} ${Math.round(p * 100)} %`) });
      if (!result.notes.length) {
        status('⚠️ Aucune note reconnue. Rapproche-toi du micro et joue une seule note à la fois.');
        return;
      }
      status(`✅ ${result.notes.length} notes trouvées, tempo ${result.bpm} BPM${result.octaveShift ? ` (transposé de ${Math.abs(result.octaveShift)} octave${Math.abs(result.octaveShift) > 1 ? 's' : ''} pour le ukulélé)` : ''}.`);
      if (!q('.me-bpm').value) q('.me-bpm').value = result.bpm;
      showResult();
    } catch (err) {
      status(`⚠️ Impossible de lire cet enregistrement (${esc(err.message)}).`);
    }
  }

  function showResult() {
    const bpb = +q('.me-time').value;
    const total = Math.max(...result.notes.map((n) => n.start + n.dur));
    const bars = Math.ceil(total / bpb);
    q('.me-result').innerHTML = `<div class="card">
      <h3>Ajoute des accords (facultatif)</h3>
      <p class="muted">Un accord par mesure, séparés par des espaces (${bars} mesures). Exemple : <code>Am F C G</code>.
      Mets deux accords dans une mesure avec une virgule : <code>C,G</code>. Laisse vide pour la mélodie seule.</p>
      <input class="me-chords" placeholder="Am F C G …" style="width:100%">
      <div class="row"><button class="btn me-apply">Mettre à jour l’aperçu</button>
      <button class="btn primary big me-save">💾 Enregistrer dans « Niveau 2 »</button></div>
      <p class="muted">Notes reconnues : ${result.notes.map((n) => midiToNote(n.midi).replace(/\d/, '')).slice(0, 40).join(' ')}${result.notes.length > 40 ? '…' : ''}</p>
    </div><div class="me-preview"></div>`;
    const piece = () => ({
      id: 'arr-' + Date.now().toString(36),
      title: q('.me-title').value.trim() || 'Ma mélodie',
      composer: 'Transcription perso',
      bpm: +q('.me-bpm').value || result.bpm,
      beatsPerBar: bpb,
      chords: q('.me-chords').value.trim(),
      melody: serializeMelody(result.notes),
      acc: q('.me-chords').value.trim() ? 'bass2' : 'none',
      custom: true,
    });
    const preview = () => {
      fsClean && fsClean();
      q('.me-preview').innerHTML = '<div class="fs-host"></div>';
      fsClean = mountFingerstyle(q('.fs-host'), piece());
    };
    q('.me-apply').onclick = preview;
    q('.me-save').onclick = () => {
      const p = piece();
      store.update((st) => (st.arrangements = [...(st.arrangements || []), p]));
      toast('Mélodie enregistrée dans Niveau 2 🎉');
      location.hash = `#/niveau2/${p.id}`;
    };
    preview();
  }

  q('.me-file').onchange = (e) => e.target.files[0] && process(e.target.files[0]);
  q('.me-time').onchange = () => result && showResult();
  const recBtn = q('.me-rec');
  if (!micAvailable() || !window.MediaRecorder) {
    recBtn.disabled = true;
    status('🎙️ L’enregistrement direct demande une adresse <b>https</b> : utilise un enregistrement (mémo vocal) en attendant.');
  }
  recBtn.onclick = async () => {
    if (recorder) {
      recorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        recBtn.textContent = '🎙️ Enregistrer';
        recBtn.classList.remove('rec');
        const blob = new Blob(chunks, { type: recorder.mimeType });
        recorder = null;
        if (!left) process(blob);
      };
      recorder.start();
      recBtn.textContent = '⏹ Arrêter';
      recBtn.classList.add('rec');
      status('Enregistrement… joue ta mélodie, puis clique sur « Arrêter ».');
      playNote(69, 0, 0.001); // déverrouille l'audio sur iOS
    } catch {
      status('⚠️ Micro refusé.');
    }
  };
  onCleanup(() => {
    left = true;
    if (recorder) recorder.stop();
    fsClean && fsClean();
  });
}
