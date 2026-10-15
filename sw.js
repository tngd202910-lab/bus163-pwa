const CACHE_NAME = 'bus163-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL.map(url => new Request(url, {mode: url.startsWith('http') ? 'no-cors' : 'same-origin'}))).catch(()=>{})));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('bus163-') && k !== CACHE_NAME && k !== 'bus163-tiles-v1').map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isTile = url.hostname.includes('arcgisonline.com') && url.pathname.includes('/tile/');
  if (isTile) {
    event.respondWith(caches.open('bus163-tiles-v1').then(async cache => {
      const cached = await cache.match(req);
      if (cached) return cached;
      try { const response = await fetch(req); if (response && (response.ok || response.type === 'opaque')) cache.put(req, response.clone()); return response; }
      catch (e) { return new Response('', {status: 503, statusText: 'Tile not cached for offline use'}); }
    }));
    return;
  }
  if (url.hostname === 'router.project-osrm.org') return; // route geometry is stored by the app after successful calculation
  if (url.hostname === 'unpkg.com') {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => { if (response && (response.ok || response.type==='opaque')) caches.open(CACHE_NAME).then(cache=>cache.put(req,response.clone())); return response; }).catch(()=>new Response('',{status:503}))));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(response => { if(response.ok) caches.open(CACHE_NAME).then(cache=>cache.put(req,response.clone())); return response; }).catch(()=>caches.match('./index.html'))));
  }
});
