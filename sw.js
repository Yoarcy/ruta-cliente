const CACHE = 'ruta-cliente-v32-offline-persistence';
const ASSETS = ['./', './index.html', './styles.css?v=32-offline-persistence', './app.js?v=32-offline-persistence', './manifest.webmanifest', './icons/icon.svg'];
self.addEventListener('install', (event) => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request).catch(() => caches.match(event.request))));
