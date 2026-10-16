// ทดสอบหน้า Mock Exam โหมดข้อมูลจริง (js/study-live-mock.js) ด้วย API จำลองและ DOM จำลอง:
// เลือกวิชา, เงื่อนไข+ประวัติ, เริ่ม/ทำต่อ, บันทึกอัตโนมัติ, หมดเวลา, ส่ง, สรุปผล, ข้อผิดพลาด
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, wait } from './fakeDom.mjs';

const dom = installFakeDom();
const { initMockExam } = await import('../js/study-live-mock.js');
const { StudyApiError } = await import('../js/study-api.js');

const SUBJECT = { id: 'sci', title: 'วิทยาศาสตร์', eyebrow: 'วิชาที่ 1 • วิทยาศาสตร์', hue: 'emerald', emoji: '🔬' };
const QUESTIONS = [
    { id: 'q1', n: 1, topic: 'หัวข้อ A', text: 'โจทย์ <i>หนึ่ง</i>', special: false, choices: [{ id: 'a', text: 'ก1' }, { id: 'b', text: 'ข1' }] },
    { id: 'q2', n: 2, topic: 'หัวข้อ B', text: 'โจทย์สอง', special: true, choices: [{ id: 'a', text: 'ก2' }, { id: 'b', text: 'ข2' }] },
    { id: 'q3', n: 3, topic: 'หัวข้อ A', text: 'โจทย์สาม', special: false, choices: [{ id: 'a', text: 'ก3' }, { id: 'b', text: 'ข3' }] },
];
const RESULT = {
    attemptId: 'ma_abcdefghij', status: 'submitted', autoSubmitted: false, correct: 2, total: 3, answered: 3, percent: 67, passed: null,
    secondsUsed: 125, durationSec: 1200, submittedAt: 1, starsEarned: 7, starsBase: 6, starsTimeBonus: 1, deltaVsPrevious: 10,
    topics: [{ topic: 'หัวข้อ A', correct: 2, total: 2 }, { topic: 'หัวข้อ B', correct: 0, total: 1 }],
    review: [
        { n: 1, questionId: 'q1', text: 'โจทย์ <i>หนึ่ง</i>', topic: 'หัวข้อ A', choices: QUESTIONS[0].choices, yourChoiceId: 'a', correctChoiceId: 'a', isCorrect: true, explanation: 'เพราะ ก', flagged: false, special: false },
        { n: 2, questionId: 'q2', text: 'โจทย์สอง', topic: 'หัวข้อ B', choices: QUESTIONS[1].choices, yourChoiceId: 'b', correctChoiceId: 'a', isCorrect: false, explanation: 'เพราะ ก', flagged: true, special: true },
        { n: 3, questionId: 'q3', text: 'โจทย์สาม', topic: 'หัวข้อ A', choices: QUESTIONS[2].choices, yourChoiceId: null, correctChoiceId: 'b', isCorrect: false, explanation: '', flagged: false, special: false },
    ],
};

const baseInfo = (extra = {}) => ({
    serverNow: Date.now(), subject: SUBJECT,
    mock: { available: true, title: 'Mock วิทยาศาสตร์', questionCount: 3, durationMin: 20, passMarkPct: null, format: 'mcq', stars: { timeBonusPct: 25 }, advanced: { unlocked: false } },
    active: null, history: [], best: null, deltaVsPrevious: null, ...extra,
});

function fakeApi(over = {}) {
    const calls = [];
    const api = {
        calls,
        listSubjects: async () => ({ subjects: [] }),
        getMockInfo: async () => baseInfo(),
        startMock: async () => { calls.push(['start']); return { resumed: false, serverNow: Date.now(), attempt: { id: 'ma_abcdefghij', status: 'in_progress', startedAt: Date.now(), deadlineAt: Date.now() + 1200000, durationSec: 1200, total: 3, questions: QUESTIONS, answers: {}, flags: [] } }; },
        saveMockAnswers: async (id, state) => { calls.push(['save', id, JSON.parse(JSON.stringify(state))]); return { saved: Object.keys(state.answers || {}).length }; },
        submitMock: async (id, state) => { calls.push(['submit', id, JSON.parse(JSON.stringify(state))]); return { result: RESULT }; },
        ...over,
    };
    return api;
}

const OPTS = { saveDebounceMs: 20, tickMs: 20 };
let current = null;
async function open(api, search = '?s=sci') {
    globalThis.location.search = search;
    // params ใน study-ui.js ถูกอ่านตอน import ครั้งเดียว จึงส่งผ่านตัวแปรทดสอบ: จำลองด้วยการแทน URLSearchParams ที่ใช้อยู่
    const { params } = await import('../js/study-ui.js');
    for (const k of [...params.keys()]) params.delete(k);
    for (const [k, v] of new URLSearchParams(search)) params.set(k, v);
    current = await initMockExam({ api, ...OPTS });
    await wait(0);
}

const html = () => dom.content.innerHTML;
const started = async (api) => { await open(api); dom.click({ act: 'start' }); await wait(10); };

beforeEach(() => dom.reset());
afterEach(() => { current?.dispose(); current = null; });

describe('เลือกวิชา', () => {
    test('แสดงเฉพาะวิชาที่เปิดสอบเป็นลิงก์ และบอกผลล่าสุด', async () => {
        const api = fakeApi({ listSubjects: async () => ({ subjects: [
            { id: 'sci', title: 'วิทยาศาสตร์', emoji: '🔬', hue: 'emerald', mock: { available: true, attempts: 2, lastPercent: 70 } },
            { id: 'mat', title: 'คณิต', emoji: '📐', hue: 'sky', mock: { available: true, attempts: 0, lastPercent: null } },
            { id: 'eng', title: 'อังกฤษ', emoji: '🌍', hue: 'violet', mock: { available: false, attempts: 0, lastPercent: null } },
        ] }) });
        await open(api, '');
        const h = html();
        assert.match(h, /href="mock-exam\.html\?s=sci"/);
        assert.match(h, /ทำแล้ว 2 ครั้ง • ล่าสุด 70%/);
        assert.match(h, /ยังไม่เคยทำ/);
        assert.match(h, /aria-disabled="true"[^>]*>[\s\S]*อังกฤษ[\s\S]*ยังไม่เปิดให้สอบ/);
        assert.doesNotMatch(h, /href="mock-exam\.html\?s=eng"/);
        assert.equal(dom.el.backLink.href, 'progress.html');
    });
    test('ยังไม่มีวิชาที่เปิดสอบ → ข้อความว่าง', async () => {
        await open(fakeApi(), '');
        assert.match(html(), /ยังไม่มีวิชาที่เปิดให้สอบ/);
    });
    test('โหลดไม่ได้ → ข้อความผิดพลาดพร้อมปุ่มลองใหม่', async () => {
        await open(fakeApi({ listSubjects: async () => { throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); } }), '');
        assert.match(html(), /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        assert.match(html(), /data-act="retry"/);
    });
});

describe('เงื่อนไขก่อนสอบและประวัติ', () => {
    test('แสดงกติกา จำนวนข้อ เวลา คะแนนผ่านที่ยังไม่กำหนด และกติกาดาวตามค่าของระบบ', async () => {
        await open(fakeApi());
        const h = html();
        assert.match(h, /3 ข้อ/);
        assert.match(h, /20 นาที/);
        assert.match(h, /ยังไม่กำหนด/);
        assert.match(h, /โบนัสเพิ่มสูงสุด 25%/);
        assert.match(h, /แพลน HEADFACE\+ และ MAX มีโจทย์ข้อพิเศษ/);
        assert.match(h, /เริ่มทำข้อสอบ/);
        assert.doesNotMatch(h, /ทำต่อข้อสอบที่ค้างไว้/);
        assert.equal(dom.el.pageTitle.textContent, 'Mock Exam ประจำวิชา');
        assert.equal(dom.el.eyebrow.textContent, 'Mock Exam • วิทยาศาสตร์');
        assert.equal(dom.el.backLink.href, 'course.html?s=sci');
    });
    test('แพลนที่ได้ข้อพิเศษเห็นข้อความของตัวเอง; ถ้าตั้งโบนัสเวลาเป็น 0 ไม่พูดถึงโบนัส', async () => {
        const info = baseInfo();
        info.mock.advanced.unlocked = true;
        info.mock.stars.timeBonusPct = 0;
        await open(fakeApi({ getMockInfo: async () => info }));
        assert.match(html(), /แพลนของคุณได้โจทย์ข้อพิเศษเพิ่ม/);
        assert.doesNotMatch(html(), /โบนัสเพิ่มสูงสุด/);
    });
    test('ประวัติ: ผลล่าสุดก่อน, เทียบกับครั้งก่อน, หมดเวลาและดาวของแต่ละครั้ง', async () => {
        const history = [
            { attemptId: 'ma_1', status: 'expired', startedAt: 1, submittedAt: 2, correct: 2, total: 5, percent: 40, secondsUsed: 1200, starsEarned: 2 },
            { attemptId: 'ma_2', status: 'submitted', startedAt: 1, submittedAt: 1, correct: 4, total: 5, percent: 80, secondsUsed: 600, starsEarned: 5 },
        ];
        await open(fakeApi({ getMockInfo: async () => baseInfo({ history, deltaVsPrevious: -40, best: { percent: 80, attemptId: 'ma_2' } }) }));
        const h = html();
        assert.match(h, /2\/5 ข้อ[\s\S]*หมดเวลา[\s\S]*2 ดาว/);
        assert.match(h, /4\/5 ข้อ/);
        assert.match(h, /▼ -40%/);
        assert.match(h, /เริ่มทำข้อสอบอีกครั้ง/);
    });
    test('มีข้อสอบค้างอยู่ → บอกว่าเวลายังเดิน และปุ่มเป็น "ทำต่อ"', async () => {
        await open(fakeApi({ getMockInfo: async () => baseInfo({ active: { attemptId: 'ma_abcdefghij', deadlineAt: Date.now() + 5000 } }) }));
        assert.match(html(), /ยังทำไม่เสร็จ — เวลาเดินต่อตามกำหนดเดิม/);
        assert.match(html(), /ทำต่อข้อสอบที่ค้างไว้/);
    });
    test('ชุดข้อสอบยังไม่เปิด → ไม่มีปุ่มเริ่ม', async () => {
        const info = baseInfo();
        info.mock = { ...info.mock, available: false };
        await open(fakeApi({ getMockInfo: async () => info }));
        assert.match(html(), /ยังไม่เปิดให้ทำ/);
        assert.doesNotMatch(html(), /data-act="start"/);
    });
    test('วิชาไม่พบ → หน้าไม่พบ; รหัสวิชาแปลก ๆ ไม่ถูกส่งไป API', async () => {
        await open(fakeApi({ getMockInfo: async () => { throw new StudyApiError('NOT_FOUND', 404, 'ไม่พบข้อมูลที่ต้องการ'); } }));
        assert.match(html(), /ไม่พบรายวิชานี้/);
        const api = fakeApi();
        let called = false;
        api.getMockInfo = async () => { called = true; return baseInfo(); };
        await open(api, '?s=%3Cimg%20src%3Dx%3E');
        assert.equal(called, false);
        assert.match(html(), /ไม่พบรายวิชานี้/);
        assert.doesNotMatch(html(), /<img/);
    });
});

describe('ทำข้อสอบ', () => {
    test('เริ่มแล้วตัวเลือกกดได้ทันที (ไม่ถูกวาดแบบ disabled), มีธง/ข้อทั้งหมด, ป้ายข้อพิเศษ, ข้อความถูก escape', async () => {
        const api = fakeApi();
        await started(api);
        let h = html();
        assert.match(h, /ข้อ 1\/3/);
        assert.match(h, /โจทย์ &lt;i&gt;หนึ่ง&lt;\/i&gt;/);
        assert.doesNotMatch(h, /<i>หนึ่ง/);
        assert.doesNotMatch(h, /data-choice="a"[^>]* disabled/, 'regression: ตัวเลือกต้องกดได้ทันทีหลังเริ่มสอบ');
        assert.match(h, /data-act="flag"/);
        assert.match(h, /data-act="open-nav"/);
        assert.doesNotMatch(h, /ข้อพิเศษ/);
        assert.doesNotMatch(h, /เพราะ|correct/);
        assert.equal(dom.el.view.toggled['has-abar'], true);
        assert.match(dom.el.barRight.innerHTML, /id="timer">20:00|id="timer">19:5\d/);
        assert.ok(dom.winListeners.beforeunload?.length, 'กันปิดหน้าโดยไม่ตั้งใจระหว่างสอบ');
        dom.click({ act: 'next' });
        h = html();
        assert.match(h, /ข้อ 2\/3/);
        assert.match(h, /ข้อพิเศษ/, 'ข้อใน pool ขั้นสูงมีป้าย');
    });

    test('ข้อสอบแสดงภาพ/วิดีโอของโจทย์และภาพของตัวเลือก; ที่อยู่ที่ไม่ปลอดภัยไม่ถูกแสดง', async () => {
        const questions = [
            { ...QUESTIONS[0], media: [{ kind: 'image', url: 'assets/study/sci/m.svg', alt: 'แผนภาพข้อสอบ', caption: 'รูป 1' }, { kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ?t=30', caption: 'คลิป' }, { kind: 'image', url: 'http://bad.example/x.png', alt: 'x', caption: null }], choices: [{ id: 'a', text: 'ก1', image: { url: 'https://example.com/a.png', alt: 'ภาพ ก' } }, { id: 'b', text: 'ข1' }] },
            QUESTIONS[1], QUESTIONS[2],
        ];
        const api = fakeApi({ startMock: async () => ({ resumed: false, serverNow: Date.now(), attempt: { id: 'ma_abcdefghij', status: 'in_progress', startedAt: Date.now(), deadlineAt: Date.now() + 1200000, durationSec: 1200, total: 3, questions, answers: {}, flags: [] } }) });
        await started(api);
        const h = html();
        assert.match(h, /class="qmedia"/);
        assert.match(h, /<img src="assets\/study\/sci\/m\.svg" alt="แผนภาพข้อสอบ"/);
        assert.match(h, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0&amp;modestbranding=1&amp;start=30/);
        assert.match(h, /<img class="choice-img" src="https:\/\/example\.com\/a\.png" alt="ภาพ ก"/);
        assert.doesNotMatch(h, /bad\.example/);
        dom.click({ act: 'next' });
        assert.doesNotMatch(html(), /qmedia/, 'ข้อที่ไม่มีสื่อไม่มีกล่องสื่อ');
    });

    test('เลือกคำตอบ → บันทึกอัตโนมัติด้วย state ทั้งหมด; ติดธงก็บันทึก; กดหลายครั้งรวมเป็นครั้งเดียว', async () => {
        const api = fakeApi();
        await started(api);
        dom.click({ choice: 'a' });
        dom.click({ choice: 'b' });
        dom.click({ act: 'next' });
        dom.click({ choice: 'a' });
        dom.click({ act: 'flag' });
        assert.match(html(), /ติดธงแล้ว/);
        await wait(80);
        const saves = api.calls.filter((c) => c[0] === 'save');
        assert.equal(saves.length, 1, 'debounce');
        assert.deepEqual(saves[0][2], { answers: { q1: 'b', q2: 'a' }, flags: ['q2'] });
    });

    test('บันทึกไม่สำเร็จ → เตือนว่าคำตอบยังอยู่ในหน้า แล้วลองใหม่เอง และเตือนหายเมื่อสำเร็จ', async () => {
        let fail = true;
        const api = fakeApi({ saveMockAnswers: async (id, st) => { api.calls.push(['save', id, st]); if (fail) throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อไม่ได้'); return { saved: 1 }; } });
        await started(api);
        dom.click({ choice: 'a' });
        await wait(60);
        assert.match(html(), /บันทึกอัตโนมัติไม่สำเร็จ/);
        assert.match(html(), /is-sel/, 'คำตอบที่เลือกยังอยู่');
        fail = false;
        dom.click({ choice: 'b' }); // เปลี่ยนคำตอบ → ลองบันทึกใหม่ทันที (ไม่ต้องรอ 5 วินาที)
        await wait(80);
        assert.doesNotMatch(html(), /บันทึกอัตโนมัติไม่สำเร็จ/);
        assert.deepEqual(api.calls.filter((c) => c[0] === 'save').at(-1)[2].answers, { q1: 'b' });
    });

    test('ข้อทั้งหมด: นับที่ตอบ/ติดธง ไปข้อที่เลือกได้ และปิดชั้นซ้อนได้', async () => {
        await started(fakeApi());
        dom.click({ choice: 'a' });
        dom.click({ act: 'flag' });
        dom.click({ act: 'open-nav' });
        const ov = dom.bodyChildren.at(-1);
        assert.match(ov.innerHTML, /ตอบแล้ว <b>1<\/b> จาก 3 ข้อ • ติดธง <b>1<\/b> ข้อ/);
        assert.match(ov.innerHTML, /ข้อ 1 ตอบแล้ว ติดธง/);
        assert.match(ov.innerHTML, /ข้อ 3 ยังไม่ตอบ/);
        dom.clickOverlay({ goto: 2 });
        assert.match(html(), /ข้อ 3\/3/);
        assert.equal(ov.removed, true);
    });

    test('ส่งข้อสอบ: ยืนยันก่อน, ส่ง state สุดท้ายไปพร้อมกัน, กดซ้ำไม่ส่งซ้ำ, แล้วแสดงผลสรุป', async () => {
        let release;
        const gate = new Promise((r) => { release = r; });
        const api = fakeApi({ submitMock: async (id, st) => { api.calls.push(['submit', id, st]); await gate; return { result: RESULT }; } });
        await started(api);
        dom.click({ choice: 'b' });
        dom.click({ act: 'next' });
        dom.click({ act: 'next' });
        dom.click({ act: 'ask-submit' });
        const ov = dom.bodyChildren.at(-1);
        assert.match(ov.innerHTML, /ยังมี <b>2<\/b> ข้อที่ยังไม่ตอบ/);
        dom.clickOverlay({ act: 'submit' });
        dom.clickOverlay({ act: 'submit' });
        await wait(10);
        assert.equal(api.calls.filter((c) => c[0] === 'submit').length, 1, 'ส่งครั้งเดียว');
        assert.deepEqual(api.calls.find((c) => c[0] === 'submit')[2], { answers: { q1: 'b' }, flags: [] });
        assert.match(html(), /กำลังส่ง/);
        release();
        await wait(20);
        const h = html();
        assert.match(h, /data-key="result"/);
        assert.match(h, /2\/3 ข้อ/, 'คะแนนอยู่ในวงแหวน');
        assert.match(h, /<span class="pill">[\s\S]*02:05 \/ 20:00/);
        assert.match(h, /<details class="fold"><summary><span>ผลรายหัวข้อ/, 'ผลรายหัวข้อและเฉลยพับเก็บไว้');
        assert.match(h, /<details class="fold"><summary><span>เฉลยรายข้อ \(3\)/);
        assert.match(h, /<span data-countup="7">7<\/span> ดาว[\s\S]*จากข้อถูก 6 \+ โบนัสเวลา 1/);
        assert.match(h, /▲ \+10%/);
        assert.match(h, /หัวข้อ A<\/span><span>2\/2/);
        assert.match(h, /ข้อ 2 โจทย์สอง — ผิด • ข้อพิเศษ/);
        assert.match(h, /ข้อ 3 โจทย์สาม — ไม่ได้ตอบ/);
        assert.match(h, /เฉลย: ข ข3/);
        assert.match(h, /คุณตอบ ข/);
        assert.doesNotMatch(h, /<i>หนึ่ง/, 'ข้อความในผลถูก escape');
        assert.equal(dom.el.barRight.innerHTML, '', 'ตัวจับเวลาหายไปหลังส่ง');
        assert.equal(dom.winListeners.beforeunload?.length || 0, 0, 'เลิกกันปิดหน้าแล้ว');
    });

    test('ส่งไม่สำเร็จ → ยังอยู่ในหน้าสอบพร้อมคำตอบ และส่งใหม่ได้', async () => {
        let fail = true;
        const api = fakeApi({ submitMock: async (id, st) => { api.calls.push(['submit', id, st]); if (fail) throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); return { result: RESULT }; } });
        await started(api);
        dom.click({ choice: 'a' });
        dom.click({ act: 'next' }); dom.click({ act: 'next' });
        dom.click({ act: 'ask-submit' });
        dom.clickOverlay({ act: 'submit' });
        await wait(20);
        assert.match(html(), /ส่งข้อสอบไม่สำเร็จ: เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ คำตอบของคุณยังอยู่ในหน้านี้/);
        assert.match(html(), /data-act="ask-submit"/);
        fail = false;
        dom.click({ act: 'ask-submit' });
        dom.clickOverlay({ act: 'submit' });
        await wait(20);
        assert.match(html(), /data-key="result"/);
        assert.equal(api.calls.filter((c) => c[0] === 'submit').length, 2);
    });

    test('Backend แจ้งว่าข้อสอบถูกปิดแล้ว (เช่น หมดเวลา) → แสดงผลที่ Backend ตรวจให้ทันที และบอกว่าส่งอัตโนมัติ', async () => {
        const expired = { ...RESULT, status: 'expired', autoSubmitted: true, starsTimeBonus: 0, starsEarned: 6 };
        const api = fakeApi({ saveMockAnswers: async () => { throw new StudyApiError('ATTEMPT_CLOSED', 409, 'การทำครั้งนี้จบไปแล้ว', { details: { result: expired } }); } });
        await started(api);
        dom.click({ choice: 'a' });
        await wait(60);
        const h = html();
        assert.match(h, /หมดเวลา ระบบส่งคำตอบที่ทำไว้ให้อัตโนมัติ/);
        assert.match(h, /data-key="result"/);
        assert.doesNotMatch(h, /โบนัสเวลา/);
    });

    test('เวลาหมดตามนาฬิกา server → ส่งให้อัตโนมัติ (ไม่รอผู้ใช้) และส่งครั้งเดียว', async () => {
        const api = fakeApi({ startMock: async () => ({ resumed: false, serverNow: Date.now(), attempt: { id: 'ma_abcdefghij', status: 'in_progress', startedAt: Date.now(), deadlineAt: Date.now() + 30, durationSec: 1200, total: 3, questions: QUESTIONS, answers: { q1: 'a' }, flags: [] } }) });
        await started(api);
        await wait(120);
        assert.equal(api.calls.filter((c) => c[0] === 'submit').length, 1);
        assert.match(html(), /data-key="result"/);
    });

    test('เวลาที่เหลือใช้เวลา server ไม่ใช่นาฬิกาเครื่อง (เครื่องเดินเร็ว/ช้า)', async () => {
        const api = fakeApi({ startMock: async () => {
            const serverNow = Date.now() + 3600 * 1000; // นาฬิกาเครื่องช้ากว่า server 1 ชม.
            return { resumed: false, serverNow, attempt: { id: 'ma_abcdefghij', status: 'in_progress', startedAt: serverNow, deadlineAt: serverNow + 1200000, durationSec: 1200, total: 3, questions: QUESTIONS, answers: {}, flags: [] } };
        } });
        await started(api);
        assert.match(dom.el.barRight.innerHTML, /id="timer">(20:00|19:5\d)/);
        assert.equal(api.calls.filter((c) => c[0] === 'submit').length, 0, 'ไม่ส่งอัตโนมัติเพราะคิดว่าหมดเวลา');
    });

    test('ทำต่อ: คำตอบ/ธงที่บันทึกไว้กลับมา และไปข้อแรกที่ยังไม่ตอบ', async () => {
        const api = fakeApi({ startMock: async () => ({ resumed: true, serverNow: Date.now(), attempt: { id: 'ma_abcdefghij', status: 'in_progress', startedAt: Date.now() - 60000, deadlineAt: Date.now() + 1140000, durationSec: 1200, total: 3, questions: QUESTIONS, answers: { q1: 'b' }, flags: ['q1'] } }) });
        await started(api);
        const h = html();
        assert.match(h, /ข้อ 2\/3/, 'ข้อแรกที่ยังไม่ตอบ');
        assert.match(h, /ทำต่อจากที่ค้างไว้|aria-valuenow="1"/);
        dom.click({ act: 'open-nav' });
        assert.match(dom.bodyChildren.at(-1).innerHTML, /ตอบแล้ว <b>1<\/b> จาก 3 ข้อ • ติดธง <b>1<\/b> ข้อ/);
    });

    test('เริ่มไม่ได้ (ไม่มีสิทธิ์) → ข้อความจาก Backend ในหน้าเงื่อนไข กดใหม่ได้', async () => {
        await open(fakeApi({ startMock: async () => { throw new StudyApiError('FEATURE_FORBIDDEN', 403, 'แพลนของคุณยังไม่มีสิทธิ์ใช้ส่วนนี้'); } }));
        dom.click({ act: 'start' });
        await wait(10);
        assert.match(html(), /role="alert">แพลนของคุณยังไม่มีสิทธิ์ใช้ส่วนนี้/);
        assert.doesNotMatch(html(), /data-act="start"[^>]* disabled/);
        assert.equal(dom.winListeners.beforeunload?.length || 0, 0);
    });

    test('กดเริ่มซ้ำระหว่างรอ → ขอเริ่มครั้งเดียว', async () => {
        const api = fakeApi();
        await open(api);
        dom.click({ act: 'start' }); dom.click({ act: 'start' }); dom.click({ act: 'start' });
        await wait(10);
        assert.equal(api.calls.filter((c) => c[0] === 'start').length, 1);
    });

    test('ทำอีกครั้งจากหน้าผล → กลับเงื่อนไขพร้อมข้อมูลประวัติใหม่', async () => {
        let info = baseInfo();
        const api = fakeApi({ getMockInfo: async () => info });
        await started(api);
        dom.click({ act: 'ask-submit' });
        dom.clickOverlay({ act: 'submit' });
        await wait(20);
        info = baseInfo({ history: [{ attemptId: 'ma_abcdefghij', status: 'submitted', startedAt: 1, submittedAt: 2, correct: 2, total: 3, percent: 67, secondsUsed: 125, starsEarned: 7 }] });
        dom.click({ act: 'retry' });
        await wait(10);
        assert.match(html(), /ประวัติการสอบ[\s\S]*2\/3 ข้อ/);
        assert.match(html(), /เริ่มทำข้อสอบอีกครั้ง/);
    });
});
