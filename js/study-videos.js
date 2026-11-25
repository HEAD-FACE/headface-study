/**
 * js/study-videos.js — หน้า "คลิปสอน" (videos.html[?s=วิชา]) แท็บที่ 5 ของแถบล่าง
 *
 * ชิปเลือกวิชา (ทั้งหมด / รายวิชา) → แถว Shorts แนวนอน (แตะแล้วเปิดฟีด shorts.html) + รายการคลิปยาว (แตะแล้วเปิด watch.html)
 * แผน FREE เห็นบรรทัด "วันนี้ดูได้อีก" (Shorts 10 / คลิปยาว 5 ต่อวัน) ส่วน PLUS/MAX ไม่มีจำนวน
 * หน้านี้เปลี่ยนหน้าด้วย Barba ร่วมกับหน้าหลัก (main.js เรียก initVideosPage) ฟังก์ชันสร้าง HTML ไม่แตะ DOM จึงทดสอบใน Node ได้
 * ระหว่างรอข้อมูลแสดงโครงเปล่าเท่านั้น ไม่มีข้อมูลตัวอย่าง
 */
import { studyApi, StudyApiError } from './study-api.js';
import { esc } from './study-ui.js';

const SUBJECT_RE = /^[a-z][a-z0-9-]{1,23}$/;
export const SHORTS_IN_RAIL = 12;
export const LONG_PAGE = 12;

// ───────────── ตัวช่วยล้วน ๆ ─────────────
/** 75 → "1:15", 3725 → "1:02:05" */
export function fmtDuration(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

export const watchUrl = (videoId) => `watch.html?v=${encodeURIComponent(videoId)}`;
export function shortsUrl({ subject = null, video = null } = {}) {
    const q = [subject ? `s=${encodeURIComponent(subject)}` : '', video ? `v=${encodeURIComponent(video)}` : ''].filter(Boolean).join('&');
    return `shorts.html${q ? `?${q}` : ''}`;
}
export const videosUrl = (subject) => (subject ? `videos.html?s=${encodeURIComponent(subject)}` : 'videos.html');

/** ภาพปกที่ปลอดภัย (https เท่านั้น) */
const safeImg = (url) => (typeof url === 'string' && /^https:\/\/[^\s"'<>\\]+$/i.test(url) ? url : '');

const svg = (inner, size = 18, w = 2.4) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const VICON = {
    play: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4v16a1 1 0 0 0 1.524 .852l13 -8a1 1 0 0 0 0 -1.704l-13 -8a1 1 0 0 0 -1.524 .852z"/></svg>`,
    check: (s = 14) => svg('<path d="M5 12l5 5l10 -10"/>', s, 3.2),
    next: (s = 16) => svg('<path d="M9 6l6 6l-6 6"/>', s, 2.8),
    bolt: (s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2L4 14h6l-1 8l9-12h-6z"/></svg>`,
    shorts: (s = 18) => svg('<path d="M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2z"/><path d="M11 9l4 3l-4 3z"/>', s, 2.2),
    film: (s = 18) => svg('<path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z"/><path d="M8 4l0 16"/><path d="M16 4l0 16"/><path d="M4 8l4 0"/><path d="M4 16l4 0"/><path d="M4 12l16 0"/><path d="M16 8l4 0"/><path d="M16 16l4 0"/>', s, 2.2)
};

/** บรรทัด "วันนี้ดูได้อีก" ของแผนที่มีจำนวนจำกัด ('' = ไม่จำกัดทั้งคู่) */
export function quotaHtml(quota) {
    if (!quota) return '';
    const part = (q, label) => {
        if (!q || q.limit === null || q.limit === undefined) return '';
        if (q.allowed === false) return `<span class="vd-q is-off">${label}: แพลนนี้ยังดูไม่ได้</span>`;
        return `<span class="vd-q${q.left === 0 ? ' is-out' : ''}">${label} ดูได้อีก <b>${Number(q.left)}</b>/${Number(q.limit)}</span>`;
    };
    const parts = [part(quota.short, 'Shorts'), part(quota.long, 'คลิปยาว')].filter(Boolean);
    if (!parts.length) return '';
    return `<p class="vd-quota" role="status">${VICON.bolt(14)}<span>วันนี้</span>${parts.join('')}</p>`;
}

export function chipsHtml(subjects, current) {
    const chip = (id, label) => `<button type="button" class="vd-chip${(id || null) === (current || null) ? ' on' : ''}" data-subject="${esc(id || '')}" aria-pressed="${(id || null) === (current || null)}">${label}</button>`;
    return `<div class="vd-chips" role="group" aria-label="เลือกวิชา">${chip(null, 'ทั้งหมด')}${(subjects || []).map((s) => chip(s.id, `${s.emoji ? `${esc(s.emoji)} ` : ''}${esc(s.title)}`)).join('')}</div>`;
}

const doneBadge = (v) => (v.progress && v.progress.completed ? `<span class="vd-done" title="ดูจบแล้ว">${VICON.check(12)}</span>` : '');
const expBadge = (v) => {
    if (v.expEarned) return `<span class="vd-exp is-got">${VICON.check(11)} ${Number(v.expEarned)} EXP</span>`;
    return v.exp > 0 ? `<span class="vd-exp">${VICON.bolt(11)} +${Number(v.exp)} EXP</span>` : '';
};

export function shortCardHtml(v, subject) {
    const img = safeImg(v.thumbnailUrl);
    return `<a class="vd-sc" href="${esc(shortsUrl({ subject, video: v.id }))}" aria-label="${esc(`Shorts: ${v.title}`)}">
      <span class="vd-sc-pic">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ''}<span class="vd-dur">${fmtDuration(v.durationSec)}</span>${doneBadge(v)}</span>
      <span class="vd-sc-t">${esc(v.title)}</span>
    </a>`;
}

export function longCardHtml(v, { showSubject = false } = {}) {
    const img = safeImg(v.thumbnailUrl);
    const pct = v.progress ? Math.max(0, Math.min(100, Number(v.progress.pct) || 0)) : 0;
    return `<a class="vd-lc" href="${esc(watchUrl(v.id))}">
      <span class="vd-lc-pic">${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async">` : ''}<span class="vd-play">${VICON.play(16)}</span><span class="vd-dur">${fmtDuration(v.durationSec)}</span>${pct > 0 ? `<span class="vd-bar"><i style="width:${pct}%"></i></span>` : ''}</span>
      <span class="vd-lc-b">
        <span class="vd-lc-t">${esc(v.title)}</span>
        <span class="vd-lc-m">${showSubject && v.subject ? `<span class="vd-sub">${esc(v.subject.title)}</span>` : ''}${v.lessonNo ? `<span>บทที่ ${Number(v.lessonNo)}</span>` : ''}${expBadge(v)}${doneBadge(v)}</span>
      </span>
    </a>`;
}

/** ทั้งหน้า (ใต้ส่วนหัวร่วม) */
export function hubHtml({ subjects = [], current = null, shorts = [], shortsTotal = 0, longs = [], longTotal = 0, quota = null }) {
    const subjectName = current ? (subjects.find((s) => s.id === current) || {}).title : null;
    const empty = !shorts.length && !longs.length;
    return `<div class="vd-in">
      ${chipsHtml(subjects, current)}
      ${quotaHtml(quota)}
      ${empty ? `<section class="vd-empty" role="status"><span class="vd-empty-i" aria-hidden="true">${VICON.film(34)}</span><h2>${subjectName ? `ยังไม่มีคลิปของวิชา${esc(subjectName)}` : 'ยังไม่มีคลิปสอน'}</h2><p>เมื่อมีคลิปใหม่ จะขึ้นที่หน้านี้ทันที</p></section>` : ''}
      ${shorts.length ? `<section class="vd-sec" aria-label="Shorts">
        <div class="vd-h"><h2>${VICON.shorts(20)} Shorts</h2><a class="vd-more" href="${esc(shortsUrl({ subject: current }))}">ดูทั้งหมด${shortsTotal ? ` (${Number(shortsTotal)})` : ''} ${VICON.next(14)}</a></div>
        <div class="vd-rail">${shorts.map((v) => shortCardHtml(v, current)).join('')}</div>
      </section>` : ''}
      ${longs.length ? `<section class="vd-sec" aria-label="คลิปยาว">
        <div class="vd-h"><h2>${VICON.film(20)} คลิปยาว</h2><span class="vd-count">${Number(longTotal)} คลิป</span></div>
        <div class="vd-list" id="vdLongList">${longs.map((v) => longCardHtml(v, { showSubject: !current })).join('')}</div>
        ${longs.length < longTotal ? '<button type="button" class="btn btn-line btn-block vd-load" data-act="more">ดูคลิปเพิ่ม</button>' : ''}
      </section>` : ''}
    </div>`;
}

export const skeletonHtml = () => `<div class="vd-in" role="status" aria-busy="true"><span class="cp-sr">กำลังโหลดคลิป</span>
  <div class="vd-chips"><i class="skl vd-sk-chip"></i><i class="skl vd-sk-chip"></i><i class="skl vd-sk-chip"></i></div>
  <div class="vd-rail"><i class="skl vd-sk-sc"></i><i class="skl vd-sk-sc"></i><i class="skl vd-sk-sc"></i></div>
  <div class="vd-list"><i class="skl vd-sk-lc"></i><i class="skl vd-sk-lc"></i></div>
</div>`;

const failureHtml = (err) => `<div class="vd-in"><section class="vd-empty" role="alert"><h2>โหลดคลิปไม่สำเร็จ</h2><p>${esc(err instanceof StudyApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')}</p><button type="button" class="btn" data-act="retry">ลองใหม่</button></section></div>`;

export function subjectFromUrl(url) {
    let s = null;
    try { s = new URL(url, 'https://x.invalid/').searchParams.get('s'); } catch (_) { s = null; }
    return s && SUBJECT_RE.test(s) ? s : null;
}

// ───────────── ผูกกับหน้าจริง ─────────────
export async function initVideosPage(root, { api = studyApi, url = typeof location !== 'undefined' ? location.href : '', win = typeof window !== 'undefined' ? window : null } = {}) {
    const body = root.querySelector('#vdBody') || root;
    let current = subjectFromUrl(url);
    let disposed = false;
    let state = null;

    async function load() {
        body.innerHTML = skeletonHtml();
        try {
            const [shortRes, longRes] = await Promise.all([
                api.listVideos({ subject: current, kind: 'short', limit: SHORTS_IN_RAIL }),
                api.listVideos({ subject: current, kind: 'long', limit: LONG_PAGE })
            ]);
            if (disposed) return;
            state = {
                subjects: longRes.subjects || shortRes.subjects || [],
                current,
                shorts: shortRes.videos || [],
                shortsTotal: shortRes.page ? shortRes.page.total : 0,
                longs: longRes.videos || [],
                longTotal: longRes.page ? longRes.page.total : 0,
                quota: longRes.quota || shortRes.quota || null
            };
            body.innerHTML = hubHtml(state);
        } catch (err) {
            if (disposed) return;
            body.innerHTML = failureHtml(err);
        }
    }

    async function more(btn) {
        btn.disabled = true;
        btn.textContent = 'กำลังโหลด...';
        try {
            const res = await api.listVideos({ subject: current, kind: 'long', offset: state.longs.length, limit: LONG_PAGE });
            if (disposed) return;
            state.longs = state.longs.concat(res.videos || []);
            state.longTotal = res.page ? res.page.total : state.longTotal;
            body.innerHTML = hubHtml(state);
        } catch (_) {
            btn.disabled = false;
            btn.textContent = 'โหลดไม่สำเร็จ ลองอีกครั้ง';
        }
    }

    const onClick = (e) => {
        const chip = e.target.closest && e.target.closest('[data-subject]');
        if (chip) {
            const next = chip.dataset.subject || null;
            if (next === current) return;
            current = next && SUBJECT_RE.test(next) ? next : null;
            if (win && win.history && typeof win.history.replaceState === 'function') {
                try { win.history.replaceState(win.history.state, '', videosUrl(current)); } catch (_) { /* ไม่เป็นไร */ }
            }
            load();
            return;
        }
        const act = e.target.closest && e.target.closest('[data-act]');
        if (!act) return;
        if (act.dataset.act === 'retry') load();
        if (act.dataset.act === 'more') more(act);
    };
    root.addEventListener('click', onClick);
    await load();
    return {
        dispose() { disposed = true; root.removeEventListener('click', onClick); }
    };
}
