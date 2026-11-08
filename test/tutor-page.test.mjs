// AI Tutor: หน้าคุย (tutor.html, js/tutor-page.js) และปุ่มทางเข้า (js/tutor-entry.js) — ส่วนที่เทสต์ใน Node ได้
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fmt, formatClock, readContext, backUrl, stateLabel, blockedReason, contextChip, renderLobby, renderLocked, renderLive, renderDock, renderSummary, renderMessage } from '../js/tutor-page.js';
import { entryView, tutorHref, applyEntries, initTutorEntry } from '../js/tutor-entry.js';
import { createStudyApi } from '../js/study-api.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const STATUS = {
    open: true, allowed: true, canStart: true, blocked: null,
    conversations: { limit: 5, used: 2, period: 'daily' },
    modes: [{ id: 'live', label: 'Live' }, { id: 'extended', label: 'Live Extended' }],
    credits: { available: 62340, dailyLimit: 70000, usedToday: 7660, minToStart: 1500, perMinuteGuide: 2813, multiplier: 1.25 },
    limits: { maxSessionMin: 30, heartbeatMs: 15000 }
};

describe('ตัวช่วย', () => {
    test('ตัวเลขเครดิตแบบไทย และ – เมื่อไม่ใช่ตัวเลข', () => {
        assert.equal(fmt(62340), '62,340');
        assert.equal(fmt(1234.6), '1,235');
        assert.equal(fmt(undefined), '–');
        assert.equal(fmt('abc'), '–');
    });

    test('นาฬิกา mm:ss', () => {
        assert.equal(formatClock(0), '00:00');
        assert.equal(formatClock(135000), '02:15');
        assert.equal(formatClock(-5), '00:00');
        assert.equal(formatClock(61 * 60000), '61:00');
    });

    test('วิชา/บทจากลิงก์: รับเฉพาะรูปแบบที่ถูกต้อง', () => {
        assert.deepEqual(readContext(new URLSearchParams('s=sci&l=3')), { subjectId: 'sci', lessonNo: 3 });
        assert.deepEqual(readContext(new URLSearchParams('s=sci')), { subjectId: 'sci', lessonNo: null });
        assert.deepEqual(readContext(new URLSearchParams('s=sci&l=current')), { subjectId: 'sci', lessonNo: null });
        assert.deepEqual(readContext(new URLSearchParams('s=../x&l=3')), { subjectId: null, lessonNo: null });
        assert.deepEqual(readContext(new URLSearchParams('l=3')), { subjectId: null, lessonNo: null }, 'มีบทแต่ไม่มีวิชา = ทิ้ง');
        assert.deepEqual(readContext(new URLSearchParams('s=sci&l=0')), { subjectId: 'sci', lessonNo: null });
        assert.deepEqual(readContext(new URLSearchParams('s=sci&l=99999')), { subjectId: 'sci', lessonNo: null });
    });

    test('ปุ่มกลับพาไปที่เดิม', () => {
        assert.equal(backUrl({ subjectId: 'sci', lessonNo: 3 }), 'lesson.html?s=sci&l=3');
        assert.equal(backUrl({ subjectId: 'sci', lessonNo: null }), 'course.html?s=sci');
        assert.equal(backUrl({ subjectId: null, lessonNo: null }), 'index.html');
    });

    test('ข้อความสถานะเป็นภาษาไทยครบทุกสถานะ และบอกเมื่อไมค์ปิด', () => {
        for (const s of ['starting', 'connecting', 'reconnecting', 'listening', 'thinking', 'speaking', 'ending', 'ended']) assert.ok(stateLabel(s).length > 3, s);
        assert.match(stateLabel('listening'), /พูดได้เลย/);
        assert.match(stateLabel('listening', { muted: true }), /ไมค์ปิด/);
        assert.equal(stateLabel('idle'), '');
    });

    test('รหัสผิดพลาดของ Backend → หน้าล็อกที่ถูกต้อง', () => {
        assert.equal(blockedReason('FEATURE_FORBIDDEN'), 'plan');
        assert.equal(blockedReason('FEATURE_QUOTA_EXCEEDED'), 'quota');
        assert.equal(blockedReason('INSUFFICIENT_CREDITS'), 'credits');
        assert.equal(blockedReason('TUTOR_DISABLED'), 'closed');
        assert.equal(blockedReason('TUTOR_UNAVAILABLE'), null, 'ล้มเหลวชั่วคราว = ลองใหม่ ไม่ใช่ล็อก');
        assert.equal(blockedReason('NETWORK'), null);
    });
});

describe('หน้าเริ่มคุย', () => {
    const html = renderLobby({ status: STATUS, ctx: { subject: 'วิทยาศาสตร์', lesson: 'พลังงานความร้อน', lessonNo: 3 } });

    test('มีสองโหมด (Live เลือกไว้ก่อน) สวิตช์ไมค์เปิด กล้องปิด และปุ่มเริ่ม', () => {
        assert.match(html, /name="mode" value="live" checked/);
        assert.match(html, /name="mode" value="extended"/);
        assert.match(html, /Live Extended/);
        assert.match(html, /name="mic" role="switch" checked/);
        assert.match(html, /name="camera" role="switch">/);
        assert.match(html, /id="startBtn"[^>]*type="submit"|type="submit"[^>]*id="startBtn"/);
        assert.match(html, /<form id="startForm"/);
    });

    test('แสดงเครดิตวันนี้ จำนวนครั้งที่เหลือ ค่าโดยประมาณต่อนาที และเวลาสูงสุด', () => {
        assert.ok(html.includes('62,340'));
        assert.ok(html.includes('70,000'));
        assert.ok(html.includes('3 <small>/ 5</small>'), 'เหลือ 3 จาก 5 ครั้ง');
        assert.ok(html.includes('~2,813'));
        assert.match(html, /30 <small>นาที/);
    });

    test('บอกบทที่กำลังเรียน และเปิดเผยว่าข้อมูลถูกส่งให้ Google', () => {
        assert.match(html, /กำลังเรียน: วิทยาศาสตร์ · บทที่ 3 · พลังงานความร้อน/);
        assert.match(html, /Google Gemini/);
        assert.match(html, /ไม่เก็บบทสนทนา/);
    });

    test('ไม่มีบริบท = ไม่มีป้ายบท; แพลนไม่จำกัดครั้ง = "ไม่จำกัด"', () => {
        const none = renderLobby({ status: { ...STATUS, conversations: { limit: null, used: 0, period: 'daily' } }, ctx: {} });
        assert.doesNotMatch(none, /กำลังเรียน:/);
        assert.match(none, /ไม่จำกัด/);
    });

    test('ข้อความจากเซิร์ฟเวอร์/ชื่อบทถูก escape ไม่แทรก HTML', () => {
        const evil = renderLobby({ status: STATUS, ctx: { subject: '<img src=x onerror=alert(1)>', lesson: '"><script>x</script>' }, error: '<b>เสีย</b>' });
        assert.doesNotMatch(evil, /<img src=x|<script>x|<b>เสีย/);
        assert.match(evil, /&lt;img/);
        assert.equal(contextChip({}), '');
    });
});

describe('หน้าล็อก', () => {
    test('FREE: บอกว่าเป็นของ PLUS/MAX มีรายการสิ่งที่ได้ และลิงก์ไปดูแพลน (จาก env.js ไม่ hard-code)', () => {
        const html = renderLocked('plan', { status: STATUS });
        assert.match(html, /แพลน PLUS และ MAX/);
        assert.match(html, /<li>/);
        assert.match(html, /ดูแพลนของฉัน/);
        assert.match(html, /href="https?:\/\/[^"]+"/);
        assert.doesNotMatch(read('js/tutor-page.js'), /https?:\/\/[a-z0-9.-]*headface\.app/i);
    });

    test('ครบโควตา / เครดิตไม่พอ / ยังไม่เปิด / ผิดพลาด ใช้ข้อความต่างกันและมีทางออก', () => {
        const q = renderLocked('quota', { status: STATUS });
        assert.match(q, /วันนี้คุยครบ 5 ครั้งแล้ว/);
        const c = renderLocked('credits', { status: STATUS });
        assert.match(c, /ต้องมีเครดิตอย่างน้อย 1,500/);
        assert.match(renderLocked('closed'), /ยังไม่เปิดให้ใช้งาน/);
        const e = renderLocked('error', { message: 'เชื่อมต่อไม่ได้' });
        assert.match(e, /data-act="retry"/);
        assert.match(e, /เชื่อมต่อไม่ได้/);
        for (const html of [q, c, renderLocked('closed'), e]) assert.match(html, /href="index\.html"/);
    });
});

describe('หน้าระหว่างคุย', () => {
    test('โครงหน้า: ลูกแก้ว ป้ายสถานะแบบ live region รายการบทสนทนา และช่องแจ้งเตือน', () => {
        const html = renderLive({ modeLabel: 'Live Extended', ctx: { subject: 'วิทยาศาสตร์', lesson: 'บท 3' } });
        assert.match(html, /class="tt-orb " data-state="starting"/);
        assert.match(html, /id="stateLabel"[^>]*aria-live="polite"/);
        assert.match(html, /<ol id="log"[^>]*aria-label="บทสนทนา"/);
        assert.match(html, /id="banner"[^>]*role="status"[^>]*hidden/);
        assert.match(html, /Live Extended/);
        assert.match(html, /<video id="camVideo"[^>]*playsinline[^>]*muted/);
        assert.match(html, /id="camBox"[^>]*hidden/);
    });

    test('แถบปุ่ม: แนบ กล้อง ไมค์ พิมพ์ จบ — ทุกปุ่มมีชื่อสำหรับโปรแกรมอ่านหน้าจอ ปุ่มสลับมี aria-pressed', () => {
        const html = renderDock();
        for (const act of ['attach', 'camera', 'mic', 'keyboard', 'end']) assert.match(html, new RegExp(`data-act="${act}"`), act);
        const buttons = html.match(/<button[^>]*>/g);
        for (const b of buttons) assert.match(b, /aria-label="[^"]+"/, b);
        assert.match(html, /data-act="mic" aria-pressed="true"/);
        assert.match(html, /data-act="camera" aria-pressed="false"/);
        assert.match(html, /id="fileInput" type="file" hidden accept="image\/\*,\.pdf/);
        assert.match(html, /id="textInput"[^>]*maxlength="1000"/);
    });

    test('ฟองข้อความ: ฝั่งผู้ใช้/AI, ยังพูดไม่จบ = partial, พิมพ์เอง = typed, escape ข้อความ', () => {
        const u = renderMessage({ id: 'c1', role: 'user', text: 'สวัสดี', final: false });
        assert.match(u, /class="tt-msg user partial"/);
        const a = renderMessage({ id: 'c2', role: 'ai', text: '<b>ครับ</b>', final: true });
        assert.match(a, /class="tt-msg ai"/);
        assert.doesNotMatch(a, /<b>ครับ/);
        assert.match(renderMessage({ id: 'c3', role: 'user', text: 'x', final: true, typed: true }), /typed/);
    });

    test('สรุปหลังจบ: นาที เครดิตที่ใช้ เครดิตที่เหลือ; ไม่มีสรุปก็ไม่แสดงตัวเลขเดา; เหตุผลที่หยุดเป็นข้อความไทย', () => {
        const html = renderSummary({ summary: { durationSec: 125, creditsCharged: 3400 }, credits: { available: 58940 }, reason: 'client' });
        assert.ok(html.includes('<b>2</b><span>นาที') && html.includes('3,400') && html.includes('58,940'));
        assert.match(html, /data-act="again"/);
        assert.doesNotMatch(renderSummary({ summary: null, credits: null, reason: 'error' }), /tt-sum-grid/);
        assert.match(renderSummary({ summary: null, reason: 'credits' }), /เครดิตวันนี้ใกล้หมด/);
        assert.match(renderSummary({ summary: null, reason: 'time' }), /ครบเวลา/);
        assert.match(renderSummary({ summary: null, reason: 'connect_failed' }), /การเชื่อมต่อมีปัญหา/);
    });
});

describe('ปุ่มทางเข้า', () => {
    test('แสดงเมื่อ Backend บอกว่าเปิด; แพลนไม่มีสิทธิ์ = มีป้าย PLUS; ปิดหรือไม่รู้ = ไม่แสดง', () => {
        assert.deepEqual(entryView({ tutor: { open: true }, entitlements: { aiTutor: { enabled: true } } }), { show: true, locked: false });
        assert.deepEqual(entryView({ tutor: { open: true }, entitlements: { aiTutor: { enabled: false } } }), { show: true, locked: true });
        assert.deepEqual(entryView({ tutor: { open: false }, entitlements: { aiTutor: { enabled: true } } }), { show: false, locked: false });
        assert.deepEqual(entryView({ entitlements: { aiTutor: { enabled: true } } }), { show: false, locked: false }, 'Backend รุ่นเก่าที่ไม่มี tutor');
        assert.deepEqual(entryView(null), { show: false, locked: false });
    });

    test('ลิงก์จากหัวบทเรียนพาวิชา/บทไปด้วย เฉพาะค่าที่ถูกต้อง', () => {
        assert.equal(tutorHref('?s=sci&l=3&n=sci-c3-a'), 'tutor.html?s=sci&l=3');
        assert.equal(tutorHref('?s=sci&l=current'), 'tutor.html?s=sci');
        assert.equal(tutorHref('?s=%3Cx%3E&l=3'), 'tutor.html');
        assert.equal(tutorHref(''), 'tutor.html');
    });

    function fakeDoc(elements) {
        return { querySelector: (sel) => (elements.length ? elements[0] : null), querySelectorAll: (sel) => elements.filter((e) => e.matches(sel)) };
    }
    const fakeEl = (attrs, lockEl = null) => {
        const el = { hidden: true, attrs: { ...attrs }, hasAttribute: (k) => k in el.attrs, setAttribute: (k, v) => { el.attrs[k] = v; }, querySelector: () => lockEl, matches: (sel) => sel.slice(1, -1) in el.attrs };
        return el;
    };

    test('applyEntries: เปิดส่วนและปุ่ม ตั้งลิงก์บริบท และโชว์ป้ายล็อกตามแพลน', () => {
        const lock = { hidden: true };
        const section = fakeEl({ 'data-tutor-entry-section': '' });
        const link = fakeEl({ 'data-tutor-entry': '', 'data-tutor-context': '', href: 'tutor.html' }, lock);
        applyEntries(fakeDoc([section, link]), { show: true, locked: true }, '?s=sci&l=2');
        assert.equal(section.hidden, false);
        assert.equal(link.hidden, false);
        assert.equal(link.attrs.href, 'tutor.html?s=sci&l=2');
        assert.equal(lock.hidden, false);
        applyEntries(fakeDoc([section, link]), { show: false, locked: false }, '');
        assert.equal(link.hidden, true);
    });

    test('initTutorEntry: เรียก /me ครั้งเดียวแม้เรียกซ้อน; /me ล้มเหลว = ไม่แสดงปุ่มและไม่ throw', async () => {
        let calls = 0;
        const link = fakeEl({ 'data-tutor-entry': '' });
        const doc = fakeDoc([link]);
        const api = { getMe: async () => { calls++; return { tutor: { open: true }, entitlements: { aiTutor: { enabled: true } } }; } };
        await Promise.all([initTutorEntry({ doc, api, search: '' }), initTutorEntry({ doc, api, search: '' })]);
        assert.equal(calls, 1);
        assert.equal(link.hidden, false);
        const link2 = fakeEl({ 'data-tutor-entry': '' });
        const failing = await initTutorEntry({ doc: fakeDoc([link2]), api: { getMe: async () => { throw new Error('x'); } }, search: '' });
        assert.equal(failing, null);
        assert.equal(link2.hidden, true);
        assert.equal(await initTutorEntry({ doc: fakeDoc([]), api, search: '' }), null, 'หน้าไม่มีปุ่ม = ไม่เรียก API');
    });
});

describe('API ของ Tutor ใน study-api.js', () => {
    test('เส้นทางและเนื้อหาคำขอตรงสัญญา; endTutor ส่ง keepalive ได้', async () => {
        const sent = [];
        const api = createStudyApi(async (url, options) => { sent.push({ url, ...options }); return { ok: true, status: 200, json: async () => ({ success: true }) }; });
        await api.getTutor();
        await api.startTutor({ mode: 'extended', subjectId: 'sci', lessonNo: 3 });
        await api.reportTutor('ts_abcdefghij', [{ seq: 1, prompt: 1, response: 1, thoughts: 0 }]);
        await api.endTutor('ts_abcdefghij', { reason: 'client' }, { keepalive: true });
        await api.endTutor('ts_abcdefghij');
        assert.deepEqual(sent.map((s) => `${s.method} ${s.url}`), [
            'GET /api/study/tutor', 'POST /api/study/tutor/sessions', 'POST /api/study/tutor/sessions/ts_abcdefghij/usage',
            'POST /api/study/tutor/sessions/ts_abcdefghij/end', 'POST /api/study/tutor/sessions/ts_abcdefghij/end'
        ]);
        assert.deepEqual(JSON.parse(sent[1].body), { mode: 'extended', subjectId: 'sci', lessonNo: 3 });
        assert.deepEqual(JSON.parse(sent[2].body), { turns: [{ seq: 1, prompt: 1, response: 1, thoughts: 0 }] });
        assert.equal(sent[3].keepalive, true);
        assert.equal(sent[4].keepalive, undefined);
        assert.equal(sent[0].keepalive, undefined);
    });
});

describe('ไฟล์ของหน้า', () => {
    const html = read('tutor.html');

    test('tutor.html: หน้าอิสระแบบเดียวกับ lesson (ตรวจสิทธิ์ + main.js) ไม่โหลดแชทลอยของ LYNX ไม่ใช้ Tailwind', () => {
        assert.match(html, /<body class="flow[^"]*" data-page="tutor">/);
        for (const src of ['js/auth.js', 'js/api-client.js', 'js/main.js', 'js/tutor-page.js']) assert.ok(html.includes(`src="${src}"`), src);
        assert.doesNotMatch(html, /lynx-loader/);
        assert.doesNotMatch(html, /cdn\.tailwindcss/);
        assert.match(html, /css\/tutor\.css/);
        assert.match(html, /viewport-fit=cover/, 'แถบปุ่มล่างเว้นขอบ safe-area ของ iPhone');
    });

    test('Barba ปล่อย tutor.html เป็นหน้าแยก', () => {
        assert.match(read('js/main.js'), /FLOW_PAGE_PATTERN = \/\\\/\(lesson\|mock-exam\|report\|tutor\)\\\.html/);
    });

    test('ปุ่มทางเข้า: หน้าแรกและหัวบทเรียนซ่อนไว้ก่อน และไม่มีใน Mock Exam (ห้ามมีผู้ช่วยระหว่างสอบจับเวลา)', () => {
        const index = read('index.html');
        assert.match(index, /<section[^>]*data-tutor-entry-section hidden>/);
        assert.match(index, /<a class="tcta" href="tutor\.html" data-tutor-entry>/);
        assert.match(index, /src="js\/tutor-entry\.js"/);
        const lesson = read('lesson.html');
        assert.match(lesson, /class="tt-chip" data-tutor-entry data-tutor-context href="tutor\.html" hidden/);
        assert.match(lesson, /src="js\/tutor-entry\.js"/);
        const mock = read('mock-exam.html');
        assert.doesNotMatch(mock, /tutor/i);
    });

    test('pdf.js โหลดจาก cdnjs แบบล็อกเวอร์ชัน และใช้เฉพาะตอนแนบ PDF', () => {
        const media = read('js/tutor-media.js');
        assert.match(media, /cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/\$\{PDFJS_VERSION\}/);
        assert.match(media, /PDFJS_VERSION = '3\.11\.174'/);
        assert.doesNotMatch(read('tutor.html'), /pdf\.js|pdfjs/);
    });

    test('ไม่มีที่ไหนเก็บเนื้อหาบทสนทนา (ไม่ localStorage / sessionStorage / IndexedDB ในไฟล์ของ Tutor)', () => {
        for (const f of ['js/tutor-page.js', 'js/tutor-live.js', 'js/tutor-media.js', 'js/tutor-usage.js', 'js/tutor-entry.js']) {
            assert.doesNotMatch(read(f), /localStorage|sessionStorage|indexedDB/i, f);
        }
    });

    test('ทุกไฟล์ที่ติดต่อ Google ผ่าน token ที่ Backend ให้เท่านั้น (ไม่มีคีย์/โดเมนของ Google hard-code ในหน้าเว็บ)', () => {
        for (const f of ['js/tutor-page.js', 'js/tutor-live.js', 'js/tutor-media.js', 'js/tutor-protocol.js']) {
            assert.doesNotMatch(read(f), /generativelanguage\.googleapis|AIza[0-9A-Za-z_-]{20}/, f);
        }
    });

    test('CSS: ปุ่มควบคุมสูงอย่างน้อย 44px, ปิดแอนิเมชันเมื่อผู้ใช้ตั้ง reduced motion, เว้น safe-area', () => {
        const css = read('css/tutor.css');
        assert.match(css, /prefers-reduced-motion: reduce/);
        assert.match(css, /safe-area-inset-bottom/);
        assert.match(css, /\.tt-b\s*\{[^}]*min-height:\s*58px/);
        assert.match(css, /\.tt-text input\s*\{[^}]*font-size:\s*16px/, 'ช่องพิมพ์ 16px กัน iOS ซูมเอง');
    });
});
