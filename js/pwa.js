/* js/pwa.js — makes HEADFACE Study installable ("Add to Home Screen" on Android and iOS).
   1. registers the service worker that makes it installable (pwa-worker.js stores nothing but its offline page)
   2. keeps the browser's install offer (Chrome / Edge / Android) so the "install" button of the settings window can use it
   3. wires that button: any element with [data-hf-install]; its section [data-hf-install-section] is hidden once the app is installed.
      Where the browser can not offer an install itself (iOS Safari, other browsers) the steps for the device appear under the button
      ([data-hf-install-steps]) — the same idea as the main site's settings window (js/pwa.js of headface.app). */
(function () {
  'use strict';

  // ---- 1. the service worker -------------------------------------------------------------------------------------------
  if ('serviceWorker' in navigator &&
      (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    // service workers only run on https (and on localhost while developing)
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/pwa-worker.js', { scope: '/' }).catch(function (err) {
        console.warn('[pwa] service worker not registered:', err && err.message ? err.message : err);
      });
    });
  }

  // ---- 2. what this device can do --------------------------------------------------------------------------------------
  var UA = navigator.userAgent || '';
  var deferred = null; // the browser's install offer, once it has made one

  function isStandalone() {
    try { if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true; } catch (_) { /* old browser */ }
    return navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  /** LINE / Facebook / Instagram browsers can not install anything: the page has to be opened in Safari / Chrome first. */
  function inAppBrowser() {
    return /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger/i.test(UA);
  }
  /** 'installed' | 'prompt' (the browser shows its own install window) | 'ios' (Share > Add to Home Screen) | 'manual' (browser menu) */
  function mode() {
    if (isStandalone()) return 'installed';
    if (deferred) return 'prompt';
    if (isIOS()) return 'ios';
    return 'manual';
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault(); // keep the offer for the button instead of letting the browser show its own bar
    deferred = event;
  });
  window.addEventListener('appinstalled', function () { deferred = null; refresh(); });

  // ---- 3. the install button of the settings window --------------------------------------------------------------------
  function refresh() {
    var hide = isStandalone();
    var sections = document.querySelectorAll('[data-hf-install-section]');
    for (var i = 0; i < sections.length; i++) sections[i].hidden = hide;
  }

  function steps() {
    var list = isIOS()
      ? ['แตะปุ่ม แชร์ (ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น) ที่แถบของ Safari', 'เลื่อนลงแล้วเลือก "เพิ่มลงในหน้าจอโฮม"', 'แตะ "เพิ่ม" มุมขวาบน']
      : ['เปิดเมนูของเบราว์เซอร์ (จุดสามจุด ⋮ หรือ ⋯)', 'เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก"', 'ยืนยันการติดตั้ง'];
    if (inAppBrowser()) list = list.concat(['ถ้าเปิดเว็บนี้ในแอป LINE ให้กด "เปิดในเบราว์เซอร์" ก่อน จึงจะติดตั้งได้']);
    return list;
  }

  function showSteps() {
    var boxes = document.querySelectorAll('[data-hf-install-steps]');
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      while (box.firstChild) box.removeChild(box.firstChild);
      steps().forEach(function (text) { var li = document.createElement('li'); li.textContent = text; box.appendChild(li); });
      box.hidden = false;
    }
  }

  /** What the install button does: the browser's own window when it offered one, else the steps for this device. */
  function install() {
    var m = mode();
    if (m === 'installed') return Promise.resolve('installed');
    if (m === 'prompt' && deferred) {
      var offer = deferred;
      deferred = null; // an offer can be used once
      return offer.prompt().then(function () { return offer.userChoice; }).then(function (choice) {
        refresh();
        return choice && choice.outcome ? choice.outcome : 'dismissed';
      }).catch(function () { showSteps(); return 'manual'; });
    }
    showSteps();
    return Promise.resolve('steps');
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('[data-hf-install]') : null;
    if (!target) return;
    event.preventDefault();
    install();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh); else refresh();

  window.HFInstall = { mode: mode, install: install, refresh: refresh };
})();
