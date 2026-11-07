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

    test('ทุกบทมีเนื้อหา 2 ชุด + Quiz 1 ชุด + Practice 1 ชุด และทุกหน้ามีบล็อก', () => {
        for (const l of lessons) {
            assert.deepEqual(l.nodes.map((n) => n.type), ['content', 'content', 'quiz', 'practice'], l.id);
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

    test('Practice แต่ละชุดมีโจทย์เปิด 5 ข้อ พร้อมเฉลย', () => {
        for (const n of nodes.filter((x) => x.type === 'practice')) {
            const pool = questions.filter((q) => q.uses.includes('practice') && q.node === n.id);
            assert.equal(pool.length, 5, n.id);
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
