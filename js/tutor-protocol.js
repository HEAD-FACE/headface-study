/**
 * js/tutor-protocol.js — ข้อความของ Gemini Live API (WebSocket, JSON) ไม่พึ่งเบราว์เซอร์ เทสต์ใน Node ได้
 *
 * ส่งไป:  { setup } ครั้งแรก แล้ว { realtimeInput: { audio | video | text | audioStreamEnd } }
 * รับมา:  setupComplete · serverContent (เสียงของ AI, คำบรรยายสองฝั่ง, interrupted, turnComplete) · usageMetadata · goAway · sessionResumptionUpdate
 * ชื่อฟิลด์ตรวจกับเอกสาร Google (gemini-3.8-live) เมื่อ 2026-11-08 — ยังไม่ได้ลองกับเซิร์ฟเวอร์จริง: ถ้า Google เปลี่ยนชื่อ แก้ที่ไฟล์นี้ที่เดียว
 */
import { INPUT_MIME } from './tutor-pcm.js';

// ───────────── ข้อความที่ส่งไป ─────────────

/** @param {object} setup  ค่าที่ Backend ส่งมา (model, generationConfig, systemInstruction, ...); handle = ต่อบทสนทนาเดิมหลังหลุด */
export function setupMessage(setup, handle = null) {
    const copy = { ...setup };
    if (handle) copy.sessionResumption = { handle };
    return { setup: copy };
}

export const audioMessage = (b64) => ({ realtimeInput: { audio: { data: b64, mimeType: INPUT_MIME } } });
export const imageMessage = (b64, mimeType = 'image/jpeg') => ({ realtimeInput: { video: { data: b64, mimeType } } });
export const textMessage = (text) => ({ realtimeInput: { text: String(text) } });
/** ไมค์ปิด: บอกว่าเสียงชุดนี้จบแล้ว (ให้โมเดลประมวลผลส่วนที่ค้าง) */
export const audioEndMessage = () => ({ realtimeInput: { audioStreamEnd: true } });

// ───────────── ข้อความที่รับมา ─────────────

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/**
 * usageMetadata ของ Google → จำนวน token ของ "รอบ" นั้น { prompt, response, thoughts }
 *  prompt   = promptTokenCount (+ toolUsePromptTokenCount) — Gemini Live นับบริบททั้งก้อนใหม่ทุกรอบ ตามที่ Google คิดเงินจริง
 *  response = responseTokenCount (ถ้าไม่มี ใช้ผลรวมของ responseTokensDetails หรือ total − prompt − thoughts)
 *  thoughts = thoughtsTokenCount (คิดเป็น token ขาออก)
 */
export function normalizeUsage(meta) {
    if (!meta || typeof meta !== 'object') return null;
    const prompt = num(meta.promptTokenCount) + num(meta.toolUsePromptTokenCount);
    const thoughts = num(meta.thoughtsTokenCount);
    let response = num(meta.responseTokenCount);
    if (!response && Array.isArray(meta.responseTokensDetails)) response = meta.responseTokensDetails.reduce((sum, d) => sum + num(d?.tokenCount), 0);
    if (!response && num(meta.totalTokenCount) > prompt + thoughts) response = num(meta.totalTokenCount) - prompt - thoughts;
    if (prompt + response + thoughts === 0) return null;
    return { prompt, response, thoughts };
}

/** "30s" / "1.5s" / { seconds, nanos } → มิลลิวินาที */
export function durationMs(value) {
    if (typeof value === 'string') {
        const m = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
        return m ? Math.round(Number(m[1]) * 1000) : null;
    }
    if (value && typeof value === 'object') return Math.round(num(value.seconds) * 1000 + num(value.nanos) / 1e6);
    return null;
}

/** ข้อความดิบ (string หรือ object ที่ parse แล้ว) → รายการเหตุการณ์ที่หน้าใช้ ข้อความที่อ่านไม่ออกคืน [] ไม่ throw */
export function parseServerMessage(raw) {
    let msg = raw;
    if (typeof raw === 'string') {
        try { msg = JSON.parse(raw); } catch (_) { return []; }
    }
    if (!msg || typeof msg !== 'object') return [];
    const events = [];

    if (msg.setupComplete !== undefined) events.push({ type: 'setupComplete' });

    const sc = msg.serverContent;
    if (sc && typeof sc === 'object') {
        for (const part of sc.modelTurn?.parts || []) {
            if (part?.thought) continue; // ความคิดของโมเดล ไม่แสดง ไม่เล่น
            const inline = part?.inlineData;
            if (inline && typeof inline.data === 'string' && /^audio\//i.test(String(inline.mimeType || 'audio/pcm'))) {
                events.push({ type: 'audio', data: inline.data, mimeType: inline.mimeType || 'audio/pcm;rate=24000' });
            }
        }
        if (sc.inputTranscription && typeof sc.inputTranscription.text === 'string') events.push({ type: 'inputText', text: sc.inputTranscription.text });
        if (sc.outputTranscription && typeof sc.outputTranscription.text === 'string') events.push({ type: 'outputText', text: sc.outputTranscription.text });
        if (sc.interrupted) events.push({ type: 'interrupted' });
        if (sc.turnComplete) events.push({ type: 'turnComplete' });
    }

    if (msg.usageMetadata) {
        const usage = normalizeUsage(msg.usageMetadata);
        if (usage) events.push({ type: 'usage', usage, raw: msg.usageMetadata });
    }
    if (msg.goAway) events.push({ type: 'goAway', timeLeftMs: durationMs(msg.goAway.timeLeft) });
    if (msg.sessionResumptionUpdate) {
        const u = msg.sessionResumptionUpdate;
        events.push({ type: 'resumption', handle: typeof u.newHandle === 'string' && u.newHandle ? u.newHandle : null, resumable: u.resumable !== false });
    }
    return events;
}

/** ข้อความที่มาทาง WebSocket อาจเป็น string หรือ Blob/ArrayBuffer → string */
export async function messageText(data) {
    if (typeof data === 'string') return data;
    if (data && typeof data.text === 'function') return data.text(); // Blob
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
    if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data);
    return '';
}
