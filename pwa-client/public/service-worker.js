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
  // We don't want to handle WebSockets or other protocols
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // Fallback or just let it fail naturally if offline
        return caches.match(event.request);
      })
  );
});
