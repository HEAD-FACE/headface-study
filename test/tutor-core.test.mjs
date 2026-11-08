// AI Tutor: ส่วนที่ไม่พึ่งเบราว์เซอร์ — แปลงเสียง PCM, ข้อความของ Gemini Live, ตัวนับ token ที่ส่งไปหักเครดิต, ไฟล์ที่แนบ
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    INPUT_RATE, OUTPUT_RATE, floatToPcm16, pcm16ToFloat, resampleLinear, pcm16ToBase64, base64ToPcm16, bytesToBase64, base64ToBytes, level, micChunkToBase64
} from '../js/tutor-pcm.js';
import {
    setupMessage, audioMessage, imageMessage, textMessage, audioEndMessage, normalizeUsage, durationMs, parseServerMessage, messageText
} from '../js/tutor-protocol.js';
import { createUsageTracker } from '../js/tutor-usage.js';
import { classifyFile, clipText, attachmentPrompt, fitSize, sceneChanged, FILE_LIMITS } from '../js/tutor-files.js';

describe('เสียง PCM', () => {
    test('Gemini รับเข้า 16 kHz ส่งออก 24 kHz', () => {
        assert.equal(INPUT_RATE, 16000);
        assert.equal(OUTPUT_RATE, 24000);
    });

    test('Float32 → Int16: ขอบช่วงถูกต้อง ค่าเกินถูกตัด ไม่วนกลับ', () => {
        const pcm = floatToPcm16(Float32Array.from([0, 1, -1, 2, -2, 0.5, NaN]));
        assert.deepEqual(Array.from(pcm), [0, 32767, -32768, 32767, -32768, 16384, 0]);
    });

    test('Int16 → Float32 → Int16 กลับมาเท่าเดิม', () => {
        const original = Int16Array.from([0, 1, -1, 12345, -12345, 32767, -32768]);
        assert.deepEqual(Array.from(floatToPcm16(pcm16ToFloat(original))), Array.from(original));
    });

    test('base64 ไปกลับ: ข้อมูลเท่าเดิม แม้ก้อนใหญ่กว่าชิ้นที่ตัดส่ง', () => {
        const big = new Uint8Array(100000).map((_, i) => i % 251);
        assert.deepEqual(base64ToBytes(bytesToBase64(big)), big);
        const pcm = Int16Array.from({ length: 5000 }, (_, i) => (i * 37) % 30000 - 15000);
        assert.deepEqual(base64ToPcm16(pcm16ToBase64(pcm)), pcm);
    });

    test('PCM เป็น little-endian: 0x0102 → byte 02 01', () => {
        assert.equal(pcm16ToBase64(Int16Array.from([0x0102])), Buffer.from([0x02, 0x01]).toString('base64'));
    });

    test('base64 ที่ byte เป็นเลขคี่: ทิ้ง byte ที่ไม่ครบตัวอย่าง ไม่ throw', () => {
        assert.equal(base64ToPcm16(Buffer.from([1, 0, 2]).toString('base64')).length, 1);
        assert.equal(base64ToPcm16('').length, 0);
    });

    test('ปรับอัตราสุ่ม: 48k → 16k ได้ความยาว 1/3 และไม่เปลี่ยนระดับของเสียงคงที่', () => {
        const input = new Float32Array(4800).fill(0.5);
        const out = resampleLinear(input, 48000, 16000);
        assert.equal(out.length, 1600);
        assert.ok(out.every((v) => Math.abs(v - 0.5) < 1e-6));
    });

    test('ปรับอัตราสุ่ม: 16k → 24k เพิ่มความยาว 1.5 เท่า คลื่นไซน์ยังเรียบ', () => {
        const input = Float32Array.from({ length: 160 }, (_, i) => Math.sin(i / 10));
        const out = resampleLinear(input, 16000, 24000);
        assert.equal(out.length, 240);
        for (let i = 1; i < out.length; i++) assert.ok(Math.abs(out[i] - out[i - 1]) < 0.12, `กระโดดที่ ${i}`);
    });

    test('อัตราเท่ากัน = สำเนาเดิม; อัตราผิดโยน RangeError', () => {
        const input = Float32Array.from([0.1, 0.2]);
        assert.deepEqual(resampleLinear(input, 16000, 16000), input);
        assert.throws(() => resampleLinear(input, 0, 16000), RangeError);
        assert.equal(resampleLinear(new Float32Array(0), 48000, 16000).length, 0);
    });

    test('ระดับเสียง: เงียบ = 0, ดัง = ไม่เกิน 1', () => {
        assert.equal(level(new Float32Array(100)), 0);
        assert.equal(level(null), 0);
        assert.equal(level(new Float32Array(100).fill(1)), 1);
        assert.ok(level(new Float32Array(100).fill(0.05)) > 0);
    });

    test('เสียงไมค์ 48k → base64 ของ PCM 16k พร้อมส่ง', () => {
        const b64 = micChunkToBase64(new Float32Array(4800).fill(0.25), 48000);
        const pcm = base64ToPcm16(b64);
        assert.equal(pcm.length, 1600);
        assert.ok(pcm.every((v) => Math.abs(v - 8192) <= 1));
    });
});

describe('ข้อความของ Gemini Live', () => {
    test('ข้อความที่ส่งไปมีรูปแบบตามเอกสาร', () => {
        assert.deepEqual(audioMessage('AAA'), { realtimeInput: { audio: { data: 'AAA', mimeType: 'audio/pcm;rate=16000' } } });
        assert.deepEqual(imageMessage('BBB'), { realtimeInput: { video: { data: 'BBB', mimeType: 'image/jpeg' } } });
        assert.deepEqual(textMessage('สวัสดี'), { realtimeInput: { text: 'สวัสดี' } });
        assert.deepEqual(audioEndMessage(), { realtimeInput: { audioStreamEnd: true } });
    });

    test('setup: ไม่แก้ค่าที่ Backend ส่งมา; handle ใส่ในการต่อใหม่เท่านั้น', () => {
        const setup = { model: 'models/gemini-3.8-live', sessionResumption: {} };
        assert.deepEqual(setupMessage(setup), { setup });
        assert.deepEqual(setupMessage(setup, 'h1').setup.sessionResumption, { handle: 'h1' });
        assert.deepEqual(setup.sessionResumption, {}, 'ต้นฉบับไม่ถูกแก้');
    });

    test('usageMetadata → token ของรอบ: prompt/response/thoughts', () => {
        assert.deepEqual(normalizeUsage({ promptTokenCount: 1000, responseTokenCount: 200, thoughtsTokenCount: 50, totalTokenCount: 1250 }), { prompt: 1000, response: 200, thoughts: 50 });
        assert.deepEqual(normalizeUsage({ promptTokenCount: 10, toolUsePromptTokenCount: 5, responseTokenCount: 1 }), { prompt: 15, response: 1, thoughts: 0 });
        assert.deepEqual(normalizeUsage({ promptTokenCount: 100, responseTokensDetails: [{ modality: 'AUDIO', tokenCount: 40 }, { modality: 'TEXT', tokenCount: 10 }] }), { prompt: 100, response: 50, thoughts: 0 });
        assert.deepEqual(normalizeUsage({ promptTokenCount: 100, totalTokenCount: 180 }), { prompt: 100, response: 80, thoughts: 0 });
        assert.equal(normalizeUsage({}), null);
        assert.equal(normalizeUsage(null), null);
        assert.deepEqual(normalizeUsage({ promptTokenCount: -5, responseTokenCount: 'abc', thoughtsTokenCount: 3 }), { prompt: 0, response: 0, thoughts: 3 });
    });

    test('ระยะเวลา "30s" และ {seconds,nanos}', () => {
        assert.equal(durationMs('30s'), 30000);
        assert.equal(durationMs('1.5s'), 1500);
        assert.equal(durationMs({ seconds: 2, nanos: 500000000 }), 2500);
        assert.equal(durationMs('abc'), null);
        assert.equal(durationMs(undefined), null);
    });

    test('parse: setupComplete', () => {
        assert.deepEqual(parseServerMessage('{"setupComplete":{}}'), [{ type: 'setupComplete' }]);
    });

    test('parse: เสียงของ AI + คำบรรยาย + จบรอบ + usage ในข้อความเดียว', () => {
        const events = parseServerMessage({
            serverContent: {
                modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: 'QUJD' } }, { text: 'ข้อความ', thought: true }] },
                outputTranscription: { text: 'สวัสดีครับ' },
                inputTranscription: { text: 'ทักทาย' },
                turnComplete: true
            },
            usageMetadata: { promptTokenCount: 30, responseTokenCount: 12 }
        });
        assert.deepEqual(events.map((e) => e.type), ['audio', 'inputText', 'outputText', 'turnComplete', 'usage']);
        assert.equal(events[0].data, 'QUJD');
        assert.deepEqual(events.at(-1).usage, { prompt: 30, response: 12, thoughts: 0 });
    });

    test('parse: interrupted, goAway, sessionResumptionUpdate', () => {
        assert.deepEqual(parseServerMessage({ serverContent: { interrupted: true } }), [{ type: 'interrupted' }]);
        assert.deepEqual(parseServerMessage({ goAway: { timeLeft: '20s' } }), [{ type: 'goAway', timeLeftMs: 20000 }]);
        assert.deepEqual(parseServerMessage({ sessionResumptionUpdate: { newHandle: 'abc', resumable: true } }), [{ type: 'resumption', handle: 'abc', resumable: true }]);
        assert.deepEqual(parseServerMessage({ sessionResumptionUpdate: { resumable: false } }), [{ type: 'resumption', handle: null, resumable: false }]);
    });

    test('parse: ข้อความเสีย/ไม่รู้จัก/ส่วนที่ไม่ใช่เสียง ไม่ throw และไม่เล่นเป็นเสียง', () => {
        assert.deepEqual(parseServerMessage('not json'), []);
        assert.deepEqual(parseServerMessage(null), []);
        assert.deepEqual(parseServerMessage(42), []);
        assert.deepEqual(parseServerMessage({ somethingNew: 1 }), []);
        assert.deepEqual(parseServerMessage({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'image/png', data: 'x' } }] } } }), []);
    });

    test('messageText รับ string, ArrayBuffer, Blob', async () => {
        assert.equal(await messageText('{"a":1}'), '{"a":1}');
        assert.equal(await messageText(new TextEncoder().encode('ไทย').buffer), 'ไทย');
        assert.equal(await messageText(new Blob(['xyz'])), 'xyz');
        assert.equal(await messageText(undefined), '');
    });
});

describe('ตัวนับ token ที่ส่งไปหักเครดิต', () => {
    const manual = () => {
        const calls = [];
        return { calls, setTimer: (fn, ms) => { calls.push({ fn, ms }); return calls.length; }, clearTimer: (id) => { calls[id - 1].cleared = true; } };
    };

    test('แต่ละรอบมีเลขลำดับเพิ่มขึ้น ส่งแล้วถูกเอาออกตาม ackSeq', async () => {
        const sent = [];
        const t = createUsageTracker({ report: async (body) => { sent.push(body.turns); return { ackSeq: body.turns.at(-1).seq, charged: 10, credits: { available: 900 }, session: { creditsCharged: 10 } }; } });
        t.record({ prompt: 10, response: 5, thoughts: 0 });
        t.record({ prompt: 20, response: 6, thoughts: 1 });
        await t.flush();
        assert.deepEqual(sent[0].map((x) => x.seq), [1, 2]);
        assert.deepEqual(t.pendingTurns(), []);
        assert.equal(t.state.credits.available, 900);
        assert.equal(t.state.sessionCharged, 10);
    });

    test('ส่งไม่สำเร็จ: เก็บไว้ส่งใหม่ รอบเดิมเลขลำดับเดิม ไม่หายและไม่ซ้ำ', async () => {
        let fail = true;
        const bodies = [];
        const t = createUsageTracker({ report: async (body) => { bodies.push(JSON.stringify(body.turns)); if (fail) throw new Error('net'); return { ackSeq: body.turns.at(-1).seq }; } });
        t.record({ prompt: 5, response: 5, thoughts: 0 });
        await t.flush();
        assert.equal(t.pendingTurns().length, 1);
        assert.equal(t.state.failures, 1);
        fail = false;
        t.record({ prompt: 6, response: 6, thoughts: 0 });
        await t.flush();
        assert.deepEqual(JSON.parse(bodies.at(-1)).map((x) => x.seq), [1, 2]);
        assert.equal(t.pendingTurns().length, 0);
        assert.equal(t.state.failures, 0);
    });

    test('ส่งไม่ถึงเซิร์ฟเวอร์ติดกัน 3 ครั้ง → หยุดเองด้วย offline (ไม่คุยต่อโดยไม่คิดเงิน)', async () => {
        const stops = [];
        const t = createUsageTracker({ report: async () => { throw new Error('net'); }, onStop: (r) => stops.push(r) });
        await t.flush(); await t.flush();
        assert.deepEqual(stops, []);
        await t.flush();
        assert.deepEqual(stops, ['offline']);
        await t.flush();
        assert.deepEqual(stops, ['offline'], 'แจ้งครั้งเดียว');
    });

    test('Backend ตอบ stop → เรียก onStop ด้วยเหตุผล และหยุดรับรอบใหม่', async () => {
        const stops = [];
        const t = createUsageTracker({ report: async () => ({ ackSeq: 0, stop: true, reason: 'credits', credits: { available: 10 } }), onStop: (r) => stops.push(r) });
        await t.flush();
        assert.deepEqual(stops, ['credits']);
        assert.equal(t.record({ prompt: 1, response: 1, thoughts: 0 }), null);
    });

    test('ส่งซ้อนกันไม่ได้: เรียก flush สองครั้งพร้อมกันส่งครั้งเดียว', async () => {
        let n = 0;
        const t = createUsageTracker({ report: async () => { n++; await new Promise((r) => setTimeout(r, 5)); return { ackSeq: 0 }; } });
        await Promise.all([t.flush(), t.flush()]);
        assert.equal(n, 1);
    });

    test('มีรอบค้างเกินเพดานต่อครั้ง (20) ส่งต่อทันทีจนหมด', async () => {
        const sizes = [];
        const t = createUsageTracker({ report: async (body) => { sizes.push(body.turns.length); return { ackSeq: body.turns.at(-1).seq }; } });
        for (let i = 0; i < 45; i++) t.record({ prompt: 1, response: 1, thoughts: 0 });
        await t.flush();
        assert.deepEqual(sizes, [20, 20, 5]);
    });

    test('heartbeat: start ตั้งเวลา halt เคลียร์ และ start ซ้ำไม่ตั้งเพิ่ม', () => {
        const m = manual();
        const t = createUsageTracker({ report: async () => ({ ackSeq: 0 }), heartbeatMs: 15000, setTimer: m.setTimer, clearTimer: m.clearTimer });
        t.start(); t.start();
        assert.equal(m.calls.length, 1);
        assert.equal(m.calls[0].ms, 15000);
        t.halt();
        assert.equal(m.calls[0].cleared, true);
    });
});

describe('ไฟล์ที่แนบ', () => {
    test('แยกชนิด: รูป / PDF / ข้อความ / อย่างอื่น', () => {
        assert.equal(classifyFile({ name: 'a.jpg', type: 'image/jpeg', size: 100 }).kind, 'image');
        assert.equal(classifyFile({ name: 'IMG_1.HEIC', type: '', size: 100 }).kind, 'image');
        assert.equal(classifyFile({ name: 'x.pdf', type: 'application/pdf', size: 100 }).kind, 'pdf');
        assert.equal(classifyFile({ name: 'x.PDF', type: '', size: 100 }).kind, 'pdf');
        assert.equal(classifyFile({ name: 'x.txt', type: 'text/plain', size: 100 }).kind, 'text');
        assert.equal(classifyFile({ name: 'x.csv', type: '', size: 100 }).kind, 'text');
        assert.equal(classifyFile({ name: 'x.docx', type: 'application/vnd.openxmlformats', size: 100 }).kind, 'unsupported');
        assert.equal(classifyFile({ name: 'x.exe', type: 'application/x-msdownload', size: 100 }).kind, 'unsupported');
        assert.ok(classifyFile({ name: 'x.docx', type: '', size: 1 }).reason);
    });

    test('ไฟล์ใหญ่เกินกำหนดถูกปฏิเสธพร้อมเหตุผล', () => {
        assert.equal(classifyFile({ name: 'a.png', type: 'image/png', size: FILE_LIMITS.imageBytes + 1 }).kind, 'unsupported');
        assert.equal(classifyFile({ name: 'a.pdf', type: 'application/pdf', size: FILE_LIMITS.pdfBytes + 1 }).kind, 'unsupported');
        assert.equal(classifyFile({ name: 'a.txt', type: 'text/plain', size: FILE_LIMITS.textBytes + 1 }).kind, 'unsupported');
        assert.equal(classifyFile({ name: 'a.txt', type: 'text/plain', size: FILE_LIMITS.textBytes }).kind, 'text');
    });

    test('ตัดข้อความ: ไม่เกินกำหนด ทำความสะอาดบรรทัดว่าง ไม่ตัดกลางอักขระคู่', () => {
        assert.deepEqual(clipText('  a\r\n\r\n\r\n\r\nb  ', 100), { text: 'a\n\nb', clipped: false });
        const long = clipText('ก'.repeat(50), 10);
        assert.equal(long.text.length, 10);
        assert.equal(long.clipped, true);
        const emoji = clipText('😀😀😀', 3); // 😀 = 2 หน่วย: ตัดที่ 3 จะผ่ากลางคู่
        assert.equal(emoji.text, '😀');
        assert.equal(clipText(undefined).text, '');
    });

    test('ข้อความนำของไฟล์ไม่พาบรรทัดใหม่จากชื่อไฟล์เข้ามา', () => {
        const prompt = attachmentPrompt('ชื่อ\nปลอม.txt', 'เนื้อหา', true);
        assert.ok(prompt.startsWith('นักเรียนแนบไฟล์ "ชื่อ ปลอม.txt"'));
        assert.ok(prompt.includes('(ตัดมาเฉพาะช่วงต้น)') && prompt.endsWith('เนื้อหา'));
        assert.ok(!attachmentPrompt('a', 'b', false).includes('ตัดมา'));
    });

    test('ย่อภาพให้ด้านยาวไม่เกินกำหนด ไม่ขยายภาพเล็ก รักษาสัดส่วน', () => {
        assert.deepEqual(fitSize(4000, 2000, 1000), { width: 1000, height: 500 });
        assert.deepEqual(fitSize(800, 600, 1280), { width: 800, height: 600 });
        assert.deepEqual(fitSize(1, 5000, 100), { width: 1, height: 100 });
    });

    test('ภาพกล้องเปลี่ยนหรือไม่: นิ่งไม่ส่งซ้ำ เปลี่ยนจริงส่ง', () => {
        const still = new Uint8Array(256).fill(100);
        assert.equal(sceneChanged(null, still), true, 'เฟรมแรกต้องส่ง');
        assert.equal(sceneChanged(still, new Uint8Array(256).fill(101)), false, 'แสงเปลี่ยนนิดเดียว');
        assert.equal(sceneChanged(still, new Uint8Array(256).fill(160)), true);
        assert.equal(sceneChanged(still, new Uint8Array(10)), true, 'ขนาดไม่ตรง = ถือว่าเปลี่ยน');
    });
});
