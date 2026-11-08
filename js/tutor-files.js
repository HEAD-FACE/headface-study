/**
 * js/tutor-files.js — ไฟล์ที่นักเรียนแนบให้ AI Tutor (ส่วนที่ไม่พึ่งเบราว์เซอร์ เทสต์ใน Node ได้)
 *
 * รูป        → ย่อและแปลงเป็น JPEG ในเบราว์เซอร์ แล้วส่งเป็นภาพ (js/tutor-media.js)
 * ข้อความ    → อ่านเป็นข้อความ ตัดไม่เกิน textChars ตัวอักษรแล้วส่งเป็นข้อความ
 * PDF        → ดึงข้อความในเบราว์เซอร์ (pdf.js) แล้วส่งแบบเดียวกับข้อความ
 * อย่างอื่น  → ไม่รับ (บอกเหตุผลเป็นภาษาไทย)
 * ข้อความทั้งก้อนอยู่ในบริบทของบทสนทนาและถูกคิดเงินซ้ำทุกรอบ จึงจำกัดขนาดไว้เล็ก
 */

export const FILE_LIMITS = Object.freeze({
    imageBytes: 12 * 1024 * 1024,
    textBytes: 1024 * 1024,
    pdfBytes: 15 * 1024 * 1024,
    textChars: 8000,
    maxImageSide: 1280,
    jpegQuality: 0.8
});

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i;

/** @returns {{kind: 'image'|'text'|'pdf'|'unsupported', reason?: string}} */
export function classifyFile({ name = '', type = '', size = 0 }) {
    const mime = String(type || '').toLowerCase();
    const bytes = Number(size) || 0;
    if (mime.startsWith('image/') || IMAGE_EXT.test(name)) {
        return bytes > FILE_LIMITS.imageBytes ? { kind: 'unsupported', reason: 'รูปใหญ่เกิน 12 MB' } : { kind: 'image' };
    }
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
        return bytes > FILE_LIMITS.pdfBytes ? { kind: 'unsupported', reason: 'ไฟล์ PDF ใหญ่เกิน 15 MB' } : { kind: 'pdf' };
    }
    if (mime.startsWith('text/') || mime === 'application/json' || TEXT_EXT.test(name)) {
        return bytes > FILE_LIMITS.textBytes ? { kind: 'unsupported', reason: 'ไฟล์ข้อความใหญ่เกิน 1 MB' } : { kind: 'text' };
    }
    return { kind: 'unsupported', reason: 'รองรับรูปภาพ, PDF และไฟล์ข้อความ (.txt .md .csv)' };
}

/** ตัดข้อความให้ไม่เกิน max ตัวอักษร (ไม่ตัดกลางอักขระที่เป็นคู่ซึ่ง JS นับเป็น 2) */
export function clipText(text, max = FILE_LIMITS.textChars) {
    const clean = String(text ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (clean.length <= max) return { text: clean, clipped: false };
    let cut = max;
    const code = clean.charCodeAt(cut - 1);
    if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
    return { text: clean.slice(0, cut), clipped: true };
}

/** ข้อความที่ส่งให้ AI เมื่อแนบไฟล์ข้อความ/PDF */
export function attachmentPrompt(name, text, clipped) {
    const safeName = String(name || 'ไฟล์').replace(/[\r\n]+/g, ' ').slice(0, 120);
    return `นักเรียนแนบไฟล์ "${safeName}" มาให้ดู${clipped ? ' (ตัดมาเฉพาะช่วงต้น)' : ''} ช่วยอ่านแล้วถามนักเรียนว่าอยากให้ช่วยเรื่องไหน\n\n${text}`;
}

/** ขนาดภาพที่ย่อแล้ว: ด้านยาวสุดไม่เกิน maxSide และไม่ขยายภาพเล็ก */
export function fitSize(width, height, maxSide = FILE_LIMITS.maxImageSide) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    const longest = Math.max(w, h);
    if (longest <= maxSide) return { width: w, height: h };
    const k = maxSide / longest;
    return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

/**
 * ภาพเปลี่ยนไปจากเฟรมที่ส่งไปล่าสุดมากพอหรือไม่ (เทียบภาพย่อ 16×16 ระดับเทา): ใช้ตัดสินว่าจะส่งเฟรมกล้องอีกหรือไม่
 * กล้องที่ตั้งนิ่ง ๆ ไม่ต้องส่งซ้ำ — ทุกเฟรมที่ส่งอยู่ในบริบทและถูกคิดเงินซ้ำทุกรอบ
 * @param {ArrayLike<number>|null} previous  ค่าเทา 0..255 ของเฟรมก่อน
 * @param {ArrayLike<number>} current
 */
export function sceneChanged(previous, current, threshold = 12) {
    if (!previous || previous.length !== current.length || current.length === 0) return true;
    let diff = 0;
    for (let i = 0; i < current.length; i++) diff += Math.abs(previous[i] - current[i]);
    return diff / current.length >= threshold / 4; // เฉลี่ยต่างกันเกิน ~3 ระดับเทา
}
