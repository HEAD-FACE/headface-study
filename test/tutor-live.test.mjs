// AI Tutor: ตัวควบคุมการคุย (js/tutor-live.js) กับ WebSocket / ไมค์ / กล้อง / API ปลอม
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TutorLive, CONNECT_TIMEOUT_MS, FRAME_INTERVAL_MS, FRAME_REFRESH_MS, THINKING_AFTER_MS, MAX_RECONNECTS } from '../js/tutor-live.js';
import { StudyApiError } from '../js/study-api.js';

// ───────────── ของปลอม ─────────────
class FakeWebSocket {
    static instances = [];
    constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        this.closed = null;
        FakeWebSocket.instances.push(this);
    }
    send(data) { this.sent.push(JSON.parse(data)); }
    close(code, reason) { this.closed = { code, reason }; this.readyState = 3; }
    open() { this.readyState = 1; this.onopen?.(); }
    receive(message) { this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) }); }
    drop(code = 1006, reason = '') { this.readyState = 3; this.onclose?.({ code, reason }); }
}

function clock() {
    let id = 0;
    const timeouts = new Map();
    const intervals = new Map();
    return {
        setTimeout: (fn, ms) => { timeouts.set(++id, { fn, ms }); return id; },
        clearTimeout: (i) => timeouts.delete(i),
        setInterval: (fn, ms) => { intervals.set(++id, { fn, ms }); return id; },
        clearInterval: (i) => intervals.delete(i),
        runTimeouts: (ms) => { for (const [i, t] of [...timeouts]) if (t.ms <= ms) { timeouts.delete(i); t.fn(); } },
        tick: (ms) => { for (const t of intervals.values()) if (t.ms === ms) t.fn(); },
        hasTimeout: (ms) => [...timeouts.values()].some((t) => t.ms === ms),
        intervalCount: () => intervals.size
    };
}

function fakeMedia({ micOk = true, frames = [] } = {}) {
    const log = [];
    const m = {
        log,
        micHandlers: null,
        prepareMic: async () => { log.push('prepareMic'); if (!micOk) throw new Error('denied'); return true; },
        startMic: async (h) => { log.push('startMic'); m.micHandlers = h; },
        stopMic: () => log.push('stopMic'),
        play: (b64) => log.push(`play:${b64}`),
        stopPlayback: () => log.push('stopPlayback'),
        startCamera: async (facing) => { log.push(`startCamera:${facing}`); },
        stopCamera: () => log.push('stopCamera'),
        captureFrame: () => frames.shift() || null,
        close: () => log.push('close')
    };
    return m;
}

const START_RESPONSE = {
    session: { id: 'ts_abcdefghij', mode: 'live', heartbeatMs: 15000, maxSessionMs: 1800000 },
    connection: { token: 'auth_tokens/abc+def', wsUrl: 'wss://example.test/ws', locked: true, setup: { model: 'models/gemini-3.8-live', sessionResumption: {}, generationConfig: { responseModalities: ['AUDIO'] } } },
    context: { subject: 'วิทยาศาสตร์', lesson: 'พลังงานความร้อน' },
    credits: { available: 50000, dailyLimit: 70000, usedToday: 20000, perMinuteGuide: 2813 }
};

function setup({ api = {}, media = fakeMedia(), startOptions } = {}) {
    FakeWebSocket.instances.length = 0;
    const calls = { start: [], report: [], end: [] };
    const fullApi = {
        startTutor: async (body) => { calls.start.push(body); return START_RESPONSE; },
        reportTutor: async (id, turns) => { calls.report.push({ id, turns }); return { ackSeq: turns.at(-1)?.seq ?? 0, charged: 5, credits: { available: 49995, dailyLimit: 70000, usedToday: 20005 }, session: { creditsCharged: 5 } }; },
        endTutor: async (id, body, opts) => { calls.end.push({ id, body, opts }); return { session: { id, status: 'ended', creditsCharged: 77, durationSec: 12 }, credits: { available: 49000, dailyLimit: 70000, usedToday: 21000 } }; },
        ...api
    };
    const timers = clock();
    const tutor = new TutorLive({ api: fullApi, media, WebSocketImpl: FakeWebSocket, timers, log: { warn() {}, error() {} } });
    const events = [];
    for (const type of ['state', 'caption', 'credits', 'notice', 'error', 'ended', 'mic', 'camera', 'attachment', 'level']) tutor.on(type, (p) => events.push({ type, ...p }));
    return { tutor, media, calls, timers, events, startOptions, ws: () => FakeWebSocket.instances.at(-1) };
}

async function live(options = {}) {
    const ctx = setup(options);
    await ctx.tutor.start({ mode: 'live', subjectId: 'sci', lessonNo: 3, mic: true, ...(options.startOptions || {}) });
    ctx.ws().open();
    ctx.ws().receive({ setupComplete: {} });
    await new Promise((r) => setImmediate(r)); // ให้ onSetupComplete (async) เริ่มไมค์เสร็จ
    return ctx;
}

const states = (events) => events.filter((e) => e.type === 'state').map((e) => e.state);
const captions = (events) => events.filter((e) => e.type === 'caption');

describe('เริ่มคุย', () => {
    test('ขอไมค์ก่อน → ขอเซสชันจาก Backend (พร้อมวิชา/บท) → เปิด WebSocket ด้วย token → ส่ง setup', async () => {
        const { tutor, media, calls, ws, events } = setup();
        await tutor.start({ mode: 'extended', subjectId: 'sci', lessonNo: 3 });
        assert.deepEqual(media.log, ['prepareMic']);
        assert.deepEqual(calls.start, [{ mode: 'extended', subjectId: 'sci', lessonNo: 3 }]);
        assert.equal(ws().url, 'wss://example.test/ws?access_token=auth_tokens%2Fabc%2Bdef', 'token ถูก encode ใน URL');
        assert.deepEqual(states(events), ['starting', 'connecting']);
        ws().open();
        assert.deepEqual(ws().sent[0], { setup: START_RESPONSE.connection.setup });
        assert.equal(ws().binaryType, 'arraybuffer');
    });

    test('ไม่ส่งวิชา/บทที่ไม่มี และเครดิตตั้งต้นถูกแจ้งหน้า', async () => {
        const { tutor, calls, events } = setup();
        await tutor.start({});
        assert.deepEqual(calls.start, [{ mode: 'live' }]);
        const credits = events.find((e) => e.type === 'credits');
        assert.equal(credits.available, 50000);
        assert.equal(credits.sessionCharged, 0);
    });

    test('Backend ปฏิเสธ (FREE / เครดิตไม่พอ): โยนต่อ ปิดอุปกรณ์ กลับไป idle และไม่เปิด WebSocket', async () => {
        const err = new StudyApiError('FEATURE_FORBIDDEN', 403, 'แพลนของคุณยังไม่มีสิทธิ์ใช้ส่วนนี้');
        const { tutor, media, events } = setup({ api: { startTutor: async () => { throw err; } } });
        await assert.rejects(tutor.start({ mic: true }), (e) => e === err);
        assert.equal(tutor.state, 'idle');
        assert.equal(FakeWebSocket.instances.length, 0);
        assert.ok(media.log.includes('close'), 'ไมค์ที่ขอไว้ต้องถูกปิด');
        assert.deepEqual(states(events), ['starting', 'idle']);
    });

    test('ไม่อนุญาตไมค์: ยังคุยได้ด้วยการพิมพ์ (แจ้งผู้ใช้) และเซสชันยังเริ่มตามปกติ', async () => {
        const { tutor, media, events, ws } = setup({ media: fakeMedia({ micOk: false }) });
        await tutor.start({ mic: true });
        ws().open(); ws().receive({ setupComplete: {} });
        await new Promise((r) => setImmediate(r));
        assert.equal(tutor.muted, true);
        assert.ok(!media.log.includes('startMic'));
        assert.ok(events.some((e) => e.type === 'notice' && e.level === 'warn'));
        assert.equal(tutor.setMuted(false), false, 'เปิดไมค์ไม่ได้เมื่อไม่ได้รับอนุญาต');
        assert.equal(tutor.sendText('ช่วยอธิบายหน่อย'), true);
    });

    test('ปุ่มไมค์ตรงความจริงตั้งแต่เริ่ม: ขอไมค์แล้วถูกปฏิเสธ = failed; ไม่ได้ขอ = ปิดเฉย ๆ (ไม่ใช่ failed)', async () => {
        const denied = setup({ media: fakeMedia({ micOk: false }) });
        await denied.tutor.start({ mic: true });
        assert.deepEqual(denied.events.find((e) => e.type === 'mic'), { type: 'mic', on: false, failed: true });
        const off = setup();
        await off.tutor.start({ mic: false });
        assert.deepEqual(off.events.find((e) => e.type === 'mic'), { type: 'mic', on: false, failed: false });
        assert.ok(!off.media.log.includes('prepareMic'), 'ไม่ขอไมค์ถ้าผู้ใช้ปิดไว้');
    });

    test('เริ่มโดยปิดไมค์แล้วกดเปิดทีหลัง: ขออนุญาตตอนนั้นและเริ่มส่งเสียง', async () => {
        const ctx = await live({ startOptions: { mic: false } });
        const { tutor, media, ws } = ctx;
        assert.ok(!media.log.includes('startMic'));
        assert.equal(await tutor.toggleMic(), true);
        assert.ok(media.log.includes('prepareMic') && media.log.includes('startMic'));
        assert.equal(tutor.muted, false);
        media.micHandlers.onChunk('ZZZZ');
        assert.equal(ws().sent.at(-1).realtimeInput.audio.data, 'ZZZZ');
        assert.equal(await tutor.toggleMic(), true, 'กดอีกครั้ง = ปิดไมค์');
        assert.equal(tutor.muted, true);
    });

    test('กดเปิดไมค์แล้วผู้ใช้ปฏิเสธ: แจ้งเตือน ไม่เริ่มส่งเสียง', async () => {
        const media = fakeMedia({ micOk: false });
        const ctx = await live({ media, startOptions: { mic: false } });
        assert.equal(await ctx.tutor.toggleMic(), false);
        assert.ok(ctx.events.some((e) => e.type === 'notice' && e.level === 'warn'));
        assert.ok(!media.log.includes('startMic'));
        assert.equal(ctx.tutor.muted, true);
    });

    test('เริ่มซ้ำไม่ได้', async () => {
        const { tutor } = setup();
        await tutor.start({});
        await assert.rejects(tutor.start({}), /already started/);
    });
});

describe('ระหว่างคุย', () => {
    test('setupComplete → ฟังอยู่ เริ่มไมค์ ส่งเสียงเป็นข้อความ audio; ปิดไมค์ = ไม่ส่งเสียง + แจ้งจบเสียง', async () => {
        const { tutor, media, ws, events } = await live();
        assert.equal(tutor.state, 'listening');
        assert.ok(media.log.includes('startMic'));
        media.micHandlers.onChunk('AAAA');
        assert.deepEqual(ws().sent.at(-1), { realtimeInput: { audio: { data: 'AAAA', mimeType: 'audio/pcm;rate=16000' } } });
        tutor.setMuted(true);
        assert.deepEqual(ws().sent.at(-1), { realtimeInput: { audioStreamEnd: true } });
        const before = ws().sent.length;
        media.micHandlers.onChunk('BBBB');
        assert.equal(ws().sent.length, before, 'ปิดไมค์แล้วไม่ส่งเสียงออกไป');
        assert.deepEqual(events.filter((e) => e.type === 'mic').at(-1), { type: 'mic', on: false });
        tutor.setMuted(false);
        media.micHandlers.onChunk('CCCC');
        assert.equal(ws().sent.at(-1).realtimeInput.audio.data, 'CCCC');
    });

    test('เสียงของ AI → เล่น และสถานะ speaking; จบรอบ → กลับไปฟัง และส่ง token ของรอบไปหักเครดิตเลขลำดับ 1', async () => {
        const { tutor, media, ws, calls, events } = await live();
        ws().receive({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'QUJD' } }] } } });
        assert.equal(tutor.state, 'speaking');
        assert.ok(media.log.includes('play:QUJD'));
        ws().receive({ usageMetadata: { promptTokenCount: 800, responseTokenCount: 90 } });
        ws().receive({ usageMetadata: { promptTokenCount: 800, responseTokenCount: 150, thoughtsTokenCount: 20 } }); // ตัวล่าสุดของรอบชนะ
        assert.equal(calls.report.length, 0, 'ยังไม่จบรอบ ยังไม่ส่ง');
        ws().receive({ serverContent: { turnComplete: true } });
        await new Promise((r) => setImmediate(r));
        assert.equal(tutor.state, 'listening');
        assert.deepEqual(calls.report, [{ id: 'ts_abcdefghij', turns: [{ seq: 1, prompt: 800, response: 150, thoughts: 20 }] }]);
        const credits = events.filter((e) => e.type === 'credits').at(-1);
        assert.equal(credits.available, 49995);
        assert.equal(credits.sessionCharged, 5);
    });

    test('รอบถัดไปได้เลขลำดับ 2 และ token ของรอบก่อนไม่ถูกนับซ้ำ', async () => {
        const { ws, calls } = await live();
        for (const usage of [{ promptTokenCount: 100, responseTokenCount: 10 }, { promptTokenCount: 130, responseTokenCount: 12 }]) {
            ws().receive({ usageMetadata: usage });
            ws().receive({ serverContent: { turnComplete: true } });
            await new Promise((r) => setImmediate(r));
        }
        assert.deepEqual(calls.report.map((c) => c.turns.map((t) => t.seq)), [[1], [2]]);
        assert.equal(calls.report[1].turns[0].prompt, 130);
    });

    test('จบรอบที่ไม่มี usage ไม่ส่งอะไรไปหักเครดิต', async () => {
        const { ws, calls } = await live();
        ws().receive({ serverContent: { turnComplete: true } });
        await new Promise((r) => setImmediate(r));
        assert.equal(calls.report.length, 0);
    });

    test('คำบรรยาย: ที่นักเรียนพูดต่อกันเป็นฟองเดียว พอ AI เริ่มตอบฟองนักเรียนปิด; จบรอบฟองของ AI ปิด', async () => {
        const { ws, events } = await live();
        ws().receive({ serverContent: { inputTranscription: { text: 'ช่วยอธิบาย' } } });
        ws().receive({ serverContent: { inputTranscription: { text: 'เรื่องปฏิกิริยา' } } });
        ws().receive({ serverContent: { outputTranscription: { text: 'ได้เลย' } } });
        ws().receive({ serverContent: { outputTranscription: { text: 'ครับ' } } });
        ws().receive({ serverContent: { turnComplete: true } });
        const list = captions(events);
        assert.deepEqual(list.map((c) => [c.role, c.text, c.final]), [
            ['user', 'ช่วยอธิบาย', false], ['user', 'ช่วยอธิบายเรื่องปฏิกิริยา', false],
            ['user', 'ช่วยอธิบายเรื่องปฏิกิริยา', true],
            ['ai', 'ได้เลย', false], ['ai', 'ได้เลยครับ', false], ['ai', 'ได้เลยครับ', true]
        ]);
        assert.equal(new Set(list.filter((c) => c.role === 'user').map((c) => c.id)).size, 1, 'ฟองเดียวกัน id เดียวกัน');
    });

    test('นักเรียนพูดแล้วเงียบ AI ยังไม่ตอบ → "กำลังคิด" หลัง 1.2 วินาที', async () => {
        const { tutor, ws, timers } = await live();
        ws().receive({ serverContent: { inputTranscription: { text: 'สวัสดี' } } });
        assert.equal(tutor.state, 'listening');
        assert.ok(timers.hasTimeout(THINKING_AFTER_MS));
        timers.runTimeouts(THINKING_AFTER_MS);
        assert.equal(tutor.state, 'thinking');
        ws().receive({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm', data: 'QQ==' } }] } } });
        assert.equal(tutor.state, 'speaking');
    });

    test('นักเรียนขัดจังหวะ (interrupted): หยุดเสียงที่ค้างเล่นทันที ไม่นับ token ของรอบที่ถูกขัด', async () => {
        const { tutor, media, ws, calls } = await live();
        ws().receive({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm', data: 'QQ==' } }] } } });
        ws().receive({ usageMetadata: { promptTokenCount: 50, responseTokenCount: 5 } });
        ws().receive({ serverContent: { interrupted: true } });
        await new Promise((r) => setImmediate(r));
        assert.ok(media.log.includes('stopPlayback'));
        assert.equal(tutor.state, 'listening');
        assert.equal(calls.report.length, 0);
    });

    test('พิมพ์ข้อความ: ส่งเป็นข้อความ แสดงฟองของนักเรียนทันที หยุดเสียงที่ค้าง; ก่อน setupComplete ส่งไม่ได้', async () => {
        const early = setup();
        await early.tutor.start({});
        assert.equal(early.tutor.sendText('x'), false);
        const { tutor, media, ws, events } = await live();
        assert.equal(tutor.sendText('  ข้อนี้ทำยังไง  '), true);
        assert.deepEqual(ws().sent.at(-1), { realtimeInput: { text: 'ข้อนี้ทำยังไง' } });
        assert.deepEqual(captions(events).at(-1), { type: 'caption', id: captions(events).at(-1).id, role: 'user', text: 'ข้อนี้ทำยังไง', final: true, typed: true });
        assert.ok(media.log.includes('stopPlayback'));
        assert.equal(tutor.state, 'thinking');
        assert.equal(tutor.sendText('   '), false);
    });

    test('ส่งรูป: ส่งภาพแล้วตามด้วยข้อความบอก AI ให้ดู (ภาพเงียบ ๆ อย่างเดียว AI ไม่ตอบ)', async () => {
        const { tutor, ws, events } = await live();
        assert.equal(tutor.sendImage('JPEGDATA', { name: 'โจทย์\nข้อ 3.jpg' }), true);
        const [image, text] = ws().sent.slice(-2);
        assert.deepEqual(image, { realtimeInput: { video: { data: 'JPEGDATA', mimeType: 'image/jpeg' } } });
        assert.ok(text.realtimeInput.text.includes('โจทย์ ข้อ 3.jpg'), 'ชื่อไฟล์ไม่พาบรรทัดใหม่เข้ามา');
        assert.ok(events.some((e) => e.type === 'attachment' && e.kind === 'image'));
    });

    test('ส่งข้อความจากไฟล์ (txt/pdf)', async () => {
        const { tutor, ws, events } = await live();
        assert.equal(tutor.sendAttachmentText('note.txt', 'นักเรียนแนบไฟล์ ...'), true);
        assert.equal(ws().sent.at(-1).realtimeInput.text, 'นักเรียนแนบไฟล์ ...');
        assert.ok(events.some((e) => e.type === 'attachment' && e.kind === 'text' && e.name === 'note.txt'));
    });
});

describe('กล้อง', () => {
    const frame = (value, tag) => ({ data: tag, thumb: new Uint8Array(256).fill(value) });

    test('เปิดกล้อง: ส่งเฟรมแรกทันที; ภาพนิ่งไม่ส่งซ้ำ; ภาพเปลี่ยนจึงส่ง; ภาพนิ่งนานเกินกำหนดส่งซ้ำ 1 ครั้ง', async () => {
        let now = 1000000;
        const media = fakeMedia({ frames: [frame(100, 'F1'), frame(101, 'F2'), frame(200, 'F3'), frame(200, 'F4'), frame(200, 'F5')] });
        const ctx = setup({ media });
        ctx.tutor.now = () => now;
        await ctx.tutor.start({});
        ctx.ws().open(); ctx.ws().receive({ setupComplete: {} });
        await new Promise((r) => setImmediate(r));
        await ctx.tutor.setCamera(true, 'environment');
        assert.ok(media.log.includes('startCamera:environment'));
        const frames = () => ctx.ws().sent.filter((m) => m.realtimeInput?.video).map((m) => m.realtimeInput.video.data);
        assert.deepEqual(frames(), ['F1']);
        now += FRAME_INTERVAL_MS; ctx.timers.tick(FRAME_INTERVAL_MS);
        assert.deepEqual(frames(), ['F1'], 'แทบไม่เปลี่ยน ไม่ส่ง');
        now += FRAME_INTERVAL_MS; ctx.timers.tick(FRAME_INTERVAL_MS);
        assert.deepEqual(frames(), ['F1', 'F3'], 'เปลี่ยนมาก ส่ง');
        now += FRAME_INTERVAL_MS; ctx.timers.tick(FRAME_INTERVAL_MS);
        assert.deepEqual(frames(), ['F1', 'F3'], 'นิ่งแล้ว ไม่ส่งซ้ำ');
        now += FRAME_REFRESH_MS; ctx.timers.tick(FRAME_INTERVAL_MS);
        assert.deepEqual(frames(), ['F1', 'F3', 'F5'], 'นิ่งนานแล้ว ส่งซ้ำ 1 ครั้ง');
        await ctx.tutor.setCamera(false);
        assert.ok(media.log.includes('stopCamera'));
        assert.equal(ctx.timers.intervalCount(), 1, 'ตัวจับเวลาเฟรมถูกเอาออก (เหลือแต่ heartbeat)');
    });

    test('กล้องยังไม่พร้อม (captureFrame ได้ null) ไม่ส่งอะไร; ก่อนต่อเสร็จก็ไม่ส่ง', async () => {
        const ctx = await live({ media: fakeMedia({ frames: [] }) });
        await ctx.tutor.setCamera(true);
        assert.equal(ctx.ws().sent.filter((m) => m.realtimeInput?.video).length, 0);
        const early = setup({ media: fakeMedia({ frames: [frame(1, 'X')] }) });
        await early.tutor.start({});
        assert.equal(early.tutor.pushFrame(), false);
    });

    test('ไม่อนุญาตกล้อง: setCamera โยนข้อผิดพลาดให้หน้าแจ้ง และสถานะกล้องไม่เปลี่ยน', async () => {
        const media = fakeMedia();
        media.startCamera = async () => { throw new Error('denied'); };
        const ctx = await live({ media });
        await assert.rejects(ctx.tutor.setCamera(true), /denied/);
        assert.equal(ctx.tutor.cameraOn, false);
    });
});

describe('การเชื่อมต่อหลุด / ต่อใหม่ / หมดเวลา', () => {
    test('หลุดกลางทางและมี handle → ต่อใหม่ด้วย handle เดิม (ไม่เสียบทสนทนา) และไม่เปิดไมค์ซ้ำ', async () => {
        const { tutor, media, ws, timers, events } = await live();
        ws().receive({ sessionResumptionUpdate: { newHandle: 'H1', resumable: true } });
        const first = ws();
        first.drop(1006);
        assert.equal(tutor.state, 'reconnecting');
        timers.runTimeouts(600);
        const second = ws();
        assert.notEqual(second, first);
        second.open();
        assert.deepEqual(second.sent[0].setup.sessionResumption, { handle: 'H1' });
        second.receive({ setupComplete: {} });
        await new Promise((r) => setImmediate(r));
        assert.equal(tutor.state, 'listening');
        assert.equal(media.log.filter((x) => x === 'startMic').length, 1);
        assert.ok(!events.some((e) => e.type === 'error'));
    });

    test('หลุดแล้วไม่มี handle → แจ้งข้อผิดพลาดและจบเซสชัน (เหตุผล error)', async () => {
        const { tutor, ws, calls, events } = await live();
        ws().drop(1011, 'internal');
        await tutor.endPromise;
        assert.ok(events.some((e) => e.type === 'error'));
        assert.equal(calls.end[0].body.reason, 'error');
        assert.equal(tutor.state, 'ended');
    });

    test(`ต่อใหม่ไม่สำเร็จเกิน ${MAX_RECONNECTS} ครั้ง → จบ`, async () => {
        const { tutor, ws, timers, calls } = await live();
        ws().receive({ sessionResumptionUpdate: { newHandle: 'H1', resumable: true } });
        for (let i = 0; i < MAX_RECONNECTS; i++) { ws().drop(1006); timers.runTimeouts(600); }
        ws().drop(1006);
        await tutor.endPromise;
        assert.equal(calls.end.length, 1);
        assert.equal(tutor.state, 'ended');
    });

    test('ต่อครั้งแรกไม่ติด (ปิดก่อน setupComplete) → ข้อความมีรหัส และไม่ถูกหักเครดิต (เหตุผล connect_failed)', async () => {
        const { tutor, ws, calls, events } = setup();
        await tutor.start({});
        ws().open();
        ws().drop(1008, 'Request contains an invalid argument');
        await tutor.endPromise;
        const err = events.find((e) => e.type === 'error');
        assert.match(err.message, /1008/);
        assert.equal(calls.end[0].body.reason, 'connect_failed');
        assert.deepEqual(calls.end[0].body.turns, []);
    });

    test('ต่อนานเกิน 12 วินาทีโดยไม่ได้ setupComplete → ล้มเหลว', async () => {
        const { tutor, timers, calls, events } = setup();
        await tutor.start({});
        assert.ok(timers.hasTimeout(CONNECT_TIMEOUT_MS));
        timers.runTimeouts(CONNECT_TIMEOUT_MS);
        await tutor.endPromise;
        assert.equal(events.find((e) => e.type === 'error').code, 'connect_failed');
        assert.equal(calls.end[0].body.reason, 'connect_failed');
    });
});

describe('จบ', () => {
    test('จบเอง: ปิดไมค์/กล้อง/ลำโพง/WebSocket ส่ง token ที่ค้างไปพร้อมจบ แล้วแจ้งสรุป', async () => {
        const { tutor, media, ws, calls, events } = await live();
        ws().receive({ usageMetadata: { promptTokenCount: 300, responseTokenCount: 30 } }); // รอบที่ยังไม่ทันจบ
        const summary = await tutor.end('client');
        assert.deepEqual(media.log.filter((x) => ['stopMic', 'stopCamera', 'stopPlayback', 'close'].includes(x)).sort(), ['close', 'stopCamera', 'stopMic', 'stopPlayback']);
        assert.deepEqual(ws().closed, { code: 1000, reason: 'client end' });
        assert.deepEqual(calls.end[0].body, { turns: [{ seq: 1, prompt: 300, response: 30, thoughts: 0 }], reason: 'client' });
        assert.equal(summary.creditsCharged, 77);
        assert.equal(tutor.state, 'ended');
        const ended = events.find((e) => e.type === 'ended');
        assert.equal(ended.summary.creditsCharged, 77);
        assert.equal(events.filter((e) => e.type === 'credits').at(-1).final, true);
    });

    test('จบซ้ำไม่ทำซ้ำ (เรียกสองครั้ง แจ้ง Backend ครั้งเดียว)', async () => {
        const { tutor, calls } = await live();
        await Promise.all([tutor.end('client'), tutor.end('client')]);
        await tutor.end('client');
        assert.equal(calls.end.length, 1);
    });

    test('pagehide: จบแบบ keepalive เพื่อให้คำขอยังออกไปได้ตอนปิดหน้า', async () => {
        const { tutor, calls } = await live();
        await tutor.end('client', { keepalive: true });
        assert.deepEqual(calls.end[0].opts, { keepalive: true });
    });

    test('Backend บอกให้หยุด (เครดิตหมด) → แจ้งผู้ใช้ด้วยข้อความไทย แล้วจบด้วยเหตุผล credits', async () => {
        const api = { reportTutor: async () => ({ ackSeq: 1, charged: 100, stop: true, reason: 'credits', credits: { available: 20 }, session: { creditsCharged: 4000 } }) };
        const { tutor, ws, calls, events } = await live({ api });
        ws().receive({ usageMetadata: { promptTokenCount: 5000, responseTokenCount: 500 } });
        ws().receive({ serverContent: { turnComplete: true } });
        await new Promise((r) => setImmediate(r));
        await tutor.endPromise;
        const notice = events.find((e) => e.type === 'notice');
        assert.match(notice.message, /เครดิต/);
        assert.equal(calls.end[0].body.reason, 'credits');
        assert.equal(tutor.state, 'ended');
    });

    test('จบแม้ Backend ล้มเหลว: หน้ายังจบได้ (ไม่ค้าง) แต่ไม่มีสรุป', async () => {
        const { tutor, events } = await live({ api: { endTutor: async () => { throw new Error('net'); } } });
        const summary = await tutor.end('client');
        assert.equal(summary, null);
        assert.equal(tutor.state, 'ended');
        assert.equal(events.find((e) => e.type === 'ended').summary, null);
    });

    test('ข้อความจาก WebSocket ที่เป็น ArrayBuffer ก็อ่านได้ (เซิร์ฟเวอร์ Google ส่ง JSON เป็นเฟรมไบนารี)', async () => {
        const { tutor, ws } = await live();
        ws().onmessage({ data: new TextEncoder().encode(JSON.stringify({ serverContent: { outputTranscription: { text: 'หวัดดี' } } })).buffer });
        assert.equal(tutor.bubbles.ai.text, 'หวัดดี');
        ws().onmessage({ data: new Uint8Array([0xff, 0xfe, 0x00]).buffer }); // ขยะ: ไม่ throw
    });
});
