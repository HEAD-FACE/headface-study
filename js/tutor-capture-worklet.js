// AudioWorklet ของ AI Tutor: รับเสียงจากไมค์ทีละก้อนเล็ก (128 ตัวอย่าง) รวมเป็นก้อน ~2048 ตัวอย่างแล้วส่งกลับหน้าหลัก
// (แปลงเป็น PCM 16 kHz และ base64 ที่หน้าหลัก: js/tutor-pcm.js) ไฟล์นี้ต้องเป็นไฟล์แยกเพราะ AudioWorklet โหลดเป็นโมดูลของตัวเอง
class PcmCapture extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(2048);
        this.length = 0;
    }

    process(inputs) {
        const channel = inputs[0] && inputs[0][0];
        if (channel) {
            for (let i = 0; i < channel.length; i++) {
                this.buffer[this.length++] = channel[i];
                if (this.length === this.buffer.length) {
                    this.port.postMessage(this.buffer.slice(0));
                    this.length = 0;
                }
            }
        }
        return true;
    }
}

registerProcessor('pcm-capture', PcmCapture);
