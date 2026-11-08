/**
 * js/tutor-usage.js — ส่งจำนวน token ของ AI Tutor ไปหักเครดิตที่ Backend (ไม่พึ่งเบราว์เซอร์ เทสต์ใน Node ได้)
 *
 * Google ส่งตัวเลข token ของแต่ละรอบ (turn) มาที่หน้านี้ หน้านี้ต้องส่งต่อให้ Backend ซึ่งเป็นคนหักเครดิตจากกระเป๋า LYNX ใบเดียวกับแชท LYNX
 *  - แต่ละรอบมีเลขลำดับ (seq) เพิ่มขึ้นเรื่อย ๆ: ส่งซ้ำไม่ถูกหักซ้ำ และส่งไม่สำเร็จก็เก็บไว้ส่งใหม่ (ไม่หายเงียบ ๆ)
 *  - ส่งทุก heartbeatMs แม้ไม่มีรอบใหม่ (เป็น heartbeat: Backend รู้ว่าหน้ายังเปิดอยู่ และบอกเครดิตที่เหลือ)
 *  - Backend ตอบ stop:true (เครดิตหมด / ครบเวลา) → onStop; ส่งไม่ถึงเซิร์ฟเวอร์ติดกัน maxFailures ครั้ง → หยุดเองด้วย 'offline'
 *    (ถ้าเซิร์ฟเวอร์ติดต่อไม่ได้ก็หักเครดิตไม่ได้ จึงไม่คุยต่อโดยไม่คิดเงิน)
 */

export function createUsageTracker({ report, heartbeatMs = 15000, maxFailures = 3, onUpdate = () => {}, onStop = () => {}, setTimer = setInterval, clearTimer = clearInterval }) {
    let seq = 0;
    let pending = [];
    let timer = null;
    let inFlight = null;
    let failures = 0;
    let stopped = false;
    const state = { credits: null, sessionCharged: 0, ackSeq: 0, stop: null };

    function record(usage) {
        if (!usage || stopped) return null;
        const entry = { seq: ++seq, prompt: usage.prompt | 0, response: usage.response | 0, thoughts: usage.thoughts | 0 };
        pending.push(entry);
        return entry;
    }

    async function send() {
        const turns = pending.slice(0, 20);
        let res;
        try {
            res = await report({ turns });
        } catch (err) {
            failures += 1;
            if (failures >= maxFailures && !stopped) { stopped = true; state.stop = 'offline'; onStop('offline'); }
            return null;
        }
        failures = 0;
        if (typeof res?.ackSeq === 'number') {
            pending = pending.filter((t) => t.seq > res.ackSeq);
            state.ackSeq = res.ackSeq;
        }
        if (res?.credits) state.credits = res.credits;
        if (typeof res?.session?.creditsCharged === 'number') state.sessionCharged = res.session.creditsCharged;
        onUpdate({ ...state, charged: res?.charged || 0, remainingMs: res?.remainingMs ?? null });
        if (res?.stop && !stopped) { stopped = true; state.stop = res.reason || 'ended'; onStop(state.stop); }
        return res;
    }

    /** ส่งเดี๋ยวนี้ (ถ้ากำลังส่งอยู่ รอผลนั้น); รอบที่เหลือเกินเพดานต่อครั้งส่งต่อทันที */
    async function flush() {
        if (inFlight) return inFlight;
        inFlight = (async () => {
            let res = null;
            for (let round = 0; round < 5; round++) {
                const before = pending.length;
                res = await send();
                if (!res || stopped || pending.length === 0 || pending.length >= before) break;
            }
            return res;
        })().finally(() => { inFlight = null; });
        return inFlight;
    }

    function start() {
        if (timer !== null) return;
        timer = setTimer(() => { flush(); }, heartbeatMs);
    }

    function halt() {
        if (timer !== null) { clearTimer(timer); timer = null; }
    }

    return {
        record, flush, start, halt,
        pendingTurns: () => pending.slice(0, 20),
        get state() { return { ...state, pending: pending.length, failures }; }
    };
}
