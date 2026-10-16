/**
 * js/study-course.js — หน้าเส้นทางเรียนของวิชา (course.html?s=KEY) ในรูปแบบ "เส้นทางวงกลม"
 *
 * หน่วยการเรียนรู้แต่ละหน่วยเป็นเส้นทางของวงกลม วงกลม 1 วง = กิจกรรม 1 อย่าง: ชุดเนื้อหา (หลายหน้า) / Quiz 1 ชุด / Practice 1 ชุด
 * บทเรียนในหน่วยแยกกันด้วยสีและเส้นคั่น (สีประจำบท) แตะวงกลมเพื่อดูรายละเอียดแล้วกด "เริ่ม"
 * วงกลมที่ "ถัดไป" เด้งและมีป้ายเริ่ม ทุกวงเปิดได้เสมอ (ไม่ล็อก) ปลายเส้นทางคือ Mock Exam ประจำวิชา
 *
 * หน้านี้เปลี่ยนหน้าด้วย Barba ร่วมกับหน้าหลัก: พื้นที่สีเขียวด้านบน (#mainBlueBg) ต่อเนื่องจากหน้าก่อน
 * ฟังก์ชันที่สร้าง HTML ไม่แตะ DOM จึงทดสอบใน Node ได้ ส่วนเชื่อมกับหน้าอยู่ใน initCoursePage
 */
import { studyApi, StudyApiError } from './study-api.js';
import { esc } from './study-ui.js';
import { lessonHue } from './study-format.js';
import { SUBJECT_ID_RE, courseUrl, mockUrl, nodeUrl } from './study-live-common.js';
import { reducedMotion } from './study-fx.js';

// ───────────── ไอคอน ─────────────
const svg = (inner, size = 30, w = 2.4) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const GLYPH = {
    content: '<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/>',
    quiz: '<path d="M3.5 5.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 11.5l1.5 1.5l2.5 -2.5"/><path d="M3.5 17.5l1.5 1.5l2.5 -2.5"/><path d="M11 6l9 0"/><path d="M11 12l9 0"/><path d="M11 18l9 0"/>',
    practice: '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/>',
    mock: '<path d="M8 21l8 0"/><path d="M12 17l0 4"/><path d="M7 4l10 0"/><path d="M17 4v8a5 5 0 0 1 -10 0v-8"/><path d="M5 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M19 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>',
    check: '<path d="M5 12l5 5l10 -10"/>',
    back: '<path d="M15 6l-6 6l6 6"/>',
    info: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 9h.01"/><path d="M11 12h1v4h1"/>',
    down: '<path d="M6 9l6 6l6 -6"/>',
};
export const glyph = (name, size, w) => svg(GLYPH[name] || '', size, w);

export const TYPE_LABEL = Object.freeze({ content: 'เนื้อหา', quiz: 'Quiz', practice: 'Practice' });

// ───────────── ตำแหน่งซิกแซกของวงกลม ─────────────
const WAVE = [0, 34, 56, 34, 0, -34, -56, -34];
/** ระยะเลื่อนแนวนอนของวงกลมลำดับที่ i ในหน่วยเดียวกัน (px) — เส้นโค้งคลื่นต่อเนื่องข้ามบท */
export const nodeOffset = (i) => WAVE[((i % WAVE.length) + WAVE.length) % WAVE.length];

// ───────────── ตัวช่วยอ่านข้อมูลของ node ─────────────
const pct = (n, d) => (d > 0 ? Math.max(0, Math.min(100, Math.round((n / d) * 100))) : 0);

/** เปอร์เซ็นต์วงแหวนความคืบหน้ารอบวงกลม (เนื้อหา: หน้าที่อ่านถึง, Practice: ที่ทำแล้ว, Quiz: ผลดีที่สุด) */
export function ringPercent(node) {
    const p = node.progress || {};
    if (node.status === 'done') return 100;
    if (node.type === 'content') return p.pageCount > 1 && p.pageReached > 0 ? pct(p.pageReached, p.pageCount) : 0;
    if (node.type === 'practice') return pct(p.done, p.total);
    return p.best ? pct(p.best.correct, p.best.total) : 0;
}

export const nodeStatusText = (status) => (status === 'done' ? 'เสร็จแล้ว' : status === 'now' ? 'ถัดไป' : 'ยังไม่เริ่ม');

/** เนื้อหาของการ์ดที่เด้งขึ้นใต้วงกลมเมื่อแตะ */
export function nodeInfo(node, subjectId, lessonNo) {
    const p = node.progress || {};
    const href = nodeUrl(subjectId, lessonNo, node.id);
    if (node.type === 'content') {
        const started = p.pageReached > 0;
        return {
            chip: `เนื้อหา • ${node.pageCount || p.pageCount || 1} หน้า`,
            line: node.status === 'done' ? 'เรียนจบแล้ว ✓' : started ? `อ่านถึงหน้า ${p.pageReached + 1}/${p.pageCount || node.pageCount}` : 'อ่านทีละหน้า แล้วกด "จบเนื้อหา"',
            label: node.status === 'done' ? 'ทบทวน' : started ? 'อ่านต่อ' : 'เริ่ม', href,
        };
    }
    if (node.type === 'quiz') {
        const need = p.passPct === null || p.passPct === undefined ? 'ทำครบแล้วส่ง 1 ครั้งถือว่าผ่าน' : `ผ่านเมื่อตอบถูก ≥ ${p.passPct}%`;
        const best = p.best ? ` • ดีที่สุด ${p.best.correct}/${p.best.total}` : '';
        return {
            chip: `Quiz • ${node.questionCount} ข้อ`,
            line: p.passed ? `ผ่านแล้ว ✓${best}` : `${need}${best}`,
            label: p.passed ? 'ทำอีกครั้ง' : p.attempts ? 'ลองอีกครั้ง' : 'เริ่ม', href,
        };
    }
    return {
        chip: 'Practice • ไม่บังคับ',
        line: p.total ? `ทำแล้ว ${p.done}/${p.total} ข้อ • ฝึกเองแล้วกดทำถูก/ทำผิด` : 'ยังไม่มีโจทย์ฝึก',
        label: node.status === 'done' ? 'ทบทวน' : p.done ? 'ทำต่อ' : 'เริ่ม', href,
    };
}

// ───────────── วงกลมและการ์ด ─────────────
export function nodeHtml(node, { subjectId, lessonNo, index, seq }) {
    const info = nodeInfo(node, subjectId, lessonNo);
    const status = node.status || 'todo';
    const optional = node.type === 'practice';
    const ring = ringPercent(node);
    const icon = status === 'done' ? glyph('check', 32, 3.4) : glyph(node.type, optional ? 24 : 30);
    return `<li class="cp-n is-${status}${optional ? ' is-optional' : ''}" data-kind="${esc(node.type)}" style="--dx:${nodeOffset(index)}px;--i:${seq}">
      <button type="button" class="cp-node" data-node="${esc(node.id)}" aria-expanded="false" aria-label="${esc(`${TYPE_LABEL[node.type] || ''} ${node.title} — ${nodeStatusText(status)}`)}">
        ${ring > 0 && status !== 'done' ? `<span class="cp-ring" style="--p:${ring}" aria-hidden="true"></span>` : ''}
        <span class="cp-face" aria-hidden="true">${icon}</span>
      </button>
      ${status === 'now' ? '<span class="cp-start" aria-hidden="true">เริ่ม</span>' : ''}
      <span class="cp-nl"><small>${esc(TYPE_LABEL[node.type] || '')}${optional ? ' • ไม่บังคับ' : ''}</small>${esc(node.title)}</span>
      <template class="cp-tpl"><div class="cp-pop" role="dialog" aria-label="${esc(node.title)}" style="--dx:${nodeOffset(index)}px">
        <span class="cp-pop-chip">${esc(info.chip)}</span>
        <h3>${esc(node.title)}</h3>
        <p>${esc(info.line)}</p>
        <a class="cp-go" href="${esc(info.href)}"><span>${esc(info.label)}</span></a>
      </div></template>
    </li>`;
}

export function lessonHtml(lesson, { subjectId, hue, seqStart, indexStart }) {
    const nodes = lesson.nodes || [];
    const done = lesson.status === 'done';
    let seq = seqStart;
    const items = nodes.map((n, k) => nodeHtml(n, { subjectId, lessonNo: lesson.no, index: indexStart + k, seq: seq++ })).join('');
    return `<div class="cp-lesson hue-${hue}${done ? ' is-done' : ''}" id="lesson-${lesson.no}" data-lesson="${lesson.no}">
      <div class="cp-lh" role="heading" aria-level="3"><span class="cp-lline"></span><span class="cp-lchip">${done ? glyph('check', 14, 3.4) : ''}<b>บทที่ ${lesson.no}</b><span>${esc(lesson.title)}</span></span><span class="cp-lline"></span></div>
      <ol class="cp-nodes">${nodes.length ? items : '<li class="cp-empty">บทนี้ยังไม่มีกิจกรรม</li>'}</ol>
    </div>`;
}

export function unitHtml(unit) {
    return `<section class="cp-unit" id="unit-${unit.no}" aria-label="หน่วยที่ ${unit.no} ${esc(unit.title)}">
      <div class="cp-banner"><div><p class="cp-banner-k">หน่วยที่ ${unit.no} • เสร็จ ${unit.doneCount}/${unit.lessonCount} บท</p><h2>${esc(unit.title)}</h2></div><span class="cp-banner-i" aria-hidden="true">${unit.doneCount === unit.lessonCount && unit.lessonCount > 0 ? glyph('check', 22, 3.2) : glyph('content', 22, 2.2)}</span></div>
      ${unit.lessonsHtml}
    </section>`;
}

/** วงกลมใหญ่ท้ายเส้นทาง: Mock Exam ประจำวิชา */
export function mockHtml(mock, subjectId) {
    const caption = !mock.available ? 'ยังไม่เปิดให้สอบ' : mock.attempts ? `ทำแล้ว ${mock.attempts} ครั้ง • ล่าสุด ${mock.lastPercent}%` : 'ยังไม่เคยทำ • จับเวลา ตรวจเฉลยและได้ดาว';
    const href = mockUrl(subjectId);
    return `<section class="cp-unit cp-final" id="mock" aria-label="Mock Exam ประจำวิชา">
      <div class="cp-banner cp-banner-mock"><div><p class="cp-banner-k">ปลายทาง</p><h2>Mock Exam ประจำวิชา</h2></div><span class="cp-banner-i" aria-hidden="true">${glyph('mock', 22, 2.2)}</span></div>
      <ol class="cp-nodes"><li class="cp-n cp-trophy is-${mock.available ? (mock.attempts ? 'done' : 'now') : 'todo'}" data-kind="mock" style="--dx:0px;--i:0">
        <button type="button" class="cp-node" data-node="__mock" aria-expanded="false" aria-label="Mock Exam ประจำวิชา — ${esc(caption)}"><span class="cp-face" aria-hidden="true">${glyph('mock', 38, 2.2)}</span></button>
        <span class="cp-nl"><small>Mock Exam</small>${esc(caption)}</span>
        <template class="cp-tpl"><div class="cp-pop cp-pop-mock" role="dialog" aria-label="Mock Exam" style="--dx:0px">
          <span class="cp-pop-chip">Mock Exam • ทั้งวิชา</span><h3>Mock Exam ประจำวิชา</h3><p>${esc(caption)}</p>
          ${mock.available ? `<a class="cp-go" href="${esc(href)}"><span>${mock.attempts ? 'สอบอีกครั้ง' : 'เข้าสอบ'}</span></a>` : '<span class="cp-go is-off">เร็ว ๆ นี้</span>'}
        </div></template>
      </li></ol>
    </section>`;
}

/** ส่วนหัว (ข้อความในแถบสีเขียว) จากข้อมูลวิชา */
export function headerView(data) {
    const { subject, progress } = data;
    return {
        eyebrow: subject.eyebrow || '',
        title: subject.title,
        meta: subject.metaText || (progress.lessonsTotal ? `${progress.lessonsTotal} บทเรียน` : ''),
        emoji: subject.emoji || '📘',
    };
}

/** ที่ที่ปุ่ม "เรียนต่อ" ควรพาไป: กิจกรรมถัดไปที่ระบบบอก หรือกิจกรรมแรกของบทแรกถ้าเรียนครบแล้ว */
export function ctaView(data) {
    const { subject, progress, current, units } = data;
    const started = progress.lessonsDone > 0 || !!progress.lastActivityAt;
    if (current && current.node) return { label: started ? 'เรียนต่อ' : 'เริ่มเรียน', href: nodeUrl(subject.id, current.no, current.node.id), sub: `บทที่ ${current.no} • ${current.node.title}` };
    const first = units.flatMap((u) => u.lessons).find((l) => l.nodes && l.nodes.length);
    if (!first) return null;
    return { label: 'ทบทวนบทเรียน', href: nodeUrl(subject.id, first.no, first.nodes[0].id), sub: current ? '' : 'เรียนครบทุกบทแล้ว' };
}

/** HTML ของเนื้อหาทั้งหน้า (ใต้ส่วนหัว) */
export function courseBodyHtml(data) {
    const { subject, progress, units, mock } = data;
    const cta = ctaView(data);
    const aboutRows = [
        subject.description && ['คำอธิบายวิชา', `<dd style="white-space:pre-line">${esc(subject.description)}</dd>`],
        subject.objectives && subject.objectives.length && ['วัตถุประสงค์การเรียนรู้', `<dd><ul class="cp-about-list">${subject.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></dd>`],
        subject.level && ['ระดับชั้น / ระดับความยาก', `<dd>${esc(subject.level)}</dd>`],
    ].filter(Boolean);

    let seq = 0;
    let index = 0;
    const unitHtmls = units.map((unit) => {
        const lessonsHtml = unit.lessons.map((lesson) => {
            const html = lessonHtml(lesson, { subjectId: subject.id, hue: lessonHue(lesson.no), seqStart: seq, indexStart: index });
            seq += (lesson.nodes || []).length;
            index += (lesson.nodes || []).length;
            return html;
        }).join('');
        index = 0; // แต่ละหน่วยเริ่มคลื่นใหม่จากกลางจอ
        return unitHtml({ ...unit, lessonsHtml });
    }).join('');

    return `<div class="cp-in">
      <section class="cp-sum" aria-label="ความคืบหน้าของวิชา">
        <div class="cp-sum-top"><p class="cp-sum-pct"><span class="num">${progress.pct}%</span><span class="cap">ความคืบหน้า</span></p><p class="cap">เรียนแล้ว ${progress.lessonsDone} จาก ${progress.lessonsTotal} บทเรียน</p></div>
        <div class="bar cp-bar" aria-hidden="true"><i style="width:${progress.pct}%"></i></div>
        ${cta ? `<a class="btn btn-lg btn-block cp-cta" href="${esc(cta.href)}"><span>${esc(cta.label)}</span></a>${cta.sub ? `<p class="cap cp-sum-cap">${esc(cta.sub)}</p>` : ''}` : ''}
      </section>
      ${aboutRows.length ? `<details class="cp-about"><summary>${glyph('info', 18)}<span>เกี่ยวกับวิชานี้</span><span class="cp-chev">${glyph('down', 20)}</span></summary><dl>${aboutRows.map(([t, dd]) => `<div><dt>${t}</dt>${dd}</div>`).join('')}</dl></details>` : ''}
      <div class="cp-path">${unitHtmls || '<p class="cp-empty">วิชานี้ยังไม่มีบทเรียน</p>'}${mockHtml(mock, subject.id)}</div>
    </div>`;
}

const failureHtml = (err) => `<div class="cp-in"><section class="cp-state" role="alert"><h2>โหลดข้อมูลไม่สำเร็จ</h2><p>${esc(err instanceof StudyApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')}</p><div class="cp-state-act"><button type="button" class="btn" data-act="retry">ลองใหม่</button><a class="btn btn-line" href="subject.html">กลับไปหน้ารายวิชา</a></div></section></div>`;
const missingHtml = (message) => `<div class="cp-in"><section class="cp-state" role="alert"><h2>${esc(message)}</h2><p>ลิงก์อาจไม่ถูกต้อง หรือยังไม่มีข้อมูลของวิชานี้</p><div class="cp-state-act"><a class="btn" href="subject.html">กลับไปหน้ารายวิชา</a></div></section></div>`;
const loadingHtml = () => '<div class="cp-in"><div class="cp-state cp-loading" role="status" aria-live="polite"><span class="cp-spin" aria-hidden="true"></span>กำลังโหลดเส้นทางเรียน...</div></div>';

// ───────────── เชื่อมกับหน้า (DOM + Barba) ─────────────
const shell = () => (typeof window !== 'undefined' ? window.StudyShell : null);

/** สูงพอดีกับส่วนหัวของหน้านี้ + ขอบโค้ง: ให้พื้นที่สีเขียวถาวรขยับตาม */
function fitGreenArea(root) {
    const head = root.querySelector('#cpHead');
    const s = shell();
    if (!head || !s || typeof s.setHeaderHeight !== 'function') return;
    const rect = head.getBoundingClientRect();
    s.setHeaderHeight(Math.round(rect.bottom + window.scrollY + 34));
}

function closePopovers(root, except = null) {
    root.querySelectorAll('.cp-pop-wrap').forEach((wrap) => {
        if (wrap === except) return;
        const owner = wrap.previousElementSibling;
        owner?.querySelector('.cp-node')?.setAttribute('aria-expanded', 'false');
        wrap.remove();
    });
}

function togglePopover(root, li) {
    const next = li.nextElementSibling;
    if (next && next.classList.contains('cp-pop-wrap')) { closePopovers(root); return; }
    closePopovers(root);
    const tpl = li.querySelector('template.cp-tpl');
    if (!tpl) return;
    const wrap = document.createElement('li');
    wrap.className = 'cp-pop-wrap';
    wrap.appendChild(tpl.content.cloneNode(true));
    li.after(wrap);
    li.querySelector('.cp-node').setAttribute('aria-expanded', 'true');
    if (!reducedMotion() && typeof wrap.animate === 'function') {
        wrap.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    if (typeof wrap.scrollIntoView === 'function') wrap.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/**
 * เติมหน้าเส้นทางเรียนลงใน container ของ Barba (หรือหน้าที่โหลดตรง)
 * @param {Element} root   container [data-barba-namespace="course"]
 * @param {{ api?: object, url?: string }} [options]  api / url เปลี่ยนได้เฉพาะในเทสต์ (url = ที่อยู่ของหน้านี้ รวม ?s=...)
 * @returns {Promise<{ dispose: () => void }>}
 */
export async function initCoursePage(root, { api = studyApi, url = typeof location !== 'undefined' ? location.href : '' } = {}) {
    const body = root.querySelector('#cpBody');
    const set = (sel, text) => { const el = root.querySelector(sel); if (el) el.textContent = text; };
    let disposed = false;
    const cleanups = [];

    let key = null;
    try { key = new URL(url, 'https://x.invalid/').searchParams.get('s'); } catch (_) { key = null; }
    if (!key || !SUBJECT_ID_RE.test(key)) {
        set('#cpTitle', 'ไม่พบวิชานี้');
        body.innerHTML = missingHtml('ไม่พบรายวิชานี้');
        fitGreenArea(root);
        return { dispose() {} };
    }

    async function load() {
        body.innerHTML = loadingHtml();
        let data;
        try {
            data = await api.getSubject(key);
        } catch (err) {
            if (disposed) return;
            if (err instanceof StudyApiError && err.status === 404) {
                set('#cpTitle', 'ไม่พบวิชานี้');
                body.innerHTML = missingHtml('ไม่พบรายวิชานี้');
            } else {
                set('#cpTitle', 'โหลดข้อมูลไม่สำเร็จ');
                body.innerHTML = failureHtml(err);
                body.querySelector('[data-act="retry"]')?.addEventListener('click', load);
            }
            fitGreenArea(root);
            return;
        }
        if (disposed) return;

        const h = headerView(data);
        root.classList.add(`hue-${/^[a-z]{3,12}$/.test(data.subject.hue || '') ? data.subject.hue : 'emerald'}`);
        set('#cpEyebrow', h.eyebrow);
        set('#cpTitle', h.title);
        set('#cpMeta', h.meta);
        set('#cpEmoji', h.emoji);
        document.title = `HEADFACE Study - ${h.title}`;
        body.innerHTML = courseBodyHtml(data);
        fitGreenArea(root);

        // วงกลมที่ "ถัดไป": เลื่อนให้มาอยู่กลางจอ (เฉพาะคนที่เริ่มเรียนแล้ว)
        const started = data.progress.lessonsDone > 0 || !!data.progress.lastActivityAt;
        const now = body.querySelector('.cp-n.is-now');
        if (started && now && typeof now.scrollIntoView === 'function') {
            setTimeout(() => { if (!disposed) now.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }); }, 450);
        }
    }

    const onClick = (e) => {
        const node = e.target.closest('.cp-node');
        if (node) { togglePopover(root, node.closest('.cp-n')); return; }
        if (!e.target.closest('.cp-pop')) closePopovers(root);
    };
    const onKey = (e) => { if (e.key === 'Escape') closePopovers(root); };
    const onResize = () => fitGreenArea(root);
    // กดย้อนกลับจากหน้ากิจกรรมแล้วเบราว์เซอร์คืนหน้านี้จากแคช (bfcache): โหลดความคืบหน้าใหม่ ไม่ให้ค้างค่าเก่า
    const onShow = (e) => { if (e && e.persisted && !disposed) load(); };
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('pageshow', onShow);
    cleanups.push(() => root.removeEventListener('click', onClick), () => document.removeEventListener('keydown', onKey), () => window.removeEventListener('resize', onResize), () => window.removeEventListener('pageshow', onShow));

    fitGreenArea(root);
    await load();
    return { dispose() { disposed = true; cleanups.forEach((fn) => fn()); } };
}

export { courseUrl };
