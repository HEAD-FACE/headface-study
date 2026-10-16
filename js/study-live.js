/**
 * js/study-live.js — หน้าเรียนด้วยข้อมูลจริงจาก Backend (สัญญา: docs/study-api-contract.md)
 * ใช้กับ lesson.html (กิจกรรมหนึ่งวงกลม) / mock-exam.html / report.html (เลือกโดย js/study-flow.js)
 *
 * หน้าเส้นทางเรียนของวิชา (course.html) แยกอยู่ใน js/study-course.js เพราะเปลี่ยนหน้าด้วย Barba ร่วมกับหน้าหลัก
 */
import { initNode } from './study-node.js';
import { initMockExam } from './study-live-mock.js';
import { initReport } from './study-live-report.js';
import { courseUrl, lessonUrl, nodeUrl } from './study-live-common.js';

export const FEATURES = Object.freeze({ progress: true, quiz: true, practice: true, mock: true });

export { courseUrl, lessonUrl, nodeUrl };

// หน้า Mock Exam (mock-exam.html[?s=KEY]) อยู่ใน js/study-live-mock.js
export const initExam = initMockExam;

export function initLive(page) {
    const init = { lesson: initNode, exam: initExam, report: initReport }[page];
    if (init) return init();
}
