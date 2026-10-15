// ทดสอบหน้าผลการเรียนรายวิชา (js/study-live-report.js): ภาพรวม, จุดที่ควรทบทวน/จุดแข็ง (ไม่สรุปเมื่อข้อมูลน้อย),
// ผลรายบท, ประวัติ Quiz, แนวโน้ม Mock, ข้อผิดพลาด และการ escape
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './fakeDom.mjs';

const dom = installFakeDom();
const { initReport, reviewHtml, trendHtml } = await import('../js/study-live-report.js');
const { StudyApiError } = await import('../js/study-api.js');
const { params } = await import('../js/study-ui.js');

const REPORT = {
    subject: { id: 'sci', title: 'วิทยาศาสตร์ <b>', eyebrow: 'วิชาที่ 1', hue: 'emerald', emoji: '🔬' },
    progress: { lessonsTotal: 3, lessonsDone: 1, pct: 33, lastActivityAt: 1790000000000 },
    lessons: [
        { no: 1, title: 'บทแรก', status: 'done', quiz: { best: { correct: 3, total: 3 }, attempts: 2, passed: true }, practice: { done: 1, ok: 1, total: 3 } },
        { no: 2, title: 'บทสอง <i>', status: 'now', quiz: { best: null, attempts: 0, passed: false }, practice: { done: 0, ok: 0, total: 0 } },
        { no: 3, title: 'บทสาม', status: 'todo', quiz: { best: null, attempts: 0, passed: false }, practice: { done: 0, ok: 0, total: 0 } },
    ],
    answers: { total: 11, correct: 7, accuracy: 64 },
    quiz: { recent: [{ lessonNo: 1, at: 1790000000000, correct: 3, total: 3, percent: 100 }] },
    mock: {
        available: true,
        attempts: [
            { attemptId: 'ma_2', status: 'submitted', at: 1790000000000, percent: 80, correct: 4, total: 5, secondsUsed: 600, starsEarned: 6 },
            { attemptId: 'ma_1', status: 'expired', at: 1780000000000, percent: 40, correct: 2, total: 5, secondsUsed: 1200, starsEarned: 2 },
        ],
        best: { percent: 80, attemptId: 'ma_2' },
        trend: [{ at: 1780000000000, percent: 40 }, { at: 1790000000000, percent: 80 }],
    },
    review: {
        sufficient: true, minAnswersPerTopic: 5,
        topics: [
            { topic: 'หัวข้อ B', correct: 1, total: 6, accuracy: 17, level: 'weak', lessons: [{ no: 1, title: 'บทแรก' }, { no: 3, title: 'บทสาม' }] },
            { topic: 'หัวข้อ C <u>', correct: 3, total: 5, accuracy: 60, level: 'ok', lessons: [] },
            { topic: 'หัวข้อ A', correct: 9, total: 10, accuracy: 90, level: 'strong', lessons: [{ no: 1, title: 'บทแรก' }] },
        ],
        pending: [{ topic: 'หัวข้อ D', total: 2 }],
        message: null,
    },
};

async function open(api, key = 'sci') {
    for (const k of [...params.keys()]) params.delete(k);
    if (key !== null) params.set('s', key);
    await initReport({ api });
}
const api = (over = {}) => ({ getSubjectProgress: async () => REPORT, ...over });
const html = () => dom.content.innerHTML;

beforeEach(() => dom.reset());

describe('ภาพรวมและหัวข้อ', () => {
    test('แสดงความคืบหน้า คำตอบที่ระบบตรวจ Mock ที่ดีที่สุด และปุ่มเรียนต่อไปบทที่ค้าง', async () => {
        await open(api());
        const h = html();
        assert.equal(dom.el.pageTitle.textContent, 'วิทยาศาสตร์ <b>', 'textContent ปลอดภัยอยู่แล้ว');
        assert.equal(dom.el.eyebrow.textContent, 'ผลการเรียนรายวิชา');
        assert.match(dom.el.pageMeta.textContent, /ทำล่าสุด/);
        assert.equal(dom.el.backLink.href, 'progress.html');
        assert.match(h, /33%<\/span><span class="cap">ความคืบหน้า/);
        assert.match(h, /เรียนแล้ว 1 จาก 3 บทเรียน/);
        assert.match(h, /64%[\s\S]*จาก 11 ข้อ \(Quiz และ Mock\)/);
        assert.match(h, /Mock Exam ดีที่สุด<\/span><span class="v">80%/);
        assert.match(h, /href="lesson\.html\?s=sci&l=2"[^>]*><span>เรียนต่อ/, 'บทแรกที่ยังไม่เสร็จ');
    });

    test('ยังไม่เริ่ม → "เริ่มเรียน" และเครื่องหมาย "—" แทนตัวเลขที่ยังไม่มี; เรียนครบ → ดูบทเรียนทั้งหมด', async () => {
        const empty = { ...REPORT, progress: { lessonsTotal: 3, lessonsDone: 0, pct: 0, lastActivityAt: null }, answers: { total: 0, correct: 0, accuracy: null }, mock: { available: true, attempts: [], best: null, trend: [] }, quiz: { recent: [] }, lessons: REPORT.lessons.map((l) => ({ ...l, status: 'todo' })) };
        await open(api({ getSubjectProgress: async () => empty }));
        assert.match(html(), /<span>เริ่มเรียน</);
        assert.match(html(), /ตอบถูกจากโจทย์ที่ระบบตรวจ<\/span><span class="v">—/);
        assert.match(html(), /Mock Exam ดีที่สุด<\/span><span class="v">—/);
        assert.match(dom.el.pageMeta.textContent, /ยังไม่เริ่มเรียน/);
        assert.match(html(), /ยังไม่เคยทำ Quiz วิชานี้/);
        assert.match(html(), /ยังไม่เคยทำ Mock Exam วิชานี้/);
        const done = { ...REPORT, lessons: REPORT.lessons.map((l) => ({ ...l, status: 'done' })) };
        await open(api({ getSubjectProgress: async () => done }));
        assert.match(html(), /ดูบทเรียนทั้งหมด/);
    });
});

describe('จุดที่ควรทบทวนและจุดแข็ง', () => {
    test('แยกกลุ่ม ควรทบทวน / พอใช้ / ทำได้ดี เรียงจากอ่อนสุด และลิงก์ไปบทที่เกี่ยวข้อง พร้อม escape', async () => {
        await open(api());
        const h = html();
        assert.ok(h.indexOf('tgroup weak') < h.indexOf('tgroup ok') && h.indexOf('tgroup ok') < h.indexOf('tgroup strong'));
        assert.match(h, /ควรทบทวน <small>ตอบถูกน้อยกว่าครึ่ง/);
        assert.match(h, /หัวข้อ B<\/b><span>1\/6 ข้อ • 17%/);
        assert.match(h, /กลับไปทบทวน: <a class="inl" href="lesson\.html\?s=sci&l=1">บทที่ 1<\/a> • <a class="inl" href="lesson\.html\?s=sci&l=3">บทที่ 3<\/a>/);
        assert.match(h, /หัวข้อ C &lt;u&gt;/);
        assert.doesNotMatch(h, /หัวข้อ C <u>/);
        assert.match(h, /ยังมีข้อมูลน้อย[^<]*หัวข้อ D \(2 ข้อ\)/);
        assert.doesNotMatch(h.slice(h.indexOf('tgroup strong')), /กลับไปทบทวน/, 'ลิงก์ทบทวนเฉพาะหัวข้อที่อ่อน');
        assert.match(h, /โจทย์ Practice ที่ให้คะแนนเองไม่นับรวม/);
    });

    test('ข้อมูลไม่พอ → ข้อความตามที่ Backend บอก ไม่ชี้ว่าหัวข้อใดอ่อน และบอกว่าแต่ละหัวข้อตอบไปกี่ข้อ', () => {
        const h = reviewHtml({ sufficient: false, minAnswersPerTopic: 5, topics: [], pending: [{ topic: 'หัวข้อ A', total: 3 }], message: 'ข้อมูลยังไม่เพียงพอ — ต้องตอบอย่างน้อย 5 ข้อ' }, 'sci');
        assert.match(h, /ข้อมูลยังไม่เพียงพอ — ต้องตอบอย่างน้อย 5 ข้อ/);
        assert.match(h, /หัวข้อ A: ตอบแล้ว 3 ข้อ \(ต้องอย่างน้อย 5 ข้อ\)/);
        assert.doesNotMatch(h, /tgroup|tcard|ควรทบทวน/);
    });
});

describe('ผลรายบท ประวัติ และแนวโน้ม', () => {
    test('ผลรายบท: สถานะ ผล Quiz ที่ดีที่สุด Practice และลิงก์ไปบท พร้อม escape', async () => {
        await open(api());
        const h = html();
        assert.match(h, /class="lr" href="lesson\.html\?s=sci&l=1"/);
        assert.match(h, /เรียนแล้ว • Quiz ดีที่สุด 3\/3 ✓ \(2 ครั้ง\) • Practice 1\/3/);
        assert.match(h, /ยังไม่ได้ทำ Quiz/);
        assert.match(h, /บทสอง &lt;i&gt;/);
        assert.doesNotMatch(h, /บทสอง <i>/);
        assert.match(h, /lr-n st-done">1/);
    });

    test('ประวัติ Quiz และ Mock: ล่าสุดก่อน, หมดเวลา, ดาว, ปุ่มทำอีกครั้ง', async () => {
        await open(api());
        const h = html();
        assert.match(h, /บทที่ 1 • 3\/3 ข้อ/);
        assert.match(h, /4\/5 ข้อ[\s\S]*6 ดาว[\s\S]*2\/5 ข้อ[\s\S]*หมดเวลา • 2 ดาว/);
        assert.match(h, /href="mock-exam\.html\?s=sci"[^>]*>ทำ Mock Exam อีกครั้ง/);
    });

    test('กราฟแนวโน้ม: เก่า→ใหม่ซ้ายไปขวา มีคำอธิบายสำหรับโปรแกรมอ่านจอ และแท่งต่ำสุดยังมองเห็น', () => {
        const h = trendHtml([{ at: 1, percent: 40 }, { at: 2, percent: 0 }, { at: 3, percent: 80 }]);
        assert.match(h, /aria-label="แนวโน้มคะแนน Mock Exam จากครั้งเก่าไปใหม่: 40%, 0%, 80%"/);
        assert.match(h, /height:40%/);
        assert.match(h, /height:4%/, '0% ยังเห็นเป็นแท่งเล็ก');
        assert.match(h, /height:80%/);
        assert.equal(trendHtml([]), '');
    });

    test('ชุด Mock ยังไม่เปิด → ไม่มีปุ่มเข้าสอบ', async () => {
        const closed = { ...REPORT, mock: { ...REPORT.mock, available: false } };
        await open(api({ getSubjectProgress: async () => closed }));
        assert.doesNotMatch(html(), /mock-exam\.html\?s=sci/);
    });
});

describe('ข้อผิดพลาด', () => {
    test('วิชาไม่พบ / รหัสแปลก → หน้าไม่พบ และไม่ส่งรหัสแปลก ๆ ไป API', async () => {
        await open(api({ getSubjectProgress: async () => { throw new StudyApiError('NOT_FOUND', 404, 'ไม่พบข้อมูลที่ต้องการ'); } }));
        assert.match(html(), /ไม่พบรายวิชานี้/);
        let called = false;
        await open(api({ getSubjectProgress: async () => { called = true; return REPORT; } }), '<img src=x>');
        assert.equal(called, false);
        assert.match(html(), /ไม่พบรายวิชานี้/);
        assert.doesNotMatch(html(), /<img/);
        await open(api(), null);
        assert.match(html(), /ไม่พบรายวิชานี้/);
    });

    test('โหลดไม่ได้ → ข้อความผิดพลาดพร้อมปุ่มลองใหม่ (ไม่ใช่หน้าว่าง)', async () => {
        await open(api({ getSubjectProgress: async () => { throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); } }));
        assert.match(html(), /โหลดข้อมูลไม่สำเร็จ/);
        assert.match(html(), /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        assert.match(html(), /data-act="retry"/);
    });
});
