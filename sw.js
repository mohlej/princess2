const CACHE = 'princess-study-planner-v3-hub';
const PREFIX = 'princess-study-planner-';
const ASSETS = ['./', './index.html', './style.css', './app.js', './pomodoro.js', './data.js', './hub.js', './tabs.js', './manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key.startsWith(PREFIX) && key !== CACHE)
      .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Online: نسخه‌ی جدید سایت گرفته می‌شود. Offline: فایل‌های ذخیره‌شده به کار می‌روند.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(req, copy)));
      }
      return response;
    }).catch(() => caches.match(req))
  );
});
