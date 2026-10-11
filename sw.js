// Princess Study Planner v5: update-safe offline cache.
// Updating this version + the HTML asset URLs prevents mixing new HTML with old CSS.
const VERSION = '20261011-v5';
const CACHE = `princess-study-planner-${VERSION}`;
const PREFIX = 'princess-study-planner-';
const ASSETS = [
  './', './index.html',
  ...['style.css','data.js','app.js','jalali-date.js','hub.js','pomodoro.js','tabs.js']
      .map(file => `./${file}?v=${VERSION}`),
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
          .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first so fresh deployments are visible; cached assets work offline.
  event.respondWith(
    fetch(request).then(response => {
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
      }
      return response;
    }).catch(async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      if (request.mode === 'navigate') {
        const offlinePage = await caches.match('./index.html');
        if (offlinePage) return offlinePage;
      }
      return Response.error();
    })
  );
});
