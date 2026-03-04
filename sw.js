const CACHE_NAME = 'iac-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache aberto');
        // Tentar adicionar arquivos, mas não falhar se alguns não existirem
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => {
              console.debug(`Arquivo não encontrado (pode ser normal): ${url}`);
              return null;
            })
          )
        );
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'IAC - Notificação';
  const options = {
    body: data.body || 'Nova notificação',
    // Ícones opcionais - não falha se não existirem
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [200, 100, 200],
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch(err => {
      console.debug('Erro ao mostrar notificação (ícones podem não existir):', err);
      // Tentar sem ícones
      const optionsWithoutIcons = { ...options };
      delete optionsWithoutIcons.icon;
      delete optionsWithoutIcons.badge;
      return self.registration.showNotification(title, optionsWithoutIcons);
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});


