const CACHE_NAME = 'iac-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './assets/app.css',
  './assets/app.js',
  './assets/tailwind.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        urlsToCache.map((url) =>
          cache.add(url).catch(() => null)
        )
      )
    )
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
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
