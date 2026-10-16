// ทดสอบตัวควบคุม Quiz หนึ่งชุด (js/study-live-quiz.js) ด้วย API จำลอง: ลำดับ intro → ถามทีละข้อ → ผลคะแนน,
// ข้อผิดพลาดจาก Backend, การกดซ้ำ, ภาพ/วิดีโอในโจทย์ และการไม่ให้เฉลยหลุดก่อนตอบ
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null };
globalThis.CSS = { escape: (s) => s };

const { createQuiz } = await import('../js/study-live-quiz.js');
const { StudyApiError } = await import('../js/study-api.js');

const QUESTIONS = [
    { id: 'q1', n: 1, topic: 'หัวข้อ A', text: 'โจทย์ <b>หนึ่ง</b>', media: [], choices: [{ id: 'a', text: 'ก1' }, { id: 'b', text: 'ข1' }, { id: 'c', text: 'ค1' }] },
    { id: 'q2', n: 2, topic: 'หัวข้อ B', text: 'โจทย์สอง', media: [], choices: [{ id: 'a', text: 'ก2' }, { id: 'b', text: 'ข2' }] },
];
const KEY = { q1: 'b', q2: 'a' };

function fakeApi(overrides = {}) {
    const calls = [];
    const api = {
        calls,
        startQuiz: async (s, no, nodeId) => { calls.push(['start', s, no, nodeId]); return { attempt: { id: 'qa_abcdefghij', questions: QUESTIONS } }; },
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
                        { questionId: 'q1', n: 1, text: 'โจทย์ <b>หนึ่ง</b>', media: [], choices: QUESTIONS[0].choices, yourChoiceId: 'a', correctChoiceId: 'b', isCorrect: false, explanation: 'เพราะ b' },
                        { questionId: 'q2', n: 2, text: 'โจทย์สอง', media: [], choices: QUESTIONS[1].choices, yourChoiceId: 'a', correctChoiceId: 'a', isCorrect: true, explanation: 'เพราะ a' },
                    ],
                },
                node: { id: 'sci-z1', status: 'done', progress: { attempts: 1, best: { correct: 1, total: 2 }, last: { correct: 1, total: 2, at: 1 }, passed: true, passPct: 50 } },
                lesson: { status: 'now', quiz: { attempts: 1, best: { correct: 1, total: 2 }, last: null, passed: true } },
                current: { lessonNo: 1, nodeId: 'sci-z2', type: 'quiz' },
            };
        },
        ...overrides,
    };
    return api;
}

let node;
let patches;
let renders;
const make = (api, extra = {}) => createQuiz({
    subject: { id: 'sci' }, lessonNo: 1, node, api, render: () => { renders++; }, applyProgress: (p) => patches.push(p),
    nextHref: 'lesson.html?s=sci&l=1&n=sci-p1', courseHref: 'course.html?s=sci', reviewHref: 'lesson.html?s=sci&l=1', ...extra,
});

// คลิกจำลอง: act = ชื่อ data-act, choice = id ตัวเลือก
const click = (quiz, { act, choice } = {}) => quiz.handleClick({
    target: { closest: (sel) => (sel === '[data-act]' && act ? { dataset: { act } } : sel === '[data-choice]' && choice ? { dataset: { choice } } : null) },
});
const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
    node = {
        id: 'sci-z1', type: 'quiz', title: 'Quiz ชุด 1',
        quiz: { available: true, questionCount: 2, passPct: 50 },
        progress: { attempts: 0, best: null, last: null, passed: false, passPct: 50 },
    };
    patches = [];
    renders = 0;
});

describe('intro', () => {
    test('บอกชื่อชุด จำนวนข้อและเกณฑ์ผ่าน และยังไม่มีโจทย์', () => {
        const html = make(fakeApi()).html();
        assert.match(html, /Quiz ชุด 1/);
        assert.match(html, /2 ข้อ/);
        assert.match(html, /ผ่าน ≥ 50%/);
        assert.doesNotMatch(html, /เรียนจบทุกเนื้อหา|<p class="note"/, 'ไม่มีประโยคอธิบายยาว ๆ (ข้อความน้อยที่สุด)');
        assert.match(html, /data-act="quiz-start"/);
        assert.doesNotMatch(html, /qtext|data-choice/);
    });
    test('ไม่มีเกณฑ์คะแนน และชุดที่ไม่มีโจทย์', () => {
        node.quiz.passPct = null;
        assert.match(make(fakeApi()).html(), /ทำครบ = ผ่าน/);
        node.quiz = { available: false, questionCount: 0, passPct: 50 };
        const html = make(fakeApi()).html();
        assert.match(html, /Quiz ชุดนี้ยังไม่มีโจทย์/);
        assert.doesNotMatch(html, /quiz-start/);
    });
    test('แสดงผลดีที่สุดและล่าสุดเมื่อเคยทำ และเปลี่ยนป้ายปุ่มเป็น "ทำอีกครั้ง"', () => {
        node.progress = { attempts: 2, best: { correct: 4, total: 5 }, last: { correct: 2, total: 5, at: 1 }, passed: true, passPct: 50 };
        const html = make(fakeApi()).html();
        assert.match(html, /ดีที่สุด 4\/5/);
                assert.match(html, /ผ่านแล้ว/);
        assert.match(html, /ทำ Quiz อีกครั้ง/);
    });
});

describe('ทำทีละข้อ', () => {
    test('เริ่ม → เรียกชุดนี้ (node) ได้โจทย์โดยไม่มีเฉลย, ข้อความถูก escape, ปุ่มตรวจปิดอยู่จนกว่าจะเลือก', async () => {
        const api = fakeApi();
        const quiz = make(api);
        assert.equal(click(quiz, { act: 'quiz-start' }), true);
        await settle();
        assert.deepEqual(api.calls[0], ['start', 'sci', 1, 'sci-z1']);
        const html = quiz.html();
        assert.match(html, /<span class="qcount">1\/2<\/span>/);
        assert.match(html, /data-key="q-q1" data-dir="1"/, 'ข้อใหม่มี key ของตัวเอง (หน้าแก้เฉพาะจุด)');
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
        assert.match(html, /href="lesson\.html\?s=sci&amp;l=1"[^>]*>ทบทวนเนื้อหา/);
        assert.match(html, /class="abar is-bad"/, 'แถบปุ่มล่างย้อมสีแดงเมื่อผิด');
        assert.match(html, /class="btn btn-lg btn-bad" data-act="quiz-next"/);
        assert.match(html, /choice is-dim/, 'ตัวเลือกที่ไม่เกี่ยวถูกหรี่');
        click(quiz, { choice: 'c' }); await settle(); // หลังเห็นเฉลยแล้วเปลี่ยนไม่ได้
        click(quiz, { act: 'quiz-check' }); await settle();
        assert.equal(api.calls.filter((c) => c[0] === 'answer').length, 1);
    });

    test('จบชุด → ส่ง → ผลคะแนน พร้อมข้อที่ควรทบทวน และแจ้งผลของ node กลับไปที่หน้ากิจกรรม', async () => {
        const api = fakeApi();
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' }); await settle();
        click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle();
        click(quiz, { act: 'quiz-next' });
        assert.match(quiz.html(), /<span class="qcount">2\/2<\/span>/);
        assert.match(quiz.html(), /data-key="q-q2"/);
        click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle();
        assert.match(quiz.html(), /ดูผลคะแนน/);
        click(quiz, { act: 'quiz-next' }); await settle();
        assert.deepEqual(api.calls.at(-1), ['submit', 'qa_abcdefghij']);
        assert.equal(patches.length, 1);
        assert.deepEqual(patches[0].node.progress.best, { correct: 1, total: 2 });
        const html = quiz.html();
        assert.match(html, /50%/);
        assert.match(html, /1\/2 ข้อ/);
        assert.match(html, /class="pill ok"[^>]*>[\s\S]*ผ่านเกณฑ์/);
        assert.match(html, /<details class="fold"><summary><span>ข้อที่ควรทบทวน \(1\)<\/span>/, 'ข้อที่ผิดพับเก็บไว้ ไม่แสดงต่อหน้า');
        assert.doesNotMatch(html, /ตอบถูก 1 จาก 2/);
        assert.match(html, /เฉลย: ข ข1/);
        assert.equal((html.match(/review-i/g) || []).length, 1, 'แสดงเฉพาะข้อที่ผิด');
        assert.match(html, /href="lesson\.html\?s=sci&amp;l=1&amp;n=sci-p1"[^>]*><span>ไปกิจกรรมถัดไป/);
        assert.match(html, /href="lesson\.html\?s=sci&amp;l=1"[^>]*>ทบทวนเนื้อหา/);
        assert.match(html, /href="course\.html\?s=sci"[^>]*>เส้นทางเรียน/);
        assert.match(html, /data-key="result"/);
        assert.equal(quiz.hasAbar(), false);
    });

    test('ตอบถูกติดกัน 3 ข้อขึ้นไปมีป้ายเปลวไฟ และตอบผิดแล้วนับใหม่', async () => {
        const qs = ['q1', 'q2', 'q3', 'q4'].map((id, i) => ({ id, n: i + 1, topic: 'ก', text: `โจทย์ ${i + 1}`, media: [], choices: [{ id: 'a', text: 'ก' }, { id: 'b', text: 'ข' }] }));
        const key = { q1: 'a', q2: 'a', q3: 'a', q4: 'a' };
        const api = fakeApi({
            startQuiz: async () => ({ attempt: { id: 'qa_abcdefghij', questions: qs } }),
            answerQuiz: async (attempt, q, choice) => ({ alreadyAnswered: false, feedback: { questionId: q, isCorrect: choice === key[q], yourChoiceId: choice, correctChoiceId: key[q], explanation: 'x', topic: 't' } }),
        });
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' }); await settle();
        const answer = async (choice) => { click(quiz, { choice }); click(quiz, { act: 'quiz-check' }); await settle(); const h = quiz.html(); click(quiz, { act: 'quiz-next' }); return h; };
        assert.doesNotMatch(await answer('a'), /class="streak"/);
        assert.doesNotMatch(await answer('a'), /class="streak"/);
        assert.match(await answer('a'), /class="streak">[\s\S]*ติดกัน 3 ข้อ/);
        assert.doesNotMatch(await answer('b'), /class="streak"/, 'ผิด = ไม่มีป้ายและนับใหม่');
    });

    test('บอกว่าบทยังมีกิจกรรมอื่น หรือบทเสร็จสมบูรณ์แล้ว ตามสถานะบทที่ Backend ส่งมา', async () => {
        const run = async (lessonStatus) => {
            const api = fakeApi();
            const original = api.submitQuiz;
            api.submitQuiz = async (a) => { const r = await original(a); r.lesson.status = lessonStatus; return r; };
            const quiz = make(api);
            click(quiz, { act: 'quiz-start' }); await settle();
            for (let i = 0; i < 2; i++) { click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle(); click(quiz, { act: 'quiz-next' }); await settle(); }
            return quiz.html();
        };
        assert.doesNotMatch(await run('now'), /บทนี้เสร็จสมบูรณ์/);
        assert.match(await run('done'), /<span class="pill gold">บทนี้เสร็จสมบูรณ์/);
    });

    test('ไม่มีกิจกรรมถัดไป → ปุ่มหลักพากลับเส้นทางเรียน', async () => {
        const quiz = make(fakeApi(), { nextHref: null });
        click(quiz, { act: 'quiz-start' }); await settle();
        for (let i = 0; i < 2; i++) { click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle(); click(quiz, { act: 'quiz-next' }); await settle(); }
        const html = quiz.html();
        assert.doesNotMatch(html, /ไปกิจกรรมถัดไป/);
        assert.match(html, /href="course\.html\?s=sci"[^>]*><span>กลับไปเส้นทางเรียน/);
    });

    test('ทำอีกครั้งจากหน้าผล เริ่มชุดใหม่ที่ข้อ 1', async () => {
        const api = fakeApi();
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' }); await settle();
        for (let i = 0; i < 2; i++) { click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle(); click(quiz, { act: 'quiz-next' }); await settle(); }
        click(quiz, { act: 'quiz-start' }); await settle();
        assert.equal(api.calls.filter((c) => c[0] === 'start').length, 2);
        assert.match(quiz.html(), /<span class="qcount">1\/2<\/span>/);
        assert.doesNotMatch(quiz.html(), /class="fb/);
    });
});

describe('ภาพและวิดีโอในโจทย์', () => {
    const withMedia = () => [
        {
            id: 'q1', n: 1, topic: 'ก', text: 'ดูภาพแล้วตอบ',
            media: [
                { kind: 'image', url: 'assets/study/sci/a.svg', alt: 'แผนภาพ "A"', caption: 'ภาพที่ 1' },
                { kind: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', caption: 'คลิป' },
                { kind: 'image', url: 'http://insecure.example.com/x.png', alt: 'x', caption: null },
                { kind: 'image', url: 'javascript:alert(1)', alt: 'x', caption: null },
            ],
            choices: [{ id: 'a', text: 'ก', image: { url: 'https://example.com/a.png', alt: 'ตัวเลือก <ก>' } }, { id: 'b', text: 'ข' }],
        },
    ];

    test('แสดงภาพ วิดีโอ (ฝังเฉพาะเว็บที่รู้จัก) และภาพของตัวเลือก; ที่อยู่ที่ไม่ปลอดภัยไม่ถูกแสดง', async () => {
        const quiz = make(fakeApi({ startQuiz: async () => ({ attempt: { id: 'qa_abcdefghij', questions: withMedia() } }) }));
        click(quiz, { act: 'quiz-start' }); await settle();
        const html = quiz.html();
        assert.match(html, /class="qmedia"/);
        assert.match(html, /<img src="assets\/study\/sci\/a\.svg" alt="แผนภาพ &quot;A&quot;"/);
        assert.match(html, /<iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0/);
        assert.match(html, /sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"/);
        assert.match(html, /<img class="choice-img" src="https:\/\/example\.com\/a\.png" alt="ตัวเลือก &lt;ก&gt;"/);
        assert.doesNotMatch(html, /insecure\.example|javascript:/);
        assert.equal((html.match(/class="choice-img"/g) || []).length, 1, 'ตัวเลือกที่ไม่มีภาพไม่มีรูป');
    });

    test('โจทย์ที่ไม่มีสื่อไม่มีกล่องสื่อ', async () => {
        const quiz = make(fakeApi());
        click(quiz, { act: 'quiz-start' }); await settle();
        assert.doesNotMatch(quiz.html(), /qmedia|choice-img/);
    });

    test('ข้อที่ตอบผิดในหน้าผลแสดงภาพของโจทย์ด้วย', async () => {
        const api = fakeApi();
        const original = api.submitQuiz;
        api.submitQuiz = async (a) => {
            const r = await original(a);
            r.result.review[0].media = [{ kind: 'image', url: 'assets/study/sci/review.svg', alt: 'ภาพทบทวน', caption: null }];
            return r;
        };
        const quiz = make(api);
        click(quiz, { act: 'quiz-start' }); await settle();
        for (let i = 0; i < 2; i++) { click(quiz, { choice: 'a' }); click(quiz, { act: 'quiz-check' }); await settle(); click(quiz, { act: 'quiz-next' }); await settle(); }
        assert.match(quiz.html(), /assets\/study\/sci\/review\.svg/);
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
        assert.match(html, /<span class="qcount">1\/2<\/span>/);
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
        assert.match(html, /Quiz ชุด 1/);
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
        assert.match(quiz.html(), /<span class="qcount">1\/2<\/span>/);
    });

    test('คลิกที่ไม่เกี่ยวกับ Quiz ไม่ถูกจัดการ', () => {
        const quiz = make(fakeApi());
        assert.equal(click(quiz, {}), false);
        assert.equal(click(quiz, { choice: 'a' }), false, 'ยังไม่เริ่มชุด');
    });
});
