/**
 * js/yt-player.js — เครื่องเล่น YouTube ของคลิปสอน (Shorts / คลิปยาว) ผ่าน YouTube IFrame Player API
 *
 * โหลดสคริปต์ของ YouTube ครั้งเดียวเมื่อมีคลิปให้เล่นจริงเท่านั้น และเล่นผ่าน youtube-nocookie.com
 * ตัวเครื่องเล่นบอกตำแหน่งปัจจุบัน/สถานะให้ js/video-tracker.js ส่งไปให้ Backend ตัดสินว่า "ดูจบ" หรือยัง
 * รหัสคลิป (videoId) มาจาก POST /videos/:id/play เท่านั้น (หลังตรวจสิทธิ์รายวันแล้ว)
 */

const API_SRC = 'https://www.youtube.com/iframe_api';
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

// สถานะของ YouTube (YT.PlayerState)
export const YT_STATE = Object.freeze({ UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 });

let apiPromise = null;

/** โหลด YouTube IFrame API ครั้งเดียว (เรียกซ้ำได้) */
export function loadYouTubeApi(win = window, doc = document) {
    if (win.YT && typeof win.YT.Player === 'function') return Promise.resolve(win.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
        const previous = win.onYouTubeIframeAPIReady;
        win.onYouTubeIframeAPIReady = () => {
            if (typeof previous === 'function') { try { previous(); } catch (_) { /* ของหน้าอื่น */ } }
            resolve(win.YT);
        };
        const script = doc.createElement('script');
        script.src = API_SRC;
        script.async = true;
        script.onerror = () => { apiPromise = null; reject(new Error('YOUTUBE_API_LOAD_FAILED')); };
        doc.head.appendChild(script);
    });
    return apiPromise;
}

/** ค่าที่ส่งให้ YouTube (playerVars): ไม่โชว์คลิปแนะนำของช่องอื่น เล่นในหน้า (iOS) ไม่มีคำอธิบายประกอบ */
export function playerVars({ start = 0, autoplay = false, mute = false, controls = true } = {}) {
    return {
        start: Math.max(0, Math.floor(Number(start) || 0)),
        autoplay: autoplay ? 1 : 0,
        mute: mute ? 1 : 0,
        controls: controls ? 1 : 0,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3,
        fs: controls ? 1 : 0,
        disablekb: controls ? 0 : 1
    };
}

/**
 * สร้างเครื่องเล่นแทนที่ element `el` คืน Promise ของตัวเครื่องเล่นเมื่อพร้อม
 * @param {HTMLElement} el
 * @param {{ videoId: string, start?: number, autoplay?: boolean, mute?: boolean, controls?: boolean,
 *           onState?: (state: number) => void, onError?: (code: number) => void }} options
 */
export async function createPlayer(el, { videoId, start = 0, autoplay = false, mute = false, controls = true, onState, onError } = {}, { win = window, doc = document } = {}) {
    if (!YT_ID_RE.test(String(videoId || ''))) throw new Error('BAD_VIDEO_ID');
    const YT = await loadYouTubeApi(win, doc);
    return new Promise((resolve, reject) => {
        let settled = false;
        // eslint-disable-next-line no-new
        const player = new YT.Player(el, {
            host: 'https://www.youtube-nocookie.com',
            videoId,
            width: '100%',
            height: '100%',
            playerVars: playerVars({ start, autoplay, mute, controls }),
            events: {
                onReady: () => { settled = true; resolve(player); },
                onStateChange: (e) => { if (typeof onState === 'function') onState(e.data); },
                onError: (e) => {
                    if (typeof onError === 'function') onError(e.data);
                    if (!settled) { settled = true; reject(new Error(`YOUTUBE_ERROR_${e.data}`)); }
                }
            }
        });
    });
}

/** ข้อความภาษาไทยของรหัสผิดพลาดของ YouTube (2, 5, 100, 101, 150) */
export function youtubeErrorText(code) {
    switch (Number(code)) {
        case 100: return 'คลิปนี้ถูกลบหรือตั้งเป็นส่วนตัวบน YouTube แล้ว';
        case 101: case 150: return 'เจ้าของคลิปไม่อนุญาตให้เล่นนอก YouTube';
        case 5: return 'เบราว์เซอร์นี้เล่นคลิปนี้ไม่ได้';
        default: return 'เล่นคลิปนี้ไม่ได้ในตอนนี้';
    }
}
