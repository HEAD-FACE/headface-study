// ทดสอบตัวตนบนแถบหัว (js/study-identity.js): แพลน → วงแหวน/ป้าย, รูปจริงจากเซิร์ฟเวอร์, ไม่มีรูปสมมติ
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const I = await import('../js/study-identity.js');

const SERVER = (plan = 'plus', url = 'https://api.example.test/api/avatar/preset/p03.svg?v=1') => ({ success: true, plan: { id: plan, display_name: plan.toUpperCase() }, avatar: { kind: 'preset', url } });

function fakeRoot() {
    const mk = () => { const attrs = {}; const ls = {}; return { dataset: {}, hidden: true, textContent: '', classList: { remove(c) { this.removed = (this.removed || []).concat(c); } }, getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; }, addEventListener: (t, f) => { ls[t] = f; }, ls }; };
    const ring = mk(), img = mk(), chip = mk();
    return { ring, img, chip, root: { querySelectorAll: (sel) => ({ '[data-hf-ring]': [ring], 'img[data-hf-avatar]': [img], '[data-hf-plan-chip]': [chip] }[sel] || []) } };
}

describe('แพลน', () => {
    test('รู้จักเฉพาะ free/plus/max (อย่างอื่น = free ไม่มีวงแหวน)', () => {
        assert.equal(I.planTierOf({ plan: { id: 'PLUS' } }), 'plus');
        assert.equal(I.planTierOf({ plan: { id: 'max' } }), 'max');
        assert.equal(I.planTierOf({ plan: { id: 'gold' } }), 'free');
        assert.equal(I.planTierOf(null), 'free');
        assert.equal(I.planLabelOf({ plan: { id: 'max' } }), 'MAX');
        assert.equal(I.planLabelOf({ plan: { id: 'free' } }), '');
    });
});

describe('normalizeIdentity', () => {
    test('รับคำตอบที่ถูกต้อง', () => {
        const id = I.normalizeIdentity(SERVER());
        assert.equal(id.plan.id, 'plus');
        assert.match(id.avatar.url, /^https:\/\//);
    });
    test('ปฏิเสธรูปที่ไม่ใช่ https (กัน javascript:/data:/http ภายนอก) และข้อมูลไม่ครบ', () => {
        assert.equal(I.normalizeIdentity(SERVER('free', 'javascript:alert(1)')), null);
        assert.equal(I.normalizeIdentity(SERVER('free', 'http://evil.example/a.svg')), null);
        assert.equal(I.normalizeIdentity(SERVER('free', 'data:image/svg+xml,<svg/>')), null);
        assert.equal(I.normalizeIdentity({ plan: {} }), null);
        assert.equal(I.normalizeIdentity(null), null);
    });
    test('อนุญาต http เฉพาะ localhost (เครื่องนักพัฒนา)', () => {
        assert.ok(I.normalizeIdentity(SERVER('free', 'http://localhost:8787/api/avatar/preset/p01.svg')));
    });
});

describe('applyIdentity', () => {
    test('PLUS: ตั้งวงแหวน แสดงป้าย ใส่รูปจริง', () => {
        const { ring, img, chip, root } = fakeRoot();
        I.applyIdentity(I.normalizeIdentity(SERVER('plus')), root);
        assert.equal(ring.dataset.plan, 'plus');
        assert.equal(chip.hidden, false);
        assert.equal(chip.textContent, 'PLUS');
        assert.equal(img.getAttribute('src'), 'https://api.example.test/api/avatar/preset/p03.svg?v=1');
    });
    test('FREE: ไม่มีป้าย (วงแหวน data-plan=free ไม่มีสไตล์)', () => {
        const { ring, chip, root } = fakeRoot();
        I.applyIdentity(I.normalizeIdentity(SERVER('free')), root);
        assert.equal(ring.dataset.plan, 'free');
        assert.equal(chip.hidden, true);
        assert.equal(chip.textContent, '');
    });
    test('รูปที่โหลดไม่ได้ → ภาพเงากลาง ๆ และเลิกเป็น skeleton', () => {
        const { img, root } = fakeRoot();
        I.applyIdentity(I.normalizeIdentity(SERVER()), root);
        img.ls.error();
        assert.equal(img.getAttribute('src'), I.NEUTRAL_AVATAR);
        assert.ok(img.classList.removed.includes('skl'));
    });
});

describe('fetchIdentity', () => {
    test('เรียก /api/profile/identity และคืนค่าที่ผ่านตรวจ', async () => {
        let called = '';
        const id = await I.fetchIdentity(async (u) => { called = u; return { ok: true, json: async () => SERVER('max') }; });
        assert.equal(called, '/api/profile/identity');
        assert.equal(id.plan.id, 'max');
    });
    test('ผิดพลาด/ไม่ ok/โยน error = null (ไม่โยนต่อ)', async () => {
        assert.equal(await I.fetchIdentity(async () => ({ ok: false })), null);
        assert.equal(await I.fetchIdentity(async () => { throw new Error('net'); }), null);
    });
});

describe('หน้าเว็บ', () => {
    const pages = ['index', 'subject', 'progress', 'course'];
    for (const p of pages) {
        test(`${p}.html มีวงแหวน รูปจริง (ไม่ฝังรูปสมมติ) ป้ายแพลน และโหลดสคริปต์`, () => {
            const h = readFileSync(new URL(`../${p}.html`, import.meta.url), 'utf8');
            assert.match(h, /<span class="hf-ring-host" data-hf-ring[^>]*><img id="headerAvatar" data-hf-avatar class="skl"/);
            assert.match(h, /data-hf-plan-chip/);
            assert.match(h, /css\/identity\.css/);
            assert.match(h, /js\/study-identity-boot\.js/);
            assert.doesNotMatch(h, /dicebear/i);
        });
    }
    test('main.js ไม่ใช้รูปสุ่ม DiceBear แล้ว', () => {
        assert.doesNotMatch(readFileSync(new URL('../js/main.js', import.meta.url), 'utf8'), /dicebear/i);
    });
});
