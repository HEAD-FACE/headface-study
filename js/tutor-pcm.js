/**
 * js/tutor-pcm.js — เสียงดิบของ AI Tutor (ไม่พึ่งเบราว์เซอร์ เทสต์ใน Node ได้)
 *
 * Gemini Live รับเสียงเข้าเป็น PCM 16-bit little-endian ที่ 16 kHz และส่งเสียงออกเป็น PCM 16-bit ที่ 24 kHz
 * (ส่งในข้อความ JSON เป็น base64) ไฟล์นี้แปลงไปมาระหว่างเสียงของเบราว์เซอร์ (Float32, 44.1/48 kHz) กับรูปแบบนั้น
 */

export const INPUT_RATE = 16000;
export const OUTPUT_RATE = 24000;
export const INPUT_MIME = `audio/pcm;rate=${INPUT_RATE}`;

/** Float32 [-1, 1] → Int16 (ตัดค่าเกินช่วงแทนที่จะให้วนกลับ) */
export function floatToPcm16(input) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        // คูณ 32768 ทั้งสองด้านให้ตรงกับ pcm16ToFloat (หาร 32768) แล้วตัดที่ขอบ: แปลงไปกลับได้ค่าเดิม
        out[i] = Math.max(-0x8000, Math.min(0x7fff, Math.round((input[i] || 0) * 0x8000)));
    }
    return out;
}

/** Int16 → Float32 [-1, 1) */
export function pcm16ToFloat(input) {
    const out = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = input[i] / 0x8000;
    return out;
}

/** ปรับอัตราสุ่มตัวอย่างแบบเชิงเส้น (พอสำหรับเสียงพูด; ลดจาก 48k → 16k ใช้เฉลี่ยช่วงเพื่อไม่ให้เกิดเสียงแหลมปลอม) */
export function resampleLinear(input, fromRate, toRate) {
    if (!(fromRate > 0) || !(toRate > 0)) throw new RangeError('sample rate must be positive');
    if (fromRate === toRate || input.length === 0) return Float32Array.from(input);
    const ratio = fromRate / toRate;
    const length = Math.max(1, Math.floor(input.length / ratio));
    const out = new Float32Array(length);
    if (ratio > 1) {
        // ลดอัตรา: เฉลี่ยตัวอย่างที่ตกอยู่ในช่วงของตัวอย่างใหม่ (กรองความถี่สูงอย่างง่าย)
        for (let i = 0; i < length; i++) {
            const start = Math.floor(i * ratio);
            const end = Math.min(input.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
            let sum = 0;
            for (let j = start; j < end; j++) sum += input[j];
            out[i] = sum / (end - start);
        }
        return out;
    }
    for (let i = 0; i < length; i++) {
        const pos = i * ratio;
        const base = Math.floor(pos);
        const next = Math.min(input.length - 1, base + 1);
        const frac = pos - base;
        out[i] = input[base] * (1 - frac) + input[next] * frac;
    }
    return out;
}

const CHUNK = 0x8000;

export function bytesToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    return btoa(binary);
}

export function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/** Int16 → base64 ของ byte แบบ little-endian (ลำดับ byte ของเครื่องที่ใช้งานจริงเป็น little-endian ทั้งหมด) */
export function pcm16ToBase64(pcm) {
    return bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength));
}

/** base64 → Int16 (ถ้า byte เป็นเลขคี่ ทิ้ง byte สุดท้ายที่ไม่ครบตัวอย่าง) */
export function base64ToPcm16(b64) {
    const bytes = base64ToBytes(b64);
    const even = bytes.length - (bytes.length % 2);
    const copy = new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + even));
    return new Int16Array(copy.buffer);
}

/** ระดับเสียง 0..1 (RMS) ไว้ทำแอนิเมชันวงกลม */
export function level(samples) {
    if (!samples || samples.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.min(1, Math.sqrt(sum / samples.length) * 3);
}

/** เสียงจากไมค์ (Float32 ที่อัตราของอุปกรณ์) → base64 ของ PCM 16 kHz พร้อมส่ง */
export function micChunkToBase64(samples, deviceRate) {
    return pcm16ToBase64(floatToPcm16(resampleLinear(samples, deviceRate, INPUT_RATE)));
}
