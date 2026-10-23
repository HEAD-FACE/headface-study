// ทดสอบสถานะกำลังโหลด: ใช้ได้เฉพาะ skeleton / วงกลมหมุน / เส้นวิ่งไปมา และ "ห้ามมีข้อมูลเสมือน" ใน HTML ก่อนข้อมูลจริงมา
// + streak ที่เก็บใน DB (แสดงผลจากข้อมูลของ Backend เท่านั้น) + เมื่อโหลดไม่ได้ต้องบอกตรง ๆ ไม่ใช่เอาตัวอย่างมาแทน
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = { scrollTo() {}, innerHeight: 700 };
globalThis.document = { querySelector: () => null, addEventListener() {}, createElement: () => ({}) };

const H = await import('../js/study-hydrate.js');
const R = await import('../js/study-ranking.js');
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const PAGES = ['index', 'subject', 'progress', 'course', 'lesson', 'mock-exam', 'report'];

describe('HTML ก่อนข้อมูลจริงมา: ไม่มีข้อมูลเสมือน', () => {
    test('ไม่มีตัวเลข/ชื่อ/ภาพตัวอย่างหลงเหลือ (EXP, เลเวล, streak, สอบใกล้ถึง, อันดับตัวอย่าง, รูป Felix, "กำลังโหลด...")', () => {
        const banned = [/2,480/, /Lv\. 14/, /เลเวล 14/, /สู่ Lv\. 15/, /สอบใกล้ถึง/, /กลางภาค คณิต/, /อันดับที่ 7/, /chip-amber">Top 10/, /น้องฟ้าใส|น้องกัปตัน|น้องไทเกอร์/, /seed=Felix/, />กำลังโหลด\.\.\.</, /data-study-hide-real/, /ยอดเยี่ยม 🚀/];
        for (const page of PAGES) {
            const html = read(`${page}.html`);
            for (const re of banned) assert.doesNotMatch(html, re, `${page}.html: ${re}`);
        }
    });
    test('ช่องข้อมูลของการ์ดวิชา (จำนวนบท %, ป้ายปุ่ม) และสถิติเป็นช่องว่าง + skeleton; แถบเป็น .bar.ld ที่กว้าง 0', () => {
        for (const [page, n] of [['index', 6], ['subject', 10]]) {
            const html = read(`${page}.html`);
            const metas = [...html.matchAll(/<p class="sc-meta([^"]*)"[^>]*>([^<]*)<\/p>/g)];
            const pcts = [...html.matchAll(/<span class="sc-pct([^"]*)"[^>]*>([^<]*)<\/span>/g)];
            assert.equal(metas.length, n, `${page} meta`);
            assert.equal(pcts.length, n, `${page} pct`);
            for (const m of [...metas, ...pcts]) assert.deepEqual([m[1].includes('ld-e'), m[2]], [true, ''], `${page}: ${m[0]}`);
            const bars = [...html.matchAll(/<div class="bar ld" aria-hidden="true"><i style="width:0%"><\/i><\/div>/g)];
            assert.ok(bars.length >= n, `${page} bars`);
        }
        const progress = read('progress.html');
        for (const key of ['exp', 'stars', 'level-long']) assert.match(progress, new RegExp(`class="[^"]*ld-e[^"]*"[^>]*data-study-reward="${key}"[^>]*></span>|data-study-reward="${key}"[^>]*></span>`), key);
        for (const key of ['answers', 'accuracy']) assert.match(progress, new RegExp(`ld-e" data-study-stat="${key}"[^>]*></p>`), key);
        assert.match(progress, /data-study-streak="days"[^>]*><\/p>/);
        assert.match(progress, /data-study-rank[^>]*><\/span>/);
        assert.match(read('index.html'), /data-study-streak="current"[^>]*><\/span>/);
        assert.match(read('index.html'), /data-study-streak="note"[^>]*><\/p>/);
    });
    test('ชื่อและรูปบนแถบหัวเว็บทุกหน้าเริ่มจากช่องว่าง/รูปโปร่งใส ไม่ใช่ชื่อหรือรูปปลอม', () => {
        for (const page of ['index', 'subject', 'progress', 'course']) {
            const html = read(`${page}.html`);
            assert.match(html, /id="headerName" class="profile-name ld-e"[^>]*><\/span>/, page);
            assert.match(html, /id="dropdownName" class="menu-n ld-e"[^>]*><\/p>/, page);
            assert.match(html, /<img id="headerAvatar" class="skl" src="data:image\/gif;base64,/, page);
        }
        for (const page of ['lesson', 'mock-exam', 'report']) assert.match(read(`${page}.html`), /id="pageTitle" class="[a-z-]+ ld-e"[^>]*><\/h1>/, page);
        assert.match(read('course.html'), /id="cpTitle" class="cp-title ld-e"[^>]*><\/h1>/);
        assert.match(read('js/main.js'), /headerAvatar\.classList\.remove\('skl'\)/, 'ได้รูปจริงแล้วเลิกเป็น skeleton');
    });
    test('ทุกหน้าโหลด loading.css; CSS ไม่ซ่อนแล้วโชว์ตัวอย่างหลังหน่วงเวลาอีก', () => {
        for (const page of PAGES) assert.match(read(`${page}.html`), /href="css\/loading\.css"/, page);
        assert.doesNotMatch(read('css/style.css'), /study-reveal|html\[data-study-pending\]/);
    });
    test('การ์ด "ทำต่อ" ของหน้าแรกเป็น skeleton ไม่ใช่การ์ดบทเรียนตัวอย่าง', () => {
        const html = read('index.html');
        const rail = /<div id="continued-scroll-track"[^>]*>([^]*?)\n        <\/div>/.exec(html)[1];
        assert.equal((rail.match(/class="cc cc-skl"/g) || []).length, 2);
        assert.doesNotMatch(rail, /cc-title|cc-pct|ลุยต่อ|href=/);
    });
});

describe('loading.css: เฉพาะ 3 แบบ', () => {
    const css = read('css/loading.css');
    test('มี skeleton (.skl/.ld-e:empty/.bar.ld) วงกลมหมุน (.spin) และเส้นวิ่งไปมา (.ldbar)', () => {
        assert.match(css, /\.skl,\s*\n\.ld-e:empty,\s*\n\.bar\.ld/);
        assert.match(css, /\.spin \{/);
        assert.match(css, /\.ldbar::before/);
        for (const name of ['sklMove', 'ldSpin', 'ldRun']) assert.match(css, new RegExp(`@keyframes ${name}`));
    });
    test('ผู้ใช้ลดการเคลื่อนไหว: ทั้ง 3 แบบหยุดวิ่ง/หมุน แต่ยังเห็นว่ากำลังรอ', () => {
        const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion'));
        for (const sel of ['.skl', '.ld-e:empty', '.bar.ld', '.spin', '.ldbar::before']) assert.ok(reduced.includes(sel), sel);
        assert.match(reduced, /animation: none/);
    });
    test('ไม่มีการขึ้นข้อความ "กำลังโหลด" ที่มองเห็นได้ในหน้าที่ดึงข้อมูล (มีเฉพาะข้อความสำหรับเครื่องอ่านหน้าจอ)', () => {
        for (const page of ['index', 'progress']) {
            const visible = read(`${page}.html`).replace(/<span class="sr-only"[^>]*>[^<]*<\/span>/g, '');
            assert.doesNotMatch(visible, /กำลังโหลด/, page);
        }
    });
});

describe('Streak จาก DB', () => {
    test('ข้อความ: วันนี้ครบแล้ว / ใกล้ขาด / เริ่มใหม่ / ยังไม่มีข้อมูล', () => {
        assert.deepEqual(H.streakText({ current: 5, longest: 9, activeToday: true, atRisk: false }), { current: '5', days: '5 วัน', note: 'วันนี้ครบแล้ว ✓', risk: false });
        assert.deepEqual(H.streakText({ current: 5, longest: 9, activeToday: false, atRisk: true }), { current: '5', days: '5 วัน', note: 'อย่าให้ขาด! เรียนวันนี้', risk: true });
        assert.equal(H.streakText({ current: 0, longest: 7, activeToday: false, atRisk: false }).note, 'สูงสุด 7 วัน • เริ่มใหม่วันนี้');
        assert.equal(H.streakText({ current: 0, longest: 0, activeToday: false, atRisk: false }).note, 'เริ่มวันนี้เลย');
        for (const none of [null, undefined, {}, { current: 'x' }]) assert.deepEqual(H.streakText(none), { current: '—', days: '—', note: '', risk: false }, 'ไม่มีข้อมูล = "—" ไม่ใช่ 0 ปลอม');
    });
    test('applyStreak ใส่ตัวเลขลงทุกช่อง data-study-streak และเอาช่องข้อความออกเมื่อไม่มีอะไรจะบอก', () => {
        const mk = (key) => ({ key, textContent: '', removed: false, classList: { toggled: {}, toggle(n, on) { this.toggled[n] = on; } }, getAttribute: () => key, remove() { this.removed = true; } });
        const els = [mk('current'), mk('days'), mk('note')];
        H.applyStreak({ querySelectorAll: () => els }, { current: 3, longest: 3, activeToday: false, atRisk: true });
        assert.deepEqual(els.map((e) => e.textContent), ['3', '3 วัน', 'อย่าให้ขาด! เรียนวันนี้']);
        assert.equal(els[2].classList.toggled['is-risk'], true);
        const again = [mk('current'), mk('note')];
        H.applyStreak({ querySelectorAll: () => again }, null);
        assert.deepEqual([again[0].textContent, again[1].removed], ['—', true]);
    });
    test('Backend ที่ไม่มีบัญชีรายการรางวัลทำให้ช่อง EXP/ดาวเป็น "—" ไม่ใช่ 0 ปลอม; แถบเลิกเป็น skeleton', () => {
        const text = { textContent: '', attrs: {}, tagName: 'SPAN', setAttribute(k, v) { this.attrs[k] = v; } };
        const parentClasses = new Set(['bar', 'ld']);
        const bar = { tagName: 'I', parentElement: { classList: { remove: (c) => parentClasses.delete(c) } } };
        H.markUnavailable({ querySelectorAll: () => [text, bar] }, '[data-study-reward]');
        assert.equal(text.textContent, '—');
        assert.ok(!parentClasses.has('ld'));
    });
});

describe('โหลดไม่ได้', () => {
    const el = (cls = []) => ({ textContent: '', attrs: {}, closest: () => null, setAttribute(k, v) { this.attrs[k] = v; }, classList: { remove: (c) => cls.splice(cls.indexOf(c), 1) } });
    test('ช่องที่รอข้อมูลกลายเป็น "—" (ไม่ใช่ตัวอย่าง), แถบเลิกวิ่ง, มีแถบแจ้งพร้อมปุ่มลองใหม่ และไม่แตะแถบหัวเว็บ', () => {
        const a = el();
        const inHeader = { ...el(), closest: (sel) => (sel === '.hdr' ? {} : null) };
        const barClasses = ['bar', 'ld'];
        const bar = el(barClasses);
        bar.classList = { remove: (c) => barClasses.splice(barClasses.indexOf(c), 1) };
        let html = '';
        let clicked = 0;
        const button = { addEventListener: (_, fn) => { button.fn = fn; } };
        const scope = {
            querySelectorAll: (sel) => (sel === '.ld-e:empty' ? [a, inHeader] : sel === '.bar.ld' ? [bar] : []),
            querySelector: (sel) => (sel === '[data-act="ld-retry"]' ? button : null),
            insertAdjacentHTML: (_, h) => { html = h; },
        };
        H.showLoadFailed(scope, () => { clicked++; });
        assert.equal(a.textContent, '—');
        assert.equal(inHeader.textContent, '', 'ชื่อบนหัวเว็บเป็นเรื่องของระบบเข้าสู่ระบบ');
        assert.deepEqual(barClasses, ['bar']);
        assert.match(html, /role="alert"[^>]*>.*โหลดข้อมูลไม่สำเร็จ[^]*ลองใหม่/);
        button.fn();
        assert.equal(clicked, 1);
    });
    test('ตารางอันดับ: ป้าย "อันดับที่ N" ใต้ดาวสะสม', () => {
        assert.equal(R.rankLabel({ available: true, me: { rank: 7 } }), 'อันดับที่ 7');
        assert.equal(R.rankLabel({ available: true, me: { rank: null } }), 'ยังไม่มีอันดับ');
        assert.equal(R.rankLabel({ available: false }), '—');
        assert.equal(R.rankLabel(null), '—');
    });
    test('ปุ่มดูเพิ่มอีก: ระหว่างดึงมีวงกลมหมุน (is-busy) และถอดออกเมื่อเสร็จ/พลาด', async () => {
        const seen = [];
        const btn = () => { const set = new Set(); return { disabled: false, attrs: { 'data-next': '25' }, classList: { add: (c) => { set.add(c); seen.push(`+${c}`); }, remove: (c) => { set.delete(c); seen.push(`-${c}`); } }, getAttribute(k) { return this.attrs[k]; }, setAttribute() {}, remove() {}, has: (c) => set.has(c) }; };
        const host = { querySelector: () => ({ insertAdjacentHTML() {} }) };
        const ok = btn();
        await R.loadMoreMembers({ getRanking: async () => ({ members: { items: [], offset: 25, limit: 25, hasMore: true } }) }, host, ok);
        assert.equal(ok.has('is-busy'), false);
        const bad = btn();
        await R.loadMoreMembers({ getRanking: async () => { throw new Error('x'); } }, host, bad);
        assert.equal(bad.has('is-busy'), false);
        assert.ok(seen.includes('+is-busy') && seen.includes('-is-busy'));
    });
});
