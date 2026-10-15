
const CACHE_NAME = 'bus163-shell-v2';
const TILE_CACHE = 'bus163-tiles-v1';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

const LEAFLET_FILES = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Các tệp của ứng dụng phải được lưu trước.
    await cache.addAll(SHELL);

    // Thử lưu Leaflet riêng, không để lỗi CDN
    // làm hỏng toàn bộ quá trình cài đặt.
    await Promise.all(LEAFLET_FILES.map(async url => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (error) {
        // Sẽ thử tải lại khi có mạng.
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(keys
      .filter(key =>
        key.startsWith('bus163-shell-') &&
        key !== CACHE_NAME
      )
      .map(key => caches.delete(key)));

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Lưu các ô bản đồ ArcGIS đã xem khi có mạng.
  const isTile =
    url.hostname.includes('arcgisonline.com') &&
    url.pathname.includes('/tile/');

  if (isTile) {
    event.respondWith((async () => {
      const cache = await caches.open(TILE_CACHE);
      const saved = await cache.match(request);

      if (saved) return saved;

      try {
        const response = await fetch(request);

        if (response.ok || response.type === 'opaque') {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return new Response(
          'Ô bản đồ chưa được lưu để dùng ngoại tuyến.',
          { status: 503 }
        );
      }
    })());
    return;
  }

  // Leaflet: ưu tiên bản đã lưu.
  if (url.hostname === 'unpkg.com') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const saved = await cache.match(request);

      if (saved) return saved;

      try {
        const response = await fetch(request);

        if (response.ok) {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return new Response(
          'Thư viện Leaflet chưa được lưu ngoại tuyến.',
          { status: 503 }
        );
      }
    })());
    return;
  }

  // Không chặn dịch vụ tìm đường OSRM.
  if (url.hostname === 'router.project-osrm.org') return;

  // Các tệp cùng nguồn: ưu tiên cache khi mất mạng.
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const saved = await cache.match(request);

      if (saved) return saved;

      try {
        const response = await fetch(request);

        if (response.ok) {
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        if (request.mode === 'navigate') {
          return (await cache.match('./index.html')) ||
                 (await cache.match('./'));
        }

        return new Response('Không có tài nguyên ngoại tuyến.', {
          status: 503
        });
      }
    })());
  }
});
