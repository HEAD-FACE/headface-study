// ทดสอบส่วนข้อมูลจริงของหน้าเรียน: ตัวเรียก API (study-api.js), เลือกโหมด (study-source.js),
// ตัวแปลงเนื้อหาบทเรียนเป็น HTML (study-blocks.js) และตัวเติมข้อมูลการ์ดวิชา (study-hydrate.js)
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStudyApi, StudyApiError, CONTRACT_VERSION } from '../js/study-api.js';
import { isDemo } from '../js/study-source.js';
import { lessonUrl, courseUrl, nodeUrl, FEATURES } from '../js/study-live.js';
import { blocksHtml } from '../js/study-blocks.js';
import { cardKey, subjectCardView, railSubjects, railCardHtml, answersStats, progressSectionHtml } from '../js/study-hydrate.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('study-api: ตัวเรียก API', () => {
    test('GET สำเร็จ: เรียก /api/study/... และคืนข้อมูลทั้งก้อน', async () => {
        const calls = [];
        const api = createStudyApi(async (p, o) => { calls.push([p, o]); return reply(200, { success: true, subjects: [1] }); });
        const data = await api.listSubjects();
        assert.deepEqual(data.subjects, [1]);
        assert.deepEqual(calls[0], ['/api/study/subjects', { method: 'GET' }]);
    });

    test('ตอบรายข้อ: คำตอบอยู่ใน answer ทุกรูปแบบ; ข้อความ (id ตัวเลือก / ตัวเลขที่พิมพ์) ส่ง choiceId ด้วยเพื่อให้ Backend รุ่นเก่ารับโจทย์เลือก 1 ข้อได้', async () => {
        const bodies = [];
        const api = createStudyApi(async (p, o) => { bodies.push([p, JSON.parse(o.body)]); return reply(200, { success: true }); });
        await api.answerQuiz('qa_abcdefghij', 'q1', 'b');
        await api.answerQuiz('qa_abcdefghij', 'q2', { l1: 'r2' });
        await api.answerQuiz('qa_abcdefghij', 'q3', ['a', 'c']);
        assert.deepEqual(bodies, [
            ['/api/study/quiz-attempts/qa_abcdefghij/answer', { questionId: 'q1', answer: 'b', choiceId: 'b' }],
            ['/api/study/quiz-attempts/qa_abcdefghij/answer', { questionId: 'q2', answer: { l1: 'r2' } }],
            ['/api/study/quiz-attempts/qa_abcdefghij/answer', { questionId: 'q3', answer: ['a', 'c'] }],
        ]);
    });

    test('รหัสวิชาและเลขบทถูก encode ใน path', async () => {
        const calls = [];
        const api = createStudyApi(async (p) => { calls.push(p); return reply(200, { success: true }); });
        await api.getSubject('sci');
        await api.getLesson('sci', 'current');
        await api.getLesson('a/b', '../x');
        assert.deepEqual(calls, ['/api/study/subjects/sci', '/api/study/subjects/sci/lessons/current', '/api/study/subjects/a%2Fb/lessons/..%2Fx']);
    });

    test('endpoint ของ node (วงกลมบนเส้นทางเรียน): ใช้เส้นทาง /nodes/:id เมื่อระบุ node และเส้นทางระดับบทเมื่อไม่ระบุ', async () => {
        const calls = [];
        const api = createStudyApi(async (p, o) => { calls.push([p, o.method, o.body]); return reply(200, { success: true }); });
        await api.getNode('sci', 2, 'sci-n1');
        await api.setNodeProgress('sci', 2, 'sci-n1', { page: 1, completed: true });
        await api.startQuiz('sci', 2, 'sci-z1');
        await api.startQuiz('sci', 2);
        await api.getPractice('sci', 2, 'sci-p1');
        await api.getPractice('sci', 2);
        await api.getSolution('sci', 2, 'sci-p1a', 'sci-p1');
        await api.setPracticeResult('sci', 2, 'sci-p1a', 'ok', 'sci-p1');
        await api.resetPractice('sci', 2, 'sci-p1');
        await api.resetPractice('sci', 2);
        assert.deepEqual(calls, [
            ['/api/study/subjects/sci/lessons/2/nodes/sci-n1', 'GET', undefined],
            ['/api/study/subjects/sci/lessons/2/nodes/sci-n1/progress', 'PUT', '{"page":1,"completed":true}'],
            ['/api/study/subjects/sci/lessons/2/nodes/sci-z1/quiz-attempts', 'POST', '{}'],
            ['/api/study/subjects/sci/lessons/2/quiz-attempts', 'POST', '{}'],
            ['/api/study/subjects/sci/lessons/2/nodes/sci-p1/practice', 'GET', undefined],
            ['/api/study/subjects/sci/lessons/2/practice', 'GET', undefined],
            ['/api/study/subjects/sci/lessons/2/nodes/sci-p1/practice/sci-p1a/solution', 'GET', undefined],
            ['/api/study/subjects/sci/lessons/2/nodes/sci-p1/practice/sci-p1a/result', 'PUT', '{"result":"ok"}'],
            ['/api/study/subjects/sci/lessons/2/nodes/sci-p1/practice/results', 'DELETE', undefined],
            ['/api/study/subjects/sci/lessons/2/practice/results', 'DELETE', undefined],
        ]);
    });

    test('id ของ node ถูก encode ใน path', async () => {
        const calls = [];
        const api = createStudyApi(async (p) => { calls.push(p); return reply(200, { success: true }); });
        await api.getNode('sci', 1, 'a/../b');
        assert.deepEqual(calls, ['/api/study/subjects/sci/lessons/1/nodes/a%2F..%2Fb']);
    });

    test('POST ส่ง body เป็น JSON', async () => {
        const calls = [];
        const api = createStudyApi(async (p, o) => { calls.push(o); return reply(200, { success: true }); });
        await api.request('/x', { method: 'POST', body: { a: 1 } });
        assert.deepEqual(calls[0], { method: 'POST', body: '{"a":1}' });
    });

    test('ข้อผิดพลาดจาก Backend: เก็บ code, status และข้อความไทยของ Backend', async () => {
        const api = createStudyApi(async () => reply(404, { success: false, error: 'NOT_FOUND', message: 'ไม่พบข้อมูลที่ต้องการ' }));
        await assert.rejects(api.getSubject('x'), (e) => e instanceof StudyApiError && e.code === 'NOT_FOUND' && e.status === 404 && e.message === 'ไม่พบข้อมูลที่ต้องการ');
    });

    test('200 แต่ success ไม่ใช่ true หรือไม่ใช่ JSON ถือเป็นผิดพลาด', async () => {
        await assert.rejects(createStudyApi(async () => reply(200, { success: false, error: 'X' })).getMe(), (e) => e.code === 'X');
        await assert.rejects(createStudyApi(async () => ({ ok: true, status: 200, json: async () => { throw new Error('not json'); } })).getMe(), (e) => e.code === 'HTTP_200');
        await assert.rejects(createStudyApi(async () => reply(502, null)).getMe(), (e) => e.code === 'HTTP_502' && /ลองใหม่/.test(e.message));
    });

    test('เครือข่ายล่ม → NETWORK; 401 จาก apiFetch → UNAUTHORIZED', async () => {
        await assert.rejects(createStudyApi(async () => { throw new TypeError('Failed to fetch'); }).getMe(), (e) => e.code === 'NETWORK' && e.status === 0 && /อินเทอร์เน็ต/.test(e.message));
        await assert.rejects(createStudyApi(async () => { throw new Error('UNAUTHORIZED'); }).getMe(), (e) => e.code === 'UNAUTHORIZED' && e.status === 401);
    });

    test('เวอร์ชันสัญญาตรงกับเอกสาร', () => {
        assert.equal(CONTRACT_VERSION, 2);
        assert.match(read('docs/study-api-contract.md'), /Contract v2/);
    });
});

describe('study-source: โหมดตัวอย่างเปิดได้เฉพาะ preview', () => {
    let store;
    const setPage = (hostname, search = '') => {
        store = new Map();
        globalThis.location = { hostname, search };
        globalThis.window = { location: globalThis.location };
        globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
    };
    beforeEach(() => setPage('beta-study.headface.app'));

    test('ค่าเริ่มต้นคือข้อมูลจริง', () => assert.equal(isDemo(), false));
    test('?demo=1 บน preview เปิดโหมดตัวอย่างและจำไว้ในแท็บ', () => {
        setPage('beta-study.headface.app', '?demo=1');
        assert.equal(isDemo(), true);
        globalThis.location.search = '';
        assert.equal(isDemo(), true, 'หน้าถัดไปที่ไม่มี ?demo ยังเป็นโหมดตัวอย่าง');
        globalThis.location.search = '?demo=0';
        assert.equal(isDemo(), false);
        globalThis.location.search = '';
        assert.equal(isDemo(), false);
    });
    test('production ไม่มีทางเปิดโหมดตัวอย่าง แม้ใส่ ?demo=1 หรือมีค่าค้างในแท็บ', () => {
        setPage('study.headface.app', '?demo=1');
        store.set('study_demo', '1');
        assert.equal(isDemo(), false);
        setPage('headface.app', '?demo=1');
        assert.equal(isDemo(), false);
    });
    test('localhost ถือเป็น preview', () => {
        setPage('localhost', '?demo=1');
        assert.equal(isDemo(), true);
    });
});

describe('study-blocks: แปลงบล็อกเนื้อหาเป็น HTML', () => {

    test('ข้อความทุกช่องถูก escape (ไม่ให้ HTML/สคริปต์หลุดเข้าหน้า)', () => {
        const html = blocksHtml([
            { type: 'heading', text: '<img src=x onerror=alert(1)>' },
            { type: 'paragraph', text: '"><script>alert(2)</script>' },
            { type: 'callout', title: '<b>t</b>', text: "a'b" },
            { type: 'steps', title: null, items: ['<i>1</i>'] },
            { type: 'checklist', title: null, items: ['</li><li>x'] },
        ]);
        assert.doesNotMatch(html, /<img |<script|<b>t|<i>1|<\/li><li>x/);
        assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
        assert.match(html, /a&#39;b/);
    });

    test('ข้อความหลายบรรทัดคงการขึ้นบรรทัดด้วย white-space:pre-line และสูตรที่มี < ไม่พัง', () => {
        const html = blocksHtml([{ type: 'paragraph', text: 'pH < 7\nx<y' }]);
        assert.match(html, /white-space:pre-line/);
        assert.match(html, /pH &lt; 7\nx&lt;y/);
    });

    test('heading/paragraph/figure ที่ติดกันรวมเป็นบล็อกเดียว; callout/steps/checklist แยกบล็อก', () => {
        const html = blocksHtml([
            { type: 'heading', text: 'H' }, { type: 'paragraph', text: 'P' },
            { type: 'callout', title: 'C', text: 'c' },
            { type: 'paragraph', text: 'Q' },
            { type: 'steps', title: 'S', items: ['a', 'b'] },
            { type: 'checklist', title: 'K', items: ['x'] },
        ]);
        assert.equal((html.match(/<article class="rblock">/g) || []).length, 4);
        assert.equal((html.match(/<li>/g) || []).length, 3);
        assert.ok(html.indexOf('>H<') < html.indexOf('class="rblock callout"'));
    });

    test('รูปและวิดีโอ: รับเฉพาะ https หรือไฟล์ใต้ assets/; ไฟล์วิดีโอใช้ <video>, ลิงก์อื่นเปิดแท็บใหม่แบบ noopener', () => {
        const html = blocksHtml([
            { type: 'figure', kind: 'image', url: 'https://example.com/a.png?x=1&y=2', alt: 'แผนภาพ "1"', caption: 'ภาพ' },
            { type: 'figure', kind: 'video', url: 'https://example.com/v.mp4', caption: 'วิดีโอ' },
            { type: 'figure', kind: 'video', url: 'https://www.youtube.com/watch?v=abc', caption: null },
            { type: 'figure', kind: 'image', url: 'http://example.com/insecure.png', alt: 'x', caption: null },
            { type: 'figure', kind: 'image', url: 'javascript:alert(1)', alt: 'x', caption: null },
        ]);
        assert.match(html, /<img src="https:\/\/example\.com\/a\.png\?x=1&amp;y=2" alt="แผนภาพ &quot;1&quot;" loading="lazy"/);
        assert.match(html, /<figcaption class="cap rcap">ภาพ<\/figcaption>/);
        assert.match(html, /<video controls preload="metadata" playsinline src="https:\/\/example\.com\/v\.mp4"/);
        assert.match(html, /<a class="btn btn-line" href="https:\/\/www\.youtube\.com\/watch\?v=abc" target="_blank" rel="noopener noreferrer"/);
        assert.doesNotMatch(html, /insecure|javascript:/);
    });

    test('ไม่มีบล็อก → ข้อความว่าง; ชนิดบล็อกที่ไม่รู้จักถูกข้าม', () => {
        assert.equal(blocksHtml([]), '');
        assert.equal(blocksHtml([{ type: 'script', text: 'x' }]), '');
    });
});

describe('study-live: ลิงก์และการเปิดฟีเจอร์', () => {
    test('ลิงก์ encode ค่าและรักษารูปแบบ ?s=&l=', () => {
        assert.equal(courseUrl('sci'), 'course.html?s=sci');
        assert.equal(lessonUrl('sci', 3), 'lesson.html?s=sci&l=3');
        assert.equal(lessonUrl('sci'), 'lesson.html?s=sci&l=current');
        assert.equal(lessonUrl('sci', 3, 'quiz'), 'lesson.html?s=sci&l=3&tab=quiz');
        assert.equal(lessonUrl('a&b', '1&2'), 'lesson.html?s=a%26b&l=1%262');
        assert.equal(nodeUrl('sci', 3, 'sci-n1'), 'lesson.html?s=sci&l=3&n=sci-n1');
        assert.equal(nodeUrl('a&b', 1, 'x&y'), 'lesson.html?s=a%26b&l=1&n=x%26y');
    });
    test('ทุกฟีเจอร์ที่ Backend มี endpoint รองรับแล้วเปิดอยู่ (ความคืบหน้า, Quiz, Practice, Mock)', () => {
        assert.deepEqual({ ...FEATURES }, { progress: true, quiz: true, practice: true, mock: true });
        assert.ok(Object.isFrozen(FEATURES));
    });
});

describe('study-hydrate: การ์ดวิชาและแถว "ทำต่อ"', () => {
    const sci = { id: 'sci', no: 1, title: 'วิทยาศาสตร์', hue: 'emerald', metaText: '16 บทเรียน • 110 แบบฝึกหัด', lessonsTotal: 16, lessonsDone: 0, pct: 0, lastActivityAt: null, current: { no: 1, title: 'บทแรก' } };
    const mat = { id: 'mat', no: 2, title: 'คณิตศาสตร์', hue: 'sky', metaText: null, lessonsTotal: 18, lessonsDone: 4, pct: 22, lastActivityAt: 2000, current: { no: 5, title: 'บทห้า' } };
    const eng = { id: 'eng', no: 4, title: 'อังกฤษ', hue: null, metaText: null, lessonsTotal: 0, lessonsDone: 0, pct: 0, lastActivityAt: null, current: null };
    const phy = { id: 'phy', no: 7, title: 'ฟิสิกส์', hue: 'cyan', metaText: null, lessonsTotal: 14, lessonsDone: 1, pct: 7, lastActivityAt: 5000, current: { no: 2, title: 'บทสอง' } };

    test('cardKey อ่านรหัสวิชาจากลิงก์ของการ์ด และไม่รับค่าแปลก', () => {
        assert.equal(cardKey('course.html?s=sci'), 'sci');
        assert.equal(cardKey('lesson.html?s=phy&l=current'), 'phy');
        for (const bad of ['', null, undefined, 'course.html', 'course.html?s=', 'course.html?s=SCI', 'course.html?s=1abc']) assert.equal(cardKey(bad), null, String(bad));
    });

    test('subjectCardView: ใช้ข้อความ/ตัวเลขจาก Backend, ป้ายปุ่ม "เรียนต่อ" เมื่อเริ่มแล้ว', () => {
        assert.deepEqual(subjectCardView(sci), { pct: 0, meta: '16 บทเรียน • 110 แบบฝึกหัด', started: false, goLabel: 'เข้าเรียน' });
        assert.deepEqual(subjectCardView(mat), { pct: 22, meta: '18 บทเรียน', started: true, goLabel: 'เรียนต่อ' });
        assert.equal(subjectCardView({ ...sci, pct: 250 }).pct, 100);
        assert.equal(subjectCardView({ ...sci, pct: 'x' }).pct, 0);
    });

    test('railSubjects: เริ่มแล้วล่าสุดก่อน ตามด้วยที่ยังไม่เริ่ม; ข้ามวิชาที่ไม่มีบท; จำกัดจำนวน', () => {
        assert.deepEqual(railSubjects([sci, mat, eng, phy]).map((s) => s.id), ['phy', 'mat', 'sci']);
        assert.deepEqual(railSubjects([sci, mat, eng, phy], 2).map((s) => s.id), ['phy', 'mat']);
        assert.deepEqual(railSubjects([]), []);
    });

    test('railCardHtml: ใช้สีของวิชา, ลิงก์ไปบทที่ค้าง และ escape ชื่อ', () => {
        const html = railCardHtml({ ...sci, title: '<b>x</b>', hue: 'em"erald' });
        assert.match(html, /class="cc hue-em&quot;erald"/);
        assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
        assert.match(html, /href="lesson\.html\?s=sci&amp;l=current"/);
        assert.match(html, /เริ่มเรียน/);
        assert.match(railCardHtml(mat), /ลุยต่อ/);
        assert.match(railCardHtml({ ...sci, hue: null }), /hue-emerald/);
    });
});

describe('การเชื่อมหน้า', () => {
    test('Home, Subjects และ Progress โหลด study-hydrate.js ก่อน main.js และเริ่มด้วย data-study-pending', () => {
        for (const page of ['index.html', 'subject.html']) {
            const html = read(page);
            assert.match(html, /<html lang="th" data-study-pending>/, page);
            assert.ok(html.indexOf('js/study-hydrate.js') > 0 && html.indexOf('js/study-hydrate.js') < html.indexOf('js/main.js'), page);
        }
        const progress = read('progress.html');
        assert.match(progress, /<html lang="th" data-study-pending>/);
        assert.ok(progress.indexOf('js/study-hydrate.js') > 0 && progress.indexOf('js/study-hydrate.js') < progress.indexOf('js/main.js'));
        assert.doesNotMatch(progress, /<section id="my-progress"[^>]*hidden>/, 'ส่วนผลการเรียนแสดงเป็น skeleton ระหว่างรอ ไม่ซ่อน');
        assert.match(progress, /id="my-progress-body"[^>]*aria-busy="true"><div class="ld-wrap"/);
        assert.match(progress, /data-study-stat="answers"/);
        assert.match(progress, /data-study-stat="accuracy"/);
    });

    test('Barba ปล่อยหน้า lesson/mock-exam/report ให้เป็นหน้าแยก แต่ course อยู่ใน Barba ร่วมกับหน้าหลัก', () => {
        const main = read('js/main.js');
        const m = /const FLOW_PAGE_PATTERN = (\/.*\/);/.exec(main);
        assert.ok(m, 'พบ FLOW_PAGE_PATTERN');
        const re = eval(m[1]); // eslint-disable-line no-eval
        for (const page of ['lesson', 'mock-exam', 'report']) assert.equal(re.test(`/${page}.html?s=sci`), true, page);
        for (const page of ['index', 'subject', 'progress']) assert.equal(re.test(`/${page}.html`), false, page);
        assert.equal(re.test('/course.html?s=sci'), false, 'course.html');
    });

    test('main.js ส่งเหตุการณ์ study:page จาก initPageFeatures', () => {
        const main = read('js/main.js');
        const fn = main.slice(main.indexOf('function initPageFeatures'), main.indexOf('// Floating Feedback Toast'));
        assert.match(fn, /dispatchEvent\(new CustomEvent\('study:page'/);
    });

    test('ข้อความตัวอย่างหน้าเรียนไม่รั่วเข้าโหมดข้อมูลจริง: study-live.js ไม่ import study-data.js', () => {
        assert.doesNotMatch(read('js/study-live.js'), /study-data\.js/);
        assert.doesNotMatch(read('js/study-hydrate.js'), /study-data\.js/);
        assert.doesNotMatch(read('js/study-live.js'), /\[ชื่อบทเรียน\]|\[โจทย์|\[คำอธิบายวิชา\]/);
    });

    test('ทุก URL ของ API มาจาก env.js เท่านั้น (ไม่ hard-code โดเมนใน study-*.js)', () => {
        for (const file of ['js/study-api.js', 'js/study-live.js', 'js/study-hydrate.js', 'js/study-source.js', 'js/study-ui.js']) {
            assert.doesNotMatch(read(file), /https?:\/\/[a-z0-9.-]*headface\.app/i, file);
        }
    });
});

describe('study-hydrate: ผลการเรียนของฉัน (หน้า Progress)', () => {
    const subjects = [
        { id: 'sci', no: 1, title: 'วิทยาศาสตร์', emoji: '🔬', hue: 'emerald', lessonsTotal: 6, lessonsDone: 1, pct: 17, lastActivityAt: 1790000000000, current: { no: 2, title: 'บท 2' } },
        { id: 'mat', no: 2, title: 'คณิต <b>', emoji: '📐', hue: 'sky', lessonsTotal: 4, lessonsDone: 0, pct: 0, lastActivityAt: null, current: { no: 1, title: 'บท 1' } },
        { id: 'tha', no: 3, title: 'ไทย', emoji: '✍️', hue: 'rose', lessonsTotal: 2, lessonsDone: 2, pct: 100, lastActivityAt: 1780000000000, current: null },
    ];
    const progress = {
        overall: { lessonsDone: 3, lessonsTotal: 12, pct: 25, subjectsStarted: 2, subjectsCompleted: 1 },
        answers: { total: 12, correct: 9, accuracy: 75 },
        recent: [{ type: 'quiz', subjectId: 'sci', lessonNo: 1, at: 1790000000000, correct: 3, total: 3 }, { type: 'mock', subjectId: 'mat', at: 1780000000000, correct: 2, total: 5 }],
    };

    test('answersStats: ข้อความสถิติจากคำตอบจริง; ยังไม่มีคำตอบ → "—" ไม่ใช่ 0%', () => {
        assert.deepEqual(answersStats({ total: 12, correct: 9, accuracy: 75 }), { answers: '12 ข้อ', accuracy: '75%' });
        assert.deepEqual(answersStats({ total: 0, correct: 0, accuracy: null }), { answers: '0 ข้อ', accuracy: '—' });
    });

    test('ส่วนผลการเรียน: ความคืบหน้ารวม รายวิชา (ลิงก์ไปหน้ารายงาน) พร้อม escape และไม่มีรายการ "ผลล่าสุด" แล้ว', () => {
        const h = progressSectionHtml(subjects, progress);
        assert.match(h, /25%<\/span><span class="cap">ความคืบหน้ารวม/);
        assert.match(h, /เรียนจบ 3 จาก 12 บทเรียน/);
        assert.match(h, /เริ่มเรียนแล้ว 2 วิชา • เรียนครบ 1 วิชา/);
        assert.match(h, /href="report\.html\?s=sci"/);
        assert.match(h, /href="report\.html\?s=tha"/, 'วิชาที่เรียนครบแล้วยังแสดง');
        assert.match(h, /คณิต &lt;b&gt;/);
        assert.doesNotMatch(h, /คณิต <b>/);
        assert.doesNotMatch(h, /ผลล่าสุด|mp-recent|Quiz บทที่ 1 • วิทยาศาสตร์|Mock Exam • คณิต/, 'ข้อมูล recent ยังส่งมาได้ แต่หน้าไม่แสดง');
        assert.ok(h.indexOf('report.html?s=sci') < h.indexOf('report.html?s=mat'), 'วิชาที่เริ่มแล้วขึ้นก่อน');
    });

    test('ยังไม่มีวิชา → ข้อความแทนรายการว่าง', () => {
        const h = progressSectionHtml([], { overall: { lessonsDone: 0, lessonsTotal: 0, pct: 0, subjectsStarted: 0, subjectsCompleted: 0 }, answers: { total: 0, correct: 0, accuracy: null }, recent: [] });
        assert.match(h, /ยังไม่มีวิชาที่เปิดให้เรียน/);
        assert.doesNotMatch(h, /ผลล่าสุด/);
    });
});
