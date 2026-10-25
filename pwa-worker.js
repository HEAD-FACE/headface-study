// HEADFACE Study app worker (the "HEADFACE Study" app: study.headface.app). Registered by js/pwa.js.
//
// What it is for: the browsers only offer "Add to Home Screen" as a real app when the site has a worker, and when the phone has no
// network the app shows a short "you are offline" page instead of the browser's error page. It does NOTHING else:
//   - it never stores pages, scripts, styles or API answers (the site is deployed often and the opening schedule in js/launch.js
//     must be read fresh every time), so nobody can be stuck on an old version because of it;
//   - it only looks at page loads (navigations) of this site; images, scripts and every request to the API go straight to the network;
//   - the one thing it keeps is the offline page and the logo that page shows.
//

const VERSION = 'study-pwa-v1';
const OFFLINE_URL = '/offline.html';
const KEPT = [OFFLINE_URL, '/assets/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.all(KEPT.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== VERSION) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // the logo of the offline page
  if (KEPT.includes(url.pathname) && url.pathname !== OFFLINE_URL) {
    event.respondWith(caches.match(url.pathname).then((hit) => hit || fetch(request)));
    return;
  }

  // a page load: the network as always; only when there is no network, the offline page
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error()));
  }
});
