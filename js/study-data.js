/**
 * js/study-data.js — ข้อมูลตัวอย่าง (placeholder) และตัวช่วยสำหรับหน้าเรียน: course / lesson / mock-exam
 *
 * ⚠️ ยังไม่มีตารางข้อมูลการเรียนใน Backend (วิชา หน่วย บทเรียน โจทย์ ผลสอบ) ไฟล์นี้จึงจำลองข้อมูลตาม
 * โครงสร้างใน Blueprint (วิชา → หน่วย → บทเรียน → Content / Quiz / Practice และ Mock Test ประจำวิชา)
 * เพื่อให้ UI ใช้งานและทดสอบได้ครบ เมื่อมีข้อมูลจริง ให้เปลี่ยนเฉพาะฟังก์ชันในไฟล์นี้ (หน้า UI ไม่ต้องแก้)
 *   - ชื่อวิชา จำนวนบทเรียน และความคืบหน้ารวม ใช้ค่าเดียวกับการ์ดรายวิชาที่แสดงอยู่แล้ว
 *   - ชื่อหน่วย ชื่อบทเรียน เนื้อหา โจทย์ เฉลย เป็น [ข้อความตัวอย่าง] ไม่ใช่เนื้อหาหลักสูตรจริง
 *   - ความคืบหน้าที่ผู้ใช้ทำในหน้าเหล่านี้เก็บไว้ที่ localStorage ของเบราว์เซอร์เท่านั้น (ไม่ส่งไป Backend)
 */

export const DEMO_NOTE = 'โครงร่าง UI: เนื้อหา โจทย์ และคะแนนในหน้านี้เป็นข้อมูลตัวอย่าง รอเชื่อมข้อมูลจริง';

// ───────────── วิชา (ชื่อ/จำนวนบทเรียน/ความคืบหน้า ตรงกับการ์ดรายวิชา) ─────────────
const S = (no, hue, emoji, eyebrow, title, meta, lessons, pct) => ({ no, hue, emoji, eyebrow, title, meta, lessons, pct });
export const SUBJECTS = {
    sci: { key: 'sci', ...S(1, 'emerald', '🔬', 'วิชาที่ 1 • วิทยาศาสตร์', 'วิทยาศาสตร์', '16 บทเรียน • 110 แบบฝึกหัด', 16, 75) },
    mat: { key: 'mat', ...S(2, 'sky', '📐', 'วิชาที่ 2 • คณิตศาสตร์', 'คณิตศาสตร์', '18 บทเรียน • 120 แบบฝึกหัด', 18, 65) },
    tha: { key: 'tha', ...S(3, 'rose', '✍️', 'วิชาที่ 3 • ภาษาไทย', 'ภาษาไทย', '12 บทเรียน • 80 ข้อสอบวิเคราะห์', 12, 85) },
    eng: { key: 'eng', ...S(4, 'violet', '🌍', 'วิชาที่ 4 • ภาษาต่างประเทศ', 'ภาษาอังกฤษ', '20 บทเรียน • คลังศัพท์ 450 คำ', 20, 55) },
    soc: { key: 'soc', ...S(5, 'amber', '🏛️', 'วิชาที่ 5 • สังคมศึกษา', 'สังคมศึกษา', '15 บทเรียน • 90 แนวข้อสอบ', 15, 40) },
    his: { key: 'his', ...S(6, 'orange', '📜', 'วิชาที่ 6 • ประวัติศาสตร์', 'ประวัติศาสตร์', '10 บทเรียน • 60 แบบทดสอบ', 10, 50) },
    phy: { key: 'phy', ...S(7, 'cyan', '⚛️', 'วิชาที่ 7 • วิทยาศาสตร์สากล', 'วิทยาศาสตร์สากล', '14 บทเรียน • ฟิสิกส์ & อนุภาคสากล', 14, 60) },
    inf: { key: 'inf', ...S(8, 'blue', '♾️', 'วิชาที่ 8 • คณิตศาสตร์สากล', 'คณิตศาสตร์สากล', '16 บทเรียน • แคลคูลัส & พีชคณิตสากล', 16, 70) },
    chn: { key: 'chn', ...S(9, 'red', '🏮', 'วิชาที่ 9 • ภาษาจีน', 'ภาษาจีน', '15 บทเรียน • ไวยากรณ์ HSK & สนทนา', 15, 45) },
    iel: { key: 'iel', ...S(10, 'indigo', '🎓', 'วิชาที่ 10 • ภาษาต่างประเทศ', 'ภาษาอังกฤษเพิ่มเติม', '18 บทเรียน • Academic Writing & IELTS', 18, 65) },
};
export const SUBJECT_ORDER = Object.keys(SUBJECTS);

export function getSubject(key) {
    return Object.prototype.hasOwnProperty.call(SUBJECTS, key) ? SUBJECTS[key] : null;
}

// บทเรียนที่ค้างอยู่ซึ่งแสดงในส่วน "ทำต่อ" ของหน้าแรก (ใช้ชื่อเดียวกับการ์ดนั้น)
const KNOWN_CURRENT_TITLES = {
    sci: 'กรด-เบสและการแตกตัว',
    phy: 'การเคลื่อนที่แบบฮาร์มอนิกอย่างง่าย',
    mat: 'ลิมิตและความต่อเนื่องของฟังก์ชัน',
    eng: 'Grammar & Error Identification',
};

// ───────────── โครงสร้างหน่วย/บทเรียน (ตัวอย่าง: หน่วยละ 4 บท) ─────────────
export const UNIT_SIZE = 4;
export const PLACEHOLDER_LESSON = '[ชื่อบทเรียน]';
export const PLACEHOLDER_UNIT = '[ชื่อหน่วยการเรียนรู้]';

/** จำนวนบทเรียนที่ถือว่าเรียนจบแล้วตามความคืบหน้ารวมของวิชา (ค่าตั้งต้น ก่อนที่ผู้ใช้ทำกิจกรรมในหน้าเหล่านี้) */
export function baseDoneCount(subject) {
    return Math.floor((subject.lessons * subject.pct) / 100);
}

/** บทเรียนที่ค้างอยู่ตามค่าตั้งต้น = บทถัดจากที่เรียนจบแล้ว (ไม่เกินจำนวนบททั้งหมด) */
export function baseCurrentLesson(subject) {
    return Math.min(baseDoneCount(subject) + 1, subject.lessons);
}

export function lessonTitle(key, n) {
    const subject = getSubject(key);
    if (subject && KNOWN_CURRENT_TITLES[key] && n === baseCurrentLesson(subject)) return KNOWN_CURRENT_TITLES[key];
    return PLACEHOLDER_LESSON;
}

// ───────────── ที่เก็บความคืบหน้าฝั่งผู้ใช้ (localStorage) ─────────────
const STORE_KEY = 'headface-study-demo-v1';
const emptyState = () => ({ lessons: {}, mocks: {} });

export function createStore(storage, now = () => new Date()) {
    let state = emptyState();
    try {
        const raw = storage && storage.getItem(STORE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') state = { lessons: parsed.lessons || {}, mocks: parsed.mocks || {} };
    } catch (_) { state = emptyState(); }

    const persist = () => { try { if (storage) storage.setItem(STORE_KEY, JSON.stringify(state)); } catch (_) { /* ที่เก็บเต็ม/ถูกปิด: ใช้ในหน่วยความจำต่อ */ } };
    const rec = (key, n) => (state.lessons[`${key}:${n}`] ||= {});

    return {
        get state() { return state; },
        lesson(key, n) { return state.lessons[`${key}:${n}`] || {}; },
        markRead(key, n) { rec(key, n).read = true; persist(); },
        unmarkRead(key, n) { delete rec(key, n).read; persist(); },
        saveQuiz(key, n, result) { rec(key, n).quiz = { correct: result.correct, total: result.total, at: now().toISOString() }; persist(); },
        markPractice(key, n, index, ok) { (rec(key, n).practice ||= {})[index] = ok ? 'ok' : 'wrong'; persist(); },
        clearPractice(key, n) { delete rec(key, n).practice; persist(); },
        addMock(key, attempt) { (state.mocks[key] ||= []).push({ ...attempt, at: now().toISOString() }); persist(); },
        mocks(key) { return state.mocks[key] || []; },
        clear() { state = emptyState(); try { if (storage) storage.removeItem(STORE_KEY); } catch (_) { /* ไม่ต้องทำอะไร */ } },
    };
}

export function browserStore() {
    try { return createStore(typeof localStorage !== 'undefined' ? localStorage : null); } catch (_) { return createStore(null); }
}

const practiceCount = (r) => Object.keys(r.practice || {}).length;

/** สร้างโครงหลักสูตรของวิชา: หน่วย → บทเรียน พร้อมสถานะ (done / now / todo) และสถานะของแต่ละกิจกรรม */
export function buildOutline(key, store = createStore(null)) {
    const subject = getSubject(key);
    if (!subject) return null;
    const base = baseDoneCount(subject);

    const lessons = [];
    for (let n = 1; n <= subject.lessons; n++) {
        const r = store.lesson(key, n);
        const baseDone = n <= base;
        const content = baseDone || !!r.read;
        const quiz = baseDone || !!r.quiz;
        const practice = baseDone || practiceCount(r) > 0;
        // "อ่านจบ" กับ "ผ่านกิจกรรมประเมิน" แยกสถานะกัน: บทเรียนจบเมื่ออ่านแล้วและทำ Quiz แล้วเท่านั้น
        const done = baseDone || (!!r.read && !!r.quiz);
        lessons.push({ n, title: lessonTitle(key, n), baseDone, content, quiz, practice, done, status: done ? 'done' : 'todo' });
    }
    const current = lessons.find((l) => !l.done) || null;
    for (const l of lessons) {
        if (!l.done && (l === current || l.content || l.quiz || l.practice)) l.status = 'now';
    }

    const units = [];
    for (let i = 0; i < lessons.length; i += UNIT_SIZE) {
        const items = lessons.slice(i, i + UNIT_SIZE);
        const doneCount = items.filter((l) => l.done).length;
        units.push({ n: units.length + 1, title: PLACEHOLDER_UNIT, lessons: items, doneCount, complete: doneCount === items.length });
    }

    const doneCount = lessons.filter((l) => l.done).length;
    return {
        subject,
        lessons,
        units,
        doneCount,
        total: lessons.length,
        pct: Math.max(subject.pct, Math.round((doneCount / lessons.length) * 100)),
        current,                                   // บทที่ค้างอยู่ (null = เรียนครบทุกบท)
        currentUnit: current ? Math.ceil(current.n / UNIT_SIZE) : null,
    };
}

/** แปลงพารามิเตอร์ l ใน URL ("current" หรือเลขบท) เป็นเลขบทที่ถูกต้อง หรือ null */
export function resolveLessonNo(key, raw, store = createStore(null)) {
    const outline = buildOutline(key, store);
    if (!outline) return null;
    if (raw === 'current' || raw == null || raw === '') return (outline.current || outline.lessons[outline.lessons.length - 1]).n;
    if (!/^[1-9]\d{0,3}$/.test(String(raw))) return null; // รับเฉพาะเลขจำนวนเต็มบวกล้วนๆ
    const n = Number(raw);
    return n <= outline.total ? n : null;
}

// ───────────── โจทย์ตัวอย่าง (Quiz / Practice / Mock Exam) ─────────────
const CHOICE_LABELS = ['ก', 'ข', 'ค', 'ง'];
export const choiceLabel = (i) => CHOICE_LABELS[i] || String(i + 1);

function makeQuestion(i, seed, topicCount = 3) {
    return {
        n: i + 1,
        text: `[โจทย์ข้อที่ ${i + 1}]`,
        choices: CHOICE_LABELS.map((l) => `[ตัวเลือก ${l}]`),
        answer: (i + seed) % 4,
        explanation: `[คำอธิบายเฉลยข้อที่ ${i + 1}]`,
        topic: `[หัวข้อ ${String.fromCharCode(65 + (i % topicCount))}]`,
    };
}

export const QUIZ_SIZE = 5;
export function makeQuiz(key, lessonNo) {
    return Array.from({ length: QUIZ_SIZE }, (_, i) => makeQuestion(i, lessonNo + (getSubject(key)?.no || 0), 1));
}

export const DIFFICULTIES = ['ง่าย', 'ง่าย', 'กลาง', 'กลาง', 'ยาก', 'ยาก'];
export function makePractice(key, lessonNo) {
    return DIFFICULTIES.map((level, i) => ({
        n: i + 1,
        level,
        text: `[โจทย์ฝึกข้อที่ ${i + 1}]`,
        solution: `[เฉลยและวิธีคิดข้อที่ ${i + 1}]`,
        topic: `[หัวข้อ ${String.fromCharCode(65 + (i % 2))}]`,
    }));
}

// ข้อกำหนดของ Mock Test ยังไม่ได้ตัดสินใจ (จำนวนข้อ เวลา คะแนนผ่าน) — ค่าด้านล่างเป็นตัวอย่างให้ UI ทำงานได้เท่านั้น
export const MOCK_SAMPLE = { questions: 10, minutes: 20, passMark: null };
export function makeMock(key) {
    const no = getSubject(key)?.no || 0;
    return { ...MOCK_SAMPLE, items: Array.from({ length: MOCK_SAMPLE.questions }, (_, i) => makeQuestion(i, no)) };
}

/** ตรวจคำตอบ: picks[i] = index ที่เลือก หรือ null/undefined ถ้ายังไม่ตอบ */
export function scoreAnswers(questions, picks) {
    const wrong = [];
    let correct = 0;
    let answered = 0;
    questions.forEach((q, i) => {
        const p = picks[i];
        if (p === null || p === undefined) return;
        answered++;
        if (p === q.answer) correct++;
        else wrong.push(i);
    });
    const total = questions.length;
    return { correct, total, answered, wrong, percent: total ? Math.round((correct / total) * 100) : 0 };
}

export function scoreMessage(percent) {
    if (percent >= 80) return 'ยอดเยี่ยม';
    if (percent >= 60) return 'ทำได้ดี';
    if (percent >= 40) return 'พอใช้ ลองทบทวนอีกนิด';
    return 'ลองกลับไปทบทวนเนื้อหาอีกครั้ง';
}

export function formatClock(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatThaiDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ───────────── ลิงก์ไปหน้าเรียน (ใช้ร่วมกันทุกหน้า) ─────────────
export const courseUrl = (key) => `course.html?s=${encodeURIComponent(key)}`;
export const lessonUrl = (key, n = 'current', tab = 'content') => `lesson.html?s=${encodeURIComponent(key)}&l=${encodeURIComponent(n)}${tab && tab !== 'content' ? `&tab=${tab}` : ''}`;
export const mockUrl = (key) => (key ? `mock-exam.html?s=${encodeURIComponent(key)}` : 'mock-exam.html');

if (typeof window !== 'undefined') {
    window.StudyData = { SUBJECTS, SUBJECT_ORDER, getSubject, buildOutline, lessonUrl, courseUrl, mockUrl };
}
