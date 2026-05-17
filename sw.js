/* Travel App Service Worker – OSM tile cache + app shell */
var TILE_CACHE = 'tv-tiles-v1';
var APP_CACHE  = 'tv-app-v5';

var APP_SHELL = [
  './travel-app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(APP_CACHE).then(function(cache) {
      return Promise.all(APP_SHELL.map(function(url) {
        return cache.add(url).catch(function(){});
      }));
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

  /* Only intercept OSM tile requests for offline caching.
     Fetch as cors so we get a non-opaque (cacheable) response.
     OSM serves tiles with Access-Control-Allow-Origin: * */
  if (/\/\/[abc]\.tile\.openstreetmap\.org\//.test(url)) {
    e.respondWith(
      caches.open(TILE_CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          if (cached) return cached;
          return fetch(url, {mode: 'cors'}).then(function(res) {
            if (res && res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(function() {
            return new Response('', {status: 503});
          });
        });
      })
    );
    return;
  }

  /* Navigate requests: serve app shell from cache if offline */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(function() {
        return caches.match('./travel-app.html');
      })
    );
    return;
  }

  /* All other requests (Leaflet JS/CSS, fonts, xlsx, etc.):
     fall through to browser\'s normal network handling – no interference */
});
