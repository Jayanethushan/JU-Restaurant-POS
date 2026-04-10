const CACHE_NAME = 'jupos-v13';
const LOCAL_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './db.js',
    './manifest.json',
    './icon.png'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Cache local files robustly
            return Promise.allSettled(
                LOCAL_ASSETS.map(url => cache.add(url).catch(err => console.warn(`SW Failed to cache ${url}`, err)))
            );
        })
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
    const req = event.request;
    // Skip non-GET requests and Firebase API
    if (req.method !== 'GET' || req.url.includes('firebasedatabase.app')) return;

    event.respondWith(
        caches.match(req, { ignoreSearch: true }).then(cachedRes => {
            if (cachedRes) {
                // If it's a local script/css, try to update it in background (Stale-While-Revalidate)
                if (req.url.includes(self.location.origin)) {
                    fetch(req).then(netRes => {
                        if (netRes.ok) {
                            caches.open(CACHE_NAME).then(cache => cache.put(req, netRes));
                        }
                    }).catch(() => {}); // silent fail if offline
                }
                return cachedRes;
            }

            // Not in cache, fetch and dynamically cache
            return fetch(req).then(netRes => {
                // Cache successful responses including CDNs (ignore opaque responses for safety though)
                if (netRes && (netRes.status === 200 || netRes.type === 'opaque')) {
                    const resClone = netRes.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
                }
                return netRes;
            }).catch(err => {
                // Offline fallback for navigation
                if (req.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                throw err;
            });
        })
    );
});
