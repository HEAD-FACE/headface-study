// ทดสอบรูปแบบโจทย์ใหม่ของ Quiz / Mock (js/study-qformats.js): สถานะการแตะของแต่ละรูปแบบ, การวาด (ข้อความถูก escape, ไม่มีเฉลยก่อนตอบ),
// สีผลหลังตรวจ, ได้บางส่วน, และหน้าทบทวน — ทั้งหมดเป็นฟังก์ชันล้วน ทดสอบใน Node ได้โดยไม่ต้องมีเบราว์เซอร์
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null };

const Q = await import('../js/study-qformats.js');

const base = { topic: 'หัวข้อ', media: [], choices: [], spec: null };
const TF = { ...base, id: 'tf', format: 'truefalse', text: 'น้ำเดือดที่ 100 องศา', choices: [{ id: 't', text: 'จริง' }, { id: 'f', text: 'เท็จ' }] };
const MULTI = { ...base, id: 'mu', format: 'multi', text: 'ข้อใดเป็นกรด', choices: [{ id: 'a', text: 'HCl' }, { id: 'b', text: 'NaOH' }, { id: 'c', text: 'H2SO4' }, { id: 'd', text: 'KOH' }] };
const MATCH = { ...base, id: 'ma', format: 'match', text: 'จับคู่', spec: { left: [{ id: 'l1', text: 'HCl' }, { id: 'l2', text: 'NaOH' }, { id: 'l3', text: 'NaCl' }], right: [{ id: 'r1', text: 'เกลือ' }, { id: 'r2', text: 'กรด' }, { id: 'r3', text: 'เบส' }, { id: 'r4', text: 'กลาง' }] } };
const ORDER = { ...base, id: 'or', format: 'order', text: 'เรียงขั้นตอน', spec: { items: [{ id: 'o1', text: 'ทดลอง' }, { id: 'o2', text: 'สรุปผล' }, { id: 'o3', text: 'ตั้งสมมติฐาน' }] } };
const CAT = { ...base, id: 'ca', format: 'categorize', text: 'จัดกลุ่ม', spec: { groups: [{ id: 'g1', text: 'กรด' }, { id: 'g2', text: 'เบส' }], items: [{ id: 'i1', text: 'มะนาว' }, { id: 'i2', text: 'สบู่' }, { id: 'i3', text: 'น้ำส้ม' }] } };
const FILL = { ...base, id: 'fi', format: 'fill', text: 'น้ำเดือดที่ [[1]] องศา แข็งที่ [[2]] องศา', spec: { bank: [{ id: 'w1', text: '0' }, { id: 'w2', text: '50' }, { id: 'w3', text: '100' }], blanks: 2 } };
const NUM = { ...base, id: 'nu', format: 'numeric', text: 'ความเข้มข้น', spec: { unit: 'mol/L' } };
const CHOICE = { ...base, id: 'ch', text: 'ปกติ', choices: [{ id: 'a', text: 'ก' }, { id: 'b', text: 'ข' }] };

/** ทำตามลำดับแตะ: คืนคำตอบกับสถานะสุดท้าย */
const tap = (q, steps, start = undefined, ui = {}) => steps.reduce((st, [fx, id, i]) => Q.applyAction(q, st.pick, st.ui, { fx, id, i }), { pick: start === undefined ? Q.emptyPick(q) : start, ui });

describe('พื้นฐาน', () => {
    test('รูปแบบเริ่มต้นคือ choice; choice/truefalse ตอบด้วย id เดียว', () => {
        assert.equal(Q.formatOf(CHOICE), 'choice');
        assert.equal(Q.formatOf(MATCH), 'match');
        assert.equal(Q.isChoiceLike(CHOICE), true);
        assert.equal(Q.isChoiceLike(TF), true);
        assert.equal(Q.isChoiceLike(MULTI), false);
    });
    test('ตัวเลข: เลขไทย จุลภาคทศนิยม จุลภาคหลักพัน เครื่องหมายลบ; อย่างอื่นไม่ใช่ตัวเลข (กติกาเดียวกับ Backend)', () => {
        assert.equal(Q.parseNumber('3.5'), 3.5);
        assert.equal(Q.parseNumber(' 3,5 '), 3.5);
        assert.equal(Q.parseNumber('๓.๕'), 3.5);
        assert.equal(Q.parseNumber('1,000'), 1000);
        assert.equal(Q.parseNumber('12,345.5'), 12345.5);
        assert.equal(Q.parseNumber('−2'), -2);
        assert.equal(Q.parseNumber('.5'), 0.5);
        for (const bad of ['', 'abc', '3.5.1', '1,2,3', '--2', '0x10', '3 5x', null, undefined, NaN, '9'.repeat(30)]) assert.equal(Q.parseNumber(bad), null, String(bad));
    });
    test('คำตอบเริ่มต้น: รูปร่างตรงกับที่ส่งให้ Backend', () => {
        assert.deepEqual([MULTI, ORDER].map(Q.emptyPick), [[], []]);
        assert.deepEqual([MATCH, CAT].map(Q.emptyPick), [{}, {}]);
        assert.deepEqual(Q.emptyPick(FILL), [null, null]);
        assert.equal(Q.emptyPick(NUM), '');
        assert.equal(Q.emptyPick(CHOICE), undefined);
    });
});

describe('พร้อมตรวจเมื่อไหร่ (isReady) / ตอบอะไรไปแล้วหรือยัง (hasAnswer)', () => {
    test('ต้องครบทุกส่วนก่อนกดตรวจ (Quiz); ตอบบางส่วนนับเป็น "ตอบแล้ว" (Mock)', () => {
        assert.equal(Q.isReady(CHOICE, undefined), false);
        assert.equal(Q.isReady(CHOICE, 'a'), true);
        assert.equal(Q.isReady(MULTI, []), false);
        assert.equal(Q.isReady(MULTI, ['a']), true);
        assert.equal(Q.isReady(MATCH, { l1: 'r2', l2: 'r3' }), false);
        assert.equal(Q.isReady(MATCH, { l1: 'r2', l2: 'r3', l3: 'r1' }), true);
        assert.equal(Q.isReady(ORDER, ['o3', 'o1']), false);
        assert.equal(Q.isReady(ORDER, ['o3', 'o1', 'o2']), true);
        assert.equal(Q.isReady(CAT, { i1: 'g1', i2: 'g2' }), false);
        assert.equal(Q.isReady(CAT, { i1: 'g1', i2: 'g2', i3: 'g1' }), true);
        assert.equal(Q.isReady(FILL, ['w3', null]), false);
        assert.equal(Q.isReady(FILL, ['w3', 'w1']), true);
        assert.equal(Q.isReady(NUM, ''), false);
        assert.equal(Q.isReady(NUM, 'abc'), false, 'พิมพ์ไม่เป็นตัวเลข = ยังไม่พร้อม');
        assert.equal(Q.isReady(NUM, '3,5'), true);

        assert.equal(Q.hasAnswer(MATCH, { l1: 'r2' }), true);
        assert.equal(Q.hasAnswer(MATCH, {}), false);
        assert.equal(Q.hasAnswer(FILL, ['w3', null]), true);
        assert.equal(Q.hasAnswer(FILL, [null, null]), false);
        assert.equal(Q.hasAnswer(ORDER, []), false);
        assert.equal(Q.hasAnswer(NUM, '  '), false);
        assert.equal(Q.hasAnswer(CHOICE, undefined), false);
    });
    test('toAnswer ตัดช่องว่างของตัวเลข และไม่แตะคำตอบอื่น; sanitizePick ซ่อมคำตอบที่ Backend ส่งกลับมาไม่ตรงโจทย์', () => {
        assert.equal(Q.toAnswer(NUM, ' 3.5 '), '3.5');
        assert.deepEqual(Q.toAnswer(MATCH, { l1: 'r1' }), { l1: 'r1' });
        assert.equal(Q.sanitizePick(NUM, 3.5), '3.5');
        assert.deepEqual(Q.sanitizePick(FILL, ['w1']), ['w1', null], 'จำนวนช่องไม่ตรง → เติมให้ครบ');
        assert.deepEqual(Q.sanitizePick(ORDER, ['o1', 5, 'o2']), ['o1', 'o2']);
        assert.deepEqual(Q.sanitizePick(MATCH, 'x'), {});
        assert.equal(Q.sanitizePick(CHOICE, undefined), undefined);
        assert.equal(Q.sanitizePick(CHOICE, { x: 1 }), undefined);
    });
});

describe('การแตะแต่ละรูปแบบ', () => {
    test('เลือกหลายข้อ: แตะติ๊ก/ยกเลิก และเก็บตามลำดับตัวเลือกเสมอ', () => {
        assert.deepEqual(tap(MULTI, [['x-tog', 'c'], ['x-tog', 'a']]).pick, ['a', 'c']);
        assert.deepEqual(tap(MULTI, [['x-tog', 'c'], ['x-tog', 'a'], ['x-tog', 'c']]).pick, ['a']);
    });
    test('จับคู่: แตะซ้ายแล้วขวา → จับคู่ (คู่ที่ถูกเลือกยังไม่ตรวจ ไม่มีเฉลย)', () => {
        const st = tap(MATCH, [['m-left', 'l1'], ['m-right', 'r2']]);
        assert.deepEqual(st.pick, { l1: 'r2' });
        assert.deepEqual([st.ui.armL, st.ui.armR], [null, null]);
    });
    test('จับคู่: แตะขวาก่อนแล้วซ้ายก็ได้; แตะซ้ำที่เดิมยกเลิกการเลือก', () => {
        assert.deepEqual(tap(MATCH, [['m-right', 'r3'], ['m-left', 'l2']]).pick, { l2: 'r3' });
        const st = tap(MATCH, [['m-left', 'l1'], ['m-left', 'l1']]);
        assert.deepEqual([st.pick, st.ui.armL], [{}, null]);
    });
    test('จับคู่: แตะข้างที่จับคู่แล้ว = ยกเลิกคู่ แล้วรอจับใหม่; จับกับตัวที่มีเจ้าของแล้ว = ย้ายคู่', () => {
        const paired = tap(MATCH, [['m-left', 'l1'], ['m-right', 'r2']]);
        const undone = Q.applyAction(MATCH, paired.pick, paired.ui, { fx: 'm-left', id: 'l1' });
        assert.deepEqual([undone.pick, undone.ui.armL], [{}, 'l1']);
        const undoneR = Q.applyAction(MATCH, paired.pick, paired.ui, { fx: 'm-right', id: 'r2' });
        assert.deepEqual([undoneR.pick, undoneR.ui.armR], [{}, 'r2']);
        // l2 จับ r2 ที่ l1 ถือไว้ → l1 หลุด
        const moved = Q.applyAction(MATCH, ...Object.values(Q.applyAction(MATCH, paired.pick, paired.ui, { fx: 'm-left', id: 'l2' })), { fx: 'm-right', id: 'r2' });
        assert.deepEqual(moved.pick, { l2: 'r2' });
    });
    test('เรียงลำดับ: แตะเพิ่มทีละขั้น แตะที่ใส่แล้วเพื่อเอาออก ไม่ใส่ซ้ำ', () => {
        assert.deepEqual(tap(ORDER, [['o-pick', 'o3'], ['o-pick', 'o1'], ['o-pick', 'o3']]).pick, ['o3', 'o1']);
        assert.deepEqual(tap(ORDER, [['o-pick', 'o3'], ['o-pick', 'o1'], ['o-undo', 'o3']]).pick, ['o1']);
    });
    test('จัดกลุ่ม: การ์ดใบแรกที่ยังไม่ได้จัดรอเป็นใบบนสุด แตะกลุ่มก็วางเลย; เลือกการ์ดใบอื่นเองได้; แตะที่วางแล้วเพื่อเอากลับ', () => {
        let st = tap(CAT, [['c-group', 'g1']]);
        assert.deepEqual(st.pick, { i1: 'g1' }, 'ใบแรกคือ i1');
        st = tap(CAT, [['c-item', 'i3'], ['c-group', 'g2']]);
        assert.deepEqual(st.pick, { i3: 'g2' }, 'เลือกใบที่ 3 เอง');
        st = Q.applyAction(CAT, st.pick, st.ui, { fx: 'c-group', id: 'g1' });
        assert.deepEqual(st.pick, { i3: 'g2', i1: 'g1' }, 'แล้วใบแรกที่เหลือคือ i1');
        const back = Q.applyAction(CAT, st.pick, st.ui, { fx: 'c-item', id: 'i3' });
        assert.deepEqual(back.pick, { i1: 'g1' });
        assert.equal(back.ui.cur, 'i3', 'ใบที่เอากลับรอจัดใหม่');
        const done = tap(CAT, [['c-group', 'g1'], ['c-group', 'g2'], ['c-group', 'g1'], ['c-group', 'g2']]);
        assert.deepEqual(done.pick, { i1: 'g1', i2: 'g2', i3: 'g1' }, 'จัดครบแล้วแตะกลุ่มต่อไม่เกิดอะไร');
    });
    test('เติมคำ: แตะคำเติมช่องแรกที่ว่าง; เลือกช่องก่อนได้; แตะช่องที่ใส่แล้วเพื่อเอาคำออก; คำเดียวใส่ได้ช่องเดียว', () => {
        assert.deepEqual(tap(FILL, [['f-word', 'w3'], ['f-word', 'w1']]).pick, ['w3', 'w1']);
        assert.deepEqual(tap(FILL, [['f-word', 'w3'], ['f-word', 'w3']]).pick, ['w3', null], 'คำเดิมใส่ซ้ำไม่ได้');
        assert.deepEqual(tap(FILL, [['f-blank', null, '1'], ['f-word', 'w2']]).pick, [null, 'w2'], 'เลือกช่องที่ 2 ก่อน');
        const st = tap(FILL, [['f-word', 'w3'], ['f-word', 'w1'], ['f-blank', null, '0']]);
        assert.deepEqual(st.pick, [null, 'w1']);
        assert.equal(st.ui.arm, 0, 'ช่องที่เพิ่งเอาออกรอคำใหม่');
        assert.deepEqual(Q.applyAction(FILL, [null, null], {}, { fx: 'f-blank', i: '9' }).pick, [null, null], 'ช่องที่ไม่มีอยู่ไม่ทำอะไร');
        assert.deepEqual(tap(FILL, [['f-word', 'w1'], ['f-word', 'w2'], ['f-word', 'w3']]).pick, ['w1', 'w2'], 'เต็มแล้วใส่เพิ่มไม่ได้');
    });
    test('แตะอย่างอื่นที่ไม่รู้จัก (หรือช่องพิมพ์) ไม่เปลี่ยนอะไร', () => {
        assert.deepEqual(tap(MATCH, [['zzz', 'x']]).pick, {});
        assert.deepEqual(tap(NUM, [['n-input', 'x']]).pick, '');
    });
});

describe('การวาด (ก่อนตอบ)', () => {
    const hostile = (q, patch) => ({ ...q, ...patch });
    test('ข้อความจากเนื้อหาถูก escape ทุกรูปแบบ และไม่มีเฉลยหลุดมากับโจทย์', () => {
        const bad = '<img src=x onerror=alert(1)>';
        const cases = [
            hostile(MULTI, { choices: [{ id: 'a', text: bad }, { id: 'b', text: 'ข' }] }),
            hostile(MATCH, { spec: { left: [{ id: 'l1', text: bad }], right: [{ id: 'r1', text: bad }, { id: 'r2', text: 'x' }] } }),
            hostile(ORDER, { spec: { items: [{ id: 'o1', text: bad }, { id: 'o2', text: 'x' }] } }),
            hostile(CAT, { spec: { groups: [{ id: 'g1', text: bad }, { id: 'g2', text: 'y' }], items: [{ id: 'i1', text: bad }] } }),
            hostile(FILL, { text: `${bad} [[1]]`, spec: { bank: [{ id: 'w1', text: bad }], blanks: 1 } }),
            hostile(NUM, { spec: { unit: bad } }),
        ];
        for (const q of cases) {
            const html = `${Q.stemHtml(q, Q.emptyPick(q), {})}${Q.answerHtml(q, Q.emptyPick(q), {})}`;
            assert.doesNotMatch(html, /<img/i, q.format);
            assert.match(html, /&lt;img/, q.format);
        }
    });
    test('จริง/เท็จ: การ์ด 2 ใบตอบด้วย data-choice; ที่เลือกมีสถานะ is-sel อีกใบจางลง; Mock ไม่บอกว่าปัดได้', () => {
        const none = Q.answerHtml(TF, undefined, {});
        assert.match(none, /data-choice="t"/);
        assert.match(none, /data-choice="f"/);
        assert.match(none, /ปัดการ์ด/);
        assert.doesNotMatch(Q.answerHtml(TF, undefined, {}, { swipe: false }), /ปัด/);
        const picked = Q.answerHtml(TF, 't', {});
        assert.match(picked, /tf-card tf-t is-sel/);
        assert.match(picked, /tf-card tf-f is-off/);
        const checked = Q.answerHtml(TF, 't', {}, { fb: { isCorrect: false, yourChoiceId: 't', correctChoiceId: 'f' } });
        assert.match(checked, /tf-t is-bad/);
        assert.match(checked, /tf-f is-ok/);
        assert.match(checked, /disabled/);
    });
    test('เลือกหลายข้อ: บอกว่าเลือกได้หลายข้อ; หลังตรวจมี ถูก / ผิด / ตกหล่น', () => {
        assert.match(Q.answerHtml(MULTI, [], {}), /เลือกได้หลายข้อ/);
        const html = Q.answerHtml(MULTI, ['a', 'b'], {}, { fb: { isCorrect: false, correct: ['a', 'c'] } });
        assert.match(html, /is-ok[^>]*data-id="a"/);
        assert.match(html, /is-bad[^>]*data-id="b"/);
        assert.match(html, /is-miss[^>]*data-id="c"/);
        assert.match(html, /is-dim[^>]*data-id="d"/);
    });
    test('จับคู่: สองคอลัมน์ ปุ่มซ้ายขวามี data-fx; คู่ที่จับได้สีเดียวกัน; ตัวที่รออยู่ถูกไฮไลต์', () => {
        const html = Q.answerHtml(MATCH, { l1: 'r2' }, { armR: 'r3' });
        assert.match(html, /data-fx="m-left" data-id="l1"/);
        assert.match(html, /data-fx="m-right" data-id="r4"/);
        assert.match(html, /mt-i paired" data-pc="0" data-fx="m-left" data-id="l1"/);
        assert.match(html, /mt-i paired" data-pc="0" data-fx="m-right" data-id="r2"/, 'ฝั่งขวาที่ถูกจับได้สีของฝั่งซ้ายที่ถือมันอยู่');
        assert.match(html, /mt-i armed" data-pc="0" data-fx="m-right" data-id="r3"/);
    });
    test('จับคู่หลังตรวจ: คู่ถูก/ผิดมีสี+ไอคอน, คู่ที่ผิดบอกคู่ที่ถูก, กดไม่ได้อีก', () => {
        const fb = { isCorrect: false, correct: { l1: 'r2', l2: 'r3', l3: 'r1' } };
        const html = Q.answerHtml(MATCH, { l1: 'r2', l2: 'r1', l3: 'r4' }, {}, { fb });
        assert.match(html, /is-ok" data-pc="0" data-fx="m-left" data-id="l1"/);
        assert.match(html, /is-bad" data-pc="1" data-fx="m-left" data-id="l2"[^>]*disabled[^>]*>[\s\S]*?ที่ถูก: เบส/);
        assert.match(html, /is-bad" data-pc="2" data-fx="m-left" data-id="l3"[^>]*disabled[^>]*>[\s\S]*?ที่ถูก: เกลือ/);
        assert.ok((html.match(/<svg/g) || []).length >= 3, 'ทุกคู่มีไอคอน ✓/✗ ไม่พึ่งสีอย่างเดียว');
    });
    test('เรียงลำดับ: ช่อง 1..n เติมตามที่แตะ, คลังเหลือเฉพาะที่ยังไม่ได้ใส่; หลังตรวจบอกลำดับที่ถูกเมื่อผิด', () => {
        const html = Q.answerHtml(ORDER, ['o3'], {});
        assert.match(html, /od-slot filled/);
        assert.match(html, /data-fx="o-undo" data-id="o3"/);
        assert.match(html, /data-fx="o-pick" data-id="o1"/);
        assert.doesNotMatch(html, /data-fx="o-pick" data-id="o3"/);
        const checked = Q.answerHtml(ORDER, ['o1', 'o3', 'o2'], {}, { fb: { isCorrect: false, correct: ['o3', 'o1', 'o2'] } });
        assert.match(checked, /od-slot filled is-bad/);
        assert.match(checked, /od-slot filled is-ok/);
        assert.match(checked, /ลำดับที่ถูก<\/b><ol><li>ตั้งสมมติฐาน<\/li><li>ทดลอง<\/li><li>สรุปผล<\/li>/);
        assert.doesNotMatch(checked, /od-bank/);
        const right = Q.answerHtml(ORDER, ['o3', 'o1', 'o2'], {}, { fb: { isCorrect: true, correct: ['o3', 'o1', 'o2'] } });
        assert.doesNotMatch(right, /ลำดับที่ถูก/);
    });
    test('จัดกลุ่ม: การ์ดบนสุดใหญ่ ๆ เหลือกี่ใบ; จัดครบแล้วบอกครบ; หลังตรวจบอกกลุ่มที่ถูกของใบที่ผิด/ที่ไม่ได้จัด', () => {
        const html = Q.answerHtml(CAT, { i2: 'g2' }, {});
        assert.match(html, /ct-card[^>]*>มะนาว</);
        assert.match(html, /เหลือ 2/);
        assert.match(html, /data-fx="c-group" data-id="g1"/);
        assert.match(html, /data-fx="c-item" data-id="i3"/, 'ใบที่เหลือเลือกเองได้');
        assert.match(Q.answerHtml(CAT, { i1: 'g1', i2: 'g2', i3: 'g1' }, {}), /จัดครบแล้ว/);
        const checked = Q.answerHtml(CAT, { i1: 'g2', i2: 'g2' }, {}, { fb: { isCorrect: false, correct: { i1: 'g1', i2: 'g2', i3: 'g1' } } });
        assert.match(checked, /ct-chip is-bad[\s\S]*?มะนาว[\s\S]*?ที่ถูก: กรด/);
        assert.match(checked, /ct-chip is-ok[\s\S]*?สบู่/);
        assert.match(checked, /ct-miss[\s\S]*?น้ำส้ม[\s\S]*?ที่ถูก: กรด/);
        assert.doesNotMatch(checked, /ct-card/);
    });
    test('เติมคำ: [[n]] ในโจทย์กลายเป็นช่องว่างที่แตะได้; คลังคำเหลือเฉพาะที่ยังไม่ได้ใช้ (ที่ใช้แล้วจาง)', () => {
        const stem = Q.stemHtml(FILL, ['w3', null], { arm: 1 });
        assert.match(stem, /น้ำเดือดที่ <button[^>]*data-fx="f-blank" data-i="0"[^>]*>100<\/button> องศา แข็งที่ <button[^>]*armed[^>]*data-i="1"/);
        assert.doesNotMatch(stem, /\[\[/);
        const bank = Q.answerHtml(FILL, ['w3', null], {});
        assert.match(bank, /od-chip used" data-fx="f-word" data-id="w3" disabled/);
        assert.match(bank, /od-chip" data-fx="f-word" data-id="w1"/);
        const checked = Q.stemHtml(FILL, ['w3', 'w2'], {}, { fb: { isCorrect: false, correct: ['w3', 'w1'] } });
        assert.match(checked, /is-ok[^>]*data-i="0"/);
        assert.match(checked, /is-bad[^>]*data-i="1"/);
        assert.match(Q.answerHtml(FILL, ['w3', 'w2'], {}, { fb: { isCorrect: false, correct: ['w3', 'w1'] } }), /เฉลย <b>1\.<\/b> 100\s+<b>2\.<\/b> 0/);
        assert.doesNotMatch(Q.stemHtml(FILL, [], {}), /undefined/, 'คำตอบว่างก็วาดได้');
    });
    test('กรอกตัวเลข: ช่องพิมพ์ตัวเลขพร้อมหน่วย; หลังตรวจล็อกช่องและบอกเฉลยพร้อมความคลาดเคลื่อนเมื่อผิด', () => {
        const html = Q.answerHtml(NUM, '3,5', {});
        assert.match(html, /<input[^>]*inputmode="decimal"[^>]*data-fx="n-input" value="3,5"/);
        assert.match(html, /mol\/L/);
        const bad = Q.answerHtml(NUM, '9', {}, { fb: { isCorrect: false, correct: { value: 3.5, tolerance: 0.05, unit: 'mol/L' } } });
        assert.match(bad, /nm is-bad/);
        assert.match(bad, /disabled/);
        assert.match(bad, /เฉลย <b>3\.5 ± 0\.05<\/b> mol\/L/);
        const ok = Q.answerHtml(NUM, '3.5', {}, { fb: { isCorrect: true, correct: { value: 3.5, tolerance: 0.05, unit: 'mol/L' } } });
        assert.match(ok, /nm is-ok/);
        assert.doesNotMatch(ok, /เฉลย/);
    });
    test('ข้อที่ล็อก (กำลังส่ง) กดไม่ได้', () => {
        for (const [q, pick] of [[MULTI, []], [MATCH, {}], [ORDER, []], [CAT, {}], [NUM, ''], [TF, undefined]]) {
            const html = Q.answerHtml(q, pick, {}, { locked: true });
            assert.match(html, /disabled/, q.format);
        }
    });
});

describe('ได้บางส่วน และเฉลยสั้น ๆ ในแผงเฉลย', () => {
    test('isPartial: ไม่ถูกหมดแต่ได้คะแนนบ้าง', () => {
        assert.equal(Q.isPartial({ isCorrect: false, score: 0.5 }), true);
        assert.equal(Q.isPartial({ isCorrect: true, score: 1 }), false);
        assert.equal(Q.isPartial({ isCorrect: false, score: 0 }), false);
        assert.equal(Q.isPartial(undefined), false);
    });
    test('partialLine บอกถูกกี่ส่วนจากทั้งหมด (คู่ / ตำแหน่ง / ใบ / ช่อง)', () => {
        assert.match(Q.partialLine(MATCH, { l1: 'r2', l2: 'r1', l3: 'r4' }, { isCorrect: false, score: 1 / 3, correct: { l1: 'r2', l2: 'r3', l3: 'r1' } }), /ถูก <b>1 จาก 3 คู่<\/b>/);
        assert.match(Q.partialLine(ORDER, ['o3', 'o2', 'o1'], { isCorrect: false, score: 1 / 3, correct: ['o3', 'o1', 'o2'] }), /ถูก <b>1 จาก 3 ตำแหน่ง<\/b>/);
        assert.match(Q.partialLine(CAT, { i1: 'g1', i2: 'g1', i3: 'g1' }, { isCorrect: false, score: 2 / 3, correct: { i1: 'g1', i2: 'g2', i3: 'g1' } }), /ถูก <b>2 จาก 3 ใบ<\/b>/);
        assert.match(Q.partialLine(FILL, ['w3', 'w2'], { isCorrect: false, score: 0.5, correct: ['w3', 'w1'] }), /ถูก <b>1 จาก 2 ช่อง<\/b>/);
        assert.match(Q.partialLine(MULTI, ['a'], { isCorrect: false, score: 0.5, correct: ['a', 'c'] }), /ได้ <b>50%<\/b>/);
        assert.equal(Q.partialLine(MATCH, {}, { isCorrect: false, score: 0, correct: {} }), '');
        assert.equal(Q.partialLine(MATCH, {}, { isCorrect: true, score: 1, correct: {} }), '');
    });
    test('keyLine: เฉลยของรูปแบบที่ตัวข้อไม่ได้โชว์เอง; ตอบถูกไม่ต้องมี', () => {
        assert.match(Q.keyLine(TF, { isCorrect: false, correctChoiceId: 'f' }), /เฉลย <b>เท็จ<\/b>/);
        assert.match(Q.keyLine(MULTI, { isCorrect: false, correct: ['a', 'c'] }), /เฉลย <b>ก HCl • ค H2SO4<\/b>/);
        assert.match(Q.keyLine(NUM, { isCorrect: false, correct: { value: 3.5, tolerance: 0, unit: 'mol/L' } }), /เฉลย <b>3\.5  ?mol\/L<\/b>/);
        assert.equal(Q.keyLine(NUM, { isCorrect: true, correct: { value: 3.5 } }), '');
        assert.equal(Q.keyLine(MATCH, { isCorrect: false, correct: {} }), '', 'จับคู่ เรียงลำดับ ฯลฯ ใช้สีบนตัวข้อ ไม่มีบรรทัดเฉลย');
    });
});

describe('หน้าทบทวน (ผลสรุป)', () => {
    test('จับคู่: ทีละบรรทัด ถูก/ผิด; ผิดมีคำตอบที่ขีดฆ่ากับคำตอบที่ถูก', () => {
        const html = Q.reviewAnswersHtml({ ...MATCH, yourAnswer: { l1: 'r2', l2: 'r1' }, correct: { l1: 'r2', l2: 'r3', l3: 'r1' } });
        assert.match(html, /rv-row ok[\s\S]*?HCl[\s\S]*?กรด/);
        assert.match(html, /rv-row bad[\s\S]*?NaOH[\s\S]*?<s>เกลือ<\/s>[\s\S]*?เบส/);
        assert.match(html, /rv-row bad[\s\S]*?NaCl[\s\S]*?ยังไม่ได้จับคู่[\s\S]*?เกลือ/);
    });
    test('เรียงลำดับ / จัดกลุ่ม / เติมคำ / ตัวเลข / เลือกหลายข้อ', () => {
        const order = Q.reviewAnswersHtml({ ...ORDER, yourAnswer: ['o1', 'o3'], correct: ['o3', 'o1', 'o2'] });
        assert.match(order, /1\. ตั้งสมมติฐาน[\s\S]*?<s>ทดลอง<\/s>/);
        assert.match(order, /3\. สรุปผล[\s\S]*?ว่าง/);
        const cat = Q.reviewAnswersHtml({ ...CAT, yourAnswer: { i1: 'g2' }, correct: { i1: 'g1', i2: 'g2', i3: 'g1' } });
        assert.match(cat, /มะนาว[\s\S]*?<s>เบส<\/s>[\s\S]*?กรด/);
        assert.match(cat, /สบู่[\s\S]*?ยังไม่ได้จัด/);
        const fill = Q.reviewAnswersHtml({ ...FILL, yourAnswer: ['w3', null], correct: ['w3', 'w1'] });
        assert.match(fill, /rv-row ok[\s\S]*?ช่อง 1/);
        assert.match(fill, /rv-row bad[\s\S]*?ช่อง 2[\s\S]*?ว่าง[\s\S]*? 0</);
        const num = Q.reviewAnswersHtml({ ...NUM, yourAnswer: 9, correct: { value: 3.5, tolerance: 0.05, unit: 'mol/L' } });
        assert.match(num, /<s>9<\/s>[\s\S]*?3\.5 ± 0\.05 mol\/L/);
        assert.match(Q.reviewAnswersHtml({ ...NUM, yourAnswer: null, correct: { value: 3.5, tolerance: 0, unit: null } }), /ยังไม่ได้ตอบ/);
        const multi = Q.reviewAnswersHtml({ ...MULTI, yourAnswer: ['a', 'b'], correct: ['a', 'c'] });
        assert.match(multi, /rv-row ok[\s\S]*?ก HCl/);
        assert.match(multi, /rv-row bad[\s\S]*?ข NaOH/);
        assert.match(multi, /rv-row miss[\s\S]*?ค H2SO4[\s\S]*?ยังไม่ได้เลือก/);
        assert.doesNotMatch(multi, /ง KOH/, 'ตัวเลือกที่ไม่เกี่ยวไม่ต้องแสดง');
    });
    test('choice / truefalse ใช้หน้าเดิม (คืน null ให้ผู้เรียกวาดเอง); เติมคำใส่คำเฉลยลงช่องว่างในโจทย์', () => {
        assert.equal(Q.reviewAnswersHtml({ ...CHOICE, yourChoiceId: 'a', correctChoiceId: 'b' }), null);
        assert.equal(Q.reviewAnswersHtml({ ...TF, yourChoiceId: 't', correctChoiceId: 'f' }), null);
        assert.match(Q.reviewStemText({ ...FILL, correct: ['w3', 'w1'] }), /น้ำเดือดที่ <b class="fl-fill">100<\/b> องศา แข็งที่ <b class="fl-fill">0<\/b>/);
        assert.equal(Q.reviewStemText({ ...CHOICE, text: '<b>x</b>' }), '&lt;b&gt;x&lt;/b&gt;');
    });
});
