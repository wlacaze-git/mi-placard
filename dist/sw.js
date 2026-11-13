/* Service worker de Mi Placard: la app abre aunque no haya internet. */
var VERSION = 'mi-placard-v4';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/catalog.js',
  './js/colors.js',
  './js/db.js',
  './js/photo.js',
  './js/sample.js',
  './js/recommend.js',
  './js/vision.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== VERSION) return caches.delete(key);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url;
  try { url = new URL(request.url); } catch (err) { return; }

  // La librería de reconocimiento vive en un CDN: se cachea para poder usarla offline.
  if (url.origin !== self.location.origin) {
    if (url.hostname === 'cdn.jsdelivr.net') {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  // Navegación: red primero, cache como respaldo.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(VERSION).then(function (cache) { cache.put('./index.html', copy); });
        return response;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  // Archivos propios: cache primero, y se actualiza en segundo plano.
  event.respondWith(cacheFirst(request));
});

function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (response) {
      if (response && (response.ok || response.type === 'opaque')) {
        var copy = response.clone();
        caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    });
  });
}
