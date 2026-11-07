// แมว LYNX ต้องลอยเหนือแถบล่างของ Study ไม่ทับปุ่ม (js/study-lynx-offset.js)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { coveredHeight, offsetFor, watchLynxOffset, OFFSET_GAP, MODAL_SELECTOR } from '../js/study-lynx-offset.js';

const VH = 800;

describe('coveredHeight / offsetFor', () => {
    test('ไม่มีแถบล่าง = ค่าเดิม 16px', () => {
        assert.equal(coveredHeight([], VH), 0);
        assert.equal(offsetFor([], VH), OFFSET_GAP);
    });
    test('แถบปุ่มท้ายกิจกรรม (.abar สูง 84 ติดขอบล่าง) → แมวลอยเหนือแถบ', () => {
        assert.equal(offsetFor([{ top: 716, height: 84 }], VH), 84 + OFFSET_GAP);
    });
    test('เมนูล่างหน้าแรก (สูง 78)', () => {
        assert.equal(offsetFor([{ top: 722, height: 78 }], VH), 78 + OFFSET_GAP);
    });
    test('แถบตัดสินถูก-ผิดสูงขึ้น (มีคำอธิบาย) → ดันแมวสูงขึ้นตาม', () => {
        assert.ok(offsetFor([{ top: 560, height: 240 }], VH) > offsetFor([{ top: 716, height: 84 }], VH));
    });
    test('แถบที่ยังเลื่อนเข้าไม่ถึง (translateY 100%) ไม่นับ', () => {
        assert.equal(coveredHeight([{ top: VH, height: 84 }], VH), 0);
    });
    test('แถบที่ซ่อน (สูง 0) หรือล้นออกนอกจอด้านล่างไม่นับ', () => {
        assert.equal(coveredHeight([{ top: 700, height: 0 }, { top: 900, height: 84 }], VH), 0);
    });
    test('มีหลายแถบ: เอาแถบที่บังมากที่สุด', () => {
        assert.equal(coveredHeight([{ top: 722, height: 78 }, { top: 700, height: 100 }], VH), 100);
    });
});

describe('watchLynxOffset', () => {
    function fakeEnv(rects, withHost = true, modal = false) {
        const props = {};
        const host = { style: { visibility: '', setProperty: (k, v) => { props[k] = v; }, getPropertyValue: (k) => props[k] || '' } };
        const listeners = [];
        const doc = {
            body: {},
            getElementById: (id) => (id === 'lynx-widget' && withHost ? host : null),
            querySelectorAll: () => rects.map((r) => ({ getBoundingClientRect: () => r })),
            querySelector: (sel) => (modal && sel === MODAL_SELECTOR ? {} : null),
            addEventListener: (t, f) => listeners.push(['doc', t, f]),
            removeEventListener: () => {},
        };
        const win = { innerHeight: VH, setTimeout: (f) => f(), addEventListener: (t, f) => listeners.push(['win', t, f]), removeEventListener: () => {} };
        return { doc, win, props, listeners };
    }
    test('ตั้ง --offset ของ #lynx-widget ตามแถบล่าง', () => {
        const env = fakeEnv([{ top: 716, height: 84 }]);
        const stop = watchLynxOffset(env.doc, env.win);
        assert.equal(env.props['--offset'], `${84 + OFFSET_GAP}px`);
        stop();
    });
    test('มีหน้าต่างซ้อนเปิดอยู่ → ซ่อนแมว ปิดแล้วแสดงกลับ', () => {
        const env = fakeEnv([], true, true);
        const stop = watchLynxOffset(env.doc, env.win);
        const host = env.doc.getElementById('lynx-widget');
        assert.equal(host.style.visibility, 'hidden');
        stop();
        const env2 = fakeEnv([], true, false);
        const stop2 = watchLynxOffset(env2.doc, env2.win);
        assert.equal(env2.doc.getElementById('lynx-widget').style.visibility, '');
        stop2();
    });
    test('วิดเจ็ตยังไม่มา = ไม่ทำอะไร ไม่โยน error', () => {
        const env = fakeEnv([{ top: 716, height: 84 }], false);
        const stop = watchLynxOffset(env.doc, env.win);
        assert.deepEqual(env.props, {});
        stop();
    });
    test('วัดใหม่เมื่อ resize และเมื่อแถบเลื่อนเข้าเสร็จ (animationend)', () => {
        const env = fakeEnv([]);
        const stop = watchLynxOffset(env.doc, env.win);
        const kinds = env.listeners.map(([, t]) => t);
        for (const t of ['resize', 'animationend']) assert.ok(kinds.includes(t), t);
        stop();
    });
});

describe('หน้าเว็บ', () => {
    test('lynx-loader.js เรียกตัวเฝ้าตำแหน่งแมวก่อนโหลดวิดเจ็ต', () => {
        const s = readFileSync(new URL('../js/lynx-loader.js', import.meta.url), 'utf8');
        assert.match(s, /import \{ watchLynxOffset \} from '\.\/study-lynx-offset\.js'/);
        assert.ok(s.indexOf('watchLynxOffset()') < s.indexOf('import(`'), 'ต้องเริ่มเฝ้าก่อน');
    });
    test('ตัวเลือกหน้าต่างซ้อนครอบคลุมรายการข้อ/ภาพขยาย/ข้อมูลดาว', () => {
        for (const k of ['.ov', '.zoomv', '#star-info-modal']) assert.ok(MODAL_SELECTOR.includes(k), k);
    });
    test('ตัวเลือกแถบครอบคลุมทั้งเมนูล่างและแถบปุ่มท้ายกิจกรรม', () => {
        const s = readFileSync(new URL('../js/study-lynx-offset.js', import.meta.url), 'utf8');
        assert.match(s, /#bottom-navbar, \.abar/);
    });
});
