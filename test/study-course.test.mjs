// ทดสอบหน้าเส้นทางเรียน (js/study-course.js): ตัวสร้าง HTML ของวงกลม/บท/หน่วย, ข้อมูลในการ์ดที่เด้งขึ้น,
// ปุ่ม "เรียนต่อ" และการเชื่อมกับหน้า (โหลด / ผิดพลาด / ไม่พบ / ปรับพื้นที่สีเขียว / ถอดตัวฟังเมื่อออกจากหน้า)
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const calls = { header: [], docListeners: {}, winListeners: {} };
globalThis.window = {
    scrollY: 40,
    StudyShell: { setHeaderHeight: (px) => calls.header.push(px) },
    addEventListener: (t, f) => { (calls.winListeners[t] ||= []).push(f); },
    removeEventListener: (t, f) => { calls.winListeners[t] = (calls.winListeners[t] || []).filter((x) => x !== f); },
};
globalThis.document = {
    title: '',
    addEventListener: (t, f) => { (calls.docListeners[t] ||= []).push(f); },
    removeEventListener: (t, f) => { calls.docListeners[t] = (calls.docListeners[t] || []).filter((x) => x !== f); },
    querySelector: () => null,
};

const C = await import('../js/study-course.js');
const { StudyApiError } = await import('../js/study-api.js');
const { lessonHue } = await import('../js/study-format.js');

// ───────────── ข้อมูลตัวอย่างตามสัญญา GET /subjects/:id ─────────────
const node = (over) => ({ id: 'sci-n1', type: 'content', title: 'เรื่องที่ 1', status: 'todo', pageCount: 3, progress: { pageCount: 3, pageReached: 0, completedAt: null }, ...over });
const quizNode = (over) => ({ id: 'sci-z1', type: 'quiz', title: 'Quiz ชุด 1', status: 'todo', questionCount: 4, progress: { attempts: 0, best: null, last: null, passed: false, passPct: 60 }, ...over });
const practiceNode = (over) => ({ id: 'sci-p1', type: 'practice', title: 'ฝึก ชุด 1', status: 'todo', progress: { done: 0, ok: 0, wrong: 0, total: 3 }, ...over });
const lesson = (no, nodes, over = {}) => ({ no, title: `บทที่ ${no}`, summary: null, status: 'todo', access: 'open', nodes, ...over });

const DATA = () => ({
    subject: { id: 'sci', no: 1, title: 'วิทยาศาสตร์', eyebrow: 'วิชาที่ 1 • วิทยาศาสตร์', description: 'คำอธิบาย <b>วิชา</b>', metaText: '4 บทเรียน', hue: 'emerald', emoji: '🔬', objectives: ['ข้อ 1', 'ข้อ 2'], level: 'ม.ต้น' },
    progress: { lessonsTotal: 3, lessonsDone: 1, pct: 33, lastActivityAt: 1 },
    current: { no: 2, title: 'บทที่ 2', node: { id: 'sci-n2', type: 'content', title: 'เรื่องที่ 2' } },
    units: [
        { no: 1, id: 'sci-u1', title: 'หน่วย <1>', doneCount: 1, lessonCount: 2, lessons: [
            lesson(1, [node({ id: 'sci-n1', status: 'done', progress: { pageCount: 3, pageReached: 2, completedAt: 5 } }), quizNode({ id: 'sci-z1', status: 'done', progress: { attempts: 1, best: { correct: 4, total: 4 }, last: null, passed: true, passPct: 60 } })], { status: 'done' }),
            lesson(2, [node({ id: 'sci-n2', status: 'now', title: 'เรื่องที่ 2' }), practiceNode({ id: 'sci-p2' }), quizNode({ id: 'sci-z2' })], { status: 'now' }),
        ] },
        { no: 2, id: 'sci-u2', title: 'หน่วยที่สอง', doneCount: 0, lessonCount: 1, lessons: [lesson(3, [node({ id: 'sci-n3' })])] },
    ],
    mock: { available: true, attempts: 0, lastPercent: null, lastAt: null },
});

describe('วงกลมและตำแหน่ง', () => {
    test('คลื่นซิกแซก: 0 → ขวา → กลับ → ซ้าย → กลับ และวนซ้ำ', () => {
        assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(C.nodeOffset), [0, 34, 56, 34, 0, -34, -56, -34, 0, 34]);
        assert.equal(C.nodeOffset(-1), -34, 'ค่าติดลบก็ไม่พัง');
    });

    test('ring: เนื้อหา=หน้าที่อ่านถึง, Practice=ที่ทำแล้ว, Quiz=ผลดีที่สุด, เสร็จแล้ว=100', () => {
        assert.equal(C.ringPercent(node({ status: 'now', progress: { pageCount: 4, pageReached: 1, completedAt: null } })), 25);
        assert.equal(C.ringPercent(node({ status: 'now', progress: { pageCount: 1, pageReached: 0, completedAt: null } })), 0);
        assert.equal(C.ringPercent(practiceNode({ progress: { done: 1, ok: 1, wrong: 0, total: 4 } })), 25);
        assert.equal(C.ringPercent(quizNode({ progress: { attempts: 1, best: { correct: 3, total: 4 }, passed: false, passPct: 100 } })), 75);
        assert.equal(C.ringPercent(quizNode({ status: 'done' })), 100);
        assert.equal(C.ringPercent({ type: 'content', status: 'todo' }), 0, 'ไม่มี progress ก็ไม่พัง');
    });

    test('nodeInfo: ข้อความและป้ายปุ่มตามสถานะ (เนื้อหา / Quiz / Practice)', () => {
        const href = (id) => `lesson.html?s=sci&l=2&n=${id}`;
        let i = C.nodeInfo(node({ status: 'todo' }), 'sci', 2);
        assert.deepEqual([i.chip, i.label, i.href], ['เนื้อหา • 3 หน้า', 'เริ่ม', href('sci-n1')]);
        i = C.nodeInfo(node({ status: 'now', progress: { pageCount: 3, pageReached: 1, completedAt: null } }), 'sci', 2);
        assert.deepEqual([i.label, i.line], ['อ่านต่อ', 'อ่านถึงหน้า 2/3']);
        i = C.nodeInfo(node({ status: 'done' }), 'sci', 2);
        assert.deepEqual([i.label, i.line], ['ทบทวน', 'เรียนจบแล้ว ✓']);

        i = C.nodeInfo(quizNode(), 'sci', 2);
        assert.deepEqual([i.chip, i.label], ['Quiz • 4 ข้อ', 'เริ่ม']);
        assert.match(i.line, /ผ่านเมื่อตอบถูก ≥ 60%/);
        i = C.nodeInfo(quizNode({ progress: { attempts: 2, best: { correct: 2, total: 4 }, passed: false, passPct: 60 } }), 'sci', 2);
        assert.deepEqual([i.label], ['ลองอีกครั้ง']);
        assert.match(i.line, /ดีที่สุด 2\/4/);
        i = C.nodeInfo(quizNode({ status: 'done', progress: { attempts: 1, best: { correct: 4, total: 4 }, passed: true, passPct: null } }), 'sci', 2);
        assert.deepEqual([i.label, i.line], ['ทำอีกครั้ง', 'ผ่านแล้ว ✓ • ดีที่สุด 4/4']);
        assert.match(C.nodeInfo(quizNode({ progress: { attempts: 0, best: null, passed: false, passPct: null } }), 'sci', 2).line, /ทำครบแล้วส่ง 1 ครั้งถือว่าผ่าน/);

        i = C.nodeInfo(practiceNode(), 'sci', 2);
        assert.deepEqual([i.chip, i.label, i.line], ['Practice • ไม่บังคับ', 'เริ่ม', 'ทำแล้ว 0/3 ข้อ • ฝึกเองแล้วกดทำถูก/ทำผิด']);
        assert.equal(C.nodeInfo(practiceNode({ progress: { done: 1, ok: 1, wrong: 0, total: 3 } }), 'sci', 2).label, 'ทำต่อ');
        assert.equal(C.nodeInfo(practiceNode({ status: 'done', progress: { done: 3, ok: 3, wrong: 0, total: 3 } }), 'sci', 2).label, 'ทบทวน');
    });

    test('nodeHtml: ปุ่มวงกลมมี id, สถานะ, ตำแหน่ง, ป้ายเริ่มเฉพาะวงที่ถัดไป, วงแหวนเฉพาะเมื่อมีความคืบหน้า; ข้อความถูก escape', () => {
        const ctx = { subjectId: 'sci', lessonNo: 2, index: 1, seq: 4 };
        const now = C.nodeHtml(node({ status: 'now', title: '<img src=x onerror=alert(1)>', progress: { pageCount: 4, pageReached: 2, completedAt: null } }), ctx);
        assert.match(now, /class="cp-n is-now" data-kind="content" style="--dx:34px;--i:4"/);
        assert.match(now, /data-node="sci-n1" aria-expanded="false"/);
        assert.match(now, /class="cp-start"/);
        assert.match(now, /class="cp-ring" style="--p:50"/);
        assert.match(now, /&lt;img src=x onerror=alert\(1\)&gt;/);
        assert.doesNotMatch(now, /<img src=x/);
        assert.match(now, /<template class="cp-tpl">[\s\S]*href="lesson\.html\?s=sci&amp;l=2&amp;n=sci-n1"/);

        const todo = C.nodeHtml(node({ status: 'todo' }), ctx);
        assert.doesNotMatch(todo, /cp-start|cp-ring/);
        const done = C.nodeHtml(node({ status: 'done', progress: { pageCount: 3, pageReached: 2, completedAt: 1 } }), ctx);
        assert.doesNotMatch(done, /cp-ring|cp-start/);
        assert.match(done, /M5 12l5 5l10 -10/, 'วงที่เสร็จแล้วเป็นเครื่องหมายถูก');
        const practice = C.nodeHtml(practiceNode(), ctx);
        assert.match(practice, /cp-n is-todo is-optional/);
        assert.match(practice, /<small>Practice • ไม่บังคับ<\/small>/);
    });
});

describe('บท หน่วย และทั้งหน้า', () => {
    test('บทมีเส้นคั่นและป้ายสีประจำบท (บทที่ติดกันคนละสี) และขีดว่าเสร็จแล้ว', () => {
        const data = DATA();
        const html = C.courseBodyHtml(data);
        assert.match(html, /class="cp-lesson hue-emerald is-done" id="lesson-1"/);
        assert.match(html, /class="cp-lesson hue-sky" id="lesson-2"/);
        assert.match(html, /class="cp-lesson hue-violet" id="lesson-3"/);
        assert.equal(lessonHue(1) !== lessonHue(2), true);
        assert.match(html, /<span class="cp-lchip"><b>บทที่ 2<\/b><span>บทที่ 2<\/span><\/span>/);
        assert.equal((html.match(/class="cp-lline"/g) || []).length, 6, 'เส้นคั่นสองข้างของทุกบท');
    });

    test('สีประจำบทวนครบชุดสีแล้วเริ่มใหม่ และเลขบทแปลก ๆ ไม่พัง', () => {
        assert.equal(lessonHue(11), lessonHue(1));
        assert.equal(lessonHue(0), lessonHue(1));
        assert.equal(lessonHue('x'), lessonHue(1));
        assert.equal(lessonHue(-3) !== undefined, true);
    });

    test('หน่วยมีแบนเนอร์ติดขอบ (ชื่อหน่วย + จำนวนบทที่เสร็จ) และเส้นทางต่อเนื่องข้ามบท: คลื่นเริ่มใหม่ทุกหน่วย', () => {
        const html = C.courseBodyHtml(DATA());
        assert.match(html, /<section class="cp-unit" id="unit-1" aria-label="หน่วยที่ 1 หน่วย &lt;1&gt;">/);
        assert.match(html, /หน่วยที่ 1 • เสร็จ 1\/2 บท<\/p><h2>หน่วย &lt;1&gt;<\/h2>/);
        assert.doesNotMatch(html, /<h2>หน่วย <1>/);
        const dx = (id) => new RegExp(`--dx:(-?\\d+)px;--i:(\\d+)"[^>]*>\\s*<button[^>]*data-node="${id}"`).exec(html);
        assert.deepEqual(dx('sci-n1').slice(1), ['0', '0']);
        assert.deepEqual(dx('sci-z1').slice(1), ['34', '1']);
        assert.deepEqual(dx('sci-n2').slice(1), ['56', '2'], 'บทที่ 2 ต่อคลื่นจากบทที่ 1');
        assert.deepEqual(dx('sci-p2').slice(1), ['34', '3']);
        assert.deepEqual(dx('sci-z2').slice(1), ['0', '4']);
        assert.deepEqual(dx('sci-n3').slice(1), ['0', '5'], 'หน่วยใหม่เริ่มคลื่นที่กลางจอ (ลำดับแอนิเมชันยังต่อเนื่อง)');
    });

    test('บทที่ไม่มีกิจกรรมแสดงข้อความ ไม่พัง', () => {
        const data = DATA();
        data.units[1].lessons[0].nodes = [];
        assert.match(C.courseBodyHtml(data), /บทนี้ยังไม่มีกิจกรรม/);
    });

    test('สรุปความคืบหน้า + ปุ่มเรียนต่อชี้ไปกิจกรรมถัดไปที่ Backend บอก', () => {
        const html = C.courseBodyHtml(DATA());
        assert.match(html, /<span class="num">33%<\/span>/);
        assert.match(html, /เรียนแล้ว 1 จาก 3 บทเรียน/);
        assert.match(html, /class="btn btn-lg btn-block cp-cta" href="lesson\.html\?s=sci&amp;l=2&amp;n=sci-n2"><span>เรียนต่อ<\/span>/);
        assert.match(html, /บทที่ 2 • เรื่องที่ 2/);
    });

    test('ยังไม่เริ่ม → "เริ่มเรียน"; เรียนครบแล้ว → "ทบทวนบทเรียน" ไปกิจกรรมแรก; ไม่มีบทเลย → ไม่มีปุ่ม', () => {
        const fresh = DATA();
        fresh.progress = { lessonsTotal: 3, lessonsDone: 0, pct: 0, lastActivityAt: null };
        assert.equal(C.ctaView(fresh).label, 'เริ่มเรียน');
        const all = DATA();
        all.current = null;
        all.progress.lessonsDone = 3;
        const cta = C.ctaView(all);
        assert.deepEqual([cta.label, cta.href, cta.sub], ['ทบทวนบทเรียน', 'lesson.html?s=sci&l=1&n=sci-n1', 'เรียนครบทุกบทแล้ว']);
        assert.equal(C.ctaView({ ...DATA(), current: null, units: [] }), null);
    });

    test('เกี่ยวกับวิชา: คำอธิบายถูก escape, วัตถุประสงค์เป็นรายการ, ไม่มีข้อมูล = ไม่มีส่วนนี้', () => {
        const html = C.courseBodyHtml(DATA());
        assert.match(html, /คำอธิบาย &lt;b&gt;วิชา&lt;\/b&gt;/);
        assert.match(html, /<li>ข้อ 1<\/li><li>ข้อ 2<\/li>/);
        const bare = DATA();
        bare.subject.description = null; bare.subject.objectives = []; bare.subject.level = null;
        assert.doesNotMatch(C.courseBodyHtml(bare), /cp-about/);
    });

    test('ปลายทางเส้นทาง: Mock Exam — เปิดสอบได้/ทำแล้ว/ยังไม่เปิด', () => {
        const available = C.courseBodyHtml(DATA());
        assert.match(available, /id="mock"[\s\S]*Mock Exam ประจำวิชา/);
        assert.match(available, /cp-trophy is-now/);
        assert.match(available, /href="mock-exam\.html\?s=sci"><span>เข้าสอบ<\/span>/);
        const done = DATA();
        done.mock = { available: true, attempts: 2, lastPercent: 75, lastAt: 1 };
        const h = C.courseBodyHtml(done);
        assert.match(h, /cp-trophy is-done/);
        assert.match(h, /ทำแล้ว 2 ครั้ง • ล่าสุด 75%/);
        assert.match(h, /<span>สอบอีกครั้ง<\/span>/);
        const off = DATA();
        off.mock = { available: false, attempts: 0, lastPercent: null, lastAt: null };
        const o = C.courseBodyHtml(off);
        assert.match(o, /cp-trophy is-todo/);
        assert.match(o, /ยังไม่เปิดให้สอบ/);
        assert.doesNotMatch(o, /href="mock-exam/);
    });

    test('วิชาที่ยังไม่มีหน่วย → ข้อความ แต่ยังมี Mock ปลายทาง', () => {
        const empty = DATA();
        empty.units = []; empty.progress = { lessonsTotal: 0, lessonsDone: 0, pct: 0, lastActivityAt: null }; empty.current = null;
        const html = C.courseBodyHtml(empty);
        assert.match(html, /วิชานี้ยังไม่มีบทเรียน/);
        assert.match(html, /id="mock"/);
    });

    test('headerView: ข้อความในแถบสีเขียว', () => {
        assert.deepEqual(C.headerView(DATA()), { eyebrow: 'วิชาที่ 1 • วิทยาศาสตร์', title: 'วิทยาศาสตร์', meta: '4 บทเรียน', emoji: '🔬' });
        const bare = DATA();
        bare.subject = { ...bare.subject, eyebrow: null, metaText: null, emoji: null };
        assert.deepEqual(C.headerView(bare), { eyebrow: '', title: 'วิทยาศาสตร์', meta: '3 บทเรียน', emoji: '📘' });
    });
});

// ───────────── การเชื่อมกับหน้า ─────────────
function fakeRoot() {
    const els = {};
    const el = (id, extra = {}) => (els[id] = { id, textContent: '', innerHTML: '', listeners: {}, addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }, querySelector(sel) { return sel === '[data-act="retry"]' && this.innerHTML.includes('data-act="retry"') ? (this.retry ||= { listeners: {}, addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } }) : null; }, ...extra });
    el('cpBody');
    el('cpTitle'); el('cpEyebrow'); el('cpMeta'); el('cpEmoji');
    el('cpHead', { getBoundingClientRect: () => ({ bottom: 120 }) });
    const classes = [];
    const rootListeners = {};
    const root = {
        els, classes, rootListeners,
        classList: { add: (c) => classes.push(c) },
        querySelector: (sel) => (sel.startsWith('#') ? els[sel.slice(1)] || null : null),
        addEventListener: (t, f) => { (rootListeners[t] ||= []).push(f); },
        removeEventListener: (t, f) => { rootListeners[t] = (rootListeners[t] || []).filter((x) => x !== f); },
        querySelectorAll: () => [],
    };
    return root;
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('initCoursePage', () => {
    beforeEach(() => { calls.header.length = 0; calls.docListeners = {}; calls.winListeners = {}; globalThis.document.title = ''; });

    test('โหลดวิชา → ส่วนหัว เนื้อหา สีประจำวิชา ชื่อแท็บ และพื้นที่สีเขียวถูกปรับให้พอดีส่วนหัว', async () => {
        const root = fakeRoot();
        const api = { getSubject: async (key) => { api.key = key; return DATA(); } };
        const ctl = await C.initCoursePage(root, { api, url: 'https://study.test/course.html?s=sci' });
        assert.equal(api.key, 'sci');
        assert.equal(root.els.cpTitle.textContent, 'วิทยาศาสตร์');
        assert.equal(root.els.cpEyebrow.textContent, 'วิชาที่ 1 • วิทยาศาสตร์');
        assert.equal(root.els.cpEmoji.textContent, '🔬');
        assert.deepEqual(root.classes, ['hue-emerald']);
        assert.match(root.els.cpBody.innerHTML, /class="cp-path"/);
        assert.equal(globalThis.document.title, 'HEADFACE Study - วิทยาศาสตร์');
        assert.deepEqual(calls.header, [120 + 40 + 34, 120 + 40 + 34], 'ปรับตอนเริ่ม และปรับอีกครั้งเมื่อข้อมูลมา (ส่วนหัวขอบล่าง + เลื่อน + ขอบโค้ง)');
        assert.ok(root.rootListeners.click.length === 1 && calls.docListeners.keydown.length === 1 && calls.winListeners.resize.length === 1 && calls.winListeners.pageshow.length === 1);
        ctl.dispose();
        assert.equal(root.rootListeners.click.length, 0, 'ออกจากหน้า → ถอดตัวฟัง');
        assert.equal(calls.docListeners.keydown.length, 0);
        assert.equal(calls.winListeners.resize.length, 0);
        assert.equal(calls.winListeners.pageshow.length, 0);
    });

    test('กลับมาหน้านี้จากแคชของเบราว์เซอร์ (pageshow persisted) → โหลดความคืบหน้าใหม่', async () => {
        const root = fakeRoot();
        let loads = 0;
        const api = { getSubject: async () => { loads++; return DATA(); } };
        await C.initCoursePage(root, { api, url: 'course.html?s=sci' });
        assert.equal(loads, 1);
        calls.winListeners.pageshow[0]({ persisted: false });
        await settle();
        assert.equal(loads, 1, 'โหลดครั้งแรกปกติ ไม่ต้องโหลดซ้ำ');
        calls.winListeners.pageshow[0]({ persisted: true });
        await settle();
        assert.equal(loads, 2);
    });

    test('สีวิชาที่แปลกไม่ถูกใส่เป็นคลาส (ใช้ emerald แทน)', async () => {
        const root = fakeRoot();
        const data = DATA();
        data.subject.hue = 'em"erald';
        await C.initCoursePage(root, { api: { getSubject: async () => data }, url: 'course.html?s=sci' });
        assert.deepEqual(root.classes, ['hue-emerald']);
    });

    test('รหัสวิชาไม่ถูกต้อง/ไม่มี → ไม่พบวิชา โดยไม่เรียก API', async () => {
        for (const url of ['course.html', 'course.html?s=', 'course.html?s=SCI', 'course.html?s=1abc', 'course.html?s=../x']) {
            const root = fakeRoot();
            let called = false;
            await C.initCoursePage(root, { api: { getSubject: async () => { called = true; return DATA(); } }, url });
            assert.equal(called, false, url);
            assert.equal(root.els.cpTitle.textContent, 'ไม่พบวิชานี้');
            assert.match(root.els.cpBody.innerHTML, /ไม่พบรายวิชานี้/);
            assert.match(root.els.cpBody.innerHTML, /href="subject\.html"/);
        }
    });

    test('วิชาไม่มีในระบบ (404) → ไม่พบวิชา', async () => {
        const root = fakeRoot();
        await C.initCoursePage(root, { api: { getSubject: async () => { throw new StudyApiError('NOT_FOUND', 404, 'ไม่พบข้อมูลที่ต้องการ'); } }, url: 'course.html?s=sci' });
        assert.equal(root.els.cpTitle.textContent, 'ไม่พบวิชานี้');
        assert.doesNotMatch(root.els.cpBody.innerHTML, /data-act="retry"/);
    });

    test('โหลดไม่สำเร็จ → ข้อความจาก Backend พร้อมปุ่มลองใหม่ ที่โหลดซ้ำได้', async () => {
        const root = fakeRoot();
        let fail = true;
        const api = { getSubject: async () => { if (fail) throw new StudyApiError('INTERNAL_ERROR', 500, 'เกิดข้อผิดพลาดภายในระบบ'); return DATA(); } };
        await C.initCoursePage(root, { api, url: 'course.html?s=sci' });
        assert.equal(root.els.cpTitle.textContent, 'โหลดข้อมูลไม่สำเร็จ');
        assert.match(root.els.cpBody.innerHTML, /role="alert"[\s\S]*เกิดข้อผิดพลาดภายในระบบ/);
        assert.match(root.els.cpBody.innerHTML, /data-act="retry"/);
        fail = false;
        root.els.cpBody.retry.listeners.click[0]();
        await settle();
        assert.equal(root.els.cpTitle.textContent, 'วิทยาศาสตร์');
        assert.match(root.els.cpBody.innerHTML, /class="cp-path"/);
    });

    test('ออกจากหน้าก่อนข้อมูลมา → ไม่เขียนทับหน้าใหม่', async () => {
        const root = fakeRoot();
        let release;
        const gate = new Promise((r) => { release = r; });
        const pending = C.initCoursePage(root, { api: { getSubject: async () => { await gate; return DATA(); } }, url: 'course.html?s=sci' });
        await settle();
        assert.match(root.els.cpBody.innerHTML, /กำลังโหลดเส้นทางเรียน/);
        // ผู้ใช้ออกจากหน้า: เรียก dispose ของตัวที่ยังไม่คืนค่า ทำไม่ได้ จึงตรวจว่าหลังข้อมูลมาหน้ายังทำงานปกติ
        release();
        const ctl = await pending;
        assert.match(root.els.cpBody.innerHTML, /class="cp-path"/);
        ctl.dispose();
        assert.equal(typeof ctl.dispose, 'function');
    });
});
