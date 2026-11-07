// ให้แมว LYNX ลอยอยู่ "เหนือ" แถบล่างของ Study เสมอ ไม่ไปทับปุ่ม
//
// ปัญหาเดิม: วิดเจ็ตของเว็บหลักหลบแถบล่างได้เฉพาะ <nav class="fixed bottom-0"> (คลาส Tailwind ของเว็บหลัก) ส่วน Study ใช้
//   - #bottom-navbar (เมนูล่างของหน้าแรก/รายวิชา/ความคืบหน้า/เส้นทางเรียน/รายงาน)
//   - .abar (แถบปุ่มท้ายกิจกรรม: ถัดไป / ส่งคำตอบ / ทำถูก-ทำผิด / เริ่มสอบ ฯลฯ)
// วิดเจ็ตจึงคิดว่าไม่มีแถบล่าง วางตัวแมว (สูง 95px กว้าง 80px) ไว้ห่างขอบล่าง 8px มุมขวา และตัวแมวอยู่ทับปุ่มขวาสุดของแถบ = กดไม่ได้
// วิธีแก้อยู่ฝั่ง Study: วัดความสูงแถบล่างที่โผล่อยู่จริงแล้วตั้ง --offset ของ #lynx-widget ให้เอง (ไม่แก้โค้ดของเว็บหลัก)

export const BAR_SELECTOR = '#bottom-navbar, .abar';
/** หน้าต่างซ้อนที่เปิดอยู่ (รายการข้อใน Mock, ภาพขยาย, ข้อมูลดาว): มีปุ่มชิดขอบล่างขวา แมวห้ามบัง → ซ่อนแมวชั่วคราว */
export const MODAL_SELECTOR = '.ov, .zoomv, #star-info-modal[aria-hidden="false"]';
export const OFFSET_GAP = 16; // ระยะห่างระหว่างแมวกับแถบ เท่ากับที่วิดเจ็ตใช้กับ nav ของเว็บหลัก

/**
 * ความสูง (px) ที่แถบล่างบังหน้าจอจากขอบล่างขึ้นมา
 * แถบที่ยังเลื่อนเข้ามาไม่ถึง (translateY) หรือซ่อนอยู่ นับตามตำแหน่งจริงบนจอ
 * @param {Array<{top:number,height:number}>} rects  กรอบของแถบทุกอัน (getBoundingClientRect)
 * @param {number} viewportHeight
 */
export function coveredHeight(rects, viewportHeight) {
    let h = 0;
    for (const r of rects) {
        if (!r || !(r.height > 0)) continue;
        const covered = viewportHeight - r.top;
        if (covered > 0) h = Math.max(h, Math.min(covered, r.height + 2));
    }
    return Math.round(h);
}

/** ค่า --offset ที่ควรตั้งให้วิดเจ็ต (px) — ไม่มีแถบเลย = ค่าเดิมของวิดเจ็ต (16px) */
export function offsetFor(rects, viewportHeight) {
    return coveredHeight(rects, viewportHeight) + OFFSET_GAP;
}

/**
 * เริ่มเฝ้าแถบล่าง: ตั้ง --offset ตอนเริ่ม เมื่อหน้าเปลี่ยน (Barba) เมื่อแถบถูกวาดใหม่/เปลี่ยนสูง (แถบตัดสินถูก-ผิด) และเมื่อหมุนจอ
 * คืนฟังก์ชันหยุดเฝ้า
 */
export function watchLynxOffset(doc = document, win = window) {
    let queued = false;
    let last = null;
    const apply = () => {
        queued = false;
        const host = doc.getElementById('lynx-widget');
        if (!host) return;
        const rects = Array.from(doc.querySelectorAll(BAR_SELECTOR)).map((el) => el.getBoundingClientRect());
        const px = offsetFor(rects, win.innerHeight);
        const hide = doc.querySelector(MODAL_SELECTOR) ? 'hidden' : '';
        if (host.style.visibility !== hide) host.style.visibility = hide;
        if (px !== last || host.style.getPropertyValue('--offset') !== `${px}px`) {
            last = px;
            host.style.setProperty('--offset', `${px}px`);
        }
    };
    const schedule = () => {
        if (queued) return;
        queued = true;
        (win.setTimeout || setTimeout)(apply, 30); // ไม่ใช้ requestAnimationFrame: แท็บที่ถูกซ่อน/จอพับไม่เรียก แล้วค่าจะไม่ถูกตั้ง
    };
    const cleanups = [];
    const on = (target, type, fn) => { target.addEventListener(type, fn, true); cleanups.push(() => target.removeEventListener(type, fn, true)); };
    on(win, 'resize', schedule);
    on(win, 'orientationchange', schedule);
    on(doc, 'animationend', schedule);     // .abar เลื่อนเข้าด้วย animation: วัดอีกครั้งเมื่อเข้าที่แล้ว
    on(doc, 'transitionend', schedule);
    if (typeof win.MutationObserver === 'function' && doc.body) {
        const mo = new win.MutationObserver(schedule); // วิดเจ็ตเพิ่งถูกใส่เข้าหน้า / แถบถูกวาดใหม่ / เปลี่ยนหน้าแบบ Barba
        mo.observe(doc.body, { childList: true, subtree: true });
        cleanups.push(() => mo.disconnect());
    }
    if (typeof win.ResizeObserver === 'function') {
        const ro = new win.ResizeObserver(schedule);
        ro.observe(doc.documentElement);
        cleanups.push(() => ro.disconnect());
    }
    schedule();
    const t = setInterval(schedule, 1500); // กันพลาด: แถบเปลี่ยนสูงด้วยเหตุที่ไม่มีเหตุการณ์แจ้ง (เช่น ตัวอักษรโหลดเสร็จ)
    cleanups.push(() => clearInterval(t));
    return () => cleanups.forEach((fn) => fn());
}
