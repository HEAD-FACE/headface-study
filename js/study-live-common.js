/**
 * js/study-live-common.js — ส่วนร่วมของหน้าเรียนโหมดข้อมูลจริง (course / lesson / mock-exam)
 */
import { StudyApiError } from './study-api.js';
import { $, esc, content, notFound } from './study-ui.js';

export const SUBJECT_ID_RE = /^[a-z][a-z0-9-]{1,23}$/;
export const NODE_ID_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;
export const courseUrl = (id) => `course.html?s=${encodeURIComponent(id)}`;
/** ลิงก์ไปบท: ไม่ระบุกิจกรรม = ระบบเลือกให้ (tab=content|quiz|practice = กิจกรรมแรกของชนิดนั้น, ไม่ระบุ = กิจกรรมถัดไปที่ต้องทำ) */
export const lessonUrl = (id, no = 'current', tab = 'content') => `lesson.html?s=${encodeURIComponent(id)}&l=${encodeURIComponent(no)}${tab && tab !== 'content' ? `&tab=${tab}` : ''}`;
/** ลิงก์ไปกิจกรรมหนึ่งวงกลม (node) ของบท */
export const nodeUrl = (id, no, nodeId) => `lesson.html?s=${encodeURIComponent(id)}&l=${encodeURIComponent(no)}&n=${encodeURIComponent(nodeId)}`;
export const mockUrl = (id) => (id ? `mock-exam.html?s=${encodeURIComponent(id)}` : 'mock-exam.html');

export const loading = () => { content.innerHTML = '<div class="loading" role="status" aria-live="polite">กำลังโหลด...</div>'; };

export const messageOf = (err) => (err instanceof StudyApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');

/** หน้าแสดงข้อผิดพลาด: 404 = ไม่พบ, ที่เหลือ = ลองใหม่ได้ (ข้อความมาจาก Backend/ตัวเรียก API เป็นภาษาไทยอยู่แล้ว) */
export function failure(err, { missing, backHref, backLabel, retry }) {
    if (err instanceof StudyApiError && err.status === 404) return notFound(missing, backHref, backLabel);
    $('#pageTitle').textContent = 'โหลดข้อมูลไม่สำเร็จ';
    content.innerHTML = `<section class="notfound" role="alert"><h2>โหลดข้อมูลไม่สำเร็จ</h2><p>${esc(messageOf(err))}</p>
      <div class="notfound-act"><button type="button" class="btn" data-act="retry">ลองใหม่</button><a class="btn btn-line" href="${esc(backHref)}">${esc(backLabel)}</a></div></section>`;
    $('[data-act="retry"]', content).addEventListener('click', retry);
}

export const soonPanel = (title, text) => `<section class="rblock intro fade-in"><span class="tile tile-teal" aria-hidden="true">🛠️</span><h2>${esc(title)}</h2><p>${esc(text)}</p></section>`;
