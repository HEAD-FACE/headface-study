// ทดสอบ "เติมไฟ" (แอนิเมชันได้รับไฟครั้งแรกของวัน) และการ์ด "สอบใกล้ถึง" ที่ใช้ข้อมูลจริง
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bodyChildren = [];
const makeEl = () => {
    const el = { className: '', innerHTML: '', attrs: {}, listeners: {}, removed: false, classes: new Set(),
        setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, fn) { this.listeners[t] = fn; },
        remove() { this.removed = true; const i = bodyChildren.indexOf(this); if (i >= 0) bodyChildren.splice(i, 1); },
        querySelector: () => null, offsetWidth: 0,
        classList: { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c), toggle: (c, on) => (on ? el.classes.add(c) : el.classes.delete(c)) } };
    return el;
};
const listeners = {};
globalThis.window = { scrollTo() {}, innerHeight: 700 };
globalThis.document = {
    body: { appendChild: (el) => bodyChildren.push(el) },
    createElement: makeEl,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    dispatchEvent: (event) => { (listeners[event.type] || (() => {}))(event); return true; },
    querySelector: () => null,
};
globalThis.CustomEvent = class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
const store = new Map();
globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const S = await import('../js/study-streak-fx.js');
const { createStudyApi } = await import('../js/study-api.js');
const H = await import('../js/study-hydrate.js');
const F = await import('../js/study-format.js');
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const reply = (body) => ({ ok: true, status: 200, json: async () => body });

describe('เติมไฟ: ข้อความและธง', () => {
    test('วันแรก / ต่อเนื่องหลายวัน', () => {
        assert.deepEqual(S.litMessage({ current: 1, extended: false }), { title: 'ได้รับไฟแล้ววันนี้!', sub: 'เริ่มนับ Streak วันแรกแล้ว!', days: 1 });
        assert.deepEqual(S.litMessage({ current: 6, extended: true }), { title: 'ได้รับไฟแล้ววันนี้!', sub: 'ต่อเนื่อง 6 วันแล้ว รักษาไฟไว้ให้ได้นะ', days: 6 });
        assert.equal(S.litMessage(null).days, 1);
        assert.equal(S.litMessage({ current: 'x' }).days, 1);
    });
    test('ธง "เพิ่งติดไฟ": ตั้งแล้วอ่านได้ครั้งเดียว', () => {
        store.clear();
        assert.equal(S.takeIgnitePending(), false);
        S.markIgnitePending();
        assert.equal(S.takeIgnitePending(), true);
        assert.equal(S.takeIgnitePending(), false);
    });
});

describe('ป้ายเติมไฟ', () => {
    test('ขึ้นเป็นป้าย status ที่แตะปิดได้ ใส่วันที่ต่อเนื่อง และตั้งธงให้การ์ดหน้าแรกเล่นไฟติดซ้ำ', async () => {
        store.clear();
        bodyChildren.length = 0;
        const el = S.showStreakLit({ current: 4, longest: 9, extended: true }, { delay: 0 });
        assert.ok(el);
        assert.equal(bodyChildren.length, 1);
        assert.equal(el.attrs.role, 'status');
        assert.match(el.innerHTML, /ได้รับไฟแล้ววันนี้!/);
        assert.match(el.innerHTML, /<b>4<\/b><small>วัน<\/small>/);
        assert.match(el.innerHTML, /class="sk-flame"/);
        assert.equal(typeof el.listeners.click, 'function');
        assert.equal(S.takeIgnitePending(), true, 'ธงถูกตั้ง');
        await new Promise((r) => setTimeout(r, 20));
        assert.ok(el.classes.has('is-on'), 'ไฟติด (is-on)');
        el.listeners.click();
        assert.ok(el.classes.has('is-out'));
        // ป้ายใหม่มาแทนป้ายเก่า ไม่ซ้อนกัน
        const again = S.showStreakLit({ current: 5, extended: true }, { delay: 0 });
        assert.notEqual(again, el);
        assert.equal(bodyChildren.filter((c) => !c.removed).length, 1);
    });
    test('ไม่มี DOM = ไม่ทำอะไรและไม่พัง', () => {
        const saved = globalThis.document;
        globalThis.document = {};
        assert.equal(S.showStreakLit({ current: 1 }), null);
        globalThis.document = saved;
    });
    test('การ์ด Streak: เล่นไฟติดซ้ำครั้งเดียวเมื่อมีธง', () => {
        store.clear();
        const card = makeEl();
        assert.equal(S.igniteStreakCard(card), false, 'ไม่มีธง = ไม่เล่น');
        S.markIgnitePending();
        assert.equal(S.igniteStreakCard(card), true);
        assert.ok(card.classes.has('ignite'));
        assert.equal(S.igniteStreakCard(card), false, 'ครั้งเดียว');
        assert.equal(S.igniteStreakCard(null), false);
    });
});

describe('API → เหตุการณ์ study:streak', () => {
    test('คำตอบที่มี streakUp ส่งเหตุการณ์ (หน้าที่ฟังอยู่เล่นป้าย); คำตอบอื่นไม่ส่ง', async () => {
        const seen = [];
        const saved = listeners['study:streak'];
        listeners['study:streak'] = (e) => seen.push(e.detail);
        const api = createStudyApi(async (path) => reply(path.includes('/answer') ? { success: true, feedback: {}, streakUp: { current: 2, longest: 2, extended: true } } : { success: true, subjects: [] }));
        await api.answerQuiz('qa_abc', 'q1', 'a');
        await api.listSubjects();
        assert.deepEqual(seen, [{ current: 2, longest: 2, extended: true }]);
        listeners['study:streak'] = saved;
    });
});

describe('การ์ด Streak: ไฟมอด / ไฟติด', () => {
    const card = (activeToday) => {
        const c = makeEl();
        c.dataset = {};
        const el = { getAttribute: () => 'current', textContent: '', closest: () => c, remove() {} };
        return { c, scope: { querySelectorAll: () => [el] }, el, streak: { current: 3, longest: 3, activeToday, atRisk: !activeToday, lastDay: 'x' } };
    };
    test('วันนี้ยังไม่ได้เรียน = ไฟมอด (is-dim); เรียนแล้ว = ไฟติด (is-lit) และเล่นไฟติดถ้าเพิ่งทำกิจกรรม', () => {
        store.clear();
        const a = card(false);
        H.applyStreak(a.scope, a.streak);
        assert.deepEqual([a.c.classes.has('is-dim'), a.c.classes.has('is-lit')], [true, false]);
        S.markIgnitePending();
        const b = card(true);
        H.applyStreak(b.scope, b.streak);
        assert.deepEqual([b.c.classes.has('is-lit'), b.c.classes.has('ignite')], [true, true]);
    });
    test('ไม่มีข้อมูล streak (Backend ยังไม่ migrate) = ไม่ติดทั้งไฟติดและไฟมอด', () => {
        const a = card(false);
        H.applyStreak(a.scope, null);
        assert.deepEqual([a.c.classes.has('is-dim'), a.c.classes.has('is-lit')], [false, false]);
    });
});

describe('สอบใกล้ถึง (ข้อมูลจริง)', () => {
    test('วันนี้ / พรุ่งนี้ / อีก N วัน พร้อมวิชา ชื่อ และวัน', () => {
        const due = new Date(2026, 9, 25, 9, 30).getTime();
        assert.deepEqual(H.examView({ title: 'กลางภาค คณิต', subject: 'คณิตศาสตร์', dueAt: due, daysLeft: 3 }), { days: '3', unit: 'วันข้างหน้า', chip: 'คณิตศาสตร์', title: 'กลางภาค คณิต', date: '25 ต.ค. • 09:30', soon: false });
        assert.equal(H.examView({ title: 'x', subject: '', dueAt: due, daysLeft: 0 }).days, 'วันนี้');
        assert.equal(H.examView({ title: 'x', subject: '', dueAt: due, daysLeft: 1 }).days, 'พรุ่งนี้');
        assert.equal(H.examView({ title: 'x', subject: '', dueAt: due, daysLeft: 0 }).unit, '', 'วันนี้/พรุ่งนี้ไม่ต่อ "วันข้างหน้า"');
        assert.equal(H.examView({ title: ' ', subject: ' ', dueAt: due, daysLeft: 5 }).chip, 'สอบ');
        assert.equal(H.examView({ title: ' ', subject: ' ', dueAt: due, daysLeft: 5 }).title, 'การสอบ');
    });
    test('ไม่มีสอบ = บอกตรง ๆ (ไม่ใช่ตัวอย่าง); Backend รุ่นเก่า = ไม่มีข้อมูลการสอบ', () => {
        const none = H.examView(null);
        assert.deepEqual([none.days, none.title, none.date, none.chip], ['—', 'ยังไม่มีสอบที่กำหนดไว้', 'เพิ่มได้ในแอปการบ้าน', '']);
        assert.equal(H.examView(undefined).title, 'ยังไม่มีข้อมูลการสอบ');
    });
    test('applyExam ใส่ข้อความลงช่องและเอาช่องที่ไม่มีค่า (ป้าย/หน่วย/วัน) ออก', () => {
        const mk = (key) => ({ key, textContent: '', removed: false, getAttribute: () => key, remove() { this.removed = true; }, classList: { toggle() {} } });
        const els = ['days', 'unit', 'chip', 'title', 'date'].map(mk);
        H.applyExam({ querySelectorAll: () => els }, null);
        const by = Object.fromEntries(els.map((e) => [e.key, e]));
        assert.equal(by.title.textContent, 'ยังไม่มีสอบที่กำหนดไว้');
        assert.equal(by.days.textContent, '—');
        assert.equal(by.chip.removed, true);
        assert.equal(by.unit.removed, true);
        assert.equal(by.date.removed, false);
        assert.equal(by.date.textContent, 'เพิ่มได้ในแอปการบ้าน');
    });
    test('formatThaiDay: วัน + เวลา เมื่อมีเวลา; เที่ยงคืนพอดี = ไม่ระบุเวลา', () => {
        assert.equal(F.formatThaiDay(new Date(2026, 9, 2, 0, 0).getTime()), '2 ต.ค.');
        assert.equal(F.formatThaiDay(new Date(2026, 9, 2, 13, 5).getTime()), '2 ต.ค. • 13:05');
        assert.equal(F.formatThaiDay('nope'), '');
    });
    test('หน้าแรกมีการ์ดสอบใกล้ถึง: ทุกช่องข้อมูลว่าง (skeleton) ไม่มีค่าตัวอย่าง', () => {
        const html = read('index.html');
        const card = /<section class="card card-rose exam"[^]*?<\/section>/.exec(html)[0];
        assert.match(card, /สอบใกล้ถึง/);
        for (const key of ['days', 'unit', 'chip', 'title', 'date']) assert.match(card, new RegExp(`ld-e[^"]*"[^>]*data-study-exam="${key}"[^>]*></(span|b)>`), key);
        assert.doesNotMatch(card, /กลางภาค|ต\.ค\./);
        assert.match(read('js/study-hydrate.js'), /applyExam\(scope, progress\.exam\)/);
    });
});

describe('CSS เติมไฟ', () => {
    const css = read('css/delight.css');
    test('มีแอนิเมชันไฟติด/วงแหวน/แสงการ์ด และปิดทั้งหมดเมื่อผู้ใช้ลดการเคลื่อนไหว', () => {
        for (const name of ['flameIgnite', 'streakGlow', 'skRing']) assert.match(css, new RegExp(`@keyframes ${name}`));
        const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion'));
        for (const sel of ['.streak.ignite', '.qs-i.ignite .qs-l svg', '.sk-lit.is-on .sk-flame', '.sk-lit.is-on .sk-ring', '.streak.is-lit .streak-row svg']) assert.ok(reduced.includes(sel), sel);
        assert.match(reduced, /\.sk-lit, \.sk-lit\.is-out \{ transition: none; \}/);
    });
    test('ไฟมอดเป็นสีเทาจาง ไฟติดเรืองแสง', () => {
        assert.match(css, /\.streak\.is-dim \.streak-row svg[^{]*\{[^}]*grayscale\(1\)/);
        assert.match(css, /\.streak\.is-lit \.streak-row svg[^{]*\{[^}]*drop-shadow/);
    });
});
