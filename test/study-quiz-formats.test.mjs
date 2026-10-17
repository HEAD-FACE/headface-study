// ทดสอบ Quiz ที่มีโจทย์รูปแบบใหม่ (js/study-live-quiz.js + js/study-qformats.js) ด้วย API จำลอง:
// กรอกตัวเลข (พิมพ์/Enter), จับคู่ (ถูกบางส่วน), จริง/เท็จ (ปัด), และหน้าทบทวนหลังจบชุด
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null };
globalThis.CSS = { escape: (s) => s };

const { createQuiz } = await import('../js/study-live-quiz.js');

const NUM = { id: 'qn', n: 1, topic: 'เคมี', text: 'ความเข้มข้นเท่าไร', media: [], format: 'numeric', choices: [], spec: { unit: 'mol/L' } };
const MATCH = { id: 'qm', n: 2, topic: 'เคมี', text: 'จับคู่', media: [], format: 'match', choices: [], spec: { left: [{ id: 'l1', text: 'HCl' }, { id: 'l2', text: 'NaOH' }, { id: 'l3', text: 'NaCl' }], right: [{ id: 'r1', text: 'กรด' }, { id: 'r2', text: 'เบส' }, { id: 'r3', text: 'เกลือ' }] } };
const TF = { id: 'qt', n: 3, topic: 'เคมี', text: 'น้ำเดือดที่ 100 องศา', media: [], format: 'truefalse', choices: [{ id: 't', text: 'จริง' }, { id: 'f', text: 'เท็จ' }], spec: null };
const FEEDBACK = {
    qn: { format: 'numeric', isCorrect: true, score: 1, exp: 5, yourAnswer: 3.5, correct: { value: 3.5, tolerance: 0, unit: 'mol/L' }, explanation: 'คำนวณจาก n/V' },
    qm: { format: 'match', isCorrect: false, score: 1 / 3, exp: 3, yourAnswer: { l1: 'r1', l2: 'r3', l3: 'r2' }, correct: { l1: 'r1', l2: 'r2', l3: 'r3' }, explanation: 'กรดคู่กับ HCl' },
    qt: { format: 'truefalse', isCorrect: false, score: 0, exp: 0, yourChoiceId: 't', correctChoiceId: 'f', explanation: 'เดือดที่ 100 จริง แต่ที่ความดันปกติ' },
};

let calls;
let renders;
const fakeApi = (over = {}) => ({
    startQuiz: async () => ({ attempt: { id: 'qa_abcdefghij', questions: [NUM, MATCH, TF] } }),
    answerQuiz: async (attempt, q, answer) => { calls.push([attempt, q, answer]); return { alreadyAnswered: false, feedback: { questionId: q, ...FEEDBACK[q] } }; },
    submitQuiz: async () => { throw new Error('not used'); },
    ...over,
});
const make = (api) => createQuiz({
    subject: { id: 'sci' }, lessonNo: 1,
    node: { id: 'sci-z1', type: 'quiz', title: 'Quiz ชุด 1', quiz: { available: true, questionCount: 3, passPct: 50 }, progress: { attempts: 0, best: null, last: null, passed: false } },
    api, render: () => { renders++; }, applyProgress: () => {}, nextHref: 'lesson.html?s=sci&l=1&n=sci-p1', courseHref: 'course.html?s=sci', reviewHref: 'lesson.html?s=sci&l=1',
});

const settle = () => new Promise((r) => setTimeout(r, 0));
const click = (quiz, { act, choice } = {}) => quiz.handleClick({
    target: { closest: (sel) => (sel === '[data-act]' && act ? { dataset: { act } } : sel === '[data-choice]' && choice ? { dataset: { choice } } : null) },
});
const tapFx = (quiz, fx, id, i) => quiz.handleClick({ target: { closest: (sel) => (sel === '[data-fx]' ? { dataset: { fx, id, i } } : null) } });
const typeNum = (quiz, value) => quiz.handleInput({ target: { closest: (sel) => (sel === '[data-fx="n-input"]' ? { value } : null) } });
const press = (quiz, key) => quiz.handleKey({ key, preventDefault() {}, target: { closest: (sel) => (sel === '[data-fx="n-input"]' ? {} : null) } });
/** จับคู่ตามลำดับ [ซ้าย, ขวา] */
const pairUp = (quiz, pairs) => pairs.forEach(([l, r]) => { tapFx(quiz, 'm-left', l); tapFx(quiz, 'm-right', r); });
const checkDisabled = (quiz) => /data-act="quiz-check" disabled/.test(quiz.html());
const startedQuiz = async (api = fakeApi()) => {
    const quiz = make(api);
    click(quiz, { act: 'quiz-start' });
    await settle();
    return quiz;
};
const answerNumeric = async (quiz) => { typeNum(quiz, '3.5'); click(quiz, { act: 'quiz-check' }); await settle(); click(quiz, { act: 'quiz-next' }); };

beforeEach(() => { calls = []; renders = 0; });

describe('รูปแบบโจทย์ใหม่ใน Quiz', () => {
    test('กรอกตัวเลข: ปุ่มตรวจเปิดเมื่อพิมพ์เป็นตัวเลข; ส่งข้อความที่พิมพ์ (ตัดช่องว่าง); Enter ก็ตรวจ; ตอบถูกได้ EXP', async () => {
        const quiz = await startedQuiz();
        assert.match(quiz.html(), /<input[^>]*data-fx="n-input"/);
        assert.match(quiz.html(), /mol\/L/);
        assert.ok(checkDisabled(quiz), 'ยังไม่ได้พิมพ์');
        typeNum(quiz, 'abc');
        assert.ok(checkDisabled(quiz), 'พิมพ์ไม่เป็นตัวเลข');
        typeNum(quiz, ' 3,5 ');
        assert.ok(!checkDisabled(quiz));
        assert.equal(press(quiz, 'Enter'), true);
        await settle();
        assert.deepEqual(calls, [['qa_abcdefghij', 'qn', '3,5']]);
        const h = quiz.html();
        assert.match(h, /abar is-ok/);
        assert.match(h, /nm is-ok/);
        assert.match(h, /\+5 EXP/);
        assert.match(h, /<span class="xp-pill"[^>]*><svg[^>]*>[\s\S]*?<b>5<\/b>/);
        assert.equal(typeNum(quiz, '9'), true, 'ตรวจแล้ว พิมพ์ต่อไม่เปลี่ยนคำตอบ');
        assert.match(quiz.html(), /value=" ?3,5 ?"/);
        assert.equal(press(quiz, 'a'), false, 'ปุ่มอื่นไม่ถูกจัดการ');
    });

    test('จับคู่: ต้องจับครบก่อนตรวจ; ถูกบางส่วน = แผงสีเหลือง "ได้บางส่วน" บอกถูกกี่คู่ + ได้ EXP ส่วนนั้น', async () => {
        const quiz = await startedQuiz();
        await answerNumeric(quiz);
        assert.match(quiz.html(), /data-fx="m-left" data-id="l1"/);
        assert.ok(checkDisabled(quiz));
        pairUp(quiz, [['l1', 'r1']]);
        assert.ok(checkDisabled(quiz), 'จับแค่คู่เดียวจาก 3');
        tapFx(quiz, 'm-right', 'r1'); // แตะข้างที่จับแล้ว = ยกเลิกคู่ (r1 รอจับใหม่)
        tapFx(quiz, 'm-left', 'l1'); // จับ l1 กับ r1 อีกครั้ง
        pairUp(quiz, [['l2', 'r2'], ['l3', 'r2']]); // r2 ย้ายจาก l2 ไปเป็นของ l3 (l2 หลุด)
        assert.ok(checkDisabled(quiz), 'l2 หลุดจากคู่');
        pairUp(quiz, [['l2', 'r3']]);
        assert.ok(!checkDisabled(quiz));
        click(quiz, { act: 'quiz-check' });
        await settle();
        assert.deepEqual(calls.at(-1), ['qa_abcdefghij', 'qm', { l1: 'r1', l3: 'r2', l2: 'r3' }]);
        const h = quiz.html();
        assert.match(h, /abar is-part/);
        assert.match(h, /abar-fb fb part/);
        assert.match(h, /ได้บางส่วน/);
        assert.match(h, /ถูก <b>1 จาก 3 คู่<\/b>/);
        assert.match(h, /\+3 EXP/);
        assert.match(h, /btn-lg btn-part/);
        assert.doesNotMatch(h, /ผ่านเกณฑ์แล้ว|ติดกัน/);
        assert.match(h, /<b>8<\/b>/, 'EXP สะสม 5 + 3');
    });

    test('จริง/เท็จ: ปัดขวา = จริง ปัดซ้าย = เท็จ (เฉพาะข้อจริง/เท็จที่ยังไม่ตรวจ); ตอบผิดได้เฉลย', async () => {
        const quiz = await startedQuiz();
        assert.equal(quiz.swipe('right'), false, 'ข้อกรอกตัวเลขไม่รับการปัด');
        await answerNumeric(quiz);
        pairUp(quiz, [['l1', 'r1'], ['l2', 'r3'], ['l3', 'r2']]);
        click(quiz, { act: 'quiz-check' });
        await settle();
        click(quiz, { act: 'quiz-next' });
        assert.match(quiz.html(), /tf-card tf-t/);
        assert.ok(checkDisabled(quiz));
        assert.equal(quiz.swipe('left'), true);
        assert.match(quiz.html(), /tf-f is-sel/);
        assert.equal(quiz.swipe('right'), true);
        assert.match(quiz.html(), /tf-t is-sel/);
        click(quiz, { act: 'quiz-check' });
        await settle();
        assert.deepEqual(calls.at(-1), ['qa_abcdefghij', 'qt', 't']);
        const h = quiz.html();
        assert.match(h, /abar is-bad/);
        assert.match(h, /เฉลย <b>เท็จ<\/b>/);
        assert.match(h, /tf-card tf-f is-ok/);
        assert.equal(quiz.swipe('left'), false, 'ตรวจแล้วปัดเปลี่ยนไม่ได้');
        assert.equal(tapFx(quiz, 'm-left', 'l1'), true, 'แตะหลังตรวจ: จัดการแล้วแต่ไม่เปลี่ยนอะไร');
    });

    test('จบชุด: ข้อที่ได้บางส่วนอยู่ในรายการทบทวน และหน้าทบทวนเป็นทีละบรรทัด ✓/✗', async () => {
        const review = [
            { questionId: 'qn', n: 1, ...NUM, ...FEEDBACK.qn },
            { questionId: 'qm', n: 2, ...MATCH, ...FEEDBACK.qm },
        ];
        const api = fakeApi({
            startQuiz: async () => ({ attempt: { id: 'qa_abcdefghij', questions: [MATCH] } }),
            answerQuiz: async () => ({ alreadyAnswered: false, feedback: { questionId: 'qm', ...FEEDBACK.qm } }),
            submitQuiz: async () => ({ result: { attemptId: 'qa_abcdefghij', correct: 1, total: 2, answered: 2, percent: 50, passed: true, review }, node: { id: 'sci-z1', status: 'done', progress: { attempts: 1 } }, lesson: { status: 'now' }, reward: null }),
        });
        const quiz = await startedQuiz(api);
        pairUp(quiz, [['l1', 'r1'], ['l2', 'r3'], ['l3', 'r2']]);
        click(quiz, { act: 'quiz-check' });
        await settle();
        click(quiz, { act: 'quiz-next' });
        await settle();
        click(quiz, { act: 'rs-next' }); // คะแนน → ทบทวน (เฉพาะข้อที่ไม่ถูกหมด)
        const h = quiz.html();
        assert.match(h, /rs-review/);
        assert.match(h, /ข้อ 2 จับคู่/);
        assert.match(h, /rv-row ok[\s\S]*?HCl/);
        assert.match(h, /rv-row bad[\s\S]*?NaOH[\s\S]*?<s>เกลือ<\/s>[\s\S]*?เบส/);
        assert.match(h, /rv-row bad[\s\S]*?NaCl[\s\S]*?<s>เบส<\/s>[\s\S]*?เกลือ/);
        assert.match(h, /กรดคู่กับ HCl/);
        assert.doesNotMatch(h, /ความเข้มข้นเท่าไร/, 'ข้อที่ถูกหมดไม่อยู่ในหน้าทบทวน');
    });
});
