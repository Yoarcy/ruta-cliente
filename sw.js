const CACHE = 'ruta-cliente-v34-phone-cloud-mirror';
const ASSETS = ['./', './index.html', './styles.css?v=34-phone-cloud-mirror', './app.js?v=34-phone-cloud-mirror', './manifest.webmanifest', './icons/icon.svg'];
self.addEventListener('install', (event) => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request).catch(() => caches.match(event.request))));
