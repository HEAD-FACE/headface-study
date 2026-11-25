/**
 * js/video-tracker.js — ส่งตำแหน่งที่ดูถึงของคลิปสอนไปให้ Backend (PUT /videos/:id/progress)
 *
 * Backend เป็นคนตัดสินว่า "ดูจบ" (ดูจริง ≥ 90% และถึงช่วงท้ายคลิป โดยให้เครดิตไม่เกินที่เวลาจริงผ่านไป) หน้านี้แค่รายงาน:
 *   - ทุก intervalMs ระหว่างกำลังเล่น (Shorts ถี่กว่า เพราะคลิปสั้น)
 *   - ทันทีเมื่อหยุดชั่วคราว / จบคลิป
 *   - ตอนปิดหน้า (keepalive) เพื่อให้กลับมาดูต่อจากที่ค้างได้
 * ไม่เก็บอะไรในเครื่อง ตัวเลขทุกอย่างอยู่ที่ Backend
 */

/**
 * @param {{ api: { reportVideo: Function }, videoId: string, getTime: () => number, isPlaying: () => boolean,
 *           intervalMs?: number, timers?: { setInterval: Function, clearInterval: Function },
 *           onResult?: (result: object) => void }} deps
 */
export function createTracker({ api, videoId, getTime, isPlaying, intervalMs = 10000, timers = globalThis, onResult } = {}) {
    let timer = null;
    let lastSent = -1;
    let busy = false;
    let stopped = false;
    let finished = false;

    async function send({ ended = false, keepalive = false } = {}) {
        if (stopped && !keepalive) return null;
        let position = Math.floor(Number(getTime()) || 0);
        if (!Number.isFinite(position) || position < 0) position = 0;
        if (!ended && position === lastSent) return null; // ไม่ขยับ = ไม่ต้องส่ง
        if (busy && !ended && !keepalive) return null; // รอคำตอบก่อนหน้า (ส่งรอบถัดไปแทน)
        busy = true;
        lastSent = position;
        try {
            const result = await api.reportVideo(videoId, ended ? { position, ended: true } : { position }, { keepalive });
            if (result && result.progress && result.progress.completed) finished = true;
            if (typeof onResult === 'function') onResult(result);
            return result;
        } catch (_) {
            lastSent = -1; // ส่งไม่สำเร็จ: รอบถัดไปส่งใหม่
            return null;
        } finally {
            busy = false;
        }
    }

    return {
        start() {
            if (timer || stopped) return;
            timer = timers.setInterval(() => { if (isPlaying()) send(); }, intervalMs);
        },
        /** หยุดชั่วคราว: ส่งตำแหน่งตอนนี้ */
        pause() { return send(); },
        /** คลิปจบ */
        ended() { return send({ ended: true }); },
        /** ปิดหน้า / เปลี่ยนคลิป: ส่งครั้งสุดท้ายแบบ keepalive แล้วหยุด */
        stop({ keepalive = false } = {}) {
            if (timer) { timers.clearInterval(timer); timer = null; }
            const last = stopped ? null : send({ keepalive });
            stopped = true;
            return last;
        },
        get finished() { return finished; },
        send
    };
}
