// ปุ่ม "<" ที่แถบล่าง: พากลับ Dashboard ของเว็บหลัก (headface.app/dashboard หรือ beta.headface.app/dashboard)
// ปลายทางต้องมาจาก js/env.js ที่เดียว — HTML ไม่ hard-code โดเมน
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const PAGES_WITH_BOTTOM_BAR = ['index.html', 'subject.html', 'progress.html', 'course.html', 'report.html'];

describe('ปุ่มกลับ Dashboard ที่แถบล่าง', () => {
    for (const page of PAGES_WITH_BOTTOM_BAR) {
        test(`${page}: มีปุ่ม < เป็นรายการแรกของแถบล่าง วาดด้วย SVG และไม่ hard-code โดเมน`, () => {
            const html = read(page);
            const nav = html.match(/<nav id="bottom-navbar"[\s\S]*?<\/nav>/);
            assert.ok(nav, 'ต้องมี #bottom-navbar');
            const first = nav[0].match(/<div class="nav-in">\s*(<a [\s\S]*?<\/a>)/);
            assert.ok(first, 'ต้องมีรายการในแถบ');
            assert.match(first[1], /id="navBackDashboard"/, 'รายการแรกต้องเป็นปุ่มกลับ');
            assert.match(first[1], /<svg[\s\S]*<path d="M15 5l-7 7l7 7"/, 'ไอคอน < ต้องเป็น SVG');
            assert.match(first[1], /aria-label="[^"]+"/, 'ต้องมีชื่อสำหรับโปรแกรมอ่านหน้าจอ');
            assert.doesNotMatch(first[1], /headface\.app/, 'ปลายทางต้องมาจาก env.js เท่านั้น');
            assert.doesNotMatch(first[1], /data-nav=/, 'ไม่ใช่แท็บของ Study จึงต้องไม่เข้าระบบไฮไลต์แท็บ');
        });
    }

    test('main.js ตั้งปลายทางจาก StudyEnv.getDashboardUrl ตอนเริ่มหน้า', () => {
        const js = read('js/main.js');
        assert.match(js, /function initDashboardLink\(\)/);
        assert.match(js, /getElementById\('navBackDashboard'\)/);
        assert.match(js, /StudyEnv\.getDashboardUrl\(\)/);
        const authInit = js.slice(js.indexOf('async function initAuth()'));
        assert.match(authInit.slice(0, 400), /initDashboardLink\(\);/, 'ต้องถูกเรียกใน initAuth');
    });

    test('CSS: ปุ่มเล็กกว่าเมนูอื่น และจอแคบไม่ล้น', () => {
        const css = read('css/style.css');
        assert.match(css, /\.nav-back\s*\{[^}]*min-width:\s*56px/);
        assert.match(css, /@media \(max-width: 380px\)[^{]*\{\s*\.nav-in \.nav-i:not\(\.nav-back\)/);
    });
});
