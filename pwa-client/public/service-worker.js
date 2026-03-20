const CACHE_NAME = 'unfiltered-campus-v1';

// Install event - just skip waiting
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate event - claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Fetch event - Network first strategy for everything
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 1. Bypass ServiceWorker for API calls, WebSockets, etc.
  if (!url.startsWith('http') || url.includes('/api/') || url.includes('api.')) {
    return; // Let the browser handle this naturally
  }


  event.respondWith(
    fetch(event.request)
      .catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        return cachedResponse || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
