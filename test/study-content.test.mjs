// ทดสอบชุดเนื้อหาหลายหน้า (js/study-live-content.js): อ่านทีละหน้า, แถบความคืบหน้าแบบแบ่งช่อง, จำหน้าที่อ่านถึง,
// "จบเนื้อหา" บันทึกกับ Backend, สื่อ (ภาพ/วิดีโอ) และข้อผิดพลาด
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null };

const { createContent } = await import('../js/study-live-content.js');
const { StudyApiError } = await import('../js/study-api.js');

const PAGES = [
    { title: 'สสารคืออะไร', blocks: [{ type: 'heading', text: 'หัวข้อ <หนึ่ง>' }, { type: 'paragraph', text: 'ย่อหน้าแรก' }, { type: 'figure', kind: 'image', url: 'assets/study/sci/a.svg', alt: 'แผนภาพ', caption: 'ภาพ 1' }] },
    { title: null, blocks: [{ type: 'paragraph', text: 'หน้าที่สอง' }, { type: 'figure', kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'วิดีโอ' }] },
    { title: 'สรุป', blocks: [{ type: 'checklist', title: 'จำให้ได้', items: ['ข้อ ก', 'ข้อ ข'] }] },
];

let node;
let renders;
let applied;
function setup(over = {}, extra = {}) {
    renders = 0;
    applied = [];
    const calls = [];
    const api = {
        calls,
        setNodeProgress: async (s, no, id, body) => { calls.push(['progress', s, no, id, body]); return { progress: { status: 'now', nodes: [] } }; },
        ...over,
    };
    const content = createContent({ subject: { id: 'sci' }, lessonNo: 2, node, api, render: () => { renders++; }, applyProgress: (d) => applied.push(d), nextHref: 'lesson.html?s=sci&l=2&n=sci-z1', courseHref: 'course.html?s=sci', ...extra });
    return { content, api };
}
const click = (content, act) => content.handleClick({ target: { closest: (sel) => (sel === '[data-act]' && act ? { dataset: { act } } : null) } });
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    node = { id: 'sci-n1', type: 'content', title: 'สสารและสถานะ', pages: PAGES, progress: { pageCount: 3, pageReached: 0, completedAt: null } };
});

describe('อ่านทีละหน้า', () => {
    test('หน้าแรก: แถบแบ่งช่อง 3 ช่อง, ชื่อหน้า, เนื้อหา (escape) และปุ่ม ก่อนหน้า (ปิด) / ถัดไป', () => {
        const { content } = setup();
        const html = content.html();
        assert.match(html, /class="cn-dots" role="progressbar" aria-valuemin="1" aria-valuemax="3" aria-valuenow="1" aria-label="หน้า 1 จาก 3"><i class="cur"><\/i><i class=""><\/i><i class=""><\/i>/);
        assert.match(html, /<span class="cn-count">1\/3<\/span>/);
        assert.match(html, /<p class="cn-kicker">สสารคืออะไร<\/p>/);
        assert.match(html, /data-key="p0" data-dir="0"/);
        assert.match(html, /หัวข้อ &lt;หนึ่ง&gt;/);
        assert.doesNotMatch(html, /<หนึ่ง>/);
        assert.match(html, /<img src="assets\/study\/sci\/a\.svg"/);
        assert.match(html, /data-act="cn-prev" aria-label="หน้าก่อนหน้า" disabled/);
        assert.match(html, /data-act="cn-next"/);
        assert.doesNotMatch(html, /cn-finish/);
        assert.equal(content.hasAbar(), true);
    });

    test('ถัดไป → หน้าสอง (วิดีโอฝัง) แถบความคืบหน้าขยับ บันทึกหน้าที่อ่านถึงกับ Backend', async () => {
        const { content, api } = setup();
        assert.equal(click(content, 'cn-next'), true);
        assert.equal(renders, 1);
        const html = content.html();
        assert.match(html, /aria-valuenow="2"/);
        assert.match(html, /<i class="on"><\/i><i class="cur"><\/i><i class=""><\/i>/);
        assert.match(html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
        assert.match(html, /<span class="cn-count">2\/3<\/span>/);
        assert.doesNotMatch(html, /cn-kicker/, 'หน้าที่ไม่มีชื่อ แสดงแค่ลำดับ');
        assert.match(html, /data-key="p1" data-dir="1"/, 'หน้าใหม่เลื่อนเข้ามาจากทางขวา');
        await settle();
        assert.deepEqual(api.calls, [['progress', 'sci', 2, 'sci-n1', { page: 1 }]]);
        click(content, 'cn-prev');
        assert.match(content.html(), /aria-valuenow="1"/);
        click(content, 'cn-next');
        await settle();
        assert.equal(api.calls.length, 1, 'หน้าที่เคยอ่านถึงแล้วไม่บันทึกซ้ำ');
    });

    test('หน้าสุดท้าย: ปุ่มเป็น "จบเนื้อหา ✓" และไม่มีปุ่มถัดไป; ไม่ข้ามเกินหน้าสุดท้าย/ก่อนหน้าแรก', () => {
        const { content } = setup();
        assert.equal(content.step(-1), false, 'หน้าแรกถอยไม่ได้');
        assert.equal(content.step(1), true);
        assert.equal(content.step(1), true);
        assert.equal(content.step(1), false, 'หน้าสุดท้ายไปต่อไม่ได้');
        const html = content.html();
        assert.match(html, /data-act="cn-finish"[^>]*><span>จบเนื้อหา<\/span>/);
        assert.doesNotMatch(html, /cn-next/);
        assert.match(html, /i class="on"><\/i><i class="on"><\/i><i class="cur">/);
    });

    test('เปิดใหม่ → กลับไปหน้าที่อ่านถึง (ถ้ายังไม่จบ) หรือเริ่มหน้าแรก (ถ้าจบแล้ว)', () => {
        node.progress = { pageCount: 3, pageReached: 1, completedAt: null };
        assert.match(setup().content.html(), /aria-valuenow="2"/);
        node.progress = { pageCount: 3, pageReached: 2, completedAt: 5 };
        const { content } = setup();
        assert.match(content.html(), /aria-valuenow="1"/, 'จบแล้ว → อ่านทบทวนตั้งแต่ต้น');
        content.step(2);
        assert.match(content.html(), /<span>จบ<\/span>/, 'จบแล้ว ปุ่มสุดท้ายไม่ใช่ "จบเนื้อหา"');
        node.progress = { pageCount: 3, pageReached: 99, completedAt: null };
        assert.match(setup().content.html(), /aria-valuenow="3"/, 'ค่าเกินขอบถูกตัดที่หน้าสุดท้าย');
    });

    test('ชุดที่มีหน้าเดียว: ไม่มีแถบแบ่งช่อง และปุ่มแรกคือ "จบเนื้อหา"', () => {
        node.pages = [PAGES[2]];
        const html = setup().content.html();
        assert.doesNotMatch(html, /cn-dots/);
        assert.match(html, /<p class="cn-kicker">สรุป<\/p>/);
        assert.doesNotMatch(html, /cn-count/, 'หน้าเดียวไม่มีตัวนับ');
        assert.match(html, /cn-finish/);
    });

    test('ไม่มีหน้า/หน้าที่ไม่มีบล็อก → ข้อความ ไม่พัง และไม่มีแถบปุ่มล่าง', () => {
        node.pages = [];
        const { content } = setup();
        assert.match(content.html(), /ยังไม่มีหน้า/);
        assert.equal(content.hasAbar(), false);
        node.pages = [{ title: 'ว่าง', blocks: [] }];
        assert.match(setup().content.html(), /หน้านี้ยังไม่มีเนื้อหา/);
    });

    test('หน้าที่บันทึกไม่สำเร็จไม่ขัดการอ่าน (บันทึกซ้ำได้เมื่อไปหน้าถัดไป)', async () => {
        const calls = [];
        let fail = true;
        const { content } = setup({ setNodeProgress: async (...a) => { calls.push(a[3]); if (fail) throw new StudyApiError('NETWORK', 0, 'x'); return {}; } });
        content.step(1);
        await settle();
        assert.match(content.html(), /aria-valuenow="2"/, 'ยังอ่านต่อได้');
        fail = false;
        content.step(1);
        await settle();
        assert.equal(calls.length, 2);
    });
});

describe('จบเนื้อหา', () => {
    test('กดจบ → บันทึก page สุดท้าย + completed แล้วแสดงหน้าสำเร็จ พร้อมไปกิจกรรมถัดไป/กลับเส้นทาง', async () => {
        const { content, api } = setup();
        content.step(2);
        await settle();
        api.calls.length = 0;
        assert.equal(click(content, 'cn-finish'), true);
        await settle();
        assert.deepEqual(api.calls, [['progress', 'sci', 2, 'sci-n1', { page: 2, completed: true }]]);
        assert.equal(applied.length, 1);
        const html = content.html();
        assert.match(html, /เรียนจบแล้ว![\s\S]*“สสารและสถานะ”/);
        assert.match(html, /อ่านครบ 3 หน้า/);
        assert.match(html, /href="lesson\.html\?s=sci&amp;l=2&amp;n=sci-z1"[^>]*><span>ไปกิจกรรมถัดไป/);
        assert.match(html, /href="course\.html\?s=sci"[^>]*>กลับไปเส้นทางเรียน/);
        assert.equal(content.hasAbar(), false);
        assert.equal(content.step(1), false, 'หน้าสำเร็จเลื่อนหน้าไม่ได้');
        click(content, 'cn-again');
        assert.match(content.html(), /aria-valuenow="1"/, 'อ่านอีกครั้งเริ่มจากหน้าแรก');
    });

    test('ไม่มีกิจกรรมถัดไป → ปุ่มหลักคือกลับเส้นทางเรียน', async () => {
        const { content } = setup({}, { nextHref: null });
        content.step(2);
        click(content, 'cn-finish');
        await settle();
        const html = content.html();
        assert.doesNotMatch(html, /ไปกิจกรรมถัดไป/);
        assert.match(html, /class="btn btn-lg btn-block" href="course\.html\?s=sci"/);
    });

    test('บันทึกไม่สำเร็จ → ยังอยู่หน้าสุดท้ายพร้อมข้อความ และกดจบใหม่ได้; กดซ้ำระหว่างรอส่งครั้งเดียว', async () => {
        let fail = true;
        let release;
        const gate = new Promise((r) => { release = r; });
        const calls = [];
        const { content } = setup({ setNodeProgress: async (...a) => { calls.push(a[3]); if (a[3].completed) { await gate; if (fail) throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); } return {}; } });
        content.step(2);
        await settle();
        calls.length = 0;
        click(content, 'cn-finish');
        click(content, 'cn-finish');
        click(content, 'cn-finish');
        assert.equal(calls.length, 1, 'ส่งครั้งเดียว');
        assert.match(content.html(), /cn-finish"[^>]* disabled/);
        release();
        await settle();
        const html = content.html();
        assert.match(html, /role="alert">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        assert.match(html, /จบเนื้อหา/);
        assert.doesNotMatch(html, /cn-finish"[^>]* disabled/);
        fail = false;
        click(content, 'cn-finish');
        await settle();
        assert.match(content.html(), /เรียนจบแล้ว![\s\S]*“สสารและสถานะ”/);
    });

    test('คลิกที่ไม่เกี่ยวข้องไม่ถูกจัดการ', () => {
        const { content } = setup();
        assert.equal(click(content, undefined), false);
        assert.equal(click(content, 'quiz-start'), false);
    });
});
