// แถบหัวลอย (.fbar) ของหน้าบทเรียน / Quiz / Mock Exam / AI Tutor: เม็ดยาลอย ไม่ใช่แถบเต็มความกว้างติดขอบจอ
// ตรวจที่โครงของ CSS/HTML (ไม่ใช่ภาพ): ต้องเกาะจอได้จริง (sticky) และไม่มีของเดิมที่ทับกลับไปเป็นแถบขาวเรียบ
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('css/flow.css');
const rule = (selector) => {
    const re = new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
    const m = css.match(re);
    return m ? m[1] : null;
};

describe('แถบหัวลอย', () => {
    test('.fbar เกาะบนสุดของจอ (sticky) แต่ตัวแถบเองไม่บังการกด: มีแต่เม็ดยาข้างในที่รับการกด', () => {
        const bar = rule('.fbar');
        assert.ok(bar, 'ต้องมีกฎ .fbar');
        assert.match(bar, /position:\s*sticky/);
        assert.match(bar, /top:\s*0/);
        assert.match(bar, /pointer-events:\s*none/);
        assert.match(bar, /safe-area-inset-top/, 'เว้นรอยบากของ iPhone');
        assert.match(rule('.fbar-in'), /pointer-events:\s*auto/);
    });

    test('เม็ดยา: ขอบมน เงาลอย กระจกฝ้า และขอบล่างหนาแบบปุ่มเกม', () => {
        const pill = rule('.fbar-in');
        assert.match(pill, /border-radius:\s*2[4-9]px/);
        assert.match(pill, /backdrop-filter:\s*blur\(/);
        assert.match(pill, /box-shadow:\s*0 4px 0 /, 'ขอบล่างหนา');
        assert.match(pill, /margin:\s*0 auto/);
        assert.match(pill, /max-width:\s*40rem/);
    });

    test('ปุ่มย้อนกลับเป็นปุ่มสีไล่เฉด กดแล้วยุบ ขนาดอย่างน้อย 44px', () => {
        const back = rule('.fback');
        assert.match(back, /linear-gradient/);
        assert.match(back, /width:\s*4[4-9]px/);
        assert.match(back, /height:\s*4[4-9]px/);
        assert.match(rule('.fback:active'), /translateY\(3px\)/);
    });

    test('ไม่มีกฎเก่าที่ทับกลับเป็นแถบขาวเต็มความกว้างมีเส้นล่าง', () => {
        assert.doesNotMatch(css, /\.fbar\s*\{[^}]*border-bottom/);
        assert.equal((css.match(/(?:^|\n)\.fbar\s*\{/g) || []).length, 1, 'กฎ .fbar อยู่ที่เดียว');
    });

    test('body.flow ไม่เป็นกล่องเลื่อนเอง (ไม่งั้น sticky ไม่เกาะจอ เพราะ html ตั้ง overflow-x: hidden ไว้แล้ว)', () => {
        assert.match(css, /html\s*\{\s*overflow-x:\s*hidden/);
        assert.match(css, /body\.flow\s*\{\s*overflow-x:\s*visible/);
    });

    test('ช่องขวา (#barRight) ว่าง = ไม่กินที่; ทุกหน้าที่ใช้แถบหัวมีโครงเดียวกัน', () => {
        assert.match(css, /#barRight:empty\s*\{\s*display:\s*none/);
        for (const page of ['lesson.html', 'mock-exam.html', 'tutor.html']) {
            const html = read(page);
            assert.match(html, /<header class="fbar">\s*<div class="fbar-in">/, page);
            for (const part of ['class="fback"', 'class="fbar-t"', 'id="eyebrow"', 'id="pageTitle"', 'id="barRight"']) assert.ok(html.includes(part), `${page}: ${part}`);
        }
    });

    test('ลดการเคลื่อนไหวได้: ปุ่มย้อนกลับไม่มีแอนิเมชัน (มีแค่ transition สั้น ๆ ตอนกด)', () => {
        assert.doesNotMatch(rule('.fback'), /animation:/);
    });
});
