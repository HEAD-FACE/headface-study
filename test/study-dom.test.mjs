// js/study-dom.js — ทดสอบการ "แก้เฉพาะจุดที่เปลี่ยน" ด้วย DOM จำลองขนาดเล็ก (Node ไม่มี DOM จริง)
// ส่วนที่แปลง HTML เป็นโหนด (template.innerHTML) เป็นของเบราว์เซอร์เอง จึงทดสอบเฉพาะตัวเทียบโหนด (morphChildren) กับทางถอยของ patchHtml
import test from 'node:test';
import assert from 'node:assert/strict';
import { morphChildren, patchHtml } from '../js/study-dom.js';

class N {
    constructor(type, tag, value = null) {
        this.nodeType = type;
        this.tagName = tag;
        this.nodeValue = value;
        this.attrs = new Map();
        this.childNodes = [];
        this.parentNode = null;
    }
    get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
    get firstChild() { return this.childNodes[0] || null; }
    get nextSibling() {
        const p = this.parentNode;
        return p ? p.childNodes[p.childNodes.indexOf(this) + 1] || null : null;
    }
    getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; }
    setAttribute(n, v) { this.attrs.set(n, String(v)); }
    hasAttribute(n) { return this.attrs.has(n); }
    removeAttribute(n) { this.attrs.delete(n); }
    insertBefore(node, ref) {
        if (node.parentNode) node.parentNode.removeChild(node);
        const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
        this.childNodes.splice(i, 0, node);
        node.parentNode = this;
        return node;
    }
    appendChild(node) { return this.insertBefore(node, null); }
    removeChild(node) {
        const i = this.childNodes.indexOf(node);
        if (i >= 0) this.childNodes.splice(i, 1);
        node.parentNode = null;
        return node;
    }
}
const el = (tag, attrs = {}, ...kids) => {
    const n = new N(1, tag.toUpperCase());
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    for (const kid of kids) n.appendChild(typeof kid === 'string' ? new N(3, '#text', kid) : kid);
    return n;
};
const root = (...kids) => el('div', {}, ...kids);
const html = (n) => (n.nodeType === 3 ? n.nodeValue : `<${n.tagName.toLowerCase()}${n.attributes.map((a) => ` ${a.name}="${a.value}"`).join('')}>${n.childNodes.map(html).join('')}</${n.tagName.toLowerCase()}>`);

test('โครงเดิม: แก้ข้อความและแอตทริบิวต์ในที่เดิม ไม่สร้างองค์ประกอบใหม่', () => {
    const a = el('p', { class: 'x' }, 'เก่า');
    const b = el('button', { disabled: '' }, 'ปุ่ม');
    const parent = root(a, b);
    morphChildren(parent, root(el('p', { class: 'y', id: 'n' }, 'ใหม่'), el('button', {}, 'ปุ่ม 2')));
    assert.equal(parent.childNodes[0], a);
    assert.equal(parent.childNodes[1], b);
    assert.equal(html(parent), '<div><p class="y" id="n">ใหม่</p><button>ปุ่ม 2</button></div>');
});

test('key เหมือนเดิม = ใช้องค์ประกอบเดิม key เปลี่ยน = สร้างใหม่ (ได้แอนิเมชันเข้าฉาก) ส่วนที่ไม่มี key ยังเป็นตัวเดิม', () => {
    const q1 = el('section', { 'data-key': 'q-1' }, 'ข้อ 1');
    const bar = el('div', { class: 'abar' }, el('button', {}, 'ตรวจ'));
    const parent = root(q1, bar);
    morphChildren(parent, root(el('section', { 'data-key': 'q-1' }, 'ข้อ 1 (เลือกแล้ว)'), el('div', { class: 'abar' }, el('button', {}, 'ตรวจ'))));
    assert.equal(parent.childNodes[0], q1, 'key เดิมใช้ซ้ำ');
    assert.equal(parent.childNodes[1], bar);

    const next = el('section', { 'data-key': 'q-2' }, 'ข้อ 2');
    morphChildren(parent, root(next, el('div', { class: 'abar' }, el('button', {}, 'ข้อถัดไป'))));
    assert.equal(parent.childNodes[0], next, 'key ใหม่ = โหนดใหม่');
    assert.notEqual(parent.childNodes[0], q1);
    assert.equal(parent.childNodes[1], bar, 'แถบปุ่มล่างยังเป็นตัวเดิม ไม่กะพริบ');
    assert.equal(parent.childNodes.length, 2, 'ข้อเก่าถูกถอดออก');
    assert.equal(bar.childNodes[0].childNodes[0].nodeValue, 'ข้อถัดไป');
});

test('แทรกองค์ประกอบกลางลิสต์ (เช่นกล่องเฉลย) ไม่ทำให้พี่น้องเปลี่ยนตัว', () => {
    const head = el('h2', {}, 'โจทย์');
    const choices = el('div', { class: 'choices' }, el('button', {}, 'ก'));
    const parent = root(head, choices);
    morphChildren(parent, root(el('h2', {}, 'โจทย์'), el('div', { class: 'choices' }, el('button', { class: 'is-ok' }, 'ก')), el('div', { 'data-key': 'fb', class: 'fb' }, 'ถูกต้อง')));
    assert.equal(parent.childNodes[0], head);
    assert.equal(parent.childNodes[1], choices);
    assert.equal(parent.childNodes[2].getAttribute('data-key'), 'fb');
    assert.equal(choices.childNodes[0].getAttribute('class'), 'is-ok');
});

test('ลบองค์ประกอบกลางลิสต์: ตัวที่เหลือยังใช้ตัวเดิมได้ถ้ามี key', () => {
    const a = el('article', { 'data-key': 'a' }, 'A');
    const b = el('article', { 'data-key': 'b' }, 'B');
    const c = el('article', { 'data-key': 'c' }, 'C');
    const parent = root(a, b, c);
    morphChildren(parent, root(el('article', { 'data-key': 'a' }, 'A'), el('article', { 'data-key': 'c' }, 'C')));
    assert.deepEqual(parent.childNodes, [a, c]);
});

test('สลับลำดับรายการที่มี key: ย้ายโหนดเดิมแทนการสร้างใหม่', () => {
    const a = el('i', { 'data-key': 'a' }, 'A');
    const b = el('i', { 'data-key': 'b' }, 'B');
    const parent = root(a, b);
    morphChildren(parent, root(el('i', { 'data-key': 'b' }, 'B'), el('i', { 'data-key': 'a' }, 'A')));
    assert.deepEqual(parent.childNodes, [b, a]);
});

test('ลบแอตทริบิวต์ที่ไม่มีแล้ว เช่น disabled / aria-pressed', () => {
    const btn = el('button', { disabled: '', 'aria-pressed': 'true', style: 'width:10%' }, 'x');
    const parent = root(btn);
    morphChildren(parent, root(el('button', { style: 'width:50%' }, 'x')));
    assert.equal(btn.hasAttribute('disabled'), false);
    assert.equal(btn.hasAttribute('aria-pressed'), false);
    assert.equal(btn.getAttribute('style'), 'width:50%');
});

test('<details> ที่ผู้ใช้กดเปิดไว้ไม่หุบเองเมื่อหน้าอัปเดต (open เป็นของผู้ใช้)', () => {
    const d = el('details', { open: '' }, el('summary', {}, 'ข้อที่ควรทบทวน'));
    const parent = root(d);
    morphChildren(parent, root(el('details', { class: 'fold' }, el('summary', {}, 'ข้อที่ควรทบทวน'))));
    assert.equal(parent.childNodes[0], d);
    assert.equal(d.hasAttribute('open'), true, 'ยังเปิดอยู่');
    assert.equal(d.getAttribute('class'), 'fold');
    const closed = el('details', {}, el('summary', {}, 'x'));
    morphChildren(root(closed), root(el('details', { open: '' }, el('summary', {}, 'x'))));
    assert.equal(closed.hasAttribute('open'), false, 'HTML ใหม่ก็ไม่เปิดให้เอง');
});

test('data-morph="skip": ไม่แตะลูก (เช่นวิดีโอที่กำลังเล่น) แต่แอตทริบิวต์ของมันยังอัปเดต', () => {
    const video = el('div', { 'data-morph': 'skip', class: 'a' }, el('video', {}));
    const parent = root(video);
    morphChildren(parent, root(el('div', { 'data-morph': 'skip', class: 'b' }, el('p', {}, 'ไม่ควรถูกใส่'))));
    assert.equal(parent.childNodes[0], video);
    assert.equal(video.getAttribute('class'), 'b');
    assert.equal(video.childNodes[0].tagName, 'VIDEO');
});

test('ข้อความ: แก้ nodeValue ในที่เดิม และเพิ่ม/ลบโหนดข้อความได้', () => {
    const p = el('p', {}, 'สวัสดี');
    const parent = root(p);
    morphChildren(parent, root(el('p', {}, 'ลาก่อน', el('b', {}, '!'))));
    assert.equal(parent.childNodes[0], p);
    assert.equal(html(parent), '<div><p>ลาก่อน<b>!</b></p></div>');
    morphChildren(parent, root(el('p', {}, 'ลาก่อน')));
    assert.equal(html(parent), '<div><p>ลาก่อน</p></div>');
});

test('patchHtml ในสภาพแวดล้อมที่ไม่มี DOM จริง: ถอยไปใช้ innerHTML', () => {
    const fake = { innerHTML: '' };
    assert.equal(patchHtml(fake, '<p>สวัสดี</p>'), false);
    assert.equal(fake.innerHTML, '<p>สวัสดี</p>');
});
