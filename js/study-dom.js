/**
 * js/study-dom.js — อัปเดตหน้าแบบ "แก้เฉพาะจุดที่เปลี่ยน" แทนการวาดทั้งหน้าใหม่ด้วย innerHTML
 *
 * เหตุผล: ถ้ากดปุ่มแล้ววาดทั้งหน้าใหม่ ทุกองค์ประกอบจะถูกสร้างใหม่ → แอนิเมชันเข้าฉากเล่นซ้ำทั้งหน้า ภาพ/วิดีโอโหลดใหม่ โฟกัสและตำแหน่งเลื่อนหลุด
 * ดูเหมือนหน้า "โหลดใหม่ทั้งหมด" ทั้งที่เปลี่ยนแค่ปุ่มเดียว ตัวนี้เทียบ HTML ใหม่กับ DOM เดิมแล้วแก้เฉพาะส่วนที่ต่างกัน:
 *   - องค์ประกอบที่เหมือนเดิมไม่ถูกแตะ (วิดีโอไม่หยุด ภาพไม่กะพริบ ค่า transition ของ width/สีทำงานต่อเนื่อง)
 *   - องค์ประกอบใหม่เท่านั้นที่เล่นแอนิเมชันเข้าฉาก
 *
 * การจับคู่: ใส่ data-key="..." บนบล็อกที่เป็น "มุมมอง" ของหน้า (เช่น ข้อสอบข้อที่ 3) — key เปลี่ยน = ถือเป็นของใหม่ (เล่นแอนิเมชันเข้าฉาก)
 * key เหมือนเดิม = แก้ในที่เดิม ส่วนที่ไม่มี key จับคู่ตามลำดับและชนิดของแท็ก ใส่ data-morph="skip" เพื่อไม่แตะลูกของบล็อกนั้น
 * ข้อจำกัด: ไม่จัดการค่าของช่องกรอกข้อมูล (หน้ากลุ่มนี้ไม่มีช่องกรอก)
 * ในสภาพแวดล้อมที่ไม่มี DOM จริง (เทสต์ใน Node) ถอยไปใช้ innerHTML ตามเดิม
 */
const ELEMENT = 1;

const keyOf = (node) => (node.nodeType === ELEMENT ? node.getAttribute('data-key') : null);
const sameKind = (a, b) => a.nodeType === b.nodeType && (a.nodeType !== ELEMENT || a.tagName === b.tagName);

/** ค่าที่ผู้ใช้เปลี่ยนเองและ HTML ใหม่ไม่รู้ (เช่น กดเปิด <details>) ต้องไม่ถูกทับ: ถ้าไม่งั้นส่วนที่ผู้ใช้เปิดไว้จะหุบเองทุกครั้งที่หน้าอัปเดต */
const userOwned = (el, name) => name === 'open' && el.tagName === 'DETAILS';

function syncAttributes(el, src) {
    const wanted = Array.from(src.attributes);
    for (const { name, value } of wanted) {
        if (userOwned(el, name)) continue;
        if (el.getAttribute(name) !== value) el.setAttribute(name, value);
    }
    for (const { name } of Array.from(el.attributes)) {
        if (userOwned(el, name)) continue;
        if (!src.hasAttribute(name)) el.removeAttribute(name);
    }
}

function morphNode(old, next) {
    if (old.nodeType !== ELEMENT) {
        if (old.nodeValue !== next.nodeValue) old.nodeValue = next.nodeValue;
        return;
    }
    syncAttributes(old, next);
    if (next.getAttribute('data-morph') === 'skip') return;
    morphChildren(old, next);
}

/** ทำให้ลูกของ parent หน้าตาเหมือนลูกของ source โดยใช้โหนดเดิมซ้ำให้มากที่สุด (source ถูกใช้แล้ว: โหนดใหม่ถูกย้ายออกมา) */
export function morphChildren(parent, source) {
    const olds = Array.from(parent.childNodes);
    const wanted = Array.from(source.childNodes);
    const byKey = new Map();
    const pool = [];
    for (const node of olds) {
        const key = keyOf(node);
        if (key === null) pool.push(node);
        else if (!byKey.has(key)) byKey.set(key, node);
    }

    const used = new Set();
    let cursor = 0;
    const ordered = wanted.map((next) => {
        const key = keyOf(next);
        let match = null;
        if (key !== null) {
            const found = byKey.get(key);
            if (found && !used.has(found) && sameKind(found, next)) match = found;
        } else if (next.nodeType === ELEMENT) {
            // องค์ประกอบไม่มี key: ใช้ตัวแรกที่ชนิดเดียวกันถัดจากตัวล่าสุดที่จับคู่ (ข้ามตัวที่ถูกลบออกไป)
            for (let j = cursor; j < pool.length; j++) {
                if (!used.has(pool[j]) && sameKind(pool[j], next)) { match = pool[j]; cursor = j + 1; break; }
            }
        } else if (cursor < pool.length && !used.has(pool[cursor]) && sameKind(pool[cursor], next)) {
            match = pool[cursor];
            cursor += 1;
        }
        if (!match) return next;
        used.add(match);
        morphNode(match, next);
        return match;
    });

    let ref = parent.firstChild;
    for (const node of ordered) {
        if (node === ref) { ref = ref.nextSibling; continue; }
        parent.insertBefore(node, ref);
    }
    for (const node of olds) {
        if (!used.has(node) && node.parentNode === parent) parent.removeChild(node);
    }
}

const hasRealDom = (el) => !!el && typeof document !== 'undefined' && typeof document.createElement === 'function'
    && el.childNodes !== undefined && typeof el.insertBefore === 'function';

/**
 * ใส่ HTML ลงใน el โดยแก้เฉพาะส่วนที่ต่างจากเดิม
 * @returns {boolean} true = แก้ในที่เดิม, false = ถอยไปวาดใหม่ทั้งหมด (ไม่มี DOM จริง)
 */
export function patchHtml(el, html) {
    if (!hasRealDom(el)) {
        el.innerHTML = html;
        return false;
    }
    const tpl = document.createElement('template');
    if (!tpl.content) {
        el.innerHTML = html;
        return false;
    }
    tpl.innerHTML = html;
    morphChildren(el, tpl.content);
    return true;
}
