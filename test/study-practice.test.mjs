// ทดสอบ Practice หนึ่งชุด (js/study-live-practice.js): โหลดโจทย์, ทำทีละข้อ, เฉลยเฉพาะเมื่อขอ, ทำถูก/ทำผิดแล้วไปข้อถัดไป, กรอง, หน้าสรุป, ล้างผล, ข้อผิดพลาด
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
function setup(over = {}, extra = {}) {
    store = ITEMS.map((i) => ({ ...i }));
    summaries = [];
    renders = 0;
    const calls = [];
    const api = {
        calls,
        getPractice: async (s, no, nodeId) => { calls.push(['list', s, no, nodeId]); return { summary: summaryOf(store), items: store.map((i) => ({ ...i })) }; },
        getSolution: async (s, no, id, nodeId) => { calls.push(['solution', id, nodeId]); return { questionId: id, solution: `เฉลย ${id}\n<script>x</script>` }; },
        setPracticeResult: async (s, no, id, result, nodeId) => { calls.push(['mark', id, result, nodeId]); store = store.map((i) => (i.id === id ? { ...i, result } : i)); return { summary: summaryOf(store) }; },
        resetPractice: async (s, no, nodeId) => { calls.push(['reset', nodeId]); store = store.map((i) => ({ ...i, result: null })); return { summary: summaryOf(store) }; },
        ...over,
    };
    // advanceMs: 0 = ไม่เลื่อนไปข้อถัดไปเอง (เทสต์สั่งเองด้วย pk-next) ; เทสต์เลื่อนอัตโนมัติใช้ค่าสั้น ๆ แยกต่างหาก
    const practice = createPractice({ subject: { id: 'sci' }, lessonNo: 1, node: { id: 'sci-p1' }, api, render: () => { renders++; }, applySummary: (s) => summaries.push(s), nextHref: 'lesson.html?s=sci&l=2&n=sci-n3', courseHref: 'course.html?s=sci', advanceMs: 0, ...extra });
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
const opened = async (over, extra) => { const s = setup(over, extra); s.practice.open(); await wait(5); return s; };
const cards = (html) => (html.match(/<article class="pcard/g) || []).length;

beforeEach(() => { store = null; });

describe('โหลดโจทย์', () => {
    test('ก่อนโหลดแสดงโครงเปล่า (ข้อความสำหรับเครื่องอ่านหน้าจอ); เปิดซ้ำไม่โหลดซ้ำ; โหลดเสร็จแจ้งสรุปกลับไปที่สถานะบทเรียน', async () => {
        const { practice, api } = setup();
        assert.match(practice.html(), /sk-wrap[\s\S]*กำลังโหลดโจทย์/);
        assert.equal(practice.hasAbar(), false);
        practice.open();
        practice.open();
        await wait(5);
        assert.equal(api.calls.filter((c) => c[0] === 'list').length, 1);
        assert.deepEqual(api.calls[0], ['list', 'sci', 1, 'sci-p1'], 'ขอโจทย์ของชุด (node) นี้');
        assert.deepEqual(summaries.at(-1), { total: 3, done: 2, ok: 1, wrong: 1 });
        assert.match(practice.html(), /<span class="qcount"[^>]*>1\/3<\/span>/);
    });

    test('แสดงโจทย์ทีละข้อ: ระดับ (ไทย) ผลที่เคยทำเป็นสีของจุด ไม่มีเฉลย และข้อความถูก escape', async () => {
        const { practice } = await opened();
        const h = practice.html();
        assert.equal(cards(h), 1, 'ทีละข้อ');
        assert.match(h, /class="lvl lvl-ง่าย">ง่าย/);
        assert.match(h, /โจทย์ &lt;b&gt;หนึ่ง&lt;\/b&gt;/);
        assert.doesNotMatch(h, /<b>หนึ่ง/);
        assert.doesNotMatch(h, /pcard-sol|เฉลย p/);
        assert.match(h, /<div class="pk-dots" aria-hidden="true"><i class=" cur"><\/i><i class="bad"><\/i><i class="ok"><\/i><\/div>/);
        assert.doesNotMatch(h, /ระบบไม่ตรวจให้/, 'ไม่มีประโยคอธิบายยาว ๆ');
        assert.match(h, /data-pshow="p1"/);
        assert.doesNotMatch(h, /data-pmark/, 'ยังไม่ดูเฉลย = ยังไม่มีปุ่มทำถูก/ทำผิด');
        assert.equal(practice.hasAbar(), true);
    });

    test('ชุดที่ไม่มีโจทย์ → ข้อความว่าง; โหลดไม่ได้ → ผิดพลาดพร้อมลองใหม่ได้', async () => {
        const empty = await opened({ getPractice: async () => ({ summary: { total: 0, done: 0, ok: 0, wrong: 0 }, items: [] }) });
        assert.match(empty.practice.html(), /ชุดนี้ยังไม่มีโจทย์ฝึก/);
        assert.equal(empty.practice.hasAbar(), false);
        let fail = true;
        const { practice } = await opened({ getPractice: async () => { if (fail) throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); return { summary: summaryOf(ITEMS), items: ITEMS }; } });
        assert.match(practice.html(), /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        fail = false;
        assert.equal(click(practice, { act: 'practice-retry' }), true);
        await wait(5);
        assert.equal(cards(practice.html()), 1);
    });
});

describe('ทีละข้อ: ข้ามข้อ เฉลย และการให้ผล', () => {
    test('ลูกศร/ปัดนิ้วไปข้อถัดไป-ก่อนหน้า: ข้อใหม่มี key ของตัวเองและทิศที่เลื่อนเข้า; ไม่เลยขอบ', async () => {
        const { practice } = await opened();
        assert.match(practice.html(), /data-key="c-p1" data-dir="0"/);
        assert.equal(practice.step(-1), false, 'ข้อแรกถอยไม่ได้');
        assert.equal(click(practice, { act: 'pk-next' }), true);
        let h = practice.html();
        assert.match(h, /data-key="c-p2" data-dir="1"/);
        assert.match(h, /โจทย์สอง/);
        assert.match(h, /class="pcard bad"/);
        assert.match(h, /class="pcard-r bad"/, 'ข้อที่เคยทำผิดมีเครื่องหมาย');
        click(practice, { act: 'pk-prev' });
        assert.match(practice.html(), /data-key="c-p1" data-dir="-1"/);
        practice.step(1);
        practice.step(1);
        assert.match(practice.html(), /data-key="c-p3"/);
        practice.step(1);
        h = practice.html();
        assert.match(h, /data-key="done-0"/, 'เลยข้อสุดท้าย = หน้าสรุป');
        assert.equal(practice.step(1), false);
        assert.equal(practice.hasAbar(), true, "หน้าสรุปมีแถบปุ่มของตัวเอง");
    });

    test('เฉลยถูกขอเมื่อกดดูครั้งแรกเท่านั้น (ครั้งต่อไปใช้ที่เก็บไว้) และแสดงแบบ escape; เมื่อเปิดเฉลยจึงมีปุ่มทำถูก/ทำผิด', async () => {
        const { practice, api } = await opened();
        click(practice, { show: 'p1' });
        assert.match(practice.html(), /กำลังโหลดเฉลย/);
        assert.match(practice.html(), /data-pmark="p1:wrong"[\s\S]*data-pmark="p1:ok"/);
        await wait(5);
        const h = practice.html();
        assert.match(h, /เฉลยและวิธีคิด/);
        assert.match(h, /เฉลย p1\n&lt;script&gt;x&lt;\/script&gt;/);
        assert.doesNotMatch(h, /<script>/);
        click(practice, { show: 'p1' });
        assert.doesNotMatch(practice.html(), /pcard-sol/, 'ซ่อนได้');
        assert.match(practice.html(), /data-pshow="p1"/);
        click(practice, { show: 'p1' });
        await wait(5);
        assert.match(practice.html(), /เฉลย p1/);
        assert.equal(api.calls.filter((c) => c[0] === 'solution').length, 1);
        assert.deepEqual(api.calls.find((c) => c[0] === 'solution'), ['solution', 'p1', 'sci-p1']);
    });

    test('โจทย์ฝึกแสดงภาพ/วิดีโอประกอบได้ และไม่แสดงที่อยู่ที่ไม่ปลอดภัย', async () => {
        const items = [{ id: 'p1', n: 1, level: 'easy', topic: 'ก', text: 'ดูภาพ', result: null, media: [{ kind: 'image', url: 'assets/study/sci/p.svg', alt: 'ภาพประกอบ', caption: null }, { kind: 'image', url: 'http://x.example/p.png', alt: 'x', caption: null }] }];
        const { practice } = await opened({ getPractice: async () => ({ summary: summaryOf(items), items }) });
        const h = practice.html();
        assert.match(h, /class="qmedia"/);
        assert.match(h, /assets\/study\/sci\/p\.svg/);
        assert.doesNotMatch(h, /x\.example/);
    });

    test('ขอเฉลยไม่ได้ → ปิดเฉลยและแจ้งข้อความ', async () => {
        const { practice } = await opened({ getSolution: async () => { throw new StudyApiError('NOT_FOUND', 404, 'ไม่พบข้อมูลที่ต้องการ'); } });
        click(practice, { show: 'p1' });
        await wait(5);
        assert.match(practice.html(), /role="alert">ไม่พบข้อมูลที่ต้องการ/);
        assert.doesNotMatch(practice.html(), /pcard-sol/);
    });

    test('ทำถูก/ทำผิด: ส่งไปบันทึก อัปเดตจุดความคืบหน้า สรุป และแจ้งกลับสถานะบทเรียน; เปลี่ยนใจได้', async () => {
        const { practice, api } = await opened();
        click(practice, { show: 'p1' });
        await wait(5);
        assert.equal(click(practice, { mark: 'p1:ok' }), true);
        await wait(5);
        assert.deepEqual(api.calls.at(-1), ['mark', 'p1', 'ok', 'sci-p1']);
        assert.deepEqual(summaries.at(-1), { total: 3, done: 3, ok: 2, wrong: 1 });
        assert.match(practice.html(), /<i class="ok cur"><\/i>/);
        click(practice, { mark: 'p1:wrong' });
        await wait(5);
        assert.deepEqual(summaries.at(-1), { total: 3, done: 3, ok: 1, wrong: 2 });
        assert.match(practice.html(), /btn-bad on" data-key="m-wrong" data-pmark="p1:wrong" aria-pressed="true"/);
    });

    test('บันทึกแล้วไปข้อถัดไปเอง (ถ้ายังไม่ได้ย้ายข้อไปก่อน) และข้ามเมื่อผู้ใช้ย้ายเอง', async () => {
        const auto = await opened({}, { advanceMs: 20 });
        click(auto.practice, { show: 'p1' });
        await wait(5);
        click(auto.practice, { mark: 'p1:ok' });
        await wait(5);
        assert.match(auto.practice.html(), /data-key="c-p1"/, 'ให้เห็นผลสักครู่ก่อน');
        await wait(40);
        assert.match(auto.practice.html(), /data-key="c-p2" data-dir="1"/, 'ไปข้อถัดไปเอง');

        const manual = await opened({}, { advanceMs: 30 });
        click(manual.practice, { show: 'p1' });
        await wait(5);
        click(manual.practice, { mark: 'p1:ok' });
        await wait(5);
        click(manual.practice, { act: 'pk-next' });
        click(manual.practice, { act: 'pk-next' });
        click(manual.practice, { act: 'pk-next' });
        assert.match(manual.practice.html(), /data-key="done-0"/);
        await wait(50);
        assert.match(manual.practice.html(), /data-key="done-0"/, 'ไม่ถูกดึงกลับหรือเลื่อนซ้ำ');
    });

    test('กดซ้ำระหว่างรอบันทึก → ส่งครั้งเดียว; บันทึกไม่ได้ → ผลเดิมคงอยู่พร้อมข้อความ', async () => {
        let release;
        const gate = new Promise((r) => { release = r; });
        const slow = await opened({ setPracticeResult: async (s, n, id, result) => { slow.api.calls.push(['mark', id, result]); await gate; store = store.map((i) => (i.id === id ? { ...i, result } : i)); return { summary: summaryOf(store) }; } });
        click(slow.practice, { show: 'p1' });
        await wait(5);
        click(slow.practice, { mark: 'p1:ok' });
        click(slow.practice, { mark: 'p1:ok' });
        click(slow.practice, { mark: 'p1:wrong' });
        assert.equal(slow.api.calls.filter((c) => c[0] === 'mark').length, 1);
        assert.match(slow.practice.html(), /data-pmark="p1:ok"[^>]* disabled/);
        release();
        await wait(5);

        const bad = await opened({ setPracticeResult: async () => { throw new StudyApiError('NETWORK', 0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); } });
        click(bad.practice, { show: 'p1' });
        await wait(5);
        click(bad.practice, { mark: 'p1:ok' });
        await wait(5);
        assert.match(bad.practice.html(), /เชื่อมต่อเซิร์ฟเวอร์ไม่ได้/);
        assert.match(bad.practice.html(), /<div class="pk-dots" aria-hidden="true"><i class=" cur"><\/i><i class="bad">/, 'ไม่นับผลที่บันทึกไม่สำเร็จ');
        assert.doesNotMatch(bad.practice.html(), /data-pmark="p1:ok"[^>]* disabled/, 'กดใหม่ได้');
    });
});

describe('กรอง หน้าสรุป และล้างผล', () => {
    test('กรองตามระดับ และ "ที่ทำผิด" (มีจำนวนบนปุ่ม): กลับไปข้อแรกของหมวด; ไม่มีข้อในหมวด → ข้อความ', async () => {
        const { practice } = await opened();
        assert.match(practice.html(), /ที่ทำผิด \(1\)/);
        click(practice, { pf: 'hard' });
        let h = practice.html();
        assert.equal(cards(h), 1);
        assert.match(h, /ข้อ 2 โจทย์สอง/);
        assert.match(h, /<span class="qcount"[^>]*>1\/1<\/span>/);
        assert.match(h, /fchip on" data-pf="hard" aria-pressed="true"/);
        click(practice, { pf: 'wrong' });
        assert.match(practice.html(), /ข้อ 2 โจทย์สอง/);
        click(practice, { pf: 'wrong' });
        click(practice, { show: 'p2' });
        await wait(5);
        click(practice, { mark: 'p2:ok' });
        await wait(5);
        click(practice, { pf: 'wrong' });
        h = practice.html();
        assert.match(h, /ยังไม่มีโจทย์ในหมวดนี้ — ข้อที่ทำผิดจะมารวมอยู่ที่นี่/);
        assert.equal(practice.hasAbar(), false);
    });

    test('หน้าสรุปเมื่อครบชุด: จำนวนถูก/ผิด ปุ่มฝึกข้อที่ผิด ไปกิจกรรมถัดไป กลับเส้นทาง และเริ่มใหม่', async () => {
        const { practice } = await opened();
        practice.step(1);
        practice.step(1);
        practice.step(1);
        const h = practice.html();
        assert.doesNotMatch(h, /pfilter|data-pf="easy"/, 'หน้าสรุปไม่แสดงตัวกรอง (เรื่องเดียวต่อหน้า)');
        assert.match(h, /ครบ 3 ข้อแล้ว/);
        assert.match(h, /ถูก 1/);
        assert.match(h, /ผิด 1/);
        assert.match(h, /ยังไม่ได้ทำ 1/);
        assert.match(h, /data-pf="wrong">ฝึกข้อที่ผิด \(1\)<\/button>/);
        assert.match(h, /href="lesson\.html\?s=sci&amp;l=2&amp;n=sci-n3"[^>]*><span>ไปกิจกรรมถัดไป/);
        assert.match(h, /data-act="practice-reset">ล้างผล/);
        assert.equal((h.match(/<(button|a) /g) || []).length > 0, true);
        click(practice, { act: 'pk-restart' });
        assert.match(practice.html(), /data-key="c-p1" data-dir="-1"/);
        practice.step(1);
        practice.step(1);
        practice.step(1);
        click(practice, { pf: 'wrong' });
        assert.match(practice.html(), /data-key="c-p2"/, 'ฝึกเฉพาะข้อที่ผิด');
    });

    test('ล้างผลของชุด (จากหน้าสรุป) → ทุกข้อกลับเป็นยังไม่ทำ กลับไปข้อแรก และซ่อนเฉลยที่เปิดอยู่', async () => {
        const { practice, api } = await opened();
        click(practice, { show: 'p1' });
        await wait(5);
        practice.step(1);
        practice.step(1);
        practice.step(1);
        assert.match(practice.html(), /data-act="practice-reset"/);
        click(practice, { act: 'practice-reset' });
        await wait(5);
        assert.deepEqual(api.calls.find((c) => c[0] === 'reset'), ['reset', 'sci-p1']);
        const h = practice.html();
        assert.match(h, /data-key="c-p1" data-dir="-1"/);
        assert.doesNotMatch(h, /pcard-sol|class="pcard (ok|bad)"|<i class="ok|<i class="bad/);
        assert.deepEqual(summaries.at(-1), { total: 3, done: 0, ok: 0, wrong: 0 });
    });

    test('คลิกที่ไม่เกี่ยวกับ Practice ไม่ถูกจัดการ', async () => {
        const { practice } = await opened();
        assert.equal(click(practice, {}), false);
    });
});
