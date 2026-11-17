// ธีมรางวัลของ HEADFACE บน Study: css/skins.css (สร้างจาก scripts/gen-skins-css.mjs), js/theme.js (ใส่ธีมก่อนวาดหน้า จากคุกกี้),
// js/study-identity.js (ยืนยันกับเซิร์ฟเวอร์) — ไม่มีธีม = หน้าตาปกติของ Study ทุกจุด
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { generateSkinsCss, isBrand, mapBrand, SEMANTIC } from '../scripts/gen-skins-css.mjs';
import { THEMES, contrast, rgbToHex } from '../scripts/skin-themes.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const css = read('css/skins.css');
const KEYS = ['ocean', 'aurora', 'gold', 'neon'];
const PAGES = ['index.html', 'subject.html', 'progress.html', 'course.html', 'lesson.html', 'mock-exam.html', 'report.html', 'tutor.html'];
const I = await import('../js/study-identity.js');

/** รัน js/theme.js ใน sandbox ที่จำลองเบราว์เซอร์ */
function loadTheme({ cookie = '', host = 'study.headface.app', protocol = 'https:', dark = false } = {}) {
    const attrs = {};
    const cookies = new Map();
    for (const part of cookie.split(';').map((x) => x.trim()).filter(Boolean)) { const i = part.indexOf('='); cookies.set(part.slice(0, i), part.slice(i + 1)); }
    const written = [];
    const meta = { content: '#10B981', setAttribute(k, v) { this.content = v; } };
    const listeners = { doc: {}, win: {} };
    const document = {
        readyState: 'complete',
        visibilityState: 'visible',
        documentElement: { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; } },
        get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join('; '); },
        set cookie(value) {
            written.push(value);
            const [pair, ...rest] = value.split(';').map((x) => x.trim());
            const i = pair.indexOf('=');
            if (rest.some((r) => r === 'Max-Age=0')) cookies.delete(pair.slice(0, i)); else cookies.set(pair.slice(0, i), pair.slice(i + 1));
        },
        querySelector: (sel) => (sel.startsWith('meta') ? meta : null),
        querySelectorAll: () => [],
        addEventListener: (type, fn) => { (listeners.doc[type] ||= []).push(fn); }
    };
    const window = {
        matchMedia: () => ({ matches: dark, addEventListener() {} }),
        addEventListener: (type, fn) => { (listeners.win[type] ||= []).push(fn); },
        dispatchEvent() {},
        CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
    };
    const ctx = {
        window, document, location: { hostname: host, protocol },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        CustomEvent: window.CustomEvent, decodeURIComponent, RegExp, Date, Number, Math, Object
    };
    vm.runInNewContext(read('js/theme.js'), ctx);
    return { attrs, cookies, written, meta, listeners, HFTheme: window.HFTheme };
}

describe('css/skins.css', () => {
    test('ตรงกับที่สร้างได้ตอนนี้ (แก้ CSS หรือสคริปต์แล้วต้องรัน gen-dark-css.mjs ตามด้วย gen-skins-css.mjs)', () => {
        assert.equal(css, generateSkinsCss());
    });

    test('ทุกกฎใช้เฉพาะเมื่อใส่ธีม: ไม่มี attribute = ไม่มีอะไรเปลี่ยน', () => {
        const noBlocks = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@keyframes [\w-]+ \{(?:[^{}]|\{[^{}]*\})*\}/g, '');
        const selectors = [...noBlocks.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2].trim()).filter(Boolean);
        assert.ok(selectors.length > 150, `มีกฎจริง (${selectors.length})`);
        for (const list of selectors) {
            for (const sel of list.split(/,\s*\n?/).map((s) => s.trim()).filter(Boolean)) {
                assert.match(sel, /^(:where\(html\[data-hf-skin\](\[data-theme="dark"\])?\)|html\[data-hf-skin(="(ocean|aurora|gold|neon)")?\])/, `ต้องขึ้นต้นด้วยเงื่อนไขธีม: ${sel.slice(0, 90)}`);
            }
        }
    });

    test('สามธีม: ตัวแปร --sk-* ครบ และสีเขียวทุกสีที่ถูกแทนมีค่าในทุกธีม', () => {
        const used = new Set([...css.matchAll(/var\(--k-([0-9a-f]{6})\)/g)].map((m) => m[1]));
        assert.ok(used.size >= 20, `สีเขียวของแบรนด์ที่ถูกแทน (${used.size})`);
        for (const key of KEYS) {
            const block = new RegExp(`html\\[data-hf-skin="${key}"\\] \\{([^}]*)\\}`).exec(css);
            assert.ok(block, `${key}: มีบล็อกสี`);
            for (const v of ['--sk-50', '--sk-600', '--sk-700', '--sk-rgb', '--sk-page', '--sk-band', '--sk-band-dark', '--sk-base', '--sk-d-bg', '--sk-lx-accent', '--sk-text-dark']) assert.ok(block[1].includes(`${v}:`), `${key}: ${v}`);
            for (const name of used) assert.match(block[1], new RegExp(`--k-${name}: \\d+ \\d+ \\d+;`), `${key}: --k-${name}`);
        }
    });

    test('สีของธีมเป็นชุดเดียวกับเว็บหลัก (ถ้ามี repo headface อยู่ข้าง ๆ)', (t) => {
        const main = path.join(root, '..', 'headface', 'css', 'skins.css');
        if (!fs.existsSync(main)) { t.skip('ไม่มี repo headface'); return; }
        const mainCss = fs.readFileSync(main, 'utf8').replace(/\r\n/g, '\n');
        for (const key of KEYS) {
            const a = new RegExp(`html\\[data-hf-skin="${key}"\\] \\{([^}]*)\\}`).exec(css)[1];
            const b = new RegExp(`:root\\[data-hf-skin="${key}"\\], \\[data-hf-skin-preview="${key}"\\] \\{([^}]*)\\}`).exec(mainCss)[1];
            const vars = (text) => Object.fromEntries([...text.matchAll(/(--sk-[\w-]+): ([^;]*);/g)].filter((m) => !/^--sk-(mini|mini-dark)$/.test(m[1])).map((m) => [m[1], m[2]]));
            const mine = vars(a);
            const theirs = vars(b);
            for (const [name, value] of Object.entries(theirs)) assert.equal(mine[name], value, `${key}: ${name} ต้องตรงกับเว็บหลัก`);
        }
    });

    test('เขียวที่มีความหมาย (ตอบถูก ผ่าน ระดับง่าย สีประจำวิชา) ไม่ถูกเปลี่ยนสี', () => {
        for (const sel of ['.choice.is-ok', '.fb.ok', '.mini.ok', '.pill.ok', '.rv-row.ok', '.choice.is-miss .choice-m', '.od-key', '.fl-key', '.nm-key', '.btn.btn-ok', '.hue-emerald', '.tile-teal', '.lvl-ง่าย', '.delta.up', '.tcard.strong', '.tf-t.is-sel', '.passed-now']) {
            assert.match(sel, SEMANTIC, `${sel} ต้องอยู่ในรายการที่คงสีเดิม`);
        }
        for (const sel of ['.btn', '.nav-i.on', '.me', '.sec-link', '.unit-badge.done', '.st-done', '.tt-b.tt-mic', '.okay', '.is-okay', '.monkey']) {
            assert.doesNotMatch(sel, SEMANTIC, `${sel} เป็นสีของแบรนด์ ต้องเปลี่ยนตามธีม`);
        }
        const rules = css.slice(css.indexOf('4. สีเขียวของแบรนด์'));
        for (const frag of ['.is-ok', '.fb.ok', '.hue-', '.tile-', '.btn-ok', '.lvl-']) assert.ok(!rules.includes(`) ${frag}`) && !new RegExp(`\\) [^{\\n]*${frag.replace(/[.]/g, '\\.')}[^{\\n]*\\{`).test(rules), `ไม่มีกฎธีมของ ${frag}`);
        // สีของแบรนด์จริง ๆ ถูกแทน
        assert.match(rules, /:where\(html\[data-hf-skin\]\) \.btn \{ background: rgb\(var\(--k-047857\)\);/);
        assert.match(rules, /:where\(html\[data-hf-skin\]\[data-theme="dark"\]\) /);
    });

    test('เฉดที่นับเป็นสีแบรนด์: มิ้นต์/มรกต ใช่ — เขียว "ถูกต้อง" ฟ้า เทา แดง ไม่ใช่', () => {
        for (const t of ['#10B981', '#047857', '#ECFDF5', 'rgba(2, 44, 34, .45)', '#34D399', '#065F46']) assert.equal(isBrand(t), true, t);
        for (const t of ['#22C55E', '#16A34A', '#0EA5E9', '#475569', '#EF4444', '#FFFFFF', '#F59E0B']) assert.equal(isBrand(t), false, t);
    });

    test('การแทนสี: ขั้นเดียวกันบนไล่สีของธีม และตัวอักษรยังอ่านออก (>= 4.5:1) ทุกธีม', () => {
        const hex = (rgb) => rgbToHex(rgb);
        const g = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        for (const key of KEYS) {
            assert.equal(hex(mapBrand(g('#047857'), key)), THEMES[key].ramp[700], `${key}: เขียว 700 → สีหลัก 700`);
            assert.equal(hex(mapBrand(g('#059669'), key)), THEMES[key].ramp[600], `${key}: เขียว 600 → 600`);
            assert.equal(hex(mapBrand(g('#ECFDF5'), key)), THEMES[key].ramp[50], `${key}: เขียว 50 → 50`);
            // ปุ่มหลัก: ตัวขาวบนพื้น 700; ลิงก์/ตัวเลข: 700 บนขาวและบนพื้นอ่อน 50; ป้าย: 800 บน 50
            assert.ok(contrast('#ffffff', hex(mapBrand(g('#047857'), key))) >= 4.5, `${key}: ขาวบนปุ่มหลัก`);
            assert.ok(contrast(hex(mapBrand(g('#047857'), key)), '#ffffff') >= 4.5, `${key}: ตัวอักษรสีหลักบนขาว`);
            assert.ok(contrast(hex(mapBrand(g('#047857'), key)), hex(mapBrand(g('#ECFDF5'), key))) >= 4.5, `${key}: สีหลักบนพื้นอ่อน`);
            assert.ok(contrast(hex(mapBrand(g('#065F46'), key)), hex(mapBrand(g('#D1FAE5'), key))) >= 4.5, `${key}: ป้าย 800 บน 100`);
            // ธีมมืด: ตัวอักษรเขียวอ่อนบนพื้นมืดของการ์ด
            assert.ok(contrast(hex(mapBrand(g('#6EE7B7'), key)), '#1A2332') >= 4.5, `${key}: ตัวอักษรอ่อนบนการ์ดมืด`);
        }
    });

    test('ลายของหัวหน้าเว็บวาดได้ถูก: ขนาดคงที่เป็น px ไม่มี blur / blend และหยุดเมื่อผู้ใช้ขอลดการเคลื่อนไหว', () => {
        assert.doesNotMatch(css, /mix-blend-mode|feGaussianBlur|backdrop-filter/, 'ไม่มีฟิลเตอร์หรือ blend ในลายของธีม');
        const layers = new Map(); // ตัวเลือก → declaration ทั้งหมดของชั้นนั้น (เขียนแยกเป็นสองกฎ: ขนาด และลาย)
        for (const m of css.matchAll(/^(html\[data-hf-skin="(?:aurora|gold|neon)"\] #mainBlueBg::(?:before|after)) \{([^}]*)\}/gm)) layers.set(m[1], (layers.get(m[1]) || '') + m[2]);
        assert.equal(layers.size, 6, 'หกชั้นที่เคลื่อนไหว (แสงเหนือ ราตรีทองคำ นีออนซิตี้ ธีมละสองชั้น)');
        for (const [sel, body] of layers) {
            assert.match(body, /height: \d+px;/, `${sel}: สูงคงที่เป็น px (หัวยืดหดได้โดยไม่ต้องวาดใหม่)`);
            assert.ok(!(/top: 0/.test(body) && /bottom: 0/.test(body)) && !/inset:/.test(body), `${sel}: ไม่ยืดตามความสูงของหัว`);
        }
        const frames = [...css.matchAll(/@keyframes hf-sk-[\w-]+ \{([\s\S]*?)\}\n/g)].map((m) => m[1]);
        assert.equal(frames.length, 6);
        for (const body of frames) for (const [, prop] of body.matchAll(/([a-z-]+):/g)) assert.ok(prop === 'transform' || prop === 'opacity', `เคลื่อนไหวเฉพาะ transform / opacity (${prop})`);
        assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*animation: none;/);
        assert.ok(css.includes('html[data-hf-skin] #mainBlueBg, html[data-hf-skin] .header-bg-shell { background: var(--sk-band); }'));
        assert.ok(css.includes('html[data-hf-skin][data-theme="dark"] #mainBlueBg, html[data-hf-skin][data-theme="dark"] .header-bg-shell { background: var(--sk-band-dark); }'));
    });

    test('ทุกหน้าโหลด css/skins.css หลัง dark.css', () => {
        for (const page of PAGES) {
            const html = read(page);
            const head = html.slice(0, html.indexOf('</head>'));
            assert.ok(head.indexOf('href="css/dark.css"') > 0 && head.indexOf('href="css/dark.css"') < head.indexOf('href="css/skins.css"'), page);
        }
    });
});

describe('js/theme.js: ธีมรางวัลก่อนวาดหน้า', () => {
    const later = Date.now() + 86400000;

    test('ไม่มีคุกกี้ = หน้าตาปกติ (ไม่มี data-hf-skin, สีแถบสถานะเดิม)', () => {
        const t = loadTheme();
        assert.equal(t.attrs['data-hf-skin'], undefined);
        assert.equal(t.meta.content, '#10B981');
        assert.equal(t.HFTheme.getSkin(), '');
    });

    test('คุกกี้ของเว็บหลัก → ใส่ธีมก่อนวาด และสีแถบสถานะเป็นสีหัวของธีม', () => {
        const t = loadTheme({ cookie: `hf_skin=gold.${later}` });
        assert.equal(t.attrs['data-hf-skin'], 'gold');
        assert.equal(t.meta.content, '#101221');
        assert.equal(loadTheme({ cookie: 'hf_skin=ocean.0' }).attrs['data-hf-skin'], 'ocean');
    });

    test('ธีมของ PLUS/MAX ไม่ถูกวาดหลังแพลนหมดอายุ และชื่อธีมที่ไม่รู้จักถูกเมิน', () => {
        assert.equal(loadTheme({ cookie: `hf_skin=gold.${Date.now() - 1000}` }).attrs['data-hf-skin'], undefined);
        assert.equal(loadTheme({ cookie: 'hf_skin=lava.0' }).attrs['data-hf-skin'], undefined);
        assert.equal(loadTheme({ cookie: 'hf_skin=%3Cscript%3E.0' }).attrs['data-hf-skin'], undefined);
    });

    test('production กับ preview ใช้คุกกี้คนละชื่อ (ธีมของบัญชีทดสอบไม่ไหลไปหน้าจริง)', () => {
        assert.equal(loadTheme({ cookie: 'hf_skin_beta=aurora.0', host: 'study.headface.app' }).attrs['data-hf-skin'], undefined);
        assert.equal(loadTheme({ cookie: 'hf_skin_beta=aurora.0', host: 'beta-study.headface.app' }).attrs['data-hf-skin'], 'aurora');
        assert.equal(loadTheme({ cookie: 'hf_skin=aurora.0', host: 'beta-study.headface.app' }).attrs['data-hf-skin'], undefined);
        assert.equal(loadTheme({ cookie: 'hf_skin_beta=aurora.0', host: 'localhost', protocol: 'http:' }).attrs['data-hf-skin'], 'aurora');
    });

    test('setSkin: วาดทันที จำไว้ในคุกกี้ของโดเมนแม่ และถอดได้', () => {
        const t = loadTheme();
        assert.equal(t.HFTheme.setSkin('aurora', later), 'aurora');
        assert.equal(t.attrs['data-hf-skin'], 'aurora');
        assert.equal(t.meta.content, '#1f1050');
        assert.match(t.written.at(-1), new RegExp(`^hf_skin=aurora\\.${later}; Path=/; Domain=\\.headface\\.app; SameSite=Lax; Secure; Max-Age=31536000$`));
        assert.equal(t.HFTheme.setSkin('', 0), '');
        assert.equal(t.attrs['data-hf-skin'], undefined);
        assert.equal(t.meta.content, '#10B981');
        assert.match(t.written.at(-1), /^hf_skin=; Path=\/; Domain=\.headface\.app; SameSite=Lax; Secure; Max-Age=0$/);
        assert.equal(t.cookies.has('hf_skin'), false);
        // แพลนหมดแล้ว หรือชื่อที่ไม่รู้จัก = ไม่ใส่
        assert.equal(t.HFTheme.setSkin('gold', Date.now() - 1), '');
        assert.equal(t.HFTheme.setSkin('lava', 0), '');
        assert.equal(t.attrs['data-hf-skin'], undefined);
    });

    test('ธีมสว่าง/มืดยังทำงานเหมือนเดิมเมื่อใส่ธีมรางวัล', () => {
        const t = loadTheme({ cookie: 'hf_skin=ocean.0; hf_theme=dark' });
        assert.equal(t.attrs['data-theme'], 'dark');
        assert.equal(t.attrs['data-hf-skin'], 'ocean');
        assert.equal(t.meta.content, '#0b7f95');
        t.HFTheme.setMode('light');
        assert.equal(t.attrs['data-theme'], 'light');
        assert.equal(t.attrs['data-hf-skin'], 'ocean');
    });
});

describe('js/study-identity.js: ธีมจากเซิร์ฟเวอร์', () => {
    const SERVER = (plan, theme, expires) => ({ success: true, plan: { id: plan, display_name: plan.toUpperCase(), expires_at: expires ?? null }, avatar: { kind: 'preset', url: 'https://api.example.test/a.svg' }, ...(theme === undefined ? {} : { theme }) });
    const later = Date.now() + 86400000;

    test('เก็บเฉพาะชื่อธีมที่รู้จัก; เซิร์ฟเวอร์รุ่นเก่า (ไม่มี theme) ไม่แตะธีมของหน้า', () => {
        assert.deepEqual(I.normalizeIdentity(SERVER('max', { key: 'gold', kind: 'theme', name: 'x' }, later)).theme, { key: 'gold' });
        assert.equal(I.normalizeIdentity(SERVER('max', { key: 'lava' }, later)).theme, null);
        assert.equal(I.normalizeIdentity(SERVER('free', null)).theme, null);
        assert.equal('theme' in I.normalizeIdentity(SERVER('free', undefined)), false);
        let called = 0;
        assert.equal(I.applySkin(I.normalizeIdentity(SERVER('free', undefined)), { setSkin: () => { called += 1; } }), null);
        assert.equal(called, 0);
    });

    test('ธีมของแพลน: ต้องมีแพลนถึงและยังไม่หมดอายุ (PLUS ใส่แสงเหนือได้ ใส่ราตรีทองคำไม่ได้)', () => {
        const id = (plan, key, ends) => I.normalizeIdentity(SERVER(plan, { key }, ends));
        assert.equal(I.skinOf(id('max', 'gold', later)), 'gold');
        assert.equal(I.skinOf(id('max', 'aurora', later)), 'aurora');
        assert.equal(I.skinOf(id('plus', 'aurora', later)), 'aurora');
        assert.equal(I.skinOf(id('plus', 'gold', later)), '');
        assert.equal(I.skinOf(id('free', 'aurora', null)), '');
        assert.equal(I.skinOf(id('max', 'gold', later), later), '', 'ถึงเวลาหมดอายุพอดี = หมด');
        assert.equal(I.skinOf(id('free', 'ocean', null)), 'ocean', 'ธีมรางวัลทั่วไปไม่ผูกกับแพลน');
        assert.deepEqual(I.SKIN_PLANS, { aurora: 'plus', gold: 'max' });
    });

    test('applySkin ส่งธีมและเวลาหมดแพลนให้ js/theme.js; ไม่ใส่ธีม = ถอด', () => {
        const calls = [];
        const theme = { setSkin: (key, ends) => { calls.push([key, ends]); return key; } };
        I.applySkin(I.normalizeIdentity(SERVER('max', { key: 'gold' }, later)), theme);
        I.applySkin(I.normalizeIdentity(SERVER('free', { key: 'ocean' }, null)), theme);
        I.applySkin(I.normalizeIdentity(SERVER('free', null)), theme);
        I.applySkin(I.normalizeIdentity(SERVER('free', { key: 'gold' }, null)), theme);
        assert.deepEqual(calls, [['gold', later], ['ocean', 0], ['', 0], ['', 0]]);
    });

    test('ชื่อธีมตรงกันทุกที่ (theme.js, study-identity.js, skins.css)', () => {
        const themeJs = read('js/theme.js');
        const keys = [.../var SKINS = \{([^}]*)\}/.exec(themeJs)[1].matchAll(/(\w+):/g)].map((m) => m[1]);
        assert.deepEqual(keys, KEYS);
        assert.deepEqual(I.SKIN_KEYS, KEYS);
        assert.deepEqual(Object.keys(THEMES), KEYS);
        for (const key of KEYS) assert.ok(themeJs.includes(`${key}: "${THEMES[key].meta}"`), `${key}: สีแถบสถานะตรงกับธีม`);
    });
});
