// คลิปสอน (Shorts + คลิปยาว): ตัวช่วย/HTML ของหน้า videos.html, shorts.html, watch.html, ตัวรายงานความคืบหน้า, เครื่องเล่น YouTube,
// เส้นทาง API, ทางเข้าในหน้ารายวิชา และแท็บ "คลิป" ที่แถบล่าง — ส่วนที่ทดสอบใน Node ได้ (ไม่มีเบราว์เซอร์จริง)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    fmtDuration, watchUrl, shortsUrl, videosUrl, quotaHtml, chipsHtml, shortCardHtml, longCardHtml, hubHtml, skeletonHtml,
    subjectFromUrl, initVideosPage, SHORTS_IN_RAIL, LONG_PAGE
} from '../js/study-videos.js';
import { itemHtml, lockHtml as shortsLockHtml, videoFromUrl, SETTLE_MS, REPORT_MS as SHORTS_REPORT_MS } from '../js/study-shorts.js';
import { statusHtml, infoHtml, posterHtml, lockHtml as watchLockHtml, REPORT_MS as WATCH_REPORT_MS } from '../js/study-watch.js';
import { createTracker } from '../js/video-tracker.js';
import { YT_STATE, playerVars, loadYouTubeApi, createPlayer, youtubeErrorText } from '../js/yt-player.js';
import { createStudyApi, StudyApiError } from '../js/study-api.js';
import { videosEntryHtml } from '../js/study-course.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const flush = () => new Promise((r) => setTimeout(r, 0));

const SCI = { id: 'sci', title: 'วิทยาศาสตร์', emoji: '🔬' };
const clip = (over = {}) => ({
    id: 'sci-v-a1b2c3d4', subjectId: 'sci', subject: SCI, kind: 'long', title: 'ปฏิกิริยาเคมี', description: '', durationSec: 600,
    exp: 20, expEarned: null, lessonNo: 1, topic: 'ปฏิกิริยา', thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
    progress: { positionSec: 0, watchedSec: 0, pct: 0, completed: false, completedAt: null }, ...over
});

describe('ตัวช่วยของหน้าคลิป', () => {
    test('ความยาวคลิป m:ss และ h:mm:ss ค่าแปลก ๆ เป็น 0:00', () => {
        assert.equal(fmtDuration(0), '0:00');
        assert.equal(fmtDuration(45), '0:45');
        assert.equal(fmtDuration(75.9), '1:15');
        assert.equal(fmtDuration(3725), '1:02:05');
        assert.equal(fmtDuration(-5), '0:00');
        assert.equal(fmtDuration('abc'), '0:00');
    });

    test('ลิงก์ของหน้าคลิป เข้ารหัสค่าใน URL', () => {
        assert.equal(watchUrl('sci-v-1'), 'watch.html?v=sci-v-1');
        assert.equal(watchUrl('a&b'), 'watch.html?v=a%26b');
        assert.equal(shortsUrl(), 'shorts.html');
        assert.equal(shortsUrl({ subject: 'sci' }), 'shorts.html?s=sci');
        assert.equal(shortsUrl({ video: 'sci-v-1' }), 'shorts.html?v=sci-v-1');
        assert.equal(shortsUrl({ subject: 'sci', video: 'sci-v-1' }), 'shorts.html?s=sci&v=sci-v-1');
        assert.equal(videosUrl(null), 'videos.html');
        assert.equal(videosUrl('mat'), 'videos.html?s=mat');
    });

    test('อ่านวิชา (?s=) และคลิป (?v=) จาก URL รับเฉพาะรูปแบบ id ที่ถูกต้อง', () => {
        assert.equal(subjectFromUrl('https://beta-study.headface.app/videos.html?s=sci'), 'sci');
        assert.equal(subjectFromUrl('videos.html'), null);
        assert.equal(subjectFromUrl('videos.html?s=SCI'), null);
        assert.equal(subjectFromUrl('videos.html?s=<b>'), null);
        assert.equal(videoFromUrl('watch.html?v=sci-v-a1b2c3d4'), 'sci-v-a1b2c3d4');
        assert.equal(videoFromUrl('watch.html?v=../x'), null);
        assert.equal(videoFromUrl('watch.html'), null);
    });

    test('จำนวนต่อหน้า และจังหวะการรายงาน (Shorts ถี่กว่าคลิปยาว)', () => {
        assert.equal(SHORTS_IN_RAIL, 12);
        assert.equal(LONG_PAGE, 12);
        assert.ok(SETTLE_MS >= 300 && SETTLE_MS <= 1000, 'ปัดผ่านเร็ว ๆ ต้องไม่เสียโควตา');
        assert.equal(SHORTS_REPORT_MS, 3000);
        assert.equal(WATCH_REPORT_MS, 10000);
    });
});

describe('หน้ารวมคลิป (videos.html)', () => {
    test('บรรทัด "วันนี้ดูได้อีก": FREE เห็นจำนวน, PLUS/MAX (ไม่จำกัด) ไม่เห็นอะไร', () => {
        assert.equal(quotaHtml(null), '');
        assert.equal(quotaHtml({ short: { allowed: true, limit: null, used: 0, left: null }, long: { allowed: true, limit: null, used: 0, left: null } }), '');
        const free = quotaHtml({ short: { allowed: true, limit: 10, used: 3, left: 7 }, long: { allowed: true, limit: 5, used: 5, left: 0 } });
        assert.match(free, /Shorts ดูได้อีก <b>7<\/b>\/10/);
        assert.match(free, /class="vd-q is-out">คลิปยาว ดูได้อีก <b>0<\/b>\/5/);
        assert.match(free, /role="status"/);
        assert.match(quotaHtml({ short: { allowed: false, limit: 0, used: 0, left: 0 } }), /Shorts: แพลนนี้ยังดูไม่ได้/);
    });

    test('ชิปเลือกวิชา: "ทั้งหมด" + ทุกวิชา ชิปที่เลือกอยู่ถูกไฮไลต์ และชื่อวิชาถูก escape', () => {
        const all = chipsHtml([SCI, { id: 'mat', title: 'คณิต<b>' }], null);
        assert.match(all, /<button type="button" class="vd-chip on" data-subject="" aria-pressed="true">ทั้งหมด/);
        assert.match(all, /data-subject="mat" aria-pressed="false">คณิต&lt;b&gt;/);
        const sci = chipsHtml([SCI], 'sci');
        assert.match(sci, /class="vd-chip on" data-subject="sci" aria-pressed="true">🔬 วิทยาศาสตร์/);
        assert.match(sci, /class="vd-chip" data-subject="" aria-pressed="false">ทั้งหมด/);
    });

    test('การ์ด Shorts: ลิงก์เปิดฟีดที่คลิปนั้น (คงวิชาที่เลือก) ความยาว เครื่องหมายดูจบ ภาพปกต้องเป็น https', () => {
        const html = shortCardHtml(clip({ kind: 'short', durationSec: 45, progress: { pct: 100, completed: true } }), 'sci');
        assert.match(html, /href="shorts\.html\?s=sci&amp;v=sci-v-a1b2c3d4"/);
        assert.match(html, /<span class="vd-dur">0:45<\/span>/);
        assert.match(html, /class="vd-done"/);
        assert.match(html, /<img src="https:\/\/i\.ytimg\.com\/vi\/aqz-KE-bpKQ\/hqdefault\.jpg"/);
        for (const bad of ['javascript:alert(1)', 'http://x.test/a.jpg', 'https://x.test/a.jpg" onerror="x']) {
            assert.doesNotMatch(shortCardHtml(clip({ thumbnailUrl: bad }), null), /<img/, bad);
        }
        assert.match(shortCardHtml(clip({ title: '<script>x</script>' }), null), /&lt;script&gt;x&lt;\/script&gt;/);
    });

    test('การ์ดคลิปยาว: ลิงก์ไปหน้าดู แถบความคืบหน้า (ไม่เกิน 100%) EXP ที่จะได้/ได้แล้ว และชื่อวิชาเมื่อดูรวมทุกวิชา', () => {
        const fresh = longCardHtml(clip());
        assert.match(fresh, /href="watch\.html\?v=sci-v-a1b2c3d4"/);
        assert.match(fresh, /<span class="vd-dur">10:00<\/span>/);
        assert.doesNotMatch(fresh, /vd-bar/, 'ยังไม่ดูเลย = ไม่มีแถบ');
        assert.match(fresh, /\+20 EXP/);
        assert.match(fresh, /บทที่ 1/);
        assert.doesNotMatch(fresh, /vd-sub/);
        const half = longCardHtml(clip({ progress: { pct: 35, completed: false } }), { showSubject: true });
        assert.match(half, /<i style="width:35%"><\/i>/);
        assert.match(half, /<span class="vd-sub">วิทยาศาสตร์<\/span>/);
        assert.match(longCardHtml(clip({ progress: { pct: 250 } })), /width:100%/);
        const got = longCardHtml(clip({ expEarned: 20, progress: { pct: 100, completed: true } }));
        assert.match(got, /class="vd-exp is-got">.*20 EXP/);
        assert.doesNotMatch(got, /\+20 EXP/);
        assert.doesNotMatch(longCardHtml(clip({ exp: 0 })), /EXP/, 'คลิป EXP 0 ไม่ต้องบอก');
    });

    test('ทั้งหน้า: แถว Shorts + "ดูทั้งหมด (n)", รายการคลิปยาว, ปุ่ม "ดูคลิปเพิ่ม" เฉพาะเมื่อยังมีเหลือ', () => {
        const html = hubHtml({ subjects: [SCI], current: 'sci', shorts: [clip({ kind: 'short' })], shortsTotal: 6, longs: [clip()], longTotal: 3, quota: null });
        assert.match(html, /ดูทั้งหมด \(6\)/);
        assert.match(html, /href="shorts\.html\?s=sci"/);
        assert.match(html, /<span class="vd-count">3 คลิป<\/span>/);
        assert.match(html, /data-act="more"/);
        assert.doesNotMatch(hubHtml({ subjects: [SCI], longs: [clip()], longTotal: 1 }), /data-act="more"/);
        assert.doesNotMatch(hubHtml({ subjects: [SCI], longs: [clip()], longTotal: 1 }), /aria-label="Shorts"/, 'ไม่มี Shorts = ไม่มีแถว');
    });

    test('ยังไม่มีคลิป: บอกตรง ๆ (ระบุวิชาเมื่อเลือกวิชาอยู่) ไม่มีการ์ดตัวอย่าง', () => {
        assert.match(hubHtml({ subjects: [SCI], current: 'sci' }), /ยังไม่มีคลิปของวิชาวิทยาศาสตร์/);
        assert.match(hubHtml({ subjects: [] }), /ยังไม่มีคลิปสอน/);
        assert.doesNotMatch(hubHtml({ subjects: [] }), /vd-sc|vd-lc/);
    });

    test('ระหว่างโหลดเป็นโครงเปล่าเท่านั้น (ไม่มีชื่อคลิป/ตัวเลขตัวอย่าง)', () => {
        const sk = skeletonHtml();
        assert.match(sk, /aria-busy="true"/);
        assert.match(sk, /class="skl/);
        assert.equal(sk.replace(/<[^>]+>/g, '').trim(), 'กำลังโหลดคลิป');
    });
});

describe('initVideosPage: โหลด เลือกวิชา ดูเพิ่ม ลองใหม่', () => {
    function setup({ fail = 0 } = {}) {
        const calls = [];
        let failures = fail;
        const api = {
            listVideos: async (q) => {
                calls.push(q);
                if (failures > 0) { failures -= 1; throw new StudyApiError('INTERNAL', 500, 'ระบบขัดข้อง'); }
                const isShort = q.kind === 'short';
                const total = isShort ? 2 : 14;
                const n = Math.max(0, Math.min(q.limit || 24, total - (q.offset || 0)));
                const videos = Array.from({ length: n }, (_, i) => clip({ id: `${q.subject || 'sci'}-v-${q.kind[0]}${(q.offset || 0) + i}`, kind: q.kind }));
                return { videos, page: { offset: q.offset || 0, limit: q.limit, total }, subjects: [SCI, { id: 'mat', title: 'คณิตศาสตร์' }], quota: { short: { allowed: true, limit: 10, used: 1, left: 9 }, long: { allowed: true, limit: 5, used: 0, left: 5 } } };
            }
        };
        const body = { innerHTML: '' };
        let handler = null;
        const rootEl = {
            querySelector: (s) => (s === '#vdBody' ? body : null),
            addEventListener: (t, fn) => { if (t === 'click') handler = fn; },
            removeEventListener: (t, fn) => { if (handler === fn) handler = null; }
        };
        const urls = [];
        const win = { history: { state: null, replaceState: (_s, _t, u) => urls.push(u) } };
        const click = (target) => handler && handler({ target });
        const targetFor = (matches) => ({ closest: (sel) => matches[sel] || null });
        return { api, calls, body, rootEl, win, urls, click, targetFor, get handler() { return handler; } };
    }

    test('เปิดหน้าด้วย ?s=sci: ขอ Shorts และคลิปยาวของวิชานั้นพร้อมกัน แล้ววาดทั้งหน้า', async () => {
        const t = setup();
        await initVideosPage(t.rootEl, { api: t.api, url: 'https://x.test/videos.html?s=sci', win: t.win });
        assert.deepEqual(t.calls, [{ subject: 'sci', kind: 'short', limit: SHORTS_IN_RAIL }, { subject: 'sci', kind: 'long', limit: LONG_PAGE }]);
        assert.match(t.body.innerHTML, /Shorts ดูได้อีก <b>9<\/b>\/10/);
        assert.match(t.body.innerHTML, /data-act="more"/);
        assert.equal((t.body.innerHTML.match(/class="vd-lc"/g) || []).length, 12);
    });

    test('แตะชิปวิชา: เปลี่ยน URL (replaceState ไม่เพิ่มประวัติ) แล้วโหลดใหม่เฉพาะวิชานั้น; แตะชิปเดิมไม่โหลดซ้ำ', async () => {
        const t = setup();
        await initVideosPage(t.rootEl, { api: t.api, url: 'videos.html', win: t.win });
        t.click(t.targetFor({ '[data-subject]': { dataset: { subject: 'mat' } } }));
        await flush();
        assert.deepEqual(t.urls, ['videos.html?s=mat']);
        assert.deepEqual(t.calls.slice(2).map((c) => c.subject), ['mat', 'mat']);
        t.click(t.targetFor({ '[data-subject]': { dataset: { subject: 'mat' } } }));
        await flush();
        assert.equal(t.calls.length, 4);
        t.click(t.targetFor({ '[data-subject]': { dataset: { subject: '' } } }));
        await flush();
        assert.deepEqual(t.urls, ['videos.html?s=mat', 'videos.html']);
        assert.equal(t.calls[4].subject, null);
    });

    test('"ดูคลิปเพิ่ม" ขอหน้าถัดไปด้วย offset และต่อท้ายรายการ ครบแล้วปุ่มหายไป', async () => {
        const t = setup();
        await initVideosPage(t.rootEl, { api: t.api, url: 'videos.html?s=sci', win: t.win });
        const btn = { dataset: { act: 'more' }, disabled: false, textContent: '' };
        t.click(t.targetFor({ '[data-act]': btn }));
        assert.equal(btn.disabled, true);
        await flush();
        assert.deepEqual(t.calls[2], { subject: 'sci', kind: 'long', offset: 12, limit: LONG_PAGE });
        assert.equal((t.body.innerHTML.match(/class="vd-lc"/g) || []).length, 14);
        assert.doesNotMatch(t.body.innerHTML, /data-act="more"/);
    });

    test('โหลดไม่สำเร็จ: บอกข้อความจาก Backend + ปุ่มลองใหม่ ซึ่งโหลดได้จริง; dispose แล้วไม่ฟังการแตะอีก', async () => {
        const t = setup({ fail: 1 });
        const ctl = await initVideosPage(t.rootEl, { api: t.api, url: 'videos.html', win: t.win });
        assert.match(t.body.innerHTML, /โหลดคลิปไม่สำเร็จ/);
        assert.match(t.body.innerHTML, /ระบบขัดข้อง/);
        t.click(t.targetFor({ '[data-act]': { dataset: { act: 'retry' } } }));
        await flush();
        assert.match(t.body.innerHTML, /class="vd-lc"/);
        ctl.dispose();
        assert.equal(t.handler, null);
    });
});

describe('ฟีด Shorts (shorts.html)', () => {
    test('การ์ดหนึ่งคลิป: ยังไม่มีเครื่องเล่น (ใส่เมื่อเลื่อนมาถึง) ภาพปก 2 ใบแรกโหลดทันที มีลิงก์ไปบทเรียน', () => {
        const v = clip({ kind: 'short', durationSec: 45, exp: 3 });
        const first = itemHtml(v, 0);
        assert.match(first, /<section class="sh-item" data-id="sci-v-a1b2c3d4" data-i="0"/);
        assert.doesNotMatch(first, /<iframe/);
        assert.match(first, /<div class="sh-player"><\/div>/);
        assert.match(first, /loading="eager"/);
        assert.match(itemHtml(v, 5), /loading="lazy"/);
        assert.match(first, /href="lesson\.html\?s=sci&l=1">ไปบทที่ 1/);
        assert.match(first, /ดูจบรับ \+3 EXP/);
        assert.match(first, /🔬 วิทยาศาสตร์ · 0:45/);
        assert.match(itemHtml({ ...v, expEarned: 3 }, 0), /ได้ 3 EXP แล้ว/);
        assert.doesNotMatch(itemHtml({ ...v, exp: 0, lessonNo: null }, 0), /EXP|sh-lesson/);
        assert.match(itemHtml({ ...v, title: '<img src=x>' }, 0), /&lt;img src=x&gt;/);
    });

    test('การ์ดล็อก: ครบโควตาวันนี้ (บอกจำนวน + ทางอัปเกรด) / แพลนไม่มีสิทธิ์ / เล่นไม่ได้ (ลองใหม่)', () => {
        const quota = shortsLockHtml('quota', { limit: 10 });
        assert.match(quota, /วันนี้ดู Shorts ครบ 10 คลิปแล้ว/);
        assert.match(quota, /PLUS/);
        assert.match(quota, /ดูแพลนของฉัน/);
        assert.match(shortsLockHtml('plan'), /แพลนของคุณยังดูคลิปนี้ไม่ได้/);
        const err = shortsLockHtml('error', { message: '<b>x</b>' });
        assert.match(err, /data-act="retry"/);
        assert.match(err, /&lt;b&gt;x&lt;\/b&gt;/);
    });
});

describe('หน้าดูคลิปยาว (watch.html)', () => {
    test('สถานะ: ยังไม่ดู / ดูแล้ว n% / ดูจบแล้ว และ EXP ที่จะได้หรือได้แล้ว', () => {
        assert.match(statusHtml(clip()), /ยังไม่ได้ดู/);
        assert.match(statusHtml(clip()), /aria-valuenow="0"/);
        const half = statusHtml(clip({ progress: { pct: 50, completed: false } }));
        assert.match(half, /ดูแล้ว 50%/);
        assert.match(half, /ดูจบรับ \+20 EXP/);
        const done = statusHtml(clip({ expEarned: 20, progress: { pct: 100, completed: true } }));
        assert.match(done, /ดูจบแล้ว/);
        assert.match(done, /ได้ 20 EXP แล้ว/);
        assert.match(statusHtml(clip({ progress: { pct: 140 } })), /aria-valuenow="100"/);
    });

    test('ข้อมูลคลิป: วิชา ความยาว หัวข้อ ปุ่มไปเรียนบทที่เกี่ยวข้อง คำอธิบายถูก escape', () => {
        const html = infoHtml(clip({ description: 'บรรทัด <b>1</b>' }));
        assert.match(html, /<span>🔬 วิทยาศาสตร์<\/span><span>10:00<\/span><span>ปฏิกิริยา<\/span>/);
        assert.match(html, /href="lesson\.html\?s=sci&l=1">ไปเรียนบทที่ 1/);
        assert.match(html, /บรรทัด &lt;b&gt;1&lt;\/b&gt;/);
        assert.doesNotMatch(infoHtml(clip({ lessonNo: null })), /wt-lesson/);
    });

    test('ภาพปก + ปุ่มเล่น (ยังไม่โหลด YouTube) บอก "ดูต่อจาก" เมื่อมีตำแหน่งค้าง', () => {
        const poster = posterHtml(clip(), 0);
        assert.match(poster, /data-act="play"/);
        assert.doesNotMatch(poster, /iframe|ดูต่อจาก/);
        assert.match(posterHtml(clip(), 120), /ดูต่อจาก 2:00/);
    });

    test('การ์ดล็อกของคลิปยาว: ครบ 5 คลิปวันนี้ บอกว่าคลิปที่เปิดไปแล้วยังดูซ้ำได้', () => {
        const html = watchLockHtml('quota', { limit: 5 });
        assert.match(html, /วันนี้ดูคลิปยาวครบ 5 คลิปแล้ว/);
        assert.match(html, /ดูซ้ำได้/);
        assert.match(watchLockHtml('error', { message: 'x' }), /data-act="play"/);
    });
});

describe('ตัวรายงานความคืบหน้า (video-tracker)', () => {
    function rig({ failOnce = false, slow = false } = {}) {
        const sent = [];
        let ticks = [];
        let clock = 0;
        let playing = true;
        let failed = false;
        let release = null;
        const api = {
            reportVideo: (id, body, opts) => {
                sent.push({ id, body, opts });
                if (failOnce && !failed) { failed = true; return Promise.reject(new Error('net')); }
                if (slow) return new Promise((r) => { release = () => r({ progress: { completed: false } }); });
                return Promise.resolve({ progress: { completed: Boolean(body.ended) } });
            }
        };
        const timers = {
            setInterval: (fn, ms) => { ticks.push({ fn, ms }); return ticks.length; },
            clearInterval: (h) => { ticks[h - 1] = null; }
        };
        const results = [];
        const tracker = createTracker({ api, videoId: 'sci-v-1', getTime: () => clock, isPlaying: () => playing, intervalMs: 3000, timers, onResult: (r) => results.push(r) });
        return {
            tracker, sent, results, timers,
            set time(v) { clock = v; }, set playing(v) { playing = v; },
            tick: () => ticks.forEach((t) => t && t.fn()),
            get intervals() { return ticks.filter(Boolean); },
            release: () => release && release()
        };
    }

    test('ส่งตำแหน่ง (ปัดลงเป็นวินาที) ทุกรอบขณะเล่น ข้ามเมื่อหยุดอยู่หรือยังไม่ขยับ', async () => {
        const r = rig();
        r.tracker.start();
        r.tracker.start();
        assert.equal(r.intervals.length, 1, 'start ซ้ำต้องไม่ตั้งเวลาซ้อน');
        assert.equal(r.intervals[0].ms, 3000);
        r.time = 12.8; r.tick(); await flush();
        r.tick(); await flush(); // ตำแหน่งเดิม
        r.playing = false; r.time = 20; r.tick(); await flush(); // หยุดอยู่
        assert.deepEqual(r.sent.map((s) => s.body), [{ position: 12 }]);
        assert.equal(r.sent[0].id, 'sci-v-1');
        assert.equal(r.results.length, 1);
    });

    test('หยุดชั่วคราวส่งทันที, จบคลิปส่ง ended แม้ตำแหน่งเดิม และ finished เป็นจริงเมื่อ Backend บอกว่าดูจบ', async () => {
        const r = rig();
        r.time = 30;
        await r.tracker.pause();
        assert.equal(r.tracker.finished, false);
        await r.tracker.ended();
        assert.deepEqual(r.sent.map((s) => s.body), [{ position: 30 }, { position: 30, ended: true }]);
        assert.equal(r.tracker.finished, true);
    });

    test('ส่งไม่สำเร็จ: รอบถัดไปส่งตำแหน่งเดิมใหม่ (ไม่ทิ้งความคืบหน้า)', async () => {
        const r = rig({ failOnce: true });
        r.tracker.start();
        r.time = 9; r.tick(); await flush();
        r.tick(); await flush();
        assert.deepEqual(r.sent.map((s) => s.body), [{ position: 9 }, { position: 9 }]);
        assert.equal(r.results.length, 1);
    });

    test('ระหว่างรอคำตอบ รอบถัดไปไม่ยิงซ้อน แต่การจบคลิปยังส่งได้', async () => {
        const r = rig({ slow: true });
        r.tracker.start();
        r.time = 5; r.tick();
        r.time = 8; r.tick();
        assert.equal(r.sent.length, 1);
        r.time = 9; r.tracker.ended();
        assert.deepEqual(r.sent.map((s) => s.body), [{ position: 5 }, { position: 9, ended: true }]);
        r.release();
        await flush();
    });

    test('stop: ยกเลิกตัวตั้งเวลา ส่งครั้งสุดท้ายแบบ keepalive ครั้งเดียว แล้วไม่ส่งอะไรอีก', async () => {
        const r = rig();
        r.tracker.start();
        r.time = 40;
        await r.tracker.stop({ keepalive: true });
        assert.equal(r.intervals.length, 0);
        assert.deepEqual(r.sent.at(-1), { id: 'sci-v-1', body: { position: 40 }, opts: { keepalive: true } });
        assert.equal(r.tracker.stop({ keepalive: true }), null);
        r.tracker.start();
        assert.equal(r.intervals.length, 0, 'หยุดแล้วเริ่มใหม่ไม่ได้');
        r.time = 50;
        assert.equal(await r.tracker.pause(), null);
        assert.equal(r.sent.length, 1);
    });

    test('ตำแหน่งที่อ่านไม่ได้ (NaN/ติดลบ) ส่งเป็น 0', async () => {
        const r = rig();
        r.time = NaN;
        await r.tracker.pause();
        r.time = -3;
        await r.tracker.ended();
        assert.deepEqual(r.sent.map((s) => s.body.position), [0, 0]);
    });
});

describe('เครื่องเล่น YouTube (yt-player)', () => {
    test('playerVars: ไม่แนะนำคลิปช่องอื่น เล่นในหน้า (iOS) ไม่มีคำอธิบายประกอบ และ start เป็นวินาทีเต็มไม่ติดลบ', () => {
        assert.deepEqual(playerVars(), { start: 0, autoplay: 0, mute: 0, controls: 1, playsinline: 1, rel: 0, iv_load_policy: 3, fs: 1, disablekb: 0 });
        assert.deepEqual(playerVars({ start: 120.9, autoplay: true, mute: true, controls: false }), { start: 120, autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0, iv_load_policy: 3, fs: 0, disablekb: 1 });
        assert.equal(playerVars({ start: -5 }).start, 0);
        assert.equal(playerVars({ start: 'x' }).start, 0);
    });

    test('รหัสสถานะตรงกับ YT.PlayerState', () => {
        assert.deepEqual({ ...YT_STATE }, { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 });
    });

    test('รหัสคลิปที่ไม่ใช่รูปแบบ YouTube (11 ตัว) ถูกปฏิเสธก่อนโหลดสคริปต์ของ YouTube', async () => {
        const doc = { createElement: () => { throw new Error('ไม่ควรโหลดสคริปต์'); }, head: { appendChild() {} } };
        for (const bad of ['', 'abc', 'aqz-KE-bpKQ1', '<script>xx', null]) {
            await assert.rejects(createPlayer({}, { videoId: bad }, { win: {}, doc }), /BAD_VIDEO_ID/);
        }
    });

    test('สร้างเครื่องเล่นผ่าน youtube-nocookie.com ส่ง playerVars และสถานะไปให้หน้า', async () => {
        const states = [];
        let options = null;
        const win = {
            YT: {
                Player: function Player(el, opts) { options = opts; this.el = el; setTimeout(() => { opts.events.onReady(); opts.events.onStateChange({ data: 1 }); }, 0); }
            }
        };
        const player = await createPlayer('EL', { videoId: 'aqz-KE-bpKQ', start: 30, autoplay: true, onState: (s) => states.push(s) }, { win, doc: {} });
        assert.equal(player.el, 'EL');
        assert.equal(options.host, 'https://www.youtube-nocookie.com');
        assert.equal(options.videoId, 'aqz-KE-bpKQ');
        assert.equal(options.playerVars.start, 30);
        assert.equal(options.playerVars.autoplay, 1);
        await flush();
        assert.deepEqual(states, [YT_STATE.PLAYING]);
    });

    test('YouTube แจ้งผิดพลาดก่อนพร้อม: Promise ล้มด้วยรหัส และแจ้ง onError', async () => {
        const codes = [];
        const win = { YT: { Player: function Player(_el, opts) { setTimeout(() => opts.events.onError({ data: 150 }), 0); } } };
        await assert.rejects(createPlayer('EL', { videoId: 'aqz-KE-bpKQ', onError: (c) => codes.push(c) }, { win, doc: {} }), /YOUTUBE_ERROR_150/);
        assert.deepEqual(codes, [150]);
    });

    test('โหลดสคริปต์ iframe_api ครั้งเดียว และไม่ทับ onYouTubeIframeAPIReady ของหน้าอื่น', async () => {
        const appended = [];
        let previousCalled = 0;
        const win = { onYouTubeIframeAPIReady: () => { previousCalled += 1; } };
        const doc = { createElement: () => ({}), head: { appendChild: (s) => appended.push(s) } };
        const p1 = loadYouTubeApi(win, doc);
        const p2 = loadYouTubeApi(win, doc);
        assert.equal(p1, p2);
        assert.equal(appended.length, 1);
        assert.equal(appended[0].src, 'https://www.youtube.com/iframe_api');
        win.YT = { Player: function Player() {} };
        win.onYouTubeIframeAPIReady();
        assert.equal(await p1, win.YT);
        assert.equal(previousCalled, 1);
    });

    test('ข้อความภาษาไทยของรหัสผิดพลาด', () => {
        assert.match(youtubeErrorText(100), /ถูกลบหรือตั้งเป็นส่วนตัว/);
        assert.match(youtubeErrorText(101), /ไม่อนุญาตให้เล่นนอก YouTube/);
        assert.equal(youtubeErrorText(150), youtubeErrorText(101));
        assert.match(youtubeErrorText(5), /เบราว์เซอร์/);
        assert.match(youtubeErrorText(2), /เล่นคลิปนี้ไม่ได้/);
    });
});

describe('API ของคลิปสอน (study-api.js)', () => {
    test('เส้นทาง วิธีเรียก และ keepalive ตรงกับ Backend', async () => {
        const sent = [];
        const api = createStudyApi(async (url, options) => { sent.push({ url, ...options }); return { ok: true, status: 200, json: async () => ({ success: true }) }; });
        await api.listVideos();
        await api.listVideos({ subject: 'sci', kind: 'short', offset: 12, limit: 12 });
        await api.getVideo('sci-v-1');
        await api.playVideo('sci-v-1');
        await api.reportVideo('sci-v-1', { position: 30 });
        await api.reportVideo('sci-v-1', { position: 31, ended: true }, { keepalive: true });
        assert.deepEqual(sent.map((s) => `${s.method} ${s.url}`), [
            'GET /api/study/videos', 'GET /api/study/videos?subject=sci&kind=short&offset=12&limit=12', 'GET /api/study/videos/sci-v-1',
            'POST /api/study/videos/sci-v-1/play', 'PUT /api/study/videos/sci-v-1/progress', 'PUT /api/study/videos/sci-v-1/progress'
        ]);
        assert.equal(sent[3].body, '{}');
        assert.equal(sent[4].body, '{"position":30}');
        assert.equal(sent[4].keepalive, undefined);
        assert.equal(sent[5].keepalive, true);
        assert.equal(sent[5].body, '{"position":31,"ended":true}');
    });
});

describe('ทางเข้า "คลิปสอนวิชานี้" ในหน้ารายวิชา', () => {
    test('แสดงเมื่อวิชามีคลิปเท่านั้น บอกจำนวนแต่ละชนิด และพาไปหน้ารวมคลิปของวิชานั้น', () => {
        assert.equal(videosEntryHtml('sci', null), '');
        assert.equal(videosEntryHtml('sci', { short: 0, long: 0 }), '');
        const both = videosEntryHtml('sci', { short: 4, long: 3 });
        assert.match(both, /href="videos\.html\?s=sci"/);
        assert.match(both, /Shorts 4 คลิป · คลิปยาว 3 คลิป/);
        assert.match(videosEntryHtml('sci', { short: 0, long: 2 }), /<span>คลิปยาว 2 คลิป<\/span>/);
    });
});

describe('หน้า HTML และการผูกกับ main.js', () => {
    const BAR_PAGES = ['index.html', 'subject.html', 'progress.html', 'course.html', 'report.html', 'videos.html'];
    const navOf = (html) => html.match(/<nav id="bottom-navbar"[\s\S]*?<\/nav>/)[0];

    for (const page of BAR_PAGES) {
        test(`${page}: แถบล่าง 5 ช่องเรียง กลับ · หน้าแรก · รายวิชา · คลิป · ความคืบหน้า และโหลด videos.css (Barba ไม่โหลด CSS ของหน้าใหม่)`, () => {
            const html = read(page);
            const nav = navOf(html);
            const items = [...nav.matchAll(/<a [^>]*class="nav-i[^"]*"[^>]*>/g)].map((m) => (m[0].match(/data-nav="([^"]+)"/) || [, 'back'])[1]);
            assert.deepEqual(items, ['back', 'home', 'subject', 'videos', 'progress']);
            assert.match(nav, /<a href="videos\.html" data-nav="videos" class="nav-i[^"]*"[^>]*>[\s\S]*?<span class="nav-label nav-l">คลิป<\/span>/);
            const css = [...html.matchAll(/<link rel="stylesheet" href="css\/([^"]+)">/g)].map((m) => m[1]);
            assert.ok(css.includes('videos.css'), 'ต้องลิงก์ css/videos.css');
            assert.ok(css.indexOf('videos.css') < css.indexOf('dark.css'), 'dark.css ต้องมาหลัง videos.css');
        });
    }

    test('videos.html: เป็นหน้า Barba (namespace videos) แท็บ "คลิป" ถูกเลือก และระหว่างโหลดเป็นโครงเปล่า', () => {
        const html = read('videos.html');
        assert.match(html, /<main id="vdRoot"[^>]*data-barba="container" data-barba-namespace="videos">/);
        assert.match(html, /data-nav="videos" class="nav-i on" aria-current="page"/);
        const body = html.match(/<div id="vdBody">([\s\S]*?)<\/main>/);
        assert.ok(body, 'ต้องมี #vdBody');
        assert.match(body[1], /skl|sk-/);
        assert.doesNotMatch(body[1], /vd-lc|vd-sc|EXP/);
    });

    for (const [page, mod] of [['shorts.html', 'study-shorts.js'], ['watch.html', 'study-watch.js']]) {
        test(`${page}: ตั้งธีมก่อนวาด (theme.js) dark.css + skins.css เป็น CSS ท้ายสุด ตรวจสิทธิ์เหมือนทุกหน้า และโหลด ${mod}`, () => {
            const html = read(page);
            assert.match(html, /<script src="\/js\/theme\.js"><\/script>/);
            const css = [...html.matchAll(/<link rel="stylesheet" href="css\/([^"]+)">/g)].map((m) => m[1]);
            assert.deepEqual(css.slice(-2), ['dark.css', 'skins.css']);
            assert.ok(css.includes('videos.css'));
            for (const s of ['js/auth.js', 'js/api-client.js', `js/${mod}`]) assert.match(html, new RegExp(`<script type="module" src="${s.replace('.', '\\.')}"></script>`));
            assert.match(html, /<script src="js\/main\.js"><\/script>/);
            assert.doesNotMatch(html, /bottom-navbar/, 'หน้าเต็มจอ/หน้ากลุ่มเรียนไม่มีแถบล่าง');
        });
    }

    test('main.js: หน้า videos เข้าระบบ Barba (หัวหน้า ชื่อหน้า init/dispose) และ shorts/watch เป็นหน้าโหลดเต็ม', () => {
        const js = read('js/main.js');
        assert.match(js, /function initVideosPageIn\(container, url\)/);
        assert.match(js, /initVideosPageIn\(container, url\);/);
        assert.match(js, /__videosCtl\.dispose\(\)/);
        assert.match(js, /title: 'คลิปสอน'/);
        assert.match(js, /FLOW_PAGE_PATTERN = \/[^\n]*shorts\|watch/);
    });

    test('จอแคบ (< 360px): ป้ายแถบล่างย่อลงให้ "ความคืบหน้า" ไม่ถูกตัด', () => {
        assert.match(read('css/style.css'), /@media \(max-width: 359px\) \{ \.nav-l \{ font-size: 11px;/);
    });
});
