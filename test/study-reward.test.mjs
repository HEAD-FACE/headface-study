// EXP ที่ได้รับ (js/study-reward.js และที่ที่แสดง): ป้าย +N EXP หลังจบเนื้อหา/Quiz/Practice, EXP ในการ์ดของวงกลม,
// ตัวเลข EXP/ดาว/เลเวลจริงที่หน้า Home และ Progress กฎการคิด (ครั้งแรกเต็ม ทำซ้ำครึ่งเดียว) อยู่ที่ Backend ที่นี่แค่แสดงตามที่ได้รับมา
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null, title: '', addEventListener() {} };
globalThis.CSS = { escape: (s) => s };

const { expPillHtml, animateReward } = await import('../js/study-reward.js');
const { createContent } = await import('../js/study-live-content.js');
const { createQuiz } = await import('../js/study-live-quiz.js');
const { createPractice } = await import('../js/study-live-practice.js');
const C = await import('../js/study-course.js');
const { rewardsView, applyRewards } = await import('../js/study-hydrate.js');

const settle = () => new Promise((r) => setTimeout(r, 5));
const REWARD = (over = {}) => ({ exp: 25, baseExp: 25, firstTime: true, halved: false, stars: 0, totals: { exp: 125, stars: 0, level: { level: 2, from: 50, to: 200, pct: 50, toNext: 75 } }, ...over });

describe('ป้าย +N EXP', () => {
    test('แสดงจำนวน EXP (นับขึ้นด้วย data-exp-count); ทำซ้ำมีป้ายบอกว่าได้ครึ่งเดียว', () => {
        const h = expPillHtml(REWARD());
        assert.match(h, /class="pill gold exp-pill" aria-label="ได้รับ 25 EXP"/);
        assert.match(h, /\+<span data-exp-count="25">25<\/span> EXP/);
        assert.doesNotMatch(h, /ครึ่งเดียว/);
        assert.match(expPillHtml(REWARD({ exp: 6, halved: true, firstTime: false })), /data-exp-count="6"[\s\S]*<span class="pill">ทำซ้ำ ได้ครึ่งเดียว<\/span>/);
    });
    test('ไม่ได้อะไร (null / 0 / ค่าแปลก) = ไม่แสดงอะไรเลย', () => {
        assert.equal(expPillHtml(null), '');
        assert.equal(expPillHtml(undefined), '');
        assert.equal(expPillHtml({ exp: 0 }), '');
        assert.equal(expPillHtml({ exp: 'x' }), '');
    });
    test('animateReward ไม่พังเมื่อไม่มี DOM จริง', () => {
        animateReward(null);
        animateReward({});
    });
});

describe('หลังจบกิจกรรม', () => {
    test('จบเนื้อหา: หน้าสำเร็จแสดง EXP ที่ได้', async () => {
        const node = { id: 'n1', type: 'content', title: 'เรื่อง', pages: [{ title: null, blocks: [{ type: 'paragraph', text: 'ก' }] }], progress: { pageReached: 0, completedAt: null } };
        const api = { setNodeProgress: async () => ({ progress: {}, reward: REWARD({ exp: 12, baseExp: 12 }) }) };
        const content = createContent({ subject: { id: 'sci' }, lessonNo: 1, node, api, render() {}, nextHref: null, courseHref: 'course.html?s=sci' });
        content.handleClick({ target: { closest: () => ({ dataset: { act: 'cn-finish' } }) } });
        await settle();
        assert.match(content.html(), /data-exp-count="12"/);
    });
    test('จบเนื้อหาแล้วไม่ได้ EXP (ทำซ้ำถี่ ๆ) → ไม่มีป้าย', async () => {
        const node = { id: 'n1', type: 'content', title: 'เรื่อง', pages: [{ title: null, blocks: [{ type: 'paragraph', text: 'ก' }] }], progress: { pageReached: 0, completedAt: 5 } };
        const api = { setNodeProgress: async () => ({ progress: {}, reward: null }) };
        const content = createContent({ subject: { id: 'sci' }, lessonNo: 1, node, api, render() {}, nextHref: null, courseHref: 'course.html?s=sci' });
        content.handleClick({ target: { closest: () => ({ dataset: { act: 'cn-finish' } }) } });
        await settle();
        assert.match(content.html(), /เรียนจบแล้ว/);
        assert.doesNotMatch(content.html(), /exp-pill/);
    });

    test('Quiz: หน้าผลแสดง EXP ของการทำครั้งนั้น', async () => {
        const Q = [{ id: 'q1', n: 1, topic: 'ก', text: 'โจทย์', media: [], choices: [{ id: 'a', text: 'ก' }, { id: 'b', text: 'ข' }] }];
        const node = { id: 'z1', type: 'quiz', title: 'Quiz', quiz: { available: true, questionCount: 1, passPct: 50 }, progress: { attempts: 0, best: null, last: null, passed: false } };
        const api = {
            startQuiz: async () => ({ attempt: { id: 'qa_abcdefghij', questions: Q } }),
            answerQuiz: async () => ({ feedback: { questionId: 'q1', isCorrect: true, yourChoiceId: 'a', correctChoiceId: 'a', explanation: 'x', topic: 'ก' } }),
            submitQuiz: async () => ({ result: { attemptId: 'qa_abcdefghij', correct: 1, total: 1, answered: 1, percent: 100, passed: true, review: [] }, node: { id: 'z1', progress: {} }, lesson: { status: 'now' }, reward: REWARD({ exp: 15, baseExp: 30, halved: true, firstTime: false }) }),
        };
        const quiz = createQuiz({ subject: { id: 'sci' }, lessonNo: 1, node, api, render() {}, applyProgress() {}, nextHref: null, courseHref: 'course.html?s=sci' });
        const click = (t) => quiz.handleClick({ target: { closest: (sel) => (sel === '[data-act]' && t.act ? { dataset: { act: t.act } } : sel === '[data-choice]' && t.choice ? { dataset: { choice: t.choice } } : null) } });
        click({ act: 'quiz-start' }); await settle();
        click({ choice: 'a' }); click({ act: 'quiz-check' }); await settle();
        click({ act: 'quiz-next' }); await settle();
        const h = quiz.html();
        assert.match(h, /data-exp-count="15"/);
        assert.match(h, /ทำซ้ำ ได้ครึ่งเดียว/);
    });

    test('Practice: EXP มาตอนให้ผลข้อสุดท้ายของชุด และแสดงในหน้าสรุป', async () => {
        const items = [{ id: 'p1', n: 1, level: 'easy', topic: 'ก', text: 'ฝึก 1', result: null }, { id: 'p2', n: 2, level: 'easy', topic: 'ก', text: 'ฝึก 2', result: null }];
        let marked = 0;
        const api = {
            getPractice: async () => ({ summary: { total: 2, done: 0, ok: 0, wrong: 0 }, items }),
            getSolution: async () => ({ solution: 'วิธีทำ' }),
            setPracticeResult: async (s, no, id, result) => { marked++; return { summary: { total: 2, done: marked, ok: marked, wrong: 0 }, reward: marked === 2 ? REWARD({ exp: 8, baseExp: 8 }) : null }; },
        };
        const practice = createPractice({ subject: { id: 'sci' }, lessonNo: 1, node: { id: 'sci-p1' }, api, render() {}, applySummary() {}, nextHref: null, courseHref: 'course.html?s=sci', advanceMs: 0 });
        const click = (t) => practice.handleClick({ target: { closest: (sel) => (sel === '[data-pshow]' && t.show ? { dataset: { pshow: t.show } } : sel === '[data-pmark]' && t.mark ? { dataset: { pmark: t.mark } } : null) } });
        practice.open(); await settle();
        for (const id of ['p1', 'p2']) { click({ show: id }); await settle(); click({ mark: `${id}:ok` }); await settle(); practice.step(1); }
        const h = practice.html();
        assert.match(h, /data-key="pk-done"/);
        assert.match(h, /data-exp-count="8"/);
    });
});

describe('การ์ดของวงกลมบนเส้นทางเรียน', () => {
    const node = (over) => ({ id: 'sci-n1', type: 'content', title: 'เรื่อง', status: 'todo', pageCount: 2, progress: { pageCount: 2, pageReached: 0, completedAt: null }, ...over });
    test('บอก EXP ที่วงนี้ให้ตอนนี้ (ทำซ้ำได้ครึ่งเดียวตามที่ Backend คำนวณ) และไม่แสดงเมื่อไม่มีข้อมูล/ไม่ให้', () => {
        assert.deepEqual(C.nodeInfo(node({ reward: { exp: 12, repeat: false } }), 'sci', 1).exp, { exp: 12, repeat: false });
        assert.deepEqual(C.nodeInfo(node({ reward: { exp: 6, repeat: true } }), 'sci', 1).exp, { exp: 6, repeat: true });
        assert.equal(C.nodeInfo(node(), 'sci', 1).exp, null, 'ระบบรางวัลยังไม่เปิด');
        assert.equal(C.nodeInfo(node({ reward: { exp: 0, repeat: false } }), 'sci', 1).exp, null);
        const ctx = { subjectId: 'sci', lessonNo: 1, index: 0, seq: 0 };
        assert.match(C.nodeHtml(node({ reward: { exp: 12, repeat: false } }), ctx), /<span class="cp-pop-exp">\+12 EXP<\/span>/);
        assert.match(C.nodeHtml(node({ status: 'done', reward: { exp: 6, repeat: true } }), ctx), /<span class="cp-pop-exp">\+6 EXP • ทำซ้ำ<\/span>/);
        assert.doesNotMatch(C.nodeHtml(node(), ctx), /cp-pop-exp/);
        const quiz = C.nodeInfo({ id: 'z', type: 'quiz', title: 'Q', status: 'todo', questionCount: 3, progress: { attempts: 0, best: null, passed: false }, reward: { exp: 38, repeat: false } }, 'sci', 1);
        assert.equal(quiz.exp.exp, 38);
    });
});

describe('Home / Progress: EXP ดาว เลเวลจริง', () => {
    test('rewardsView: ตัวเลขมีจุลภาค เลเวลและความคืบหน้า; ไม่มีข้อมูล = เริ่มที่ 0 / Lv. 1', () => {
        assert.deepEqual(rewardsView({ exp: 2480, stars: 74, level: { level: 8, pct: 33 } }), { exp: '2,480', stars: '74', level: 'Lv. 8', 'level-long': 'เลเวล 8', next: 'สู่ Lv. 9 (33%)', pct: 33 });
        assert.deepEqual(rewardsView(undefined), { exp: '0', stars: '0', level: 'Lv. 1', 'level-long': 'เลเวล 1', next: 'สู่ Lv. 2 (0%)', pct: 0 });
        assert.equal(rewardsView({ exp: -5, stars: 'x', level: { level: 0, pct: 900 } }).level, 'Lv. 1');
        assert.equal(rewardsView({ exp: 1, stars: 1, level: { level: 2, pct: 900 } }).pct, 100);
    });
    test('applyRewards ใส่ค่าลงองค์ประกอบที่ทำเครื่องหมายไว้ และซ่อนส่วนตัวอย่าง (อันดับ) เท่านั้น', () => {
        const el = (key) => ({ attr: key, textContent: 'ตัวอย่าง', style: {}, getAttribute() { return key; } });
        const els = ['exp', 'stars', 'level', 'level-long', 'next', 'level-bar'].map(el);
        const hidden = { style: {} };
        const scope = { querySelectorAll: (sel) => (sel === '[data-study-reward]' ? els : sel === '[data-study-hide-real]' ? [hidden] : []) };
        applyRewards(scope, { exp: 125, stars: 5, level: { level: 2, pct: 50 } });
        assert.deepEqual(els.slice(0, 5).map((e) => e.textContent), ['125', '5', 'Lv. 2', 'เลเวล 2', 'สู่ Lv. 3 (50%)']);
        assert.equal(els[5].style.width, '50%');
        assert.equal(els[5].textContent, 'ตัวอย่าง', 'แถบไม่ถูกเขียนข้อความ');
        assert.equal(hidden.style.display, 'none');
    });
});
