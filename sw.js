/* Travel App Service Worker – offline shell + tile cache */
var TILE_CACHE = 'tv-tiles-v1';
var APP_CACHE  = 'tv-app-v3';

var APP_URLS = [
  './travel-app.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(APP_CACHE).then(function(cache) {
      return cache.addAll(APP_URLS).catch(function(){});
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if(k !== TILE_CACHE && k !== APP_CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  /* Tile requests (OpenStreetMap) – cache-first, then network */
  if (/tile\.openstreetmap\.org|openstreetmap\.org\/tiles/.test(url)) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(e.request.clone(), {mode:'cors'}).then(function(res) {
            if (res && res.status === 200) {
              cache.put(e.request, res.clone());
            }
            return res;
          }).catch(function() {
            return cached || new Response('', {status:503});
          });
        });
      })
    );
    return;
  }

  /* App shell – network-first, fallback to cache */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function(res) {
        if (res && res.status === 200) {
          caches.open(APP_CACHE).then(function(c){ c.put(e.request, res.clone()); });
        }
        return res;
      }).catch(function() {
        return caches.match(e.request).then(function(r){ return r || fetch(e.request); });
      })
    );
    return;
  }

  /* Leaflet/fonts – stale-while-revalidate */
  if (/unpkg\.com\/leaflet|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url)) {
    e.respondWith(
      caches.open(APP_CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var fetchPromise = fetch(e.request).then(function(res) {
            if (res && res.status === 200) cache.put(e.request, res.clone());
            return res;
          }).catch(function(){ return cached; });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }
});
