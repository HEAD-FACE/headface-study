/**
 * js/lynx-loader.js — โหลดแชทลอยของ LYNX (AI ผู้ช่วย) เข้ามาในหน้า Study
 *
 * ตัววิดเจ็ตจริง (js/lynx/widget.js) เป็นของเว็บหลัก headface.app: อยู่ใน Shadow DOM ของตัวเอง ใช้ API เดียวกับหน้า /lynx
 * และแยกแชทของ Study ออกจากแชทของแอปการบ้าน ที่อยู่ของเว็บหลักมาจาก env.js ที่เดียว (beta-study → beta.headface.app)
 * โหลดไม่สำเร็จ (ออฟไลน์ ฯลฯ) หน้า Study ทำงานต่อได้ตามปกติ แค่ไม่มีปุ่มแชทลอย
 */
import { getAppBaseUrl } from './env.js';

import(`${getAppBaseUrl()}/js/lynx/widget.js`).catch((err) => {
    console.warn('[lynx] แชทลอยโหลดไม่สำเร็จ:', err?.message || err);
});
