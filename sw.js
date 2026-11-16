// Network-first so updates pushed to GitHub show up straight away;
// falls back to the cache so the app still works offline.
const CACHE = 'myabc-v5';
const AUDIO = 'myabc-audio'; // voice recordings never change once made, so they are kept across versions
const CORE = [
  './', 'index.html', 'css/style.css', 'js/data.js', 'js/pal.js', 'js/lines.js', 'js/trace.js', 'js/app.js', 'audio/index.json',
  'manifest.webmanifest', 'fonts/andika-400.woff2', 'fonts/andika-700.woff2',
  'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== AUDIO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (/\/audio\/[^/]+\.mp3$/.test(new URL(req.url).pathname)) {
    e.respondWith(caches.open(AUDIO).then(c => c.match(req.url).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req.url, r.clone()); return r; }))));
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const fresh = await Promise.race([
        fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }), // skip the browser's own 10-minute cache
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3500))
      ]);
      if (fresh && fresh.ok) cache.put(req.url.split('?')[0], fresh.clone()); // one entry per file, whatever the query
      return fresh;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return cache.match('index.html');
      throw err;
    }
  })());
});
