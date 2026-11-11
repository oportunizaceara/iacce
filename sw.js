const CACHE_NAME = 'iac-v91';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/app.css',
  './assets/shell.css',
  './assets/modules.css',
  './assets/glass.css',
  './assets/dates.js',
  './assets/app.js',
  './assets/views.js',
  './assets/indicators.js',
  './assets/instructors-boot.js',
  './assets/team.js',
  './assets/audit.js',
  './assets/demands.js',
  './assets/calendar-board.js',
  './assets/notify-center.js',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'IAC - Notificação', body: event.data ? event.data.text() : 'Nova notificação' };
  }
  const title = data.title || 'IAC - Notificação';
  const options = {
    body: data.body || 'Nova notificação',
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200],
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch(() => {
      const opts = { ...options };
      delete opts.icon;
      delete opts.badge;
      return self.registration.showNotification(title, opts);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
