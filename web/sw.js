/**
 * CAMI TV — Service Worker v1
 * Cache-first offline stratejisi.
 * Tüm statik dosyaları önbelleğe alır.
 */

const CACHE_NAME = 'cami-tv-v1';

const STATIC_FILES = [
    './',
    './index.html',
    './settings.html',
    './manifest.json',
    './css/base.css',
    './css/landscape.css',
    './css/portrait.css',
    './css/animations.css',
    './css/settings.css',
    './js/app.js',
    './js/data-manager.js',
    './js/prayer-engine.js',
    './js/power-manager.js',
    './js/carousel-manager.js',
    './js/display-manager.js',
    './js/settings-manager.js',
    './js/settings.js',
    './js/searchable-select.js',
    './data/ayetler.json',
    './data/hadisler.json',
    './data/esmaulhusna.json',
    './data/dualar.json',
    './data/locations.json',
];

// ──────────────────────────────────────────────────────
// INSTALL — Statik dosyaları önbelleğe al
// ──────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static files');
            // Her dosyayı ayrı ayrı dene, hata olsa bile devam et
            return Promise.allSettled(
                STATIC_FILES.map(url =>
                    cache.add(url).catch(err =>
                        console.warn('[SW] Cache miss (normal):', url, err.message)
                    )
                )
            );
        }).then(() => {
            console.log('[SW] Install complete');
            return self.skipWaiting();
        })
    );
});

// ──────────────────────────────────────────────────────
// ACTIVATE — Eski cache'leri temizle
// ──────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        }).then(() => {
            console.log('[SW] Active');
            return self.clients.claim();
        })
    );
});

// ──────────────────────────────────────────────────────
// FETCH — Cache-first, network fallback
// ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Dış kaynaklara (GitHub, CDN) doğrudan git, önbelleğe alma
    if (url.hostname !== self.location.hostname &&
        url.hostname !== '127.0.0.1' &&
        url.hostname !== 'localhost') {
        return; // Default browser fetch
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                // Cache'den servis et, arka planda güncelle (stale-while-revalidate)
                const networkFetch = fetch(event.request).then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => { }); // Ağ yoksa sessizce başarısız

                return cached;
            }

            // Cache'de yoksa ağdan al
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            }).catch(() => {
                // Hem cache'de hem ağda yoksa — HTML sayfaları için offline fallback
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
