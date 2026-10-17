// ทดสอบตารางอันดับดาวและหน้าเลื่อนอันดับ (js/study-ranking.js): โพเดียม/รายการ/การ์ดของฉัน, ข้อความที่ผ่าน escape,
// ตัวโหลดและสวิตช์ซ่อนชื่อ, หน้า "เลื่อนอันดับ" ในสรุปผล Mock (โผล่เฉพาะเมื่ออันดับขยับหรือเพิ่งติดอันดับ)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = { scrollTo() {} };
globalThis.document = { querySelector: () => null };

const R = await import('../js/study-ranking.js');

const av = (n) => `https://api.test/api/avatar/preset/p0${n}.svg?v=1`;
const entry = (rank, name, stars, extra = {}) => ({ rank, name, avatar: av(rank % 9), stars, isMe: false, ...extra });
const TOP = [entry(1, 'ฟ้าใส ส.', 128), entry(2, 'กัปตัน ก.', 115), entry(3, 'ไทเกอร์ ท.', 98), entry(4, 'มาร์ค ม.', 91), entry(5, 'แพรว พ.', 85), entry(6, 'เจมส์ จ.', 78), entry(7, 'พรีม พ.', 74, { isMe: true })];
const ME = { rank: 7, stars: 74, name: 'พรีม พรีม', avatar: av(2), anonymous: false, inTop: true, toNext: { stars: 4, rank: 6 } };

describe('ข้อความใต้ชื่อฉัน', () => {
    test('ขาดอีกกี่ดาวขึ้นอันดับไหน / อันดับ 1 / ยังไม่มีดาว', () => {
        assert.equal(R.nextHint(ME), 'ขาดอีก 4 ดาวขึ้นสู่อันดับ 6!');
        assert.match(R.nextHint({ rank: 1, stars: 9, toNext: null }), /อันดับ 1/);
        assert.match(R.nextHint({ rank: null, stars: 0, toNext: null }), /ทำ Mock Exam เพื่อรับดาวแรก/);
        assert.match(R.nextHint(null), /ทำ Mock Exam เพื่อรับดาวแรก/);
    });
});

describe('ตารางอันดับ (หน้า Progress)', () => {
    test('โพเดียมเรียง 2 - 1 - 3 พร้อมมงกุฎอันดับ 1, รายการเริ่มที่อันดับ 4, ฉันถูกไฮไลต์, การ์ดของฉันบอกขาดอีกกี่ดาว', () => {
        const h = R.rankingBodyHtml({ available: true, total: 42, top: TOP, me: ME });
        const names = [...h.matchAll(/class="pod-name">([^<]+)/g)].map((m) => m[1].trim());
        assert.deepEqual(names, ['กัปตัน ก.', 'ฟ้าใส ส.', 'ไทเกอร์ ท.']);
        assert.match(h, /crown/);
        assert.match(h, /class="rank">1<\/span>/);
        assert.deepEqual([...h.matchAll(/class="lb-rank">(\d+)/g)].map((m) => m[1]), ['4', '5', '6', '7']);
        assert.match(h, /lb-row is-me[\s\S]*?พรีม พ\./);
        assert.match(h, /me-rank">#7/);
        assert.match(h, /ขาดอีก 4 ดาวขึ้นสู่อันดับ 6!/);
        assert.match(h, /ติดอันดับแล้ว 42 คน/);
        assert.match(h, /data-act="rank-anon" aria-pressed="false">ซ่อนชื่อของฉันจากคนอื่น/);
        assert.match(h, /<img[^>]*src="https:\/\/api\.test\/api\/avatar\/preset\/p01\.svg\?v=1"/);
    });
    test('ดาวเท่ากันอันดับเดียวกัน (แสดงเลขอันดับจริง ไม่ใช่ลำดับในรายการ)', () => {
        const top = [entry(1, 'ก', 10), entry(2, 'ข', 8), entry(2, 'ค', 8), entry(4, 'ง', 5)];
        const h = R.rankingBodyHtml({ available: true, total: 4, top, me: { rank: null, stars: 0, name: 'ฉัน', avatar: null, anonymous: false, toNext: null } });
        assert.deepEqual([...h.matchAll(/class="rank">(\d+)/g)].map((m) => m[1]), ['2', '1', '2']);
        assert.deepEqual([...h.matchAll(/class="lb-rank">(\d+)/g)].map((m) => m[1]), ['4']);
    });
    test('มีไม่ถึง 3 คน: ช่องที่ว่างเป็นตัวแทน ไม่ใช่ข้อมูลปลอม', () => {
        const h = R.rankingBodyHtml({ available: true, total: 1, top: [entry(1, 'คนเดียว ด.', 3)], me: { rank: null, stars: 0, name: 'ฉัน', avatar: null, anonymous: false, toNext: null } });
        assert.equal((h.match(/pod-col is-empty/g) || []).length, 2);
        assert.match(h, /คนเดียว ด\./);
        assert.doesNotMatch(h, /lb-list/);
    });
    test('ยังไม่มีใครติดอันดับ: ข้อความชวนทำ Mock และการ์ดของฉัน (—); ระบบยังไม่เปิด: ข้อความสั้น ๆ', () => {
        const h = R.rankingBodyHtml({ available: true, total: 0, top: [], me: { rank: null, stars: 0, name: 'ฉัน', avatar: null, anonymous: false, toNext: null } });
        assert.match(h, /ยังไม่มีใครติดอันดับ/);
        assert.match(h, /me-rank">—/);
        assert.doesNotMatch(h, /class="pod"/);
        assert.match(R.rankingBodyHtml({ available: false }), /ยังไม่เปิดใช้งาน/);
        assert.match(R.rankingBodyHtml(null), /ยังไม่เปิดใช้งาน/);
    });
    test('ซ่อนชื่อแล้ว: สวิตช์บอกว่าคนอื่นเห็นเป็นอะไรและกดเพื่อแสดงชื่อกลับ', () => {
        const h = R.rankingBodyHtml({ available: true, total: 7, top: TOP, me: { ...ME, anonymous: true } });
        assert.match(h, /aria-pressed="true">คนอื่นเห็นคุณเป็น “ผู้เรียนนิรนาม” • แตะเพื่อแสดงชื่อของฉัน/);
    });
    test('ชื่อ/ภาพจากข้อมูลถูก escape และที่อยู่ภาพที่ไม่ปลอดภัยไม่ถูกใช้', () => {
        const bad = [entry(1, '<img src=x onerror=alert(1)>', 5, { avatar: 'javascript:alert(1)' }), entry(2, 'ดี', 4, { avatar: 'data:image/svg+xml;base64,AAAA' }), entry(3, '"><script>', 3)];
        const h = R.rankingBodyHtml({ available: true, total: 3, top: bad, me: { ...ME, name: '<b>ฉัน</b>', avatar: 'http://x/"onerror="y' } });
        assert.doesNotMatch(h, /<img src=x|<script|<b>ฉัน<\/b>|javascript:|data:image/, 'ไม่มีแท็กหรือที่อยู่อันตรายหลุดออกมาเป็นของจริง');
        assert.match(h, /&lt;img src=x onerror=alert\(1\)&gt;/);
        assert.match(h, /src="assets\/avatar\.png"/);
    });
});

describe('โหลดตารางอันดับและสวิตช์ซ่อนชื่อ', () => {
    const host = () => ({ dataset: {}, innerHTML: '', onclick: null, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } });
    const scope = (h) => ({ querySelector: (sel) => (sel === '#lb-body' ? h : null) });

    test('เติมจากข้อมูลจริงครั้งเดียว (เรียกซ้ำไม่โหลดซ้ำ)', async () => {
        const h = host();
        let calls = 0;
        const api = { getRanking: async () => { calls++; return { available: true, total: 7, top: TOP, me: ME }; } };
        await R.hydrateRanking(scope(h), api);
        await R.hydrateRanking(scope(h), api);
        assert.equal(calls, 1);
        assert.match(h.innerHTML, /ขาดอีก 4 ดาว/);
        assert.equal(h.attrs['aria-busy'], undefined);
    });
    test('โหลดไม่ได้: ข้อความผิดพลาด ไม่ปล่อยอันดับตัวอย่างค้างไว้', async () => {
        const h = host();
        h.innerHTML = '<div>อันดับตัวอย่าง</div>';
        await R.hydrateRanking(scope(h), { getRanking: async () => { throw new Error('x'); } });
        assert.match(h.innerHTML, /โหลดตารางอันดับไม่สำเร็จ/);
        assert.doesNotMatch(h.innerHTML, /อันดับตัวอย่าง/);
    });
    test('กดสวิตช์: ส่งค่าตรงข้ามกับสถานะตอนนี้ แล้วโหลดใหม่; ไม่สำเร็จ = ปุ่มกลับมากดได้พร้อมข้อความ', async () => {
        const h = host();
        const sent = [];
        let anonymous = false;
        const api = {
            getRanking: async () => ({ available: true, total: 7, top: TOP, me: { ...ME, anonymous } }),
            setRankingAnonymous: async (v) => { sent.push(v); anonymous = v; },
        };
        await R.hydrateRanking(scope(h), api);
        const btn = (pressed) => ({ disabled: false, textContent: '', getAttribute: () => String(pressed) });
        const click = (b) => h.onclick({ target: { closest: (sel) => (sel === '[data-act="rank-anon"]' ? b : null) } });
        await click(btn(false));
        assert.deepEqual(sent, [true]);
        assert.match(h.innerHTML, /aria-pressed="true"/);
        await click(btn(true));
        assert.deepEqual(sent, [true, false]);
        assert.match(h.innerHTML, /aria-pressed="false"/);
        const failing = btn(false);
        api.setRankingAnonymous = async () => { throw new Error('x'); };
        await click(failing);
        assert.equal(failing.disabled, false);
        assert.match(failing.textContent, /บันทึกไม่สำเร็จ/);
        assert.equal(await h.onclick({ target: { closest: () => null } }), undefined, 'คลิกที่ไม่เกี่ยวข้องไม่ทำอะไร');
    });
    test('ไม่มีที่ให้ใส่ (#lb-body) = ไม่ทำอะไร', async () => {
        let calls = 0;
        await R.hydrateRanking({ querySelector: () => null }, { getRanking: async () => { calls++; } });
        assert.equal(calls, 0);
    });
});

describe('หน้า "เลื่อนอันดับ" หลังจบ Mock', () => {
    const MOVE = {
        before: { stars: 3, rank: 5 }, after: { stars: 14, rank: 2 }, me: { avatar: av(3) }, moved: 3, entered: false, total: 40,
        passed: [{ name: 'เอ ก.', avatar: av(1), stars: 9 }, { name: 'บี ข.', avatar: av(2), stars: 6 }, { name: '<i>ซี</i>', avatar: av(4), stars: 4 }],
    };
    test('โผล่เฉพาะอันดับขึ้นหรือเพิ่งติดอันดับ; ดาวเพิ่มแต่อันดับเท่าเดิม/ไม่มีข้อมูล = ไม่โผล่', () => {
        assert.equal(R.hasRankMove(MOVE), true);
        assert.equal(R.hasRankMove({ ...MOVE, moved: 0 }), false);
        assert.equal(R.hasRankMove({ ...MOVE, moved: null, entered: true, before: { stars: 0, rank: null } }), true);
        assert.equal(R.hasRankMove(null), false);
        assert.equal(R.hasRankMove({ entered: false, moved: 2 }), false, 'ไม่มี after');
    });
    test('บันไดอันดับ: คนที่แซงอยู่เหนือเรา (--y) แล้วลงไปหนึ่งช่อง (--y2) เราขึ้นไปบนสุด; เลขอันดับเริ่มจากอันดับเดิม; ข้อความ escape', () => {
        const h = R.rankStepHtml(MOVE);
        assert.match(h, /เลื่อนอันดับ!/);
        assert.match(h, /ขึ้น 3 อันดับ/);
        assert.match(h, /data-roll="5,2">5</);
        assert.match(h, /aria-label="อันดับ 2"/);
        assert.deepEqual([...h.matchAll(/rk-row is-other" style="--y:(\d);--y2:(\d)"/g)].map((m) => [m[1], m[2]]), [['0', '1'], ['1', '2'], ['2', '3']]);
        assert.match(h, /rk-row is-me" style="--y:3;--y2:0"/);
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
