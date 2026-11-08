/**
 * js/tutor-live.js — ตัวควบคุมการคุยกับ AI Tutor (Gemini Live): เริ่ม → ต่อ WebSocket → ส่งเสียง/ภาพ/ข้อความ → รับเสียงตอบ → จบ
 *
 * ไม่แตะเบราว์เซอร์โดยตรง: ไมค์/ลำโพง/กล้องมาจาก `media` (js/tutor-media.js) และ API มาจาก `api` (study-api.js) ที่ส่งเข้ามา
 * เทสต์ใน Node จึงใช้ของปลอมได้ (test/tutor-live.test.mjs)
 *
 * ลำดับ: ขออนุญาตไมค์ → api.startTutor (Backend ตรวจแพลน/เครดิต แล้วขอ token ของ Google) → เปิด WebSocket ด้วย token → ส่ง setup
 *        → setupComplete → เริ่มส่งเสียง → ทุกรอบที่ Google ส่ง turnComplete พร้อมจำนวน token ส่งต่อให้ Backend หักเครดิต → จบ (api.endTutor)
 *
 * เหตุการณ์ที่หน้าฟัง (on): state · caption · credits · notice · error · ended · level · mic
 */
import { setupMessage, audioMessage, imageMessage, textMessage, audioEndMessage, parseServerMessage } from './tutor-protocol.js';
import { createUsageTracker } from './tutor-usage.js';
import { sceneChanged } from './tutor-files.js';

export const STATES = Object.freeze(['idle', 'starting', 'connecting', 'listening', 'thinking', 'speaking', 'reconnecting', 'ending', 'ended']);

export const CONNECT_TIMEOUT_MS = 12000;
export const MAX_RECONNECTS = 3;
export const FRAME_INTERVAL_MS = 2000;
export const FRAME_REFRESH_MS = 20000; // ภาพนิ่งมานานเท่านี้ก็ส่งซ้ำ 1 ครั้งให้ AI รู้ว่ายังเห็นเหมือนเดิม
export const THINKING_AFTER_MS = 1200;

const STOP_NOTICE = {
    credits: 'เครดิต LYNX ของวันนี้ใกล้หมด จึงหยุดการคุยให้ก่อน',
    time: 'ครบเวลาของการคุยครั้งนี้แล้ว (สูงสุด 30 นาที) เริ่มใหม่ได้เลย',
    offline: 'เชื่อมต่อเซิร์ฟเวอร์ของ HEADFACE ไม่ได้ จึงหยุดการคุย (จะไม่คิดเครดิตเพิ่ม)',
    disabled: 'AI Tutor ปิดให้บริการชั่วคราว',
    ended: 'การคุยครั้งนี้จบแล้ว'
};
const END_REASON = { credits: 'credits', time: 'time', offline: 'error', disabled: 'error', ended: 'client' };

export class TutorLive {
    /**
     * @param {object} deps
     * @param {object} deps.api    { startTutor, reportTutor, endTutor } (study-api.js)
     * @param {object} deps.media  ไมค์/ลำโพง/กล้อง (tutor-media.js)
     */
    constructor({ api, media, WebSocketImpl = globalThis.WebSocket, timers = {}, now = Date.now, log = console } = {}) {
        this.api = api;
        this.media = media;
        this.WebSocketImpl = WebSocketImpl;
        this.timers = {
            setTimeout: timers.setTimeout || ((...a) => setTimeout(...a)),
            clearTimeout: timers.clearTimeout || ((...a) => clearTimeout(...a)),
            setInterval: timers.setInterval || ((...a) => setInterval(...a)),
            clearInterval: timers.clearInterval || ((...a) => clearInterval(...a))
        };
        this.now = now;
        this.log = log;
        this.listeners = {};
        this.state = 'idle';
        this.session = null;
        this.connection = null;
        this.ws = null;
        this.handle = null;          // ตัวต่อบทสนทนาเดิมหลังสายหลุด (sessionResumptionUpdate)
        this.reconnects = 0;
        this.closing = false;
        this.muted = false;
        this.micReady = false;
        this.cameraOn = false;
        this.tracker = null;
        this.latestUsage = null;     // token ล่าสุดของรอบที่ยังไม่จบ
        this.bubbles = { user: null, ai: null };
        this.seq = 0;
        this.lastThumb = null;
        this.lastFrameAt = 0;
        this.frameTimer = null;
        this.connectTimer = null;
        this.thinkTimer = null;
        this.setupDone = false;
        this.stopping = false;
    }

    // ───────────── เหตุการณ์ ─────────────
    on(type, fn) {
        (this.listeners[type] ||= new Set()).add(fn);
        return () => this.listeners[type]?.delete(fn);
    }

    emit(type, payload = {}) {
        for (const fn of this.listeners[type] || []) {
            try { fn(payload); } catch (err) { this.log.error?.('[tutor] listener error', err); }
        }
    }

    setState(state, detail = {}) {
        if (this.state === state) return;
        this.state = state;
        this.emit('state', { state, ...detail });
    }

    // ───────────── เริ่ม ─────────────
    /**
     * @param {{mode?: 'live'|'extended', subjectId?: string, lessonNo?: number, mic?: boolean, camera?: boolean}} options
     * @throws StudyApiError จาก Backend (เช่น FEATURE_FORBIDDEN, INSUFFICIENT_CREDITS) — หน้าแสดงข้อความของมัน
     */
    async start({ mode = 'live', subjectId = null, lessonNo = null, mic = true, camera = false } = {}) {
        if (this.state !== 'idle') throw new Error('TutorLive: already started');
        this.setState('starting');

        // ขอไมค์ก่อนเริ่มเซสชันจริง: ถ้าไม่อนุญาตก็ยังคุยด้วยการพิมพ์ได้ และไม่เสีย token ของ Google ไปเปล่า
        if (mic) {
            try {
                this.micReady = Boolean(await this.media.prepareMic());
            } catch (err) {
                this.micReady = false;
                this.emit('notice', { level: 'warn', message: 'เปิดไมค์ไม่ได้ (ไม่ได้รับอนุญาตหรือไม่พบไมค์) — พิมพ์ข้อความคุยกับ AI แทนได้' });
            }
        }
        this.muted = !this.micReady;
        this.emit('mic', { on: !this.muted, failed: Boolean(mic) && !this.micReady }); // ให้ปุ่มไมค์ตรงกับความจริงตั้งแต่ต้น

        let res;
        try {
            res = await this.api.startTutor({ mode, ...(subjectId ? { subjectId } : {}), ...(Number.isInteger(lessonNo) ? { lessonNo } : {}) });
        } catch (err) {
            this.media.close?.();
            this.setState('idle');
            throw err;
        }
        this.session = res.session;
        this.connection = res.connection;
        this.context = res.context || {};
        this.emit('credits', { ...res.credits, sessionCharged: 0 });

        this.tracker = createUsageTracker({
            report: (body) => this.api.reportTutor(this.session.id, body.turns),
            heartbeatMs: this.session.heartbeatMs || 15000,
            onUpdate: (s) => this.emit('credits', { ...(s.credits || {}), sessionCharged: s.sessionCharged, charged: s.charged, remainingMs: s.remainingMs }),
            onStop: (reason) => this.stopFromServer(reason),
            setTimer: this.timers.setInterval,
            clearTimer: this.timers.clearInterval
        });

        this.wantCamera = camera;
        this.connect();
        return res;
    }

    // ───────────── WebSocket ─────────────
    connect() {
        this.setupDone = false;
        this.setState(this.reconnects > 0 ? 'reconnecting' : 'connecting');
        const url = `${this.connection.wsUrl}?access_token=${encodeURIComponent(this.connection.token)}`;
        let ws;
        try {
            ws = new this.WebSocketImpl(url);
        } catch (err) {
            this.fail('เปิดการเชื่อมต่อกับ AI Tutor ไม่ได้', 'connect_failed', err);
            return;
        }
        ws.binaryType = 'arraybuffer';
        this.ws = ws;
        this.connectTimer = this.timers.setTimeout(() => {
            if (!this.setupDone) this.fail('เชื่อมต่อ AI Tutor นานเกินไป ลองใหม่อีกครั้ง', 'connect_failed');
        }, CONNECT_TIMEOUT_MS);

        ws.onopen = () => ws.send(JSON.stringify(setupMessage(this.connection.setup, this.handle)));
        ws.onmessage = (event) => this.handleRaw(event.data);
        ws.onerror = () => { /* รายละเอียดมากับ close */ };
        ws.onclose = (event) => this.handleClose(event, ws);
    }

    handleRaw(data) {
        let text = data;
        if (typeof data !== 'string') {
            try { text = new TextDecoder().decode(data); } catch (_) { return; }
        }
        for (const ev of parseServerMessage(text)) this.handleEvent(ev);
    }

    handleEvent(ev) {
        switch (ev.type) {
            case 'setupComplete': return this.onSetupComplete();
            case 'audio':
                this.closeBubble('user');
                this.cancelThinking();
                this.media.play(ev.data);
                this.setState('speaking');
                return undefined;
            case 'inputText': return this.onCaption('user', ev.text);
            case 'outputText': return this.onCaption('ai', ev.text);
            case 'usage': this.latestUsage = ev.usage; return undefined;
            case 'interrupted':
                this.media.stopPlayback();
                this.closeBubble('ai');
                this.finishTurn(false);
                return undefined;
            case 'turnComplete': return this.finishTurn(true);
            case 'resumption': if (ev.handle && ev.resumable) this.handle = ev.handle; return undefined;
            case 'goAway': this.emit('notice', { level: 'info', message: 'ระบบกำลังต่อการเชื่อมต่อใหม่ ครู่เดียว…' }); return undefined;
            default: return undefined;
        }
    }

    async onSetupComplete() {
        this.setupDone = true;
        this.timers.clearTimeout(this.connectTimer);
        this.reconnects = 0;
        this.setState('listening');
        this.tracker.start();
        if (this.micReady && !this.micRunning) await this.startMicStream();
        if (this.wantCamera && !this.cameraOn) await this.setCamera(true).catch(() => {});
    }

    /** เริ่มส่งเสียงจากไมค์ (หลังต่อ Google สำเร็จแล้วเท่านั้น); ไมค์ที่เปิดไม่ขึ้นถูกปิดเงียบ ๆ พร้อมแจ้งผู้ใช้ */
    async startMicStream() {
        try {
            await this.media.startMic({
                onChunk: (b64) => { if (!this.muted && this.isOpen()) this.ws.send(JSON.stringify(audioMessage(b64))); },
                onLevel: (mic) => this.emit('level', { mic })
            });
            this.micRunning = true;
            this.emit('mic', { on: !this.muted });
            return true;
        } catch (err) {
            this.micReady = false;
            this.muted = true;
            this.emit('mic', { on: false, failed: true });
            this.emit('notice', { level: 'warn', message: 'เปิดไมค์ไม่สำเร็จ — พิมพ์ข้อความคุยกับ AI แทนได้' });
            return false;
        }
    }

    /** ปุ่มไมค์: เปิด/ปิดเสียงที่ส่งออก; ถ้ายังไม่เคยได้รับอนุญาตไมค์ (ปิดไว้ตอนเริ่ม) จะขออนุญาตตอนนี้ */
    async toggleMic() {
        if (this.micReady) return this.setMuted(!this.muted);
        try {
            this.micReady = Boolean(await this.media.prepareMic());
        } catch (err) {
            this.emit('notice', { level: 'warn', message: 'เปิดไมค์ไม่ได้ (ไม่ได้รับอนุญาตหรือไม่พบไมค์) — พิมพ์ข้อความคุยกับ AI แทนได้' });
            this.emit('mic', { on: false, failed: true });
            return false;
        }
        this.muted = false;
        if (this.setupDone && !this.micRunning) return this.startMicStream();
        this.emit('mic', { on: true });
        return true;
    }

    handleClose(event, ws) {
        if (ws !== this.ws) return; // การเชื่อมต่อเก่าที่เราปิดเอง
        this.timers.clearTimeout(this.connectTimer);
        if (this.closing || this.state === 'ended' || this.state === 'ending') return;
        const code = event?.code;
        const reason = String(event?.reason || '').slice(0, 200);
        this.log.warn?.(`[tutor] connection closed: ${code} ${reason}`);
        if (!this.setupDone && this.reconnects === 0) {
            this.fail(`เชื่อมต่อ AI Tutor ไม่สำเร็จ${code ? ` (รหัส ${code})` : ''}`, 'connect_failed', { code, reason });
            return;
        }
        if (this.handle && this.reconnects < MAX_RECONNECTS) {
            this.reconnects += 1;
            this.cancelThinking();
            this.media.stopPlayback(); // เสียงที่ค้างอยู่เป็นของสายเก่า
            this.setState('reconnecting');
            this.timers.setTimeout(() => { if (!this.closing) this.connect(); }, 600);
            return;
        }
        this.fail('การเชื่อมต่อกับ AI Tutor หลุด', 'error', { code, reason });
    }

    isOpen() {
        return Boolean(this.ws) && this.ws.readyState === 1;
    }

    sendJson(message) {
        if (!this.isOpen()) return false;
        this.ws.send(JSON.stringify(message));
        return true;
    }

    // ───────────── คำบรรยาย ─────────────
    onCaption(role, text) {
        if (!text) return;
        if (role === 'user') {
            this.closeBubble('ai');
            this.armThinking();
        } else {
            this.closeBubble('user');
            this.cancelThinking();
        }
        const b = this.bubbles[role] || (this.bubbles[role] = { id: `c${++this.seq}`, text: '' });
        b.text += text;
        this.emit('caption', { id: b.id, role, text: b.text, final: false });
    }

    closeBubble(role) {
        const b = this.bubbles[role];
        if (!b) return;
        this.bubbles[role] = null;
        if (b.text.trim()) this.emit('caption', { id: b.id, role, text: b.text.trim(), final: true });
        else this.emit('caption', { id: b.id, role, text: '', final: true, empty: true });
    }

    armThinking() {
        this.cancelThinking();
        this.thinkTimer = this.timers.setTimeout(() => { if (this.state === 'listening') this.setState('thinking'); }, THINKING_AFTER_MS);
    }

    cancelThinking() {
        if (this.thinkTimer) { this.timers.clearTimeout(this.thinkTimer); this.thinkTimer = null; }
    }

    /** จบรอบ: ปิดคำบรรยาย ส่ง token ของรอบนี้ไปหักเครดิต กลับไปฟัง */
    finishTurn(complete) {
        this.cancelThinking();
        this.closeBubble('user');
        this.closeBubble('ai');
        if (complete && this.latestUsage) {
            this.tracker.record(this.latestUsage);
            this.latestUsage = null;
            this.tracker.flush();
        }
        if (this.state === 'speaking' || this.state === 'thinking') this.setState('listening');
    }

    // ───────────── สิ่งที่นักเรียนส่ง ─────────────
    setMuted(muted) {
        if (!this.micReady) return false;
        this.muted = Boolean(muted);
        if (this.muted) this.sendJson(audioEndMessage());
        this.emit('mic', { on: !this.muted });
        return true;
    }

    sendText(text) {
        const clean = String(text || '').trim();
        if (!clean || !this.setupDone) return false;
        const ok = this.sendJson(textMessage(clean));
        if (ok) {
            this.closeBubble('ai');
            this.emit('caption', { id: `c${++this.seq}`, role: 'user', text: clean, final: true, typed: true });
            this.media.stopPlayback();
            this.setState('thinking');
        }
        return ok;
    }

    /** ภาพจากไฟล์: ส่งภาพแล้วบอก AI ให้ดู (ภาพเงียบ ๆ อย่างเดียว AI จะไม่ตอบเอง) */
    sendImage(b64, { name = 'รูปภาพ', mimeType = 'image/jpeg' } = {}) {
        if (!this.setupDone) return false;
        const ok = this.sendJson(imageMessage(b64, mimeType));
        if (ok) {
            this.sendJson(textMessage(`นักเรียนส่งรูป "${String(name).replace(/[\r\n]+/g, ' ').slice(0, 80)}" มาให้ดู ช่วยดูแล้วบอกว่าเห็นอะไรและอยากให้ช่วยเรื่องไหน`));
            this.emit('attachment', { kind: 'image', name });
            this.setState('thinking');
        }
        return ok;
    }

    /** ข้อความจากไฟล์ (txt/pdf) — ส่งเป็นข้อความก้อนเดียว */
    sendAttachmentText(name, prompt) {
        if (!this.setupDone) return false;
        const ok = this.sendJson(textMessage(prompt));
        if (ok) {
            this.emit('attachment', { kind: 'text', name });
            this.setState('thinking');
        }
        return ok;
    }

    // ───────────── กล้อง ─────────────
    async setCamera(on, facing = 'user') {
        if (on === this.cameraOn) return this.cameraOn;
        if (!on) {
            this.stopFrames();
            this.media.stopCamera();
            this.cameraOn = false;
            this.emit('camera', { on: false });
            return false;
        }
        await this.media.startCamera(facing); // โยนข้อผิดพลาดถ้าไม่อนุญาต — หน้าแจ้งผู้ใช้
        this.cameraOn = true;
        this.lastThumb = null;
        this.lastFrameAt = 0;
        this.emit('camera', { on: true, facing });
        this.frameTimer = this.timers.setInterval(() => this.pushFrame(), FRAME_INTERVAL_MS);
        this.pushFrame();
        return true;
    }

    stopFrames() {
        if (this.frameTimer) { this.timers.clearInterval(this.frameTimer); this.frameTimer = null; }
    }

    /** ส่งเฟรมกล้องเมื่อภาพเปลี่ยน (หรือนิ่งมานาน) — ทุกเฟรมที่ส่งถูกคิดเครดิตซ้ำในทุกรอบ จึงไม่ส่งภาพซ้ำ ๆ */
    pushFrame() {
        if (!this.cameraOn || !this.setupDone || !this.isOpen()) return false;
        const frame = this.media.captureFrame();
        if (!frame) return false;
        const t = this.now();
        if (!sceneChanged(this.lastThumb, frame.thumb) && t - this.lastFrameAt < FRAME_REFRESH_MS) return false;
        this.lastThumb = frame.thumb;
        this.lastFrameAt = t;
        return this.sendJson(imageMessage(frame.data, 'image/jpeg'));
    }

    // ───────────── จบ ─────────────
    stopFromServer(reason) {
        this.emit('notice', { level: reason === 'ended' ? 'info' : 'warn', message: STOP_NOTICE[reason] || STOP_NOTICE.ended });
        this.end(END_REASON[reason] || 'client');
    }

    fail(message, reason, detail = null) {
        if (this.state === 'ended' || this.state === 'ending') return;
        this.log.warn?.('[tutor] failed:', message, detail || '');
        this.emit('error', { message, code: reason, detail });
        this.end(reason === 'connect_failed' ? 'connect_failed' : 'error');
    }

    /** ปิดทุกอย่างแล้วแจ้ง Backend (ส่ง token ที่ค้างไปด้วย) เรียกซ้ำได้ ไม่ทำซ้ำ */
    async end(reason = 'client', { keepalive = false } = {}) {
        if (this.closing) return this.endPromise;
        this.closing = true;
        this.endPromise = (async () => {
            this.setState('ending');
            this.cancelThinking();
            this.timers.clearTimeout(this.connectTimer);
            this.stopFrames();
            try { this.media.stopMic(); } catch (_) { /* ปิดไม่ลงก็ไม่เป็นไร */ }
            try { this.media.stopCamera(); } catch (_) { /* เช่นเดียวกัน */ }
            try { this.media.stopPlayback(); } catch (_) { /* เช่นเดียวกัน */ }
            this.closeBubble('user');
            this.closeBubble('ai');
            try { this.ws?.close(1000, 'client end'); } catch (_) { /* ปิดไปแล้ว */ }
            this.tracker?.halt();
            // รอบที่ยังไม่ทันจบ (ปิดกลางประโยค) ก็ยังใช้ token ไปแล้ว: ส่งตัวเลขล่าสุดไปคิดด้วย
            if (this.latestUsage) { this.tracker?.record(this.latestUsage); this.latestUsage = null; }
            let summary = null;
            if (this.session) {
                try {
                    const res = await this.api.endTutor(this.session.id, { turns: this.tracker?.pendingTurns() || [], reason }, { keepalive });
                    summary = res.session;
                    this.emit('credits', { ...(res.credits || {}), sessionCharged: res.session?.creditsCharged ?? 0, final: true });
                } catch (err) {
                    this.log.warn?.('[tutor] end failed:', err?.message || err);
                }
            }
            try { this.media.close?.(); } catch (_) { /* เช่นเดียวกัน */ }
            this.setState('ended');
            this.emit('ended', { summary, reason });
            return summary;
        })();
        return this.endPromise;
    }
}
