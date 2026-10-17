/**
 * js/study-live-mock.js — หน้า Mock Exam (โหมดข้อมูลจริง) สัญญา: docs/study-api-contract.md หัวข้อ 2.8
 *
 * ขั้น: เลือกวิชา (ถ้าไม่มี ?s=) → เงื่อนไข+ประวัติ → ทำข้อสอบ (จับเวลา, ติดธง, ข้อทั้งหมด) → สรุปผล+เฉลย
 * เวลา/การตรวจ/ดาวเป็นของ Backend ทั้งหมด หน้านี้แค่แสดง: เวลาที่เหลือคำนวณจาก deadlineAt ของ server (ไม่เชื่อนาฬิกาเครื่อง)
 * บันทึกคำตอบอัตโนมัติระหว่างสอบ ปิดแท็บแล้วกลับมาทำต่อได้ และเมื่อหมดเวลา Backend ส่งคำตอบที่ทำไว้ให้เอง
 */
import { studyApi, StudyApiError } from './study-api.js';
import { $, esc, params, content, view, ICON, notFound, setTheme, focusView, abar, ringHtml, animateRing } from './study-ui.js';
import { choiceLabel, scoreMessage, formatClock, formatThaiDate } from './study-format.js';
import { SUBJECT_ID_RE, courseUrl, failure, loading, mockUrl, messageOf } from './study-live-common.js';
import { questionMediaHtml, choiceImageHtml } from './study-media.js';
import { confetti, countUp, pop } from './study-fx.js';
import { patchHtml } from './study-dom.js';
import { animateReward, expPillHtml } from './study-reward.js';

const SAVE_RETRY_MS = 5000;
const AUTO_SUBMIT_RETRY_MS = 5000;

const deltaHtml = (d) => (d === null || d === undefined
    ? '<span class="delta same">ครั้งแรก</span>'
    : `<span class="delta ${d > 0 ? 'up' : d < 0 ? 'down' : 'same'}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= '}${d}%</span>`);

// ============================================================
// เลือกวิชา
// ============================================================
async function showPicker(api = studyApi) {
    const backLink = $('#backLink');
    backLink.href = 'progress.html';
    backLink.setAttribute('aria-label', 'กลับไปหน้าความคืบหน้า');
    $('#eyebrow').textContent = 'Mock Exam ประจำวิชา';
    $('#pageTitle').textContent = 'เลือกวิชาที่จะสอบ';
    document.title = 'HEADFACE Study - Mock Exam';
    loading();
    let data;
    try {
        data = await api.listSubjects();
    } catch (err) {
        return failure(err, { missing: 'ไม่พบข้อมูล', backHref: 'progress.html', backLabel: 'กลับไปหน้าความคืบหน้า', retry: () => showPicker(api) });
    }
    const rows = data.subjects.map((s) => {
        const sub = s.mock.available
            ? (s.mock.attempts ? `ทำแล้ว ${s.mock.attempts} ครั้ง • ล่าสุด ${s.mock.lastPercent}%` : 'ยังไม่เคยทำ')
            : 'ยังไม่เปิดให้สอบ';
        const inner = `<span class="sc-tile" aria-hidden="true">${esc(s.emoji || '📘')}</span><div class="pick-t"><h3>${esc(s.title)}</h3><p>${esc(sub)}</p></div>${s.mock.available ? ICON.next(16) : ''}`;
        const hue = /^[a-z]{3,12}$/.test(s.hue || '') ? s.hue : 'emerald';
        return s.mock.available
            ? `<a class="pick hue-${hue}" href="${mockUrl(s.id)}">${inner}</a>`
            : `<div class="pick hue-${hue}" aria-disabled="true" style="opacity:.6">${inner}</div>`;
    });
    content.innerHTML = `${rows.length ? `<div class="pick-list" style="margin-top:14px">${rows.join('')}</div>` : '<p class="empty-p" style="margin-top:14px">ยังไม่มีวิชาที่เปิดให้สอบ เมื่อเปิดแล้วจะแสดงที่นี่</p>'}`;
}

// ============================================================
// ข้อสอบของวิชา
// ============================================================
/**
 * @param {{ api?: object, saveDebounceMs?: number, tickMs?: number }} [options]  api/ค่าเวลา เปลี่ยนได้เฉพาะในเทสต์
 */
export async function initMockExam({ api = studyApi, saveDebounceMs = 1000, tickMs = 1000 } = {}) {
    const key = params.get('s');
    if (key === null) return showPicker(api);
    if (!SUBJECT_ID_RE.test(key)) return notFound('ไม่พบรายวิชานี้', 'mock-exam.html', 'เลือกวิชาที่จะสอบ');

    const bar = $('#barRight');
    const backLink = $('#backLink');
    backLink.href = courseUrl(key);
    backLink.setAttribute('aria-label', 'กลับไปหน้ารายละเอียดวิชา');
    loading();

    let info;
    try {
        info = await api.getMockInfo(key);
    } catch (err) {
        return failure(err, { missing: 'ไม่พบรายวิชานี้', backHref: 'mock-exam.html', backLabel: 'เลือกวิชาที่จะสอบ', retry: () => initMockExam({ api, saveDebounceMs, tickMs }) });
    }
    const { subject } = info;
    setTheme(subject);
    $('#eyebrow').textContent = `Mock Exam • ${subject.title}`;
    $('#pageTitle').textContent = 'Mock Exam ประจำวิชา';
    document.title = `HEADFACE Study - Mock Exam ${subject.title}`;

    // ───── สถานะ ─────
    let stage = 'intro';
    let attempt = null;      // ข้อสอบที่กำลังทำ (จาก API)
    let resumed = false;
    let picks = {};          // questionId → choiceId
    let flags = new Set();   // questionId ที่ติดธง
    let i = 0;
    let clockOffset = 0;     // เวลา server − เวลาเครื่อง
    let result = null;
    let error = null;
    let busy = false;        // กำลังเริ่ม/ส่ง
    let dirty = false;
    let saving = false;
    let saveWarn = false;
    let timerId = null;
    let saveTimer = null;
    let lastAutoTry = 0;
    let qdir = 0;            // ทิศที่ข้อใหม่เลื่อนเข้ามา (+1 ถัดไป, −1 ก่อนหน้า) ใช้เฉพาะตอนวาดข้อที่เพิ่งเปลี่ยน

    const guard = (e) => { e.preventDefault(); e.returnValue = ''; };
    const serverNow = () => Date.now() + clockOffset;
    const remainingSec = () => Math.max(0, Math.ceil((attempt.deadlineAt - serverNow()) / 1000));
    const snapshot = () => ({ answers: { ...picks }, flags: [...flags] });
    const answeredCount = () => Object.keys(picks).length;

    // ───── เงื่อนไขก่อนสอบ ─────
    function introView() {
        const m = info.mock;
        const rows = info.history.map((h, idx) => `<li class="hist-i"><span class="n">${info.history.length - idx}</span><div class="d">${h.correct}/${h.total} ข้อ<small>${esc(formatThaiDate(h.submittedAt))} • ใช้เวลา ${formatClock(h.secondsUsed)}${h.status === 'expired' ? ' • หมดเวลา' : ''} • ${h.starsEarned} ดาว</small></div><span class="s">${h.percent}%</span></li>`).join('');
        const cmp = info.deltaVsPrevious === null ? '' : `<p class="cap" style="margin-top:8px">เทียบกับครั้งก่อน: ${deltaHtml(info.deltaVsPrevious)}</p>`;
        const active = info.active;
        const activeNote = active ? `<div class="note warn" role="status">คุณมีข้อสอบที่ยังทำไม่เสร็จ — เวลาเดินต่อตามกำหนดเดิม กด "ทำต่อ" เพื่อกลับไปทำ</div>` : '';
        const startLabel = busy ? 'กำลังเตรียมข้อสอบ...' : active ? 'ทำต่อข้อสอบที่ค้างไว้' : info.history.length ? 'เริ่มทำข้อสอบอีกครั้ง' : 'เริ่มทำข้อสอบ';
        // ข้อความยาว (กติกา / ประวัติ) พับเก็บไว้ในหัวข้อที่กดเปิดเมื่อต้องการ — หน้าแรกมีแค่ชื่อ ตัวเลขสำคัญ และปุ่มเริ่ม
        const fold = (key, title, inner) => `<details class="fold" data-key="${key}"><summary><span>${title}</span><i>${ICON.down(18)}</i></summary><div>${inner}</div></details>`;
        return `<div data-key="intro">
          <section class="rblock" style="margin-top:14px">
            <div style="display:flex;align-items:center;gap:12px"><span class="sc-tile" aria-hidden="true" style="background:#fff;border:1.5px solid var(--bd);border-radius:14px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;font-size:26px">${esc(subject.emoji || '📘')}</span><div><p class="cap">${esc(subject.eyebrow || '')}</p><h2 class="rh" style="font-size:18px;line-height:26px">${esc(m.title || `Mock Exam ประจำวิชา${subject.title}`)}</h2></div></div>
          </section>
          ${m.available ? `<div class="info-grid" aria-label="รายละเอียดข้อสอบ">
            <div class="info"><span class="tile tile-sky">${ICON.doc(20)}</span><div><b>${m.questionCount} ข้อ</b><span class="l">จำนวนข้อ</span></div></div>
            <div class="info"><span class="tile tile-amber">${ICON.clock(20)}</span><div><b>${m.durationMin} นาที</b><span class="l">เวลาทำข้อสอบ</span></div></div>
            <div class="info"><span class="tile tile-teal">${ICON.list(20)}</span><div><b>เลือกตอบ</b><span class="l">รูปแบบคำถาม</span></div></div>
            <div class="info"><span class="tile tile-rose">${ICON.star(20)}</span><div><b>${m.passMarkPct === null ? 'ยังไม่กำหนด' : `${m.passMarkPct}%`}</b><span class="l">คะแนนผ่าน</span></div></div>
          </div>
          ${fold('rules', 'เงื่อนไขก่อนเริ่มสอบ', `<ul class="rules">
              <li>${ICON.info(18)}<span>ระหว่างสอบจะไม่แสดงเฉลย ดูเฉลยและคำอธิบายได้หลังส่งข้อสอบ</span></li>
              <li>${ICON.info(18)}<span>จับเวลาถอยหลังตามเวลาของระบบ เมื่อหมดเวลาระบบจะส่งคำตอบที่ทำไว้ให้อัตโนมัติ คำตอบถูกบันทึกระหว่างทำ ปิดหน้าแล้วกลับมาทำต่อได้ (เวลายังเดินอยู่)</span></li>
              <li>${ICON.info(18)}<span>ติดธงข้อที่ยังไม่แน่ใจ และกลับมาแก้คำตอบได้ก่อนส่ง</span></li>
              <li>${ICON.info(18)}<span>ทำซ้ำได้ ผลของทุกครั้งถูกเก็บในประวัติเพื่อเปรียบเทียบพัฒนาการ</span></li>
              <li>${ICON.info(18)}<span>ดาวคิดจากเปอร์เซ็นต์ที่ตอบถูก${m.stars.max ? ` (ตอบถูกหมดได้ ${m.stars.max} ดาว)` : ''}${m.stars.timeBonusPct > 0 ? ` และมีโบนัสเพิ่มสูงสุด ${m.stars.timeBonusPct}% ของดาวที่ได้ ถ้าส่งเร็วกว่าเวลาที่กำหนด` : ''} ตอบผิดหมดไม่ได้ดาว</span></li>
              ${m.exp !== undefined ? `<li>${ICON.star(18)}<span>ได้ EXP จากข้อที่ตอบถูก และอีก ${m.exp} EXP เมื่อทำข้อสอบเสร็จ (แม้ไม่ถูกสักข้อ) ทำซ้ำได้ แต่ได้ EXP ครึ่งเดียว</span></li>` : ''}
              ${m.advanced.unlocked ? `<li>${ICON.star(18)}<span>แพลนของคุณได้โจทย์ข้อพิเศษเพิ่มในชุดข้อสอบ</span></li>` : `<li>${ICON.star(18)}<span>แพลน HEADFACE+ และ MAX มีโจทย์ข้อพิเศษเพิ่มในชุดข้อสอบ</span></li>`}
            </ul>`)}` : '<p class="empty-p">ชุดข้อสอบของวิชานี้ยังไม่เปิดให้ทำ เมื่อพร้อมจะแจ้งที่นี่</p>'}
          ${info.history.length ? fold('history', `ประวัติการสอบ (${info.history.length})`, `<ul class="hist">${rows}</ul>${cmp}`) : ''}
          ${activeNote}
          ${error ? `<p class="errbox" role="alert">${esc(error)}</p>` : ''}
          ${m.available ? abar(`<button type="button" class="btn btn-lg btn-orange" data-act="start"${busy ? ' disabled' : ''}><span>${startLabel}</span>${busy ? '' : ICON.next(14)}</button>`) : ''}
        </div>`;
    }

    // ───── ระหว่างสอบ ─────
    const timerClass = (remaining) => {
        const ratio = remaining / attempt.durationSec;
        return ratio <= 0.1 ? 'crit' : ratio <= 0.25 ? 'warn' : '';
    };

    function paintTimer() {
        if (!attempt || stage !== 'run') return;
        const remaining = remainingSec();
        const t = $('#timer');
        if (t) {
            t.textContent = formatClock(remaining);
            t.parentElement.className = `timer ${timerClass(remaining)}`.trim();
        }
        if (remaining <= 0 && !busy && Date.now() - lastAutoTry >= AUTO_SUBMIT_RETRY_MS) {
            lastAutoTry = Date.now();
            submit();
        }
    }

    function runView() {
        const q = attempt.questions[i];
        const answered = answeredCount();
        const total = attempt.questions.length;
        const isLast = i === total - 1;
        const pick = picks[q.id];
        // หน้าแก้เฉพาะจุด (study-dom.js): ข้อใหม่ (data-key) เลื่อนเข้ามา แถบความคืบหน้า/แถบปุ่มล่างอยู่ที่เดิมและเปลี่ยนด้วย transition
        return `<div data-key="run">
          <div class="xhead"><div class="qhead" style="flex:1"><div class="qbar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${answered}" aria-label="ทำแล้ว ${answered} จาก ${total} ข้อ"><i style="width:${(answered / total) * 100}%"></i></div><span class="qcount">ข้อ ${i + 1}/${total}</span></div></div>
          <div class="xhead" style="margin-top:10px"><button type="button" class="flagbtn" data-act="flag" aria-pressed="${flags.has(q.id)}">${ICON.flag(18)}<span>${flags.has(q.id) ? 'ติดธงแล้ว' : 'ติดธงข้อนี้'}</span></button><button type="button" class="xnav-btn" data-act="open-nav">${ICON.grid(18)}<span>ข้อทั้งหมด</span></button></div>
          ${saveWarn ? '<p class="note warn" role="status" aria-live="polite">บันทึกอัตโนมัติไม่สำเร็จ กำลังลองใหม่ คำตอบของคุณยังอยู่ในหน้านี้ อย่าปิดหน้าจนกว่าจะส่งข้อสอบ</p>' : ''}
          ${error ? `<p class="errbox" role="alert">${esc(error)}</p>` : ''}
          <div class="qview" data-key="q-${esc(q.id)}" data-dir="${qdir}">
            <section class="qcard" aria-labelledby="q-t">
              <p class="qtopic">${esc(q.topic)}${q.special ? ' <span class="chip chip-amber" style="margin-left:6px">ข้อพิเศษ</span>' : ''}</p>
              <h2 class="qtext" id="q-t" style="white-space:pre-line">${esc(q.text)}</h2>
              ${questionMediaHtml(q.media)}
              <div class="choices" role="radiogroup" aria-label="ตัวเลือกคำตอบ">${q.choices.map((c, idx) => `<button type="button" class="choice${c.id === pick ? ' is-sel' : ''}" role="radio" aria-checked="${c.id === pick}" data-choice="${esc(c.id)}"${busy ? ' disabled' : ''}><span class="choice-l">${choiceLabel(idx)}</span><span class="choice-t">${choiceImageHtml(c)}<span>${esc(c.text)}</span></span><span class="choice-m"></span></button>`).join('')}</div>
            </section>
          </div>
          ${abar(`<button type="button" class="btn-ico" data-act="prev" aria-label="ข้อก่อนหน้า"${i === 0 ? ' disabled' : ''}>${ICON.prev(18)}</button>${isLast
            ? `<button type="button" class="btn btn-lg btn-orange" data-act="ask-submit"${busy ? ' disabled' : ''}>${busy ? 'กำลังส่ง...' : 'ส่งข้อสอบ'}</button>`
            : `<button type="button" class="btn btn-lg" data-act="next"><span>ถัดไป</span>${ICON.next(14)}</button>`}`)}
        </div>`;
    }

    // ───── ชั้นซ้อน (ข้อทั้งหมด / ยืนยันส่ง) ─────
    function closeOverlay() { document.getElementById('overlay')?.remove(); }
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
        ov.querySelector('button')?.focus({ preventScroll: true });
    }

    function navSheet() {
        const total = attempt.questions.length;
        overlay(`<div class="sheet-h"><h3>ข้อทั้งหมด</h3><button type="button" class="sheet-x" data-act="close-ov" aria-label="ปิด">✕</button></div>
          <p class="sheet-p">ตอบแล้ว <b>${answeredCount()}</b> จาก ${total} ข้อ • ติดธง <b>${flags.size}</b> ข้อ</p>
          <div class="grid5">${attempt.questions.map((q, idx) => {
            const a = picks[q.id] !== undefined;
            return `<button type="button" class="qn${a ? ' ans' : ''}${idx === i ? ' cur' : ''}" data-goto="${idx}" aria-label="ข้อ ${idx + 1} ${a ? 'ตอบแล้ว' : 'ยังไม่ตอบ'}${flags.has(q.id) ? ' ติดธง' : ''}"${idx === i ? ' aria-current="true"' : ''}>${idx + 1}${flags.has(q.id) ? `<span class="fl">${ICON.flag(12)}</span>` : ''}</button>`;
          }).join('')}</div>
          <div class="legend"><span><i class="a"></i>ตอบแล้ว</span><span><i></i>ยังไม่ตอบ</span><span><i class="f"></i>ติดธง</span></div>
          <div class="sheet-b"><button type="button" class="btn btn-lg btn-orange" data-act="ask-submit" style="margin-top:8px">ส่งข้อสอบ</button></div>`, 'ข้อทั้งหมด');
    }

    function confirmSheet() {
        const unanswered = attempt.questions.length - answeredCount();
        overlay(`<div class="sheet-h"><h3>ส่งข้อสอบหรือไม่?</h3><button type="button" class="sheet-x" data-act="close-ov" aria-label="ปิด">✕</button></div>
          <p class="sheet-p">${unanswered ? `ยังมี <b>${unanswered}</b> ข้อที่ยังไม่ตอบ` : 'ตอบครบทุกข้อแล้ว'}${flags.size ? ` • ติดธงไว้ <b>${flags.size}</b> ข้อ` : ''}<br>เมื่อส่งแล้วจะแก้คำตอบไม่ได้</p>
          <div class="sheet-b"><button type="button" class="btn btn-lg btn-orange" data-act="submit">ส่งข้อสอบ</button><button type="button" class="btn btn-lg btn-line" data-act="close-ov" style="margin-top:0">กลับไปทำต่อ</button></div>`, 'ยืนยันการส่งข้อสอบ');
    }

    // ───── บันทึกอัตโนมัติ ─────
    function scheduleSave(ms = saveDebounceMs) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, ms);
    }
    async function save() {
        if (!attempt || stage !== 'run' || saving || !dirty) return;
        saving = true;
        dirty = false;
        try {
            await api.saveMockAnswers(attempt.id, snapshot());
            if (saveWarn) { saveWarn = false; render(); }
        } catch (err) {
            if (err instanceof StudyApiError && err.code === 'ATTEMPT_CLOSED' && err.body && err.body.details && err.body.details.result) {
                saving = false;
                return finish(err.body.details.result);
            }
            dirty = true;
            if (!saveWarn) { saveWarn = true; render(); }
            scheduleSave(SAVE_RETRY_MS);
        } finally {
            saving = false;
        }
    }

    // ───── เริ่ม / ส่ง ─────
    function stopTimers() {
        clearInterval(timerId);
        clearTimeout(saveTimer);
        timerId = null;
        saveTimer = null;
        window.removeEventListener('beforeunload', guard);
    }

    function enterRun(data) {
        attempt = data.attempt;
        resumed = !!data.resumed;
        clockOffset = data.serverNow - Date.now();
        picks = { ...attempt.answers };
        flags = new Set(attempt.flags);
        const firstOpen = attempt.questions.findIndex((q) => picks[q.id] === undefined);
        i = resumed && firstOpen > 0 ? firstOpen : 0;
        dirty = false;
        saveWarn = false;
        stage = 'run';
        window.addEventListener('beforeunload', guard);
        bar.innerHTML = `<span class="timer" role="timer" aria-label="เวลาที่เหลือ">${ICON.clock(18)}<span id="timer">${formatClock(remainingSec())}</span></span>`;
        timerId = setInterval(paintTimer, tickMs);
        window.scrollTo(0, 0);
        render({ focus: true });
        paintTimer();
    }

    async function start() {
        if (busy) return;
        busy = true;
        error = null;
        render();
        let data;
        try {
            data = await api.startMock(key);
        } catch (err) {
            busy = false;
            error = messageOf(err);
            return render();
        }
        busy = false; // ก่อนวาดหน้าสอบ: ถ้ายังเป็น true ปุ่มตัวเลือกจะถูกวาดแบบกดไม่ได้
        enterRun(data);
    }

    function finish(r) {
        stopTimers();
        closeOverlay();
        result = r;
        stage = 'result';
        busy = false;
        error = null;
        bar.innerHTML = '';
        info.active = null;
        window.scrollTo(0, 0);
        render({ focus: true });
    }

    async function submit() {
        if (!attempt || busy || stage !== 'run') return;
        busy = true;
        error = null;
        closeOverlay();
        clearTimeout(saveTimer);
        render();
        try {
            const done = await api.submitMock(attempt.id, snapshot());
            finish(done.result);
        } catch (err) {
            if (err instanceof StudyApiError && err.code === 'ATTEMPT_CLOSED' && err.body && err.body.details && err.body.details.result) return finish(err.body.details.result);
            busy = false;
            error = `ส่งข้อสอบไม่สำเร็จ: ${messageOf(err)} คำตอบของคุณยังอยู่ในหน้านี้ กด "ส่งข้อสอบ" อีกครั้ง`;
            render();
        }
    }

    // ───── สรุปผล ─────
    function resultView() {
        const r = result;
        const unanswered = r.total - r.answered;
        const pills = [
            r.passed === null ? '' : r.passed ? `<span class="pill ok">${ICON.check(14, 3.4)} ผ่านเกณฑ์</span>` : '<span class="pill warn">ยังไม่ผ่านเกณฑ์</span>',
            `<span class="pill">${ICON.clock(14)} ${formatClock(r.secondsUsed)} / ${formatClock(r.durationSec)}</span>`,
            deltaHtml(r.deltaVsPrevious),
            unanswered ? `<span class="pill warn">ไม่ได้ตอบ ${unanswered}</span>` : '',
            expPillHtml(r.reward),
        ].filter(Boolean).join('');
        const fold = (title, inner) => `<details class="fold"><summary><span>${title}</span><i>${ICON.down(18)}</i></summary><div>${inner}</div></details>`;
        // ผลรายหัวข้อและเฉลยรายข้อยาว จึงพับเก็บไว้ในหัวข้อที่กดเปิดเมื่อต้องการ — หน้าสรุปมีแค่คะแนน ป้ายสถานะ และดาว
        return `<div data-key="result">
          ${r.autoSubmitted ? '<div class="demo-note" role="alert" style="border-color:#F43F5E;background:#FFF1F2;color:#881337"><span>หมดเวลา ระบบส่งคำตอบที่ทำไว้ให้อัตโนมัติ</span></div>' : ''}
          <section class="rblock result" style="margin-top:14px">
            ${ringHtml(r.percent, `${r.correct}/${r.total} ข้อ`)}
            <h2>${esc(scoreMessage(r.percent))}</h2>
            <div class="pills" aria-label="สรุปผล">${pills}</div>
            <div class="stars-big" role="status">${ICON.star(26, '#F59E0B')}<span><span data-countup="${r.starsEarned}">${r.starsEarned}</span> ดาว</span><small>จากคะแนน ${r.percent}% = ${r.starsBase} ดาว${r.starsTimeBonus ? ` + โบนัสเวลา ${r.starsTimeBonus}` : ''}</small></div>
          </section>
          ${fold('ผลรายหัวข้อ', `<div class="rows" style="margin-top:0">${r.topics.map((t) => `<div class="topic-row"><div class="top"><span>${esc(t.topic)}</span><span>${t.correct}/${t.total}</span></div><div class="bar" aria-hidden="true"><i style="width:${t.total ? (t.correct / t.total) * 100 : 0}%"></i></div></div>`).join('')}</div>`)}
          ${fold(`เฉลยรายข้อ (${r.review.length})`, `<div class="review">${r.review.map((x) => {
                const state = !x.yourChoiceId ? 'skip' : x.isCorrect ? 'ok' : 'bad';
                const ci = x.choices.findIndex((c) => c.id === x.correctChoiceId);
                const yi = x.choices.findIndex((c) => c.id === x.yourChoiceId);
                return `<div class="review-i ${state === 'ok' ? 'ok' : state === 'bad' ? 'bad' : ''}"><h3>${state === 'ok' ? ICON.check(16) : state === 'bad' ? ICON.x(16) : ICON.info(16)}<span>ข้อ ${x.n} ${esc(x.text)} — ${state === 'ok' ? 'ถูก' : state === 'bad' ? 'ผิด' : 'ไม่ได้ตอบ'}${x.special ? ' • ข้อพิเศษ' : ''}</span></h3>${questionMediaHtml(x.media)}<p>เฉลย: ${ci >= 0 ? `${choiceLabel(ci)} ${esc(x.choices[ci].text)}` : ''}${state === 'bad' && yi >= 0 ? ` • คุณตอบ ${choiceLabel(yi)}` : ''}</p>${x.explanation ? `<p>${esc(x.explanation)}</p>` : ''}</div>`;
              }).join('')}</div>`)}
          <div class="res-actions">
            <button type="button" class="btn btn-lg btn-block btn-orange" data-act="retry" style="margin-top:0">ทำข้อสอบอีกครั้ง</button>
            <a class="btn btn-lg btn-block btn-line" href="${courseUrl(subject.id)}" style="margin-top:0">กลับหน้ารายละเอียดวิชา</a>
          </div>
        </div>`;
    }

    function render({ focus = false } = {}) {
        patchHtml(content, stage === 'intro' ? introView() : stage === 'run' ? runView() : resultView());
        qdir = 0;
        view.classList.toggle('has-abar', (stage === 'intro' && info.mock.available) || stage === 'run');
        if (stage === 'result') {
            animateRing(content);
            celebrate();
        }
        if (focus) focusView();
    }

    // ผลสรุป: ดาวนับขึ้น + ริบบิ้นเมื่อผ่านเกณฑ์ (หรือได้ตั้งแต่ 70% ถ้าไม่มีเกณฑ์) ทำครั้งเดียวต่อผลหนึ่งครั้ง
    let celebrated = null;
    function celebrate() {
        if (!result || celebrated === result) return;
        celebrated = result;
        const el = typeof content.querySelector === 'function' ? content.querySelector('[data-countup]') : null;
        if (el) { countUp(el, Number(el.dataset.countup)); pop(el.closest('.stars-big'), { scale: 1.12, ms: 500 }); }
        animateReward(content);
        if (result.passed === true || (result.passed === null && result.percent >= 70)) confetti();
    }

    async function backToIntro() {
        stage = 'intro';
        result = null;
        attempt = null;
        window.scrollTo(0, 0);
        try { info = await api.getMockInfo(key); } catch (_) { /* ใช้ข้อมูลเดิม: ประวัติอาจยังไม่มีครั้งล่าสุด */ }
        render({ focus: true });
    }

    // ───── เหตุการณ์ ─────
    content.onclick = (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'start') return start();
        if (act === 'retry') return backToIntro();
        if (stage !== 'run' || !attempt) return;
        const q = attempt.questions[i];
        if (act === 'flag') {
            if (flags.has(q.id)) flags.delete(q.id); else flags.add(q.id);
            dirty = true;
            scheduleSave();
            render();
            return $('[data-act="flag"]')?.focus({ preventScroll: true });
        }
        if (act === 'prev' && i > 0) { i--; qdir = -1; window.scrollTo(0, 0); return render({ focus: true }); }
        if (act === 'next' && i < attempt.questions.length - 1) { i++; qdir = 1; window.scrollTo(0, 0); return render({ focus: true }); }
        if (act === 'open-nav') return navSheet();
        if (act === 'ask-submit') return confirmSheet();
        const choice = e.target.closest('[data-choice]');
        if (choice && !busy) {
            picks[q.id] = choice.dataset.choice;
            dirty = true;
            scheduleSave();
            render();
        }
    };

    // ปุ่มในชั้นซ้อนอยู่นอก #content จึงฟังที่ document
    document.addEventListener('click', (e) => {
        if (!document.getElementById('overlay') || stage !== 'run') return;
        const go = e.target.closest('[data-goto]');
        if (go) { const to = Number(go.dataset.goto); qdir = to === i ? 0 : to > i ? 1 : -1; i = to; closeOverlay(); window.scrollTo(0, 0); return render({ focus: true }); }
        const act = e.target.closest('#overlay [data-act]')?.dataset.act;
        if (act === 'ask-submit') return confirmSheet();
        if (act === 'submit') return submit();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty) save(); });

    render();
    return { dispose() { stopTimers(); closeOverlay(); } }; // ใช้ในเทสต์เพื่อไม่ให้ตัวจับเวลาค้าง
}
