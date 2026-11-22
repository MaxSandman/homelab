// Service worker : l'appli fonctionne hors ligne (réseau d'abord, cache en secours,
// pour toujours avoir la dernière version après un "git pull" sur le NAS).
const CACHE = 'ukulele-v2';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icons/icon.svg',
  'js/app.js', 'js/audio.js', 'js/chords.js', 'js/lessons.js', 'js/melodies.js', 'js/parser.js',
  'js/player.js', 'js/arrange.js', 'js/fingerstyle.js', 'js/analysis.js', 'js/analysis-worker.js', 'js/translate.js', 'js/rhythm.js', 'js/songs.js', 'js/store.js', 'js/theory.js', 'js/tuner.js', 'js/ui.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
