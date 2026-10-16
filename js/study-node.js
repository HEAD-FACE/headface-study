/**
 * js/study-node.js — หน้ากิจกรรมหนึ่งวงกลมของเส้นทางเรียน (lesson.html?s=KEY&l=N&n=NODE_ID)
 *
 * กิจกรรมมี 3 ชนิด และเปิดทีละอย่าง: ชุดเนื้อหา (หลายหน้า) / Quiz 1 ชุด / Practice 1 ชุด
 * ลิงก์เก่า lesson.html?s=KEY&l=N[&tab=quiz|practice] ที่ไม่ระบุ node ระบบเลือกกิจกรรมให้ (ชนิดตาม tab หรือกิจกรรมถัดไปที่ต้องทำ)
 */
import { studyApi } from './study-api.js';
import { $, params, content, view, notFound, setTheme, focusView } from './study-ui.js';
import { lessonHue } from './study-format.js';
import { NODE_ID_RE, SUBJECT_ID_RE, courseUrl, failure, lessonUrl, loading, nodeUrl } from './study-live-common.js';
import { createContent } from './study-live-content.js';
import { createQuiz } from './study-live-quiz.js';
import { createPractice } from './study-live-practice.js';
import { installImageZoom } from './study-media.js';

const TYPE_LABEL = { content: 'เนื้อหา', quiz: 'Quiz', practice: 'Practice' };
export const nodeTypeLabel = (type) => TYPE_LABEL[type] || '';

/** เลือกกิจกรรมของบทเมื่อลิงก์ไม่ระบุ node: ชนิดตาม tab ก่อน ไม่งั้นกิจกรรมที่ระบบบอกว่า "ถัดไป" ไม่งั้นกิจกรรมแรกที่ยังไม่เสร็จ */
export function pickNode(nodes, tab) {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;
    if (tab === 'quiz' || tab === 'practice') {
        const byType = nodes.find((n) => n.type === tab);
        if (byType) return byType;
    }
    if (tab === 'content') return nodes.find((n) => n.type === 'content') || nodes[0];
    return nodes.find((n) => n.status === 'now') || nodes.find((n) => n.status !== 'done' && n.type !== 'practice') || nodes[0];
}

/** @param {{ api?: object }} [options]  api เปลี่ยนได้เฉพาะในเทสต์ */
export async function initNode({ api = studyApi } = {}) {
    const key = params.get('s');
    let lessonRaw = params.get('l') ?? 'current';
    let nodeId = params.get('n');
    if (!key || !SUBJECT_ID_RE.test(key)) return notFound('ไม่พบรายวิชานี้', 'subject.html', 'กลับไปหน้ารายวิชา');
    if (lessonRaw !== 'current' && !/^[1-9]\d{0,3}$/.test(lessonRaw)) return notFound('ไม่พบบทเรียนนี้', courseUrl(key), 'กลับไปเส้นทางเรียน');
    if (nodeId !== null && !NODE_ID_RE.test(nodeId)) return notFound('ไม่พบกิจกรรมนี้', courseUrl(key), 'กลับไปเส้นทางเรียน');
    $('#backLink').href = courseUrl(key);
    installImageZoom();
    loading();

    let data;
    try {
        if (!nodeId) {
            const { lesson } = await api.getLesson(key, lessonRaw);
            const picked = pickNode(lesson.nodes, params.get('tab'));
            if (!picked) return notFound('บทนี้ยังไม่มีกิจกรรม', courseUrl(key), 'กลับไปเส้นทางเรียน');
            nodeId = picked.id;
            lessonRaw = String(lesson.no);
            history.replaceState(null, '', nodeUrl(key, lesson.no, nodeId)); // URL ที่แชร์/รีโหลดได้ชี้กิจกรรมเดิมเสมอ
        }
        data = await api.getNode(key, lessonRaw, nodeId);
    } catch (err) {
        return failure(err, { missing: 'ไม่พบกิจกรรมนี้', backHref: courseUrl(key), backLabel: 'กลับไปเส้นทางเรียน', retry: () => initNode({ api }) });
    }

    const { subject, lesson, node, nav } = data;
    setTheme({ hue: lessonHue(lesson.no) });
    document.title = `HEADFACE Study - ${node.title}`;
    $('#eyebrow').textContent = `บทที่ ${lesson.no} • ${lesson.title}`;
    $('#pageTitle').textContent = node.title;

    const courseHref = courseUrl(subject.id);
    const nextHref = nav.next ? nodeUrl(subject.id, nav.next.lessonNo, nav.next.nodeId) : null;
    const render = (opts) => draw(opts);

    let controller;
    if (node.type === 'content') {
        controller = createContent({ subject, lessonNo: lesson.no, node, api, render, nextHref, courseHref });
    } else if (node.type === 'quiz') {
        controller = createQuiz({
            subject, lessonNo: lesson.no, node, api, render, nextHref, courseHref,
            reviewHref: lessonUrl(subject.id, lesson.no, 'content'),
            applyProgress: (done) => { if (done.node && done.node.progress) node.progress = done.node.progress; },
        });
    } else {
        controller = createPractice({ subject, lessonNo: lesson.no, node, api, render, applySummary: () => {} });
    }

    function draw({ focus = false } = {}) {
        content.innerHTML = controller.html();
        if (view) view.classList.toggle('has-abar', !!(controller.hasAbar && controller.hasAbar()));
        if (controller.afterRender) controller.afterRender(content);
        if (focus) focusView();
    }

    content.onclick = (e) => controller.handleClick(e);

    // ปัดซ้าย/ขวา หรือกดลูกศร เพื่อเปลี่ยนหน้าของชุดเนื้อหา
    if (controller.step && typeof content.addEventListener === 'function') {
        let x0 = null;
        let y0 = null;
        content.addEventListener('touchstart', (e) => { const t = e.touches && e.touches[0]; x0 = t ? t.clientX : null; y0 = t ? t.clientY : null; }, { passive: true });
        content.addEventListener('touchend', (e) => {
            const t = e.changedTouches && e.changedTouches[0];
            if (x0 === null || !t) return;
            const dx = t.clientX - x0;
            const dy = t.clientY - y0;
            x0 = null;
            if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) controller.step(dx < 0 ? 1 : -1);
        }, { passive: true });
        document.addEventListener('keydown', (e) => {
            if (e.target && /^(input|textarea|select)$/i.test(e.target.tagName || '')) return;
            if (e.key === 'ArrowRight') controller.step(1);
            else if (e.key === 'ArrowLeft') controller.step(-1);
        });
    }

    draw();
    if (controller.open) controller.open(); // Practice โหลดโจทย์ครั้งแรกเมื่อเปิดหน้า
    return { node, controller };
}
