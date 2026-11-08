/**
 * js/tutor-page.js — หน้าคุยกับ AI Tutor (tutor.html)
 *
 * ขั้นของหน้า: โหลดสถานะ (GET /tutor) → ล็อก (FREE / ยังไม่เปิด / ครบโควตา / เครดิตไม่พอ) หรือหน้าเริ่มคุย → คุยสด → สรุป
 * ฟังก์ชัน render* เป็น "ข้อมูล → HTML" ล้วน ๆ (เทสต์ใน Node: test/tutor-page.test.mjs) ส่วน mountTutorPage ผูกกับหน้าจริง
 * หน้านี้ไม่เก็บเนื้อหาบทสนทนาไว้ที่ใดเลย (ไม่เขียนลงที่เก็บข้อมูลของเบราว์เซอร์ ไม่ส่งขึ้นเซิร์ฟเวอร์ของ HEADFACE) มีแต่บนจอจนกว่าจะปิดหน้า
 */
import { studyApi, StudyApiError } from './study-api.js';
import { TutorLive } from './tutor-live.js';
import { createMedia } from './tutor-media.js';
import { classifyFile, clipText, attachmentPrompt } from './tutor-files.js';
import { getProfilePageUrl } from './env.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SUBJECT_RE = /^[a-z][a-z0-9-]{1,23}$/;

// ───────────── ไอคอน (เส้นบาง สไตล์เดียวกับ ICON ใน study-ui.js) ─────────────
const svg = (inner, size = 22, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const ICONS = {
    mic: (s) => svg('<path d="M9 5a3 3 0 0 1 3 -3a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3a3 3 0 0 1 -3 -3z"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M8 21h8"/><path d="M12 17v4"/>', s),
    micOff: (s) => svg('<path d="M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -.13 .87"/><path d="M5 10a7 7 0 0 0 11.8 5.1"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M3 3l18 18"/>', s),
    camera: (s) => svg('<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2"/><path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0"/>', s),
    clip: (s) => svg('<path d="M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5"/>', s),
    keyboard: (s) => svg('<path d="M2 8a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2z"/><path d="M6 10h.01"/><path d="M10 10h.01"/><path d="M14 10h.01"/><path d="M18 10h.01"/><path d="M6 14h.01"/><path d="M18 14h.01"/><path d="M10 14h4"/>', s),
    send: (s) => svg('<path d="M10 14l11 -11"/><path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"/>', s),
    stop: (s) => svg('<rect x="6" y="6" width="12" height="12" rx="2.5"/>', s),
    flip: (s) => svg('<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>', s),
    lock: (s) => svg('<path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/>', s),
    check: (s) => svg('<path d="M5 12l5 5l10 -10"/>', s, 3),
    spark: (s) => svg('<path d="M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6"/>', s),
    clock: (s) => svg('<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/>', s),
    info: (s) => svg('<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 9h.01"/><path d="M11 12h1v4h1"/>', s)
};

// ───────────── ตัวช่วยล้วน ๆ ─────────────
export const fmt = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n)).toLocaleString('th-TH') : '–');

export function formatClock(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** วิชา/บทที่นักเรียนกำลังเรียนอยู่ (มากับลิงก์ ?s=sci&l=3) — ค่าที่ไม่ตรงรูปแบบถูกทิ้ง */
export function readContext(params) {
    const s = params.get('s');
    const l = Number(params.get('l'));
    const subjectId = s && SUBJECT_RE.test(s) ? s : null;
    const lessonNo = subjectId && Number.isInteger(l) && l >= 1 && l <= 9999 ? l : null;
    return { subjectId, lessonNo };
}

export const backUrl = ({ subjectId, lessonNo }) => (subjectId && lessonNo ? `lesson.html?s=${encodeURIComponent(subjectId)}&l=${lessonNo}` : subjectId ? `course.html?s=${encodeURIComponent(subjectId)}` : 'index.html');

export function stateLabel(state, { muted = false } = {}) {
    switch (state) {
        case 'starting': return 'กำลังเริ่ม…';
        case 'connecting': return 'กำลังเชื่อมต่อ AI Tutor…';
        case 'reconnecting': return 'สายหลุด กำลังต่อใหม่…';
        case 'listening': return muted ? 'ไมค์ปิดอยู่ — พิมพ์ข้อความได้' : 'ฟังอยู่ พูดได้เลย';
        case 'thinking': return 'กำลังคิด…';
        case 'speaking': return 'AI กำลังพูด · พูดแทรกได้';
        case 'ending': return 'กำลังจบการคุย…';
        case 'ended': return 'จบการคุยแล้ว';
        default: return '';
    }
}

/** สถานะที่ใช้ไม่ได้ → หน้าล็อก (เหตุผลมาจาก GET /tutor: blocked, หรือรหัสผิดพลาดตอนเริ่ม) */
export function blockedReason(code) {
    switch (code) {
        case 'FEATURE_FORBIDDEN': case 'plan': return 'plan';
        case 'FEATURE_QUOTA_EXCEEDED': case 'quota': return 'quota';
        case 'INSUFFICIENT_CREDITS': case 'credits': return 'credits';
        case 'TUTOR_DISABLED': case 'closed': return 'closed';
        default: return null;
    }
}

// ───────────── HTML ─────────────
const orb = (state, cls = '') => `<div class="tt-orb ${cls}" data-state="${esc(state)}" aria-hidden="true"><i></i><i></i><i></i></div>`;

export function contextChip(ctx) {
    if (!ctx || (!ctx.subject && !ctx.lesson)) return '';
    const text = [ctx.subject, ctx.lessonNo ? `บทที่ ${ctx.lessonNo}` : '', ctx.lesson].filter(Boolean).join(' · ');
    return `<p class="tt-ctx" title="${esc(text)}">${ICONS.info(16)}<span>กำลังเรียน: ${esc(text)}</span></p>`;
}

export function renderLobby({ status, ctx, error = '' }) {
    const c = status.credits;
    const conv = status.conversations;
    const left = conv.limit === null ? null : Math.max(0, conv.limit - conv.used);
    return `
      ${error ? `<p class="tt-banner error" role="alert">${esc(error)}</p>` : ''}
      <section class="tt-card tt-hero">
        ${orb('idle')}
        <h2 class="tt-h">คุยกับ AI Tutor</h2>
        <p class="tt-p">ถามด้วยเสียงได้เหมือนคุยกับติวเตอร์ เปิดกล้องให้ดูโจทย์ หรือส่งรูปและไฟล์ให้ช่วยอธิบาย</p>
        ${contextChip(ctx)}
      </section>
      <form id="startForm" class="tt-card" style="display:grid;gap:16px" novalidate>
        <fieldset class="tt-modes" role="radiogroup">
          <legend>เลือกโหมด</legend>
          <label class="tt-mode"><input type="radio" name="mode" value="live" checked><span class="dot" aria-hidden="true"></span><span><b>Live</b><small>ตอบไว คุยลื่น เหมาะกับถามทั่วไปและทบทวนบทเรียน</small></span></label>
          <label class="tt-mode"><input type="radio" name="mode" value="extended"><span class="dot" aria-hidden="true"></span><span><b>Live Extended<span class="tag">คิดลึก</span></b><small>ให้ AI คิดมากขึ้นก่อนตอบ เหมาะกับโจทย์ยาก อาจช้ากว่าและใช้เครดิตมากกว่าเล็กน้อย</small></span></label>
        </fieldset>
        <div class="tt-switches">
          <label class="tt-switch"><span><b>ใช้ไมค์</b><small>พูดคุยด้วยเสียง (ปิดทีหลังแล้วพิมพ์แทนได้)</small></span><input type="checkbox" name="mic" role="switch" checked><i class="sw" aria-hidden="true"></i></label>
          <label class="tt-switch"><span><b>เปิดกล้องตั้งแต่เริ่ม</b><small>ให้ AI เห็นโจทย์หรือสมุดของคุณ (เปิดทีหลังได้)</small></span><input type="checkbox" name="camera" role="switch"><i class="sw" aria-hidden="true"></i></label>
        </div>
        <div class="tt-facts">
          <div class="tt-fact"><span>เครดิตวันนี้</span><b>${fmt(c.available)} <small>/ ${fmt(c.dailyLimit)}</small></b></div>
          <div class="tt-fact"><span>ครั้งที่เหลือวันนี้</span><b>${left === null ? 'ไม่จำกัด' : `${fmt(left)} <small>/ ${fmt(conv.limit)}</small>`}</b></div>
          <div class="tt-fact"><span>ใช้เครดิตโดยประมาณ</span><b>~${fmt(c.perMinuteGuide)} <small>/นาทีที่คุยต่อเนื่อง</small></b></div>
          <div class="tt-fact"><span>คุยได้ครั้งละ</span><b>${fmt(status.limits.maxSessionMin)} <small>นาที</small></b></div>
        </div>
        <button id="startBtn" type="submit" class="btn btn-block btn-lg" style="margin-top:0">${ICONS.mic(20)} เริ่มคุยกับ AI Tutor</button>
        <p class="tt-privacy">เครดิตหักตามจำนวน token ที่ใช้จริง (อัตราสูงกว่าแชท LYNX เล็กน้อย) จากกระเป๋าเครดิต LYNX ใบเดียวกัน<br>เสียง ภาพ และไฟล์ที่ส่งจะถูกส่งให้ Google Gemini ประมวลผล HEADFACE ไม่เก็บบทสนทนาไว้ — อย่าส่งข้อมูลส่วนตัว เช่น เลขบัตร รหัสผ่าน</p>
      </form>`;
}

export function renderLocked(reason, { status = null, message = '' } = {}) {
    const back = '<a class="btn btn-line" href="index.html">กลับหน้าแรก</a>';
    const plans = `<a class="btn" href="${esc(getProfilePageUrl())}">ดูแพลนของฉัน</a>`;
    const wrap = (tileCls, icon, title, text, extra = '', actions = back) => `
      <section class="tt-card tt-lock" role="region" aria-label="${esc(title)}">
        <span class="tile ${tileCls}" aria-hidden="true">${icon}</span>
        <h2 class="tt-h">${esc(title)}</h2>
        <p class="tt-p">${esc(text)}</p>
        ${extra}
        <div class="tt-actions">${actions}</div>
      </section>`;
    const perk = (t) => `<li>${ICONS.check(16)}<span>${esc(t)}</span></li>`;
    switch (reason) {
        case 'plan':
            return wrap('tile-sky', ICONS.lock(26), 'AI Tutor สำหรับแพลน PLUS และ MAX',
                'อัปเกรดแพลนเพื่อคุยกับติวเตอร์ AI ได้ตลอดเวลาที่อยากทบทวน',
                `<ul class="tt-perks">${perk('คุยด้วยเสียงแบบสด ๆ พูดแทรกได้')}${perk('เปิดกล้องให้ดูโจทย์ หรือส่งรูป PDF ให้ช่วยอธิบาย')}${perk('โหมด Extended คิดลึกสำหรับโจทย์ยาก')}${perk('ใช้เครดิต LYNX ที่มากับแพลน ไม่ต้องจ่ายเพิ่ม')}</ul>`,
                `${plans}${back}`);
        case 'closed':
            return wrap('tile-amber', ICONS.clock(26), 'AI Tutor ยังไม่เปิดให้ใช้งาน', message || 'ทีมงานกำลังเตรียมระบบอยู่ เร็ว ๆ นี้จะเปิดให้คุยกันได้');
        case 'quota': {
            const limit = status?.conversations?.limit;
            return wrap('tile-amber', ICONS.clock(26), limit ? `วันนี้คุยครบ ${fmt(limit)} ครั้งแล้ว` : 'วันนี้ใช้สิทธิ์ครบแล้ว', 'สิทธิ์จะกลับมาพรุ่งนี้ (รีเซ็ตตอนเที่ยงคืน) ระหว่างนี้ถามเพื่อนร่วมทางอย่าง LYNX ได้ที่ปุ่มแชทลอยในหน้าบทเรียน');
        }
        case 'credits': {
            const min = status?.credits?.minToStart;
            return wrap('tile-rose', ICONS.clock(26), 'เครดิต LYNX วันนี้เหลือไม่พอ', `ต้องมีเครดิตอย่างน้อย ${min ? fmt(min) : 'อีกหน่อย'} เครดิตจึงจะเริ่มคุยได้ เครดิตจะรีเซ็ตตอนเที่ยงคืน`);
        }
        default:
            return wrap('tile-rose', ICONS.info(26), 'โหลดข้อมูลไม่สำเร็จ', message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', '', `<button type="button" class="btn" data-act="retry">ลองใหม่</button>${back}`);
    }
}

export function renderLive({ modeLabel, ctx }) {
    return `
      <div class="tt-stage">
        <div class="tt-top"><span class="chip chip-g">${esc(modeLabel)}</span>${contextChipShort(ctx)}</div>
        <div id="stageRow" class="tt-stage-row">
          <div class="tt-orb-box">
            ${orb('starting')}
            <p id="stateLabel" class="tt-state" role="status" aria-live="polite">กำลังเริ่ม…</p>
            <p id="meter" class="tt-meter"></p>
          </div>
          <div id="camBox" class="tt-cam mirror" hidden><video id="camVideo" playsinline muted autoplay aria-label="ภาพจากกล้องของคุณ"></video><button type="button" data-act="flip" aria-label="สลับกล้องหน้า/หลัง">${ICONS.flip(22)}</button></div>
        </div>
        <p id="banner" class="tt-banner info" role="status" hidden></p>
        <ol id="log" class="tt-log" aria-label="บทสนทนา"><li id="logHint" class="tt-hint">พูดได้เลย หรือพิมพ์ข้อความ — คำพูดของทั้งสองฝ่ายจะขึ้นที่นี่</li></ol>
      </div>`;
}

const contextChipShort = (ctx) => (ctx?.lesson || ctx?.subject ? `<span class="tt-small" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc([ctx.subject, ctx.lesson].filter(Boolean).join(' · '))}</span>` : '');

export function renderDock() {
    return `
      <div class="tt-dock-in">
        <form id="textForm" class="tt-text" hidden><input id="textInput" type="text" maxlength="1000" autocomplete="off" enterkeyhint="send" placeholder="พิมพ์ข้อความถึง AI Tutor…" aria-label="ข้อความถึง AI Tutor"><button type="submit" aria-label="ส่งข้อความ">${ICONS.send(20)}</button></form>
        <div class="tt-btns">
          <button type="button" class="tt-b" data-act="attach" aria-label="แนบรูปหรือไฟล์">${ICONS.clip(22)}<span>แนบ</span></button>
          <button type="button" class="tt-b" data-act="camera" aria-pressed="false" aria-label="เปิดหรือปิดกล้อง">${ICONS.camera(22)}<span>กล้อง</span></button>
          <button type="button" class="tt-b tt-mic" data-act="mic" aria-pressed="true" aria-label="ปิดไมค์">${ICONS.mic(28)}<span>ไมค์</span></button>
          <button type="button" class="tt-b" data-act="keyboard" aria-pressed="false" aria-label="พิมพ์ข้อความ">${ICONS.keyboard(22)}<span>พิมพ์</span></button>
          <button type="button" class="tt-b tt-end" data-act="end" aria-label="จบการคุย">${ICONS.stop(22)}<span>จบ</span></button>
        </div>
        <input id="fileInput" type="file" hidden accept="image/*,.pdf,.txt,.md,.csv,.json,application/pdf,text/*">
      </div>`;
}

export function renderSummary({ summary, credits, reason }) {
    const mins = summary ? Math.max(1, Math.round(summary.durationSec / 60)) : null;
    const note = reason === 'credits' ? 'หยุดเพราะเครดิตวันนี้ใกล้หมด' : reason === 'time' ? 'ครบเวลาของการคุยครั้งนี้' : reason === 'error' || reason === 'connect_failed' ? 'การคุยจบเพราะการเชื่อมต่อมีปัญหา' : 'ขอบคุณที่คุยกับ AI Tutor';
    return `
      <section class="tt-card tt-sum">
        ${orb('ended', 'sm')}
        <h2 class="tt-h">จบการคุยแล้ว</h2>
        <p class="tt-p">${esc(note)}</p>
        ${summary ? `<div class="tt-sum-grid"><div><b>${fmt(mins)}</b><span>นาที</span></div><div><b>${fmt(summary.creditsCharged)}</b><span>เครดิตที่ใช้</span></div><div><b>${credits ? fmt(credits.available) : '–'}</b><span>เครดิตที่เหลือ</span></div></div>`
            : '<p class="tt-small" style="margin-top:12px">ยังสรุปเครดิตที่ใช้ไม่ได้ในตอนนี้ — ดูยอดคงเหลือล่าสุดได้ที่มุมขวาบน</p>'}
        <div class="tt-actions">
          <button type="button" class="btn" data-act="again">คุยอีกครั้ง</button>
          <a class="btn btn-line" data-role="back" href="index.html">กลับไปเรียน</a>
        </div>
      </section>`;
}

export function renderMessage({ id, role, text, final, typed }) {
    return `<li class="tt-msg ${role === 'user' ? 'user' : 'ai'}${final ? '' : ' partial'}${typed ? ' typed' : ''}" data-id="${esc(id)}"><span class="sr-only">${role === 'user' ? 'คุณ: ' : 'AI Tutor: '}</span>${esc(text)}</li>`;
}

// ───────────── ผูกกับหน้าจริง ─────────────
const defaultMakeLive = ({ api, media }) => new TutorLive({ api, media });

export async function mountTutorPage({
    doc = document, win = window, api = studyApi, params = new URLSearchParams(win.location.search),
    makeLive = defaultMakeLive, makeMedia = createMedia, log = console
} = {}) {
    const $ = (sel, root = doc) => root.querySelector(sel);
    const content = $('#content');
    const view = $('#view');
    const pill = $('#creditPill');
    const pillValue = $('#creditValue');
    const ctx = readContext(params);
    const back = backUrl(ctx);
    $('#backLink').href = back;
    $('#backLink').setAttribute('aria-label', ctx.subjectId ? 'กลับไปบทเรียน' : 'กลับหน้าแรก');

    let live = null;
    let media = null;
    let facing = 'user';
    let lessonInfo = { ...ctx, subject: null, lesson: null };
    let lastCredits = null;
    let startedAt = 0;
    let clockTimer = null;
    let wakeLock = null;
    let sessionMode = 'live';
    let mutedUi = false;

    // ───── เครดิตมุมขวาบน ─────
    function showCredits(available) {
        if (!Number.isFinite(Number(available))) return;
        pill.hidden = false;
        pillValue.textContent = fmt(available);
        pill.classList.toggle('low', available < 2000 && available >= 150);
        pill.classList.toggle('out', available < 150);
    }

    const setView = (html, { liveMode = false } = {}) => {
        content.innerHTML = html;
        view.classList.toggle('is-live', liveMode);
        if (!liveMode) view.classList.remove('has-text');
        $('#dock')?.remove();
    };

    // ───── โหลดสถานะ ─────
    async function load(note = '') {
        content.innerHTML = '<div class="sk-wrap" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">กำลังโหลด...</span><i class="sk sk-card"></i><i class="sk sk-card s"></i></div>';
        let status;
        try {
            const [s, lesson] = await Promise.all([
                api.getTutor(),
                ctx.subjectId && ctx.lessonNo ? api.getLesson(ctx.subjectId, ctx.lessonNo).catch(() => null) : Promise.resolve(null)
            ]);
            status = s;
            lessonInfo = { ...ctx, subject: lesson?.subject?.title || null, lesson: lesson?.lesson?.title || null };
        } catch (err) {
            // Backend รุ่นที่ยังไม่มี AI Tutor ตอบ 404: ถือว่ายังไม่เปิด
            if (err instanceof StudyApiError && err.status === 404) { setView(renderLocked('closed')); return; }
            setView(renderLocked('error', { message: err instanceof StudyApiError ? err.message : '' }));
            return;
        }
        showCredits(status.credits?.available);
        if (!status.open) return setView(renderLocked('closed', { status }));
        if (status.blocked === 'plan') return setView(renderLocked('plan', { status }));
        if (status.blocked === 'quota') return setView(renderLocked('quota', { status }));
        if (status.blocked === 'credits') return setView(renderLocked('credits', { status }));
        setView(renderLobby({ status, ctx: lessonInfo, error: note }));
        view.focus({ preventScroll: true });
        return undefined;
    }

    // ───── ระหว่างคุย ─────
    const banner = (message, level = 'info') => {
        const el = $('#banner');
        if (!el) return;
        el.className = `tt-banner ${level}`;
        el.textContent = message;
        el.hidden = !message;
    };

    function addNote(text) {
        const log = $('#log');
        if (!log) return;
        $('#logHint')?.remove();
        log.insertAdjacentHTML('beforeend', `<li class="tt-note">${esc(text)}</li>`);
        log.lastElementChild.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
    }

    function upsertMessage(c) {
        const log = $('#log');
        if (!log) return;
        const existing = log.querySelector(`[data-id="${CSS.escape(c.id)}"]`);
        if (c.empty) { existing?.remove(); return; }
        $('#logHint')?.remove();
        const html = renderMessage(c);
        if (existing) existing.outerHTML = html;
        else log.insertAdjacentHTML('beforeend', html);
        log.lastElementChild.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
    }

    function setOrb(state) {
        const orbEl = $('.tt-orb');
        if (orbEl) { orbEl.dataset.state = state; if (state !== 'listening' && state !== 'speaking') orbEl.style.setProperty('--lvl', '0'); }
        const label = $('#stateLabel');
        if (label) label.textContent = stateLabel(state, { muted: mutedUi });
    }

    const setLevel = (value) => {
        const orbEl = $('.tt-orb');
        if (orbEl) orbEl.style.setProperty('--lvl', String(Math.min(1, value).toFixed(2)));
    };

    function updateMeter(charged) {
        const el = $('#meter');
        if (!el) return;
        el.textContent = `คุยมาแล้ว ${formatClock(Date.now() - startedAt)} · ใช้ไป ${fmt(charged ?? 0)} เครดิต`;
    }

    async function keepAwake() {
        try { wakeLock = await win.navigator.wakeLock?.request('screen'); } catch (_) { wakeLock = null; }
    }

    function stopClock() {
        if (clockTimer) { win.clearInterval(clockTimer); clockTimer = null; }
        try { wakeLock?.release(); } catch (_) { /* ปล่อยไปแล้ว */ }
        wakeLock = null;
    }

    function bindLive() {
        let charged = 0;
        const sessionBadge = () => updateMeter(charged);
        live.on('state', ({ state }) => {
            setOrb(state);
            if (state === 'listening' && !clockTimer) {
                startedAt = Date.now();
                clockTimer = win.setInterval(sessionBadge, 1000);
                sessionBadge();
                keepAwake();
            }
            if (state === 'reconnecting') banner('สายหลุด กำลังต่อใหม่ บทสนทนาจะต่อจากเดิม…', 'warn');
            else if (state === 'listening' || state === 'speaking') { if ($('#banner')?.classList.contains('warn') && $('#banner').textContent.startsWith('สายหลุด')) banner(''); }
        });
        live.on('level', ({ mic }) => { if (live.state === 'listening' && !mutedUi) setLevel(mic); });
        live.on('caption', upsertMessage);
        live.on('credits', (c) => {
            if (Number.isFinite(c.available)) { lastCredits = { available: c.available, dailyLimit: c.dailyLimit }; showCredits(c.available); }
            if (Number.isFinite(c.sessionCharged)) { charged = c.sessionCharged; sessionBadge(); }
            if (Number.isFinite(c.available) && c.available < 2000 && c.available >= 150) banner('เครดิตวันนี้ใกล้หมดแล้ว ถ้าหมดการคุยจะหยุดอัตโนมัติ', 'warn');
        });
        live.on('notice', ({ message, level }) => banner(message, level === 'warn' ? 'warn' : 'info'));
        live.on('error', ({ message }) => banner(message, 'error'));
        live.on('attachment', ({ kind, name }) => addNote(`${kind === 'image' ? 'ส่งรูป' : 'ส่งไฟล์'}: ${name}`));
        live.on('mic', ({ on, failed }) => {
            mutedUi = !on;
            const btn = $('[data-act="mic"]');
            if (!btn) return;
            btn.setAttribute('aria-pressed', String(on));
            btn.setAttribute('aria-label', on ? 'ปิดไมค์' : 'เปิดไมค์');
            btn.innerHTML = `${on ? ICONS.mic(28) : ICONS.micOff(28)}<span>${on ? 'ไมค์' : 'ปิดอยู่'}</span>`;
            btn.disabled = Boolean(failed);
            if (live.state === 'listening') setOrb('listening');
        });
        live.on('camera', ({ on, facing: f }) => {
            const box = $('#camBox');
            if (box) { box.hidden = !on; box.classList.toggle('mirror', f !== 'environment'); }
            $('#stageRow')?.classList.toggle('with-cam', on);
            $('[data-act="camera"]')?.setAttribute('aria-pressed', String(on));
        });
        live.on('ended', ({ summary, reason }) => {
            stopClock();
            const dock = $('#dock');
            if (dock) dock.hidden = true;
            setView(renderSummary({ summary, credits: lastCredits, reason }));
            const link = $('[data-role="back"]');
            if (link) link.href = back;
            view.focus({ preventScroll: true });
            live = null; media = null;
        });
    }

    async function startSession(form) {
        const data = new FormData(form);
        sessionMode = data.get('mode') === 'extended' ? 'extended' : 'live';
        const wantMic = data.get('mic') === 'on';
        const wantCam = data.get('camera') === 'on';
        media = makeMedia({ onPlaybackLevel: (v) => { if (live && live.state === 'speaking') setLevel(v); } });
        live = makeLive({ api, media });
        mutedUi = !wantMic;

        setView(renderLive({ modeLabel: sessionMode === 'extended' ? 'Live Extended' : 'Live', ctx: lessonInfo }), { liveMode: true });
        let dock = $('#dock');
        if (!dock) {
            dock = doc.createElement('div');
            dock.id = 'dock';
            dock.className = 'tt-dock';
            doc.body.appendChild(dock);
        }
        dock.hidden = false;
        dock.innerHTML = renderDock();
        media.attachVideo?.($('#camVideo'));
        bindLive(); // ปุ่มไมค์จะถูกตั้งตามจริงโดยเหตุการณ์ 'mic' ที่ live.start ส่งหลังขออนุญาตไมค์
        try {
            await live.start({ mode: sessionMode, subjectId: ctx.subjectId, lessonNo: ctx.lessonNo, mic: wantMic, camera: wantCam });
        } catch (err) {
            log.warn?.('[tutor] start failed:', err?.code || err?.message);
            const dockEl = $('#dock');
            if (dockEl) dockEl.hidden = true;
            live = null; media = null;
            const reason = err instanceof StudyApiError ? blockedReason(err.code) : null;
            if (reason) { setView(renderLocked(reason, { status: err.body?.credits ? { credits: err.body.credits } : null })); return; }
            await load(err instanceof StudyApiError ? err.message : 'เริ่มคุยไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        }
    }

    // ───── ปุ่มทั้งหมดผ่านตัวเดียว ─────
    async function onAct(act) {
        switch (act) {
            case 'retry': return load();
            case 'again': return load();
            case 'mic': return live?.toggleMic();
            case 'keyboard': {
                const form = $('#textForm');
                const open = form.hidden;
                form.hidden = !open;
                $('[data-act="keyboard"]').setAttribute('aria-pressed', String(open));
                view.classList.toggle('has-text', open);
                if (open) $('#textInput').focus();
                return undefined;
            }
            case 'attach': return $('#fileInput').click();
            case 'camera': {
                const turnOn = !live.cameraOn;
                try { await live.setCamera(turnOn, facing); banner(''); } catch (err) { banner('เปิดกล้องไม่ได้ — ตรวจว่าอนุญาตกล้องให้เว็บนี้แล้ว', 'warn'); }
                return undefined;
            }
            case 'flip': {
                facing = facing === 'user' ? 'environment' : 'user';
                try { await live.setCamera(false); await live.setCamera(true, facing); } catch (err) { banner('สลับกล้องไม่ได้', 'warn'); }
                return undefined;
            }
            case 'end': return live?.end('client');
            default: return undefined;
        }
    }

    async function onFile(file) {
        if (!file || !live) return;
        const kind = classifyFile(file);
        if (kind.kind === 'unsupported') { banner(`แนบไฟล์นี้ไม่ได้: ${kind.reason}`, 'warn'); return; }
        try {
            if (kind.kind === 'image') {
                const { data } = await media.fileToJpeg(file);
                if (!live.sendImage(data, { name: file.name })) banner('ยังส่งไม่ได้ รอให้เชื่อมต่อเสร็จก่อน', 'warn');
            } else {
                banner(kind.kind === 'pdf' ? 'กำลังอ่านไฟล์ PDF…' : 'กำลังอ่านไฟล์…', 'info');
                const raw = kind.kind === 'pdf' ? await media.pdfToText(file) : await media.textFromFile(file);
                const { text, clipped } = clipText(raw);
                if (!text) { banner('ไฟล์นี้ไม่มีข้อความให้อ่าน', 'warn'); return; }
                if (!live.sendAttachmentText(file.name, attachmentPrompt(file.name, text, clipped))) { banner('ยังส่งไม่ได้ รอให้เชื่อมต่อเสร็จก่อน', 'warn'); return; }
                banner(clipped ? 'ส่งไฟล์แล้ว (ตัดมาเฉพาะช่วงต้นของไฟล์เพื่อประหยัดเครดิต)' : '', clipped ? 'info' : 'info');
            }
        } catch (err) {
            banner(err?.message || 'อ่านไฟล์ไม่สำเร็จ', 'warn');
        }
    }

    doc.addEventListener('click', (e) => {
        const el = e.target.closest?.('[data-act]');
        if (el) { e.preventDefault?.(); onAct(el.dataset.act); }
    });
    doc.addEventListener('submit', (e) => {
        const form = e.target;
        if (form.id === 'startForm') { e.preventDefault(); startSession(form); }
        if (form.id === 'textForm') {
            e.preventDefault();
            const input = $('#textInput');
            if (live?.sendText(input.value)) input.value = '';
        }
    });
    doc.addEventListener('change', (e) => {
        if (e.target.id === 'fileInput') { onFile(e.target.files?.[0]); e.target.value = ''; }
    });
    // ปิดหน้า/เปลี่ยนหน้ากลางคุย: จบเซสชันให้ (คำขอแบบ keepalive) ไม่งั้นเซิร์ฟเวอร์ต้องรอ 2 นาทีก่อนรู้ว่าหน้าหายไป
    win.addEventListener('pagehide', () => { if (live && live.state !== 'ended') live.end('client', { keepalive: true }); });

    await load();
    return { reload: load, get live() { return live; } };
}

// เปิดหน้าจริง
if (typeof document !== 'undefined' && document.body?.dataset?.page === 'tutor') {
    mountTutorPage().catch((err) => console.error('[tutor] page failed', err));
}
