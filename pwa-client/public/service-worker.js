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

  // 🚨 CRITICAL: Bypass ServiceWorker for ALL API calls and external domains
  // We check for /api/ and api.incog.sbs to ensure real-time communication is never blocked
  if (!url.startsWith('http') || url.includes('/api/') || url.includes('api.incog.sbs')) {
    return; // Hand control back to the browser immediately
  }

  event.respondWith(
    fetch(event.request)
      .catch(async () => {
        try {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) return cachedResponse;
          
          // If no cache, return a friendly offline response instead of undefined
          return new Response('Network Error', { 
            status: 408, 
            statusText: 'Network Timeout or CORS failure',
            headers: { 'Content-Type': 'text/plain' }
          });
        } catch (err) {
          return new Response('Fatal ServiceWorker Error', { status: 500 });
        }
      })
  );
});
