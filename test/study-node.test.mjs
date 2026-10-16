// ทดสอบหน้ากิจกรรมหนึ่งวงกลม (js/study-node.js) ด้วย API จำลองและ DOM จำลอง: เลือกกิจกรรมเมื่อลิงก์ไม่ระบุ node,
// เปิดชุดเนื้อหา / Quiz / Practice ตามชนิด, ลิงก์ไปกิจกรรมถัดไป, สีประจำบท, ข้อผิดพลาด และรหัสแปลก ๆ
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, wait } from './fakeDom.mjs';

const dom = installFakeDom();
const replaced = [];
globalThis.history = { replaceState: (...a) => replaced.push(a) };
const { initNode, pickNode, nodeTypeLabel } = await import('../js/study-node.js');
const { StudyApiError } = await import('../js/study-api.js');
const { params } = await import('../js/study-ui.js');

const SUBJECT = { id: 'sci', title: 'วิทยาศาสตร์', eyebrow: 'วิชาที่ 1 • วิทยาศาสตร์', hue: 'emerald', emoji: '🔬', lessonsTotal: 4 };
const LESSON = { subjectId: 'sci', no: 2, title: 'กรด-เบสเบื้องต้น', unit: { no: 1, title: 'หน่วย 1' }, estimatedMin: null, status: 'now' };
const NAV = { prev: null, next: { lessonNo: 2, lessonTitle: 'กรด-เบสเบื้องต้น', nodeId: 'sci-z1', type: 'quiz', title: 'Quiz ชุด 1' } };

const contentNode = () => ({ id: 'sci-n1', type: 'content', title: 'pH คืออะไร', status: 'now', pageCount: 2, progress: { pageCount: 2, pageReached: 0, completedAt: null }, pages: [{ title: 'ค่า pH', blocks: [{ type: 'paragraph', text: 'หน้าแรก' }] }, { title: null, blocks: [{ type: 'paragraph', text: 'หน้าสอง' }] }] });
const quizNode = () => ({ id: 'sci-z1', type: 'quiz', title: 'Quiz ชุด 1', status: 'todo', questionCount: 3, quiz: { available: true, questionCount: 3, passPct: 50 }, progress: { attempts: 0, best: null, last: null, passed: false, passPct: 50 } });
const practiceNode = () => ({ id: 'sci-p1', type: 'practice', title: 'ฝึก ชุด 1', status: 'todo', progress: { done: 0, ok: 0, wrong: 0, total: 1 }, practice: { total: 1, byLevel: { easy: 1, medium: 0, hard: 0 } } });

function fakeApi(nodeData, over = {}) {
    const calls = [];
    return {
        calls,
        getNode: async (s, no, id) => { calls.push(['getNode', s, no, id]); return { subject: SUBJECT, lesson: LESSON, node: nodeData(), nav: NAV }; },
        getLesson: async (s, no) => { calls.push(['getLesson', s, no]); return { subject: SUBJECT, lesson: { ...LESSON, nodes: [{ id: 'sci-n1', type: 'content', status: 'done' }, { id: 'sci-p1', type: 'practice', status: 'todo' }, { id: 'sci-z1', type: 'quiz', status: 'now' }] } }; },
        getPractice: async () => ({ summary: { total: 1, done: 0, ok: 0, wrong: 0 }, items: [{ id: 'p1', n: 1, level: 'easy', topic: 'ก', text: 'โจทย์ฝึก', result: null, media: [] }] }),
        setNodeProgress: async () => ({ progress: {} }),
        ...over,
    };
}

const open = async (api, search) => {
    for (const k of [...params.keys()]) params.delete(k);
    for (const [k, v] of new URLSearchParams(search)) params.set(k, v);
    replaced.length = 0;
    const result = await initNode({ api });
    await wait(5);
    return result;
};
const html = () => dom.content.innerHTML;
const classes = () => dom.bodyClasses || [];

beforeEach(() => dom.reset());

describe('เปิดกิจกรรมตามชนิด', () => {
    test('ชุดเนื้อหา: หัวหน้า (บท + ชื่อ) ลิงก์กลับเส้นทางเรียน ชื่อแท็บ และเนื้อหาหน้าแรก', async () => {
        const api = fakeApi(contentNode);
        await open(api, '?s=sci&l=2&n=sci-n1');
        assert.deepEqual(api.calls, [['getNode', 'sci', '2', 'sci-n1']]);
        assert.equal(dom.el.eyebrow.textContent, 'บทที่ 2 • กรด-เบสเบื้องต้น');
        assert.equal(dom.el.pageTitle.textContent, 'pH คืออะไร');
        assert.equal(dom.el.backLink.href, 'course.html?s=sci');
        assert.equal(globalThis.document.title, 'HEADFACE Study - pH คืออะไร');
        assert.match(html(), /หน้า 1\/2 • ค่า pH/);
        assert.match(html(), /หน้าแรก/);
        assert.equal(dom.el.view.toggled['has-abar'], true);
    });

    test('จบเนื้อหา → ปุ่มไปกิจกรรมถัดไปชี้ไปวงถัดไปของบทเดียวกัน', async () => {
        const api = fakeApi(contentNode);
        await open(api, '?s=sci&l=2&n=sci-n1');
        dom.click({ act: 'cn-next' });
        await wait(5);
        dom.click({ act: 'cn-finish' });
        await wait(5);
        assert.match(html(), /href="lesson\.html\?s=sci&amp;l=2&amp;n=sci-z1"[^>]*><span>ไปกิจกรรมถัดไป/);
        assert.equal(dom.el.view.toggled['has-abar'], false);
    });

    test('Quiz: แสดงหน้าเริ่มของชุดนั้น และไม่มีกิจกรรมถัดไปก็กลับเส้นทางเรียน', async () => {
        const api = fakeApi(quizNode);
        await open(api, '?s=sci&l=2&n=sci-z1');
        assert.match(html(), /Quiz ชุด 1/);
        assert.match(html(), /3 ข้อ/);
        assert.match(html(), /data-act="quiz-start"/);
        assert.equal(dom.el.pageTitle.textContent, 'Quiz ชุด 1');
    });

    test('Practice: โหลดโจทย์ของชุดนั้น', async () => {
        const api = fakeApi(practiceNode);
        await open(api, '?s=sci&l=2&n=sci-p1');
        assert.match(html(), /ข้อ 1 โจทย์ฝึก/);
        assert.match(html(), /ทำแล้ว 0\/1/);
    });

    test('เลขบทเป็น current ก็ส่งต่อให้ Backend', async () => {
        const api = fakeApi(contentNode);
        await open(api, '?s=sci&l=current&n=sci-n1');
        assert.deepEqual(api.calls[0], ['getNode', 'sci', 'current', 'sci-n1']);
    });
});

describe('ลิงก์เก่าที่ไม่ระบุ node', () => {
    test('?tab=quiz → Quiz แรกของบท และ URL ถูกเปลี่ยนเป็นลิงก์ที่ชี้กิจกรรมนั้น', async () => {
        const api = fakeApi(quizNode);
        await open(api, '?s=sci&l=2&tab=quiz');
        assert.deepEqual(api.calls, [['getLesson', 'sci', '2'], ['getNode', 'sci', '2', 'sci-z1']]);
        assert.deepEqual(replaced.at(-1), [null, '', 'lesson.html?s=sci&l=2&n=sci-z1']);
    });

    test('ไม่ระบุ tab → กิจกรรมที่ระบบบอกว่า "ถัดไป"', async () => {
        const api = fakeApi(quizNode);
        await open(api, '?s=sci&l=current');
        assert.deepEqual(api.calls[1], ['getNode', 'sci', '2', 'sci-z1']);
        assert.equal(replaced.at(-1)[2], 'lesson.html?s=sci&l=2&n=sci-z1', 'เลขบทจริงถูกใส่แทน current');
    });

    test('pickNode: ตาม tab, ไม่งั้นวงที่ถัดไป, ไม่งั้นวงแรกที่ยังไม่เสร็จ (ไม่นับ Practice), ไม่งั้นวงแรก', () => {
        const nodes = [{ id: 'a', type: 'content', status: 'done' }, { id: 'b', type: 'practice', status: 'todo' }, { id: 'c', type: 'quiz', status: 'todo' }, { id: 'd', type: 'quiz', status: 'todo' }];
        assert.equal(pickNode(nodes, 'quiz').id, 'c');
        assert.equal(pickNode(nodes, 'practice').id, 'b');
        assert.equal(pickNode(nodes, 'content').id, 'a');
        assert.equal(pickNode(nodes, null).id, 'c', 'ข้าม Practice ที่ไม่บังคับ');
        assert.equal(pickNode([...nodes.slice(0, 2), { id: 'e', type: 'quiz', status: 'now' }], null).id, 'e');
        assert.equal(pickNode([{ id: 'x', type: 'content', status: 'done' }], null).id, 'x');
        assert.equal(pickNode(nodes, 'practice').id, 'b');
        assert.equal(pickNode([{ id: 'a', type: 'content', status: 'done' }], 'quiz').id, 'a', 'ไม่มีชนิดที่ขอ → ตกไปใช้กิจกรรมที่เหมาะสม');
        assert.equal(pickNode([], null), null);
        assert.equal(pickNode(null, null), null);
    });

    test('บทที่ไม่มีกิจกรรมเลย → ไม่พบกิจกรรม', async () => {
        const api = fakeApi(contentNode, { getLesson: async () => ({ subject: SUBJECT, lesson: { ...LESSON, nodes: [] } }) });
        await open(api, '?s=sci&l=2');
        assert.match(html(), /บทนี้ยังไม่มีกิจกรรม/);
        assert.equal(api.calls.length, 0);
    });
});

describe('ข้อผิดพลาดและรหัสแปลก ๆ', () => {
    test('รหัสวิชา เลขบท หรือ node ที่ผิดรูปแบบ → ไม่พบ โดยไม่เรียก API', async () => {
        for (const search of ['', '?s=SCI&l=1&n=x1', '?s=sci&l=abc&n=sci-n1', '?s=sci&l=0&n=sci-n1', '?s=sci&l=1&n=A_B', '?s=sci&l=1&n=-bad', `?s=sci&l=1&n=${'a'.repeat(81)}`]) {
            const api = fakeApi(contentNode);
            await open(api, search);
            assert.equal(api.calls.length, 0, search);
            assert.match(html(), /role="alert"/, search);
            assert.match(html(), /href="(subject\.html|course\.html\?s=sci)"/, search);
        }
    });

    test('ไม่พบกิจกรรม (404) → ไม่พบ พร้อมลิงก์กลับเส้นทางเรียน', async () => {
        const api = fakeApi(contentNode, { getNode: async () => { throw new StudyApiError('NOT_FOUND', 404, 'ไม่พบข้อมูลที่ต้องการ'); } });
        await open(api, '?s=sci&l=2&n=sci-nope');
        assert.match(html(), /ไม่พบกิจกรรมนี้/);
        assert.match(html(), /href="course\.html\?s=sci"/);
    });

    test('โหลดไม่สำเร็จ → ข้อความจาก Backend และลองใหม่ได้', async () => {
        let fail = true;
        const api = fakeApi(contentNode, { getNode: async () => { if (fail) throw new StudyApiError('INTERNAL_ERROR', 500, 'เกิดข้อผิดพลาดภายในระบบ'); return { subject: SUBJECT, lesson: LESSON, node: contentNode(), nav: NAV }; } });
        await open(api, '?s=sci&l=2&n=sci-n1');
        assert.match(html(), /เกิดข้อผิดพลาดภายในระบบ/);
        assert.match(html(), /data-act="retry"/);
        assert.equal(dom.el.pageTitle.textContent, 'โหลดข้อมูลไม่สำเร็จ');
    });

    test('ป้ายชนิดกิจกรรม', () => {
        assert.deepEqual(['content', 'quiz', 'practice', 'x'].map(nodeTypeLabel), ['เนื้อหา', 'Quiz', 'Practice', '']);
    });
});
