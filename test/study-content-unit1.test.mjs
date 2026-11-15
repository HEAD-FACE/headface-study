// ไฟล์เนื้อหา วิทยาศาสตร์ หน่วยที่ 1 (เคมี ม.3): docs/content/study-content.sci-unit1.json
// ตัวตรวจจริงอยู่ที่ Backend (import dry run) — เทสต์นี้กันของเสียตั้งแต่ฝั่งหน้าเว็บ: id ซ้ำ, ภาพหาย, กองโจทย์น้อยกว่าที่ระบบจะสุ่ม, เฉลยไม่ตรงตัวเลือก
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const doc = JSON.parse(fs.readFileSync(path.join(root, 'docs/content/study-content.sci-unit1.json'), 'utf8'));
const subject = doc.subject;
const lessons = subject.units.flatMap((u) => u.lessons);
const questions = subject.questions;
const nodes = lessons.flatMap((l) => l.nodes.map((n) => ({ ...n, lessonNo: l.no, lesson: l })));

const walk = (value, fn) => {
    if (typeof value === 'string') fn(value);
    else if (Array.isArray(value)) value.forEach((v) => walk(v, fn));
    else if (value && typeof value === 'object') Object.values(value).forEach((v) => walk(v, fn));
};

describe('โครงของหน่วยที่ 1', () => {
    test('วิชา sci หน่วยเดียว 5 บท เลขบท 1-5 ต่อเนื่อง', () => {
        assert.equal(subject.id, 'sci');
        assert.equal(subject.units.length, 1);
        assert.deepEqual(lessons.map((l) => l.no), [1, 2, 3, 4, 5]);
    });

    test('id ของหน่วย บท กิจกรรม โจทย์ ไม่ซ้ำกัน และใช้ตัวอักษรที่ระบบรับ', () => {
        const ids = [subject.id, ...subject.units.map((u) => u.id), ...lessons.map((l) => l.id), ...nodes.map((n) => n.id), ...questions.map((q) => q.id)];
        assert.equal(new Set(ids).size, ids.length);
        for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9-]{1,59}$/, id);
    });

    test('ไม่ชนกับ id ของไฟล์จำลองเดิม ยกเว้นบทและหน่วยที่ตั้งใจทับ', () => {
        const mock = JSON.parse(fs.readFileSync(path.join(root, 'docs/examples/study-content.sci-mock.json'), 'utf8')).subject;
        const mockIds = new Set([
            ...mock.units.flatMap((u) => u.lessons.flatMap((l) => [l.id, ...l.nodes.map((n) => n.id)])),
            ...mock.questions.map((q) => q.id),
        ]);
        const mine = [...nodes.map((n) => n.id), ...questions.map((q) => q.id)];
        assert.deepEqual(mine.filter((id) => mockIds.has(id)), []);
    });

    test('ทุกบทขึ้นต้นด้วยเนื้อหา จบด้วย Practice 1 ชุด มีเนื้อหา >= 2 ชุด และ Quiz >= 1 ชุด และทุกหน้ามีบล็อก', () => {
        for (const l of lessons) {
            const types = l.nodes.map((n) => n.type);
            assert.equal(types[0], 'content', l.id);
            assert.equal(types.at(-1), 'practice', l.id);
            assert.equal(types.filter((t) => t === 'practice').length, 1, l.id);
            assert.ok(types.filter((t) => t === 'content').length >= 2, `${l.id}: เนื้อหาน้อยกว่า 2 ชุด`);
            assert.ok(types.filter((t) => t === 'quiz').length >= 1, `${l.id}: ไม่มี Quiz`);
            for (const n of l.nodes.filter((x) => x.type === 'content')) {
                assert.ok(n.pages.length >= 3, `${n.id} ต้องมีอย่างน้อย 3 หน้า`);
                for (const p of n.pages) assert.ok(p.blocks.length >= 1, `${n.id} มีหน้าว่าง`);
            }
        }
    });

    test('ไม่มีแท็ก HTML ในข้อความใด ๆ', () => {
        const html = /<\/?(?:script|style|iframe|img|a|b|i|p|div|span|br|h[1-6]|ul|ol|li|table|svg|form|input|button)\b/i;
        walk(doc, (s) => assert.doesNotMatch(s, html, s.slice(0, 40)));
    });
});

describe('ภาพประกอบ', () => {
    test('ทุกไฟล์ภาพที่อ้างถึงมีอยู่จริงในโปรเจกต์ และมี alt', () => {
        const media = [];
        walk(doc, () => {});
        const collect = (v) => {
            if (Array.isArray(v)) v.forEach(collect);
            else if (v && typeof v === 'object') {
                if (typeof v.url === 'string') media.push(v);
                Object.values(v).forEach(collect);
            }
        };
        collect(doc);
        assert.ok(media.length >= 3);
        for (const m of media) {
            if (m.url.startsWith('assets/')) assert.ok(fs.existsSync(path.join(root, m.url)), `ไม่พบ ${m.url}`);
            else assert.match(m.url, /^https:\/\//);
            if (m.kind === 'image') assert.ok(m.alt && m.alt.length > 5, `${m.url} ต้องมี alt`);
        }
    });
});

describe('โจทย์', () => {
    const quizPool = (nodeId) => questions.filter((q) => q.uses.includes('quiz') && q.node === nodeId);

    test('Quiz แต่ละชุดมีโจทย์อย่างน้อยเท่าจำนวนที่สุ่ม และผูกกับกิจกรรมที่มีจริง', () => {
        for (const n of nodes.filter((x) => x.type === 'quiz')) {
            assert.ok(quizPool(n.id).length >= n.quizSize, `${n.id}: โจทย์ ${quizPool(n.id).length} ข้อ น้อยกว่า ${n.quizSize}`);
        }
        const nodeIds = new Set(nodes.map((n) => n.id));
        for (const q of questions.filter((x) => x.node)) assert.ok(nodeIds.has(q.node), `${q.id} ผูกกับกิจกรรมที่ไม่มี: ${q.node}`);
    });

    test('Practice แต่ละชุดมีโจทย์เปิดอย่างน้อย 5 ข้อ พร้อมเฉลย', () => {
        for (const n of nodes.filter((x) => x.type === 'practice')) {
            const pool = questions.filter((q) => q.uses.includes('practice') && q.node === n.id);
            assert.ok(pool.length >= 5, n.id);
            for (const q of pool) { assert.equal(q.kind, 'open'); assert.ok(q.solution.length > 20, q.id); }
        }
    });

    test('Mock: pool มาตรฐานพอสุ่ม มีข้อพิเศษ และทุกบทมีข้อออกสอบ', () => {
        const mock = questions.filter((q) => q.uses.includes('mock'));
        const std = mock.filter((q) => (q.tier || 'standard') === 'standard');
        assert.ok(std.length >= subject.mock.questionCount, `มาตรฐาน ${std.length} น้อยกว่า ${subject.mock.questionCount}`);
        assert.ok(mock.some((q) => q.tier === 'advanced'));
        for (const l of lessons) assert.ok(mock.some((q) => q.lessonNo === l.no), `บท ${l.no} ไม่มีข้อออกสอบ`);
        assert.equal(subject.mock.id, 'sci-mock'); // วิชามี Mock ชุดเดียว: ต้องใช้ id เดิมเพื่อทับของจำลอง
    });

    test('ทุกข้อมีเฉลยที่ตรงกับตัวเลือก และมีคำอธิบาย', () => {
        for (const q of questions.filter((x) => x.kind === 'mcq')) {
            assert.ok(q.explanation && q.explanation.length > 15, `${q.id} ต้องมีคำอธิบาย`);
            const f = q.format || 'choice';
            const ids = (q.choices || []).map((c) => c.id);
            if (f === 'choice') { assert.ok(ids.length >= 3 && ids.includes(q.correct), q.id); }
            if (f === 'multi') { assert.ok(Array.isArray(q.correct) && q.correct.length >= 2 && q.correct.every((c) => ids.includes(c)) && q.correct.length < ids.length, q.id); }
            if (f === 'truefalse') assert.equal(typeof q.correct, 'boolean', q.id);
            if (f === 'numeric') assert.equal(typeof q.answer, 'number', q.id);
            if (f === 'fill') {
                const marks = (q.stem.match(/\[\[\d+\]\]/g) || []).length;
                assert.equal(marks, q.blanks.length, `${q.id}: จำนวนช่องว่างไม่ตรงคำเฉลย`);
            }
            if (f === 'categorize') for (const it of q.items) assert.ok(q.groups.includes(it.group), q.id);
            if (f === 'match') assert.ok(q.pairs.length >= 2, q.id);
            if (f === 'order') assert.ok(q.items.length >= 3, q.id);
            if (q.tier === 'advanced') assert.ok(q.uses.includes('mock'), `${q.id}: ข้อพิเศษใช้ได้เฉพาะ Mock`);
        }
    });

    test('ตำแหน่งเฉลยของโจทย์เลือก 1 ข้อไม่กระจุกอยู่ข้อเดียว', () => {
        const picks = questions.filter((q) => q.kind === 'mcq' && !q.format).map((q) => q.correct);
        const counts = ['a', 'b', 'c', 'd'].map((c) => picks.filter((p) => p === c).length);
        assert.ok(Math.max(...counts) / picks.length < 0.6, JSON.stringify(counts));
    });
});

describe('บทที่ 1 ใหม่: ปฏิกิริยาเคมีในชีวิตประจำวัน', () => {
    const l1 = lessons[0];
    const quizNodes = l1.nodes.filter((n) => n.type === 'quiz');

    test('เส้นทาง: เนื้อหา 7 ชุดสลับกับ Quiz 4 ชุด จบด้วย Practice', () => {
        assert.equal(l1.title, 'ปฏิกิริยาเคมีในชีวิตประจำวัน');
        assert.deepEqual(l1.nodes.map((n) => n.type), ['content', 'content', 'quiz', 'content', 'quiz', 'content', 'content', 'quiz', 'content', 'content', 'quiz', 'practice']);
        assert.equal(quizNodes.length, 4);
    });

    test('กองโจทย์ของ Quiz แต่ละชุดใหญ่กว่าจำนวนที่สุ่ม (ทำซ้ำแล้วได้ชุดไม่เหมือนเดิม)', () => {
        for (const n of quizNodes) {
            const pool = questions.filter((q) => q.node === n.id && q.uses.includes('quiz'));
            assert.ok(pool.length > n.quizSize, `${n.id}: กอง ${pool.length} ข้อ สุ่ม ${n.quizSize}`);
        }
    });

    test('ใช้โจทย์หลายรูปแบบ และเลขต้นฉบับ: ไม่มีโจทย์เก่าของบทที่ 1 (sci-cq-1-/sci-cp-1-) เหลืออยู่', () => {
        const mine = questions.filter((q) => /^sci-r1[qp]-/.test(q.id));
        const formats = new Set(mine.map((q) => q.format || 'choice'));
        for (const f of ['choice', 'truefalse', 'multi', 'match', 'order', 'categorize', 'fill', 'numeric']) assert.ok(formats.has(f), `ไม่มีรูปแบบ ${f}`);
        assert.equal(questions.filter((q) => /^sci-c[qp]-1-/.test(q.id)).length, 0);
        assert.ok(mine.filter((q) => q.kind === 'open').length >= 8);
    });

    test('ยังไม่ทำ Mock ของบทใหม่: โจทย์ Mock ของบทที่ 1 คือชุดเดิม (sci-cm-1-*) ไม่ถูกแตะ', () => {
        const mock1 = questions.filter((q) => q.uses.includes('mock') && q.lessonNo === 1).map((q) => q.id);
        assert.ok(mock1.length > 0 && mock1.every((id) => id.startsWith('sci-cm-1-')));
    });

    test('ทุก topic ของโจทย์บทที่ 1 ตรงกลุ่มที่ใช้วิเคราะห์จุดแข็ง/จุดอ่อน (ชื่อเดียวกันสำหรับเรื่องเดียวกัน)', () => {
        const topics = new Set(questions.filter((q) => /^sci-r1[qp]-/.test(q.id)).map((q) => q.topic));
        assert.deepEqual([...topics].sort(), ['กรด เบส และสะเทิน', 'การเปลี่ยนแปลงของสาร', 'การเผาไหม้และสนิม', 'ปฏิกิริยาในธรรมชาติ', 'ประเภทของปฏิกิริยา', 'สบู่และเอสเทอร์', 'สมการเคมี'].sort());
    });

    test('ใช้ภาพประกอบใหม่ทั้ง 7 ภาพของบทนี้ และแต่ละภาพขึ้นหน้าอย่างน้อย 1 ครั้ง', () => {
        const used = new Set();
        walk(l1.nodes, (s) => { const m = /assets\/study\/sci\/(chem-[a-z-]+\.svg)/.exec(s); if (m) used.add(m[1]); });
        for (const f of ['chem-reaction-types.svg', 'chem-combustion.svg', 'chem-rust-triangle.svg', 'chem-acid-rain.svg', 'chem-photosynthesis.svg', 'chem-physical-vs-chemical.svg', 'chem-three-reactions.svg']) assert.ok(used.has(f), f);
    });

    test('ภาพ SVG ของบทนี้เป็น XML ที่ถูกต้อง (ไม่มี < หรือ & ดิบในข้อความ) และมีพื้นหลังขาวทึบ (ธีมมืดยังอ่านออก)', () => {
        for (const f of ['chem-reaction-types', 'chem-combustion', 'chem-rust-triangle', 'chem-acid-rain', 'chem-photosynthesis', 'chem-physical-vs-chemical', 'chem-three-reactions']) {
            const svg = fs.readFileSync(path.join(root, `assets/study/sci/${f}.svg`), 'utf8');
            const text = [...svg.matchAll(/>([^<]+)</g)].map((m) => m[1]).join('');
            assert.doesNotMatch(text, /[<>]/, f);
            assert.doesNotMatch(text.replace(/&(amp|lt|gt);/g, ''), /&/, f);
            assert.match(svg, /<rect width="\d+" height="\d+" rx="22" fill="#FFFFFF"\/>/, f);
            assert.match(svg, /role="img" aria-label="[^"]{20,}"/, f);
        }
    });
});
