/**
 * js/study-watch.js — หน้าดูคลิปยาว (watch.html?v=คลิป)
 *
 * เปิดหน้ายังไม่นับโควตา: เห็นภาพปก ชื่อ คำอธิบาย และความคืบหน้าก่อน กด "เล่น" จึงเรียก POST /videos/:id/play
 * (Backend ตรวจสิทธิ์รายวัน FREE 5 คลิป/วัน คลิปเดิมในวันเดียวกันไม่นับซ้ำ) แล้วเล่นต่อจากตำแหน่งที่ค้าง
 * ตำแหน่งที่ดูถึงส่งให้ Backend ทุก 10 วินาที + ตอนหยุด/จบ/ปิดหน้า (js/video-tracker.js) ดูจบ = ได้ EXP ที่แอดมินตั้ง (ครั้งแรกเท่านั้น)
 */
import { studyApi, StudyApiError } from './study-api.js';
import { esc } from './study-ui.js';
import { createPlayer, youtubeErrorText, YT_STATE } from './yt-player.js';
import { createTracker } from './video-tracker.js';
import { VICON, fmtDuration, longCardHtml, videosUrl } from './study-videos.js';
import { videoFromUrl } from './study-shorts.js';
import { getProfilePageUrl } from './env.js';

export const REPORT_MS = 10000;

const safeImg = (url) => (typeof url === 'string' && /^https:\/\/[^\s"'<>\\]+$/i.test(url) ? url : '');

/** สถานะความคืบหน้า + EXP ใต้ชื่อคลิป */
export function statusHtml(v) {
    const p = v.progress || {};
    const pct = Math.max(0, Math.min(100, Number(p.pct) || 0));
    const exp = v.expEarned ? `<span class="wt-exp is-got">${VICON.check(12)} ได้ ${Number(v.expEarned)} EXP แล้ว</span>` : v.exp > 0 ? `<span class="wt-exp">${VICON.bolt(12)} ดูจบรับ +${Number(v.exp)} EXP</span>` : '';
    return `<div class="wt-status">
      <div class="wt-prog" role="progressbar" aria-label="ดูแล้ว ${pct}%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
      <p class="wt-prog-t">${p.completed ? `${VICON.check(12)} ดูจบแล้ว` : pct > 0 ? `ดูแล้ว ${pct}%` : 'ยังไม่ได้ดู'}</p>
      ${exp}
    </div>`;
}

/** ข้อมูลคลิปใต้เครื่องเล่น */
export function infoHtml(v) {
    return `<section class="wt-info">
      <h2 class="wt-title">${esc(v.title)}</h2>
      <p class="wt-meta">${v.subject ? `<span>${esc(`${v.subject.emoji ? `${v.subject.emoji} ` : ''}${v.subject.title}`)}</span>` : ''}<span>${fmtDuration(v.durationSec)}</span>${v.topic ? `<span>${esc(v.topic)}</span>` : ''}</p>
      <div id="wtStatus">${statusHtml(v)}</div>
      ${v.lessonNo ? `<a class="btn btn-line btn-block wt-lesson" href="lesson.html?s=${encodeURIComponent(v.subjectId)}&l=${Number(v.lessonNo)}">ไปเรียนบทที่ ${Number(v.lessonNo)} ${VICON.next(16)}</a>` : ''}
      ${v.description ? `<p class="wt-desc">${esc(v.description)}</p>` : ''}
    </section>`;
}

/** ภาพปก + ปุ่มเล่น (ยังไม่โหลด YouTube จนกว่าจะกด) */
export function posterHtml(v, resumeSec = 0) {
    const img = safeImg(v.thumbnailUrl);
    return `<button type="button" class="wt-poster" data-act="play" aria-label="${esc(`เล่นคลิป ${v.title}`)}">
      ${img ? `<img src="${esc(img)}" alt="" decoding="async">` : ''}
      <span class="wt-big">${VICON.play(30)}</span>
      ${resumeSec > 0 ? `<span class="wt-resume">ดูต่อจาก ${fmtDuration(resumeSec)}</span>` : ''}
    </button>`;
}

export function lockHtml(reason, { limit = null, message = '' } = {}) {
    if (reason === 'quota') return `<div class="wt-lock" role="alert"><h3>วันนี้ดูคลิปยาวครบ ${limit ? `${Number(limit)} คลิป` : 'จำนวน'}แล้ว</h3><p>พรุ่งนี้ดูต่อได้ (เริ่มนับใหม่เที่ยงคืน) หรืออัปเกรดเป็น PLUS เพื่อดูได้ไม่จำกัด · คลิปที่เปิดดูไปแล้ววันนี้ยังดูซ้ำได้</p><a class="btn" href="${esc(getProfilePageUrl())}">ดูแพลนของฉัน</a></div>`;
    if (reason === 'plan') return `<div class="wt-lock" role="alert"><h3>แพลนของคุณยังดูคลิปนี้ไม่ได้</h3><a class="btn" href="${esc(getProfilePageUrl())}">ดูแพลนของฉัน</a></div>`;
    return `<div class="wt-lock" role="alert"><h3>เล่นคลิปนี้ไม่ได้</h3><p>${esc(message || 'กรุณาลองใหม่อีกครั้ง')}</p><button type="button" class="btn btn-line" data-act="play">ลองใหม่</button></div>`;
}

// ───────────── ผูกกับหน้าจริง ─────────────
export async function mountWatch({ doc = document, win = window, api = studyApi, makePlayer = createPlayer } = {}) {
    const $ = (s, r = doc) => r.querySelector(s);
    const stage = $('#wtStage');
    const content = $('#content');
    const id = videoFromUrl(win.location.href);
    let video = null;
    let player = null;
    let tracker = null;
    let starting = false;

    const toast = (text) => {
        const t = $('#wtToast');
        if (!t) return;
        t.textContent = text;
        t.hidden = false;
        win.clearTimeout(toast.timer);
        toast.timer = win.setTimeout(() => { t.hidden = true; }, 2600);
    };
    const missing = (title, text) => {
        stage.hidden = true;
        content.innerHTML = `<section class="wt-info"><div class="wt-lock" role="alert"><h3>${esc(title)}</h3><p>${esc(text)}</p><a class="btn" href="videos.html">ไปหน้าคลิปทั้งหมด</a></div></section>`;
    };

    if (!id) { missing('ไม่พบคลิปนี้', 'ลิงก์อาจไม่ถูกต้อง'); return null; }

    try {
        ({ video } = await api.getVideo(id));
    } catch (err) {
        if (err instanceof StudyApiError && err.status === 404) missing('ไม่พบคลิปนี้', 'คลิปอาจถูกนำออกแล้ว หรือลิงก์ไม่ถูกต้อง');
        else missing('โหลดคลิปไม่สำเร็จ', err instanceof StudyApiError ? err.message : 'กรุณาลองใหม่อีกครั้ง');
        return null;
    }
    if (video.kind === 'short') { win.location.replace(`shorts.html?s=${encodeURIComponent(video.subjectId)}&v=${encodeURIComponent(video.id)}`); return null; }

    doc.title = `HEADFACE Study - ${video.title}`;
    $('#backLink').href = videosUrl(video.subjectId);
    $('#eyebrow').textContent = video.subject ? video.subject.title : 'คลิปสอน';
    const title = $('#pageTitle');
    title.textContent = 'คลิปยาว';
    title.classList.remove('ld-e');
    const resume = video.progress && !video.progress.completed ? video.progress.positionSec : 0;
    stage.innerHTML = posterHtml(video, resume);
    content.innerHTML = `${infoHtml(video)}<section class="wt-more" id="wtMore" hidden><h3>${VICON.film(18)} คลิปอื่นในวิชานี้</h3><div class="vd-list" id="wtMoreList"></div></section>`;

    // คลิปอื่นของวิชาเดียวกัน (ไม่สำคัญพอจะแสดงข้อผิดพลาด)
    api.listVideos({ subject: video.subjectId, kind: 'long', limit: 8 }).then((res) => {
        const others = (res.videos || []).filter((v) => v.id !== video.id);
        if (!others.length) return;
        $('#wtMoreList').innerHTML = others.map((v) => longCardHtml(v)).join('');
        $('#wtMore').hidden = false;
    }).catch(() => {});

    function onResult(r) {
        if (!r || !r.progress) return;
        video = { ...video, progress: r.progress, ...(r.reward ? { expEarned: r.reward.exp } : {}) };
        const box = $('#wtStatus');
        if (box) box.innerHTML = statusHtml(video);
        if (r.reward && r.reward.exp > 0) toast(`ดูจบแล้ว +${r.reward.exp} EXP`);
        else if (r.completedNow) toast('ดูจบแล้ว');
    }

    async function start() {
        if (starting || player) return;
        starting = true;
        stage.querySelector('.wt-poster')?.classList.add('is-busy');
        let play;
        try {
            play = await api.playVideo(video.id);
        } catch (err) {
            starting = false;
            const code = err instanceof StudyApiError ? err.code : '';
            stage.innerHTML = code === 'FEATURE_QUOTA_EXCEEDED' ? lockHtml('quota', { limit: err.body?.details?.limit })
                : code === 'FEATURE_FORBIDDEN' ? lockHtml('plan') : lockHtml('error', { message: err.message });
            return;
        }
        stage.innerHTML = '<div class="wt-frame"><div id="wtPlayer"></div></div>';
        try {
            player = await makePlayer($('#wtPlayer'), {
                videoId: play.source.id, start: play.resumeAt || 0, autoplay: true, mute: false, controls: true,
                onState: (s) => {
                    if (s === YT_STATE.PLAYING) tracker?.start();
                    if (s === YT_STATE.PAUSED) tracker?.pause();
                    if (s === YT_STATE.ENDED) tracker?.ended();
                },
                onError: (code) => { stage.innerHTML = lockHtml('error', { message: youtubeErrorText(code) }); player = null; }
            });
        } catch (_) {
            starting = false;
            if (!player) stage.innerHTML = lockHtml('error', { message: 'โหลดเครื่องเล่น YouTube ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่' });
            return;
        }
        starting = false;
        tracker = createTracker({
            api, videoId: video.id, intervalMs: REPORT_MS, timers: win,
            getTime: () => player.getCurrentTime(),
            isPlaying: () => player.getPlayerState() === YT_STATE.PLAYING,
            onResult
        });
        // บางเบราว์เซอร์เล่นเองไม่ได้ (เล่นอัตโนมัติถูกบล็อก): สถานะ PLAYING จะมาเมื่อผู้ใช้กดเล่นบนเครื่องเล่นเอง
        try { if (player.getPlayerState() === YT_STATE.PLAYING) tracker.start(); } catch (_) { /* */ }
    }

    stage.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-act="play"]')) start(); });
    win.addEventListener('pagehide', () => { if (tracker) tracker.stop({ keepalive: true }); });
    return { get video() { return video; }, start };
}

if (typeof document !== 'undefined' && document.body?.dataset?.page === 'watch') {
    mountWatch().catch((err) => console.error('[watch] page failed', err));
}
