/**
 * js/lynx-loader.js — โหลดแชทลอยของ LYNX (AI ผู้ช่วย) เข้ามาในหน้า Study
 *
 * ตัววิดเจ็ตจริง (js/lynx/widget.js) เป็นของเว็บหลัก headface.app: อยู่ใน Shadow DOM ของตัวเอง ใช้ API เดียวกับหน้า /lynx
 * และแยกแชทของ Study ออกจากแชทของแอปการบ้าน ที่อยู่ของเว็บหลักมาจาก env.js ที่เดียว (beta-study → beta.headface.app, study → headface.app)
 * โหลดไม่สำเร็จ (ออฟไลน์ ฯลฯ) หน้า Study ทำงานต่อได้ตามปกติ แค่ไม่มีปุ่มแชทลอย
 *
 * ตัวแมวต้องไม่ทับปุ่มของ Study: js/study-lynx-offset.js ดันแมวให้ลอยเหนือแถบล่าง (เมนูล่าง / แถบปุ่มท้ายกิจกรรม)
 */
import { getAppBaseUrl } from './env.js';
import { watchLynxOffset } from './study-lynx-offset.js';

// เริ่มเฝ้าแถบล่างตั้งแต่ตอนนี้: ตัววิดเจ็ตจะถูกใส่เข้าหน้าทีหลัง (MutationObserver จับได้เอง)
try { watchLynxOffset(); } catch (err) { console.warn('[lynx] จัดตำแหน่งแมวไม่สำเร็จ:', err?.message || err); }

import(`${getAppBaseUrl()}/js/lynx/widget.js`).catch((err) => {
    console.warn('[lynx] แชทลอยโหลดไม่สำเร็จ:', err?.message || err);
});
