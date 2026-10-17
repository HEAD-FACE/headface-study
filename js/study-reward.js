/**
 * js/study-reward.js — แสดง EXP ที่ได้รับ (กติกาอยู่ที่ Backend: docs/study-api-contract.md หัวข้อ "รางวัล")
 *
 * Backend ส่ง reward มากับผลของกิจกรรมที่จบ: { exp, baseExp, firstTime, halved, stars, totals }
 *   - ครั้งแรกที่ทำวงกลมนั้นเสร็จได้เต็ม ครั้งต่อ ๆ ไปได้ครึ่งเดียว (halved) — ที่นี่แค่แสดง ไม่คำนวณเอง
 *   - reward เป็น null เมื่อไม่ได้อะไร (เช่น ทำซ้ำถี่เกินไป หรือระบบรางวัลยังไม่เปิด) → ไม่แสดงอะไรเลย
 */
import { reducedMotion, countUp } from './study-fx.js';

const BOLT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/></svg>';

/** ป้าย "+N EXP" (และ "ทำซ้ำ ได้ครึ่งเดียว" เมื่อเป็นการทำซ้ำ) ว่างเมื่อไม่ได้ EXP */
export function expPillHtml(reward) {
    if (!reward || !(Number(reward.exp) > 0)) return '';
    const exp = Math.round(Number(reward.exp));
    return `<span class="pill gold exp-pill" aria-label="ได้รับ ${exp} EXP">${BOLT}<span>+<span data-exp-count="${exp}">${exp}</span> EXP</span></span>${reward.halved ? '<span class="pill">ทำซ้ำ ได้ครึ่งเดียว</span>' : ''}`;
}

/** ตัวเลข EXP นับขึ้นจาก 0 (ข้ามเมื่อผู้ใช้ปิดแอนิเมชัน หรือไม่มี DOM จริง) */
export function animateReward(root) {
    if (!root || typeof root.querySelectorAll !== 'function' || reducedMotion()) return;
    root.querySelectorAll('[data-exp-count]').forEach((el) => countUp(el, Number(el.dataset.expCount), { ms: 900 }));
}
