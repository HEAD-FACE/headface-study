/**
 * js/study-course.js — หน้าเส้นทางเรียนของวิชา (course.html?s=KEY) ในรูปแบบ "เส้นทางวงกลม"
 *
 * หน่วยการเรียนรู้แต่ละหน่วยเป็นเส้นทางของวงกลม วงกลม 1 วง = กิจกรรม 1 อย่าง: ชุดเนื้อหา (หลายหน้า) / Quiz 1 ชุด / Practice 1 ชุด
 * บทเรียนในหน่วยแยกกันด้วยสีและเส้นคั่น (สีประจำบท) แตะวงกลมเพื่อดูรายละเอียดแล้วกด "เริ่ม"
 * วงกลมที่ "ถัดไป" เด้งและมีป้ายเริ่ม ทุกวงเปิดได้เสมอ (ไม่ล็อก) ปลายเส้นทางคือ Mock Exam ประจำวิชา
 *
 * ข้อความบนหน้าให้น้อยที่สุด: วงกลมไม่มีข้อความกำกับ (บอกชนิดด้วยไอคอนและสี) ชื่อกับรายละเอียดอยู่ในการ์ดที่เด้งเมื่อแตะ
 * วงกลมเป็น SVG ชิ้นเดียว (วงแหวนความคืบหน้า + ตัววงกลมที่มีเงา 3 มิติ + ไอคอน) จึงอยู่กึ่งกลางเดียวกันเสมอ
 *
 * หน้านี้เปลี่ยนหน้าด้วย Barba ร่วมกับหน้าหลัก: พื้นที่สีเขียวด้านบน (#mainBlueBg) ต่อเนื่องจากหน้าก่อน
 * ฟังก์ชันที่สร้าง HTML ไม่แตะ DOM จึงทดสอบใน Node ได้ ส่วนเชื่อมกับหน้า (เอฟเฟกต์ เส้นทางประ ปุ่มลัด) อยู่ใน initCoursePage
 */
import { studyApi, StudyApiError } from './study-api.js';
import { esc } from './study-ui.js';
import { lessonHue } from './study-format.js';
import { SUBJECT_ID_RE, courseUrl, mockUrl, nodeUrl } from './study-live-common.js';
import { reducedMotion, countUp, pop } from './study-fx.js';

// ───────────── ไอคอน ─────────────
const svg = (inner, size = 30, w = 2.4) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const GLYPH = {
    content: '<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0"/><path d="M3 6l0 13"/><path d="M12 6l0 13"/><path d="M21 6l0 13"/>',
    quiz: '<path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11" fill="currentColor"/>',
    practice: '<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/>',
    mock: '<path d="M8 21l8 0"/><path d="M12 17l0 4"/><path d="M7 4l10 0"/><path d="M17 4v8a5 5 0 0 1 -10 0v-8"/><path d="M5 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M19 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>',
    check: '<path d="M5 12l5 5l10 -10"/>',
    back: '<path d="M15 6l-6 6l6 6"/>',
    down: '<path d="M6 9l6 6l6 -6"/>',
    up: '<path d="M6 15l6 -6l6 6"/>',
    next: '<path d="M9 6l6 6l-6 6"/>',
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

/** EXP ที่วงกลมนี้ให้ตอนนี้ (Backend คำนวณมาให้: ทำซ้ำได้ครึ่งเดียว) หรือ null ถ้าระบบรางวัลยังไม่เปิด / วงนี้ไม่ให้ */
const expOf = (node) => (node.reward && Number(node.reward.exp) > 0 ? { exp: Math.round(Number(node.reward.exp)), repeat: !!node.reward.repeat } : null);

/** เนื้อหาของการ์ดที่เด้งขึ้นใต้วงกลมเมื่อแตะ: ป้ายชนิด + EXP + ชื่อ + (ถ้ามี) สถานะบรรทัดเดียว + ปุ่ม */
export function nodeInfo(node, subjectId, lessonNo) {
    const p = node.progress || {};
    const href = nodeUrl(subjectId, lessonNo, node.id);
    if (node.type === 'content') {
        const started = p.pageReached > 0;
        return {
            chip: `เนื้อหา • ${node.pageCount || p.pageCount || 1} หน้า`,
            line: node.status === 'done' ? 'เรียนจบแล้ว ✓' : started ? `อ่านถึงหน้า ${p.pageReached + 1}/${p.pageCount || node.pageCount}` : '',
            label: node.status === 'done' ? 'ทบทวน' : started ? 'อ่านต่อ' : 'เริ่ม', href,
            exp: expOf(node),
        };
    }
    if (node.type === 'quiz') {
        const best = p.best ? `ดีที่สุด ${p.best.correct}/${p.best.total}` : '';
        return {
            chip: `Quiz • ${node.questionCount} ข้อ`,
            line: p.passed ? `ผ่านแล้ว ✓${best ? ` • ${best}` : ''}` : best,
            label: p.passed ? 'ทำอีกครั้ง' : p.attempts ? 'ลองอีกครั้ง' : 'เริ่ม', href,
            exp: expOf(node),
        };
    }
    return {
        chip: 'Practice • ไม่บังคับ',
        line: p.total ? `ทำแล้ว ${p.done}/${p.total} ข้อ` : 'ยังไม่มีโจทย์ฝึก',
        label: node.status === 'done' ? 'ทบทวน' : p.done ? 'ทำต่อ' : 'เริ่ม', href,
        exp: expOf(node),
    };
}

// ───────────── วงกลม (SVG ชิ้นเดียว) ─────────────
/**
 * วงกลมหนึ่งวง: ระบบพิกัด 100×100 วงแหวนความคืบหน้ากึ่งกลาง (50,50) ตัววงกลม (47) กับเงา 3 มิติ (54) อยู่เหนือ/ใต้จุดกึ่งกลางเท่ากัน
 * จึงดูสมมาตรกับวงแหวน กดแล้วตัววงกลมจมลงทับเงา (ดู css/course.css .cp-fg) ไอคอนเป็น <svg> ซ้อนที่ย้ายไปพร้อมตัววงกลม
 */
export function nodeSvg({ type, status, ring }) {
    const icon = status === 'done' ? 'check' : type;
    const stroke = status === 'done' ? 3.4 : 2.4;
    const showRing = ring > 0 && status !== 'done';
    const arc = showRing
        ? '<circle class="cp-track" cx="50" cy="50" r="46"/><circle class="cp-arc" cx="50" cy="50" r="46" pathLength="100" transform="rotate(-90 50 50)"/>'
        : '';
    const spark = status === 'done'
        ? '<g transform="translate(86 18)"><path class="cp-spark s1" d="M0 -7L2 -2L7 0L2 2L0 7L-2 2L-7 0L-2 -2Z"/></g><g transform="translate(12 74)"><path class="cp-spark s2" d="M0 -5L1.5 -1.5L5 0L1.5 1.5L0 5L-1.5 1.5L-5 0L-1.5 -1.5Z"/></g>'
        : '';
    return `<svg class="cp-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${arc}<circle class="cp-depth" cx="50" cy="54" r="35"/><g class="cp-fg"><circle class="cp-disc" cx="50" cy="47" r="35"/><path class="cp-gloss" d="M25.5 35.6A27 27 0 0 1 40.8 21.6"/><g class="cp-ico"><svg x="32" y="29" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${GLYPH[icon] || ''}</svg></g></g>${spark}</svg>`;
}

export function nodeHtml(node, { subjectId, lessonNo, index, seq }) {
    const info = nodeInfo(node, subjectId, lessonNo);
    const status = node.status || 'todo';
    const optional = node.type === 'practice';
    const ring = ringPercent(node);
    const dx = nodeOffset(index);
    const p = node.progress || {};
    const resumed = (node.type === 'content' && p.pageReached > 0) || (optional && p.done > 0);
    const off = ring > 0 && status !== 'done' ? `;--off:${100 - ring}` : '';
    return `<li class="cp-n is-${status}${optional ? ' is-optional' : ''}" data-kind="${esc(node.type)}" data-dx="${dx}" style="--dx:${dx}px;--i:${seq}${off}">
      <button type="button" class="cp-node" data-node="${esc(node.id)}" aria-expanded="false" aria-label="${esc(`${TYPE_LABEL[node.type] || ''} ${node.title} — ${nodeStatusText(status)}`)}">${nodeSvg({ type: node.type, status, ring })}</button>
      ${status === 'now' ? `<span class="cp-start" aria-hidden="true">${resumed ? 'ต่อ' : 'เริ่ม'}</span>` : ''}
      <template class="cp-tpl"><div class="cp-pop" role="dialog" aria-label="${esc(node.title)}" style="--dx:${dx}px">
        <div class="cp-pop-row"><span class="cp-pop-chip">${esc(info.chip)}</span>${info.exp ? `<span class="cp-pop-exp">+${info.exp.exp} EXP${info.exp.repeat ? ' • ทำซ้ำ' : ''}</span>` : ''}</div>
        <h3>${esc(node.title)}</h3>
        ${info.line ? `<p>${esc(info.line)}</p>` : ''}
        <a class="cp-go" href="${esc(info.href)}"><span>${esc(info.label)}</span>${glyph('next', 18, 3.2)}</a>
      </div></template>
    </li>`;
}

const trailSvg = '<svg class="cp-trail" aria-hidden="true" focusable="false"><path class="cp-trail-all"/><path class="cp-trail-done"/></svg>';

export function lessonHtml(lesson, { subjectId, hue, seqStart, indexStart }) {
    const nodes = lesson.nodes || [];
    const done = lesson.status === 'done';
    const doneNodes = nodes.filter((n) => n.status === 'done').length;
    let seq = seqStart;
    const items = nodes.map((n, k) => nodeHtml(n, { subjectId, lessonNo: lesson.no, index: indexStart + k, seq: seq++ })).join('');
    const label = `บทที่ ${lesson.no} ${lesson.title}${nodes.length ? ` เสร็จ ${doneNodes} จาก ${nodes.length} กิจกรรม` : ''}`;
    return `<div class="cp-lesson hue-${hue}${done ? ' is-done' : ''}" id="lesson-${lesson.no}" data-lesson="${lesson.no}">
      <div class="cp-lh" role="heading" aria-level="3" aria-label="${esc(label)}"><span class="cp-lline"></span><span class="cp-lchip"><i class="cp-lnum">${done ? glyph('check', 14, 3.6) : lesson.no}</i><span class="cp-lt">${esc(lesson.title)}</span>${nodes.length ? `<em class="cp-lc">${doneNodes}/${nodes.length}</em>` : ''}</span><span class="cp-lline"></span></div>
      ${nodes.length ? `<div class="cp-seq">${trailSvg}<ol class="cp-nodes">${items}</ol></div>` : '<p class="cp-empty">บทนี้ยังไม่มีกิจกรรม</p>'}
    </div>`;
}

export function unitHtml(unit) {
    const all = unit.doneCount === unit.lessonCount && unit.lessonCount > 0;
    return `<section class="cp-unit" id="unit-${unit.no}" aria-label="หน่วยที่ ${unit.no} ${esc(unit.title)}">
      <div class="cp-banner${all ? ' is-done' : ''}" style="--u:${pct(unit.doneCount, unit.lessonCount)}"><div><p class="cp-banner-k">หน่วยที่ ${unit.no} • ${unit.doneCount}/${unit.lessonCount} บท</p><h2>${esc(unit.title)}</h2></div><span class="cp-banner-i" aria-hidden="true">${all ? glyph('check', 22, 3.2) : glyph('content', 22, 2.2)}</span></div>
      ${unit.lessonsHtml}
    </section>`;
}

/** วงกลมใหญ่ท้ายเส้นทาง: Mock Exam ประจำวิชา */
export function mockHtml(mock, subjectId) {
    const caption = !mock.available ? 'ยังไม่เปิดให้สอบ' : mock.attempts ? `ทำแล้ว ${mock.attempts} ครั้ง • ล่าสุด ${mock.lastPercent}%` : 'จับเวลา • ตรวจเฉลย • ได้ดาว';
    const href = mockUrl(subjectId);
    const status = mock.available ? (mock.attempts ? 'done' : 'now') : 'todo';
    return `<section class="cp-unit cp-final" id="mock" aria-label="Mock Exam ประจำวิชา">
      <div class="cp-banner cp-banner-mock"><div><p class="cp-banner-k">ปลายทาง</p><h2>Mock Exam ประจำวิชา</h2></div><span class="cp-banner-i" aria-hidden="true">${glyph('mock', 22, 2.2)}</span></div>
      <div class="cp-seq"><ol class="cp-nodes"><li class="cp-n cp-trophy is-${status}" data-kind="mock" data-dx="0" style="--dx:0px;--i:0">
        <button type="button" class="cp-node" data-node="__mock" aria-expanded="false" aria-label="Mock Exam ประจำวิชา — ${esc(caption)}">${nodeSvg({ type: 'mock', status, ring: 0 })}</button>
        <template class="cp-tpl"><div class="cp-pop cp-pop-mock" role="dialog" aria-label="Mock Exam" style="--dx:0px">
          <span class="cp-pop-chip">Mock Exam • ทั้งวิชา</span><h3>Mock Exam ประจำวิชา</h3><p>${esc(caption)}</p>
          ${mock.available ? `<a class="cp-go" href="${esc(href)}"><span>${mock.attempts ? 'สอบอีกครั้ง' : 'เข้าสอบ'}</span>${glyph('next', 18, 3.2)}</a>` : '<span class="cp-go is-off">เร็ว ๆ นี้</span>'}
        </div></template>
      </li></ol></div>
    </section>`;
}

/** ส่วนหัว (ข้อความในแถบสีเขียว) จากข้อมูลวิชา: ตัวบนสุดเป็นลำดับวิชาสั้น ๆ ไม่ซ้ำกับชื่อ */
export function headerView(data) {
    const { subject, progress } = data;
    return {
        eyebrow: subject.no ? `วิชาที่ ${subject.no}` : '',
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
        <div class="cp-sum-row">
          <div class="cp-pring" role="img" aria-label="ความคืบหน้า ${progress.pct}%" style="--off:${100 - progress.pct}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="t" cx="18" cy="18" r="15.5"/><circle class="v" cx="18" cy="18" r="15.5" pathLength="100"/></svg><span class="num" data-count="${progress.pct}">${progress.pct}%</span></div>
          <div class="cp-sum-t"><p class="cp-sum-h">เรียนแล้ว ${progress.lessonsDone}/${progress.lessonsTotal} บท</p>${cta && cta.sub ? `<p class="cap cp-sum-cap">${esc(cta.sub)}</p>` : ''}</div>
        </div>
        ${cta ? `<a class="btn btn-lg btn-block cp-cta" href="${esc(cta.href)}"><span>${esc(cta.label)}</span>${glyph('next', 20, 3.2)}</a>` : ''}
      </section>
      ${aboutRows.length ? `<details class="cp-about"><summary><span>เกี่ยวกับวิชานี้</span><span class="cp-chev">${glyph('down', 18, 2.8)}</span></summary><dl>${aboutRows.map(([t, dd]) => `<div><dt>${t}</dt>${dd}</div>`).join('')}</dl></details>` : ''}
      <div class="cp-path">${unitHtmls || '<p class="cp-empty">วิชานี้ยังไม่มีบทเรียน</p>'}${mockHtml(mock, subject.id)}</div>
    </div>`;
}

/** โครงเปล่าระหว่างรอข้อมูล: ใกล้เคียงหน้าจริง จึงไม่กระโดดตอนข้อมูลมา */
export const skeletonHtml = () => `<div class="cp-in cp-sk" role="status" aria-live="polite" aria-busy="true"><span class="cp-sr">กำลังโหลดเส้นทางเรียน</span>
  <div class="cp-sum"><div class="cp-sum-row"><i class="cp-sk-c"></i><div class="cp-sk-t"><i class="cp-sk-l"></i><i class="cp-sk-l s"></i></div></div><i class="cp-sk-b"></i></div>
  <div class="cp-sk-path"><i class="cp-sk-ban"></i><i class="cp-sk-n" style="--dx:0px"></i><i class="cp-sk-n" style="--dx:34px"></i><i class="cp-sk-n" style="--dx:56px"></i></div>
</div>`;

const failureHtml = (err) => `<div class="cp-in"><section class="cp-state" role="alert"><h2>โหลดข้อมูลไม่สำเร็จ</h2><p>${esc(err instanceof StudyApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')}</p><div class="cp-state-act"><button type="button" class="btn" data-act="retry">ลองใหม่</button><a class="btn btn-line" href="subject.html">กลับไปหน้ารายวิชา</a></div></section></div>`;
const missingHtml = (message) => `<div class="cp-in"><section class="cp-state" role="alert"><h2>${esc(message)}</h2><p>ลิงก์อาจไม่ถูกต้อง หรือยังไม่มีข้อมูลของวิชานี้</p><div class="cp-state-act"><a class="btn" href="subject.html">กลับไปหน้ารายวิชา</a></div></section></div>`;

// ───────────── เส้นประเชื่อมวงกลม (คำนวณตำแหน่งจริงหลังจัดหน้า) ─────────────
const r1 = (n) => Math.round(n * 10) / 10;

/** เส้นโค้งตัว S ผ่านทุกจุด: จากจุดหนึ่งลงไปอีกจุดหนึ่งโดยเส้นสัมผัสแนวตั้งทั้งสองปลาย */
export function trailPath(points) {
    if (!Array.isArray(points) || points.length < 2) return '';
    let d = `M${r1(points[0].x)} ${r1(points[0].y)}`;
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        const my = (a.y + b.y) / 2;
        d += `C${r1(a.x)} ${r1(my)} ${r1(b.x)} ${r1(my)} ${r1(b.x)} ${r1(b.y)}`;
    }
    return d;
}

/** ส่วนของเส้นที่ "ออกจากวงที่เรียนจบแล้ว" วาดเป็นสีเข้ม (ความคืบหน้า) ส่วนที่เหลือเป็นจุดจาง */
export function trailDonePath(points) {
    if (!Array.isArray(points)) return '';
    const parts = [];
    for (let i = 0; i < points.length - 1; i++) {
        if (points[i].done) parts.push(trailPath([points[i], points[i + 1]]));
    }
    return parts.join('');
}

// ───────────── เชื่อมกับหน้า (DOM + Barba) ─────────────
const shell = () => (typeof window !== 'undefined' ? window.StudyShell : null);
const canObserve = () => typeof IntersectionObserver === 'function';

/** สูงพอดีกับส่วนหัวของหน้านี้ + ขอบโค้ง: ให้พื้นที่สีเขียวถาวรขยับตาม */
function fitGreenArea(root) {
    const head = root.querySelector('#cpHead');
    const s = shell();
    if (!head || !s || typeof s.setHeaderHeight !== 'function') return;
    const rect = head.getBoundingClientRect();
    s.setHeaderHeight(Math.round(rect.bottom + window.scrollY + 34));
}

/** การ์ดรายละเอียดใต้วงกลม: เปิด = ขยายนุ่ม ๆ ดันวงกลมข้างล่างลง ปิด = หดกลับแล้วถอดออก */
function closePopovers(root, except = null) {
    root.querySelectorAll('.cp-pop-wrap').forEach((wrap) => {
        if (wrap === except) return;
        const owner = wrap.previousElementSibling;
        owner?.querySelector('.cp-node')?.setAttribute('aria-expanded', 'false');
        wrap.classList.add('is-closing');
        if (!reducedMotion() && typeof wrap.animate === 'function') {
            wrap.style.overflow = 'hidden';
            const h = wrap.getBoundingClientRect().height;
            const a = wrap.animate([{ height: `${h}px`, opacity: 1, marginTop: '8px', marginBottom: '6px' }, { height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px' }], { duration: 200, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
            a.onfinish = () => wrap.remove();
        } else {
            wrap.remove();
        }
    });
}

function togglePopover(root, li) {
    const next = li.nextElementSibling;
    if (next && next.classList.contains('cp-pop-wrap') && !next.classList.contains('is-closing')) { closePopovers(root); return; }
    closePopovers(root);
    const tpl = li.querySelector('template.cp-tpl');
    if (!tpl) return;
    const wrap = document.createElement('li');
    wrap.className = 'cp-pop-wrap';
    wrap.appendChild(tpl.content.cloneNode(true));
    li.after(wrap);
    li.querySelector('.cp-node').setAttribute('aria-expanded', 'true');
    pop(li.querySelector('.cp-svg'), { scale: 1.1, ms: 300 });
    if (!reducedMotion() && typeof wrap.animate === 'function') {
        const h = wrap.getBoundingClientRect().height;
        wrap.style.overflow = 'hidden';
        const a = wrap.animate([{ height: '0px', opacity: 0, marginTop: '0px', marginBottom: '0px' }, { height: `${h}px`, opacity: 1, marginTop: '8px', marginBottom: '6px' }], { duration: 300, easing: 'cubic-bezier(.34,1.3,.64,1)' });
        a.onfinish = () => { wrap.style.overflow = ''; };
        wrap.querySelectorAll('.cp-pop > *').forEach((el, i) => {
            if (typeof el.animate === 'function') el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: 90 + i * 55, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        });
    }
    if (typeof wrap.scrollIntoView === 'function') setTimeout(() => wrap.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }), 60);
}

/** วงกลม/ป้าย/แบนเนอร์ค่อย ๆ เด้งเข้ามาเมื่อเลื่อนมาถึง (ไม่มี IntersectionObserver หรือผู้ใช้ปิดแอนิเมชัน = แสดงทันที) */
function revealOnScroll(scope) {
    const items = Array.from(scope.querySelectorAll('.cp-sum, .cp-banner, .cp-lh, .cp-n'));
    if (!items.length) return () => {};
    const sum = scope.querySelector('.cp-pring .num');
    if (reducedMotion() || !canObserve()) {
        items.forEach((el) => el.classList.add('is-in'));
        return () => {};
    }
    scope.classList.add('cp-anim');
    const io = new IntersectionObserver((entries) => {
        let k = 0;
        for (const e of entries) {
            if (!e.isIntersecting) continue;
            const el = e.target;
            el.style.setProperty('--d', `${Math.min(k++, 7) * 70}ms`);
            el.classList.add('is-in');
            io.unobserve(el);
            if (sum && el.classList.contains('cp-sum')) countUp(sum, Number(sum.dataset.count), { ms: 1100, format: (n) => `${n}%` });
        }
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
}

/** เส้นประเชื่อมวงกลมของแต่ละบท: วัดตำแหน่งจริง (offset ไม่ถูกแอนิเมชัน scale กระทบ) และวาดใหม่เมื่อความสูงเปลี่ยน (การ์ดเด้ง/หน้าจอหมุน) */
function drawTrails(scope) {
    scope.querySelectorAll('.cp-seq').forEach((seq) => {
        const svgEl = seq.querySelector('.cp-trail');
        const lis = Array.from(seq.querySelectorAll('.cp-n'));
        if (!svgEl || lis.length < 2) return;
        const half = seq.clientWidth / 2;
        const points = lis.map((li) => {
            const btn = li.querySelector('.cp-node');
            return { x: half + (Number(li.dataset.dx) || 0), y: li.offsetTop + btn.offsetTop + btn.offsetHeight * 0.5, done: li.classList.contains('is-done') };
        });
        svgEl.querySelector('.cp-trail-all').setAttribute('d', trailPath(points));
        svgEl.querySelector('.cp-trail-done').setAttribute('d', trailDonePath(points));
    });
}

function watchTrails(scope) {
    let queued = false;
    const draw = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; drawTrails(scope); });
    };
    draw();
    if (typeof ResizeObserver !== 'function') return () => {};
    const ro = new ResizeObserver(draw);
    scope.querySelectorAll('.cp-seq').forEach((seq) => ro.observe(seq));
    return () => ro.disconnect();
}

/** ปุ่มลอย "ไปวงถัดไป" เมื่อวงที่ต้องทำอยู่นอกจอ (ชี้ขึ้น/ลงตามทิศ) */
function watchJump(nowEl, hueClass) {
    if (!nowEl || !canObserve() || typeof document === 'undefined' || !document.body) return () => {};
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cp-jump ${hueClass}`;
    btn.hidden = true;
    btn.innerHTML = `<span>วงถัดไป</span><i>${glyph('down', 18, 3.2)}</i>`;
    document.body.appendChild(btn);
    const io = new IntersectionObserver(([entry]) => {
        const visible = entry.isIntersecting;
        btn.hidden = visible;
        btn.dataset.dir = entry.boundingClientRect.top < 0 ? 'up' : 'down';
    }, { threshold: 0.6 });
    io.observe(nowEl);
    btn.addEventListener('click', () => nowEl.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }));
    return () => { io.disconnect(); btn.remove(); };
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
    let stopFx = () => {};
    const cleanups = [];

    let key = null;
    try { key = new URL(url, 'https://x.invalid/').searchParams.get('s'); } catch (_) { key = null; }
    if (!key || !SUBJECT_ID_RE.test(key)) {
        set('#cpTitle', 'ไม่พบวิชานี้');
        body.innerHTML = missingHtml('ไม่พบรายวิชานี้');
        fitGreenArea(root);
        return { dispose() {} };
    }

    /** เติมเอฟเฟกต์หลังวาดหน้า (เฉพาะเบราว์เซอร์จริง: องค์ประกอบ DOM ต้องมี querySelectorAll) */
    function enhance(data, animate) {
        const scope = body.firstElementChild;
        if (!scope || typeof scope.querySelectorAll !== 'function') return;
        const stops = [];
        if (animate) stops.push(revealOnScroll(scope));
        else scope.querySelectorAll('.cp-sum, .cp-banner, .cp-lh, .cp-n').forEach((el) => el.classList.add('is-in'));
        stops.push(watchTrails(scope));
        const hue = /^[a-z]{3,12}$/.test(data.subject.hue || '') ? data.subject.hue : 'emerald';
        stops.push(watchJump(scope.querySelector('.cp-n.is-now'), `hue-${hue}`));
        stopFx = () => { stops.forEach((fn) => fn()); stopFx = () => {}; };
    }

    /** quiet = โหลดซ้ำเงียบ ๆ (กลับมาจากแคชของเบราว์เซอร์): ไม่ล้างหน้าเป็นโครงเปล่า ไม่เล่นแอนิเมชันเข้าฉากซ้ำ */
    async function load({ quiet = false } = {}) {
        if (!quiet) body.innerHTML = skeletonHtml();
        let data;
        try {
            data = await api.getSubject(key);
        } catch (err) {
            if (disposed) return;
            if (quiet) return; // ข้อมูลเดิมยังใช้ได้ ไม่ทับด้วยหน้าข้อผิดพลาด
            if (err instanceof StudyApiError && err.status === 404) {
                set('#cpTitle', 'ไม่พบวิชานี้');
                body.innerHTML = missingHtml('ไม่พบรายวิชานี้');
            } else {
                set('#cpTitle', 'โหลดข้อมูลไม่สำเร็จ');
                body.innerHTML = failureHtml(err);
                body.querySelector('[data-act="retry"]')?.addEventListener('click', () => load());
            }
            fitGreenArea(root);
            return;
        }
        if (disposed) return;

        stopFx();
        const h = headerView(data);
        root.classList.add(`hue-${/^[a-z]{3,12}$/.test(data.subject.hue || '') ? data.subject.hue : 'emerald'}`);
        set('#cpEyebrow', h.eyebrow);
        set('#cpTitle', h.title);
        set('#cpMeta', h.meta);
        set('#cpEmoji', h.emoji);
        document.title = `HEADFACE Study - ${h.title}`;
        body.innerHTML = courseBodyHtml(data);
        fitGreenArea(root);
        enhance(data, !quiet);

        // วงกลมที่ "ถัดไป": เลื่อนให้มาอยู่กลางจอ (เฉพาะคนที่เริ่มเรียนแล้ว)
        const started = data.progress.lessonsDone > 0 || !!data.progress.lastActivityAt;
        const now = body.querySelector('.cp-n.is-now');
        if (!quiet && started && now && typeof now.scrollIntoView === 'function') {
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
    // กดย้อนกลับจากหน้ากิจกรรมแล้วเบราว์เซอร์คืนหน้านี้จากแคช (bfcache): โหลดความคืบหน้าใหม่แบบเงียบ ๆ ไม่ให้ค้างค่าเก่า
    const onShow = (e) => { if (e && e.persisted && !disposed) load({ quiet: true }); };
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    window.addEventListener('pageshow', onShow);
    cleanups.push(() => root.removeEventListener('click', onClick), () => document.removeEventListener('keydown', onKey), () => window.removeEventListener('resize', onResize), () => window.removeEventListener('pageshow', onShow));

    fitGreenArea(root);
    await load();
    return { dispose() { disposed = true; stopFx(); cleanups.forEach((fn) => fn()); } };
}

export { courseUrl };
