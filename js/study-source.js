/**
 * js/study-source.js — เลือกแหล่งข้อมูลของหน้าเรียน: ข้อมูลจริงจาก Backend หรือข้อมูลตัวอย่าง (demo)
 *
 * ค่าเริ่มต้นคือข้อมูลจริงเสมอ โหมดตัวอย่างเปิดได้เฉพาะโดเมน preview (beta-study / localhost)
 * โดยเติม ?demo=1 ที่ URL (จำไว้ใน sessionStorage ของแท็บนั้น) และปิดด้วย ?demo=0
 * บน production ไม่มีทางเปิดโหมดตัวอย่าง เพื่อไม่ให้นักเรียนเห็นข้อมูลปลอมเป็นข้อมูลจริง
 */
import { getEnvironmentName } from './env.js';

const DEMO_KEY = 'study_demo';

export function isDemo() {
    if (typeof window === 'undefined' || typeof location === 'undefined') return false;
    if (getEnvironmentName() !== 'preview') return false;
    try {
        const flag = new URLSearchParams(location.search).get('demo');
        if (flag === '1') sessionStorage.setItem(DEMO_KEY, '1');
        if (flag === '0') sessionStorage.removeItem(DEMO_KEY);
        return sessionStorage.getItem(DEMO_KEY) === '1';
    } catch (_) {
        return false;
    }
}
