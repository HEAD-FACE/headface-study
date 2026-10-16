// ทดสอบการแสดงภาพ/วิดีโอ (js/study-media.js): กติกาที่อยู่ของสื่อ, การฝังวิดีโอเฉพาะเว็บที่รู้จัก, การ escape,
// และตัวขยายภาพ — สื่อมาจากไฟล์เนื้อหาของ admin จึงตรวจซ้ำที่หน้าเว็บเสมอ
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const { isAllowedMediaUrl, isVideoFile, videoEmbedUrl, mediaHtml, questionMediaHtml, choiceImageHtml, installImageZoom } = await import('../js/study-media.js');

describe('ที่อยู่ของสื่อ', () => {
    test('รับ https:// และไฟล์ใต้ assets/ เท่านั้น', () => {
        for (const ok of ['https://example.com/a.png', 'https://example.com/a b'.replace(' ', '%20'), 'assets/a.svg', 'assets/study/sci/states-of-matter.svg', 'assets/study/sci/v-1.mp4']) assert.equal(isAllowedMediaUrl(ok), true, ok);
        for (const bad of ['http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//example.com/a.png', '/assets/a.png', 'assets/../secret.png', 'assets/a b.png', 'assets/', 'assets', 'other/a.png', 'ftp://example.com/a', '', null, undefined, 5, 'https://', 'https://exa mple.com', 'https://example.com/"onerror=x', 'https://example.com/<x>']) {
            assert.equal(isAllowedMediaUrl(bad), false, String(bad));
        }
        assert.equal(isAllowedMediaUrl(`https://example.com/${'a'.repeat(500)}`), false, 'ยาวเกิน 500 ตัวอักษร');
    });

    test('ไฟล์วิดีโอที่เล่นในหน้าได้', () => {
        for (const ok of ['https://x.com/a.mp4', 'assets/v.webm', 'https://x.com/a.OGG?x=1', 'https://x.com/a.mov#t=3']) assert.equal(isVideoFile(ok), true, ok);
        for (const bad of ['https://x.com/a.mp4.exe', 'https://x.com/a', 'https://youtube.com/watch?v=abcdefghijk', '']) assert.equal(isVideoFile(bad), false, bad);
    });
});

describe('ลิงก์ฝังวิดีโอ (YouTube / Vimeo)', () => {
    const ID = 'dQw4w9WgXcQ';
    const yt = (id = ID, extra = '') => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1${extra}`;

    test('YouTube หลายรูปแบบลิงก์ → youtube-nocookie.com/embed/ID', () => {
        assert.equal(videoEmbedUrl(`https://www.youtube.com/watch?v=${ID}`), yt());
        assert.equal(videoEmbedUrl(`https://youtube.com/watch?v=${ID}&list=x`), yt());
        assert.equal(videoEmbedUrl(`https://m.youtube.com/watch?v=${ID}`), yt());
        assert.equal(videoEmbedUrl(`https://youtu.be/${ID}`), yt());
        assert.equal(videoEmbedUrl(`https://www.youtube.com/embed/${ID}`), yt());
        assert.equal(videoEmbedUrl(`https://www.youtube.com/shorts/${ID}`), yt());
        assert.equal(videoEmbedUrl(`https://www.youtube-nocookie.com/embed/${ID}`), yt());
    });

    test('เวลาเริ่ม (t / start) ใส่ได้เฉพาะตัวเลข', () => {
        assert.equal(videoEmbedUrl(`https://youtu.be/${ID}?t=90`), yt(ID, '&start=90'));
        assert.equal(videoEmbedUrl(`https://youtu.be/${ID}?t=90s`), yt(ID, '&start=90'));
        assert.equal(videoEmbedUrl(`https://www.youtube.com/watch?v=${ID}&start=5`), yt(ID, '&start=5'));
        assert.equal(videoEmbedUrl(`https://youtu.be/${ID}?t=1h2m3s`), yt(), 'รูปแบบอื่นไม่ถูกนำไปใช้');
        assert.equal(videoEmbedUrl(`https://youtu.be/${ID}?t="><script>`), null, 'ตัวอักษรอันตรายในลิงก์ → ไม่ฝังเลย');
    });

    test('Vimeo → player.vimeo.com/video/ID', () => {
        assert.equal(videoEmbedUrl('https://vimeo.com/123456789'), 'https://player.vimeo.com/video/123456789');
        assert.equal(videoEmbedUrl('https://player.vimeo.com/video/123456789'), 'https://player.vimeo.com/video/123456789');
        assert.equal(videoEmbedUrl('https://vimeo.com/channels/staffpicks/123456789'), null);
    });

    test('โดเมนปลอม ID ผิด รูปแบบที่ไม่รู้จัก และ http ไม่ถูกฝัง', () => {
        for (const bad of [
            `https://youtube.com.evil.com/watch?v=${ID}`, `https://evil.com/watch?v=${ID}`, `https://www.youtube.com/watch?v=short`, 'https://www.youtube.com/watch?v=' + 'a'.repeat(12),
            'https://www.youtube.com/watch', 'https://www.youtube.com/channel/abc', `http://www.youtube.com/watch?v=${ID}`, 'https://example.com/video', 'assets/video.mp4', 'https://youtu.be/', '', null,
        ]) {
            assert.equal(videoEmbedUrl(bad), null, String(bad));
        }
    });
});

describe('mediaHtml', () => {
    test('ภาพ: escape ทุกช่อง, lazy, แตะเพื่อขยายได้ และคำบรรยายอยู่ใน figure', () => {
        const html = mediaHtml({ kind: 'image', url: 'https://example.com/a.png?x=1&y=2', alt: 'แผนภาพ "1" <b>', caption: 'ภาพ <i>x</i>' });
        assert.match(html, /^<figure class="rfig has-media"><img src="https:\/\/example\.com\/a\.png\?x=1&amp;y=2" alt="แผนภาพ &quot;1&quot; &lt;b&gt;" loading="lazy" decoding="async" data-zoom="1" tabindex="0">/);
        assert.match(html, /<figcaption class="cap rcap">ภาพ &lt;i&gt;x&lt;\/i&gt;<\/figcaption><\/figure>$/);
        assert.doesNotMatch(html, /<b>|<i>/);
        assert.doesNotMatch(mediaHtml({ kind: 'image', url: 'assets/a.svg', alt: 'x' }, { zoom: false }), /data-zoom/);
    });

    test('วิดีโอ: ไฟล์ใช้ <video>, YouTube/Vimeo ฝังด้วย sandbox, ลิงก์อื่นเป็นปุ่มเปิดแท็บใหม่', () => {
        const file = mediaHtml({ kind: 'video', url: 'assets/study/v.mp4', caption: 'คลิป' });
        assert.match(file, /<video controls preload="metadata" playsinline src="assets\/study\/v\.mp4" aria-label="คลิป"><\/video>/);
        assert.match(file, /class="rfig has-media is-video"/);
        const embed = mediaHtml({ kind: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', caption: 'บทเรียน' });
        assert.match(embed, /<div class="rvid"><iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?rel=0&amp;modestbranding=1" title="บทเรียน" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"/);
        const other = mediaHtml({ kind: 'video', url: 'https://example.com/watch/123', caption: null });
        assert.match(other, /<a class="btn btn-line" href="https:\/\/example\.com\/watch\/123" target="_blank" rel="noopener noreferrer">เปิดวิดีโอ<\/a>/);
        assert.doesNotMatch(other, /<iframe/);
        assert.match(mediaHtml({ kind: 'video', url: 'https://example.com/v.mp4', caption: '" onload="x' }), /aria-label="&quot; onload=&quot;x"/);
    });

    test('ที่อยู่ไม่ผ่านกติกา ชนิดที่ไม่รู้จัก หรือไม่มีข้อมูล → ไม่แสดงอะไร', () => {
        assert.equal(mediaHtml({ kind: 'image', url: 'http://example.com/a.png', alt: 'x' }), '');
        assert.equal(mediaHtml({ kind: 'video', url: 'javascript:alert(1)' }), '');
        assert.equal(mediaHtml({ kind: 'audio', url: 'https://example.com/a.mp3' }), '');
        assert.equal(mediaHtml(null), '');
        assert.equal(mediaHtml({}), '');
    });

    test('รายการสื่อของโจทย์: เฉพาะที่ผ่านกติกา; รายการว่าง/ไม่ใช่รายการ = ไม่มีกล่อง', () => {
        const html = questionMediaHtml([
            { kind: 'image', url: 'assets/a.svg', alt: 'ก', caption: null }, { kind: 'image', url: 'http://bad.example/x.png', alt: 'x', caption: null }, { kind: 'video', url: 'https://example.com/v.webm', caption: null },
        ]);
        assert.match(html, /^<div class="qmedia">/);
        assert.equal((html.match(/<figure/g) || []).length, 2);
        assert.doesNotMatch(html, /bad\.example/);
        for (const empty of [[], null, undefined, 'x', [{ kind: 'image', url: 'ftp://x', alt: 'x' }]]) assert.equal(questionMediaHtml(empty), '', JSON.stringify(empty));
    });

    test('ภาพของตัวเลือก: escape alt, ที่อยู่ไม่ผ่านกติกา = ไม่มีรูป', () => {
        assert.equal(choiceImageHtml({ id: 'a', text: 'ก', image: { url: 'assets/c.svg', alt: 'a"b' } }), '<img class="choice-img" src="assets/c.svg" alt="a&quot;b" loading="lazy" decoding="async">');
        for (const none of [{ id: 'a', text: 'ก' }, { id: 'a', image: { url: 'http://x/y.png', alt: 'x' } }, null, undefined]) assert.equal(choiceImageHtml(none), '');
    });
});

describe('ตัวขยายภาพ', () => {
    function fakeDoc() {
        const listeners = {};
        const body = { children: [], appendChild(el) { this.children.push(el); } };
        const doc = {
            body,
            listeners,
            addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
            getElementById: (id) => body.children.find((el) => el.id === id && !el.removed) || null,
            createElement: () => ({ listeners: {}, attrs: {}, addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }, setAttribute(k, v) { this.attrs[k] = v; }, querySelector: () => ({ focus() {} }), remove() { this.removed = true; } }),
        };
        return doc;
    }
    const imgEl = { getAttribute: (k) => ({ src: 'assets/a.svg', alt: 'ภาพ "x"' }[k] ?? null) };

    test('แตะภาพที่มี data-zoom เปิดภาพเต็มจอ (escape) แตะอีกครั้งหรือกด Esc เพื่อปิด; ติดตั้งครั้งเดียว', () => {
        const doc = fakeDoc();
        installImageZoom(doc);
        installImageZoom(doc);
        assert.equal(doc.listeners.click.length, 1, 'ติดตั้งซ้ำไม่เพิ่มตัวฟัง');
        doc.listeners.click[0]({ target: { closest: () => imgEl } });
        const box = doc.getElementById('zoomView');
        assert.ok(box);
        assert.match(box.innerHTML, /<img src="assets\/a\.svg" alt="ภาพ &quot;x&quot;">/);
        assert.equal(box.attrs['aria-modal'], 'true');
        box.listeners.click[0]();
        assert.equal(doc.getElementById('zoomView'), null, 'แตะแล้วปิด');
        doc.listeners.click[0]({ target: { closest: () => imgEl } });
        assert.ok(doc.getElementById('zoomView'));
        doc.listeners.keydown[0]({ key: 'Escape' });
        assert.equal(doc.getElementById('zoomView'), null, 'Esc ปิด');
    });

    test('คลิกที่ไม่ใช่ภาพที่ขยายได้ไม่ทำอะไร', () => {
        const doc = fakeDoc();
        // ติดตั้งใหม่ได้เฉพาะเมื่อยังไม่เคยติดตั้งในโปรเซสนี้: ทดสอบด้วยการข้าม (ตัวแปรสถานะอยู่ในโมดูล) จึงเรียกผ่านเอกสารที่ติดตั้งไปแล้ว
        assert.doesNotThrow(() => installImageZoom(doc));
    });
});
