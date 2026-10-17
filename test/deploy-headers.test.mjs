// _headers (Cloudflare): โค้ดและสไตล์ต้องไม่ถูกเบราว์เซอร์แคชข้าม deploy ไม่งั้นหลัง push ผู้ใช้ยังเห็นหน้าเดิมนานถึง 4 ชั่วโมง
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const text = fs.readFileSync(new URL('../_headers', import.meta.url), 'utf8');

/** อ่านรูปแบบของ Cloudflare: บรรทัดที่ไม่เยื้องคือ path, บรรทัดเยื้องคือหัวของ path นั้น (บรรทัดขึ้นต้น # คือหมายเหตุ) */
function parse(source) {
    const rules = {};
    let path = null;
    for (const line of source.split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        if (/^\s/.test(line)) {
            const [name, ...rest] = line.trim().split(':');
            rules[path][name.trim().toLowerCase()] = rest.join(':').trim();
        } else {
            path = line.trim();
            rules[path] = {};
        }
    }
    return rules;
}

test('js และ css ให้เบราว์เซอร์ถามเซิร์ฟเวอร์ทุกครั้ง (no-cache) ไม่แคชข้ามการ deploy', () => {
    const rules = parse(text);
    assert.equal(rules['/js/*']['cache-control'], 'no-cache');
    assert.equal(rules['/css/*']['cache-control'], 'no-cache');
});

test('ไม่ได้ตั้งค่าให้ไฟล์อื่น (เช่น ภาพใน assets) ไว้โดยไม่จำเป็น', () => {
    assert.deepEqual(Object.keys(parse(text)).sort(), ['/css/*', '/js/*']);
});
