/* js/theme.js — เลือกธีมสี (สว่าง / มืด) ของ HEADFACE Study "ก่อนวาดหน้า" หน้ามืดจะได้ไม่วาบขาว
   โหลดเป็น <script> ธรรมดาใน <head> ก่อน stylesheet (ไฟล์เล็กและไม่พึ่งอะไร)

   ใช้กติกาเดียวกับเว็บหลัก (js/theme-init.js ของ headface.app): ค่าที่ผู้ใช้เลือกคือ "system" (ตามเครื่อง ค่าเริ่มต้น) | "light" | "dark"
   และตั้ง 2 attribute ที่ <html>:
     data-theme       = "light" | "dark"                ธีมที่แสดงจริง (css/dark.css ทำงานเมื่อเป็น "dark" เท่านั้น)
     data-theme-mode  = "system" | "light" | "dark"     สิ่งที่ผู้ใช้เลือก
   ปุ่มใดก็ตามที่มี data-hf-theme-choice="system|light|dark" จะสลับธีมได้ (ตัวเลือกในหน้าต่างตั้งค่า js/study-settings.js)

   ทำไมต้องมีคุกกี้: เว็บหลักเก็บค่าใน localStorage "hf_theme" ซึ่งแยกตามโดเมน (headface.app กับ study.headface.app มองเห็นกันไม่ได้)
   Study จึงเก็บค่าเดียวกันไว้ในคุกกี้ "hf_theme" ของโดเมนแม่ .headface.app ด้วย ให้เว็บหลักอ่านได้เมื่อเว็บหลักเพิ่มโค้ดอ่านคุกกี้นี้
   (ดู docs/theme-sync.md) ลำดับการอ่านที่ Study: คุกกี้ → localStorage → ตามเครื่อง
   ไม่มีข้อมูลส่วนตัวในคุกกี้: มีแค่คำว่า light หรือ dark (ค่า system = ไม่มีคุกกี้) */
(function () {
  "use strict";
  var KEY = "hf_theme";
  var MODES = ["system", "light", "dark"];
  var root = document.documentElement;
  var query = null;

  function readCookie() {
    try {
      var m = /(?:^|;\s*)hf_theme=([^;]*)/.exec(document.cookie || "");
      var value = m ? decodeURIComponent(m[1]) : "";
      return value === "light" || value === "dark" ? value : "";
    } catch (e) {
      return "";
    }
  }

  function cookieDomain() {
    var host = (location.hostname || "").toLowerCase();
    return host === "headface.app" || /\.headface\.app$/.test(host) ? "; Domain=.headface.app" : "";
  }

  function writeCookie(mode) {
    try {
      var secure = location.protocol === "https:" ? "; Secure" : "";
      var base = "hf_theme=" + (mode === "system" ? "" : mode) + "; Path=/" + cookieDomain() + "; SameSite=Lax" + secure;
      document.cookie = mode === "system" ? base + "; Max-Age=0" : base + "; Max-Age=31536000";
    } catch (e) { /* คุกกี้ถูกบล็อก: ธีมยังใช้ได้ในเครื่องนี้ผ่าน localStorage */ }
  }

  function readMode() {
    var fromCookie = readCookie();
    if (fromCookie) return fromCookie;
    try {
      var value = localStorage.getItem(KEY);
      return MODES.indexOf(value) > -1 ? value : "system";
    } catch (e) {
      return "system";
    }
  }

  function systemPrefersDark() {
    try {
      if (!query) query = window.matchMedia("(prefers-color-scheme: dark)");
      return query.matches;
    } catch (e) {
      return false;
    }
  }

  function effective(mode) {
    return mode === "dark" || (mode === "system" && systemPrefersDark()) ? "dark" : "light";
  }

  // แถบสถานะของเบราว์เซอร์/แอปที่ติดตั้ง: สีเดียวกับหัวหน้าเว็บในแต่ละธีม
  function paintMeta(theme) {
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", theme === "dark" ? "#064E3B" : "#10B981");
    } catch (e) { /* ไม่มี meta */ }
  }

  function apply() {
    var mode = readMode();
    var theme = effective(mode);
    if (root.getAttribute("data-theme") !== theme) root.setAttribute("data-theme", theme);
    if (root.getAttribute("data-theme-mode") !== mode) root.setAttribute("data-theme-mode", mode);
    paintMeta(theme);
    return theme;
  }

  function refreshControls(scope) {
    var mode = readMode();
    var buttons = (scope || document).querySelectorAll("[data-hf-theme-choice]");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-checked", String(buttons[i].getAttribute("data-hf-theme-choice") === mode));
    }
  }

  function setMode(mode) {
    if (MODES.indexOf(mode) < 0) return readMode();
    try {
      if (mode === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch (e) { /* localStorage ถูกบล็อก: ใช้คุกกี้/หน้านี้อย่างเดียว */ }
    writeCookie(mode);
    // ถ้าคุกกี้ก็เขียนไม่ได้ readMode() จะไม่เห็นค่าใหม่ จึงตั้งตรง ๆ ให้หน้านี้
    var theme = effective(mode);
    root.setAttribute("data-theme-mode", mode);
    root.setAttribute("data-theme", theme);
    paintMeta(theme);
    refreshControls();
    try { window.dispatchEvent(new CustomEvent("headface:theme", { detail: { mode: mode, theme: theme } })); } catch (e) { /* เบราว์เซอร์เก่า */ }
    return mode;
  }

  apply();

  window.HFTheme = {
    getMode: readMode,
    getTheme: function () { return root.getAttribute("data-theme") || effective(readMode()); },
    setMode: setMode,
    refreshControls: refreshControls
  };

  // ตามเครื่องเมื่อผู้ใช้เลือก "system"
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemChange = function () { if (readMode() === "system") apply(); };
    if (mq.addEventListener) mq.addEventListener("change", onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  } catch (e) { /* ไม่มี matchMedia */ }

  // แท็บอื่นเปลี่ยนค่า
  window.addEventListener("storage", function (event) {
    if (event.key === KEY || event.key === null) { apply(); refreshControls(); }
  });

  // กลับมาจาก bfcache / สลับกลับมาที่แท็บ (เว็บหลักอาจเปลี่ยนคุกกี้ไปแล้ว): อ่านใหม่
  window.addEventListener("pageshow", function (event) { if (event && event.persisted) { apply(); refreshControls(); } });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { apply(); refreshControls(); } });

  document.addEventListener("click", function (event) {
    var target = event.target;
    var button = target && target.closest ? target.closest("[data-hf-theme-choice]") : null;
    if (button) setMode(button.getAttribute("data-hf-theme-choice"));
  });

  function ready() { refreshControls(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
})();
