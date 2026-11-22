// Accordeur : au micro (si https) + sons de référence pour accorder à l'oreille.
import { startPitchListener, micAvailable, playNote } from './audio.js';
import { STRINGS, freqToMidi, midiToFreq, midiInfo } from './theory.js';
import { esc, STRING_CLASS } from './ui.js';
import { store } from './store.js';

export function mountTuner(el, { compact = false } = {}) {
  let stopMic = null;
  let repeat = null;
  let smooth = null;
  el.classList.add('tuner');
  const names = (s) => (store.settings.names === 'en' ? s.name : `${s.fr} (${s.name})`);
  el.innerHTML = `
    ${compact ? '' : `<div class="card tuner-main">
      <div class="tn-strings">${STRINGS.map((s, i) => `<div class="tn-string ${STRING_CLASS[i]}" data-s="${i}"><b>${esc(s.fr)}</b><small>${s.name}</small></div>`).join('')}</div>
      <div class="tn-note">—</div>
      <div class="tn-gauge"><div class="tn-scale"><span>trop grave</span><span>juste</span><span>trop aigu</span></div><div class="tn-track"><div class="tn-center"></div><div class="tn-needle"></div></div></div>
      <div class="tn-msg muted">Clique sur « Activer le micro » puis gratte une corde à la fois.</div>
      <button class="btn primary big tn-start">🎤 Activer le micro</button>
    </div>`}
    <div class="card">
      <h3>Accorder à l’oreille</h3>
      <p class="muted">Écoute la note de référence, puis tourne la mécanique de la corde jusqu’à ce que les deux sons se ressemblent.</p>
      <div class="tn-refs">${STRINGS.map((s, i) => `<button class="btn ref ${STRING_CLASS[i]}" data-s="${i}">🔊 ${esc(names(s))}</button>`).join('')}</div>
      <label class="chk"><input type="checkbox" class="tn-repeat"> Répéter le son en boucle</label>
    </div>`;

  const refBtns = el.querySelectorAll('.ref');
  refBtns.forEach((b) =>
    (b.onclick = () => {
      const s = +b.dataset.s;
      clearInterval(repeat);
      refBtns.forEach((x) => x.classList.toggle('on', x === b));
      playNote(STRINGS[s].midi, 0, 0.7, 2.5);
      if (el.querySelector('.tn-repeat').checked) repeat = setInterval(() => playNote(STRINGS[s].midi, 0, 0.7, 2.5), 2600);
    })
  );
  el.querySelector('.tn-repeat').onchange = (e) => {
    if (!e.target.checked) {
      clearInterval(repeat);
      refBtns.forEach((x) => x.classList.remove('on'));
    }
  };

  const startBtn = el.querySelector('.tn-start');
  if (startBtn) {
    const msg = el.querySelector('.tn-msg');
    if (!micAvailable()) {
      msg.innerHTML =
        '⚠️ Le navigateur n’autorise le micro que sur une adresse sécurisée (<b>https://</b>). Utilise les sons de référence ci-dessous, ou demande l’accès https (voir README).';
      startBtn.disabled = true;
    }
    startBtn.onclick = async () => {
      if (stopMic) {
        stopMic();
        stopMic = null;
        startBtn.textContent = '🎤 Activer le micro';
        return;
      }
      try {
        stopMic = await startPitchListener(update);
        startBtn.textContent = '⏹ Couper le micro';
        msg.textContent = 'Gratte une seule corde, et laisse-la sonner.';
      } catch {
        msg.textContent = '⚠️ Accès au micro refusé. Autorise le micro dans ton navigateur, ou utilise les sons de référence.';
      }
    };
  }

  function update({ freq }) {
    const noteEl = el.querySelector('.tn-note');
    const needle = el.querySelector('.tn-needle');
    if (!freq) {
      el.querySelector('.tuner-main').classList.remove('ok');
      return;
    }
    smooth = smooth ? smooth * 0.7 + freq * 0.3 : freq;
    if (Math.abs(smooth - freq) / freq > 0.06) smooth = freq;
    // corde la plus proche
    let best = 0;
    let bestD = Infinity;
    STRINGS.forEach((s, i) => {
      const d = Math.abs(freqToMidi(smooth) - s.midi);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    const target = STRINGS[best];
    const cents = 1200 * Math.log2(smooth / midiToFreq(target.midi));
    const heard = midiInfo(Math.round(freqToMidi(smooth)));
    el.querySelectorAll('.tn-string').forEach((x) => x.classList.toggle('on', +x.dataset.s === best));
    const ok = Math.abs(cents) < 6;
    el.querySelector('.tuner-main').classList.toggle('ok', ok);
    noteEl.innerHTML = `${esc(heard.fr)} <small>${heard.name}</small>`;
    const c = Math.max(-50, Math.min(50, cents));
    needle.style.left = `${50 + c}%`;
    const msg = el.querySelector('.tn-msg');
    if (Math.abs(cents) > 300) msg.textContent = `Très loin de la corde ${target.fr}… vérifie que tu grattes la bonne corde.`;
    else if (ok) msg.innerHTML = `✅ Corde de <b>${esc(target.fr)}</b> juste !`;
    else if (cents < 0) msg.innerHTML = `Corde de <b>${esc(target.fr)}</b> : trop grave → <b>tends</b> la corde (serre un peu la mécanique).`;
    else msg.innerHTML = `Corde de <b>${esc(target.fr)}</b> : trop aiguë → <b>détends</b> un peu la corde.`;
  }

  return () => {
    stopMic && stopMic();
    clearInterval(repeat);
  };
}
