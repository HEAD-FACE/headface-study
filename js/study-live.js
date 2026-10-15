/**
 * js/study-live.js — หน้าเรียนด้วยข้อมูลจริงจาก Backend (สัญญา: docs/study-api-contract.md)
 * ใช้กับ course.html / lesson.html / mock-exam.html (เลือกโดย js/study-flow.js)
 *
 * ส่วนที่ Backend ยังไม่เปิด (Quiz, Practice, Mock Exam, บันทึกอ่านจบ) ปิดไว้ด้วย FEATURES
 * และแสดงข้อความ "เร็ว ๆ นี้" แทนการแสดงข้อมูลปลอม — เปิดทีละส่วนเมื่อ endpoint ของส่วนนั้นพร้อม
 */
import { studyApi, StudyApiError } from './study-api.js';
import { $, esc, params, content, view, ICON, notFound, setTheme } from './study-ui.js';
import { createQuiz } from './study-live-quiz.js';
import { createPractice } from './study-live-practice.js';
import { initMockExam } from './study-live-mock.js';
import { initReport } from './study-live-report.js';
import { SUBJECT_ID_RE, courseUrl, failure, lessonUrl, loading, mockUrl, soonPanel } from './study-live-common.js';

export const FEATURES = Object.freeze({ progress: true, quiz: true, practice: true, mock: true });

export { courseUrl, lessonUrl };

const metaOf = (subject, lessonsTotal) => subject.metaText || (lessonsTotal ? `${lessonsTotal} บทเรียน` : '');

// ============================================================
// หน้ารายละเอียดวิชา (course.html?s=KEY)
// ============================================================
export async function initCourse() {
    const key = params.get('s');
    if (!key || !SUBJECT_ID_RE.test(key)) return notFound('ไม่พบรายวิชานี้', 'subject.html', 'กลับไปหน้ารายวิชา');
    loading();

    let data;
    try {
        data = await studyApi.getSubject(key);
    } catch (err) {
        return failure(err, { missing: 'ไม่พบรายวิชานี้', backHref: 'subject.html', backLabel: 'กลับไปหน้ารายวิชา', retry: initCourse });
    }

    const { subject, progress, current, units, mock } = data;
    setTheme(subject);
    document.title = `HEADFACE Study - ${subject.title}`;
    $('#eyebrow').textContent = subject.eyebrow || '';
    $('#pageTitle').textContent = subject.title;
    $('#pageMeta').textContent = metaOf(subject, progress.lessonsTotal);

    let openUnit = (units.find((u) => current && u.lessons.some((l) => l.no === current.no)) || units[0] || { no: 0 }).no;
    let focusUnit = null;
    const started = progress.lessonsDone > 0 || !!progress.lastActivityAt;

    const lessonRow = (l) => {
        const icon = l.status === 'done' ? ICON.lessonDone : l.status === 'now' ? ICON.lessonNow : ICON.lessonTodo;
        const stText = l.status === 'done' ? 'เรียนแล้ว' : l.status === 'now' ? 'กำลังเรียน' : 'ยังไม่เริ่ม';
        const a = l.activities;
        const minis = [`<span class="mini${a.content.done ? ' ok' : ''}">เนื้อหา</span>`];
        if (FEATURES.quiz) minis.push(`<span class="mini${a.quiz.done ? ' ok' : ''}">Quiz</span>`);
        if (FEATURES.practice) minis.push(`<span class="mini${a.practice.total && a.practice.done >= a.practice.total ? ' ok' : ''}">Practice</span>`);
        return `<a class="ls" href="${lessonUrl(subject.id, l.no)}">
          <span class="ls-i">${icon}</span>
          <div class="ls-b">
            <p class="ls-n">บทที่ ${l.no} ${esc(l.title)}</p>
            <p class="ls-st st-${l.status}">${stText}</p>
            <div class="minis">${minis.join('')}</div>
          </div>
        </a>`;
    };

    const unitCard = (u) => {
        const open = u.no === openUnit;
        const complete = u.lessonCount > 0 && u.doneCount === u.lessonCount;
        return `<section class="unit-card">
          <button type="button" class="unit-h" id="unit-btn-${u.no}" data-unit="${u.no}" aria-expanded="${open}" aria-controls="unit-${u.no}">
            <span class="unit-badge${complete ? ' done' : ''}">${complete ? ICON.check(18) : u.no}</span>
            <span class="unit-t"><span class="unit-n">หน่วยที่ ${u.no}</span><span class="unit-s">${esc(u.title)}</span></span>
            <span class="unit-c">${u.doneCount}/${u.lessonCount}</span>
            <span class="chev${open ? ' up' : ''}">${ICON.down(20)}</span>
          </button>
          ${open ? `<div class="lessons" id="unit-${u.no}">${u.lessons.map(lessonRow).join('')}</div>` : ''}
        </section>`;
    };

    const aboutRows = [
        subject.description && ['คำอธิบายวิชา', `<dd style="white-space:pre-line">${esc(subject.description)}</dd>`],
        subject.objectives && subject.objectives.length && ['วัตถุประสงค์การเรียนรู้', `<dd><ul class="about-list">${subject.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></dd>`],
        subject.level && ['ระดับชั้น / ระดับความยาก', `<dd>${esc(subject.level)}</dd>`],
    ].filter(Boolean);

    const mockCard = () => {
        const caption = !mock.available ? 'ยังไม่เปิดให้สอบ'
            : !FEATURES.mock ? 'เปิดให้ทำเร็ว ๆ นี้'
            : mock.attempts ? `ทำแล้ว ${mock.attempts} ครั้ง • คะแนนล่าสุด ${mock.lastPercent}%` : 'ยังไม่เคยทำ • ดูรายละเอียดและเงื่อนไขก่อนเริ่มสอบ';
        return `<section class="mock" aria-label="Mock Exam ประจำวิชา">
          <div class="mock-top">
            <span class="mock-tile">${ICON.star(24)}</span>
            <div><h3>Mock Exam ประจำวิชา</h3><p class="cap">${caption}</p></div>
          </div>
          ${mock.available && FEATURES.mock
            ? `<a class="mock-btn" href="mock-exam.html?s=${encodeURIComponent(subject.id)}"><span>เข้าสอบ Mock Exam</span></a>`
            : '<span class="mock-btn" aria-disabled="true"><span>เร็ว ๆ นี้</span></span>'}
        </section>`;
    };

    function render() {
        const cta = current
            ? `<a class="btn btn-lg btn-block" href="${lessonUrl(subject.id, current.no)}"><span>${started ? 'เรียนต่อ' : 'เริ่มเรียน'}</span>${ICON.next(14)}</a>`
            : (progress.lessonsTotal ? `<a class="btn btn-lg btn-block" href="${lessonUrl(subject.id, 1)}"><span>ทบทวนบทเรียน</span>${ICON.next(14)}</a>` : '');
        content.innerHTML = `
          <div style="margin-top:18px">
            <section class="sum" aria-label="ความคืบหน้าของวิชา">
              <div class="sum-top">
                <p class="sum-pct"><span class="num">${progress.pct}%</span><span class="cap">ความคืบหน้า</span></p>
                <p class="cap">เรียนแล้ว ${progress.lessonsDone} จาก ${progress.lessonsTotal} บทเรียน</p>
              </div>
              <div class="bar" aria-hidden="true"><i style="width:${progress.pct}%"></i></div>
              ${cta}
              <p class="cap sum-cap">${current ? `บทที่ ${current.no} • ${esc(current.title)}` : 'เรียนครบทุกบทแล้ว'}</p>
            </section>
          </div>

          ${aboutRows.length ? `<details class="about" style="margin-top:14px">
            <summary>${ICON.info(18)}<span>เกี่ยวกับวิชานี้</span><span class="chev">${ICON.down(20)}</span></summary>
            <dl class="about-body">${aboutRows.map(([t, dd]) => `<div class="about-row"><dt>${t}</dt>${dd}</div>`).join('')}</dl>
          </details>` : ''}

          <section class="fsec" aria-labelledby="h-out">
            <div class="fsec-h"><span class="tile tile-sky" style="width:32px;height:32px;border-radius:10px"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.5 5.134a1 1 0 0 1 .493 .748l.007 .118v13a1 1 0 0 1 -1.5 .866a8 8 0 0 0 -7.5 -.266v-15.174a10 10 0 0 1 8.5 .708m-10.5 -.707l.001 15.174a8 8 0 0 0 -7.234 .117l-.327 .18l-.103 .044l-.049 .016l-.11 .026l-.061 .01l-.117 .006h-.042l-.11 -.012l-.077 -.014l-.108 -.032l-.126 -.056l-.095 -.056l-.089 -.067l-.06 -.056l-.073 -.082l-.064 -.089l-.022 -.036l-.032 -.06l-.044 -.103l-.016 -.049l-.026 -.11l-.01 -.061l-.004 -.049l-.002 -13.068a1 1 0 0 1 .5 -.866a10 10 0 0 1 8.5 -.707"/></svg></span><h2 id="h-out">บทเรียน</h2></div>
            <div class="units">${units.map(unitCard).join('')}</div>
          </section>

          ${mockCard()}`;

        if (focusUnit) {
            const btn = $(`#unit-btn-${focusUnit}`);
            if (btn) btn.focus({ preventScroll: true });
            focusUnit = null;
        }
    }

    content.onclick = (e) => {
        const btn = e.target.closest('[data-unit]');
        if (!btn) return;
        const n = Number(btn.dataset.unit);
        openUnit = openUnit === n ? 0 : n; // เปิดทีละหน่วย กดซ้ำเพื่อปิด
        focusUnit = n;
        render();
    };

    render();
}

// ============================================================
// หน้าบทเรียน (lesson.html?s=KEY&l=N|current&tab=content|quiz|practice)
// ============================================================
const VIDEO_FILE_RE = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;
const isHttps = (url) => typeof url === 'string' && /^https:\/\//i.test(url);
const multiline = (text) => `<span style="white-space:pre-line">${esc(text)}</span>`;

function figureHtml(b) {
    if (!isHttps(b.url)) return '';
    const cap = b.caption ? `<p class="cap rcap">${esc(b.caption)}</p>` : '';
    if (b.kind === 'image') {
        return `<figure class="rfig has-media"><img src="${esc(b.url)}" alt="${esc(b.alt || '')}" loading="lazy" decoding="async"></figure>${cap}`;
    }
    const media = VIDEO_FILE_RE.test(b.url)
        ? `<video controls preload="metadata" playsinline src="${esc(b.url)}" aria-label="${esc(b.caption || 'วิดีโอประกอบบทเรียน')}"></video>`
        : `<a class="btn btn-line" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">เปิดวิดีโอการสอน</a>`;
    return `<figure class="rfig has-media">${media}</figure>${cap}`;
}

/** แปลงรายการบล็อกของบทเรียนเป็น HTML (ข้อความทุกช่องผ่าน esc; ลิงก์สื่อต้องเป็น https) */
export function blocksHtml(blocks, { unitLabel, lessonNo }) {
    const out = [];
    let article = null;
    const open = () => {
        if (!article) {
            article = [`<article class="rblock">`];
            if (out.length === 0) article.push(`<div class="rmeta"><span class="chip chip-g">เนื้อหา</span><span class="chip" style="background:var(--chip);color:var(--strong)">บทที่ ${lessonNo}</span>${unitLabel ? `<span class="chip" style="background:var(--chip);color:var(--strong)">${esc(unitLabel)}</span>` : ''}</div>`);
        }
    };
    const close = () => { if (article) { article.push('</article>'); out.push(article.join('')); article = null; } };

    for (const b of blocks) {
        if (b.type === 'heading') { open(); article.push(`<h2 class="rh">${esc(b.text)}</h2>`); }
        else if (b.type === 'paragraph') { open(); article.push(`<p class="rp">${multiline(b.text)}</p>`); }
        else if (b.type === 'figure') { open(); article.push(figureHtml(b)); }
        else if (b.type === 'callout') {
            close();
            out.push(`<aside class="rblock callout" style="box-shadow:none">${b.title ? `<h3>${ICON.star(16)} ${esc(b.title)}</h3>` : ''}<p>${multiline(b.text)}</p></aside>`);
        } else if (b.type === 'steps') {
            close();
            out.push(`<article class="rblock">${b.title ? `<h2 class="rh">${esc(b.title)}</h2>` : ''}<ol class="steps">${b.items.map((t) => `<li>${multiline(t)}</li>`).join('')}</ol></article>`);
        } else if (b.type === 'checklist') {
            close();
            out.push(`<article class="rblock">${b.title ? `<h2 class="rh">${esc(b.title)}</h2>` : ''}<ul class="checks">${b.items.map((t) => `<li>${ICON.check(20)}<span>${multiline(t)}</span></li>`).join('')}</ul></article>`);
        }
    }
    close();
    return out.join('');
}


export async function initLesson() {
    const key = params.get('s');
    const raw = params.get('l') ?? 'current';
    if (!key || !SUBJECT_ID_RE.test(key)) return notFound('ไม่พบรายวิชานี้', 'subject.html', 'กลับไปหน้ารายวิชา');
    if (raw !== 'current' && !/^[1-9]\d{0,3}$/.test(raw)) return notFound('ไม่พบบทเรียนนี้', courseUrl(key), 'กลับไปหน้ารายละเอียดวิชา');
    $('#backLink').href = courseUrl(key);
    loading();

    let data;
    try {
        data = await studyApi.getLesson(key, raw);
    } catch (err) {
        return failure(err, { missing: 'ไม่พบบทเรียนนี้', backHref: courseUrl(key), backLabel: 'กลับไปหน้ารายละเอียดวิชา', retry: initLesson });
    }

    const { subject, lesson } = data;
    setTheme(subject);
    document.title = `HEADFACE Study - บทที่ ${lesson.no} ${lesson.title}`;
    $('#eyebrow').textContent = `บทที่ ${lesson.no} • ${subject.title}`;
    $('#pageTitle').textContent = lesson.title;
    if (raw === 'current') history.replaceState(null, '', lessonUrl(subject.id, lesson.no, params.get('tab') || 'content')); // URL ที่แชร์/รีโหลดได้ชี้บทเดิมเสมอ

    const TABS = [['content', 'เนื้อหา'], ['quiz', 'Quiz'], ['practice', 'Practice']];
    let tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'content';
    let readBusy = false;
    let readError = null;

    const nextHref = lesson.nav.next ? lessonUrl(subject.id, lesson.nav.next.no) : null;
    const quiz = FEATURES.quiz ? createQuiz({
        subject, lesson, api: studyApi, render: (opts) => render(opts), nextHref, courseHref: courseUrl(subject.id),
        applyProgress: (patch) => { lesson.progress.status = patch.status; lesson.progress.quiz = patch.quiz; },
    }) : null;

    const practice = FEATURES.practice ? createPractice({
        subject, lesson, api: studyApi, render: (opts) => render(opts),
        applySummary: (summary) => { lesson.progress.practice = { ...summary }; },
    }) : null;

    const tabStatus = () => ({
        content: lesson.progress.contentReadAt ? 'อ่านแล้ว' : FEATURES.progress ? 'ยังไม่อ่าน' : 'ดูเนื้อหา',
        quiz: FEATURES.quiz ? (lesson.progress.quiz.best ? `${lesson.progress.quiz.best.correct}/${lesson.progress.quiz.best.total}` : 'ยังไม่ทำ') : 'เร็ว ๆ นี้',
        practice: FEATURES.practice ? `${lesson.progress.practice.done}/${lesson.progress.practice.total}` : 'เร็ว ๆ นี้',
    });
    const renderTabs = () => {
        const st = tabStatus();
        return `<div class="tabs" role="tablist" aria-label="กิจกรรมในบทเรียน">${TABS.map(([k, label]) =>
            `<button type="button" class="tab" role="tab" id="tab-${k}" aria-selected="${tab === k}" aria-controls="panel" data-tab="${k}"><span>${label}</span><small>${esc(st[k])}</small></button>`).join('')}</div>`;
    };

    const navLink = (target, cls, label) => target
        ? `<a class="lnav-a ${cls}" href="${lessonUrl(subject.id, target.no)}"><span class="cap">${label}</span><b>บทที่ ${target.no} ${esc(target.title)}</b></a>`
        : `<span class="lnav-a ${cls}" aria-disabled="true"><span class="cap">${label}</span><b>—</b></span>`;

    function doneBlock() {
        if (!FEATURES.progress) return '<p class="cap" style="text-align:center">การบันทึกความคืบหน้า Quiz และแบบฝึกหัดของบทนี้จะเปิดให้ใช้เร็ว ๆ นี้</p>';
        const read = !!lesson.progress.contentReadAt;
        const finished = lesson.progress.status === 'done';
        return `<div class="rdone">
          <button type="button" class="btn btn-lg btn-block ${read ? 'btn-done' : 'btn-line'}" data-act="toggle-read" aria-pressed="${read}" style="margin-top:0"${readBusy ? ' disabled' : ''}>${readBusy ? '<span>กำลังบันทึก...</span>' : read ? `${ICON.check(18)}<span>อ่านจบแล้ว (กดอีกครั้งเพื่อยกเลิก)</span>` : '<span>ทำเครื่องหมายว่าอ่านจบแล้ว</span>'}</button>
          ${readError ? `<p class="errbox" role="alert">${esc(readError)}</p>` : ''}
          <p class="cap" style="text-align:center">${finished ? 'บทนี้เสร็จสมบูรณ์แล้ว (อ่านจบและผ่าน Quiz)' : 'การอ่านจบยังไม่ถือว่าบทเรียนสำเร็จ — ต้องผ่าน Quiz เพื่อตรวจความเข้าใจด้วย'}</p>
          ${FEATURES.quiz ? `<button type="button" class="btn btn-lg btn-block" data-tab="quiz" style="margin-top:0"><span>ไปทำ Quiz ท้ายบท</span>${ICON.next(14)}</button>` : ''}
        </div>`;
    }

    function contentPanel() {
        return `<div class="read fade-in">
          ${blocksHtml(lesson.blocks, { unitLabel: lesson.unit && lesson.unit.title ? `หน่วยที่ ${lesson.unit.no}` : '', lessonNo: lesson.no }) || '<p class="empty-p">บทนี้ยังไม่มีเนื้อหา</p>'}
          ${doneBlock()}
          <nav class="lnav" aria-label="เปลี่ยนบทเรียน">${navLink(lesson.nav.prev, 'prev', 'บทก่อนหน้า')}${navLink(lesson.nav.next, 'next', 'บทถัดไป')}</nav>
        </div>`;
    }

    function render({ focus = false } = {}) {
        const panel = tab === 'content' ? contentPanel()
            : tab === 'quiz' ? (quiz ? quiz.html() : soonPanel('Quiz ท้ายบท', 'ระบบตรวจความเข้าใจท้ายบทกำลังเตรียมเปิดให้ใช้ ระหว่างนี้อ่านเนื้อหาของบทได้ก่อน'))
            : (practice ? practice.html() : soonPanel('Practice', 'โจทย์ฝึกเพิ่มเติมของบทนี้กำลังเตรียมเปิดให้ใช้ ระหว่างนี้อ่านเนื้อหาของบทได้ก่อน'));
        content.innerHTML = `${renderTabs()}<div class="panel" id="panel" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="-1">${panel}</div>`;
        if (view) view.classList.toggle('has-abar', tab === 'quiz' && !!quiz && quiz.hasAbar());
        if (tab === 'quiz' && quiz) quiz.afterRender(content);
        if (focus) $('#panel').focus({ preventScroll: true });
        if (tab === 'practice' && practice) practice.open(); // โหลดโจทย์ครั้งแรกที่เปิดแท็บ
    }

    async function toggleRead() {
        if (readBusy) return;
        readBusy = true;
        readError = null;
        render();
        try {
            const { progress } = await studyApi.setRead(subject.id, lesson.no, !lesson.progress.contentReadAt);
            lesson.progress = { ...lesson.progress, ...progress };
        } catch (err) {
            readError = err instanceof StudyApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
        } finally {
            readBusy = false;
            render();
            $('[data-act="toggle-read"]')?.focus({ preventScroll: true });
        }
    }

    function setTab(next) {
        if (next === tab) return;
        tab = next;
        const url = new URL(location.href);
        if (tab === 'content') url.searchParams.delete('tab'); else url.searchParams.set('tab', tab);
        history.replaceState(null, '', url);
        window.scrollTo(0, 0);
        render({ focus: true });
    }

    content.onclick = (e) => {
        const tabBtn = e.target.closest('[data-tab]');
        if (tabBtn) return setTab(tabBtn.dataset.tab);
        if (e.target.closest('[data-act="toggle-read"]')) return toggleRead();
        if (tab === 'quiz' && quiz) quiz.handleClick(e);
        else if (tab === 'practice' && practice) practice.handleClick(e);
    };

    render();
}

// หน้า Mock Exam (mock-exam.html[?s=KEY]) อยู่ใน js/study-live-mock.js
export const initExam = initMockExam;

export function initLive(page) {
    const init = { course: initCourse, lesson: initLesson, exam: initExam, report: initReport }[page];
    if (init) return init();
}
