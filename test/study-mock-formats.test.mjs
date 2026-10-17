// ทดสอบ Mock Exam ที่มีโจทย์รูปแบบใหม่ (js/study-live-mock.js + js/study-qformats.js) ด้วย API จำลองและ DOM จำลอง:
// คำตอบหลายรูปร่างถูกบันทึกอัตโนมัติ/ล้าง/กลับมาทำต่อได้ และสรุปผลมีหน้าทบทวนของรูปแบบใหม่
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, wait } from './fakeDom.mjs';

const dom = installFakeDom();
const { initMockExam } = await import('../js/study-live-mock.js');

const SUBJECT = { id: 'sci', title: 'วิทยาศาสตร์', eyebrow: 'วิชาที่ 1 • วิทยาศาสตร์', hue: 'emerald', emoji: '🔬' };
const QUESTIONS = [
    { id: 'qn', n: 1, topic: 'เคมี', text: 'ความเข้มข้น', special: false, media: [], format: 'numeric', choices: [], spec: { unit: 'mol/L' } },
    { id: 'qm', n: 2, topic: 'เคมี', text: 'จับคู่', special: false, media: [], format: 'match', choices: [], spec: { left: [{ id: 'l1', text: 'HCl' }, { id: 'l2', text: 'NaOH' }], right: [{ id: 'r1', text: 'กรด' }, { id: 'r2', text: 'เบส' }, { id: 'r3', text: 'เกลือ' }] } },
    { id: 'qu', n: 3, topic: 'เคมี', text: 'ข้อใดเป็นกรด', special: false, media: [], format: 'multi', choices: [{ id: 'a', text: 'HCl' }, { id: 'b', text: 'NaOH' }, { id: 'c', text: 'H2SO4' }], spec: null },
    { id: 'qt', n: 4, topic: 'เคมี', text: 'น้ำเดือดที่ 100 องศา', special: false, media: [], format: 'truefalse', choices: [{ id: 't', text: 'จริง' }, { id: 'f', text: 'เท็จ' }], spec: null },
    { id: 'qf', n: 5, topic: 'เคมี', text: 'น้ำเดือดที่ [[1]] องศา', special: false, media: [], format: 'fill', choices: [], spec: { bank: [{ id: 'w1', text: '100' }, { id: 'w2', text: '0' }], blanks: 1 } },
];
const RESULT = {
    attemptId: 'ma_abcdefghij', status: 'submitted', autoSubmitted: false, correct: 1, total: 5, answered: 3, percent: 20, passed: null,
    secondsUsed: 125, durationSec: 1200, submittedAt: 1, starsEarned: 2, starsBase: 2, starsTimeBonus: 0, deltaVsPrevious: null, reward: null,
    topics: [{ topic: 'เคมี', correct: 1, total: 5 }],
    review: [
        { n: 1, questionId: 'qn', text: 'ความเข้มข้น', topic: 'เคมี', media: [], format: 'numeric', choices: [], spec: { unit: 'mol/L' }, isCorrect: false, score: 0, yourAnswer: 9, correct: { value: 3.5, tolerance: 0.05, unit: 'mol/L' }, explanation: 'n/V', flagged: false, special: false },
        { n: 2, questionId: 'qm', text: 'จับคู่', topic: 'เคมี', media: [], format: 'match', choices: [], spec: QUESTIONS[1].spec, isCorrect: false, score: 0.5, yourAnswer: { l1: 'r1', l2: 'r3' }, correct: { l1: 'r1', l2: 'r2' }, explanation: 'NaOH เป็นเบส', flagged: false, special: false },
        { n: 3, questionId: 'qu', text: 'ข้อใดเป็นกรด', topic: 'เคมี', media: [], format: 'multi', choices: QUESTIONS[2].choices, spec: null, isCorrect: true, score: 1, yourAnswer: ['a', 'c'], correct: ['a', 'c'], explanation: '', flagged: false, special: false },
    ],
};

const baseInfo = () => ({
    serverNow: Date.now(), subject: SUBJECT,
    mock: { available: true, title: 'Mock', questionCount: 5, durationMin: 20, passMarkPct: null, format: 'mcq', stars: { timeBonusPct: 25, max: 10 }, exp: 30, advanced: { unlocked: false } },
    active: null, history: [], best: null, deltaVsPrevious: null,
});

function fakeApi(over = {}) {
    const calls = [];
    return {
        calls,
        listSubjects: async () => ({ subjects: [] }),
        getMockInfo: async () => baseInfo(),
        startMock: async () => ({ resumed: false, serverNow: Date.now(), attempt: { id: 'ma_abcdefghij', status: 'in_progress', startedAt: Date.now(), deadlineAt: Date.now() + 1200000, durationSec: 1200, total: 5, questions: QUESTIONS, answers: {}, flags: [] } }),
        saveMockAnswers: async (id, state) => { calls.push(['save', id, JSON.parse(JSON.stringify(state))]); return { saved: Object.keys(state.answers || {}).length }; },
        submitMock: async (id, state) => { calls.push(['submit', id, JSON.parse(JSON.stringify(state))]); return { result: RESULT }; },
        ...over,
    };
}

let current = null;
async function started(api) {
    globalThis.location.search = '?s=sci';
    const { params } = await import('../js/study-ui.js');
    for (const k of [...params.keys()]) params.delete(k);
    params.set('s', 'sci');
    current = await initMockExam({ api, saveDebounceMs: 20, tickMs: 20 });
    await wait(0);
    dom.click({ act: 'start' });
    await wait(10);
}
const html = () => dom.content.innerHTML;
const tapFx = (fx, id, i) => dom.click({ fx, id, i });
const lastSave = (api) => api.calls.filter((c) => c[0] === 'save').at(-1)[2];

beforeEach(() => dom.reset());
afterEach(() => { current?.dispose(); current = null; });

describe('Mock Exam: โจทย์หลายรูปแบบ', () => {
    test('กรอกตัวเลข: พิมพ์แล้วบันทึกอัตโนมัติ; ยังไม่เป็นตัวเลข/ล้างช่อง = ส่ง null (ล้างคำตอบที่บันทึกไว้); ไม่ทำให้การบันทึกล้ม', async () => {
        const api = fakeApi();
        await started(api);
        assert.match(html(), /data-fx="n-input"/);
        dom.type('3,5');
        await wait(50);
        assert.deepEqual(lastSave(api), { answers: { qn: '3,5' }, flags: [] });
        dom.type('3,');
        await wait(50);
        assert.deepEqual(lastSave(api).answers, { qn: null }, 'พิมพ์ค้างไว้ยังไม่เป็นตัวเลข: ไม่ส่งข้อความนั้นไปให้ Backend ปฏิเสธ');
        dom.type('');
        await wait(50);
        assert.deepEqual(lastSave(api).answers, { qn: null });
        assert.doesNotMatch(html(), /บันทึกอัตโนมัติไม่สำเร็จ/);
    });

    test('จับคู่ / เลือกหลายข้อ / จริง-เท็จ / เติมคำ: แตะแล้วบันทึกคำตอบรูปร่างเดียวกับที่ Backend รับ; แตะล้างหมดแล้วส่ง null', async () => {
        const api = fakeApi();
        await started(api);
        dom.click({ act: 'next' });
        tapFx('m-left', 'l1'); tapFx('m-right', 'r1');
        await wait(50);
        assert.deepEqual(lastSave(api).answers.qm, { l1: 'r1' }, 'จับคู่เพียงบางส่วนก็บันทึก (Mock ไม่บังคับให้ครบ)');
        dom.click({ act: 'next' });
        tapFx('x-tog', 'c'); tapFx('x-tog', 'a');
        dom.click({ act: 'next' });
        dom.click({ choice: 't' });
        dom.click({ act: 'next' });
        tapFx('f-word', 'w1');
        await wait(50);
        assert.deepEqual(lastSave(api).answers, { qm: { l1: 'r1' }, qu: ['a', 'c'], qt: 't', qf: ['w1'] });
        // ล้าง: แตะเอาคำออก → ช่องว่างหมด → ส่ง null
        tapFx('f-blank', null, '0');
        await wait(50);
        assert.equal(lastSave(api).answers.qf, null);
        assert.match(html(), /ติดธงข้อนี้/);
    });

    test('ข้อความจริง/เท็จใน Mock ไม่บอกว่าปัดได้; ข้อทั้งหมดนับข้อที่ตอบบางส่วนว่าตอบแล้ว', async () => {
        const api = fakeApi();
        await started(api);
        dom.click({ act: 'next' });
        tapFx('m-left', 'l2'); tapFx('m-right', 'r2');
        dom.click({ act: 'next' });
        dom.click({ act: 'next' });
        assert.match(html(), /แตะการ์ดที่เลือก/);
        assert.doesNotMatch(html(), /ปัดการ์ด/);
        dom.click({ act: 'open-nav' });
        assert.match(dom.bodyChildren.at(-1).innerHTML, /ตอบแล้ว <b>1<\/b> จาก 5 ข้อ/);
        assert.match(dom.bodyChildren.at(-1).innerHTML, /aria-label="ข้อ 2 ตอบแล้ว"/);
    });

    test('ทำต่อ: คำตอบหลายรูปร่างที่บันทึกไว้กลับมาครบ (ตัวเลขเป็นข้อความ, ช่องว่างตามจำนวนช่อง) และไปข้อแรกที่ยังไม่ตอบ', async () => {
        const api = fakeApi({ startMock: async () => ({ resumed: true, serverNow: Date.now(), attempt: { id: 'ma_abcdefghij', status: 'in_progress', startedAt: Date.now() - 60000, deadlineAt: Date.now() + 1140000, durationSec: 1200, total: 5, questions: QUESTIONS, answers: { qn: 3.5, qm: { l1: 'r1' }, qu: ['a', 'c'], qt: 't' }, flags: [] } }) });
        await started(api);
        assert.match(html(), /ข้อ 5\/5/, 'ข้อแรกที่ยังไม่ตอบคือข้อเติมคำ');
        dom.click({ act: 'prev' });
        assert.match(html(), /tf-t is-sel/, 'จริง/เท็จที่เลือกไว้กลับมา');
        dom.click({ act: 'prev' });
        assert.match(html(), /is-sel[^>]*data-id="a"/);
        assert.match(html(), /is-sel[^>]*data-id="c"/);
        dom.click({ act: 'prev' });
        assert.match(html(), /mt-i paired[^>]*data-fx="m-left" data-id="l1"/);
        dom.click({ act: 'prev' });
        assert.match(html(), /value="3\.5"/);
        dom.click({ act: 'open-nav' });
        assert.match(dom.bodyChildren.at(-1).innerHTML, /ตอบแล้ว <b>4<\/b> จาก 5 ข้อ/);
    });

    test('ส่งข้อสอบ: ส่งทุกคำตอบ (ตัวเลขที่ยังไม่เป็นตัวเลขไม่ถูกส่ง) แล้วหน้าทบทวนแสดงทีละบรรทัดของแต่ละรูปแบบ', async () => {
        const api = fakeApi();
        await started(api);
        dom.type('abc');
        dom.click({ act: 'next' });
        tapFx('m-left', 'l1'); tapFx('m-right', 'r1'); tapFx('m-left', 'l2'); tapFx('m-right', 'r3');
        dom.click({ act: 'ask-submit' });
        // ไปส่งผ่านชั้นยืนยัน (อยู่นอก #content)
        dom.clickOverlay({ act: 'ask-submit' });
        dom.clickOverlay({ act: 'submit' });
        await wait(20);
        const submit = api.calls.find((c) => c[0] === 'submit');
        assert.deepEqual(submit[2].answers, { qn: null, qm: { l1: 'r1', l2: 'r3' } });
        dom.click({ act: 'rs-next' }); // คะแนน → ทบทวน
        let h = html();
        assert.match(h, /rs-review/);
        assert.match(h, /ข้อ 1 ความเข้มข้น/);
        assert.match(h, /<s>9<\/s>[\s\S]*?3\.5 ± 0\.05 mol\/L/);
        dom.click({ act: 'rs-next' }); // ข้อที่ผิดข้อถัดไป
        h = html();
        assert.match(h, /ข้อ 2 จับคู่/);
        assert.match(h, /rv-row bad[\s\S]*?NaOH[\s\S]*?<s>เกลือ<\/s>[\s\S]*?เบส/);
        assert.doesNotMatch(h, /ข้อใดเป็นกรด/, 'ข้อที่ถูกหมดไม่ถูกนำมาทบทวน');
    });
});
