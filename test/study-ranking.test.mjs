// ทดสอบตารางอันดับดาวและหน้าเลื่อนอันดับ (js/study-ranking.js): โพเดียม SVG, รายการ, การ์ดและแถบชื่อลอยของฉัน (ชื่อเต็มเสมอ ไม่มีทางซ่อน),
// ข้อความที่ผ่าน escape, ตัวโหลด, หน้า "เลื่อนอันดับ" ในสรุปผล Mock (โผล่เฉพาะเมื่ออันดับขยับหรือเพิ่งติดอันดับ)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null };

const R = await import('../js/study-ranking.js');

const av = (n) => `https://api.test/api/avatar/preset/p0${n}.svg?v=1`;
const entry = (rank, name, stars, extra = {}) => ({ rank, name, avatar: av(rank % 9), stars, isMe: false, ...extra });
const TOP = [entry(1, 'ฟ้าใส ส.', 128), entry(2, 'กัปตัน ก.', 115), entry(3, 'ไทเกอร์ ท.', 98), entry(4, 'มาร์ค ม.', 91), entry(5, 'แพรว พ.', 85), entry(6, 'เจมส์ จ.', 78), entry(7, 'พรีม พรีมเมียม', 74, { isMe: true })];
const ME = { rank: 7, stars: 74, name: 'พรีม พรีมเมียม', avatar: av(2), inTop: true, toNext: { stars: 4, rank: 6 } };
const numerals = (h) => [...h.matchAll(/class="pd-num"[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]);

describe('ข้อความใต้ชื่อฉัน', () => {
    test('ขาดอีกกี่ดาวขึ้นอันดับไหน / อันดับ 1 / ยังไม่มีดาว', () => {
        assert.equal(R.nextHint(ME), 'ขาดอีก 4 ดาวขึ้นสู่อันดับ 6!');
        assert.match(R.nextHint({ rank: 1, stars: 9, toNext: null }), /อันดับ 1/);
        assert.match(R.nextHint({ rank: null, stars: 0, toNext: null }), /ทำ Mock Exam เพื่อรับดาวแรก/);
        assert.match(R.nextHint(null), /ทำ Mock Exam เพื่อรับดาวแรก/);
    });
});

describe('โพเดียม SVG', () => {
    test('ขั้นเป็น SVG จริง: โลหะ 3 สี (ทอง/เงิน/ทองแดง) สูงต่างกัน มีตัวเลขอันดับแกะนูน ประกายเลื่อน และประกายระยิบ', () => {
        const gold = R.podiumStepSvg(0, 1);
        const silver = R.podiumStepSvg(1, 2);
        const bronze = R.podiumStepSvg(2, 3);
        for (const svg of [gold, silver, bronze]) {
            assert.match(svg, /^<svg class="pd-svg"[\s\S]*<\/svg>$/);
            assert.match(svg, /<linearGradient/);
            assert.match(svg, /class="pd-shine"/);
            assert.equal((svg.match(/class="pd-spark"/g) || []).length, 3);
            assert.match(svg, /aria-hidden="true"/, 'ตกแต่งล้วน ไม่ให้เครื่องอ่านหน้าจออ่านซ้ำ');
        }
        assert.match(gold, /id="pd-gold-f"/);
        assert.match(silver, /id="pd-silver-f"/);
        assert.match(bronze, /id="pd-bronze-f"/);
        assert.match(gold, /pd-laurel/);
        assert.doesNotMatch(silver, /pd-laurel/);
        const h = (svg) => Number(/viewBox="0 0 120 (\d+)"/.exec(svg)[1]);
        assert.ok(h(gold) > h(silver) && h(silver) > h(bronze), 'อันดับ 1 สูงสุด');
        assert.deepEqual([numerals(gold), numerals(silver), numerals(bronze)], [['1'], ['2'], ['3']]);
    });
    test('ตัวเลขบนขั้นเป็นอันดับจริง (ดาวเท่ากัน = เลขซ้ำ) และข้อความถูก escape', () => {
        assert.deepEqual(numerals(R.podiumStepSvg(2, 2)), ['2']);
        assert.doesNotMatch(R.podiumStepSvg(1, '<script>'), /<script>/);
        assert.match(R.podiumStepSvg(1, '–', { empty: true }), /class="pd-svg is-empty"/);
    });
    test('CSS: ทุกแอนิเมชันของโพเดียมปิดเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว', () => {
        const css = readFileSync(new URL('../css/ranking.css', import.meta.url), 'utf8');
        const reduced = css.slice(css.indexOf('prefers-reduced-motion'));
        for (const sel of ['.pd-svg', '.pd-shine', '.pd-spark', '.crown', '.pod-info', '.lb-float', '.lb-row.is-me']) assert.ok(reduced.includes(sel), sel);
        for (const name of ['pdRise', 'pdShine', 'pdSpark', 'crownBob', 'meRing']) assert.match(css, new RegExp(`@keyframes ${name}`));
    });
});

describe('ตารางอันดับ (หน้า Progress)', () => {
    test('โพเดียมเรียง 2 - 1 - 3 พร้อมมงกุฎ SVG อันดับ 1, รายการเริ่มที่อันดับ 4, ชื่อของฉันเต็มและเด่น, การ์ดบอกขาดอีกกี่ดาว', () => {
        const h = R.rankingBodyHtml({ available: true, total: 42, top: TOP, me: ME });
        const names = [...h.matchAll(/class="pod-name">([^<]+)/g)].map((m) => m[1].trim());
        assert.deepEqual(names, ['กัปตัน ก.', 'ฟ้าใส ส.', 'ไทเกอร์ ท.']);
        assert.deepEqual(numerals(h), ['2', '1', '3'], 'ตัวเลขบนขั้นเรียง ซ้าย-กลาง-ขวา');
        assert.match(h, /<div class="crown"[^>]*><svg class="pd-crown-svg"/);
        assert.doesNotMatch(h, /[🥇🥈🥉👑]/u, 'ไม่ใช่อิโมจิอีกแล้ว');
        assert.deepEqual([...h.matchAll(/class="lb-rank">(\d+)/g)].map((m) => m[1]), ['4', '5', '6', '7']);
        assert.match(h, /lb-row is-me[\s\S]*?พรีม พรีมเมียม[\s\S]*?ฉัน/, 'ตำแหน่งจริงของฉันในตาราง ชื่อเต็ม + ป้าย "ฉัน"');
        assert.match(h, /me-rank">#7/);
        assert.match(h, /ขาดอีก 4 ดาวขึ้นสู่อันดับ 6!/);
        assert.match(h, /ติดอันดับแล้ว 42 คน/);
        assert.match(h, /<img[^>]*src="https:\/\/api\.test\/api\/avatar\/preset\/p01\.svg\?v=1"/);
    });
    test('ไม่มีปุ่มหรือสวิตช์ซ่อนชื่อในหน้าใด ๆ (ตั้งใจ)', () => {
        const all = [R.rankingBodyHtml({ available: true, total: 7, top: TOP, me: ME }), R.rankingBodyHtml({ available: true, total: 0, top: [], me: ME }), R.floatBarHtml(ME), R.rankStepHtml({ before: { stars: 1, rank: 3 }, after: { stars: 5, rank: 2 }, moved: 1, entered: false, total: 9, passed: [], me: ME })].join('');
        assert.doesNotMatch(all, /rank-anon|นิรนาม|ซ่อนชื่อ|aria-pressed|<button/);
        assert.equal(R.setRankingAnonymous, undefined);
    });
    test('ดาวเท่ากันอันดับเดียวกัน (เลขอันดับจริง ไม่ใช่ลำดับในรายการ)', () => {
        const top = [entry(1, 'ก', 10), entry(2, 'ข', 8), entry(2, 'ค', 8), entry(4, 'ง', 5)];
        const h = R.rankingBodyHtml({ available: true, total: 4, top, me: { ...DEFAULT(), name: 'ฉัน' } });
        assert.deepEqual(numerals(h), ['2', '1', '2']);
        assert.deepEqual([...h.matchAll(/class="lb-rank">(\d+)/g)].map((m) => m[1]), ['4']);
    });
    test('มีไม่ถึง 3 คน: ช่องที่ว่างเป็นขั้นจาง ๆ ไม่ใช่ข้อมูลปลอม', () => {
        const h = R.rankingBodyHtml({ available: true, total: 1, top: [entry(1, 'คนเดียว ด.', 3)], me: { ...DEFAULT(), name: 'ฉัน' } });
        assert.equal((h.match(/pod-col is-empty/g) || []).length, 2);
        assert.match(h, /คนเดียว ด\./);
        assert.doesNotMatch(h, /lb-list/);
    });
    test('ยังไม่มีใครติดอันดับ: ข้อความชวนทำ Mock และการ์ดของฉัน (—); ระบบยังไม่เปิด: ข้อความสั้น ๆ', () => {
        const h = R.rankingBodyHtml({ available: true, total: 0, top: [], me: { ...DEFAULT(), name: 'ฉัน' } });
        assert.match(h, /ยังไม่มีใครติดอันดับ/);
        assert.match(h, /me-rank">—/);
        assert.doesNotMatch(h, /class="pod"/);
        assert.match(R.rankingBodyHtml({ available: false }), /ยังไม่เปิดใช้งาน/);
        assert.match(R.rankingBodyHtml(null), /ยังไม่เปิดใช้งาน/);
    });
    test('ชื่อ/ภาพจากข้อมูลถูก escape และที่อยู่ภาพที่ไม่ปลอดภัยไม่ถูกใช้', () => {
        const bad = [entry(1, '<img src=x onerror=alert(1)>', 5, { avatar: 'javascript:alert(1)' }), entry(2, 'ดี', 4, { avatar: 'data:image/svg+xml;base64,AAAA' }), entry(3, '"><script>', 3)];
        const h = R.rankingBodyHtml({ available: true, total: 3, top: bad, me: { ...ME, name: '<b>ฉัน</b>', avatar: 'http://x/"onerror="y' } }) + R.floatBarHtml({ ...ME, name: '<b>ฉัน</b>' });
        assert.doesNotMatch(h, /<img src=x|<script|<b>ฉัน<\/b>|javascript:|data:image/, 'ไม่มีแท็กหรือที่อยู่อันตรายหลุดออกมาเป็นของจริง');
        assert.match(h, /&lt;img src=x onerror=alert\(1\)&gt;/);
        assert.match(h, /src="assets\/avatar\.png"/);
    });
});

function DEFAULT() { return { rank: null, stars: 0, avatar: null, toNext: null }; }

describe('แถบชื่อของฉัน (ลอยเหนือ navbar)', () => {
    const fakeDoc = () => {
        const nodes = new Map();
        const nav = { offsetHeight: 82 };
        const doc = {
            body: { appendChild(el) { nodes.set(el.id, el); } },
            createElement: () => ({ id: '', className: '', innerHTML: '', attrs: {}, vars: {}, style: { setProperty(k, v) { this.vars = { ...(this.vars || {}), [k]: v }; } }, setAttribute(k, v) { this.attrs[k] = v; }, remove() { nodes.delete(this.id); } }),
            getElementById: (id) => (id === 'bottom-navbar' ? nav : nodes.get(id) || null),
        };
        return { doc, nodes };
    };
    test('ชื่อเต็ม อันดับ ดาว และข้อความขาดอีกกี่ดาว; ไม่มีปุ่มปิด', () => {
        const h = R.floatBarHtml(ME);
        assert.match(h, /lf-rank[^>]*>#7</);
        assert.match(h, /lf-name">พรีม พรีมเมียม</);
        assert.match(h, /ขาดอีก 4 ดาวขึ้นสู่อันดับ 6!/);
        assert.match(h, /lf-st[^>]*>[\s\S]*?<b>74<\/b>/);
        assert.doesNotMatch(h, /<button/);
        const none = R.floatBarHtml({ rank: null, stars: 0, name: 'ใหม่ มาก', avatar: null, toNext: null });
        assert.match(none, /lf-rank is-none[^>]*>—</);
        assert.match(none, /ใหม่ มาก/);
        assert.match(none, /ทำ Mock Exam เพื่อรับดาวแรก/);
    });
    test('วางใต้ body ครั้งเดียว อัปเดตค่าเดิมซ้ำได้ และตั้งความสูง navbar ให้ลอยเหนือพอดี; เอาออกได้', () => {
        const { doc, nodes } = fakeDoc();
        const bar = R.showFloatBar(ME, doc);
        assert.equal(nodes.size, 1);
        assert.equal(bar.id, 'lb-float');
        assert.equal(bar.style.vars['--nav-h'], '82px');
        assert.match(bar.innerHTML, /พรีม พรีมเมียม/);
        const again = R.showFloatBar({ ...ME, stars: 80, name: 'ชื่ออื่น ทดสอบ' }, doc);
        assert.equal(again, bar, 'ใช้แถบเดิม');
        assert.equal(nodes.size, 1);
        assert.match(bar.innerHTML, /ชื่ออื่น ทดสอบ/);
        R.hideFloatBar(doc);
        assert.equal(nodes.size, 0);
        assert.doesNotThrow(() => R.hideFloatBar(doc));
        assert.equal(R.showFloatBar(ME, null), null, 'ไม่มี DOM ก็ไม่พัง');
    });
});

describe('โหลดตารางอันดับ', () => {
    const host = () => ({ dataset: {}, innerHTML: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, closest: () => null });
    const scope = (h) => ({ querySelector: (sel) => (sel === '#lb-body' ? h : null) });
    const noDoc = null;

    test('เติมจากข้อมูลจริงครั้งเดียว (เรียกซ้ำไม่โหลดซ้ำ)', async () => {
        const h = host();
        let calls = 0;
        const api = { getRanking: async () => { calls++; return { available: true, total: 7, top: TOP, me: ME }; } };
        await R.hydrateRanking(scope(h), api, noDoc);
        await R.hydrateRanking(scope(h), api, noDoc);
        assert.equal(calls, 1);
        assert.match(h.innerHTML, /ขาดอีก 4 ดาว/);
        assert.equal(h.attrs['aria-busy'], undefined);
    });
    test('โหลดแล้วแถบชื่อลอยขึ้น (ถ้ามีอันดับ) และเอาออกเมื่อระบบอันดับยังไม่เปิดหรือโหลดไม่ได้', async () => {
        const nodes = new Map();
        const doc = { body: { appendChild: (el) => nodes.set(el.id, el) }, createElement: () => ({ id: '', style: { setProperty() {} }, setAttribute() {}, remove() { nodes.delete(this.id); } }), getElementById: (id) => nodes.get(id) || null };
        await R.hydrateRanking(scope(host()), { getRanking: async () => ({ available: true, total: 7, top: TOP, me: ME }) }, doc);
        assert.equal(nodes.size, 1);
        assert.match(nodes.get('lb-float').innerHTML, /พรีม พรีมเมียม/);
        await R.hydrateRanking(scope(host()), { getRanking: async () => ({ available: false, top: [], total: 0, me: null }) }, doc);
        assert.equal(nodes.size, 0);
        await R.hydrateRanking(scope(host()), { getRanking: async () => ({ available: true, total: 7, top: TOP, me: ME }) }, doc);
        assert.equal(nodes.size, 1);
        await R.hydrateRanking(scope(host()), { getRanking: async () => { throw new Error('x'); } }, doc);
        assert.equal(nodes.size, 0);
    });
    test('โหลดไม่ได้: ข้อความผิดพลาด ไม่ปล่อยอันดับตัวอย่างค้างไว้', async () => {
        const h = host();
        h.innerHTML = '<div>อันดับตัวอย่าง</div>';
        await R.hydrateRanking(scope(h), { getRanking: async () => { throw new Error('x'); } }, noDoc);
        assert.match(h.innerHTML, /โหลดตารางอันดับไม่สำเร็จ/);
        assert.doesNotMatch(h.innerHTML, /อันดับตัวอย่าง/);
    });
    test('ไม่มีที่ให้ใส่ (#lb-body) = ไม่ทำอะไร', async () => {
        let calls = 0;
        await R.hydrateRanking({ querySelector: () => null }, { getRanking: async () => { calls++; } }, noDoc);
        assert.equal(calls, 0);
    });
});

describe('หน้า "เลื่อนอันดับ" หลังจบ Mock', () => {
    const MOVE = {
        before: { stars: 3, rank: 5 }, after: { stars: 14, rank: 2 }, me: { avatar: av(3), name: 'พรีม พรีมเมียม' }, moved: 3, entered: false, total: 40,
        passed: [{ name: 'เอ ก.', avatar: av(1), stars: 9 }, { name: 'บี ข.', avatar: av(2), stars: 6 }, { name: '<i>ซี</i>', avatar: av(4), stars: 4 }],
    };
    test('โผล่เฉพาะอันดับขึ้นหรือเพิ่งติดอันดับ; ดาวเพิ่มแต่อันดับเท่าเดิม/ไม่มีข้อมูล = ไม่โผล่', () => {
        assert.equal(R.hasRankMove(MOVE), true);
        assert.equal(R.hasRankMove({ ...MOVE, moved: 0 }), false);
        assert.equal(R.hasRankMove({ ...MOVE, moved: null, entered: true, before: { stars: 0, rank: null } }), true);
        assert.equal(R.hasRankMove(null), false);
        assert.equal(R.hasRankMove({ entered: false, moved: 2 }), false, 'ไม่มี after');
    });
    test('บันไดอันดับ: คนที่แซงอยู่เหนือเรา (--y) แล้วลงไปหนึ่งช่อง (--y2) เราขึ้นไปบนสุดด้วยชื่อเต็มของเรา; เลขอันดับเริ่มจากอันดับเดิม; ข้อความ escape', () => {
        const h = R.rankStepHtml(MOVE);
        assert.match(h, /เลื่อนอันดับ!/);
        assert.match(h, /ขึ้น 3 อันดับ/);
        assert.match(h, /data-roll="5,2">5</);
        assert.match(h, /aria-label="อันดับ 2"/);
        assert.deepEqual([...h.matchAll(/rk-row is-other" style="--y:(\d);--y2:(\d)"/g)].map((m) => [m[1], m[2]]), [['0', '1'], ['1', '2'], ['2', '3']]);
        assert.match(h, /rk-row is-me" style="--y:3;--y2:0"[\s\S]*?rk-name">พรีม พรีมเมียม</);
        assert.match(h, /--rows:4/);
        assert.match(h, /แซง 3 คน • ดาวสะสม 14 จาก 40 คนในตาราง/);
        assert.doesNotMatch(h, /<i>ซี<\/i>/);
        assert.match(h, /&lt;i&gt;ซี&lt;\/i&gt;/);
        assert.match(h, /src="https:\/\/api\.test\/api\/avatar\/preset\/p03\.svg\?v=1"/);
    });
    test('เพิ่งติดอันดับครั้งแรก: "ติดอันดับแล้ว!" ตัวเราเลื่อนเข้าจากล่าง (is-new) และเลขไล่ลงมาจากใต้คนที่แซง', () => {
        const h = R.rankStepHtml({ ...MOVE, before: { stars: 0, rank: null }, entered: true, moved: null, after: { stars: 12, rank: 4 }, passed: MOVE.passed.slice(0, 2) });
        assert.match(h, /ติดอันดับแล้ว!/);
        assert.match(h, /เข้าสู่ตารางอันดับดาว/);
        assert.match(h, /rk-row is-me is-new/);
        assert.match(h, /data-roll="6,4"/);
        const alone = R.rankStepHtml({ ...MOVE, passed: [] });
        assert.match(alone, /--rows:1/);
        assert.doesNotMatch(alone, /แซง/);
    });
    test('rollNumber ในเทสต์ (ไม่มีแอนิเมชัน) ขึ้นค่าสุดท้ายทันที; ค่าที่อ่านไม่ได้ไม่พัง', () => {
        const el = { textContent: '5' };
        R.rollNumber(el, 5, 2);
        assert.equal(el.textContent, '2');
        R.rollNumber(el, 'x', 9);
        assert.equal(el.textContent, '9');
        R.rollNumber(null, 1, 2);
        R.playRankUp(null, MOVE);
        R.playRankUp({ querySelector: () => null }, MOVE);
    });
});
