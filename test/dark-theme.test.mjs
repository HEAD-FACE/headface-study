// ธีมมืด + หน้าต่างตั้งค่า (js/theme.js, js/study-settings.js, css/dark.css ที่สร้างจาก scripts/gen-dark-css.mjs)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { generateDarkCss, mapColor, SOURCES } from '../scripts/gen-dark-css.mjs';
import { renderSettings } from '../js/study-settings.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const norm = (s) => s.replace(/\r\n/g, '\n');

const PAGES = ['index.html', 'subject.html', 'progress.html', 'course.html', 'lesson.html', 'mock-exam.html', 'report.html', 'tutor.html'];
const SETTINGS_PAGES = ['index.html', 'subject.html', 'progress.html', 'course.html'];

/** รัน js/theme.js ใน sandbox ที่จำลองเบราว์เซอร์ (คุกกี้ localStorage matchMedia ฯลฯ) */
function loadTheme({ cookie = '', stored = null, dark = false, host = 'study.headface.app', protocol = 'https:' } = {}) {
    const store = new Map(stored ? [['hf_theme', stored]] : []);
    const attrs = {};
    const cookies = new Map();
    for (const part of cookie.split(';').map((x) => x.trim()).filter(Boolean)) { const [k, v] = part.split('='); cookies.set(k, v); }
    const written = [];
    const listeners = { doc: {}, win: {} };
    const meta = { content: '#10B981', setAttribute(k, v) { this.content = v; } };
    const buttons = ['system', 'light', 'dark'].map((m) => ({ m, checked: null, getAttribute: () => m, setAttribute(k, v) { this.checked = v; } }));
    const document = {
        readyState: 'complete',
        visibilityState: 'visible',
        documentElement: { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; } },
        get cookie() { return [...cookies].map(([k, v]) => `${k}=${v}`).join('; '); },
        set cookie(value) {
            written.push(value);
            const [pair, ...rest] = value.split(';').map((x) => x.trim());
            const [k, v] = pair.split('=');
            if (rest.some((r) => r === 'Max-Age=0')) cookies.delete(k); else cookies.set(k, v);
        },
        querySelector: (sel) => (sel.startsWith('meta') ? meta : null),
        querySelectorAll: () => buttons,
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
        localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
        CustomEvent: window.CustomEvent, decodeURIComponent
    };
    window.localStorage = ctx.localStorage;
    vm.runInNewContext(read('js/theme.js'), ctx);
    return { window, attrs, store, cookies, written, meta, buttons, listeners, HFTheme: window.HFTheme };
}

describe('js/theme.js', () => {
    test('ไม่เคยเลือก = ตามเครื่อง: เครื่องสว่าง → light, เครื่องมืด → dark', () => {
        const light = loadTheme({ dark: false });
        assert.equal(light.attrs['data-theme'], 'light');
        assert.equal(light.attrs['data-theme-mode'], 'system');
        const dark = loadTheme({ dark: true });
        assert.equal(dark.attrs['data-theme'], 'dark');
        assert.equal(dark.attrs['data-theme-mode'], 'system');
    });

    test('ใช้ค่าเดียวกับเว็บหลัก: localStorage "hf_theme" = dark / light', () => {
        assert.equal(loadTheme({ stored: 'dark' }).attrs['data-theme'], 'dark');
        assert.equal(loadTheme({ stored: 'light', dark: true }).attrs['data-theme'], 'light');
    });

    test('คุกกี้ hf_theme (ใช้ร่วมกันข้ามโดเมนย่อย) ชนะ localStorage; ค่าแปลก ๆ ถูกทิ้ง', () => {
        assert.equal(loadTheme({ cookie: 'hf_theme=dark', stored: 'light' }).attrs['data-theme'], 'dark');
        assert.equal(loadTheme({ cookie: 'hf_theme=light', stored: 'dark', dark: true }).attrs['data-theme'], 'light');
        assert.equal(loadTheme({ cookie: 'hf_theme=<script>', dark: false }).attrs['data-theme'], 'light');
    });

    test('เลือก "มืด": เขียนทั้ง localStorage และคุกกี้ของโดเมนแม่ .headface.app (Secure, SameSite=Lax) แล้วเปลี่ยนธีมทันที', () => {
        const t = loadTheme({ dark: false });
        t.HFTheme.setMode('dark');
        assert.equal(t.attrs['data-theme'], 'dark');
        assert.equal(t.attrs['data-theme-mode'], 'dark');
        assert.equal(t.store.get('hf_theme'), 'dark');
        const c = t.written.at(-1);
        assert.match(c, /^hf_theme=dark; Path=\/; Domain=\.headface\.app; SameSite=Lax; Secure; Max-Age=31536000$/);
        assert.equal(t.meta.content, '#064E3B', 'แถบสถานะของเบราว์เซอร์เปลี่ยนตามธีม');
    });

    test('เลือก "ตามเครื่อง": ลบทั้งคุกกี้และ localStorage', () => {
        const t = loadTheme({ cookie: 'hf_theme=dark', stored: 'dark', dark: false });
        t.HFTheme.setMode('system');
        assert.equal(t.store.has('hf_theme'), false);
        assert.equal(t.cookies.has('hf_theme'), false);
        assert.equal(t.attrs['data-theme'], 'light');
        assert.match(t.written.at(-1), /Max-Age=0/);
    });

    test('คุกกี้ไม่ใส่ Domain บน localhost (ไม่งั้นเบราว์เซอร์ทิ้งคุกกี้) และไม่ Secure บน http', () => {
        const t = loadTheme({ host: 'localhost', protocol: 'http:' });
        t.HFTheme.setMode('light');
        assert.doesNotMatch(t.written.at(-1), /Domain=|Secure/);
    });

    test('คุกกี้เก็บแค่คำว่า light/dark ไม่มีข้อมูลส่วนตัว และปุ่มตัวเลือกบอกสถานะ aria-checked ถูก', () => {
        const t = loadTheme({ stored: 'dark' });
        t.HFTheme.refreshControls();
        assert.deepEqual(t.buttons.map((b) => b.checked), ['false', 'false', 'true']);
        t.HFTheme.setMode('light');
        assert.equal(t.cookies.get('hf_theme'), 'light');
        assert.equal(t.HFTheme.setMode('nonsense'), 'light', 'ค่าที่ไม่รู้จักไม่เปลี่ยนอะไร');
    });
});

describe('css/dark.css', () => {
    test('ตรงกับที่ scripts/gen-dark-css.mjs สร้างได้ตอนนี้ (แก้ CSS สว่างแล้วต้องรัน node scripts/gen-dark-css.mjs)', () => {
        assert.equal(norm(read('css/dark.css')), norm(generateDarkCss(root)));
    });

    test('ทุกกฎขึ้นต้นด้วย :where(html[data-theme="dark"]) หรือ html[data-theme="dark"] — ตอนสว่างไม่มีอะไรเปลี่ยน', () => {
        const css = read('css/dark.css').replace(/\/\*[\s\S]*?\*\//g, '');
        const selectors = css.split('{').slice(0, -1).map((x) => x.split('}').pop().trim()).filter((x) => x && !x.startsWith('@') && !/^\d+%$/.test(x));
        assert.ok(selectors.length > 300, 'ต้องมีกฎจำนวนมาก');
        for (const sel of selectors) for (const part of sel.split(',')) assert.match(part.trim(), /^(:where\(html\[data-theme="dark"\]\)|html\[data-theme="dark"\])/, part);
    });

    test('ครอบคลุมทุกไฟล์ CSS ของ Study (ยกเว้น dark.css เอง) — เพิ่มไฟล์ใหม่ต้องใส่ใน SOURCES', () => {
        const all = fs.readdirSync(path.join(root, 'css')).filter((f) => f.endsWith('.css') && f !== 'dark.css').sort();
        assert.deepEqual([...SOURCES].sort(), all);
    });

    test('การแปลงสี: พื้นสว่างกลายเป็นมืด ตัวอักษรเข้มกลายเป็นสว่าง สีเด่นกลาง ๆ ไม่ถูกแตะ', () => {
        const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
        assert.ok(lum(mapColor('#FFFFFF', 'bg')) < 0.2);
        assert.ok(lum(mapColor('#ECFDF5', 'bg')) < 0.25, 'พื้นสีพาสเทลก็มืด');
        assert.equal(mapColor('#EEF4F8', 'bg'), '#0B1220', 'พื้นหน้าเว็บ');
        assert.ok(lum(mapColor('#0F172A', 'text')) > 0.85);
        assert.ok(lum(mapColor('#047857', 'text')) > 0.55, 'ตัวอักษรเขียวเข้มต้องสว่างพอบนพื้นมืด');
        assert.equal(mapColor('#FFFFFF', 'text'), '#FFFFFF', 'ตัวขาวบนพื้นสีคงเดิม');
        assert.equal(mapColor('#10B981', 'bg'), '#10B981', 'สีเด่นกลาง ๆ คงเดิม');
        assert.equal(mapColor('#F43F5E', 'border'), '#F43F5E');
        assert.ok(lum(mapColor('#E2E8F0', 'border')) < 0.3);
        assert.equal(mapColor('rgba(255, 255, 255, .5)', 'bg'), 'rgba(255, 255, 255, .5)', 'ฟิล์มขาวโปร่งแสงคงเดิม');
        assert.match(mapColor('rgba(255, 255, 255, .97)', 'bg'), /^rgba\(\d+, \d+, \d+, 0\.97\)$/);
        assert.ok(parseInt(mapColor('rgba(255, 255, 255, .97)', 'bg').match(/\d+/)[0], 10) < 60, 'แถบล่างขาวเกือบทึบกลายเป็นมืด');
    });

    test('สีสำรองใน var(--x, #hex) ไม่ถูกแปลง (ตัวแปรถูกตั้งไว้เสมอ)', () => {
        const css = read('css/dark.css');
        assert.doesNotMatch(css, /var\(--chip, #1C/);
        assert.doesNotMatch(css, /var\(--bd, #[0-9A-F]{6}\)/, 'สีสำรองของ --bd คงเป็นสีสว่างเดิมจากไฟล์ต้นทาง ไม่ใช่สีมืด');
    });

    test('แต่ละ hue มีสีตัวอักษรรุ่นสว่าง (--strong-t) ให้ธีมมืด และ color: var(--strong) ใช้รุ่นนั้น', () => {
        const css = read('css/dark.css');
        assert.match(css, /\.hue-emerald \{[^}]*--strong-t: #[0-9A-F]{6};/);
        assert.match(css, /color: var\(--strong-t, var\(--strong\)\)/);
    });
});

describe('หน้าทั้งหมด', () => {
    for (const page of PAGES) {
        test(`${page}: โหลด theme.js ใน <head> ก่อนสไตล์ และ dark.css เป็นสไตล์สุดท้าย`, () => {
            const html = norm(read(page));
            const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
            const themeAt = head.indexOf('src="/js/theme.js"');
            assert.ok(themeAt > 0, 'ต้องมี theme.js');
            assert.doesNotMatch(head.slice(themeAt, themeAt + 40), /defer|async|module/, 'ต้องเป็นสคริปต์ที่รันทันที ไม่งั้นหน้ามืดวาบขาว');
            const firstCss = head.indexOf('rel="stylesheet" href="css/');
            assert.ok(firstCss > themeAt, 'theme.js ต้องมาก่อนสไตล์แรก');
            const links = [...head.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)"/g)].map((m) => m[1]);
            assert.equal(links.at(-1), 'css/dark.css');
        });
    }

    test('หน้าที่มีปุ่มฟันเฟืองต่อกับหน้าต่างตั้งค่าครบ: data-settings-open, settings.css, study-settings.js (หลัง main.js ไม่จำเป็น แต่ต้องมี)', () => {
        for (const page of SETTINGS_PAGES) {
            const html = read(page);
            assert.match(html, /aria-label="การตั้งค่า"[^>]*data-settings-open/, page);
            assert.match(html, /href="css\/settings\.css"/, page);
            assert.match(html, /<script type="module" src="js\/study-settings\.js">/, page);
        }
        for (const page of PAGES.filter((p) => !SETTINGS_PAGES.includes(p))) assert.doesNotMatch(read(page), /study-settings/, page);
    });

    test('meta theme-color ยังเป็นสีเขียวตอนสว่าง (theme.js เปลี่ยนเป็นเขียวเข้มตอนมืด)', () => {
        for (const page of PAGES) assert.match(read(page), /<meta name="theme-color" content="#10B981">/, page);
    });
});

describe('หน้าต่างตั้งค่า (เนื้อหาเหมือนเว็บหลัก)', () => {
    const html = renderSettings({ appBase: 'https://beta.headface.app' });

    test('มี 4 หัวข้อเหมือน dashboard ของเว็บหลัก: แจ้งเตือน LINE · ชำระเงิน · ติดตั้งแอป · การแสดงผล', () => {
        for (const t of ['ตั้งค่าระบบ', 'การแจ้งเตือน (Notifications)', 'ตารางแจ้งเตือนผ่าน LINE', 'แพ็กเกจและการชำระเงิน (Payments)', 'ประวัติการชำระเงินและใบเสร็จ', 'ติดตั้งแอป (Install)', 'การแสดงผล (Appearance)']) assert.ok(html.includes(t), t);
        for (const c of ['system', 'light', 'dark']) assert.match(html, new RegExp(`data-hf-theme-choice="${c}"`));
        for (const label of ['ตามเครื่อง', 'สว่าง', 'มืด']) assert.ok(html.includes(label), label);
        assert.match(html, /aria-checked="false"/);
    });

    test('ลิงก์ไปหน้าของเว็บหลัก (ตาม environment) ไม่ hard-code โดเมนในไฟล์', () => {
        assert.match(html, /href="https:\/\/beta\.headface\.app\/notifications\.html"/);
        assert.match(html, /href="https:\/\/beta\.headface\.app\/payments\.html"/);
        assert.doesNotMatch(read('js/study-settings.js'), /https?:\/\/[a-z0-9.-]*headface\.app/i);
        assert.match(read('js/study-settings.js'), /getAppBaseUrl/);
    });

    test('เป็น dialog ที่ถูกต้อง: role/aria-modal/ชื่อ, ปุ่มปิดมีชื่อ, ปิดด้วยฉากหลัง; ส่วนติดตั้งซ่อนไว้จนกว่า pwa.js จะเปิด', () => {
        assert.match(html, /role="dialog" aria-modal="true" aria-labelledby="stTitle"/);
        assert.match(html, /<button type="button" class="st-x" data-settings-close aria-label="[^"]+"/);
        assert.match(html, /class="st-back" data-settings-close/);
        assert.match(html, /data-hf-install-section hidden/);
        assert.match(html, /data-hf-install-steps hidden/);
    });

    test('ข้อความที่ใส่ในหน้าต่างถูก escape (appBase มาจาก env แต่กันไว้)', () => {
        const evil = renderSettings({ appBase: '"><img src=x onerror=alert(1)>' });
        assert.doesNotMatch(evil, /<img src=x/);
    });

    test('js/pwa.js: ปุ่มติดตั้ง + ขั้นตอนบนเครื่องที่ติดตั้งเองไม่ได้ (iOS) และซ่อนหัวข้อเมื่อติดตั้งแล้ว', () => {
        const pwa = read('js/pwa.js');
        assert.match(pwa, /beforeinstallprompt/);
        assert.match(pwa, /\[data-hf-install\]/);
        assert.match(pwa, /display-mode: standalone/);
        assert.match(pwa, /เพิ่มลงในหน้าจอโฮม/);
        assert.match(pwa, /window\.HFInstall = \{ mode: mode, install: install, refresh: refresh \}/);
    });
});

describe('เอกสารการซิงก์ธีมกับเว็บหลัก', () => {
    test('docs/theme-sync.md บอกสัญญาของคุกกี้ และโค้ดที่เว็บหลักต้องเพิ่ม', () => {
        const doc = read('docs/theme-sync.md');
        assert.match(doc, /hf_theme/);
        assert.match(doc, /\.headface\.app/);
        assert.match(doc, /theme-init\.js/);
    });
});
