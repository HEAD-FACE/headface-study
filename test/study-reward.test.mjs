// EXP ที่ได้รับ (js/study-reward.js และที่ที่แสดง): EXP ก่อนเริ่ม (ขั้นต่ำ/สูงสุด), EXP ระหว่างทำ Quiz, หน้า EXP และเลื่อนเลเวลหลังจบ,
// EXP ในการ์ดของวงกลม, ตัวเลข EXP/ดาว/เลเวลจริงที่หน้า Home และ Progress กฎการคิด (ครั้งแรกเต็ม ทำซ้ำครึ่งเดียว) อยู่ที่ Backend ที่นี่แค่แสดง
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null, title: '', addEventListener() {} };
globalThis.CSS = { escape: (s) => s };

const { expRangeChipsHtml, expTagHtml } = await import('../js/study-reward.js');
const { createContent } = await import('../js/study-live-content.js');
const { createQuiz } = await import('../js/study-live-quiz.js');
const { createPractice } = await import('../js/study-live-practice.js');
const C = await import('../js/study-course.js');
const { rewardsView, applyRewards } = await import('../js/study-hydrate.js');

const settle = () => new Promise((r) => setTimeout(r, 5));
const REWARD = (over = {}) => ({
    exp: 25, baseExp: 25, firstTime: true, halved: false, stars: 0, levelUp: null,
    totals: { exp: 125, stars: 0, level: { level: 2, from: 50, to: 200, pct: 50, toNext: 75 } }, ...over,
});

describe('EXP ก่อนเริ่ม', () => {
    test('บอกขั้นต่ำ (ทำเสร็จก็ได้) และสูงสุด (ถูกหมด); ทำซ้ำมีป้ายว่าได้ครึ่งเดียว; ขั้นต่ำ = สูงสุดแสดงตัวเดียว', () => {
        const h = expRangeChipsHtml({ exp: 37, min: 15, repeat: false });
        assert.match(h, /อย่างน้อย \+15 EXP/);
        assert.match(h, /สูงสุด \+37/);
        assert.doesNotMatch(h, /ครึ่งเดียว/);
        assert.match(expRangeChipsHtml({ exp: 18, min: 7, repeat: true }), /อย่างน้อย \+7 EXP[\s\S]*สูงสุด \+18[\s\S]*ทำซ้ำ ได้ครึ่งเดียว/);
        const single = expRangeChipsHtml({ exp: 10, min: 10, repeat: false });
        assert.match(single, /\+10 EXP/);
        assert.doesNotMatch(single, /อย่างน้อย|สูงสุด/);
        assert.match(expRangeChipsHtml({ exp: 10, repeat: false }), /\+10 EXP/, 'ไม่มี min = ตัวเดียว');
        assert.match(expRangeChipsHtml({ min: 15, max: 35, repeat: false }), /อย่างน้อย \+15 EXP[\s\S]*สูงสุด \+35/, 'รูป { min, max } ของ Mock / ชุดที่สุ่มแล้ว');
    });
    test('ไม่มีข้อมูล/ไม่ให้ EXP = ไม่แสดงอะไร', () => {
        for (const r of [null, undefined, { exp: 0 }, { exp: 'x' }]) { assert.equal(expRangeChipsHtml(r), ''); assert.equal(expTagHtml(r), ''); }
        assert.match(expTagHtml({ exp: 10 }), /class="xp-pill cn-xp"[^>]*>[\s\S]*\+10/);
    });
    test('Quiz: หน้าเริ่มแสดง EXP ขั้นต่ำ/สูงสุดก่อนกดเริ่ม', async () => {
        const node = { id: 'z1', type: 'quiz', title: 'Quiz', quiz: { available: true, questionCount: 4, passPct: 50 }, progress: { attempts: 0, best: null, last: null, passed: false }, reward: { exp: 37, min: 15, repeat: false } };
        const quiz = createQuiz({ subject: { id: 'sci' }, lessonNo: 1, node, api: {}, render() {}, applyProgress() {}, nextHref: null, courseHref: 'course.html?s=sci' });
        assert.match(quiz.html(), /อย่างน้อย \+15 EXP[\s\S]*สูงสุด \+37/);
        node.reward = undefined;
        assert.doesNotMatch(quiz.html(), /EXP/, 'ไม่มีข้อมูล = ไม่แสดง');
    });
    test('เนื้อหา: มีป้ายเล็กบอก EXP ที่จะได้ตั้งแต่เริ่มอ่าน', () => {
        const node = { id: 'n1', type: 'content', title: 'เรื่อง', pages: [{ title: null, blocks: [{ type: 'paragraph', text: 'ก' }] }, { title: null, blocks: [{ type: 'paragraph', text: 'ข' }] }], progress: { pageReached: 0, completedAt: null }, reward: { exp: 10, min: 10, repeat: false } };
        const content = createContent({ subject: { id: 'sci' }, lessonNo: 1, node, api: {}, render() {}, nextHref: null, courseHref: 'c' });
        assert.match(content.html(), /class="cn-count">1\/2<\/span><span class="xp-pill cn-xp"[^>]*>[\s\S]*\+10/);
    });
});

describe('ระหว่างทำ Quiz', () => {
    const Q = ['q1', 'q2', 'q3', 'q4'].map((id, i) => ({ id, n: i + 1, topic: 'ก', text: `โจทย์ ${i + 1}`, media: [], choices: [{ id: 'a', text: 'ก' }, { id: 'b', text: 'ข' }] }));
    const KEY = { q1: 'a', q2: 'a', q3: 'b', q4: 'a' };
    const make = ({ repeat = false, passPct = 50, submit } = {}) => {
        const node = { id: 'z1', type: 'quiz', title: 'Quiz', quiz: { available: true, questionCount: 4, passPct }, progress: { attempts: 0, best: null, last: null, passed: false } };
        const api = {
            startQuiz: async () => ({ attempt: { id: 'qa_abcdefghij', questions: Q, reward: { min: 15, max: 39, repeat } } }),
            answerQuiz: async (attempt, q, choice) => ({ feedback: { questionId: q, isCorrect: choice === KEY[q], exp: choice === KEY[q] ? 6 : 0, yourChoiceId: choice, correctChoiceId: KEY[q], explanation: 'เพราะ', topic: 'ก' } }),
            submitQuiz: submit || (async () => ({ result: { attemptId: 'qa_abcdefghij', correct: 3, total: 4, answered: 4, percent: 75, passed: true, review: [] }, node: { id: 'z1', progress: {} }, lesson: { status: 'now' }, reward: REWARD() })),
        };
        const quiz = createQuiz({ subject: { id: 'sci' }, lessonNo: 1, node, api, render() {}, applyProgress() {}, nextHref: 'lesson.html?s=sci&l=1&n=p', courseHref: 'course.html?s=sci' });
        const click = (t) => quiz.handleClick({ target: { closest: (sel) => (sel === '[data-act]' && t.act ? { dataset: { act: t.act } } : sel === '[data-choice]' && t.choice ? { dataset: { choice: t.choice } } : null) } });
        const answer = async (choice) => { click({ choice }); click({ act: 'quiz-check' }); await settle(); const html = quiz.html(); click({ act: 'quiz-next' }); await settle(); return html; };
        return { quiz, click, answer };
    };

    test('ตอบถูก: ได้ชม + "+N EXP" ตัวนับ EXP สะสมขึ้น; ตอบผิด: ไม่ได้ EXP แต่ได้เฉลยทันที', async () => {
        const { quiz, click, answer } = make();
        click({ act: 'quiz-start' }); await settle();
        assert.doesNotMatch(quiz.html(), /xp-pill/, 'ยังไม่ได้ EXP ก็ไม่แสดงตัวนับ');
        const first = await answer('a');
        assert.match(first, /<em class="xp-gain">[\s\S]*\+6 EXP<\/em>/);
        assert.match(first, /ถูกต้อง!/);
        assert.match(quiz.html(), /<span class="xp-pill"[^>]*><svg[\s\S]*<b>6<\/b>/, 'ตัวนับสะสม');
        const wrong = await answer('b');
        assert.doesNotMatch(wrong, /xp-gain/);
        assert.match(wrong, /<p class="fb-ans">เฉลย <b>ก ก<\/b><\/p>/);
        assert.match(quiz.html(), /<b>6<\/b>/, 'ตอบผิดตัวนับไม่ขยับ');
        const third = await answer('b');
        assert.match(third, /เยี่ยมมาก!|เก่งมาก!|ใช่เลย!|สุดยอด!|ถูกต้อง!/);
        assert.match(quiz.html(), /<b>12<\/b>/);
    });

    test('ถึงเกณฑ์ผ่านระหว่างทาง: บอก "ผ่านเกณฑ์แล้ว!" ครั้งเดียว', async () => {
        const { click, answer } = make({ passPct: 50 });
        click({ act: 'quiz-start' }); await settle();
        assert.doesNotMatch(await answer('a'), /passed-now/);
        assert.match(await answer('a'), /<em class="passed-now">ผ่านเกณฑ์แล้ว!<\/em>/, '2 จาก 4 = 50%');
        assert.doesNotMatch(await answer('b'), /passed-now/);
    });

    test('ทำวงที่เคยเสร็จแล้วซ้ำ: EXP ที่แสดงระหว่างทางเป็นครึ่งเดียว (ตรงกับที่จะได้จริง)', async () => {
        const { quiz, click, answer } = make({ repeat: true });
        click({ act: 'quiz-start' }); await settle();
        assert.match(await answer('a'), /\+3 EXP/);
        assert.match(quiz.html(), /<b>3<\/b>/);
    });

    test('จบชุด: คะแนน → EXP ที่ได้ → (เลื่อนเลเวล) → ไปต่อ ทีละหน้า', async () => {
        const submit = async () => ({
            result: { attemptId: 'qa_abcdefghij', correct: 3, total: 4, answered: 4, percent: 75, passed: true, review: [] },
            node: { id: 'z1', progress: {} }, lesson: { status: 'now' },
            reward: REWARD({ exp: 34, baseExp: 34, parts: { answers: 18, completion: 16 }, levelUp: { from: 1, to: 2 }, totals: { exp: 60, stars: 0, level: { level: 2, from: 50, to: 200, pct: 6, toNext: 140 } } }),
        });
        const { quiz, click } = make({ submit });
        click({ act: 'quiz-start' }); await settle();
        for (const c of ['a', 'a', 'b', 'a']) { click({ choice: c }); click({ act: 'quiz-check' }); await settle(); click({ act: 'quiz-next' }); await settle(); }
        let h = quiz.html();
        assert.match(h, /data-key="score-0"/);
        assert.match(h, /3<\/span><small>\/ 4 ข้อ/);
        const dots = (html) => (html.match(/<i class="(on|cur|)"><\/i>/g) || []).length;
        assert.equal(dots(h), 3, 'คะแนน, EXP, เลื่อนเลเวล');
        click({ act: 'rs-next' });
        h = quiz.html();
        assert.match(h, /data-key="exp-0"/);
        assert.match(h, /\+<span data-count="34">34<\/span><small>EXP/);
        assert.match(h, /ข้อที่ถูก \+18/);
        assert.match(h, /ทำเสร็จ \+16/);
        assert.match(h, /<b>Lv\. 1<\/b>[\s\S]*data-to="100" style="width:52%"/, 'เลื่อนเลเวล: แถบของเลเวลเดิมวิ่งเต็ม');
        assert.doesNotMatch(h, /ครึ่งเดียว/);
        click({ act: 'rs-next' });
        h = quiz.html();
        assert.match(h, /data-key="level-0"/);
        assert.match(h, /เลื่อนเป็นเลเวล/);
        assert.match(h, /Lv\. <span data-count="2">2<\/span>/);
        assert.match(h, /href="lesson\.html\?s=sci&amp;l=1&amp;n=p"[^>]*><span>ไปกิจกรรมถัดไป/, 'หน้าสุดท้ายคือปุ่มไปต่อ');
        assert.doesNotMatch(h, /data-act="rs-next"/);
    });

    test('ไม่ได้ EXP (reward เป็น null) → ไม่มีหน้า EXP และเลเวล', async () => {
        const { quiz, click } = make({ submit: async () => ({ result: { attemptId: 'qa_abcdefghij', correct: 3, total: 4, answered: 4, percent: 75, passed: true, review: [] }, node: { id: 'z1', progress: {} }, lesson: { status: 'now' }, reward: null }) });
        click({ act: 'quiz-start' }); await settle();
        for (const c of ['a', 'a', 'b', 'a']) { click({ choice: c }); click({ act: 'quiz-check' }); await settle(); click({ act: 'quiz-next' }); await settle(); }
        const h = quiz.html();
        assert.match(h, /data-key="score-0"/);
        assert.match(h, /href="lesson\.html\?s=sci&amp;l=1&amp;n=p"/, 'หน้าคะแนนเป็นหน้าสุดท้าย');
        assert.doesNotMatch(h, /data-act="rs-next"|rs-exp/);
    });
});

describe('หลังจบกิจกรรมอื่น', () => {
    const contentNode = (extra = {}) => ({ id: 'n1', type: 'content', title: 'เรื่อง', pages: [{ title: null, blocks: [{ type: 'paragraph', text: 'ก' }] }], progress: { pageReached: 0, completedAt: null }, ...extra });
    const finishContent = async (reward) => {
        const api = { setNodeProgress: async () => ({ progress: {}, reward }) };
        const content = createContent({ subject: { id: 'sci' }, lessonNo: 1, node: contentNode(), api, render() {}, nextHref: null, courseHref: 'course.html?s=sci' });
        content.handleClick({ target: { closest: () => ({ dataset: { act: 'cn-finish' } }) } });
        await settle();
        return content;
    };

    test('จบเนื้อหา: หน้าเฉลิมฉลองแสดง EXP ที่ได้ แล้วจึงถึงปุ่มไปต่อ', async () => {
        const content = await finishContent(REWARD({ exp: 12, baseExp: 12 }));
        let h = content.html();
        assert.match(h, /data-key="exp-0"/);
        assert.match(h, /เรียนจบแล้ว!/);
        assert.match(h, /data-count="12"/);
        content.handleClick({ target: { closest: () => ({ dataset: { act: 'rs-next' } }) } });
        h = content.html();
        assert.doesNotMatch(h, /data-act="rs-next"/);
    });
    test('จบเนื้อหาแล้วเลื่อนเลเวล → มีหน้าเลื่อนเลเวลต่อท้าย', async () => {
        const content = await finishContent(REWARD({ exp: 12, baseExp: 12, levelUp: { from: 2, to: 3 } }));
        content.handleClick({ target: { closest: () => ({ dataset: { act: 'rs-next' } }) } });
        assert.match(content.html(), /data-key="level-0"[\s\S]*data-count="3"/);
    });
    test('จบเนื้อหาแล้วไม่ได้ EXP (ทำซ้ำถี่ ๆ) → หน้าเดียว ไม่มีหน้า EXP', async () => {
        const content = await finishContent(null);
        const h = content.html();
        assert.match(h, /data-key="done-0"[\s\S]*เรียนจบแล้ว!/);
        assert.doesNotMatch(h, /rs-exp|data-act="rs-next"/);
    });

    test('Practice: EXP มาตอนให้ผลข้อสุดท้ายของชุด แสดงหลังหน้าสรุปสั้น ๆ', async () => {
        const items = [{ id: 'p1', n: 1, level: 'easy', topic: 'ก', text: 'ฝึก 1', result: null }, { id: 'p2', n: 2, level: 'easy', topic: 'ก', text: 'ฝึก 2', result: null }];
        let marked = 0;
        const api = {
            getPractice: async () => ({ summary: { total: 2, done: 0, ok: 0, wrong: 0 }, items }),
            getSolution: async () => ({ solution: 'วิธีทำ' }),
            setPracticeResult: async () => { marked++; return { summary: { total: 2, done: marked, ok: marked, wrong: 0 }, reward: marked === 2 ? REWARD({ exp: 8, baseExp: 8 }) : null }; },
        };
        const practice = createPractice({ subject: { id: 'sci' }, lessonNo: 1, node: { id: 'sci-p1' }, api, render() {}, applySummary() {}, nextHref: null, courseHref: 'course.html?s=sci', advanceMs: 0 });
        const click = (t) => practice.handleClick({ target: { closest: (sel) => (sel === '[data-pshow]' && t.show ? { dataset: { pshow: t.show } } : sel === '[data-pmark]' && t.mark ? { dataset: { pmark: t.mark } } : sel === '[data-act]' && t.act ? { dataset: { act: t.act } } : null) } });
        practice.open(); await settle();
        for (const id of ['p1', 'p2']) { click({ show: id }); await settle(); click({ mark: `${id}:ok` }); await settle(); practice.step(1); }
        let h = practice.html();
        assert.match(h, /data-key="done-0"/);
        assert.match(h, /ครบ 2 ข้อแล้ว/);
        click({ act: 'rs-next' });
        h = practice.html();
        assert.match(h, /data-key="exp-0"/);
        assert.match(h, /data-count="8"/);
        assert.match(h, /ทบทวนเรียบร้อย!/);
        assert.match(h, /href="course\.html\?s=sci"[^>]*><span>กลับไปเส้นทางเรียน/);
    });
});

describe('การ์ดของวงกลมบนเส้นทางเรียน', () => {
    const node = (over) => ({ id: 'sci-n1', type: 'content', title: 'เรื่อง', status: 'todo', pageCount: 2, progress: { pageCount: 2, pageReached: 0, completedAt: null }, ...over });
    test('บอก EXP ที่วงนี้ให้ (Quiz: ช่วงขั้นต่ำ–สูงสุด) ทำซ้ำได้ครึ่งเดียวตามที่ Backend คำนวณ และไม่แสดงเมื่อไม่มีข้อมูล/ไม่ให้', () => {
        assert.deepEqual(C.nodeInfo(node({ reward: { exp: 12, min: 12, repeat: false } }), 'sci', 1).exp, { exp: 12, min: 12, repeat: false });
        assert.deepEqual(C.nodeInfo(node({ reward: { exp: 6, min: 6, repeat: true } }), 'sci', 1).exp, { exp: 6, min: 6, repeat: true });
        assert.equal(C.nodeInfo(node(), 'sci', 1).exp, null, 'ระบบรางวัลยังไม่เปิด');
        assert.equal(C.nodeInfo(node({ reward: { exp: 0, repeat: false } }), 'sci', 1).exp, null);
        const ctx = { subjectId: 'sci', lessonNo: 1, index: 0, seq: 0 };
        assert.match(C.nodeHtml(node({ reward: { exp: 12, min: 12, repeat: false } }), ctx), /<span class="cp-pop-exp">\+12 EXP<\/span>/);
        assert.match(C.nodeHtml(node({ status: 'done', reward: { exp: 6, min: 6, repeat: true } }), ctx), /<span class="cp-pop-exp">\+6 EXP • ทำซ้ำ<\/span>/);
        assert.match(C.nodeHtml({ id: 'z', type: 'quiz', title: 'Q', status: 'todo', questionCount: 3, progress: { attempts: 0, best: null, passed: false }, reward: { exp: 38, min: 15, repeat: false } }, ctx), /<span class="cp-pop-exp">\+15–38 EXP<\/span>/);
        assert.doesNotMatch(C.nodeHtml(node(), ctx), /cp-pop-exp/);
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
