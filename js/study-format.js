/**
 * js/study-format.js — ตัวช่วยจัดรูปแบบที่ไม่แตะ DOM (ใช้ร่วมกันทั้งโหมดข้อมูลจริงและโหมดตัวอย่าง และทดสอบใน Node ได้)
 */
const CHOICE_LABELS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];

/** ป้ายตัวเลือกตามลำดับตำแหน่ง (ก ข ค ง จ ฉ) ไม่ผูกกับ id ของตัวเลือก */
export const choiceLabel = (i) => CHOICE_LABELS[i] || String(i + 1);

export function scoreMessage(percent) {
    if (percent >= 80) return 'ยอดเยี่ยม';
    if (percent >= 60) return 'ทำได้ดี';
    if (percent >= 40) return 'พอใช้ ลองทบทวนอีกนิด';
    return 'ลองกลับไปทบทวนเนื้อหาอีกครั้ง';
}

/** วินาที → "mm:ss" (ไม่ติดลบ) */
export function formatClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** เวลา (ISO text หรือ epoch ms) → "14 ต.ค. 09:05" ตามเขตเวลาของเครื่อง; ค่าที่อ่านไม่ได้ → "" */
export function formatThaiDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
