/**
 * js/study-shorts.js — ฟีด Shorts แบบเต็มจอ (shorts.html[?s=วิชา][&v=คลิป]) ปัดขึ้น/ลงทีละคลิป
 *
 * คลิปที่เลื่อนมาอยู่กลางจอ (ค้างไว้ครู่หนึ่ง) จึงเริ่มเล่น: เรียก POST /videos/:id/play ก่อนเสมอ (Backend ตรวจสิทธิ์รายวันของแผน
 * FREE 10 คลิป/วัน คลิปเดิมในวันเดียวกันไม่นับซ้ำ) แล้วเล่นแบบปิดเสียง แตะเพื่อเปิดเสียง/หยุด
 * ตำแหน่งที่ดูถึงส่งให้ Backend ทุก 3 วินาที (js/video-tracker.js) ดูจบ = ได้ EXP ที่แอดมินตั้ง (ครั้งแรกเท่านั้น) แล้วเลื่อนไปคลิปถัดไปเอง
 * เล่นทีละคลิปเดียว คลิปที่เลื่อนผ่านไปแล้วถูกปิดเครื่องเล่นทิ้ง ประหยัดเน็ตและแบตเตอรี่
 */
import { studyApi, StudyApiError } from './study-api.js';
import { esc } from './study-ui.js';
import { createPlayer, youtubeErrorText, YT_STATE } from './yt-player.js';
import { createTracker } from './video-tracker.js';
import { VICON, fmtDuration, subjectFromUrl, videosUrl } from './study-videos.js';
import { getProfilePageUrl } from './env.js';

const VIDEO_ID_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;
export const PAGE = 15;
export const SETTLE_MS = 450;      // ต้องค้างกลางจอนานเท่านี้จึงนับว่า "เปิดดู" (ปัดผ่านเร็ว ๆ ไม่เสียโควตา)
export const REPORT_MS = 3000;

/** การ์ดหนึ่งคลิปในฟีด (ยังไม่มีเครื่องเล่น: ใส่เมื่อเลื่อนมาถึง) */
export function itemHtml(v, index) {
    const img = typeof v.thumbnailUrl === 'string' && /^https:\/\//i.test(v.thumbnailUrl) ? v.thumbnailUrl : '';
    const lesson = v.lessonNo ? `<a class="sh-lesson" href="lesson.html?s=${encodeURIComponent(v.subjectId)}&l=${Number(v.lessonNo)}">ไปบทที่ ${Number(v.lessonNo)} ${VICON.next(14)}</a>` : '';
    const exp = v.expEarned ? `<span class="sh-exp is-got">${VICON.check(12)} ได้ ${Number(v.expEarned)} EXP แล้ว</span>` : v.exp > 0 ? `<span class="sh-exp">${VICON.bolt(12)} ดูจบรับ +${Number(v.exp)} EXP</span>` : '';
    return `<section class="sh-item" data-id="${esc(v.id)}" data-i="${index}" aria-label="${esc(v.title)}">
      ${img ? `<img class="sh-poster" src="${esc(img)}" alt="" loading="${index < 2 ? 'eager' : 'lazy'}" decoding="async">` : ''}
      <div class="sh-stage"><div class="sh-player"></div></div>
      <button type="button" class="sh-tap" data-act="tap" aria-label="เปิดเสียงหรือหยุดคลิป"></button>
      <p class="sh-hint" hidden></p>
      <div class="sh-info">
        <p class="sh-sub">${v.subject ? esc(`${v.subject.emoji ? `${v.subject.emoji} ` : ''}${v.subject.title}`) : ''} · ${fmtDuration(v.durationSec)}</p>
        <h2 class="sh-title">${esc(v.title)}</h2>
        <div class="sh-meta">${exp}${lesson}</div>
      </div>
      <div class="sh-lock" hidden></div>
      <span class="sh-bar" aria-hidden="true"><i></i></span>
    </section>`;
}

/** การ์ดล็อกเมื่อดูไม่ได้ (ครบจำนวนวันนี้ / แพลนยังไม่มีสิทธิ์ / เล่นไม่ได้) */
export function lockHtml(reason, { limit = null, message = '' } = {}) {
    if (reason === 'quota') {
        return `<div class="sh-lock-in"><p class="sh-lock-k">${VICON.shorts(28)}</p><h3>วันนี้ดู Shorts ครบ ${limit ? `${Number(limit)} คลิป` : 'จำนวน'}แล้ว</h3><p>พรุ่งนี้ดูต่อได้ (เริ่มนับใหม่เที่ยงคืน) หรืออัปเกรดเป็น PLUS เพื่อดูได้ไม่จำกัด</p><a class="btn" href="${esc(getProfilePageUrl())}">ดูแพลนของฉัน</a></div>`;
    }
    if (reason === 'plan') return `<div class="sh-lock-in"><h3>แพลนของคุณยังดูคลิปนี้ไม่ได้</h3><a class="btn" href="${esc(getProfilePageUrl())}">ดูแพลนของฉัน</a></div>`;
    return `<div class="sh-lock-in"><h3>เล่นคลิปนี้ไม่ได้</h3><p>${esc(message || 'กรุณาลองใหม่อีกครั้ง')}</p><button type="button" class="btn btn-line" data-act="retry">ลองใหม่</button></div>`;
}

export function videoFromUrl(url) {
    let v = null;
    try { v = new URL(url, 'https://x.invalid/').searchParams.get('v'); } catch (_) { v = null; }
    return v && VIDEO_ID_RE.test(v) ? v : null;
}

// ───────────── ผูกกับหน้าจริง ─────────────
export async function mountShorts({ doc = document, win = window, api = studyApi, makePlayer = createPlayer } = {}) {
    const $ = (s, r = doc) => r.querySelector(s);
    const feed = $('#shFeed');
    const subject = subjectFromUrl(win.location.href);
    const startId = videoFromUrl(win.location.href);
    $('#shBack').href = videosUrl(subject);

    let videos = [];
    let total = 0;
    let loadingMore = false;
    let active = null;    // { el, id, player, tracker, poll }
    let muted = true;     // เปิดเสียงแล้วครั้งหนึ่ง = คลิปถัดไปมีเสียงด้วย
    let settleTimer = null;

    const hint = (el, text) => { const h = el.querySelector('.sh-hint'); if (!h) return; h.textContent = text || ''; h.hidden = !text; };
    const toast = (text) => {
        const t = $('#shToast');
        if (!t) return;
        t.textContent = text;
        t.hidden = false;
        t.classList.remove('is-in');
        void t.offsetWidth;
        t.classList.add('is-in');
        win.clearTimeout(toast.timer);
        toast.timer = win.setTimeout(() => { t.hidden = true; }, 2200);
    };

    function deactivate() {
        if (!active) return;
        const a = active;
        active = null;
        a.tracker?.stop();
        win.clearInterval(a.poll);
        try { a.player?.destroy(); } catch (_) { /* ปิดไปแล้ว */ }
        a.el.classList.remove('is-playing', 'is-on');
        const stage = a.el.querySelector('.sh-stage');
        if (stage) stage.innerHTML = '<div class="sh-player"></div>';
        hint(a.el, '');
    }

    function next(el) {
        const sib = el.nextElementSibling;
        if (sib && sib.classList.contains('sh-item')) sib.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function activate(el) {
        if (active && active.el === el) return;
        deactivate();
        const id = el.dataset.id;
        const me = { el, id, player: null, tracker: null, poll: null };
        active = me;
        el.classList.add('is-on');
        const lock = el.querySelector('.sh-lock');
        lock.hidden = true;
        hint(el, 'กำลังโหลด…');
        let play;
        try {
            play = await api.playVideo(id);
        } catch (err) {
            if (active !== me) return;
            hint(el, '');
            const code = err instanceof StudyApiError ? err.code : '';
            lock.innerHTML = code === 'FEATURE_QUOTA_EXCEEDED' ? lockHtml('quota', { limit: err.body?.details?.limit })
                : code === 'FEATURE_FORBIDDEN' ? lockHtml('plan') : lockHtml('error', { message: err.message });
            lock.hidden = false;
            return;
        }
        if (active !== me) return;
        updateQuota(play.quota);
        const host = el.querySelector('.sh-player');
        try {
            me.player = await makePlayer(host, {
                videoId: play.source.id, start: 0, autoplay: true, mute: muted, controls: false,
                onState: (s) => onState(me, s),
                onError: (code) => { if (active === me) { hint(el, ''); lock.innerHTML = lockHtml('error', { message: youtubeErrorText(code) }); lock.hidden = false; } }
            });
        } catch (_) {
            if (active !== me) return;
            hint(el, '');
            lock.innerHTML = lockHtml('error', { message: 'โหลดเครื่องเล่น YouTube ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' });
            lock.hidden = false;
            return;
        }
        if (active !== me) { try { me.player.destroy(); } catch (_) { /* */ } return; }
        hint(el, muted ? 'แตะเพื่อเปิดเสียง' : '');
        me.tracker = createTracker({
            api, videoId: id, intervalMs: REPORT_MS, timers: win,
            getTime: () => me.player.getCurrentTime(),
            isPlaying: () => me.player.getPlayerState() === YT_STATE.PLAYING,
            onResult: (r) => onResult(me, r)
        });
        const bar = el.querySelector('.sh-bar i');
        me.poll = win.setInterval(() => {
            try {
                const d = me.player.getDuration();
                if (d > 0 && bar) bar.style.width = `${Math.min(100, (me.player.getCurrentTime() / d) * 100)}%`;
            } catch (_) { /* ยังไม่พร้อม */ }
        }, 250);
        maybeLoadMore(Number(el.dataset.i));
    }

    function onState(me, s) {
        if (active !== me) return;
        if (s === YT_STATE.PLAYING) { me.el.classList.add('is-playing'); me.tracker?.start(); }
        if (s === YT_STATE.PAUSED) { me.el.classList.remove('is-playing'); me.tracker?.pause(); }
        if (s === YT_STATE.ENDED) {
            me.el.classList.remove('is-playing');
            Promise.resolve(me.tracker?.ended()).finally(() => win.setTimeout(() => { if (active === me) next(me.el); }, 900));
        }
    }

    function onResult(me, r) {
        if (!r) return;
        if (r.reward && r.reward.exp > 0) {
            toast(`ดูจบแล้ว +${r.reward.exp} EXP`);
            const meta = me.el.querySelector('.sh-exp');
            if (meta) { meta.className = 'sh-exp is-got'; meta.innerHTML = `${VICON.check(12)} ได้ ${Number(r.reward.exp)} EXP แล้ว`; }
        } else if (r.completedNow) toast('ดูจบแล้ว');
    }

    function updateQuota(q) {
        const el = $('#shQuota');
        if (!el || !q || !q.short) return;
        if (q.short.limit === null) { el.hidden = true; return; }
        el.hidden = false;
        el.textContent = `วันนี้ดูได้อีก ${q.short.left}/${q.short.limit}`;
    }

    // แตะจอ: ยังปิดเสียง = เปิดเสียง, มีเสียงแล้ว = หยุด/เล่นต่อ
    function onTap(el) {
        if (!active || active.el !== el || !active.player) return;
        const p = active.player;
        if (muted) { muted = false; try { p.unMute(); p.playVideo(); } catch (_) { /* */ } hint(el, ''); return; }
        try {
            if (p.getPlayerState() === YT_STATE.PLAYING) { p.pauseVideo(); hint(el, 'หยุดชั่วคราว · แตะเพื่อเล่นต่อ'); }
            else { p.playVideo(); hint(el, ''); }
        } catch (_) { /* */ }
    }

    const observer = new win.IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                win.clearTimeout(settleTimer);
                const el = entry.target;
                settleTimer = win.setTimeout(() => activate(el), SETTLE_MS);
            }
        }
    }, { root: feed, threshold: [0.6] });

    function append(list) {
        const start = videos.length;
        videos = videos.concat(list);
        feed.insertAdjacentHTML('beforeend', list.map((v, i) => itemHtml(v, start + i)).join(''));
        feed.querySelectorAll('.sh-item:not([data-watched])').forEach((el) => { el.dataset.watched = '1'; observer.observe(el); });
    }

    async function maybeLoadMore(index) {
        if (loadingMore || videos.length >= total || index < videos.length - 3) return;
        loadingMore = true;
        try {
            const res = await api.listVideos({ subject, kind: 'short', offset: videos.length, limit: PAGE });
            const seen = new Set(videos.map((v) => v.id));
            append((res.videos || []).filter((v) => !seen.has(v.id)));
            total = res.page ? res.page.total : total;
        } catch (_) { /* ลองใหม่เมื่อเลื่อนอีกครั้ง */ }
        loadingMore = false;
    }

    // ───── เริ่ม ─────
    let first;
    try {
        first = await api.listVideos({ subject, kind: 'short', limit: PAGE });
    } catch (err) {
        feed.innerHTML = `<section class="sh-item sh-msg"><div class="sh-lock-in"><h3>โหลด Shorts ไม่สำเร็จ</h3><p>${esc(err instanceof StudyApiError ? err.message : 'กรุณาลองใหม่อีกครั้ง')}</p><a class="btn btn-line" href="${esc(win.location.href)}">ลองใหม่</a></div></section>`;
        return null;
    }
    total = first.page ? first.page.total : 0;
    updateQuota(first.quota);
    const subjectInfo = subject ? (first.subjects || []).find((s) => s.id === subject) : null;
    const label = $('#shSubject');
    if (label) label.textContent = subjectInfo ? subjectInfo.title : 'ทุกวิชา';
    let list = first.videos || [];
    // เปิดจากการ์ด: คลิปที่แตะขึ้นก่อนเสมอ
    if (startId) {
        const at = list.findIndex((v) => v.id === startId);
        if (at > 0) list = [list[at], ...list.slice(0, at), ...list.slice(at + 1)];
        else if (at < 0) {
            try { const one = await api.getVideo(startId); if (one.video && one.video.kind === 'short') { list = [one.video, ...list]; total += 1; } } catch (_) { /* ไม่มีคลิปนั้นแล้ว */ }
        }
    }
    feed.innerHTML = '';
    if (!list.length) {
        feed.innerHTML = `<section class="sh-item sh-msg"><div class="sh-lock-in"><p class="sh-lock-k">${VICON.shorts(30)}</p><h3>ยังไม่มี Shorts${subjectInfo ? `ของวิชา${esc(subjectInfo.title)}` : ''}</h3><a class="btn btn-line" href="${esc(videosUrl(subject))}">กลับไปหน้าคลิป</a></div></section>`;
        return null;
    }
    append(list);

    feed.addEventListener('click', (e) => {
        const act = e.target.closest && e.target.closest('[data-act]');
        if (!act) return;
        const item = act.closest('.sh-item');
        if (act.dataset.act === 'tap') onTap(item);
        if (act.dataset.act === 'retry' && item) { if (active && active.el === item) active = null; activate(item); }
    });
    doc.addEventListener('keydown', (e) => {
        if (!active) return;
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); next(active.el); }
        if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); const prev = active.el.previousElementSibling; if (prev) prev.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        if (e.key === ' ') { e.preventDefault(); onTap(active.el); }
    });
    // ปิดหน้า: ส่งตำแหน่งสุดท้าย (keepalive)
    win.addEventListener('pagehide', () => { if (active && active.tracker) active.tracker.stop({ keepalive: true }); });
    return { get active() { return active; } };
}

if (typeof document !== 'undefined' && document.body?.dataset?.page === 'shorts') {
    mountShorts().catch((err) => console.error('[shorts] page failed', err));
}
