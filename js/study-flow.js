/**
 * js/study-flow.js — ตัวควบคุมหน้าเรียน (ใช้ร่วมกันโดย course.html / lesson.html / mock-exam.html)
 * แยกตามค่า <body data-page="course|lesson|exam"> ข้อมูลทั้งหมดมาจาก js/study-data.js (ข้อมูลตัวอย่างรอเชื่อมของจริง)
 */
import {
    DEMO_NOTE, SUBJECTS, SUBJECT_ORDER, getSubject, buildOutline, resolveLessonNo, lessonTitle, PLACEHOLDER_LESSON,
    browserStore, makeQuiz, makePractice, makeMock, scoreAnswers, scoreMessage, choiceLabel, formatClock, formatThaiDate,
    courseUrl, lessonUrl, mockUrl, MOCK_SAMPLE,
} from './study-data.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const params = new URLSearchParams(location.search);
const store = browserStore();
const content = $('#content');
const view = $('#view');

// ───────────── ไอคอน ─────────────
const STAR_D = 'M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z';
const CHEV_D = 'M7 6l-.112 .006a1 1 0 0 0 -.669 1.619l3.501 4.375l-3.5 4.375a1 1 0 0 0 .78 1.625h6a1 1 0 0 0 .78 -.375l4 -5a1 1 0 0 0 0 -1.25l-4 -5a1 1 0 0 0 -.78 -.375h-6z';
const line = (size, inner, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON = {
    check: (s = 18, w = 3) => line(s, '<path d="M5 12l5 5l10 -10"/>', w),
    x: (s = 18, w = 3) => line(s, '<path d="M18 6l-12 12"/><path d="M6 6l12 12"/>', w),
    down: (s = 20) => line(s, '<path d="M6 9l6 6l6 -6"/>', 2.5),
    flag: (s = 18) => line(s, '<path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9z"/><path d="M5 21v-7"/>'),
    clock: (s = 18) => line(s, '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>'),
    grid: (s = 18) => line(s, '<path d="M4 4h6v6h-6z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6h-6z"/><path d="M14 14h6v6h-6z"/>'),
    info: (s = 18) => line(s, '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 9h.01"/><path d="M11 12h1v4h1"/>'),
    doc: (s = 20) => line(s, '<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"/><path d="M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z"/><path d="M9 12h6"/><path d="M9 16h6"/>'),
    list: (s = 20) => line(s, '<path d="M13 5h8"/><path d="M13 9h5"/><path d="M13 15h8"/><path d="M13 19h5"/><path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>'),
    star: (s = 18, fill = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><path d="${STAR_D}"/></svg>`,
    next: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${CHEV_D}"/></svg>`,
    lessonDone: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#059669"/><path d="M7.5 12.5l3 3l6 -6.5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lessonNow: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#059669" stroke-width="2"/><path d="M12 2.5a9.5 9.5 0 0 0 0 19z" fill="#059669"/></svg>',
    lessonTodo: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#64748B" stroke-width="2"/></svg>',
};

// ───────────── ตัวช่วยร่วม ─────────────
const demoNote = () => `<div class="demo-note" role="note">${ICON.info(16)}<span>${esc(DEMO_NOTE)}</span><button type="button" data-act="clear-demo">ล้างข้อมูลตัวอย่าง</button></div>`;

function notFound(message, backHref, backLabel) {
    document.title = 'HEADFACE Study - ไม่พบหน้า';
    $('#pageTitle').textContent = 'ไม่พบหน้าที่ต้องการ';
    content.innerHTML = `<section class="notfound" role="alert"><h2>${esc(message)}</h2><p>ลิงก์อาจไม่ถูกต้อง หรือยังไม่มีข้อมูลของหน้านี้</p><a class="btn" href="${backHref}">${esc(backLabel)}</a></section>`;
}

function setTheme(subject) {
    document.body.classList.add(`hue-${subject.hue}`);
}

function focusView() {
    if (view) view.focus({ preventScroll: true });
}

document.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="clear-demo"]')) {
        store.clear();
        location.reload();
    }
});

// ============================================================
// หน้ารายละเอียดวิชา (course.html?s=KEY)
// ============================================================
function initCourse() {
    const subject = getSubject(params.get('s'));
    if (!subject) return notFound('ไม่พบรายวิชานี้', 'subject.html', 'กลับไปหน้ารายวิชา');
    setTheme(subject);

    document.title = `HEADFACE Study - ${subject.title}`;
    $('#eyebrow').textContent = subject.eyebrow;
    $('#pageTitle').textContent = subject.title;
    $('#pageMeta').textContent = subject.meta;

    let outline = buildOutline(subject.key, store);
    let openUnit = outline.currentUnit || 1;
    let focusUnit = null;

    const lessonRow = (l) => {
        const icon = l.status === 'done' ? ICON.lessonDone : l.status === 'now' ? ICON.lessonNow : ICON.lessonTodo;
        const stText = l.status === 'done' ? 'เรียนแล้ว' : l.status === 'now' ? 'กำลังเรียน' : 'ยังไม่เริ่ม';
        const title = l.title === PLACEHOLDER_LESSON ? `<span class="ph">${esc(l.title)}</span>` : esc(l.title);
        return `<a class="ls" href="${lessonUrl(subject.key, l.n)}">
          <span class="ls-i">${icon}</span>
          <div class="ls-b">
            <p class="ls-n">บทที่ ${l.n} ${title}</p>
            <p class="ls-st st-${l.status}">${stText}</p>
            <div class="minis"><span class="mini${l.content ? ' ok' : ''}">เนื้อหา</span><span class="mini${l.quiz ? ' ok' : ''}">Quiz</span><span class="mini${l.practice ? ' ok' : ''}">Practice</span></div>
          </div>
        </a>`;
    };

    const unitCard = (u) => {
        const open = u.n === openUnit;
        return `<section class="unit-card">
          <button type="button" class="unit-h" id="unit-btn-${u.n}" data-unit="${u.n}" aria-expanded="${open}" aria-controls="unit-${u.n}">
            <span class="unit-badge${u.complete ? ' done' : ''}">${u.complete ? ICON.check(18) : u.n}</span>
            <span class="unit-t"><span class="unit-n">หน่วยที่ ${u.n}</span><span class="unit-s">${esc(u.title)}</span></span>
            <span class="unit-c">${u.doneCount}/${u.lessons.length}</span>
            <span class="chev${open ? ' up' : ''}">${ICON.down(20)}</span>
          </button>
          ${open ? `<div class="lessons" id="unit-${u.n}">${u.lessons.map(lessonRow).join('')}</div>` : ''}
        </section>`;
    };

    function render() {
        outline = buildOutline(subject.key, store);
        const cur = outline.current;
        const attempts = store.mocks(subject.key);
        const last = attempts[attempts.length - 1];
        const curTitle = cur ? (cur.title === PLACEHOLDER_LESSON ? `<span class="ph">${esc(cur.title)}</span>` : esc(cur.title)) : '';

        content.innerHTML = `
          ${demoNote()}
          <div style="margin-top:18px">
            <section class="sum" aria-label="ความคืบหน้าของวิชา">
              <div class="sum-top">
                <p class="sum-pct"><span class="num">${outline.pct}%</span><span class="cap">ความคืบหน้า</span></p>
                <p class="cap">เรียนแล้ว ${outline.doneCount} จาก ${outline.total} บทเรียน</p>
              </div>
              <div class="bar" aria-hidden="true"><i style="width:${outline.pct}%"></i></div>
              <a class="btn btn-lg btn-block" href="${cur ? lessonUrl(subject.key, cur.n) : lessonUrl(subject.key, 1)}"><span>${cur ? 'เรียนต่อ' : 'ทบทวนบทเรียน'}</span>${ICON.next(14)}</a>
              <p class="cap sum-cap">${cur ? `บทที่ ${cur.n} • ${curTitle}` : 'เรียนครบทุกบทแล้ว'}</p>
            </section>
          </div>

          <details class="about" style="margin-top:14px">
            <summary>${ICON.info(18)}<span>เกี่ยวกับวิชานี้</span><span class="chev">${ICON.down(20)}</span></summary>
            <dl class="about-body">
              <div class="about-row"><dt>คำอธิบายวิชา</dt><dd>[คำอธิบายวิชา]</dd></div>
              <div class="about-row"><dt>วัตถุประสงค์การเรียนรู้</dt><dd>[วัตถุประสงค์การเรียนรู้]</dd></div>
              <div class="about-row"><dt>ระดับชั้น / ระดับความยาก</dt><dd>[ระดับชั้นที่เกี่ยวข้อง]</dd></div>
            </dl>
          </details>

          <section class="fsec" aria-labelledby="h-out">
            <div class="fsec-h"><span class="tile tile-sky" style="width:32px;height:32px;border-radius:10px"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.5 5.134a1 1 0 0 1 .493 .748l.007 .118v13a1 1 0 0 1 -1.5 .866a8 8 0 0 0 -7.5 -.266v-15.174a10 10 0 0 1 8.5 .708m-10.5 -.707l.001 15.174a8 8 0 0 0 -7.234 .117l-.327 .18l-.103 .044l-.049 .016l-.11 .026l-.061 .01l-.117 .006h-.042l-.11 -.012l-.077 -.014l-.108 -.032l-.126 -.056l-.095 -.056l-.089 -.067l-.06 -.056l-.073 -.082l-.064 -.089l-.022 -.036l-.032 -.06l-.044 -.103l-.016 -.049l-.026 -.11l-.01 -.061l-.004 -.049l-.002 -13.068a1 1 0 0 1 .5 -.866a10 10 0 0 1 8.5 -.707"/></svg></span><h2 id="h-out">บทเรียน</h2></div>
            <div class="units">${outline.units.map(unitCard).join('')}</div>
          </section>

          <section class="mock" aria-label="Mock Exam ประจำวิชา">
            <div class="mock-top">
              <span class="mock-tile">${ICON.star(24)}</span>
              <div><h3>Mock Exam ประจำวิชา</h3><p class="cap">${attempts.length ? `ทำแล้ว ${attempts.length} ครั้ง • คะแนนล่าสุด ${last.correct}/${last.total}` : 'ยังไม่เคยทำ • ดูรายละเอียดและเงื่อนไขก่อนเริ่มสอบ'}</p></div>
            </div>
            <a class="mock-btn" href="${mockUrl(subject.key)}"><span>เข้าสอบ Mock Exam</span></a>
          </section>`;

        if (focusUnit) {
            const btn = $(`#unit-btn-${focusUnit}`);
            if (btn) btn.focus({ preventScroll: true });
            focusUnit = null;
        }
    }

    content.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-unit]');
        if (!btn) return;
        const n = Number(btn.dataset.unit);
        openUnit = openUnit === n ? 0 : n; // เปิดทีละหน่วย กดซ้ำเพื่อปิด
        focusUnit = n;
        render();
    });

    render();
}

// ============================================================
// ส่วนประกอบของโจทย์ (ใช้ร่วมกันระหว่าง Quiz และ Mock Exam)
// ============================================================
function choicesHtml(q, pick, { checked = false, locked = false } = {}) {
    return `<div class="choices" role="radiogroup" aria-label="ตัวเลือกคำตอบ">${q.choices.map((text, i) => {
        let cls = 'choice';
        let mark = '';
        if (checked) {
            if (i === q.answer) { cls += ' is-ok'; mark = ICON.check(24, 3); }
            else if (i === pick) { cls += ' is-bad'; mark = ICON.x(24, 3); }
        } else if (i === pick) {
            cls += ' is-sel';
        }
        return `<button type="button" class="${cls}" role="radio" aria-checked="${i === pick}" data-choice="${i}"${locked ? ' disabled' : ''}>
          <span class="choice-l">${choiceLabel(i)}</span><span class="choice-t">${esc(text)}</span><span class="choice-m">${mark}</span>
        </button>`;
    }).join('')}</div>`;
}

function ringHtml(percent, label) {
    const C = 2 * Math.PI * 54;
    return `<div class="ring" role="img" aria-label="${esc(label)}">
      <svg viewBox="0 0 132 132"><circle class="trk" cx="66" cy="66" r="54"/><circle class="val" cx="66" cy="66" r="54" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-target="${(C * (1 - percent / 100)).toFixed(2)}"/></svg>
      <div class="ring-t"><b>${percent}%</b><span>${esc(label)}</span></div>
    </div>`;
}
function animateRing(root) {
    const val = $('.ring .val', root);
    if (val) setTimeout(() => { val.style.strokeDashoffset = val.dataset.target; }, 40);
}

const abar = (inner) => `<div class="abar"><div class="abar-in">${inner}</div></div>`;

// ============================================================
// หน้าบทเรียน (lesson.html?s=KEY&l=N&tab=content|quiz|practice)
// ============================================================
function initLesson() {
    const subject = getSubject(params.get('s'));
    if (!subject) return notFound('ไม่พบรายวิชานี้', 'subject.html', 'กลับไปหน้ารายวิชา');
    const n = resolveLessonNo(subject.key, params.get('l'), store);
    if (n === null) return notFound('ไม่พบบทเรียนนี้', courseUrl(subject.key), 'กลับไปหน้ารายละเอียดวิชา');
    setTheme(subject);

    const title = lessonTitle(subject.key, n);
    document.title = `HEADFACE Study - บทที่ ${n} ${title === PLACEHOLDER_LESSON ? subject.title : title}`;
    $('#backLink').href = courseUrl(subject.key);
    $('#eyebrow').textContent = `บทที่ ${n} • ${subject.title}`;
    $('#pageTitle').textContent = title;

    const TABS = [['content', 'เนื้อหา'], ['quiz', 'Quiz'], ['practice', 'Practice']];
    let tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'content';
    const total = buildOutline(subject.key, store).total;

    const quiz = makeQuiz(subject.key, n);
    let qs = { phase: 'intro', i: 0, picks: [], checked: false };
    const practice = makePractice(subject.key, n);
    let pf = { filter: 'all', shown: {} };

    const activityStatus = () => {
        const o = buildOutline(subject.key, store);
        const l = o.lessons[n - 1];
        const rec = store.lesson(subject.key, n);
        const pr = Object.values(rec.practice || {});
        return {
            content: l.content ? 'อ่านแล้ว' : 'ยังไม่อ่าน',
            quiz: rec.quiz ? `${rec.quiz.correct}/${rec.quiz.total}` : l.quiz ? 'เสร็จแล้ว' : 'ยังไม่ทำ',
            practice: pr.length ? `${pr.filter((v) => v === 'ok').length}/${practice.length}` : l.practice ? 'เสร็จแล้ว' : 'ยังไม่ทำ',
        };
    };

    function renderTabs() {
        const st = activityStatus();
        return `<div class="tabs" role="tablist" aria-label="กิจกรรมในบทเรียน">${TABS.map(([k, label]) =>
            `<button type="button" class="tab" role="tab" id="tab-${k}" aria-selected="${tab === k}" aria-controls="panel" data-tab="${k}"><span>${label}</span><small>${esc(st[k])}</small></button>`).join('')}</div>`;
    }

    // ───── เนื้อหา ─────
    function contentPanel() {
        const rec = store.lesson(subject.key, n);
        const baseDone = buildOutline(subject.key, store).lessons[n - 1].baseDone; // บทที่เรียนจบแล้วตามความคืบหน้ารวม (ข้อมูลตัวอย่าง)
        const prev = n > 1 ? n - 1 : null;
        const next = n < total ? n + 1 : null;
        const nav = (m, cls, label) => m
            ? `<a class="lnav-a ${cls}" href="${lessonUrl(subject.key, m)}"><span class="cap">${label}</span><b>บทที่ ${m} ${esc(lessonTitle(subject.key, m))}</b></a>`
            : `<span class="lnav-a ${cls}" aria-disabled="true"><span class="cap">${label}</span><b>—</b></span>`;
        return `<div class="read fade-in">
          <article class="rblock">
            <div class="rmeta"><span class="chip chip-g">เนื้อหา</span><span class="chip" style="background:var(--chip);color:var(--strong)">บทที่ ${n}</span></div>
            <h2 class="rh">[หัวข้อเนื้อหา]</h2>
            <p class="rp">[ย่อหน้าอธิบายเนื้อหา — พื้นที่สำหรับข้อความอ่านยาว ขนาดตัวอักษร 16px ระยะบรรทัดโปร่งเพื่อให้อ่านสบาย]</p>
            <figure class="rfig" aria-label="ตำแหน่งภาพประกอบ"><span style="font-size:44px" aria-hidden="true">${subject.emoji}</span></figure>
            <p class="cap rcap">[คำบรรยายภาพ / แผนภาพ / อินโฟกราฟิก / วิดีโอการสอน]</p>
            <p class="rp">[ย่อหน้าอธิบายต่อ]</p>
          </article>
          <aside class="rblock callout" style="box-shadow:none"><h3>${ICON.star(16)} สูตรสำคัญ / คำศัพท์</h3><p>[สูตรหรือคำศัพท์สำคัญของบทนี้]</p></aside>
          <article class="rblock">
            <h2 class="rh">ตัวอย่างและวิธีคิด</h2>
            <ol class="steps"><li>[ขั้นตอนที่ 1 ของตัวอย่าง]</li><li>[ขั้นตอนที่ 2]</li><li>[ขั้นตอนที่ 3 และคำตอบ]</li></ol>
          </article>
          <article class="rblock">
            <h2 class="rh">สรุปเนื้อหาสำคัญ</h2>
            <ul class="checks"><li>${ICON.check(20)}<span>[ประเด็นสรุปที่ 1]</span></li><li>${ICON.check(20)}<span>[ประเด็นสรุปที่ 2]</span></li><li>${ICON.check(20)}<span>[ประเด็นสรุปที่ 3]</span></li></ul>
          </article>
          <div class="rdone">
            ${baseDone
              ? `<p class="btn btn-lg btn-block btn-done" style="margin-top:0;box-shadow:none">${ICON.check(18)}<span>เรียนบทนี้จบแล้ว</span></p>`
              : `<button type="button" class="btn btn-lg btn-block ${rec.read ? 'btn-done' : 'btn-line'}" data-act="toggle-read" aria-pressed="${!!rec.read}" style="margin-top:0">${rec.read ? `${ICON.check(18)}<span>อ่านจบแล้ว (กดอีกครั้งเพื่อยกเลิก)</span>` : '<span>ทำเครื่องหมายว่าอ่านจบแล้ว</span>'}</button>`}
            <p class="cap" style="text-align:center">การอ่านจบยังไม่ถือว่าบทเรียนสำเร็จ — ต้องทำ Quiz เพื่อตรวจความเข้าใจด้วย</p>
            <button type="button" class="btn btn-lg btn-block" data-tab="quiz" style="margin-top:0"><span>ไปทำ Quiz ท้ายบท</span>${ICON.next(14)}</button>
          </div>
          <nav class="lnav" aria-label="เปลี่ยนบทเรียน">${nav(prev, 'prev', 'บทก่อนหน้า')}${nav(next, 'next', 'บทถัดไป')}</nav>
        </div>`;
    }

    // ───── Quiz ─────
    function quizPanel() {
        const rec = store.lesson(subject.key, n);
        if (qs.phase === 'intro') {
            return `<section class="rblock intro fade-in">
              <span class="tile tile-teal" aria-hidden="true">🧠</span>
              <h2>Quiz ท้ายบท</h2>
              <p>ตรวจความเข้าใจของบทนี้ ตอบแล้วกด "ตรวจคำตอบ" เพื่อดูเฉลยพร้อมคำอธิบายทีละข้อ</p>
              <div class="facts"><span class="chip chip-g">${quiz.length} ข้อ</span><span class="chip chip-g">มีเฉลยและคำอธิบาย</span>${rec.quiz ? `<span class="chip chip-amber">ผลล่าสุด ${rec.quiz.correct}/${rec.quiz.total}</span>` : ''}</div>
              <button type="button" class="btn btn-lg btn-block" data-act="quiz-start"><span>${rec.quiz ? 'ทำ Quiz อีกครั้ง' : 'เริ่มทำ Quiz'}</span>${ICON.next(14)}</button>
            </section>`;
        }
        if (qs.phase === 'result') {
            const r = scoreAnswers(quiz, qs.picks);
            const nextN = n < total ? n + 1 : null;
            return `<section class="rblock result fade-in">
              ${ringHtml(r.percent, `${r.correct}/${r.total} ข้อ`)}
              <h2>${esc(scoreMessage(r.percent))}</h2>
              <p>ตอบถูก ${r.correct} จาก ${r.total} ข้อ</p>
              <div class="rows"><div class="row"><span class="k">ตอบถูก</span><span class="v">${r.correct}</span></div><div class="row"><span class="k">ตอบผิด</span><span class="v">${r.wrong.length}</span></div></div>
              ${r.wrong.length ? `<div class="review"><h3 class="fsec-h" style="font-size:16px">ข้อที่ควรทบทวน</h3>${r.wrong.map((i) => `<div class="review-i bad"><h3>${ICON.x(16)}<span>ข้อ ${i + 1} ${esc(quiz[i].text)}</span></h3><p>เฉลย: ${choiceLabel(quiz[i].answer)} ${esc(quiz[i].choices[quiz[i].answer])}</p><p>${esc(quiz[i].explanation)}</p></div>`).join('')}</div>` : ''}
              <div class="res-actions">
                <button type="button" class="btn btn-lg btn-block" data-act="quiz-start" style="margin-top:0">ทำ Quiz อีกครั้ง</button>
                <button type="button" class="btn btn-lg btn-block btn-line" data-tab="content" style="margin-top:0">กลับไปทบทวนเนื้อหา</button>
                ${nextN ? `<a class="btn btn-lg btn-block btn-line" href="${lessonUrl(subject.key, nextN)}" style="margin-top:0">ไปบทที่ ${nextN}</a>` : `<a class="btn btn-lg btn-block btn-line" href="${courseUrl(subject.key)}" style="margin-top:0">กลับหน้ารายละเอียดวิชา</a>`}
              </div>
            </section>`;
        }
        const q = quiz[qs.i];
        const pick = qs.picks[qs.i];
        const ok = pick === q.answer;
        return `<div class="fade-in">
          <div class="qhead"><div class="qbar" role="progressbar" aria-valuemin="0" aria-valuemax="${quiz.length}" aria-valuenow="${qs.i + 1}"><i style="width:${((qs.i + (qs.checked ? 1 : 0)) / quiz.length) * 100}%"></i></div><span class="qcount">ข้อ ${qs.i + 1}/${quiz.length}</span></div>
          <section class="qcard" aria-labelledby="q-t">
            <p class="qtopic">${esc(q.topic)}</p>
            <h2 class="qtext" id="q-t">${esc(q.text)}</h2>
            ${choicesHtml(q, pick, { checked: qs.checked, locked: qs.checked })}
            ${qs.checked ? `<div class="fb ${ok ? 'ok' : 'bad'}" role="status"><h3>${ok ? ICON.check(20) : ICON.x(20)}<span>${ok ? 'ถูกต้อง' : 'ยังไม่ถูกต้อง'}</span></h3><p>${esc(q.explanation)}</p><button type="button" class="linkbtn" data-tab="content">กลับไปทบทวนเนื้อหาที่เกี่ยวข้อง</button></div>` : ''}
          </section>
        </div>
        ${abar(qs.checked
            ? `<button type="button" class="btn btn-lg" data-act="quiz-next"><span>${qs.i + 1 < quiz.length ? 'ข้อถัดไป' : 'ดูผลคะแนน'}</span>${ICON.next(14)}</button>`
            : `<button type="button" class="btn btn-lg" data-act="quiz-check"${pick === undefined || pick === null ? ' disabled' : ''}>ตรวจคำตอบ</button>`)}`;
    }

    // ───── Practice ─────
    function practicePanel() {
        const rec = store.lesson(subject.key, n);
        const marks = rec.practice || {};
        const done = Object.keys(marks).length;
        const okCount = Object.values(marks).filter((v) => v === 'ok').length;
        const wrongCount = done - okCount;
        const FILTERS = [['all', 'ทั้งหมด'], ['ง่าย', 'ง่าย'], ['กลาง', 'กลาง'], ['ยาก', 'ยาก'], ['wrong', `ที่ทำผิด${wrongCount ? ` (${wrongCount})` : ''}`]];
        const list = practice.filter((p, i) => pf.filter === 'all' || (pf.filter === 'wrong' ? marks[i] === 'wrong' : p.level === pf.filter));
        return `<div class="fade-in">
          <div class="psum"><b>ทำแล้ว ${done}/${practice.length}</b><div class="bar" aria-hidden="true"><i style="width:${(done / practice.length) * 100}%"></i></div><b>ถูก ${okCount}</b></div>
          <div class="pfilter" role="group" aria-label="กรองโจทย์" style="margin-top:12px">${FILTERS.map(([k, label]) => `<button type="button" class="fchip${pf.filter === k ? ' on' : ''}" data-pf="${k}" aria-pressed="${pf.filter === k}">${esc(label)}</button>`).join('')}</div>
          <div class="plist">${list.length ? list.map((p) => {
            const i = practice.indexOf(p);
            const mark = marks[i];
            const shown = !!pf.shown[i];
            return `<article class="pcard${mark === 'ok' ? ' ok' : mark === 'wrong' ? ' bad' : ''}">
              <div class="pcard-h"><span class="lvl lvl-${p.level}">${p.level}</span><span class="cap">${esc(p.topic)}</span></div>
              <p class="pcard-q">ข้อ ${p.n} ${esc(p.text)}</p>
              ${shown ? `<div class="pcard-sol"><b>เฉลยและวิธีคิด</b>${esc(p.solution)}</div>` : ''}
              <div class="pcard-act">
                <button type="button" class="pbtn" data-pshow="${i}" aria-expanded="${shown}">${shown ? 'ซ่อนเฉลย' : 'ดูเฉลย'}</button>
                <button type="button" class="pbtn ok${mark === 'ok' ? ' on' : ''}" data-pmark="${i}:ok" aria-pressed="${mark === 'ok'}">${ICON.check(16)}<span>ทำถูก</span></button>
                <button type="button" class="pbtn bad${mark === 'wrong' ? ' on' : ''}" data-pmark="${i}:wrong" aria-pressed="${mark === 'wrong'}">${ICON.x(16)}<span>ทำผิด</span></button>
              </div>
            </article>`;
          }).join('') : `<p class="empty-p">ยังไม่มีโจทย์ในหมวดนี้ ${pf.filter === 'wrong' ? '— ข้อที่ทำผิดจะมารวมอยู่ที่นี่เพื่อให้ฝึกซ้ำ' : ''}</p>`}</div>
          ${done ? '<p style="text-align:center;margin-top:12px"><button type="button" class="linkbtn" data-act="practice-reset" style="min-height:44px;font-size:14px;font-weight:700;text-decoration:underline;color:#475569">ล้างผลการฝึกของบทนี้</button></p>' : ''}
        </div>`;
    }

    function render({ focus = false } = {}) {
        const panel = tab === 'content' ? contentPanel() : tab === 'quiz' ? quizPanel() : practicePanel();
        content.innerHTML = `${demoNote()}${renderTabs()}<div class="panel" id="panel" role="tabpanel" aria-labelledby="tab-${tab}" tabindex="-1">${panel}</div>`;
        view.classList.toggle('has-abar', tab === 'quiz' && qs.phase === 'q');
        if (tab === 'quiz' && qs.phase === 'result') animateRing(content);
        if (focus) $('#panel').focus({ preventScroll: true });
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

    content.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('[data-tab]');
        if (tabBtn) return setTab(tabBtn.dataset.tab);

        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'toggle-read') {
            if (store.lesson(subject.key, n).read) store.unmarkRead(subject.key, n);
            else store.markRead(subject.key, n);
            render();
            return $('[data-act="toggle-read"]')?.focus({ preventScroll: true });
        }
        if (act === 'quiz-start') { qs = { phase: 'q', i: 0, picks: [], checked: false }; window.scrollTo(0, 0); return render({ focus: true }); }
        if (act === 'quiz-check') { qs.checked = true; return render(); }
        if (act === 'quiz-next') {
            if (qs.i + 1 < quiz.length) { qs.i++; qs.checked = false; window.scrollTo(0, 0); return render({ focus: true }); }
            const r = scoreAnswers(quiz, qs.picks);
            store.saveQuiz(subject.key, n, { correct: r.correct, total: r.total });
            qs.phase = 'result';
            window.scrollTo(0, 0);
            return render({ focus: true });
        }
        if (act === 'practice-reset') { store.clearPractice(subject.key, n); pf.shown = {}; return render(); }

        const choice = e.target.closest('[data-choice]');
        if (choice && tab === 'quiz' && qs.phase === 'q' && !qs.checked) {
            qs.picks[qs.i] = Number(choice.dataset.choice);
            render();
            const again = $(`[data-choice="${qs.picks[qs.i]}"]`);
            if (again) again.focus({ preventScroll: true });
            return;
        }

        const filter = e.target.closest('[data-pf]');
        if (filter) { pf.filter = filter.dataset.pf; return render(); }
        const show = e.target.closest('[data-pshow]');
        if (show) { const i = Number(show.dataset.pshow); pf.shown[i] = !pf.shown[i]; render(); return $(`[data-pshow="${i}"]`)?.focus({ preventScroll: true }); }
        const mark = e.target.closest('[data-pmark]');
        if (mark) {
            const [i, v] = mark.dataset.pmark.split(':');
            store.markPractice(subject.key, n, Number(i), v === 'ok');
            render();
            return $(`[data-pmark="${i}:${v}"]`)?.focus({ preventScroll: true });
        }
    });

    render();
}

// ============================================================
// หน้า Mock Exam (mock-exam.html หรือ mock-exam.html?s=KEY)
// ============================================================
function initExam() {
    const rawKey = params.get('s');
    const subject = rawKey === null ? null : getSubject(rawKey);
    if (rawKey !== null && !subject) return notFound('ไม่พบรายวิชานี้', mockUrl(), 'เลือกวิชาที่จะสอบ');
    const bar = $('#barRight');
    const backLink = $('#backLink');

    // ───── เลือกวิชา ─────
    if (!subject) {
        backLink.href = 'progress.html';
        backLink.setAttribute('aria-label', 'กลับไปหน้าความคืบหน้า');
        $('#eyebrow').textContent = 'Mock Exam ประจำวิชา';
        $('#pageTitle').textContent = 'เลือกวิชาที่จะสอบ';
        document.title = 'HEADFACE Study - Mock Exam';
        content.innerHTML = `${demoNote()}<p class="cap" style="margin-top:14px">แต่ละวิชามี Mock Exam ประจำวิชา 1 ชุดหลัก ทำซ้ำได้ และเก็บประวัติผลทุกครั้งไว้เปรียบเทียบพัฒนาการ</p>
          <div class="pick-list" style="margin-top:12px">${SUBJECT_ORDER.map((k) => {
            const s = SUBJECTS[k];
            const at = store.mocks(k);
            return `<a class="pick hue-${s.hue}" href="${mockUrl(k)}"><span class="sc-tile" aria-hidden="true">${s.emoji}</span><div class="pick-t"><h3>${esc(s.title)}</h3><p>${at.length ? `ทำแล้ว ${at.length} ครั้ง • ล่าสุด ${at[at.length - 1].correct}/${at[at.length - 1].total}` : 'ยังไม่เคยทำ'}</p></div>${ICON.next(16)}</a>`;
          }).join('')}</div>`;
        return;
    }

    setTheme(subject);
    backLink.href = courseUrl(subject.key);
    backLink.setAttribute('aria-label', 'กลับไปหน้ารายละเอียดวิชา');
    $('#eyebrow').textContent = `Mock Exam • ${subject.title}`;
    $('#pageTitle').textContent = 'Mock Exam ประจำวิชา';
    document.title = `HEADFACE Study - Mock Exam ${subject.title}`;

    const mock = makeMock(subject.key);
    let stage = 'intro';
    let ex = null;       // สถานะระหว่างสอบ
    let last = null;     // ผลล่าสุด (หน้าสรุปผล)

    const guard = (e) => { e.preventDefault(); e.returnValue = ''; };

    // ───── เงื่อนไขก่อนสอบ ─────
    function introView() {
        const at = store.mocks(subject.key);
        const rows = at.slice().reverse().map((a, idx) => {
            const num = at.length - idx;
            return `<li class="hist-i"><span class="n">${num}</span><div class="d">${a.correct}/${a.total} ข้อ<small>${esc(formatThaiDate(a.at))} • ใช้เวลา ${formatClock(a.seconds)}</small></div><span class="s">${Math.round((a.correct / a.total) * 100)}%</span></li>`;
        }).join('');
        let cmp = '';
        if (at.length >= 2) {
            const d = Math.round((at[at.length - 1].correct / at[at.length - 1].total) * 100) - Math.round((at[at.length - 2].correct / at[at.length - 2].total) * 100);
            cmp = `<p class="cap" style="margin-top:8px">เทียบกับครั้งก่อน: <span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'same'}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= '}${d}%</span></p>`;
        }
        return `${demoNote()}
          <section class="rblock fade-in" style="margin-top:14px">
            <div style="display:flex;align-items:center;gap:12px"><span class="sc-tile" aria-hidden="true" style="background:#fff;border:1.5px solid var(--bd);border-radius:14px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:26px">${subject.emoji}</span><div><p class="cap">${esc(subject.eyebrow)}</p><h2 class="rh" style="font-size:18px;line-height:26px">Mock Exam ประจำวิชา${esc(subject.title)}</h2></div></div>
            <p class="rp" style="font-size:14px;line-height:22px;color:#475569">ประเมินความเข้าใจในภาพรวมของวิชา ขอบเขตข้อสอบสอดคล้องกับเนื้อหาในวิชานี้</p>
          </section>
          <div class="info-grid" aria-label="รายละเอียดข้อสอบ">
            <div class="info"><span class="tile tile-sky">${ICON.doc(20)}</span><div><b>${mock.questions} ข้อ</b><span class="l">จำนวนข้อ</span></div></div>
            <div class="info"><span class="tile tile-amber">${ICON.clock(20)}</span><div><b>${mock.minutes} นาที</b><span class="l">เวลาทำข้อสอบ</span></div></div>
            <div class="info"><span class="tile tile-teal">${ICON.list(20)}</span><div><b>เลือกตอบ 4 ตัวเลือก</b><span class="l">รูปแบบคำถาม</span></div></div>
            <div class="info"><span class="tile tile-rose">${ICON.star(20)}</span><div><b>[ยังไม่กำหนด]</b><span class="l">คะแนนผ่าน</span></div></div>
          </div>
          <section class="fsec" aria-labelledby="h-rules"><div class="fsec-h"><h2 id="h-rules">เงื่อนไขก่อนเริ่มสอบ</h2></div>
            <ul class="rules">
              <li>${ICON.info(18)}<span>ระหว่างสอบจะไม่แสดงเฉลย ดูเฉลยและคำอธิบายได้หลังส่งข้อสอบ</span></li>
              <li>${ICON.info(18)}<span>จับเวลาถอยหลัง เมื่อหมดเวลาระบบจะส่งคำตอบที่ทำไว้ให้อัตโนมัติ</span></li>
              <li>${ICON.info(18)}<span>ติดธงข้อที่ยังไม่แน่ใจ และกลับมาแก้คำตอบได้ก่อนส่ง</span></li>
              <li>${ICON.info(18)}<span>ทำซ้ำได้ ผลของทุกครั้งถูกเก็บในประวัติเพื่อเปรียบเทียบพัฒนาการ</span></li>
              <li>${ICON.info(18)}<span>ดาวสะสมได้จาก Mock Exam Ranking เท่านั้น คำนวณจากคะแนนและเวลาที่ใช้</span></li>
            </ul>
          </section>
          <section class="fsec" aria-labelledby="h-hist"><div class="fsec-h"><h2 id="h-hist">ประวัติการสอบ</h2></div>
            ${at.length ? `<ul class="hist">${rows}</ul>${cmp}` : '<p class="empty-p">ยังไม่เคยทำ Mock Exam วิชานี้ — ผลของแต่ละครั้งจะแสดงที่นี่</p>'}
          </section>
          ${abar(`<button type="button" class="btn btn-lg btn-orange" data-act="start"><span>${at.length ? 'เริ่มทำข้อสอบอีกครั้ง' : 'เริ่มทำข้อสอบ'}</span>${ICON.next(14)}</button>`)}`;
    }

    // ───── ระหว่างสอบ ─────
    function timerClass(remaining) {
        const ratio = remaining / (mock.minutes * 60);
        return ratio <= 0.1 ? 'crit' : ratio <= 0.25 ? 'warn' : '';
    }
    function paintTimer() {
        if (!ex) return;
        const remaining = Math.max(0, Math.ceil((ex.endAt - Date.now()) / 1000));
        const t = $('#timer');
        if (t) {
            t.textContent = formatClock(remaining);
            t.parentElement.className = `timer ${timerClass(remaining)}`.trim();
        }
        if (remaining <= 0) submit(true);
    }
    function runView() {
        const q = mock.items[ex.i];
        const answered = ex.picks.filter((p) => p !== null && p !== undefined).length;
        const isLast = ex.i === mock.items.length - 1;
        return `<div class="xhead"><div class="qhead" style="flex:1"><div class="qbar" role="progressbar" aria-valuemin="0" aria-valuemax="${mock.items.length}" aria-valuenow="${answered}" aria-label="ทำแล้ว ${answered} จาก ${mock.items.length} ข้อ"><i style="width:${(answered / mock.items.length) * 100}%"></i></div><span class="qcount">ข้อ ${ex.i + 1}/${mock.items.length}</span></div></div>
          <div class="xhead" style="margin-top:10px"><button type="button" class="flagbtn" data-act="flag" aria-pressed="${ex.flags.has(ex.i)}">${ICON.flag(18)}<span>${ex.flags.has(ex.i) ? 'ติดธงแล้ว' : 'ติดธงข้อนี้'}</span></button><button type="button" class="xnav-btn" data-act="open-nav">${ICON.grid(18)}<span>ข้อทั้งหมด</span></button></div>
          <section class="qcard fade-in" aria-labelledby="q-t">
            <p class="qtopic">${esc(q.topic)}</p>
            <h2 class="qtext" id="q-t">${esc(q.text)}</h2>
            ${choicesHtml(q, ex.picks[ex.i])}
          </section>
          ${abar(`<button type="button" class="btn btn-lg btn-line" data-act="prev"${ex.i === 0 ? ' disabled' : ''} style="flex:.8">ก่อนหน้า</button>${isLast
            ? '<button type="button" class="btn btn-lg btn-orange" data-act="ask-submit">ส่งข้อสอบ</button>'
            : `<button type="button" class="btn btn-lg" data-act="next"><span>ถัดไป</span>${ICON.next(14)}</button>`}`)}`;
    }

    function overlay(inner, label) {
        closeOverlay();
        const ov = document.createElement('div');
        ov.className = 'ov';
        ov.id = 'overlay';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.setAttribute('aria-label', label);
        ov.innerHTML = `<div class="sheet"><div class="grab"></div>${inner}</div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('[data-act="close-ov"]')) closeOverlay(); });
        const first = ov.querySelector('button');
        if (first) first.focus({ preventScroll: true });
    }
    function closeOverlay() { document.getElementById('overlay')?.remove(); }

    function navSheet() {
        const answered = ex.picks.filter((p) => p !== null && p !== undefined).length;
        overlay(`<div class="sheet-h"><h3>ข้อทั้งหมด</h3><button type="button" class="sheet-x" data-act="close-ov" aria-label="ปิด">✕</button></div>
          <p class="sheet-p">ตอบแล้ว <b>${answered}</b> จาก ${mock.items.length} ข้อ • ติดธง <b>${ex.flags.size}</b> ข้อ</p>
          <div class="grid5">${mock.items.map((_, i) => {
            const a = ex.picks[i] !== null && ex.picks[i] !== undefined;
            return `<button type="button" class="qn${a ? ' ans' : ''}${i === ex.i ? ' cur' : ''}" data-goto="${i}" aria-label="ข้อ ${i + 1} ${a ? 'ตอบแล้ว' : 'ยังไม่ตอบ'}${ex.flags.has(i) ? ' ติดธง' : ''}"${i === ex.i ? ' aria-current="true"' : ''}>${i + 1}${ex.flags.has(i) ? `<span class="fl">${ICON.flag(12)}</span>` : ''}</button>`;
          }).join('')}</div>
          <div class="legend"><span><i class="a"></i>ตอบแล้ว</span><span><i></i>ยังไม่ตอบ</span><span><i class="f"></i>ติดธง</span></div>
          <div class="sheet-b"><button type="button" class="btn btn-lg btn-orange" data-act="ask-submit" style="margin-top:8px">ส่งข้อสอบ</button></div>`, 'ข้อทั้งหมด');
    }
    function confirmSheet() {
        const unanswered = mock.items.length - ex.picks.filter((p) => p !== null && p !== undefined).length;
        overlay(`<div class="sheet-h"><h3>ส่งข้อสอบหรือไม่?</h3><button type="button" class="sheet-x" data-act="close-ov" aria-label="ปิด">✕</button></div>
          <p class="sheet-p">${unanswered ? `ยังมี <b>${unanswered}</b> ข้อที่ยังไม่ตอบ` : 'ตอบครบทุกข้อแล้ว'}${ex.flags.size ? ` • ติดธงไว้ <b>${ex.flags.size}</b> ข้อ` : ''}<br>เมื่อส่งแล้วจะแก้คำตอบไม่ได้</p>
          <div class="sheet-b"><button type="button" class="btn btn-lg btn-orange" data-act="submit">ส่งข้อสอบ</button><button type="button" class="btn btn-lg btn-line" data-act="close-ov" style="margin-top:0">กลับไปทำต่อ</button></div>`, 'ยืนยันการส่งข้อสอบ');
    }

    function startExam() {
        const now = Date.now();
        ex = { i: 0, picks: [], flags: new Set(), startAt: now, endAt: now + mock.minutes * 60 * 1000, timerId: null };
        stage = 'run';
        window.addEventListener('beforeunload', guard);
        bar.innerHTML = `<span class="timer" role="timer" aria-label="เวลาที่เหลือ">${ICON.clock(18)}<span id="timer">${formatClock(mock.minutes * 60)}</span></span>`;
        ex.timerId = setInterval(paintTimer, 1000);
        window.scrollTo(0, 0);
        render({ focus: true });
        paintTimer();
    }

    function submit(auto = false) {
        if (!ex) return;
        clearInterval(ex.timerId);
        window.removeEventListener('beforeunload', guard);
        closeOverlay();
        const seconds = Math.min(mock.minutes * 60, Math.round((Date.now() - ex.startAt) / 1000));
        const r = scoreAnswers(mock.items, ex.picks);
        const prev = store.mocks(subject.key).slice(-1)[0] || null;
        store.addMock(subject.key, { correct: r.correct, total: r.total, answered: r.answered, seconds });
        last = { r, seconds, prev, auto, picks: ex.picks.slice() };
        ex = null;
        stage = 'result';
        bar.innerHTML = '';
        window.scrollTo(0, 0);
        render({ focus: true });
    }

    // ───── สรุปผล ─────
    function resultView() {
        const { r, seconds, prev, auto, picks } = last;
        const delta = prev ? r.percent - Math.round((prev.correct / prev.total) * 100) : null;
        const topics = {};
        mock.items.forEach((q, i) => { const t = (topics[q.topic] ||= { ok: 0, n: 0 }); t.n++; if (picks[i] === q.answer) t.ok++; });
        return `${auto ? '<div class="demo-note" role="alert" style="border-color:#F43F5E;background:#FFF1F2;color:#881337"><span>หมดเวลา ระบบส่งคำตอบที่ทำไว้ให้อัตโนมัติ</span></div>' : ''}
          <section class="rblock result fade-in" style="margin-top:14px">
            ${ringHtml(r.percent, `${r.correct}/${r.total} ข้อ`)}
            <h2>${esc(scoreMessage(r.percent))}</h2>
            <p>สรุปผล Mock Exam ประจำวิชา${esc(subject.title)}</p>
            <div class="rows" aria-label="สรุปผล">
              <div class="row"><span class="k">ตอบถูก</span><span class="v">${r.correct} / ${r.total}</span></div>
              <div class="row"><span class="k">ไม่ได้ตอบ</span><span class="v">${r.total - r.answered}</span></div>
              <div class="row"><span class="k">เวลาที่ใช้</span><span class="v">${formatClock(seconds)} / ${formatClock(mock.minutes * 60)}</span></div>
              <div class="row"><span class="k">เทียบกับครั้งก่อน</span><span class="v">${delta === null ? '<span class="delta same">ครั้งแรก</span>' : `<span class="delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'same'}">${delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '= '}${delta}%</span>`}</span></div>
              <div class="row"><span class="k">${ICON.star(16, '#D97706')} ดาวที่ได้รับ</span><span class="v" style="font-size:12px;color:#475569">[รอระบบคำนวณ]</span></div>
            </div>
          </section>
          <section class="fsec" aria-labelledby="h-topic"><div class="fsec-h"><h2 id="h-topic">ผลรายหัวข้อ</h2></div>
            <div class="rows" style="margin-top:0">${Object.entries(topics).map(([t, v]) => `<div class="topic-row"><div class="top"><span>${esc(t)}</span><span>${v.ok}/${v.n}</span></div><div class="bar" aria-hidden="true"><i style="width:${(v.ok / v.n) * 100}%"></i></div></div>`).join('')}</div>
            <p class="cap" style="margin-top:6px">การสรุปจุดแข็ง/จุดอ่อนต้องอาศัยคำตอบจริงจำนวนมากพอ ตอนนี้เป็นข้อมูลตัวอย่าง</p>
          </section>
          <section class="fsec" aria-labelledby="h-rev"><div class="fsec-h"><h2 id="h-rev">เฉลยรายข้อ</h2></div>
            <div class="review">${mock.items.map((q, i) => {
              const p = picks[i];
              const state = p === null || p === undefined ? 'skip' : p === q.answer ? 'ok' : 'bad';
              return `<div class="review-i ${state === 'ok' ? 'ok' : state === 'bad' ? 'bad' : ''}"><h3>${state === 'ok' ? ICON.check(16) : state === 'bad' ? ICON.x(16) : ICON.info(16)}<span>ข้อ ${i + 1} ${esc(q.text)} — ${state === 'ok' ? 'ถูก' : state === 'bad' ? 'ผิด' : 'ไม่ได้ตอบ'}</span></h3><p>เฉลย: ${choiceLabel(q.answer)} ${esc(q.choices[q.answer])}${state === 'bad' ? ` • คุณตอบ ${choiceLabel(p)}` : ''}</p><p>${esc(q.explanation)}</p></div>`;
            }).join('')}</div>
          </section>
          <div class="res-actions">
            <button type="button" class="btn btn-lg btn-block btn-orange" data-act="retry" style="margin-top:0">ทำข้อสอบอีกครั้ง</button>
            <a class="btn btn-lg btn-block btn-line" href="${courseUrl(subject.key)}" style="margin-top:0">กลับหน้ารายละเอียดวิชา</a>
          </div>`;
    }

    function render({ focus = false } = {}) {
        content.innerHTML = stage === 'intro' ? introView() : stage === 'run' ? runView() : resultView();
        view.classList.toggle('has-abar', stage === 'intro' || stage === 'run');
        if (stage === 'result') animateRing(content);
        if (focus) focusView();
    }

    content.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'start') return startExam();
        if (act === 'retry') { stage = 'intro'; last = null; window.scrollTo(0, 0); return render({ focus: true }); }
        if (!ex) return;
        if (act === 'flag') { ex.flags.has(ex.i) ? ex.flags.delete(ex.i) : ex.flags.add(ex.i); render(); return $('[data-act="flag"]')?.focus({ preventScroll: true }); }
        if (act === 'prev' && ex.i > 0) { ex.i--; window.scrollTo(0, 0); return render({ focus: true }); }
        if (act === 'next' && ex.i < mock.items.length - 1) { ex.i++; window.scrollTo(0, 0); return render({ focus: true }); }
        if (act === 'open-nav') return navSheet();
        if (act === 'ask-submit') return confirmSheet();
        const choice = e.target.closest('[data-choice]');
        if (choice) {
            ex.picks[ex.i] = Number(choice.dataset.choice);
            render();
            return $(`[data-choice="${ex.picks[ex.i]}"]`)?.focus({ preventScroll: true });
        }
    });

    // ปุ่มในชั้นซ้อน (ติดอยู่ที่ document เพราะอยู่นอก #content)
    document.addEventListener('click', (e) => {
        if (!document.getElementById('overlay')) return;
        const go = e.target.closest('[data-goto]');
        if (go && ex) { ex.i = Number(go.dataset.goto); closeOverlay(); window.scrollTo(0, 0); return render({ focus: true }); }
        const act = e.target.closest('#overlay [data-act]')?.dataset.act;
        if (act === 'ask-submit') return confirmSheet();
        if (act === 'submit') return submit(false);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });

    render();
}

const INIT = { course: initCourse, lesson: initLesson, exam: initExam };
const init = INIT[document.body.dataset.page];
if (init) init();
