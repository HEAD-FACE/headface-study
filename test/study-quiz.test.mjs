// ทดสอบตัวควบคุม Quiz ของหน้าบทเรียน (js/study-live-quiz.js) ด้วย API จำลอง: ลำดับ intro → ถามทีละข้อ → ผลคะแนน,
// ข้อผิดพลาดจาก Backend, การกดซ้ำ และการไม่ให้เฉลยหลุดก่อนตอบ
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null };
globalThis.CSS = { escape: (s) => s };

const { createQuiz } = await import('../js/study-live-quiz.js');
const { StudyApiError } = await import('../js/study-api.js');

const QUESTIONS = [
    { id: 'q1', n: 1, topic: 'หัวข้อ A', text: 'โจทย์ <b>หนึ่ง</b>', choices: [{ id: 'a', text: 'ก1' }, { id: 'b', text: 'ข1' }, { id: 'c', text: 'ค1' }] },
    { id: 'q2', n: 2, topic: 'หัวข้อ B', text: 'โจทย์สอง', choices: [{ id: 'a', text: 'ก2' }, { id: 'b', text: 'ข2' }] },
];
const KEY = { q1: 'b', q2: 'a' };

function fakeApi(overrides = {}) {
    const calls = [];
    const api = {
        calls,
        startQuiz: async (s, no) => { calls.push(['start', s, no]); return { attempt: { id: 'qa_abcdefghij', questions: QUESTIONS } }; },
        answerQuiz: async (attempt, q, choice) => {
            calls.push(['answer', attempt, q, choice]);
            return { alreadyAnswered: false, feedback: { questionId: q, isCorrect: choice === KEY[q], yourChoiceId: choice, correctChoiceId: KEY[q], explanation: `เพราะ ${KEY[q]}`, topic: 't' } };
        },
        submitQuiz: async (attempt) => {
            calls.push(['submit', attempt]);
            return {
                result: {
                    attemptId: attempt, correct: 1, total: 2, answered: 2, percent: 50, passed: true,
                    review: [
                        { questionId: 'q1', n: 1, text: 'โจทย์ <b>หนึ่ง</b>', choices: QUESTIONS[0].choices, yourChoiceId: 'a', correctChoiceId: 'b', isCorrect: false, explanation: 'เพราะ b' },
                        { questionId: 'q2', n: 2, text: 'โจทย์สอง', choices: QUESTIONS[1].choices, yourChoiceId: 'a', correctChoiceId: 'a', isCorrect: true, explanation: 'เพราะ a' },
                    ],
                },
                lesson: { status: 'now', quiz: { attempts: 1, best: { correct: 1, total: 2 }, last: { correct: 1, total: 2, at: 1 }, passed: true } },
            };
        },
        ...overrides,
    };
    return api;
}

let lesson;
let patches;
let renders;
const make = (api, extra = {}) => createQuiz({
    subject: { id: 'sci' }, lesson, api, render: () => { renders++; }, applyProgress: (p) => patches.push(p),
    nextHref: 'lesson.html?s=sci&l=2', courseHref: 'course.html?s=sci', ...extra,
});

// คลิกจำลอง: act = ชื่อ data-act, choice = id ตัวเลือก
const click = (quiz, { act, choice } = {}) => quiz.handleClick({
    target: { closest: (sel) => (sel === '[data-act]' && act ? { dataset: { act } } : sel === '[data-choice]' && choice ? { dataset: { choice } } : null) },
});
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    lesson = { no: 1, quiz: { available: true, questionCount: 2, passPct: 50 }, progress: { status: 'now', contentReadAt: null, quiz: { attempts: 0, best: null, last: null, passed: false } } };
    patches = [];
    renders = 0;
});

describe('intro', () => {
    test('บอกจำนวนข้อและเกณฑ์ผ่าน และยังไม่มีโจทย์', () => {
        const html = make(fakeApi()).html();
        assert.match(html, /2 ข้อ/);
        assert.match(html, /อย่างน้อย 50% ในการทำ 1 ครั้ง/);
        assert.match(html, /อ่านเนื้อหาจบ<\/b> และผ่าน Quiz/);
        assert.match(html, /data-act="quiz-start"/);
        assert.doesNotMatch(html, /qtext|data-choice/);
    });
    test('ไม่มีเกณฑ์คะแนน และบทที่ไม่มีโจทย์', () => {
        lesson.quiz.passPct = null;
        assert.match(make(fakeApi()).html(), /ทำครบแล้วส่ง 1 ครั้งถือว่าผ่าน/);
        lesson.quiz = { available: false, questionCount: 0, passPct: 50 };
        const html = make(fakeApi()).html();
        assert.match(html, /ยังไม่มีโจทย์ Quiz/);
        assert.doesNotMatch(html, /quiz-start/);
    });
    test('แสดงผลดีที่สุดและล่าสุดเมื่อเคยทำ และเปลี่ยนป้ายปุ่มเป็น "ทำอีกครั้ง"', () => {
        lesson.progress.quiz = { attempts: 2, best: { correct: 4, total: 5 }, last: { correct: 2, total: 5, at: 1 }, passed: true };
        const html = make(fakeApi()).html();
        assert.match(html, /ดีที่สุด 4\/5/);
        assert.match(html, /ล่าสุด 2\/5/);
        assert.match(html, /ทำ Quiz อีกครั้ง/);
    });
});

describe('ทำทีละข้อ', () => {
    test('เริ่ม → ได้โจทย์โดยไม่มีเฉลย, ข้อความถูก escape, ปุ่มตรวจปิดอยู่จนกว่าจะเลือก', async () => {
        const api = fakeApi();
        const quiz = make(api);
        assert.equal(click(quiz, { act: 'quiz-start' }), true);
        await settle();
        assert.deepEqual(api.calls[0], ['start', 'sci', 1]);
        const html = quiz.html();
        assert.match(html, /ข้อ 1\/2/);
        assert.match(html, /โจทย์ &lt;b&gt;หนึ่ง&lt;\/b&gt;/);
        assert.doesNotMatch(html, /<b>หนึ่ง/);
        assert.match(html, /data-choice="a"/);
        assert.match(html, /<span class="choice-l">ก<\/span>/);
        assert.doesNotMatch(html, /is-ok|is-bad|เพราะ|correct/);
        assert.match(html, /data-act="quiz-check" disabled/);
        assert.equal(quiz.hasAbar(), true);
    });

    test('เลือก → ตรวจ → ได้เฉลยของข้อนั้น ตัวเลือกถูกล็อก และเปลี่ยนคำตอบไม่ได้', async () => {
        const api = fakeApi();
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' }); await settle();
        click(quiz, { choice: 'a' });
        assert.match(quiz.html(), /is-sel/);
        assert.doesNotMatch(quiz.html(), /quiz-check" disabled/);
        click(quiz, { act: 'quiz-check' }); await settle();
        assert.deepEqual(api.calls[1], ['answer', 'qa_abcdefghij', 'q1', 'a']);
        const html = quiz.html();
        assert.match(html, /class="fb bad"/);
        assert.match(html, /เพราะ b/);
        assert.match(html, /choice is-bad/);
        assert.match(html, /choice is-ok/);
        assert.match(html, /disabled/);
        click(quiz, { choice: 'c' }); await settle(); // หลังเห็นเฉลยแล้วเปลี่ยนไม่ได้
        click(quiz, { act: 'quiz-check' }); await settle();
        assert.equal(api.calls.filter((c) => c[0] === 'answer').length, 1);
    });

    test('จบชุด → ส่ง → ผลคะแนน พร้อมข้อที่ควรทบทวน และแจ้งสถานะบทกลับไปหน้าบทเรียน', async () => {
        const api = fakeApi();
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' }); await settle();
        click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle();
        click(quiz, { act: 'quiz-next' });
        assert.match(quiz.html(), /ข้อ 2\/2/);
        click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle();
        assert.match(quiz.html(), /ดูผลคะแนน/);
        click(quiz, { act: 'quiz-next' }); await settle();
        assert.deepEqual(api.calls.at(-1), ['submit', 'qa_abcdefghij']);
        assert.equal(patches.length, 1);
        assert.deepEqual(patches[0].quiz.best, { correct: 1, total: 2 });
        const html = quiz.html();
        assert.match(html, /50%/);
        assert.match(html, /ตอบถูก 1 จาก 2 ข้อ/);
        assert.match(html, /ผ่านเกณฑ์ของบทนี้/);
        assert.match(html, /ข้อที่ควรทบทวน/);
        assert.match(html, /เฉลย: ข ข1/);
        assert.equal((html.match(/review-i/g) || []).length, 1, 'แสดงเฉพาะข้อที่ผิด');
        assert.match(html, /href="lesson\.html\?s=sci&amp;l=2"/);
        assert.equal(quiz.hasAbar(), false);
    });

    test('ยังไม่ได้อ่านเนื้อหา → บอกว่าบทยังไม่เสร็จ; บทเสร็จแล้ว → แสดงว่าเสร็จสมบูรณ์', async () => {
        const run = async () => {
            const quiz = make(fakeApi());
            click(quiz, { act: 'quiz-start' }); await settle();
            for (let i = 0; i < 2; i++) { click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle(); click(quiz, { act: 'quiz-next' }); await settle(); }
            return quiz.html();
        };
        assert.match(await run(), /ยังเหลืออีกขั้น: อ่านเนื้อหา/);
        lesson.progress = { status: 'done', contentReadAt: 5, quiz: lesson.progress.quiz };
        assert.match(await run(), /บทนี้เสร็จสมบูรณ์แล้ว/);
    });

    test('ทำอีกครั้งจากหน้าผล เริ่มชุดใหม่ที่ข้อ 1', async () => {
        const api = fakeApi();
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' }); await settle();
        for (let i = 0; i < 2; i++) { click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle(); click(quiz, { act: 'quiz-next' }); await settle(); }
        click(quiz, { act: 'quiz-start' }); await settle();
        assert.equal(api.calls.filter((c) => c[0] === 'start').length, 2);
        assert.match(quiz.html(), /ข้อ 1\/2/);
        assert.doesNotMatch(quiz.html(), /class="fb/);
    });
});

describe('ข้อผิดพลาดและการกดซ้ำ', () => {
    test('เริ่มไม่ได้ (ไม่มีสิทธิ์) → แสดงข้อความจาก Backend และกดใหม่ได้', async () => {
        const quiz = make(fakeApi({ startQuiz: async () => { throw new StudyApiError('FEATURE_FORBIDDEN', 403, 'แพลนของคุณยังไม่มีสิทธิ์ใช้ส่วนนี้'); } }));
        click(quiz, { act: 'quiz-start' }); await settle();
        const html = quiz.html();
        assert.match(html, /role="alert">แพลนของคุณยังไม่มีสิทธิ์ใช้ส่วนนี้/);
        assert.doesNotMatch(html, /quiz-start"[^>]* disabled/);
        assert.equal(quiz.hasAbar(), false);
    });

    test('เครือข่ายล่มระหว่างตรวจคำตอบ → ยังอยู่ที่ข้อเดิม เลือกไว้เหมือนเดิม และลองใหม่ได้', async () => {
        let fail = true;
        const api = fakeApi({ answerQuiz: async (...a) => { if (fail) throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); return fakeApi().answerQuiz(...a); } });
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' }); await settle();
        click(quiz, { choice: 'b' }); click(quiz, { act: 'quiz-check' }); await settle();
        let html = quiz.html();
        assert.match(html, /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        assert.match(html, /ข้อ 1\/2/);
        assert.match(html, /is-sel/);
        fail = false;
        click(quiz, { act: 'quiz-check' }); await settle();
        html = quiz.html();
        assert.doesNotMatch(html, /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        assert.match(html, /class="fb ok"/);
    });

    test('ชุดที่ถูกปิดไปแล้ว (เริ่มใหม่ที่อื่น) → กลับไปหน้าแรกของ Quiz พร้อมข้อความ', async () => {
        const quiz = make(fakeApi({ answerQuiz: async () => { throw new StudyApiError('ATTEMPT_CLOSED', 409, 'การทำครั้งนี้จบไปแล้ว'); } }));
        click(quiz, { act: 'quiz-start' }); await settle();
        click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle();
        const html = quiz.html();
        assert.match(html, /Quiz ท้ายบท/);
        assert.match(html, /การทำครั้งนี้จบไปแล้ว กรุณาเริ่ม Quiz ใหม่/);
        assert.match(html, /data-act="quiz-start"/);
    });

    test('กดซ้ำระหว่างรอ Backend ไม่ส่งคำขอซ้ำ', async () => {
        let release;
        const gate = new Promise((r) => { release = r; });
        const api = fakeApi({ startQuiz: async () => { api.calls.push(['start']); await gate; return { attempt: { id: 'qa_abcdefghij', questions: QUESTIONS } }; } });
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' });
        click(quiz, { act: 'quiz-start' });
        click(quiz, { act: 'quiz-start' });
        await settle();
        assert.match(quiz.html(), /กำลังเตรียมโจทย์/);
        assert.equal(api.calls.length, 1);
        release();
        await settle();
        assert.match(quiz.html(), /ข้อ 1\/2/);
    });

    test('คลิกที่ไม่เกี่ยวกับ Quiz ไม่ถูกจัดการ', () => {
        const quiz = make(fakeApi());
        assert.equal(click(quiz, {}), false);
        assert.equal(click(quiz, { choice: 'a' }), false, 'ยังไม่เริ่มชุด');
    });
});
