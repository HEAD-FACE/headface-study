// หน้าสรุปผลทีละหน้า (js/study-result.js): ตัวสร้างหน้า, แถบเลเวล และตัวเดินหน้า (ปุ่มหลักปุ่มเดียวต่อหน้า)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null };

const R = await import('../js/study-result.js');

const reward = (over = {}) => ({ exp: 30, baseExp: 30, firstTime: true, halved: false, stars: 0, levelUp: null, totals: { exp: 130, stars: 0, level: { level: 2, from: 50, to: 200, pct: 53, toNext: 70 } }, ...over });

describe('แถบเลเวล', () => {
    test('ช่วง EXP ของเลเวล n = 50 × (n−1)² ถึง 50 × n² (ตรงกับ Backend)', () => {
        assert.deepEqual(R.levelRange(1), { from: 0, to: 50 });
        assert.deepEqual(R.levelRange(2), { from: 50, to: 200 });
        assert.deepEqual(R.levelRange(4), { from: 450, to: 800 });
    });
    test('ไม่เลื่อนเลเวล: วิ่งจากค่าก่อนได้รับไปค่าหลังได้รับในเลเวลเดียวกัน', () => {
        assert.deepEqual(R.levelBar(reward()), { level: 2, from: 33, to: 53 }, 'ก่อน = 130−30 = 100 → (100−50)/150');
    });
    test('เลื่อนเลเวล: แถบของเลเวลเดิมวิ่งเต็ม', () => {
        const r = reward({ exp: 30, levelUp: { from: 1, to: 2 }, totals: { exp: 70, stars: 0, level: { level: 2, from: 50, to: 200, pct: 13, toNext: 130 } } });
        assert.deepEqual(R.levelBar(r), { level: 1, from: 80, to: 100 });
    });
    test('ไม่มีข้อมูลรวม = ไม่มีแถบ', () => {
        assert.equal(R.levelBar(null), null);
        assert.equal(R.levelBar({ exp: 5 }), null);
        assert.equal(R.levelBar({ exp: 5, totals: {} }), null);
    });
});

describe('หน้าแต่ละแบบ', () => {
    test('คะแนน: ตัวเลขใหญ่ ลูกบอลถูก/ผิดต่อข้อ ข้อความตามคะแนน ป้ายผ่านเกณฑ์ (ไม่มีกราฟ)', () => {
        const h = R.scoreStepHtml({ correct: 4, total: 5, marks: [true, true, false, true, true], passed: true, lessonDone: true });
        assert.match(h, /data-count="4">4<\/span><small>\/ 5 ข้อ/);
        assert.equal((h.match(/<i class="ok"/g) || []).length, 4);
        assert.equal((h.match(/<i class="bad"/g) || []).length, 1);
        assert.match(h, /style="--i:4"/, 'ลูกบอลโผล่ทีละลูกตามลำดับ');
        assert.match(h, /ยอดเยี่ยม/);
        assert.match(h, /ผ่านเกณฑ์!/);
        assert.match(h, /บทนี้เสร็จสมบูรณ์/);
        assert.match(h, /🏆/);
        assert.doesNotMatch(h, /<svg[^>]*viewBox="0 0 132/, 'ไม่มีวงแหวนกราฟ');
    });
    test('คะแนนน้อย/ไม่ผ่าน: ให้กำลังใจ ไม่ตัดสิน', () => {
        const h = R.scoreStepHtml({ correct: 1, total: 5, marks: [true, false, false, false, false], passed: false });
        assert.match(h, /เกือบผ่านแล้ว ลองอีกครั้งนะ/);
        assert.match(h, /🌱/);
        assert.doesNotMatch(R.scoreStepHtml({ correct: 1, total: 5, marks: [true], passed: null }), /ผ่านเกณฑ์|เกือบผ่าน/);
        assert.equal(R.scoreStepHtml({ correct: 0, total: 0, marks: [], passed: null }).includes('NaN'), false);
    });
    test('ทบทวน: คำตอบที่ถูกกับเหตุผล ข้อความถูก escape; ไม่ได้ตอบก็รองรับ', () => {
        const item = { n: 2, text: '<b>โจทย์</b>', media: [], choices: [{ id: 'a', text: 'ก1' }, { id: 'b', text: 'ข1 <i>' }], yourChoiceId: 'a', correctChoiceId: 'b', explanation: 'เพราะ <x>' };
        const h = R.reviewStepHtml({ item, index: 0, count: 3 });
        assert.match(h, /มาทบทวนกัน <em>1\/3<\/em>/);
        assert.match(h, /ข้อ 2 &lt;b&gt;โจทย์&lt;\/b&gt;/);
        assert.match(h, /คุณตอบ <s>ก ก1<\/s>/);
        assert.match(h, /เฉลย <b>ข ข1 &lt;i&gt;<\/b>/);
        assert.match(h, /เพราะ &lt;x&gt;/);
        assert.doesNotMatch(h, /<i>|<x>/);
        assert.match(R.reviewStepHtml({ item: { ...item, yourChoiceId: null }, index: 0, count: 1 }), /ยังไม่ได้ตอบข้อนี้/);
        assert.doesNotMatch(R.reviewStepHtml({ item, index: 0, count: 1 }), /<em>/, 'ข้อเดียวไม่มีตัวนับ');
    });
    test('EXP: ตัวเลขใหญ่ ที่มา (ข้อถูก + ทำเสร็จ) ป้ายทำซ้ำ และแถบเลเวล', () => {
        const h = R.expStepHtml({ reward: reward({ parts: { answers: 20, completion: 10 }, halved: true, firstTime: false }), title: 'EXP ที่ได้รับ' });
        assert.match(h, /\+<span data-count="30">30<\/span><small>EXP/);
        assert.match(h, /ข้อที่ถูก \+20/);
        assert.match(h, /ทำเสร็จ \+10/);
        assert.match(h, /ทำซ้ำ ได้ครึ่งเดียว/);
        assert.match(h, /<b>Lv\. 2<\/b>[\s\S]*data-to="53" style="width:33%"/);
        const bare = R.expStepHtml({ reward: { exp: 10 }, title: 't' });
        assert.doesNotMatch(bare, /rs-parts|rs-lvl|ครึ่งเดียว/);
        assert.doesNotMatch(R.expStepHtml({ reward: reward({ parts: { answers: 0, completion: 0 } }) }), /rs-parts/);
    });
    test('ดาว และเลื่อนเลเวล', () => {
        assert.match(R.starsStepHtml({ stars: 7, base: 6, bonus: 1, percent: 67 }), /data-count="7">7<\/span><small>ดาว[\s\S]*จากคะแนน 67% = 6 ดาว \+ โบนัสเวลา 1/);
        assert.match(R.starsStepHtml({ stars: 0, base: 0, bonus: 0, percent: 0 }), /ยังไม่ได้ดาว ลองอีกครั้งนะ/);
        assert.match(R.levelUpStepHtml(reward({ levelUp: { from: 2, to: 3 } })), /เลื่อนเป็นเลเวล[\s\S]*Lv\. <span data-count="3">3<\/span>/);
    });
    test('rewardSteps: มีหน้า EXP เมื่อได้ EXP และหน้าเลื่อนเลเวลเมื่อเลื่อน; ไม่ได้อะไรก็ไม่มีหน้าเลย', () => {
        assert.deepEqual(R.rewardSteps(null).map((x) => x.key), []);
        assert.deepEqual(R.rewardSteps({ exp: 0 }).map((x) => x.key), []);
        assert.deepEqual(R.rewardSteps(reward()).map((x) => x.key), ['exp']);
        assert.deepEqual(R.rewardSteps(reward({ levelUp: { from: 1, to: 2 } })).map((x) => x.key), ['exp', 'level']);
    });
});

describe('ตัวเดินหน้า', () => {
    const make = (over = {}) => {
        let renders = 0;
        const steps = [
            { key: 'a', html: () => '<i>หน้า A</i>', label: 'ต่อไป' },
            { key: 'b', count: 2, html: (sub) => `<i>หน้า B${sub}</i>`, label: (sub) => (sub === 0 ? 'ข้อถัดไป' : 'เข้าใจแล้ว') },
            { key: 'c', html: () => '<i>หน้า C</i>', label: 'ต่อไป' },
        ];
        const flow = R.createResultFlow({ steps, render: () => { renders++; }, finalCta: { href: 'course.html?s=<x>', label: 'ไปต่อ' }, linksHtml: '<a class="linkbtn">ลิงก์</a>', ...over });
        return { flow, renders: () => renders };
    };
    const click = (flow, act) => flow.handleClick({ target: { closest: () => (act ? { dataset: { act } } : null) } });

    test('เดินทีละหน้า (หน้าย่อยของทบทวนนับด้วย) ปุ่มเดียวต่อหน้า และป้ายปุ่มเปลี่ยนตามหน้า', () => {
        const { flow, renders } = make();
        let h = flow.html();
        assert.match(h, /data-key="a-0"/);
        assert.match(h, /data-act="rs-next"[^>]*><span>ต่อไป/);
        assert.match(h, /aria-valuenow="1" aria-label="หน้า 1 จาก 3"/);
        assert.equal(flow.isLast(), false);
        assert.equal(click(flow, 'rs-next'), true);
        h = flow.html();
        assert.match(h, /data-key="b-0"[\s\S]*หน้า B0/);
        assert.match(h, /<span>ข้อถัดไป/);
        click(flow, 'rs-next');
        h = flow.html();
        assert.match(h, /data-key="b-1"[\s\S]*หน้า B1/);
        assert.match(h, /<span>เข้าใจแล้ว/);
        assert.match(h, /aria-valuenow="2"/, 'หน้าย่อยไม่เพิ่มจุดความคืบหน้า');
        click(flow, 'rs-next');
        assert.match(flow.html(), /data-key="c-0"/);
        assert.equal(renders(), 3);
    });
    test('หน้าสุดท้าย: ปุ่มหลักเป็นลิงก์ไปต่อ (escape) + ลิงก์เล็ก ๆ; กดต่อไม่ได้แล้ว', () => {
        const { flow } = make();
        click(flow, 'rs-next'); click(flow, 'rs-next'); click(flow, 'rs-next');
        const h = flow.html();
        assert.equal(flow.isLast(), true);
        assert.match(h, /<a class="btn btn-lg" href="course\.html\?s=&lt;x&gt;"><span>ไปต่อ/);
        assert.match(h, /<div class="res-links"><a class="linkbtn">ลิงก์<\/a><\/div>/);
        assert.doesNotMatch(h, /data-act="rs-next"/);
        assert.equal(flow.advance(), false);
        assert.equal(click(flow, 'other'), false);
        assert.equal(click(flow, undefined), false);
    });
    test('หน้าที่ข้ามได้ (ทบทวนหลายข้อ) มีลิงก์ข้ามไปหัวข้อถัดไป ไม่ต้องกดทีละข้อ; หน้าอื่นไม่มีลิงก์นี้', () => {
        const steps = [
            { key: 'a', html: () => 'A', label: 'ต่อไป' },
            { key: 'r', count: 3, skippable: true, html: (sub) => `R${sub}`, label: 'ข้อถัดไป' },
            { key: 'z', html: () => 'Z', label: 'ต่อไป' },
        ];
        const { flow } = make({ steps });
        assert.doesNotMatch(flow.html(), /rs-skip/);
        click(flow, 'rs-next');
        assert.match(flow.html(), /data-act="rs-skip">ข้ามการทบทวน/);
        click(flow, 'rs-next');
        assert.match(flow.html(), /data-key="r-1"[\s\S]*rs-skip/);
        assert.equal(click(flow, 'rs-skip'), true);
        assert.match(flow.html(), /data-key="z-0"/);
        assert.doesNotMatch(flow.html(), /rs-skip/);
        // ถ้าทบทวนเป็นหน้าสุดท้าย (ไม่มีหน้าอื่นต่อ) ไม่มีอะไรให้ข้ามไป
        const only = make({ steps: [{ key: 'r', count: 2, skippable: true, html: () => 'R', label: 'ต่อไป' }] }).flow;
        assert.doesNotMatch(only.html(), /rs-skip/);
        assert.equal(only.skip(), false);
    });
    test('หน้าเดียว: ไม่มีจุดความคืบหน้า และเป็นหน้าสุดท้ายทันที', () => {
        const { flow } = make({ steps: [{ key: 'only', html: () => '<i>เดียว</i>', label: 'ต่อไป' }] });
        const h = flow.html();
        assert.doesNotMatch(h, /rs-dots/);
        assert.equal(flow.isLast(), true);
        assert.match(h, /href="course/);
    });
    test('แอนิเมชันของแต่ละหน้าเล่นครั้งเดียว (วาดซ้ำไม่เล่นซ้ำ)', () => {
        let played = 0;
        const { flow } = make({ steps: [{ key: 'a', html: () => 'x', label: 'ต่อไป', fx: () => { played++; } }, { key: 'b', html: () => 'y', label: 'ต่อไป' }] });
        const root = { querySelector: () => null };
        flow.afterRender(root);
        flow.afterRender(root);
        assert.equal(played, 1);
        flow.afterRender({});
        assert.equal(played, 1, 'ไม่มี DOM จริงก็ไม่พัง');
    });
});
