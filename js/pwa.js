/* js/pwa.js — registers the service worker that makes HEADFACE Study installable ("Add to Home Screen" on Android and iOS).
   The worker itself (pwa-worker.js) stores nothing but its offline page: see the note at the top of that file. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  // service workers only run on https (and on localhost while developing)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/pwa-worker.js', { scope: '/' }).catch(function (err) {
      console.warn('[pwa] service worker not registered:', err && err.message ? err.message : err);
    });
  });
})();
