const CACHE_NAME = 'unfiltered-campus-v2';

const STATIC_ASSETS = ['/index.html', '/manifest.json'];

// Install: pre-cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // Do NOT call skipWaiting() — let the browser control when we activate
  // to avoid interrupting WebSocket connections on the current page
});

// Activate: clean up old caches only — do NOT claim clients
// Claiming clients mid-load interrupts Supabase Realtime WebSockets
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
    // No clients.claim() here intentionally
  );
});

// Fetch event — only cache local app shell, bypass EVERYTHING else
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const { origin } = self.location;

  // 🚨 BYPASS LIST — Never intercept these, hand straight to browser:
  // 1. Non-GET requests (POST, PUT, DELETE, etc)
  // 2. Any Supabase request (REST + Realtime WebSocket upgrades)
  // 3. Any external/third-party domain (not our own origin)
  // 4. Our own backend API calls
  // 5. Anything that's not http/https (ws, wss, chrome-extension, etc)
  const isExternal = !url.startsWith(origin);
  const isSupabase = url.includes('supabase.co') || url.includes('supabase.io');
  const isApiCall  = url.includes('/api/');
  const isNonGet   = event.request.method !== 'GET';
  const isNonHttp  = !url.startsWith('http');

  if (isNonHttp || isNonGet || isSupabase || isApiCall || isExternal) {
    return; // Let the browser handle it natively
  }

  // For local static assets only: Cache-first, then network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Only cache valid same-origin responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
