const CACHE_NAME = 'jupos-v9';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './db.js',
    './manifest.json',
    './icon.png',
    'https://unpkg.com/lucide@latest',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(ASSETS))
        .catch(err => console.log('SW Cache error:', err))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Skip Firebase REST API requests
    if (event.request.url.includes('firebasedatabase.app')) return;

    event.respondWith(
        caches.match(event.request, { ignoreSearch: true })
        .then(response => {
            return response || fetch(event.request).catch(() => {
                // Return index if navigation request fails
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
