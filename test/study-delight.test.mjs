// ทดสอบแอนิเมชันเพิ่มความสนุก (js/study-delight.js + css/delight.css) และส่วน "ส่วนที่ยังพลาดบ่อย" ของหน้าความคืบหน้า
// ทุกเอฟเฟกต์ต้อง: ปลอดภัยเมื่อไม่มี DOM, ไม่ทำอะไรเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว, และปิดใน CSS ด้วย prefers-reduced-motion
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = { scrollTo() {}, innerHeight: 700 };
globalThis.document = { querySelector: () => null, addEventListener() {}, createElement: () => ({}) };

const D = await import('../js/study-delight.js');
const H = await import('../js/study-hydrate.js');
const css = readFileSync(new URL('../css/delight.css', import.meta.url), 'utf8');
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

describe('ตัวเลขสถิติ', () => {
    test('แยกและประกอบกลับในรูปเดิม: คั่นหลักพัน เปอร์เซ็นต์ หน่วย', () => {
        assert.deepEqual(D.parseStat('2,480'), { prefix: '', value: 2480, suffix: '', grouped: true });
        assert.deepEqual(D.parseStat('88%'), { prefix: '', value: 88, suffix: '%', grouped: false });
        assert.deepEqual(D.parseStat(' 248 ข้อ '), { prefix: '', value: 248, suffix: ' ข้อ', grouped: false });
        assert.deepEqual(D.parseStat('Lv. 14'), { prefix: 'Lv. ', value: 14, suffix: '', grouped: false });
        for (const [text, n] of [['2,480', 1200], ['88%', 44], ['248 ข้อ', 3], ['Lv. 14', 7]]) {
            const stat = D.parseStat(text);
            assert.equal(D.formatStat(stat, n), text.replace(/\d[\d,]*/, stat.grouped ? n.toLocaleString('en-US') : String(n)));
            assert.equal(D.formatStat(stat, stat.value), text.trim(), 'ค่าสุดท้ายตรงกับข้อความจริงเป๊ะ');
        }
    });
    test('ไม่ใช่ตัวเลข (—, ว่าง, หลายตัวเลขปนกัน, ใหญ่เกิน) = ไม่นับ ไม่เดา', () => {
        for (const text of ['—', '', null, undefined, 'ยอดเยี่ยม', '3 จาก 12', '99999999999']) assert.equal(D.parseStat(text), null, String(text));
    });
});

describe('ใกล้เส้นชัย (Goal-gradient)', () => {
    test('80–99% เท่านั้น: ครบ 100% แล้วหรือยังห่างไม่ใช่', () => {
        assert.deepEqual([0, 79, 80, 99, 100, NaN].map(D.isNearComplete), [false, false, true, true, false, false]);
    });
    test('markNearBars: เรืองแสงเฉพาะแถบที่ใกล้ครบ ใส่ป้ายครั้งเดียวต่อการ์ด และเอาออกเมื่อไม่ใกล้แล้ว', () => {
        const cls = new Set();
        const bar = { classList: { toggle: (n, on) => (on ? cls.add(n) : cls.delete(n)) } };
        let chips = 0;
        const host = { insertAdjacentHTML: (_, html) => { if (/near-chip/.test(html)) chips++; } };
        const card = { querySelector: (s) => (s === '.near-chip' ? (chips ? {} : null) : s.includes('mp-t') ? host : null) };
        const fill = (w) => ({ style: { width: w }, parentElement: bar, closest: () => card });
        let fills = [fill('85%')];
        const scope = { querySelectorAll: () => fills };
        assert.equal(D.markNearBars(scope), 1);
        assert.equal(D.markNearBars(scope), 1);
        assert.equal(chips, 1, 'ป้ายครั้งเดียว');
        assert.ok(cls.has('near'));
        fills = [fill('40%')];
        assert.equal(D.markNearBars(scope), 0);
        assert.ok(!cls.has('near'));
        assert.equal(D.markNearBars(null), 0);
    });
});

describe('ปลอดภัยเมื่อไม่มี DOM / ผู้ใช้ลดการเคลื่อนไหว', () => {
    test('ไม่มี matchMedia/createElement (Node) = ไม่ทำอะไร ไม่พัง', () => {
        assert.equal(D.countStats({ querySelectorAll: () => [] }), 0);
        assert.equal(D.revealOnScroll({ querySelectorAll: () => [] }), 0);
        assert.equal(D.celebrateMilestones({ querySelectorAll: () => [] }), 0);
        assert.equal(D.breatheCta({ querySelector: () => null }), null);
        assert.equal(D.ensureSparkles(null), null);
        assert.equal(D.bindRipple(null), false);
        assert.doesNotThrow(() => D.enhancePage(null));
        assert.doesNotThrow(() => D.settle(undefined));
        assert.doesNotThrow(() => D.enhancePage({ querySelectorAll() { throw new Error('boom'); } }), 'ข้อผิดพลาดของเอฟเฟกต์ถูกกลืน');
    });
    test('รหัสฉลองรายวิชา', () => assert.equal(D.milestoneKey('sci'), 'study:done:sci'));
    test('CSS: ทุกแอนิเมชันที่วนไม่รู้จบถูกปิดเมื่อตั้ง prefers-reduced-motion และเนื้อหาที่ซ่อนรอโผล่ถูกเปิดให้เห็น', () => {
        const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion'));
        for (const sel of ['.amb', '.bar > i::after', '.bar.near > i', '.near-chip', '.qs-l svg', '.pod .starchip svg', '.breathe', '.rpl', '.wk-fire', '.wk-miss', '.timer.warn', '.timer.crit', '.lf-rank']) assert.ok(reduced.includes(sel), sel);
        assert.match(reduced, /\.rv \{ opacity: 1; transform: none; \}/);
        const infinite = [...css.matchAll(/@keyframes (\w+)/g)].map((m) => m[1]);
        for (const name of ['ambRise', 'barSweep', 'barNear', 'nearPop', 'flameFlicker', 'starTwinkle', 'boltZap', 'breathe', 'rplOut', 'wkGrow', 'timerBeat', 'rankBeat']) assert.ok(infinite.includes(name), name);
    });
    test('ทุกหน้าโหลด delight.css; main.js เรียก enhancePage; hydrate เรียก settle', () => {
        for (const page of ['index', 'subject', 'progress', 'course', 'lesson', 'mock-exam', 'report']) assert.match(read(`${page}.html`), /href="css\/delight\.css"/, page);
        assert.match(read('js/main.js'), /study-delight\.js'\)\.then\(\(d\) => d\.enhancePage\(container\)\)/);
        assert.match(read('js/study-hydrate.js'), /import \{ settle \} from '\.\/study-delight\.js'/);
    });
});

describe('ส่วนที่ยังพลาดบ่อย (หน้าความคืบหน้า)', () => {
    const weak = {
        minAnswers: 3, belowPct: 60, hasAnswers: true,
        items: [
            { subjectId: 'sci', subjectTitle: 'วิทยาศาสตร์', emoji: '🔬', hue: 'emerald', lessonNo: 2, lessonTitle: 'แรง <b>และ</b> การเคลื่อนที่', wrong: 8, total: 12, accuracy: 33,
              topics: [{ topic: 'สมดุลแรง', wrong: 4, total: 5, accuracy: 20 }, { topic: 'ความเร่ง', wrong: 3, total: 3, accuracy: 0 }] },
            { subjectId: 'mat', subjectTitle: 'คณิตศาสตร์', emoji: null, hue: null, lessonNo: 5, lessonTitle: 'สมการ', wrong: 4, total: 6, accuracy: 33, topics: [{ topic: 'เศษส่วน', wrong: 4, total: 6, accuracy: 33 }] },
        ],
    };
    test('การ์ดต่อบท: หัวข้อที่ผิดพร้อมแถบสีแดง และปุ่ม "ทบทวนบทนี้" ที่เข้าหน้าเรียนของบทนั้น', () => {
        const h = H.weakSectionHtml(weak);
        assert.equal((h.match(/class="wk-card"/g) || []).length, 2);
        assert.match(h, /href="lesson\.html\?s=sci&l=2"[\s\S]*?ทบทวนบทนี้/);
        assert.match(h, /href="lesson\.html\?s=mat&l=5"/);
        assert.match(h, /บทที่ 2 แรง &lt;b&gt;และ&lt;\/b&gt; การเคลื่อนที่/, 'ชื่อบทถูก escape');
        assert.doesNotMatch(h, /<b>และ<\/b>/);
        assert.match(h, /ผิด 4\/5 ข้อ/);
        assert.match(h, /ผิด 8 ข้อ/);
        assert.match(h, /wk-bar[^>]*><i style="width:80%"/, 'ยิ่งผิดมากแถบยิ่งยาว (100 − ความแม่นยำ)');
        assert.match(h, /ตอบไปอย่างน้อย 3 ข้อ แล้วถูกไม่ถึง 60%/);
        assert.match(h, /📘/, 'ไม่มีอีโมจิวิชา = ใช้ค่าเริ่มต้น');
    });
    test('ไม่มีส่วนที่พลาดบ่อย: ชื่นชม (ถ้าเคยตอบ) หรือชวนทำ Quiz (ถ้ายังไม่เคย); Backend รุ่นเก่าไม่ส่ง weak = ไม่แสดงส่วนนี้', () => {
        assert.match(H.weakSectionHtml({ ...weak, items: [] }), /ยอดเยี่ยม/);
        assert.match(H.weakSectionHtml({ ...weak, items: [], hasAnswers: false }), /ทำ Quiz หรือ Mock Exam สักครั้ง/);
        assert.equal(H.weakSectionHtml(undefined), '');
        assert.equal(H.weakSectionHtml({}), '');
    });
    test('อยู่ในส่วน "ผลการเรียนของฉัน" ก่อนรายวิชา; แถวที่เรียนครบ 100% ติด data-done สำหรับฉลอง', () => {
        const subjects = [{ id: 'sci', title: 'วิทย์', emoji: '🔬', hue: 'emerald', lessonsTotal: 4, lessonsDone: 4, pct: 100, lastActivityAt: 1, current: null }, { id: 'mat', title: 'คณิต', emoji: '📐', hue: 'sky', lessonsTotal: 4, lessonsDone: 1, pct: 25, lastActivityAt: 2, current: { no: 2, title: 'บท 2' } }];
        const progress = { overall: { lessonsDone: 5, lessonsTotal: 8, pct: 63, subjectsStarted: 2, subjectsCompleted: 1 }, answers: { total: 9, correct: 5, accuracy: 56 }, recent: [], weak };
        const h = H.progressSectionHtml(subjects, progress);
        assert.ok(h.indexOf('wk-card') > 0 && h.indexOf('wk-card') < h.indexOf('mp-list'));
        assert.match(h, /href="report\.html\?s=sci" data-subject="sci" data-done="1"/);
        assert.doesNotMatch(h.match(/<a class="mp-row[^>]*href="report\.html\?s=mat"[^>]*>/)[0], /data-done/);
    });
});
