/**
 * js/study-hydrate.js — เติมข้อมูลจริงลงการ์ดวิชาในหน้า Home และ Subjects (สัญญา: docs/study-api-contract.md)
 *
 * หน้าเหล่านี้มี HTML การ์ดตายตัวอยู่แล้ว (ภาพประกอบเคลื่อนไหว สี ชื่อวิชา) ไฟล์นี้เติมเฉพาะส่วนที่เป็นข้อมูล:
 * เปอร์เซ็นต์ ข้อความสรุป ป้ายปุ่ม และแถว "ทำต่อ" ของหน้าแรก แล้วทำให้วิชาที่ยังไม่เผยแพร่เป็นสถานะ "เร็ว ๆ นี้"
 * main.js ส่งเหตุการณ์ study:page ทุกครั้งที่หน้าถูกแสดง (ทั้งโหลดครั้งแรกและตอน Barba สลับหน้า)
 *
 * ระหว่างรอ API ช่องข้อมูลเป็น skeleton (css/loading.css) — ใน HTML ไม่มีตัวเลข/ชื่อ/ภาพตัวอย่างอยู่เลย จึงไม่มีทางเห็นข้อมูลเสมือนก่อนข้อมูลจริง
 * ถ้า API ใช้ไม่ได้: ช่องที่รอข้อมูลแสดง "—" พร้อมแถบแจ้งว่าโหลดไม่สำเร็จและปุ่มลองใหม่ (ไม่เอาค่าตัวอย่างมาแทน)
 * EXP / ดาว / เลเวล / Streak ในหน้าแรกและ Progress เป็นของจริง (applyRewards, applyStreak) และตารางอันดับดาวเป็นของจริง (study-ranking.js)
 */
import { studyApi } from './study-api.js';
import { formatThaiDate } from './study-format.js';
import { hydrateRanking } from './study-ranking.js';
import { settle } from './study-delight.js';

const KEY_RE = /[?&]s=([a-z][a-z0-9-]{1,23})(?:&|$)/;
const CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 6l-.112 .006a1 1 0 0 0 -.669 1.619l3.501 4.375l-3.5 4.375a1 1 0 0 0 .78 1.625h6a1 1 0 0 0 .78 -.375l4 -5a1 1 0 0 0 0 -1.25l-4 -5a1 1 0 0 0 -.78 -.375h-6z"/></svg>';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** รหัสวิชาจากลิงก์ของการ์ด (course.html?s=sci → "sci") หรือ null */
export function cardKey(href) {
    const match = KEY_RE.exec(String(href || ''));
    return match ? match[1] : null;
}

/** ค่าที่ต้องแสดงบนการ์ดวิชาที่เผยแพร่แล้ว */
export function subjectCardView(subject) {
    const started = subject.lessonsDone > 0 || !!subject.lastActivityAt;
    return {
        pct: Math.max(0, Math.min(100, Number(subject.pct) || 0)),
        meta: subject.metaText || (subject.lessonsTotal ? `${subject.lessonsTotal} บทเรียน` : ''),
        started,
        goLabel: started ? 'เรียนต่อ' : 'เข้าเรียน',
    };
}

/** วิชาที่จะแสดงในแถว "ทำต่อ": วิชาที่เริ่มแล้ว (ล่าสุดก่อน) ตามด้วยวิชาที่ยังไม่เริ่ม เฉพาะที่มีบทให้เรียน */
export function railSubjects(subjects, limit = 4) {
    const withLesson = subjects.filter((s) => s.current);
    const started = withLesson.filter((s) => subjectCardView(s).started).sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0));
    const fresh = withLesson.filter((s) => !subjectCardView(s).started).sort((a, b) => a.no - b.no);
    return [...started, ...fresh].slice(0, limit);
}

export function railCardHtml(subject) {
    const v = subjectCardView(subject);
    return `<article class="cc hue-${esc(subject.hue || 'emerald')}" role="listitem">
            <div class="cc-top"><span class="cc-chip">${esc(subject.title)}</span><span class="cc-pct">${v.pct}%</span></div>
            <h3 class="cc-title">${esc(subject.current.title)}</h3>
            <p class="cc-sub">บทที่ ${subject.current.no} จาก ${subject.lessonsTotal}</p>
            <div class="bar" aria-hidden="true"><i style="width:${v.pct}%"></i></div>
            <a class="btn btn-block" href="lesson.html?s=${encodeURIComponent(subject.id)}&amp;l=current"><span>${v.started ? 'ลุยต่อ' : 'เริ่มเรียน'}</span>${CHEVRON}</a>
          </article>`;
}

// ───────────── หน้า Progress: ผลการเรียนของฉัน ─────────────
/** ข้อความของสถิติ "ทำโจทย์สะสม" และ "แม่นยำเฉลี่ย" จากคำตอบที่ระบบตรวจจริง (ยังไม่มีคำตอบ → "—") */
export function answersStats(answers) {
    return {
        answers: `${answers.total} ข้อ`,
        accuracy: answers.accuracy === null || answers.accuracy === undefined ? '—' : `${answers.accuracy}%`,
    };
}

const lessonLink = (subjectId, no) => `lesson.html?s=${encodeURIComponent(subjectId)}&l=${encodeURIComponent(no)}`;

/**
 * "ส่วนที่ยังพลาดบ่อย": เฉพาะบทที่มีหัวข้อผิดเยอะ (ตอบอย่างน้อย N ข้อและถูกไม่ถึง P%) เรียงบทที่ผิดมากสุดก่อน
 * แต่ละบทมีปุ่ม "ทบทวนบทนี้" พาเข้าหน้าเรียนทันที; ไม่มีข้อมูล/ไม่มีส่วนที่พลาดบ่อย = ข้อความสั้น ๆ (Backend รุ่นเก่าไม่ส่งมา = ไม่แสดงส่วนนี้)
 */
export function weakSectionHtml(weak) {
    if (!weak || !Array.isArray(weak.items)) return '';
    const head = `<div class="wk-h"><h3><span class="wk-fire" aria-hidden="true">🎯</span> ส่วนที่ยังพลาดบ่อย</h3><p class="cap">เฉพาะหัวข้อที่ตอบไปอย่างน้อย ${Number(weak.minAnswers) || 3} ข้อ แล้วถูกไม่ถึง ${Number(weak.belowPct) || 60}% (จาก Quiz และ Mock Exam)</p></div>`;
    if (weak.items.length === 0) {
        const msg = weak.hasAnswers
            ? '<b>ยอดเยี่ยม!</b> ตอนนี้ยังไม่มีหัวข้อไหนที่พลาดบ่อย ทำ Quiz ต่อเพื่อรักษาฟอร์มไว้'
            : 'ทำ Quiz หรือ Mock Exam สักครั้ง แล้วที่นี่จะบอกว่าควรกลับไปทบทวนส่วนไหนของบทไหน';
        return `<section class="wk" aria-label="ส่วนที่ยังพลาดบ่อย">${head}<p class="wk-empty">${msg}</p></section>`;
    }
    const cards = weak.items.map((l) => {
        const topics = l.topics.map((t) => `<li><div class="wk-row"><span class="wk-name">${esc(t.topic)}</span><span class="wk-n">ผิด ${Number(t.wrong)}/${Number(t.total)} ข้อ</span></div><div class="bar wk-bar" aria-hidden="true"><i style="width:${Math.max(4, 100 - (Number(t.accuracy) || 0))}%"></i></div></li>`).join('');
        return `<article class="wk-card"><div class="wk-top"><span class="sc-tile" aria-hidden="true">${esc(l.emoji || '📘')}</span><div class="wk-t"><p class="cap">${esc(l.subjectTitle)}</p><h4>บทที่ ${Number(l.lessonNo)} ${esc(l.lessonTitle)}</h4></div><span class="wk-miss" title="ตอบผิดในบทนี้">ผิด ${Number(l.wrong)} ข้อ</span></div><ul class="wk-topics">${topics}</ul><a class="btn btn-block wk-go" href="${lessonLink(l.subjectId, l.lessonNo)}"><span>ทบทวนบทนี้</span>${CHEVRON}</a></article>`;
    }).join('');
    return `<section class="wk" aria-label="ส่วนที่ยังพลาดบ่อย">${head}<div class="wk-list">${cards}</div></section>`;
}

/** ส่วน "ผลการเรียนของฉัน": ความคืบหน้ารวม + ส่วนที่ยังพลาดบ่อย + รายวิชา (ลิงก์ไปหน้าผลการเรียนรายวิชา) */
export function progressSectionHtml(subjects, progress) {
    const o = progress.overall;
    const rows = railSubjects(subjects, 50)
        .concat(subjects.filter((s) => !s.current && s.lessonsTotal > 0)) // เรียนครบแล้ว (ไม่มีบทที่ค้าง) ก็แสดง
        .map((s) => {
            const v = subjectCardView(s);
            const hue = /^[a-z]{3,12}$/.test(s.hue || '') ? s.hue : 'emerald';
            const last = s.lastActivityAt ? ` • ทำล่าสุด ${formatThaiDate(s.lastActivityAt)}` : '';
            return `<a class="mp-row hue-${hue}" href="report.html?s=${encodeURIComponent(s.id)}" data-subject="${esc(s.id)}"${v.pct >= 100 ? ' data-done="1"' : ''}><span class="sc-tile" aria-hidden="true">${esc(s.emoji || '📘')}</span><div class="mp-t"><h3>${esc(s.title)}</h3><p class="cap">เรียนจบ ${s.lessonsDone}/${s.lessonsTotal} บท${esc(last)}</p><div class="bar" aria-hidden="true"><i style="width:${v.pct}%"></i></div></div><span class="mp-n">${v.pct}%</span></a>`;
        });
    return `<div class="mp-card">
          <div class="mp-top"><p class="mp-pct"><span class="num">${o.pct}%</span><span class="cap">ความคืบหน้ารวม</span></p><p class="cap">เรียนจบ ${o.lessonsDone} จาก ${o.lessonsTotal} บทเรียน</p></div>
          <div class="bar" aria-hidden="true"><i style="width:${o.pct}%"></i></div>
          <p class="cap" style="margin-top:8px">เริ่มเรียนแล้ว ${o.subjectsStarted} วิชา • เรียนครบ ${o.subjectsCompleted} วิชา</p>
        </div>
        ${weakSectionHtml(progress.weak)}
        ${rows.length ? `<div class="mp-list">${rows.join('')}</div>` : '<p class="note">ยังไม่มีวิชาที่เปิดให้เรียน เมื่อเปิดแล้วความคืบหน้าจะแสดงที่นี่</p>'}`;
}

/** EXP / ดาว / เลเวลของผู้เรียนจาก GET /progress (rewards) เป็นข้อความที่จะแสดง */
export function rewardsView(rewards) {
    const exp = Math.max(0, Math.floor(Number(rewards && rewards.exp) || 0));
    const stars = Math.max(0, Math.floor(Number(rewards && rewards.stars) || 0));
    const lv = rewards && rewards.level ? rewards.level : { level: 1, pct: 0 };
    const level = Math.max(1, Math.floor(Number(lv.level) || 1));
    const pct = Math.max(0, Math.min(100, Math.floor(Number(lv.pct) || 0)));
    return { exp: exp.toLocaleString('en-US'), stars: String(stars), level: `Lv. ${level}`, 'level-long': `เลเวล ${level}`, next: `สู่ Lv. ${level + 1} (${pct}%)`, pct };
}

/** ใส่ตัวเลขจริงลงองค์ประกอบที่มี data-study-reward="exp|stars|level|level-long|next|level-bar" (skeleton หายเองเมื่อมีข้อความ) */
export function applyRewards(scope, rewards) {
    const v = rewardsView(rewards);
    for (const el of scope.querySelectorAll('[data-study-reward]')) {
        const key = el.getAttribute('data-study-reward');
        if (key === 'level-bar') {
            el.style.width = `${v.pct}%`;
            if (el.parentElement && el.parentElement.classList) el.parentElement.classList.remove('ld');
        } else if (key in v) el.textContent = v[key];
    }
    for (const el of scope.querySelectorAll('[data-study-hide-real]')) el.style.display = 'none';
}

/** เมื่อ Backend ไม่มีข้อมูลส่วนนั้น (ยังไม่ได้ migrate) ช่องแสดง "—" แทนที่จะแสดงเลข 0 ที่ไม่จริง */
export function markUnavailable(scope, selector) {
    for (const el of scope.querySelectorAll(selector)) {
        if (el.tagName === 'I' && el.parentElement) { if (el.parentElement.classList) el.parentElement.classList.remove('ld'); continue; }
        if (el.textContent === '') { el.textContent = '—'; el.setAttribute('data-ld-na', ''); }
    }
}

/**
 * Streak ที่เก็บใน DB (ซิงก์ข้ามอุปกรณ์): ตัวเลข "N วัน" และข้อความใต้ตัวเลข
 * null = Backend ยังไม่มีข้อมูล (ไม่ได้ migrate) → "—" ไม่แสดงเลข 0 ที่ไม่จริง
 */
export function streakText(streak) {
    if (!streak || !Number.isFinite(Number(streak.current))) return { current: '—', days: '—', note: '', risk: false };
    const n = Math.max(0, Math.floor(Number(streak.current)));
    const best = Math.max(n, Math.floor(Number(streak.longest) || 0));
    let note = '';
    if (streak.atRisk) note = 'อย่าให้ขาด! เรียนวันนี้';
    else if (streak.activeToday) note = 'วันนี้ครบแล้ว ✓';
    else if (n === 0) note = best > 0 ? `สูงสุด ${best} วัน • เริ่มใหม่วันนี้` : 'เริ่มวันนี้เลย';
    return { current: String(n), days: `${n} วัน`, note, risk: !!streak.atRisk };
}

export function applyStreak(scope, streak) {
    const t = streakText(streak);
    for (const el of scope.querySelectorAll('[data-study-streak]')) {
        const key = el.getAttribute('data-study-streak');
        if (key === 'note') {
            if (!t.note) { el.remove(); continue; }
            el.textContent = t.note;
            if (el.classList) el.classList.toggle('is-risk', t.risk);
        } else if (key in t) el.textContent = t[key];
    }
}

let progressCache = null;
async function loadProgress() {
    if (progressCache && Date.now() - progressCache.at < 15000) return progressCache.data;
    const data = await studyApi.getProgress();
    progressCache = { at: Date.now(), data };
    return data;
}

async function applyProgressPage(scope, subjects) {
    const section = scope.querySelector('#my-progress');
    const hasStats = scope.querySelector('[data-study-stat]') || scope.querySelector('[data-study-reward]');
    if (!section && !hasStats) return;
    const progress = await loadProgress();
    const stats = answersStats(progress.answers);
    for (const el of scope.querySelectorAll('[data-study-stat]')) el.textContent = stats[el.getAttribute('data-study-stat')] ?? '—';
    if (progress.rewards) applyRewards(scope, progress.rewards);
    else markUnavailable(scope, '[data-study-reward]');
    applyStreak(scope, progress.streak);
    if (section) {
        const body = section.querySelector('#my-progress-body');
        if (body) { body.innerHTML = progressSectionHtml(subjects, progress); body.removeAttribute('aria-busy'); }
    }
}

/**
 * API ใช้ไม่ได้: ช่องที่ยังรออยู่ในหน้านี้ (ไม่รวมแถบหัวเว็บ) แสดง "—" และแถบความคืบหน้าหยุดเป็น skeleton
 * พร้อมแถบแจ้งว่าโหลดไม่สำเร็จ + ปุ่มลองใหม่ — ไม่มีข้อมูลตัวอย่างมาแทนที่
 */
export function showLoadFailed(scope, retry = () => { if (typeof location !== 'undefined') location.reload(); }) {
    for (const el of scope.querySelectorAll('.ld-e:empty')) {
        if (el.closest && el.closest('.hdr')) continue; // ชื่อ/รูปบนแถบหัวเว็บเป็นของระบบเข้าสู่ระบบ ไม่ใช่ของหน้านี้
        el.textContent = '—';
        el.setAttribute('data-ld-na', '');
    }
    for (const bar of scope.querySelectorAll('.bar.ld')) bar.classList.remove('ld');
    const rail = scope.querySelector('#continued-scroll-track');
    if (rail && rail.querySelector('.cc-skl')) rail.innerHTML = '';
    const body = scope.querySelector('#my-progress-body');
    if (body && body.querySelector('.ld-wrap')) { body.removeAttribute('aria-busy'); body.innerHTML = ''; }
    if (scope.querySelector('.ld-err') || typeof scope.insertAdjacentHTML !== 'function') return;
    scope.insertAdjacentHTML('afterbegin', '<div class="ld-err" role="alert"><span>โหลดข้อมูลไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง</span><button type="button" data-act="ld-retry">ลองใหม่</button></div>');
    const button = scope.querySelector('[data-act="ld-retry"]');
    if (button && typeof button.addEventListener === 'function') button.addEventListener('click', retry);
}

// ───────────── DOM ─────────────
function setText(root, selector, text) {
    const el = root.querySelector(selector);
    if (el) el.textContent = text;
}

function setBar(card, pct) {
    const bar = card.querySelector('.bar > i');
    if (!bar) return;
    bar.style.width = `${pct}%`;
    if (bar.parentElement && bar.parentElement.classList) bar.parentElement.classList.remove('ld');
}

function applyCards(root, byId) {
    for (const card of root.querySelectorAll('a.subject-card-item')) {
        const key = cardKey(card.getAttribute('href'));
        if (!key) continue;
        const subject = byId.get(key);
        if (subject) {
            const v = subjectCardView(subject);
            setText(card, '.sc-pct', `${v.pct}%`);
            setBar(card, v.pct);
            setText(card, '.sc-meta', v.meta || 'ยังไม่มีบทเรียน');
            setText(card, '.go', v.goLabel);
            card.classList.remove('is-soon');
        } else {
            // ยังไม่เผยแพร่: ไม่มีลิงก์ ไม่มีตัวเลขปลอม
            card.removeAttribute('href');
            card.setAttribute('role', 'link');
            card.setAttribute('aria-disabled', 'true');
            card.classList.add('is-soon');
            setText(card, '.sc-pct', '—');
            setBar(card, 0);
            setText(card, '.sc-meta', 'เร็ว ๆ นี้');
            setText(card, '.go', 'เร็ว ๆ นี้');
        }
    }
}

function applyRail(root, subjects) {
    const rail = root.querySelector('#continued-scroll-track');
    if (!rail) return;
    const picks = railSubjects(subjects);
    rail.innerHTML = picks.length
        ? picks.map(railCardHtml).join('')
        : '<p role="listitem" style="padding:18px 16px;color:#475569;font-size:14px;line-height:22px">ยังไม่มีบทเรียนที่เปิดให้เรียน เมื่อเปิดแล้วบทที่เรียนค้างจะแสดงที่นี่</p>';
}

let cache = null; // { at, subjects } — Barba สลับหน้าไป-มาบ่อย ไม่ต้องเรียกซ้ำภายในไม่กี่วินาที
async function loadSubjects() {
    if (cache && Date.now() - cache.at < 15000) return cache.subjects;
    const { subjects } = await studyApi.listSubjects();
    cache = { at: Date.now(), subjects };
    return subjects;
}

const html = () => document.documentElement;
const clearPending = () => html().removeAttribute('data-study-pending');

export async function hydrate(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const hasCards = scope.querySelector('a.subject-card-item') || scope.querySelector('#continued-scroll-track') || scope.querySelector('#my-progress') || scope.querySelector('#lb-body');
    if (!hasCards) { clearPending(); return; }

    html().setAttribute('data-study-pending', '');
    try {
        const subjects = await loadSubjects();
        applyCards(scope, new Map(subjects.map((s) => [s.id, s])));
        applyRail(scope, subjects);
        await applyProgressPage(scope, subjects);
    } catch (err) {
        console.warn('[Study] โหลดข้อมูลรายวิชาไม่ได้:', err && err.message);
        showLoadFailed(scope);
    } finally {
        clearPending();
    }
    settle(scope); // ตัวเลขนับขึ้น แถบใกล้ครบเรืองแสง เนื้อหาที่เพิ่งวาดทยอยโผล่
    // ตารางอันดับแยกจากข้อมูลรายวิชา: โหลดไม่ได้ก็ไม่ทำให้ส่วนอื่นเสีย (และไม่แสดงอันดับตัวอย่างปลอมในโหมดข้อมูลจริง)
    await hydrateRanking(scope, studyApi);
    settle(scope);
}

if (typeof document !== 'undefined') {
    document.addEventListener('study:page', (event) => { hydrate(event.detail && event.detail.container); });
}
