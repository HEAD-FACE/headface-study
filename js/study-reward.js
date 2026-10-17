/**
 * js/study-reward.js — แสดง EXP ที่ได้รับ (กติกาอยู่ที่ Backend: docs/study-api-contract.md หัวข้อ "รางวัล")
 *
 * Backend ส่ง reward มากับผลของกิจกรรมที่จบ: { exp, baseExp, firstTime, halved, stars, totals }
 *   - ครั้งแรกที่ทำวงกลมนั้นเสร็จได้เต็ม ครั้งต่อ ๆ ไปได้ครึ่งเดียว (halved) — ที่นี่แค่แสดง ไม่คำนวณเอง
 *   - reward เป็น null เมื่อไม่ได้อะไร (เช่น ทำซ้ำถี่เกินไป หรือระบบรางวัลยังไม่เปิด) → ไม่แสดงอะไรเลย
 */

const BOLT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/></svg>';

/**
 * EXP ที่จะได้ก่อนเริ่มทำ: "อย่างน้อย +N EXP" (ทำเสร็จก็ได้เท่านี้ แม้ไม่ถูกเลย) และ "สูงสุด +M" (ถ้าถูกหมด)
 * reward = { exp|max (สูงสุด), min, repeat } จาก Backend — ทำซ้ำได้ครึ่งเดียว Backend หารมาให้แล้ว ที่นี่แค่แสดง
 */
export function expRangeChipsHtml(reward) {
    const top = reward ? (reward.max !== undefined ? reward.max : reward.exp) : 0; // node.reward = { exp (สูงสุด), min } / mock.reward และ attempt.reward = { max, min }
    if (!reward || !(Number(top) > 0)) return '';
    const max = Math.round(Number(top));
    const min = reward.min === undefined ? max : Math.round(Number(reward.min));
    const main = min === max
        ? `<span class="chip chip-amber">${BOLT} +${max} EXP</span>`
        : `<span class="chip chip-amber">${BOLT} อย่างน้อย +${min} EXP</span><span class="chip chip-g">สูงสุด +${max}</span>`;
    return `${main}${reward.repeat ? '<span class="chip chip-g">ทำซ้ำ ได้ครึ่งเดียว</span>' : ''}`;
}

/** ป้ายเล็กบอก EXP ที่จะได้ (ใช้ในหัวหน้าเนื้อหา/Practice) ว่างเมื่อไม่มีข้อมูล */
export function expTagHtml(reward) {
    if (!reward || !(Number(reward.exp) > 0)) return '';
    return `<span class="xp-pill cn-xp" aria-label="ได้ ${Math.round(Number(reward.exp))} EXP เมื่อเสร็จ">${BOLT} +${Math.round(Number(reward.exp))}</span>`;
}
