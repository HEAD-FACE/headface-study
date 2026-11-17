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
   ไม่มีข้อมูลส่วนตัวในคุกกี้: มีแค่คำว่า light หรือ dark (ค่า system = ไม่มีคุกกี้)

   ธีมรางวัล (css/skins.css): นักเรียนเลือกธีมที่หน้าโปรไฟล์ของเว็บหลัก แล้วทั้งแอปรวม Study เปลี่ยนสี ไฟล์นี้ใส่ <html data-hf-skin="...">
   ก่อนวาดหน้า จากคุกกี้ "hf_skin" (production) / "hf_skin_beta" (preview) ของโดเมนแม่ ที่เว็บหลักและ Study เขียนไว้เมื่อรู้ว่าใส่ธีมอะไร
   ค่า = "<ชื่อธีม>.<เวลาที่แพลนหมดอายุเป็น ms หรือ 0>" (ธีมของ PLUS/MAX ไม่ถูกวาดหลังแพลนหมด) — js/study-identity.js ยืนยันกับเซิร์ฟเวอร์อีกครั้ง
   ไม่มีคุกกี้ / ชื่อธีมที่ไม่รู้จัก = หน้าตาปกติ */
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

  // ───── ธีมรางวัล: ชื่อธีมที่ css/skins.css รู้จัก และสีแถบสถานะของแต่ละธีม (ต้องตรงกับ SKINS ใน js/theme-init.js ของเว็บหลัก) ─────
  var SKINS = { ocean: "#0b7f95", aurora: "#1f1050", gold: "#101221", neon: "#0b0620" };

  // production (study.headface.app) กับ preview (beta-study.headface.app, localhost) ใช้คุกกี้คนละชื่อ เหมือนคุกกี้ล็อกอิน
  function skinCookieName() {
    var host = (location.hostname || "").toLowerCase();
    var production = (host === "headface.app" || /\.headface\.app$/.test(host)) && !/(^|\.)beta/.test(host);
    return production ? "hf_skin" : "hf_skin_beta";
  }

  /** ธีมที่ใส่อยู่ตามคุกกี้ ("" = หน้าตาปกติ): เฉพาะชื่อที่รู้จัก และแพลนของธีมยังไม่หมดอายุ */
  function readSkin() {
    try {
      var m = new RegExp("(?:^|;\\s*)" + skinCookieName() + "=([^;]*)").exec(document.cookie || "");
      var parts = (m ? decodeURIComponent(m[1]) : "").split(".");
      var key = parts[0];
      var ends = Number(parts[1]) || 0;
      if (!Object.prototype.hasOwnProperty.call(SKINS, key)) return "";
      return ends > 0 && Date.now() >= ends ? "" : key;
    } catch (e) {
      return "";
    }
  }

  function writeSkin(key, ends) {
    try {
      var known = Object.prototype.hasOwnProperty.call(SKINS, key);
      var secure = location.protocol === "https:" ? "; Secure" : "";
      var value = known ? key + "." + (Number(ends) > 0 ? Math.floor(Number(ends)) : 0) : "";
      document.cookie = skinCookieName() + "=" + value + "; Path=/" + cookieDomain() + "; SameSite=Lax" + secure + (known ? "; Max-Age=31536000" : "; Max-Age=0");
    } catch (e) { /* คุกกี้ถูกบล็อก: ธีมยังใช้ได้ในหน้านี้ */ }
  }

  function paintSkin(key) {
    try {
      if (key) { if (root.getAttribute("data-hf-skin") !== key) root.setAttribute("data-hf-skin", key); }
      else if (root.getAttribute("data-hf-skin") !== null && root.removeAttribute) root.removeAttribute("data-hf-skin");
    } catch (e) { /* หน้าตาปกติ */ }
  }

  // แถบสถานะของเบราว์เซอร์/แอปที่ติดตั้ง: สีเดียวกับหัวหน้าเว็บในแต่ละธีม
  function paintMeta(theme) {
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      var skin = root.getAttribute("data-hf-skin");
      if (meta) meta.setAttribute("content", skin && SKINS[skin] ? SKINS[skin] : theme === "dark" ? "#064E3B" : "#10B981");
    } catch (e) { /* ไม่มี meta */ }
  }

  function apply() {
    var mode = readMode();
    var theme = effective(mode);
    paintSkin(readSkin());
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

  /** เซิร์ฟเวอร์บอกว่าใส่ธีมอะไร (js/study-identity.js): จำไว้ในคุกกี้และวาดทันที — key ว่าง = หน้าตาปกติ */
  function setSkin(key, ends) {
    var known = Object.prototype.hasOwnProperty.call(SKINS, key);
    var live = known && !(Number(ends) > 0 && Date.now() >= Number(ends));
    writeSkin(live ? key : "", ends);
    paintSkin(live ? key : "");
    paintMeta(root.getAttribute("data-theme") || effective(readMode()));
    return live ? key : "";
  }

  window.HFTheme = {
    getMode: readMode,
    getTheme: function () { return root.getAttribute("data-theme") || effective(readMode()); },
    setMode: setMode,
    refreshControls: refreshControls,
    getSkin: function () { return root.getAttribute("data-hf-skin") || ""; },
    setSkin: setSkin
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
