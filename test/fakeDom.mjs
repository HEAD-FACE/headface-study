// DOM จำลองขนาดเล็กสำหรับทดสอบหน้าเรียนใน Node: มีแค่สิ่งที่ js/study-live-*.js ใช้จริง
// (ค้นหาด้วย #id, innerHTML/textContent, onclick, classList, ชั้นซ้อนที่ต่อท้าย body, ตัวฟังเหตุการณ์ของ document/window)
export class FakeElement {
    constructor(id = '') {
        this.id = id;
        this.innerHTML = '';
        this.textContent = '';
        this.href = '';
        this.onclick = null;
        this.className = '';
        this.dataset = {};
        this.attrs = {};
        this.listeners = {};
        this.removed = false;
        const el = this;
        this.classList = { toggle: (name, on) => { el.toggled = { ...(el.toggled || {}), [name]: !!on }; }, add() {}, remove() {} };
    }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    /** รองรับ [data-act="x"] เมื่อมีอยู่ใน innerHTML (พอสำหรับ failure() ที่ผูกปุ่ม "ลองใหม่") */
    querySelector(sel) {
        const m = /^\[data-act="([^"]+)"\]$/.exec(sel);
        return m && this.innerHTML.includes(`data-act="${m[1]}"`) ? new FakeElement() : null;
    }
    focus() {}
    remove() { this.removed = true; }
}

/** ติดตั้ง document / window / CSS จำลอง คืนค่าตัวช่วยสำหรับเทสต์ */
export function installFakeDom(ids = ['content', 'view', 'backLink', 'eyebrow', 'pageTitle', 'barRight', 'pageMeta']) {
    const byId = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
    const docListeners = {};
    const winListeners = {};
    const bodyChildren = [];
    globalThis.document = {
        title: '',
        body: { classList: { add() {} }, appendChild: (el) => { bodyChildren.push(el); el.parent = true; } },
        querySelector: (sel) => (sel.startsWith('#') ? byId[sel.slice(1)] || null : null),
        getElementById: (id) => (byId[id] && !byId[id].removed ? byId[id] : bodyChildren.find((el) => el.id === id && !el.removed) || null),
        createElement: () => new FakeElement(),
        addEventListener: (type, fn) => { (docListeners[type] ||= []).push(fn); },
        visibilityState: 'visible',
    };
    globalThis.location = { search: '', href: 'http://localhost/mock-exam.html', pathname: '/mock-exam.html' };
    globalThis.history = { replaceState() {} };
    globalThis.window = {
        scrollTo() {},
        addEventListener: (type, fn) => { (winListeners[type] ||= []).push(fn); },
        removeEventListener: (type, fn) => { winListeners[type] = (winListeners[type] || []).filter((f) => f !== fn); },
    };
    globalThis.CSS = { escape: (s) => String(s) };
    // content/view of js/study-ui.js are captured when it is first imported: keep ONE instance and reset it between tests
    const reset = () => {
        for (const el of Object.values(byId)) { el.innerHTML = ''; el.textContent = ''; el.href = ''; el.onclick = null; el.attrs = {}; el.toggled = {}; }
        for (const k of Object.keys(docListeners)) delete docListeners[k];
        for (const k of Object.keys(winListeners)) delete winListeners[k];
        bodyChildren.length = 0;
        globalThis.location.search = '';
        globalThis.document.title = '';
    };
    return {
        reset,
        el: byId,
        content: byId.content,
        bodyChildren,
        winListeners,
        /** คลิกจำลองบน #content: act = data-act, choice = data-choice, goto = data-goto */
        click: (target = {}) => byId.content.onclick && byId.content.onclick({
            target: { closest: (sel) => {
                if (sel === '[data-act]') return target.act ? { dataset: { act: target.act } } : null;
                if (sel === '[data-choice]') return target.choice ? { dataset: { choice: target.choice } } : null;
                return null;
            } },
        }),
        /** คลิกในชั้นซ้อน (ฟังที่ document) */
        clickOverlay: (target = {}) => (docListeners.click || []).forEach((fn) => fn({
            target: { closest: (sel) => {
                if (sel === '[data-goto]') return target.goto !== undefined ? { dataset: { goto: String(target.goto) } } : null;
                if (sel === '#overlay [data-act]') return target.act ? { dataset: { act: target.act } } : null;
                return null;
            } },
        })),
    };
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
