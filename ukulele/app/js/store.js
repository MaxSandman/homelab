// Sauvegarde locale (dans le navigateur) : réglages, progression, chansons perso.
const KEY = 'ukulele.v1';

const DEFAULTS = {
  settings: {
    names: 'both', // 'fr' | 'en' | 'both'
    view: 'player', // 'player' = corde de Sol en haut (comme quand tu regardes ton ukulélé), 'tab' = La en haut
    lefty: false,
    volume: 0.8,
    theme: 'auto',
  },
  lessons: {}, // id -> true
  known: [], // accords maîtrisés
  songs: [], // chansons perso {id, source, created}
  favorites: [],
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const s = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...s,
      settings: { ...DEFAULTS.settings, ...(s.settings || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let state = load();
const listeners = new Set();

export const store = {
  get state() {
    return state;
  },
  get settings() {
    return state.settings;
  },
  update(fn) {
    fn(state);
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* stockage indisponible (navigation privée) */
    }
    listeners.forEach((l) => l(state));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  export() {
    return JSON.stringify(state, null, 2);
  },
  import(json) {
    const s = JSON.parse(json);
    if (!s || typeof s !== 'object' || !s.settings) throw new Error('Fichier non reconnu');
    store.update((st) => {
      Object.assign(st, structuredClone(DEFAULTS), s);
      st.settings = { ...DEFAULTS.settings, ...s.settings };
    });
  },
  reset() {
    store.update((st) => Object.assign(st, structuredClone(DEFAULTS)));
  },
  isKnown(chord) {
    return state.known.includes(chord);
  },
  setKnown(chord, on) {
    store.update((st) => {
      const set = new Set(st.known);
      on ? set.add(chord) : set.delete(chord);
      st.known = [...set];
    });
  },
};
