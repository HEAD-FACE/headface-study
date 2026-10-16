// ทดสอบชั้นข้อมูลตัวอย่างของหน้าเรียน (js/study-data.js): โครงหลักสูตร สถานะบทเรียน โจทย์ การตรวจคะแนน และที่เก็บความคืบหน้า
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../js/study-data.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function memoryStorage() {
    const data = new Map();
    return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data };
}

describe('วิชา', () => {
    test('มี 10 วิชา และชื่อ/จำนวนบทตรงกับการ์ดรายวิชา', () => {
        assert.equal(D.SUBJECT_ORDER.length, 10);
        const sci = D.getSubject('sci');
        assert.equal(sci.title, 'วิทยาศาสตร์');
        assert.equal(sci.lessons, 16);
        assert.equal(sci.pct, 75);
        for (const key of D.SUBJECT_ORDER) {
            const s = D.getSubject(key);
            assert.ok(s.meta.startsWith(`${s.lessons} บทเรียน`), `${key}: meta "${s.meta}" ต้องขึ้นต้นด้วยจำนวนบทเรียน`);
        }
    });

    test('key ที่ไม่มี (รวมถึงชื่อใน prototype) ต้องไม่ถูกมองเป็นวิชา', () => {
        for (const bad of ['', 'xyz', '__proto__', 'constructor', 'toString', undefined, null]) assert.equal(D.getSubject(bad), null, String(bad));
        assert.equal(D.buildOutline('nope'), null);
    });
});

describe('โครงหลักสูตร', () => {
    test('วิทยาศาสตร์: 16 บท แบ่งหน่วยละ 4, เรียนจบ 12 บท, บทที่ 13 กำลังเรียน', () => {
        const o = D.buildOutline('sci');
        assert.equal(o.total, 16);
        assert.equal(o.units.length, 4);
        assert.deepEqual(o.units.map((u) => u.lessons.length), [4, 4, 4, 4]);
        assert.equal(o.doneCount, 12);
        assert.equal(o.current.n, 13);
        assert.equal(o.current.status, 'now');
        assert.equal(o.currentUnit, 4);
        assert.equal(o.lessons[0].status, 'done');
        assert.equal(o.lessons[14].status, 'todo');
        assert.equal(o.pct, 75);
        assert.deepEqual(o.units.map((u) => u.complete), [true, true, true, false]);
    });

    test('ทุกวิชา: ผลรวมบทในหน่วย = จำนวนบททั้งหมด และมีบทที่ค้างอยู่เสมอตอนเริ่มต้น', () => {
        for (const key of D.SUBJECT_ORDER) {
            const o = D.buildOutline(key);
            assert.equal(o.units.reduce((n, u) => n + u.lessons.length, 0), o.total, key);
            assert.ok(o.current, `${key}: ต้องมีบทที่ค้างอยู่`);
            assert.equal(o.current.n, D.baseCurrentLesson(o.subject), key);
        }
    });

    test('ชื่อบทที่ค้างอยู่ตรงกับการ์ด "ทำต่อ" ของหน้าแรก ส่วนบทอื่นเป็นข้อความตัวอย่าง', () => {
        assert.equal(D.buildOutline('sci').current.title, 'กรด-เบสและการแตกตัว');
        assert.equal(D.buildOutline('phy').current.title, 'การเคลื่อนที่แบบฮาร์มอนิกอย่างง่าย');
        assert.equal(D.buildOutline('mat').current.title, 'ลิมิตและความต่อเนื่องของฟังก์ชัน');
        assert.equal(D.buildOutline('eng').current.title, 'Grammar & Error Identification');
        assert.equal(D.lessonTitle('sci', 1), D.PLACEHOLDER_LESSON);
        assert.equal(D.buildOutline('tha').current.title, D.PLACEHOLDER_LESSON);
    });

    test('resolveLessonNo: current / เลขบท / ค่าไม่ถูกต้อง', () => {
        assert.equal(D.resolveLessonNo('sci', 'current'), 13);
        assert.equal(D.resolveLessonNo('sci', undefined), 13);
        assert.equal(D.resolveLessonNo('sci', '5'), 5);
        assert.equal(D.resolveLessonNo('sci', '16'), 16);
        for (const bad of ['0', '17', '-1', '1.5', 'abc', '1e2', ' 3', '5x']) assert.equal(D.resolveLessonNo('sci', bad), null, bad);
        assert.equal(D.resolveLessonNo('nope', '1'), null);
    });
});

describe('ความคืบหน้าของผู้ใช้', () => {
    test('อ่านจบอย่างเดียวยังไม่ถือว่าเรียนจบ (แยกสถานะอ่าน/ประเมิน), ต้องทำ Quiz ด้วย', () => {
        const store = D.createStore(memoryStorage());
        store.markRead('sci', 13);
        let o = D.buildOutline('sci', store);
        assert.equal(o.lessons[12].content, true);
        assert.equal(o.lessons[12].quiz, false);
        assert.equal(o.lessons[12].done, false);
        assert.equal(o.doneCount, 12);

        store.saveQuiz('sci', 13, { correct: 4, total: 5 });
        o = D.buildOutline('sci', store);
        assert.equal(o.lessons[12].done, true);
        assert.equal(o.doneCount, 13);
        assert.equal(o.current.n, 14);
        assert.equal(o.pct, 81); // 13/16
    });

    test('บทที่เริ่มทำแล้วแต่ยังไม่จบเป็นสถานะ "กำลังเรียน"', () => {
        const store = D.createStore(memoryStorage());
        store.markPractice('sci', 15, 0, true);
        const o = D.buildOutline('sci', store);
        assert.equal(o.lessons[14].status, 'now');
        assert.equal(o.lessons[14].practice, true);
        assert.equal(o.lessons[14].done, false);
    });

    test('บันทึกลง storage และโหลดกลับมาได้, ข้อมูลเสียไม่ทำให้พัง', () => {
        const storage = memoryStorage();
        const a = D.createStore(storage, () => new Date('2026-10-13T08:00:00Z'));
        a.markRead('mat', 3);
        a.addMock('mat', { correct: 6, total: 10, seconds: 321 });
        const b = D.createStore(storage);
        assert.equal(b.lesson('mat', 3).read, true);
        assert.equal(b.mocks('mat').length, 1);
        assert.equal(b.mocks('mat')[0].at, '2026-10-13T08:00:00.000Z');

        const broken = memoryStorage();
        broken.setItem('headface-study-demo-v1', '{not json');
        assert.doesNotThrow(() => D.createStore(broken));
        assert.deepEqual(D.createStore(broken).mocks('mat'), []);
        assert.doesNotThrow(() => D.createStore(null).markRead('sci', 1));

        b.clear();
        assert.equal(D.createStore(storage).lesson('mat', 3).read, undefined);
    });

    test('storage ที่เขียนไม่ได้ (เต็ม/ปิด) ไม่ทำให้ UI ล้ม', () => {
        const throwing = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('x'); } };
        const store = D.createStore(throwing);
        assert.doesNotThrow(() => store.markRead('sci', 1));
        assert.equal(store.lesson('sci', 1).read, true);
        assert.doesNotThrow(() => store.clear());
    });
});

describe('โจทย์ตัวอย่างและการตรวจคะแนน', () => {
    test('Quiz: 5 ข้อ 4 ตัวเลือก เฉลยอยู่ในช่วง และคงที่ทุกครั้ง', () => {
        const a = D.makeQuiz('sci', 13);
        assert.equal(a.length, 5);
        for (const q of a) {
            assert.equal(q.choices.length, 4);
            assert.ok(q.answer >= 0 && q.answer <= 3);
            assert.ok(q.text.startsWith('[') && q.explanation.startsWith('['), 'ต้องเป็นข้อความตัวอย่างในวงเล็บเหลี่ยม');
        }
        assert.deepEqual(a, D.makeQuiz('sci', 13));
    });

    test('Practice: 6 ข้อ มีระดับความยากครบ ง่าย/กลาง/ยาก', () => {
        const p = D.makePractice('sci', 13);
        assert.equal(p.length, 6);
        assert.deepEqual([...new Set(p.map((x) => x.level))], ['ง่าย', 'กลาง', 'ยาก']);
    });

    test('Mock: ตามค่าตัวอย่าง และยังไม่กำหนดคะแนนผ่าน', () => {
        const m = D.makeMock('mat');
        assert.equal(m.items.length, D.MOCK_SAMPLE.questions);
        assert.equal(m.passMark, null);
        assert.ok(m.minutes > 0);
    });

    test('scoreAnswers นับถูก/ผิด/ยังไม่ตอบ', () => {
        const qs = D.makeQuiz('sci', 1);
        const picks = [qs[0].answer, (qs[1].answer + 1) % 4, null, qs[3].answer, undefined];
        const r = D.scoreAnswers(qs, picks);
        assert.deepEqual({ c: r.correct, t: r.total, a: r.answered, w: r.wrong, p: r.percent }, { c: 2, t: 5, a: 3, w: [1], p: 40 });
        assert.equal(D.scoreAnswers([], []).percent, 0);
    });

    test('ข้อความสรุปคะแนนและรูปแบบเวลา', () => {
        assert.equal(D.scoreMessage(100), 'ยอดเยี่ยม');
        assert.equal(D.scoreMessage(60), 'ทำได้ดี');
        assert.equal(D.scoreMessage(10), 'ลองกลับไปทบทวนเนื้อหาอีกครั้ง');
        assert.equal(D.formatClock(0), '00:00');
        assert.equal(D.formatClock(75), '01:15');
        assert.equal(D.formatClock(-5), '00:00');
        assert.equal(D.formatClock(20 * 60), '20:00');
        assert.equal(D.formatThaiDate('not a date'), '');
    });
});

describe('ลิงก์ไปหน้าเรียน', () => {
    test('สร้าง URL ที่ถูกต้อง', () => {
        assert.equal(D.courseUrl('sci'), 'course.html?s=sci');
        assert.equal(D.lessonUrl('sci'), 'lesson.html?s=sci&l=current');
        assert.equal(D.lessonUrl('sci', 5, 'quiz'), 'lesson.html?s=sci&l=5&tab=quiz');
        assert.equal(D.mockUrl(), 'mock-exam.html');
        assert.equal(D.mockUrl('mat'), 'mock-exam.html?s=mat');
    });

    test('ทุกลิงก์ไปหน้าเรียนใน index/subject/progress ชี้ไปวิชาที่มีจริง', () => {
        const pages = ['index.html', 'subject.html', 'progress.html'];
        let found = 0;
        for (const page of pages) {
            const html = readFileSync(path.join(ROOT, page), 'utf8');
            for (const m of html.matchAll(/href="(course|lesson|mock-exam)\.html(?:\?([^"]*))?"/g)) {
                found++;
                const params = new URLSearchParams((m[2] || '').replaceAll('&amp;', '&'));
                if (m[1] === 'mock-exam' && !params.has('s')) continue; // หน้าเลือกวิชา
                assert.ok(D.getSubject(params.get('s')), `${page}: ${m[0]} ชี้ไปวิชาที่ไม่มี`);
            }
        }
        assert.ok(found >= 10, `พบลิงก์ไปหน้าเรียนเพียง ${found} ลิงก์`);
    });

    test('หน้าเรียนทุกหน้ามี guard ตรวจสิทธิ์ (auth.js + main.js) และไม่ hard-code URL', () => {
        for (const page of ['course.html', 'lesson.html', 'mock-exam.html']) {
            const html = readFileSync(path.join(ROOT, page), 'utf8');
            assert.match(html, /src="js\/auth\.js"/, `${page}: ต้องโหลด js/auth.js`);
            assert.match(html, /src="js\/main\.js"/, `${page}: ต้องโหลด js/main.js (ตรวจเซสชัน)`);
            assert.match(html, /<meta name="viewport"/, page);
        }
        // หน้ากิจกรรมและ Mock Exam มีตัวควบคุมของตัวเอง; หน้าเส้นทางเรียนอยู่ใน Barba และถูกเติมโดย main.js → study-course.js
        for (const page of ['lesson.html', 'mock-exam.html']) {
            assert.match(readFileSync(path.join(ROOT, page), 'utf8'), /src="js\/study-flow\.js"/, `${page}: ต้องโหลด js/study-flow.js`);
        }
    });

    test('หน้าเส้นทางเรียน (course.html) เป็นหน้า Barba ที่ใช้พื้นที่สีเขียวถาวรร่วมกับหน้าหลัก', () => {
        const course = readFileSync(path.join(ROOT, 'course.html'), 'utf8');
        assert.match(course, /data-barba="wrapper"/);
        assert.match(course, /data-barba="container"[^>]*data-barba-namespace="course"|data-barba-namespace="course"[^>]*data-barba="container"/);
        assert.match(course, /id="mainBlueBg"/);
        assert.match(course, /<header id="shared-top-header" class="hdr is-covered">/, 'แถบหัวร่วมถูกซ้อนไว้เมื่อโหลดหน้านี้ตรง ๆ');
        assert.match(course, /src="https:\/\/unpkg\.com\/@barba\/core"/);
        assert.match(course, /gsap\.min\.js/);
        assert.doesNotMatch(course, /study-flow\.js/, 'ไม่ใช้ตัวควบคุมของหน้าเรียนแบบเดิม');
        for (const page of ['index.html', 'subject.html', 'progress.html', 'course.html']) {
            assert.match(readFileSync(path.join(ROOT, page), 'utf8'), /href="css\/course\.css"/, `${page}: Barba ไม่โหลด CSS ของหน้าใหม่ จึงต้องมี course.css ในทุกหน้า`);
        }
        const main = readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
        assert.match(main, /HEADER_HEIGHTS = \{[^}]*'course'/);
        assert.match(main, /NAV_FOR_NAMESPACE = \{ course: 'subject' \}/);
    });
});
