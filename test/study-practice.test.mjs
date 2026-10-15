// ทดสอบแท็บ Practice (js/study-live-practice.js): โหลดโจทย์, เฉลยเฉพาะเมื่อขอ, ทำถูก/ทำผิด, กรอง, ล้างผล, ข้อผิดพลาด
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom, wait } from './fakeDom.mjs';

installFakeDom();
const { createPractice } = await import('../js/study-live-practice.js');
const { StudyApiError } = await import('../js/study-api.js');

const ITEMS = [
    { id: 'p1', n: 1, level: 'easy', topic: 'หัวข้อ A', text: 'โจทย์ <b>หนึ่ง</b>', result: null },
    { id: 'p2', n: 2, level: 'hard', topic: 'หัวข้อ B', text: 'โจทย์สอง', result: 'wrong' },
    { id: 'p3', n: 3, level: 'medium', topic: 'หัวข้อ B', text: 'โจทย์สาม', result: 'ok' },
];
const summaryOf = (items) => ({ total: items.length, done: items.filter((i) => i.result).length, ok: items.filter((i) => i.result === 'ok').length, wrong: items.filter((i) => i.result === 'wrong').length });

let store;
let summaries;
let renders;
function setup(over = {}) {
    store = ITEMS.map((i) => ({ ...i }));
    summaries = [];
    renders = 0;
    const calls = [];
    const api = {
        calls,
        getPractice: async () => { calls.push(['list']); return { summary: summaryOf(store), items: store.map((i) => ({ ...i })) }; },
        getSolution: async (s, no, id) => { calls.push(['solution', id]); return { questionId: id, solution: `เฉลย ${id}\n<script>x</script>` }; },
        setPracticeResult: async (s, no, id, result) => { calls.push(['mark', id, result]); store = store.map((i) => (i.id === id ? { ...i, result } : i)); return { summary: summaryOf(store) }; },
        resetPractice: async () => { calls.push(['reset']); store = store.map((i) => ({ ...i, result: null })); return { summary: summaryOf(store) }; },
        ...over,
    };
    const practice = createPractice({ subject: { id: 'sci' }, lesson: { no: 1 }, api, render: () => { renders++; }, applySummary: (s) => summaries.push(s) });
    return { practice, api };
}
const click = (practice, t = {}) => practice.handleClick({
    target: { closest: (sel) => {
        if (sel === '[data-act]') return t.act ? { dataset: { act: t.act } } : null;
        if (sel === '[data-pf]') return t.pf ? { dataset: { pf: t.pf } } : null;
        if (sel === '[data-pshow]') return t.show ? { dataset: { pshow: t.show } } : null;
        if (sel === '[data-pmark]') return t.mark ? { dataset: { pmark: t.mark } } : null;
        return null;
    } },
});
const opened = async (over) => { const s = setup(over); s.practice.open(); await wait(5); return s; };

beforeEach(() => { store = null; });

describe('โหลดโจทย์', () => {
    test('ก่อนโหลดแสดงข้อความรอ; เปิดซ้ำไม่โหลดซ้ำ; โหลดเสร็จแจ้งสรุปกลับไปที่สถานะบทเรียน', async () => {
        const { practice, api } = setup();
        assert.match(practice.html(), /กำลังโหลดโจทย์/);
        practice.open();
        practice.open();
        await wait(5);
        assert.equal(api.calls.filter((c) => c[0] === 'list').length, 1);
        assert.deepEqual(summaries.at(-1), { total: 3, done: 2, ok: 1, wrong: 1 });
        assert.match(practice.html(), /ทำแล้ว 2\/3/);
        assert.match(practice.html(), /ถูก 1/);
    });

    test('แสดงโจทย์ตามระดับ (ไทย) พร้อมผลที่เคยทำ โดยไม่มีเฉลยและข้อความถูก escape', async () => {
        const { practice } = await opened();
        const h = practice.html();
        assert.match(h, /class="lvl lvl-ง่าย">ง่าย/);
        assert.match(h, /class="lvl lvl-ยาก">ยาก/);
        assert.match(h, /class="pcard bad"/);
        assert.match(h, /class="pcard ok"/);
        assert.match(h, /โจทย์ &lt;b&gt;หนึ่ง&lt;\/b&gt;/);
        assert.doesNotMatch(h, /<b>หนึ่ง/);
        assert.doesNotMatch(h, /pcard-sol|เฉลย p/);
        assert.match(h, /ระบบไม่ตรวจให้/);
    });

    test('บทที่ไม่มีโจทย์ → ข้อความว่าง; โหลดไม่ได้ → ผิดพลาดพร้อมลองใหม่ได้', async () => {
        const empty = await opened({ getPractice: async () => ({ summary: { total: 0, done: 0, ok: 0, wrong: 0 }, items: [] }) });
        assert.match(empty.practice.html(), /บทนี้ยังไม่มีโจทย์ฝึก/);
        let fail = true;
        const { practice } = await opened({ getPractice: async () => { if (fail) throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); return { summary: summaryOf(ITEMS), items: ITEMS }; } });
        assert.match(practice.html(), /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        fail = false;
        assert.equal(click(practice, { act: 'practice-retry' }), true);
        await wait(5);
        assert.match(practice.html(), /ทำแล้ว 2\/3/);
    });
});

describe('เฉลยและการให้ผล', () => {
    test('เฉลยถูกขอเมื่อกดดูครั้งแรกเท่านั้น (ครั้งต่อไปใช้ที่เก็บไว้) และแสดงแบบ escape', async () => {
        const { practice, api } = await opened();
        click(practice, { show: 'p1' });
        assert.match(practice.html(), /กำลังโหลดเฉลย/);
        await wait(5);
        const h = practice.html();
        assert.match(h, /เฉลยและวิธีคิด/);
        assert.match(h, /เฉลย p1\n&lt;script&gt;x&lt;\/script&gt;/);
        assert.doesNotMatch(h, /<script>/);
        click(practice, { show: 'p1' });
        assert.doesNotMatch(practice.html(), /pcard-sol/, 'ซ่อนได้');
        click(practice, { show: 'p1' });
        await wait(5);
        assert.match(practice.html(), /เฉลย p1/);
        assert.equal(api.calls.filter((c) => c[0] === 'solution').length, 1);
    });

    test('ขอเฉลยไม่ได้ → ปิดเฉลยและแจ้งข้อความ', async () => {
        const { practice } = await opened({ getSolution: async () => { throw new StudyApiError('NOT_FOUND', 404, 'ไม่พบข้อมูลที่ต้องการ'); } });
        click(practice, { show: 'p1' });
        await wait(5);
        assert.match(practice.html(), /role="alert">ไม่พบข้อมูลที่ต้องการ/);
        assert.doesNotMatch(practice.html(), /pcard-sol/);
    });

    test('ทำถูก/ทำผิด: ส่งไปบันทึก อัปเดตการ์ด สรุป และแจ้งกลับสถานะบทเรียน; เปลี่ยนใจได้', async () => {
        const { practice, api } = await opened();
        assert.equal(click(practice, { mark: 'p1:ok' }), true);
        await wait(5);
        assert.deepEqual(api.calls.at(-1), ['mark', 'p1', 'ok']);
        assert.deepEqual(summaries.at(-1), { total: 3, done: 3, ok: 2, wrong: 1 });
        assert.match(practice.html(), /ทำแล้ว 3\/3/);
        click(practice, { mark: 'p1:wrong' });
        await wait(5);
        assert.deepEqual(summaries.at(-1), { total: 3, done: 3, ok: 1, wrong: 2 });
        assert.match(practice.html(), /aria-pressed="true"[^>]*><svg[^>]*>[\s\S]*?<span>ทำผิด/);
    });

    test('กดซ้ำระหว่างรอบันทึก → ส่งครั้งเดียว; บันทึกไม่ได้ → ผลเดิมคงอยู่พร้อมข้อความ', async () => {
        let release;
        const gate = new Promise((r) => { release = r; });
        const slow = await opened({ setPracticeResult: async (s, n, id, result) => { slow.api.calls.push(['mark', id, result]); await gate; store = store.map((i) => (i.id === id ? { ...i, result } : i)); return { summary: summaryOf(store) }; } });
        click(slow.practice, { mark: 'p1:ok' });
        click(slow.practice, { mark: 'p1:ok' });
        click(slow.practice, { mark: 'p1:wrong' });
        assert.equal(slow.api.calls.filter((c) => c[0] === 'mark').length, 1);
        assert.match(slow.practice.html(), /data-pmark="p1:ok"[^>]* disabled/);
        release();
        await wait(5);

        const bad = await opened({ setPracticeResult: async () => { throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); } });
        click(bad.practice, { mark: 'p1:ok' });
        await wait(5);
        assert.match(bad.practice.html(), /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        assert.match(bad.practice.html(), /ทำแล้ว 2\/3/, 'ไม่นับผลที่บันทึกไม่สำเร็จ');
        assert.doesNotMatch(bad.practice.html(), /data-pmark="p1:ok"[^>]* disabled/, 'กดใหม่ได้');
    });
});

describe('กรองและล้างผล', () => {
    test('กรองตามระดับ และ "ที่ทำผิด" (มีจำนวนบนปุ่ม); ไม่มีข้อในหมวด → ข้อความ', async () => {
        const { practice } = await opened();
        assert.match(practice.html(), /ที่ทำผิด \(1\)/);
        click(practice, { pf: 'hard' });
        let h = practice.html();
        assert.equal((h.match(/<article class="pcard/g) || []).length, 1);
        assert.match(h, /ข้อ 2 โจทย์สอง/);
        click(practice, { pf: 'wrong' });
        assert.equal((practice.html().match(/<article class="pcard/g) || []).length, 1);
        click(practice, { pf: 'easy' });
        click(practice, { mark: 'p1:ok' });
        await wait(5);
        click(practice, { pf: 'wrong' });
        click(practice, { mark: 'p2:ok' });
        await wait(5);
        h = practice.html();
        assert.match(h, /ยังไม่มีโจทย์ในหมวดนี้ — ข้อที่ทำผิดจะมารวมอยู่ที่นี่/);
    });

    test('ล้างผลของบท → ทุกข้อกลับเป็นยังไม่ทำ และซ่อนเฉลยที่เปิดอยู่', async () => {
        const { practice, api } = await opened();
        click(practice, { show: 'p1' });
        await wait(5);
        assert.match(practice.html(), /ล้างผลการฝึกของบทนี้/);
        click(practice, { act: 'practice-reset' });
        await wait(5);
        assert.ok(api.calls.some((c) => c[0] === 'reset'));
        const h = practice.html();
        assert.match(h, /ทำแล้ว 0\/3/);
        assert.doesNotMatch(h, /pcard-sol|ล้างผลการฝึกของบทนี้|class="pcard (ok|bad)"/);
        assert.deepEqual(summaries.at(-1), { total: 3, done: 0, ok: 0, wrong: 0 });
    });

    test('คลิกที่ไม่เกี่ยวกับ Practice ไม่ถูกจัดการ', async () => {
        const { practice } = await opened();
        assert.equal(click(practice, {}), false);
    });
});
