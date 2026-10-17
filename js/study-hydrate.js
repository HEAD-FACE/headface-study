/**
 * js/study-hydrate.js — เติมข้อมูลจริงลงการ์ดวิชาในหน้า Home และ Subjects (สัญญา: docs/study-api-contract.md)
 *
 * หน้าเหล่านี้มี HTML การ์ดตายตัวอยู่แล้ว (ภาพประกอบเคลื่อนไหว สี ชื่อวิชา) ไฟล์นี้เติมเฉพาะส่วนที่เป็นข้อมูล:
 * เปอร์เซ็นต์ ข้อความสรุป ป้ายปุ่ม และแถว "ทำต่อ" ของหน้าแรก แล้วทำให้วิชาที่ยังไม่เผยแพร่เป็นสถานะ "เร็ว ๆ นี้"
 * main.js ส่งเหตุการณ์ study:page ทุกครั้งที่หน้าถูกแสดง (ทั้งโหลดครั้งแรกและตอน Barba สลับหน้า)
 *
 * ถ้า API ใช้ไม่ได้ จะปล่อยการ์ดตามเดิม (ไม่ลบอะไร) และแจ้งใน console เท่านั้น
 * EXP / ดาว / เลเวล ในหน้าแรกและ Progress เป็นของจริง (applyRewards) ส่วนอันดับ (Leaderboard) และ Streak ยังเป็นข้อมูลตัวอย่าง ไฟล์นี้ไม่แตะ
 */
import { isDemo } from './study-source.js';
import { studyApi } from './study-api.js';
import { formatThaiDate } from './study-format.js';

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

function recentLine(r, byId) {
    const title = byId.get(r.subjectId)?.title || '';
    const label = r.type === 'quiz' ? `Quiz บทที่ ${r.lessonNo}` : 'Mock Exam';
    return `<li>${esc(label)} • ${esc(title)} • ${r.correct}/${r.total} ข้อ • ${esc(formatThaiDate(r.at))}</li>`;
}

/** ส่วน "ผลการเรียนของฉัน": ความคืบหน้ารวม + รายวิชา (ลิงก์ไปหน้าผลการเรียนรายวิชา) + ผลล่าสุด */
export function progressSectionHtml(subjects, progress) {
    const byId = new Map(subjects.map((s) => [s.id, s]));
    const o = progress.overall;
    const rows = railSubjects(subjects, 50)
        .concat(subjects.filter((s) => !s.current && s.lessonsTotal > 0)) // เรียนครบแล้ว (ไม่มีบทที่ค้าง) ก็แสดง
        .map((s) => {
            const v = subjectCardView(s);
            const hue = /^[a-z]{3,12}$/.test(s.hue || '') ? s.hue : 'emerald';
            const last = s.lastActivityAt ? ` • ทำล่าสุด ${formatThaiDate(s.lastActivityAt)}` : '';
            return `<a class="mp-row hue-${hue}" href="report.html?s=${encodeURIComponent(s.id)}"><span class="sc-tile" aria-hidden="true">${esc(s.emoji || '📘')}</span><div class="mp-t"><h3>${esc(s.title)}</h3><p class="cap">เรียนจบ ${s.lessonsDone}/${s.lessonsTotal} บท${esc(last)}</p><div class="bar" aria-hidden="true"><i style="width:${v.pct}%"></i></div></div><span class="mp-n">${v.pct}%</span></a>`;
        });
    const recent = progress.recent.length
        ? `<p class="mp-sub">ผลล่าสุด</p><ul class="mp-recent">${progress.recent.map((r) => recentLine(r, byId)).join('')}</ul>`
        : '';
    return `<div class="mp-card">
          <div class="mp-top"><p class="mp-pct"><span class="num">${o.pct}%</span><span class="cap">ความคืบหน้ารวม</span></p><p class="cap">เรียนจบ ${o.lessonsDone} จาก ${o.lessonsTotal} บทเรียน</p></div>
          <div class="bar" aria-hidden="true"><i style="width:${o.pct}%"></i></div>
          <p class="cap" style="margin-top:8px">เริ่มเรียนแล้ว ${o.subjectsStarted} วิชา • เรียนครบ ${o.subjectsCompleted} วิชา</p>
        </div>
        ${rows.length ? `<div class="mp-list">${rows.join('')}</div>` : '<p class="note">ยังไม่มีวิชาที่เปิดให้เรียน เมื่อเปิดแล้วความคืบหน้าจะแสดงที่นี่</p>'}
        ${recent}`;
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

/** ใส่ตัวเลขจริงลงองค์ประกอบที่มี data-study-reward="exp|stars|level|level-long|next|level-bar" และซ่อนส่วนตัวอย่าง (data-study-hide-real) */
export function applyRewards(scope, rewards) {
    const v = rewardsView(rewards);
    for (const el of scope.querySelectorAll('[data-study-reward]')) {
        const key = el.getAttribute('data-study-reward');
        if (key === 'level-bar') el.style.width = `${v.pct}%`;
        else if (key in v) el.textContent = v[key];
    }
    for (const el of scope.querySelectorAll('[data-study-hide-real]')) el.style.display = 'none';
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
    for (const el of scope.querySelectorAll('[data-study-stat]')) el.textContent = stats[el.getAttribute('data-study-stat')] ?? el.textContent;
    if (progress.rewards) applyRewards(scope, progress.rewards);
    if (section) {
        const body = section.querySelector('#my-progress-body');
        if (body) body.innerHTML = progressSectionHtml(subjects, progress);
        section.hidden = false;
    }
}

// ───────────── DOM ─────────────
function setText(root, selector, text) {
    const el = root.querySelector(selector);
    if (el) el.textContent = text;
}

function setBar(card, pct) {
    const bar = card.querySelector('.bar > i');
    if (bar) bar.style.width = `${pct}%`;
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
            if (v.meta) setText(card, '.sc-meta', v.meta);
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
    const hasCards = scope.querySelector('a.subject-card-item') || scope.querySelector('#continued-scroll-track') || scope.querySelector('#my-progress');
    if (!hasCards || isDemo()) return clearPending();

    html().setAttribute('data-study-pending', '');
    try {
        const subjects = await loadSubjects();
        applyCards(scope, new Map(subjects.map((s) => [s.id, s])));
        applyRail(scope, subjects);
        await applyProgressPage(scope, subjects);
    } catch (err) {
        console.warn('[Study] ใช้ข้อมูลรายวิชาจริงไม่ได้ จึงคงการ์ดเดิมไว้:', err && err.message);
    } finally {
        clearPending();
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('study:page', (event) => { hydrate(event.detail && event.detail.container); });
}
