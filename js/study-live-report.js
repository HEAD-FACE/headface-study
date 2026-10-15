/**
 * js/study-live-report.js — ผลการเรียนรายวิชา (report.html?s=KEY) สัญญา: docs/study-api-contract.md หัวข้อ 2.9
 *
 * แสดงผลของ "ตัวเอง" เท่านั้น: ความคืบหน้า ผล Quiz / Practice / Mock Exam แนวโน้มคะแนน และหัวข้อที่ควรกลับไปทบทวน
 * จุดแข็ง/จุดอ่อนสรุปจากคำตอบที่ระบบตรวจจริง (Quiz และ Mock Exam) และจะสรุปก็ต่อเมื่อมีคำตอบพอ — ไม่เดาจากข้อมูลน้อย
 */
import { studyApi } from './study-api.js';
import { $, esc, params, content, ICON, notFound, setTheme } from './study-ui.js';
import { formatThaiDate, formatClock } from './study-format.js';
import { SUBJECT_ID_RE, courseUrl, failure, lessonUrl, loading, mockUrl } from './study-live-common.js';

const STATUS_TEXT = { done: 'เรียนแล้ว', now: 'กำลังเรียน', todo: 'ยังไม่เริ่ม' };
const LEVEL = {
    weak: { title: 'ควรทบทวน', cls: 'weak', note: 'ตอบถูกน้อยกว่าครึ่ง' },
    ok: { title: 'พอใช้', cls: 'ok', note: '' },
    strong: { title: 'ทำได้ดี', cls: 'strong', note: 'ตอบถูกตั้งแต่ 80% ขึ้นไป' },
};

const when = (ms) => formatThaiDate(ms);

/** กราฟแท่งแนวโน้มคะแนน (เก่า → ใหม่ ซ้าย → ขวา) */
export function trendHtml(trend) {
    if (!trend.length) return '';
    return `<div class="trend" role="img" aria-label="แนวโน้มคะแนน Mock Exam จากครั้งเก่าไปใหม่: ${trend.map((t) => `${t.percent}%`).join(', ')}">${trend.map((t) =>
        `<div class="trend-b"><span>${t.percent}%</span><i style="height:${Math.max(4, t.percent)}%"></i></div>`).join('')}</div>`;
}

export function reviewHtml(review, subjectId) {
    if (!review.sufficient) {
        const pending = review.pending.length
            ? `<ul class="rules" style="margin-top:8px">${review.pending.map((p) => `<li>${ICON.info(18)}<span>${esc(p.topic)}: ตอบแล้ว ${p.total} ข้อ (ต้องอย่างน้อย ${review.minAnswersPerTopic} ข้อ)</span></li>`).join('')}</ul>`
            : '';
        return `<p class="note">${esc(review.message || 'ข้อมูลยังไม่เพียงพอ')}</p>${pending}`;
    }
    const group = (level) => {
        const items = review.topics.filter((t) => t.level === level);
        if (!items.length) return '';
        const meta = LEVEL[level];
        return `<h3 class="tgroup ${meta.cls}">${esc(meta.title)} <small>${esc(meta.note)}</small></h3>
          <div class="tlist">${items.map((t) => `<article class="tcard ${meta.cls}">
            <div class="top"><b>${esc(t.topic)}</b><span>${t.correct}/${t.total} ข้อ • ${t.accuracy}%</span></div>
            <div class="bar" aria-hidden="true"><i style="width:${t.accuracy}%"></i></div>
            ${level === 'weak' && t.lessons.length ? `<p class="cap" style="margin-top:8px">กลับไปทบทวน: ${t.lessons.map((l) => `<a class="inl" href="${lessonUrl(subjectId, l.no)}">บทที่ ${l.no}</a>`).join(' • ')}</p>` : ''}
          </article>`).join('')}</div>`;
    };
    const pending = review.pending.length
        ? `<p class="cap" style="margin-top:10px">ยังมีข้อมูลน้อย (ต้องอย่างน้อย ${review.minAnswersPerTopic} ข้อต่อหัวข้อ): ${review.pending.map((p) => `${esc(p.topic)} (${p.total} ข้อ)`).join(', ')}</p>`
        : '';
    return `${group('weak')}${group('ok')}${group('strong')}${pending}`;
}

function lessonRows(lessons, subjectId) {
    return `<div class="lres">${lessons.map((l) => {
        const quiz = l.quiz.attempts
            ? `Quiz ดีที่สุด ${l.quiz.best.correct}/${l.quiz.best.total}${l.quiz.passed ? ' ✓' : ''} (${l.quiz.attempts} ครั้ง)`
            : 'ยังไม่ได้ทำ Quiz';
        const practice = l.practice.total ? ` • Practice ${l.practice.done}/${l.practice.total}` : '';
        return `<a class="lr" href="${lessonUrl(subjectId, l.no)}"><span class="lr-n st-${l.status}">${l.no}</span><div class="lr-b"><p class="lr-t">${esc(l.title)}</p><p class="cap">${esc(STATUS_TEXT[l.status])} • ${esc(quiz)}${esc(practice)}</p></div></a>`;
    }).join('')}</div>`;
}

export async function initReport({ api = studyApi } = {}) {
    const key = params.get('s');
    $('#backLink').href = 'progress.html';
    if (!key || !SUBJECT_ID_RE.test(key)) return notFound('ไม่พบรายวิชานี้', 'progress.html', 'กลับไปหน้าความคืบหน้า');
    loading();

    let r;
    try {
        r = await api.getSubjectProgress(key);
    } catch (err) {
        return failure(err, { missing: 'ไม่พบรายวิชานี้', backHref: 'progress.html', backLabel: 'กลับไปหน้าความคืบหน้า', retry: () => initReport({ api }) });
    }

    setTheme(r.subject);
    document.title = `HEADFACE Study - ผลการเรียน ${r.subject.title}`;
    $('#eyebrow').textContent = 'ผลการเรียนรายวิชา';
    $('#pageTitle').textContent = r.subject.title;
    $('#pageMeta').textContent = r.progress.lastActivityAt ? `ทำล่าสุด ${when(r.progress.lastActivityAt)}` : 'ยังไม่เริ่มเรียน';

    const next = r.lessons.find((l) => l.status !== 'done');
    const cta = next
        ? `<a class="btn btn-lg btn-block" href="${lessonUrl(r.subject.id, next.no)}"><span>${r.progress.lessonsDone || r.progress.lastActivityAt ? 'เรียนต่อ' : 'เริ่มเรียน'}</span>${ICON.next(14)}</a>`
        : (r.lessons.length ? `<a class="btn btn-lg btn-block" href="${courseUrl(r.subject.id)}"><span>ดูบทเรียนทั้งหมด</span>${ICON.next(14)}</a>` : '');
    const acc = r.answers.accuracy === null ? '—' : `${r.answers.accuracy}%`;
    const best = r.mock.best ? `${r.mock.best.percent}%` : '—';

    const quizRecent = r.quiz.recent.length
        ? `<ul class="hist">${r.quiz.recent.map((q) => `<li class="hist-i"><span class="n">${q.lessonNo}</span><div class="d">บทที่ ${q.lessonNo} • ${q.correct}/${q.total} ข้อ<small>${esc(when(q.at))}</small></div><span class="s">${q.percent}%</span></li>`).join('')}</ul>`
        : '<p class="empty-p">ยังไม่เคยทำ Quiz วิชานี้ — ผลของแต่ละครั้งจะแสดงที่นี่</p>';

    const mockList = r.mock.attempts.length
        ? `${trendHtml(r.mock.trend)}<ul class="hist" style="margin-top:12px">${r.mock.attempts.map((a, i) => `<li class="hist-i"><span class="n">${r.mock.attempts.length - i}</span><div class="d">${a.correct}/${a.total} ข้อ<small>${esc(when(a.at))} • ใช้เวลา ${formatClock(a.secondsUsed)}${a.status === 'expired' ? ' • หมดเวลา' : ''} • ${a.starsEarned} ดาว</small></div><span class="s">${a.percent}%</span></li>`).join('')}</ul>`
        : '<p class="empty-p">ยังไม่เคยทำ Mock Exam วิชานี้ — ผลและแนวโน้มคะแนนจะแสดงที่นี่</p>';

    const section = (id, title, body) => `<section class="fsec" aria-labelledby="${id}"><div class="fsec-h"><h2 id="${id}">${title}</h2></div>${body}</section>`;

    content.innerHTML = `
      <div style="margin-top:18px">
        <section class="sum" aria-label="ภาพรวมของวิชา">
          <div class="sum-top">
            <p class="sum-pct"><span class="num">${r.progress.pct}%</span><span class="cap">ความคืบหน้า</span></p>
            <p class="cap">เรียนแล้ว ${r.progress.lessonsDone} จาก ${r.progress.lessonsTotal} บทเรียน</p>
          </div>
          <div class="bar" aria-hidden="true"><i style="width:${r.progress.pct}%"></i></div>
          <div class="rows" aria-label="สรุปผล" style="margin-top:12px">
            <div class="row"><span class="k">ตอบถูกจากโจทย์ที่ระบบตรวจ</span><span class="v">${acc}<small style="display:block;font-size:12px;color:#475569;font-weight:600">จาก ${r.answers.total} ข้อ (Quiz และ Mock)</small></span></div>
            <div class="row"><span class="k">Mock Exam ดีที่สุด</span><span class="v">${best}</span></div>
          </div>
          ${cta}
        </section>
      </div>
      ${section('h-rev', 'หัวข้อที่ควรทบทวนและจุดแข็ง', `${reviewHtml(r.review, r.subject.id)}<p class="cap" style="margin-top:10px">สรุปจากคำตอบที่ระบบตรวจจริงเท่านั้น (Quiz และ Mock Exam) โจทย์ Practice ที่ให้คะแนนเองไม่นับรวม</p>`)}
      ${section('h-les', 'ผลรายบทเรียน', r.lessons.length ? lessonRows(r.lessons, r.subject.id) : '<p class="empty-p">ยังไม่มีบทเรียน</p>')}
      ${section('h-quiz', 'ประวัติการทำ Quiz ล่าสุด', quizRecent)}
      ${section('h-mock', 'Mock Exam', `${mockList}${r.mock.available ? `<p style="margin-top:12px"><a class="btn btn-line btn-block" href="${mockUrl(r.subject.id)}" style="margin-top:0">${r.mock.attempts.length ? 'ทำ Mock Exam อีกครั้ง' : 'เข้าสอบ Mock Exam'}</a></p>` : ''}`)}`;
}
