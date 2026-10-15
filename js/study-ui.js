/**
 * js/study-ui.js — ตัวช่วยหน้าตาที่ใช้ร่วมกันของหน้าเรียน (course / lesson / mock-exam)
 * ทั้งโหมดตัวอย่าง (study-flow.js) และโหมดข้อมูลจริง (study-live.js) ใช้ไฟล์นี้ร่วมกัน
 */

const hasDom = typeof document !== 'undefined';
export const $ = (selector, root = document) => root.querySelector(selector);
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
export const content = hasDom ? $('#content') : null;
export const view = hasDom ? $('#view') : null;

// ───────────── ไอคอน ─────────────
const STAR_D = 'M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z';
const CHEV_D = 'M7 6l-.112 .006a1 1 0 0 0 -.669 1.619l3.501 4.375l-3.5 4.375a1 1 0 0 0 .78 1.625h6a1 1 0 0 0 .78 -.375l4 -5a1 1 0 0 0 0 -1.25l-4 -5a1 1 0 0 0 -.78 -.375h-6z';
const line = (size, inner, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const ICON = {
    check: (s = 18, w = 3) => line(s, '<path d="M5 12l5 5l10 -10"/>', w),
    x: (s = 18, w = 3) => line(s, '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>', w),
    down: (s = 20) => line(s, '<path d="M6 9l6 6l6 -6"/>', 2.5),
    flag: (s = 18) => line(s, '<path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9z"/><path d="M5 21v-7"/>'),
    clock: (s = 18) => line(s, '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>'),
    grid: (s = 18) => line(s, '<path d="M4 4h6v6h-6z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6h-6z"/><path d="M14 14h6v6h-6z"/>'),
    info: (s = 18) => line(s, '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 9h.01"/><path d="M11 12h1v4h1"/>'),
    doc: (s = 20) => line(s, '<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/><path d="M9 12h6"/><path d="M9 16h6"/>'),
    list: (s = 20) => line(s, '<path d="M13 5h8"/><path d="M13 9h5"/><path d="M13 15h8"/><path d="M13 19h5"/><path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>'),
    star: (s = 18, fill = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><path d="${STAR_D}"/></svg>`,
    next: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${CHEV_D}"/></svg>`,
    lessonDone: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#059669"/><path d="M7.5 12.5l3 3l6 -6.5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lessonNow: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#059669" stroke-width="2"/><path d="M12 2.5a9.5 9.5 0 0 0 0 19z" fill="#059669"/></svg>',
    lessonTodo: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#64748B" stroke-width="2"/></svg>',
};

// ───────────── ตัวช่วยร่วม ─────────────
export function notFound(message, backHref, backLabel) {
    document.title = 'HEADFACE Study - ไม่พบหน้า';
    $('#pageTitle').textContent = 'ไม่พบหน้าที่ต้องการ';
    content.innerHTML = `<section class="notfound" role="alert"><h2>${esc(message)}</h2><p>ลิงก์อาจไม่ถูกต้อง หรือยังไม่มีข้อมูลของหน้านี้</p><a class="btn" href="${esc(backHref)}">${esc(backLabel)}</a></section>`;
}

export function setTheme(subject) {
    const hue = typeof subject.hue === 'string' && /^[a-z]{3,12}$/.test(subject.hue) ? subject.hue : 'emerald';
    document.body.classList.add(`hue-${hue}`);
}

export function focusView() {
    if (view) view.focus({ preventScroll: true });
}

// ───────────── วงแหวนคะแนนและแถบปุ่มล่าง (Quiz / Mock Exam) ─────────────
export function ringHtml(percent, label) {
    const C = 2 * Math.PI * 54;
    return `<div class="ring" role="img" aria-label="${esc(label)}">
      <svg viewBox="0 0 132 132"><circle class="trk" cx="66" cy="66" r="54"/><circle class="val" cx="66" cy="66" r="54" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-target="${(C * (1 - percent / 100)).toFixed(2)}"/></svg>
      <div class="ring-t"><b>${percent}%</b><span>${esc(label)}</span></div>
    </div>`;
}

export function animateRing(root) {
    const val = $('.ring .val', root);
    if (val) setTimeout(() => { val.style.strokeDashoffset = val.dataset.target; }, 40);
}

export const abar = (inner) => `<div class="abar"><div class="abar-in">${inner}</div></div>`;
