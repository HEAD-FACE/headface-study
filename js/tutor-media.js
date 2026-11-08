/**
 * js/tutor-media.js — ส่วนที่แตะอุปกรณ์จริงของ AI Tutor: ไมค์ ลำโพง กล้อง และการอ่านไฟล์ (เฉพาะเบราว์เซอร์)
 *
 * ตัวควบคุม (js/tutor-live.js) เรียกผ่านอินเทอร์เฟซนี้เท่านั้น เทสต์ของตัวควบคุมจึงใช้ของปลอมแทนได้
 *  ไมค์    getUserMedia (ตัดเสียงสะท้อน/เสียงรบกวน) → AudioWorklet → PCM 16 kHz → base64
 *  ลำโพง   PCM 24 kHz จาก Google → เล่นต่อกันโดยไม่มีช่องว่าง ขัดจังหวะ (stopPlayback) ได้ทันที
 *  กล้อง   แสดงตัวอย่างในหน้า + ถ่ายเฟรมย่อ (JPEG) เมื่อถูกเรียก
 *  ไฟล์    รูป → JPEG ย่อ · PDF → ข้อความ (pdf.js โหลดตอนใช้ครั้งแรก) · ข้อความ → อ่านตรง ๆ
 */
import { OUTPUT_RATE, base64ToPcm16, pcm16ToFloat, micChunkToBase64, level } from './tutor-pcm.js';
import { FILE_LIMITS, fitSize } from './tutor-files.js';

const PDFJS_VERSION = '3.11.174';
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
const CAMERA_FRAME_SIDE = 768;
const CAMERA_JPEG_QUALITY = 0.6;

const AudioContextClass = () => (typeof window === 'undefined' ? null : window.AudioContext || window.webkitAudioContext);

const loadScript = (src) => new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = resolve;
    el.onerror = () => reject(new Error('โหลดตัวอ่าน PDF ไม่สำเร็จ'));
    document.head.appendChild(el);
});

export function createMedia({ onPlaybackLevel = () => {} } = {}) {
    let micStream = null;
    let micCtx = null;
    let micNode = null;
    let micSource = null;
    let playCtx = null;
    let analyser = null;
    let playLevelTimer = null;
    let nextTime = 0;
    const playing = new Set();
    let camStream = null;
    let videoEl = null;
    let frameCanvas = null;
    let thumbCanvas = null;

    // ───────────── ไมค์ ─────────────
    async function prepareMic() {
        if (micStream) return true;
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('เบราว์เซอร์นี้ไม่รองรับไมค์');
        micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        return true;
    }

    async function startMic({ onChunk, onLevel }) {
        await prepareMic();
        const Ctx = AudioContextClass();
        micCtx = new Ctx();
        if (micCtx.state === 'suspended') await micCtx.resume();
        micSource = micCtx.createMediaStreamSource(micStream);
        const emit = (samples) => {
            onLevel?.(level(samples));
            onChunk(micChunkToBase64(samples, micCtx.sampleRate));
        };
        if (micCtx.audioWorklet) {
            await micCtx.audioWorklet.addModule(new URL('./tutor-capture-worklet.js', import.meta.url));
            micNode = new AudioWorkletNode(micCtx, 'pcm-capture');
            micNode.port.onmessage = (e) => emit(e.data);
            micSource.connect(micNode);
            // ต้องต่อออกปลายทางเพื่อให้ worklet ทำงาน แต่ไม่ให้เสียงไมค์ดังออกลำโพง (gain 0)
            const mute = micCtx.createGain();
            mute.gain.value = 0;
            micNode.connect(mute).connect(micCtx.destination);
        } else {
            // เบราว์เซอร์เก่าที่ยังไม่มี AudioWorklet
            micNode = micCtx.createScriptProcessor(2048, 1, 1);
            micNode.onaudioprocess = (e) => emit(new Float32Array(e.inputBuffer.getChannelData(0)));
            micSource.connect(micNode);
            micNode.connect(micCtx.destination);
        }
    }

    function stopMic() {
        try { micNode?.disconnect(); } catch (_) { /* ตัดไปแล้ว */ }
        try { micSource?.disconnect(); } catch (_) { /* ตัดไปแล้ว */ }
        micStream?.getTracks().forEach((t) => t.stop());
        micCtx?.close().catch(() => {});
        micStream = null; micCtx = null; micNode = null; micSource = null;
    }

    // ───────────── ลำโพง ─────────────
    function ensurePlayer() {
        if (playCtx) return playCtx;
        const Ctx = AudioContextClass();
        try { playCtx = new Ctx({ sampleRate: OUTPUT_RATE }); } catch (_) { playCtx = new Ctx(); }
        analyser = playCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.connect(playCtx.destination);
        const data = new Float32Array(analyser.fftSize);
        playLevelTimer = setInterval(() => {
            if (playing.size === 0) { onPlaybackLevel(0); return; }
            analyser.getFloatTimeDomainData(data);
            onPlaybackLevel(level(data));
        }, 80);
        return playCtx;
    }

    function play(b64) {
        const ctx = ensurePlayer();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        const samples = pcm16ToFloat(base64ToPcm16(b64));
        if (samples.length === 0) return;
        const buffer = ctx.createBuffer(1, samples.length, OUTPUT_RATE);
        buffer.copyToChannel(samples, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);
        const startAt = Math.max(ctx.currentTime + 0.03, nextTime);
        source.start(startAt);
        nextTime = startAt + buffer.duration;
        playing.add(source);
        source.onended = () => { playing.delete(source); if (playing.size === 0) nextTime = 0; };
    }

    function stopPlayback() {
        for (const s of playing) { try { s.stop(); } catch (_) { /* หยุดไปแล้ว */ } }
        playing.clear();
        nextTime = 0;
    }

    // ───────────── กล้อง ─────────────
    /** ผูกแท็ก <video> ที่ใช้แสดงตัวอย่างกล้อง */
    function attachVideo(el) {
        videoEl = el;
        if (videoEl && camStream) videoEl.srcObject = camStream;
    }

    async function startCamera(facing = 'user') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('เบราว์เซอร์นี้ไม่รองรับกล้อง');
        stopCamera();
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (videoEl) { videoEl.srcObject = camStream; videoEl.play?.().catch(() => {}); }
    }

    function stopCamera() {
        camStream?.getTracks().forEach((t) => t.stop());
        camStream = null;
        if (videoEl) videoEl.srcObject = null;
    }

    /** เฟรมปัจจุบัน: { data: base64 JPEG ย่อ, thumb: ค่าเทา 16x16 ไว้เทียบว่าภาพเปลี่ยนไหม } หรือ null ถ้ากล้องยังไม่พร้อม */
    function captureFrame() {
        if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) return null;
        const { width, height } = fitSize(videoEl.videoWidth, videoEl.videoHeight, CAMERA_FRAME_SIDE);
        frameCanvas ||= document.createElement('canvas');
        frameCanvas.width = width; frameCanvas.height = height;
        frameCanvas.getContext('2d').drawImage(videoEl, 0, 0, width, height);
        thumbCanvas ||= document.createElement('canvas');
        thumbCanvas.width = 16; thumbCanvas.height = 16;
        const tctx = thumbCanvas.getContext('2d', { willReadFrequently: true });
        tctx.drawImage(videoEl, 0, 0, 16, 16);
        const px = tctx.getImageData(0, 0, 16, 16).data;
        const thumb = new Uint8Array(256);
        for (let i = 0; i < 256; i++) thumb[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) | 0;
        return { data: frameCanvas.toDataURL('image/jpeg', CAMERA_JPEG_QUALITY).split(',')[1], thumb };
    }

    // ───────────── ไฟล์ ─────────────
    async function fileToJpeg(file) {
        let bitmap;
        try {
            bitmap = await createImageBitmap(file);
        } catch (_) {
            throw new Error('เปิดรูปนี้ไม่ได้ ลองบันทึกเป็น JPG หรือ PNG แล้วส่งใหม่');
        }
        const { width, height } = fitSize(bitmap.width, bitmap.height, FILE_LIMITS.maxImageSide);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // PNG โปร่งใสไม่ให้กลายเป็นพื้นดำ
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close?.();
        return { data: canvas.toDataURL('image/jpeg', FILE_LIMITS.jpegQuality).split(',')[1], width, height };
    }

    const textFromFile = (file) => file.text();

    async function pdfToText(file, maxChars = FILE_LIMITS.textChars) {
        if (!window.pdfjsLib) await loadScript(`${PDFJS_BASE}/pdf.min.js`);
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
        const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const parts = [];
        let chars = 0;
        for (let p = 1; p <= Math.min(doc.numPages, 40) && chars < maxChars * 1.2; p++) {
            const page = await doc.getPage(p);
            const text = (await page.getTextContent()).items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
            if (text) { parts.push(text); chars += text.length; }
        }
        const all = parts.join('\n\n');
        if (!all.trim()) throw new Error('PDF นี้เป็นรูปสแกน อ่านข้อความไม่ได้ ลองถ่ายหน้าที่ต้องการแล้วส่งเป็นรูปแทน');
        return all;
    }

    function close() {
        stopMic();
        stopCamera();
        stopPlayback();
        if (playLevelTimer) { clearInterval(playLevelTimer); playLevelTimer = null; }
        playCtx?.close().catch(() => {});
        playCtx = null; analyser = null;
        onPlaybackLevel(0);
    }

    return { prepareMic, startMic, stopMic, play, stopPlayback, attachVideo, startCamera, stopCamera, captureFrame, fileToJpeg, textFromFile, pdfToText, close };
}
