/**
 * Savage Command Center — Enhanced Service Worker (PWA)
 *
 * Strategy:
 * - App shell (HTML, CSS, JS): Cache First with network fallback
 * - API calls (/api/*): Network First with stale-while-revalidate fallback
 * - Integration assets: Cache First
 * - Push notifications: handled via self.addEventListener('push')
 *
 * Cache versioning: bump CACHE_VERSION on deploy to invalidate stale assets.
 */

const CACHE_VERSION = 'v3';
const SHELL_CACHE = `savage-shell-${CACHE_VERSION}`;
const DATA_CACHE = `savage-data-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

/** Assets that form the app shell — cached on install */
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  OFFLINE_PAGE,
];

// ---- Install: cache the app shell ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ---- Activate: purge old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch: routing strategy ----
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, browser-extension, and WebSocket requests
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API requests: Network First, fall back to stale cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, DATA_CACHE));
    return;
  }

  // App shell: Cache First, fall back to network then offline page
  event.respondWith(cacheFirstWithOfflineFallback(request, SHELL_CACHE));
});

// ---- Push Notifications ----
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Savage Command Center';
  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.url ? { url: data.url } : {},
    vibrate: [100, 50, 100],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      const existing = cs.find((c) => c.url === url && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// ---- Background Sync (reconnect integrations) ----
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-integrations') {
    event.waitUntil(
      self.clients.matchAll().then((cs) =>
        cs.forEach((c) => c.postMessage({ type: 'SYNC_INTEGRATIONS' }))
      )
    );
  }
});

// ---- Strategy helpers ----

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName });
    return cached ?? new Response(JSON.stringify({ error: 'Offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirstWithOfflineFallback(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const offlinePage = await caches.match(OFFLINE_PAGE);
    return offlinePage ?? new Response('Offline', { status: 503 });
  }
}
