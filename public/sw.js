const CACHE_NAME = 'gloomhaven-companion-v1';
const SHELL = ['index.html', 'manifest.webmanifest', 'icons/icon.svg'];
const MAX_CACHED_FILES = 240;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL.map(file => new URL(file, self.registration.scope)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('gloomhaven-companion-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(new URL('index.html', self.registration.scope), response.clone());
        return response;
      } catch {
        return (await cache.match(new URL('index.html', self.registration.scope))) ?? Response.error();
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      const extras = keys.filter(key => !SHELL.some(file => key.href === new URL(file, self.registration.scope).href));
      if (extras.length > MAX_CACHED_FILES) await Promise.all(extras.slice(0, extras.length - MAX_CACHED_FILES).map(key => cache.delete(key)));
    }
    return response;
  })());
});
