const CACHE_NAME = 'pagos-pro-v2';
const APP_SHELL = [
    './',
    './index.html',
    './panel.html',
    './cliente.html',
    './style.css',
    './app.js',
    './panel.js',
    './cliente.js',
    './manifest.json',
    './icono.png',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(APP_SHELL);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estrategia Network-First (Red Primero -> Fallback a Caché si estás Offline)
// Esto garantiza que al recargar la página con internet siempre descargue la versión más nueva de GitHub
// sin necesidad de borrar el caché del celular manualmente, y si no hay internet usa la copia guardada.
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // No interceptar llamadas a la API de Firebase Auth / Firestore
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com') ||
        url.hostname.includes('securetoken.googleapis.com')
    ) {
        return;
    }

    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request, { cache: 'no-cache' })
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Si el celular está sin internet (Modo Offline), servimos desde el caché local
                return caches.match(event.request, { ignoreSearch: true });
            })
    );
});
