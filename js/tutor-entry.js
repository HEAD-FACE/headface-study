/**
 * js/tutor-entry.js — ปุ่ม "คุยกับ AI Tutor" ในหน้าแรกและหัวหน้าบทเรียน
 *
 * ปุ่มใน HTML ซ่อนอยู่ (hidden) เสมอ และไฟล์นี้เปิดให้เห็นเมื่อ GET /api/study/me บอกว่า AI Tutor เปิดใช้ในสภาพแวดล้อมนี้ (tutor.open)
 * - เปิดอยู่ + แพลนมีสิทธิ์ → ปุ่มปกติ
 * - เปิดอยู่ + แพลนไม่มีสิทธิ์ (FREE) → ปุ่มพร้อมป้าย "PLUS" (กดแล้วเข้าหน้าอธิบายแพลน ไม่ใช่หน้าคุย)
 * - ยังไม่เปิด / เรียก API ไม่ได้ → ไม่เห็นปุ่ม (ไม่ทิ้งปุ่มที่กดแล้วเจอแต่หน้า "ยังไม่เปิด")
 * ปุ่มในหัวหน้าบทเรียนพา s / l ของบทนี้ไปด้วย เพื่อให้ AI Tutor รู้ว่านักเรียนกำลังเรียนบทไหน
 */
import { studyApi } from './study-api.js';

/** @returns {{show: boolean, locked: boolean}} */
export function entryView(me) {
    const open = me?.tutor?.open === true;
    return { show: open, locked: open && me?.entitlements?.aiTutor?.enabled !== true };
}

/** ลิงก์ไปหน้าคุย พร้อมวิชา/บทที่กำลังเรียน (เฉพาะค่าที่รูปแบบถูกต้อง) */
export function tutorHref(search) {
    const params = new URLSearchParams(search || '');
    const s = params.get('s');
    const l = Number(params.get('l'));
    if (!s || !/^[a-z][a-z0-9-]{1,23}$/.test(s)) return 'tutor.html';
    return Number.isInteger(l) && l >= 1 && l <= 9999 ? `tutor.html?s=${encodeURIComponent(s)}&l=${l}` : `tutor.html?s=${encodeURIComponent(s)}`;
}

export function applyEntries(doc, view, search = '') {
    for (const section of doc.querySelectorAll('[data-tutor-entry-section]')) section.hidden = !view.show;
    for (const el of doc.querySelectorAll('[data-tutor-entry]')) {
        el.hidden = !view.show;
        if (el.hasAttribute('data-tutor-context')) el.setAttribute('href', tutorHref(search));
        const lock = el.querySelector('[data-tutor-locked]');
        if (lock) lock.hidden = !view.locked;
    }
}

let pending = null;

export async function initTutorEntry({ doc = typeof document === 'undefined' ? null : document, api = studyApi, search = typeof location === 'undefined' ? '' : location.search } = {}) {
    if (!doc || !doc.querySelector('[data-tutor-entry]')) return null;
    pending ||= (async () => {
        try {
            const me = await api.getMe();
            const view = entryView(me);
            applyEntries(doc, view, search);
            return view;
        } catch (_) {
            return null; // ไม่รู้สถานะ = ไม่แสดงปุ่ม
        } finally {
            pending = null;
        }
    })();
    return pending;
}

if (typeof document !== 'undefined') {
    initTutorEntry();
    // หน้าแรกสลับหน้าด้วย Barba: main.js ส่ง study:page ทุกครั้งที่หน้าถูกแสดง
    document.addEventListener('study:page', () => { initTutorEntry(); });
}
