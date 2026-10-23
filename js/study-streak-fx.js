/**
 * js/study-streak-fx.js — "เติมไฟ": แอนิเมชันได้รับไฟเมื่อทำกิจกรรมเสร็จครั้งแรกของวัน
 *
 * Backend ตอบ `streakUp: { current, longest, extended }` เฉพาะคำขอที่ทำให้วันนี้ถูกนับเป็นครั้งแรก (src/study/streakService.js)
 * study-api.js ส่งต่อเป็นเหตุการณ์ `study:streak` ที่นี่เล่นแอนิเมชัน 2 อย่าง:
 *   1) ป้ายลอยด้านบนจอ (ไม่บังและไม่ขวางการเรียน): เปลวไฟสีเทาที่ยังไม่ติด → ติดไฟวูบ (ขยาย เรืองแสง ประกายกระจาย) + ข้อความ
 *      "ได้รับไฟแล้ววันนี้!" และจำนวนวันที่ต่อเนื่อง; แตะเพื่อปิด หรือหายเองใน ~3.4 วินาที
 *   2) จำไว้ใน sessionStorage ว่า "เพิ่งติดไฟ" เพื่อให้การ์ด Streak ของหน้าแรก/ความคืบหน้าเล่นไฟติดซ้ำตอนเปิดหน้านั้น (igniteStreakCard)
 * ปลอดภัยเสมอ: ไม่มี DOM / ผู้ใช้ตั้งลดการเคลื่อนไหว = ป้ายยังขึ้น (ข้อมูลสำคัญ) แต่ไม่มีการเคลื่อนไหว; ไม่เปลี่ยนข้อมูลใด ๆ
 */
import { burst, confetti, pop, reducedMotion } from './study-fx.js';

const FLAG = 'study:streak-ignite';
const SHOW_MS = 3400;
const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function' && !!document.body;

/** เปลวไฟ SVG: id ไล่สีไม่ซ้ำเพื่อไม่ชนกับเปลวไฟอื่นในหน้า */
export const flameSvg = (id, size = 44) => `<svg class="sk-flame" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0%" y1="100%" x2="0%" y2="0%"><stop offset="0%" stop-color="#EA580C"/><stop offset="45%" stop-color="#F97316"/><stop offset="80%" stop-color="#FBBF24"/><stop offset="100%" stop-color="#FDE047"/></linearGradient></defs><path d="M10 2c0 -.88 1.056 -1.331 1.692 -.722c1.958 1.876 3.096 5.995 1.75 9.12l-.08 .174l.012 .003c.625 .133 1.203 -.43 2.303 -2.173l.14 -.224a1 1 0 0 1 1.582 -.153c1.334 1.435 2.601 4.377 2.601 6.27c0 4.265 -3.591 7.705 -8 7.705s-8 -3.44 -8 -7.706c0 -2.252 1.022 -4.716 2.632 -6.301l.605 -.589c.241 -.236 .434 -.43 .618 -.624c1.43 -1.512 2.145 -2.924 2.145 -4.78" fill="url(#${id})"/><path d="M12 12c.9 1.6 2 2.5 2 4.2a2 2 0 0 1 -4 0c0-1.7 1.1-2.6 2-4.2z" fill="#FFF7ED" opacity="0.85"/></svg>`;

/** ข้อความของป้าย: วันแรก / ต่อเนื่องกี่วัน */
export function litMessage(up) {
    const days = Math.max(1, Math.floor(Number(up && up.current) || 1));
    return {
        title: 'ได้รับไฟแล้ววันนี้!',
        sub: up && up.extended && days > 1 ? `ต่อเนื่อง ${days} วันแล้ว รักษาไฟไว้ให้ได้นะ` : 'เริ่มนับ Streak วันแรกแล้ว!',
        days,
    };
}

/** อ่าน/เขียนธง "เพิ่งติดไฟ" (sessionStorage ใช้ไม่ได้ก็ไม่เป็นไร) */
export function markIgnitePending() {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(FLAG, '1'); } catch (_) { /* ไม่ใช้ก็ได้ */ }
}
export function takeIgnitePending() {
    try {
        if (typeof sessionStorage === 'undefined' || !sessionStorage.getItem(FLAG)) return false;
        sessionStorage.removeItem(FLAG);
        return true;
    } catch (_) {
        return false;
    }
}

let current = null;

/** ป้ายเติมไฟ: คืน element (หรือ null ถ้าไม่มี DOM) */
export function showStreakLit(up, { delay = 650 } = {}) {
    if (!hasDom()) return null;
    markIgnitePending();
    const text = litMessage(up);
    if (current && typeof current.remove === 'function') current.remove();
    const el = document.createElement('div');
    el.className = 'sk-lit';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `<span class="sk-ring" aria-hidden="true"></span><span class="sk-icon">${flameSvg('sk-lit-g', 46)}</span><span class="sk-t"><b>${text.title}</b><small>${text.sub}</small></span><span class="sk-n" aria-label="${text.days} วัน"><b>${text.days}</b><small>วัน</small></span>`;
    document.body.appendChild(el);
    current = el;
    const close = () => {
        if (!el.classList) return;
        el.classList.add('is-out');
        setTimeout(() => { if (typeof el.remove === 'function') el.remove(); if (current === el) current = null; }, 320);
    };
    if (typeof el.addEventListener === 'function') el.addEventListener('click', close);
    const play = () => {
        if (el.classList) el.classList.add('is-on');
        if (!reducedMotion()) {
            const icon = typeof el.querySelector === 'function' ? el.querySelector('.sk-icon') : null;
            if (icon) { pop(icon, { scale: 1.45, ms: 700 }); burst(icon, { count: 16, radius: 80, colors: ['#FDE047', '#FBBF24', '#F97316', '#EA580C', '#FFF7ED'] }); }
            if (up && up.extended && Number(up.current) % 7 === 0) confetti({ count: 90 }); // ครบสัปดาห์: ฉลองใหญ่
        }
        setTimeout(close, SHOW_MS);
    };
    // รอให้เอฟเฟกต์ของคำตอบ (เฉลย/ดาว) เล่นจบก่อน ไม่ทับกัน
    setTimeout(play, reducedMotion() ? 0 : delay);
    return el;
}

/** การ์ด Streak ในหน้า: เล่นไฟติดซ้ำถ้าเพิ่งติดไฟจากกิจกรรมเมื่อกี้ (ครั้งเดียว) และวันนี้ติดอยู่จริง */
export function igniteStreakCard(card) {
    if (!card || !card.classList || !takeIgnitePending()) return false;
    card.classList.remove('ignite');
    void card.offsetWidth; // เริ่มแอนิเมชันใหม่
    card.classList.add('ignite');
    if (!reducedMotion() && typeof card.querySelector === 'function') {
        const flame = card.querySelector('svg');
        if (flame) setTimeout(() => burst(flame, { count: 12, radius: 60, colors: ['#FDE047', '#FBBF24', '#F97316', '#FFF7ED'] }), 350);
    }
    return true;
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('study:streak', (event) => showStreakLit(event && event.detail));
}
