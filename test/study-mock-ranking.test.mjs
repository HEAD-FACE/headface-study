// ทดสอบหน้าสรุปผล Mock ที่มีการเลื่อนอันดับ (js/study-live-mock.js + js/study-ranking.js):
// หน้า "เลื่อนอันดับ" อยู่หลังหน้าดาวและก่อนหน้า EXP, ไม่โผล่เมื่ออันดับไม่ขยับ, และเล่นแอนิเมชันครั้งเดียวต่อหน้า
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, wait } from './fakeDom.mjs';

const dom = installFakeDom();
const { initMockExam } = await import('../js/study-live-mock.js');

const SUBJECT = { id: 'sci', title: 'วิทยาศาสตร์', eyebrow: 'วิชาที่ 1', hue: 'emerald', emoji: '🔬' };
const QUESTIONS = [{ id: 'q1', n: 1, topic: 'A', text: 'ข้อหนึ่ง', special: false, media: [], format: 'choice', choices: [{ id: 'a', text: 'ก' }, { id: 'b', text: 'ข' }], spec: null }];
const RANKING = {
    before: { stars: 3, rank: 5 }, after: { stars: 14, rank: 2 }, me: { avatar: 'https://api.test/api/avatar/preset/p01.svg?v=1' }, moved: 3, entered: false, total: 40,
    passed: [{ name: 'เอ ก.', avatar: 'https://api.test/api/avatar/preset/p02.svg?v=1', stars: 9 }],
};
const result = (ranking) => ({
    attemptId: 'ma_abcdefghij', status: 'submitted', autoSubmitted: false, correct: 1, total: 1, answered: 1, percent: 100, passed: null,
    secondsUsed: 60, durationSec: 600, submittedAt: 1, starsEarned: 11, starsBase: 10, starsTimeBonus: 1, deltaVsPrevious: null,
    reward: { exp: 30, baseExp: 30, firstTime: true, halved: false, stars: 11, totals: { exp: 30, stars: 14, level: { level: 1, from: 0, to: 50, pct: 60, toNext: 20 } } },
    ranking, topics: [{ topic: 'A', correct: 1, total: 1 }],
    review: [{ n: 1, questionId: 'q1', text: 'ข้อหนึ่ง', topic: 'A', media: [], format: 'choice', choices: QUESTIONS[0].choices, spec: null, yourChoiceId: 'a', correctChoiceId: 'a', isCorrect: true, score: 1, explanation: '', flagged: false, special: false }],
});
const apiFor = (ranking) => ({
    listSubjects: async () => ({ subjects: [] }),
    getMockInfo: async () => ({ serverNow: Date.now(), subject: SUBJECT, mock: { available: true, title: 'Mock', questionCount: 1, durationMin: 10, passMarkPct: null, format: 'mcq', stars: { timeBonusPct: 25, max: 10 }, exp: 30, advanced: { unlocked: false } }, active: null, history: [], best: null, deltaVsPrevious: null }),
    startMock: async () => ({ resumed: false, serverNow: Date.now(), attempt: { id: 'ma_abcdefghij', status: 'in_progress', startedAt: Date.now(), deadlineAt: Date.now() + 600000, durationSec: 600, total: 1, questions: QUESTIONS, answers: {}, flags: [] } }),
    saveMockAnswers: async () => ({ saved: 1 }),
    submitMock: async () => ({ result: result(ranking) }),
});

let current = null;
async function finishMock(ranking) {
    globalThis.location.search = '?s=sci';
    const { params } = await import('../js/study-ui.js');
    for (const k of [...params.keys()]) params.delete(k);
    params.set('s', 'sci');
    current = await initMockExam({ api: apiFor(ranking), saveDebounceMs: 20, tickMs: 20 });
    await wait(0);
    dom.click({ act: 'start' });
    await wait(10);
    dom.click({ choice: 'a' });
    dom.click({ act: 'ask-submit' });
    dom.clickOverlay({ act: 'ask-submit' });
    dom.clickOverlay({ act: 'submit' });
    await wait(20);
}
const html = () => dom.content.innerHTML;
const pages = () => {
    const seen = [];
    for (let i = 0; i < 10; i++) {
        seen.push(html());
        if (!/data-act="rs-next"/.test(html())) break;
        dom.click({ act: 'rs-next' });
    }
    return seen;
};

beforeEach(() => dom.reset());
afterEach(() => { current?.dispose(); current = null; });

describe('หน้าเลื่อนอันดับในสรุปผล Mock', () => {
    test('คะแนน → ดาว → เลื่อนอันดับ → EXP: หน้าเลื่อนอันดับอยู่หลังดาวและก่อน EXP', async () => {
        await finishMock(RANKING);
        const all = pages();
        const order = all.map((h) => (/rs-score/.test(h) ? 'score' : /rs-stars/.test(h) ? 'stars' : /rs-rank/.test(h) ? 'rank' : /rs-exp/.test(h) ? 'exp' : 'other'));
        assert.deepEqual(order, ['score', 'stars', 'rank', 'exp']);
        const rank = all[2];
        assert.match(rank, /เลื่อนอันดับ!/);
        assert.match(rank, /ขึ้น 3 อันดับ/);
        assert.match(rank, /data-roll="5,2"/);
        assert.match(rank, /rk-row is-other[\s\S]*?เอ ก\./);
        assert.match(rank, /rk-row is-me/);
        assert.equal((rank.match(/data-act="rs-next"/g) || []).length, 1, 'ปุ่มเดียวต่อหน้า');
    });
    test('ติดอันดับครั้งแรก = มีหน้า "ติดอันดับแล้ว!"', async () => {
        await finishMock({ ...RANKING, before: { stars: 0, rank: null }, entered: true, moved: null, after: { stars: 11, rank: 6 }, passed: [] });
        const all = pages();
        assert.ok(all.some((h) => /ติดอันดับแล้ว!/.test(h)));
    });
    test('อันดับไม่ขยับ / ไม่มีข้อมูลอันดับ (ไม่ได้ดาว, ยังไม่เปิดระบบ) = ไม่มีหน้าเลื่อนอันดับ', async () => {
        await finishMock({ ...RANKING, moved: 0, passed: [] });
        assert.ok(!pages().some((h) => /rs-rank/.test(h)));
        current.dispose();
        dom.reset();
        await finishMock(null);
        assert.ok(!pages().some((h) => /rs-rank/.test(h)));
    });
});
