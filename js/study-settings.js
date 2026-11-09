/**
 * js/study-settings.js — หน้าต่าง "ตั้งค่าระบบ" ของ HEADFACE Study (ปุ่มฟันเฟืองที่หัวหน้า)
 *
 * เนื้อหาเหมือนหน้าต่างตั้งค่าของเว็บหลัก (dashboard.html): การแจ้งเตือนผ่าน LINE · แพ็กเกจและการชำระเงิน · ติดตั้งแอป · การแสดงผล (ธีม)
 * สองหัวข้อแรกเป็นหน้าของเว็บหลัก จึงเป็นลิงก์ไปที่นั่น (ปลายทางมาจาก js/env.js ที่เดียว ไม่ hard-code โดเมน)
 * ธีมใช้ js/theme.js (ตั้งค่าเดียวกับเว็บหลัก) ส่วน "ติดตั้งแอป" ใช้ window.HFInstall จาก js/pwa.js
 *
 * ปุ่มเปิด = องค์ประกอบใดก็ได้ที่มี data-settings-open (ผูกแบบ event delegation: ใช้ได้แม้หัวหน้าถูกสลับด้วย Barba)
 * หน้าต่างสร้างตอนเปิดครั้งแรกครั้งเดียว ปิดได้ด้วยปุ่ม ✕ / กดฉากหลัง / ปุ่ม Esc; โฟกัสถูกขังไว้ในหน้าต่างและคืนให้ปุ่มเดิมเมื่อปิด
 */
import { getAppBaseUrl } from './env.js';

const svg = (inner, size = 18, w = 2) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const GEAR = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14.647 4.081a.724 .724 0 0 0 1.08 .448c2.439 -1.485 5.23 1.305 3.745 3.744a.724 .724 0 0 0 .447 1.08c2.775 .673 2.775 4.62 0 5.294a.724 .724 0 0 0 -.448 1.08c1.485 2.439 -1.305 5.23 -3.744 3.745a.724 .724 0 0 0 -1.08 .447c-.673 2.775 -4.62 2.775 -5.294 0a.724 .724 0 0 0 -1.08 -.448c-2.439 1.485 -5.23 -1.305 -3.745 -3.744a.724 .724 0 0 0 -.447 -1.08c-2.775 -.673 -2.775 -4.62 0 -5.294a.724 .724 0 0 0 .448 -1.08c-1.485 -2.439 1.305 -5.23 3.744 -3.745a.722 .722 0 0 0 1.08 -.447c.673 -2.775 4.62 -2.775 5.294 0zm-2.647 4.919a3 3 0 1 0 0 6a3 3 0 0 0 0 -6" /></svg>';
const CHEVRON = svg('<path d="m9 18 6-6-6-6"/>', 16, 2.5);
const ICON = {
    system: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', 16, 2.2),
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 16, 2.2),
    dark: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', 16, 2.2)
};

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** ข้อความของหน้าต่างทั้งหมด (HTML) — แยกเป็นฟังก์ชันล้วนเพื่อเทสต์ใน Node */
export function renderSettings({ appBase }) {
    const link = (path, title, text) => `
        <a class="st-link" href="${esc(`${appBase}/${path}`)}" data-barba-prevent="self">
          <span class="st-link-t"><b>${title}</b><span>${text}</span></span>
          <span class="st-go">${CHEVRON}</span>
        </a>`;
    return `
      <div class="st-back" data-settings-close></div>
      <div class="st-card" role="dialog" aria-modal="true" aria-labelledby="stTitle" tabindex="-1">
        <div class="st-head">
          <div class="st-title"><span class="st-title-ic">${GEAR}</span><h2 id="stTitle">ตั้งค่าระบบ</h2></div>
          <button type="button" class="st-x" data-settings-close aria-label="ปิดหน้าต่างตั้งค่า">${svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 16, 2.5)}</button>
        </div>
        <div class="st-body">
          <section class="st-sec">
            <h3 class="st-h3">การแจ้งเตือน (Notifications)</h3>
            ${link('notifications.html', 'ตารางแจ้งเตือนผ่าน LINE', 'เลือกประเภทงาน เวลา และวันที่ให้บอทเตือนทางแชท LINE (HEADFACE+ 2 ตาราง · MAX 3 ตาราง)')}
          </section>
          <section class="st-sec">
            <h3 class="st-h3">แพ็กเกจและการชำระเงิน (Payments)</h3>
            ${link('payments.html', 'ประวัติการชำระเงินและใบเสร็จ', 'ดูแพ็กเกจของคุณ วันหมดอายุ แพ็กเกจที่รอเริ่มใช้งาน ประวัติการชำระเงิน และใบเสร็จ')}
          </section>
          <section class="st-sec" data-hf-install-section hidden>
            <h3 class="st-h3">ติดตั้งแอป (Install)</h3>
            <button type="button" class="st-link" data-hf-install>
              <span class="st-link-t"><b>ติดตั้ง HEADFACE Study ลงหน้าจอหลัก</b><span>เปิดได้จากหน้าจอหลักของเครื่องเหมือนแอป เต็มจอ ไม่ต้องพิมพ์ที่อยู่เว็บ</span></span>
              <span class="st-install-btn">ติดตั้ง</span>
            </button>
            <ol class="st-steps" data-hf-install-steps hidden></ol>
          </section>
          <section class="st-sec is-plain" data-hf-theme-section>
            <h3 class="st-h3">การแสดงผล (Appearance)</h3>
            <div class="st-seg" role="radiogroup" aria-label="โหมดการแสดงผล">
              <button type="button" role="radio" aria-checked="false" data-hf-theme-choice="system">${ICON.system}ตามเครื่อง</button>
              <button type="button" role="radio" aria-checked="false" data-hf-theme-choice="light">${ICON.light}สว่าง</button>
              <button type="button" role="radio" aria-checked="false" data-hf-theme-choice="dark">${ICON.dark}มืด</button>
            </div>
            <p class="st-note">"ตามเครื่อง" จะสลับสว่าง/มืดตามการตั้งค่าของอุปกรณ์ · จำค่าไว้เฉพาะในเครื่องนี้</p>
          </section>
        </div>
      </div>`;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function initSettings({ doc = document, win = window } = {}) {
    let modal = null;
    let opener = null;

    const build = () => {
        modal = doc.createElement('div');
        modal.className = 'st-modal';
        modal.id = 'settingsModal';
        modal.innerHTML = renderSettings({ appBase: getAppBaseUrl() });
        doc.body.appendChild(modal);
        win.HFTheme?.refreshControls?.(modal);
        win.HFInstall?.refresh?.();
        return modal;
    };

    function open(from) {
        opener = from || doc.activeElement;
        const el = modal || build();
        win.HFTheme?.refreshControls?.(el);
        win.HFInstall?.refresh?.();
        el.classList.add('is-open');
        doc.documentElement.classList.add('st-lock');
        // เฟรมถัดไปค่อยเล่นแอนิเมชันเข้า (ต้องมีสถานะเริ่มต้นก่อน)
        win.requestAnimationFrame(() => el.classList.add('is-shown'));
        el.querySelector('.st-x')?.focus({ preventScroll: true });
    }

    function close() {
        if (!modal || !modal.classList.contains('is-open')) return;
        modal.classList.remove('is-shown');
        const done = () => { modal.classList.remove('is-open'); doc.documentElement.classList.remove('st-lock'); };
        if (win.matchMedia?.('(prefers-reduced-motion: reduce)').matches) done(); else win.setTimeout(done, 300);
        opener?.focus?.({ preventScroll: true });
        opener = null;
    }

    doc.addEventListener('click', (e) => {
        const openBtn = e.target.closest?.('[data-settings-open]');
        if (openBtn) { e.preventDefault(); open(openBtn); return; }
        if (e.target.closest?.('[data-settings-close]')) close();
    });
    doc.addEventListener('keydown', (e) => {
        if (!modal?.classList.contains('is-open')) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key === 'Tab') {
            const items = [...modal.querySelectorAll(FOCUSABLE)].filter((x) => x.getClientRects().length > 0);
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    });
    return { open, close, get element() { return modal; } };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    window.StudySettings = initSettings();
}
