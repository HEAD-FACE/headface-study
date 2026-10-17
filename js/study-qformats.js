/**
 * js/study-qformats.js — รูปแบบการตอบของโจทย์ Quiz / Mock Exam (สัญญา: docs/study-api-contract.md ข้อ 2.12)
 *
 *   choice      เลือก 1 ข้อ              (เดิม)                 truefalse   จริง / เท็จ (การ์ดใหญ่ 2 ใบ ปัดซ้าย-ขวาได้)
 *   multi       ติ๊กทุกข้อที่ถูก          match       จับคู่ (แตะซ้าย แล้วแตะขวา — ไม่ต้องลาก)
 *   order       แตะเรียงลำดับ            categorize  จัดกลุ่ม (แตะการ์ด แล้วแตะกลุ่ม)
 *   fill        แตะคำจากคลังคำไปใส่ช่องว่าง   numeric     พิมพ์ตัวเลข
 *
 * ไฟล์นี้ "แค่แสดงและเก็บสิ่งที่ผู้เรียนแตะ": ตรวจ/ให้คะแนน/เฉลยเป็นของ Backend ทั้งหมด ไม่มีเฉลยอยู่ในโจทย์ก่อนตอบ
 * คำตอบ (pick) มีรูปร่างเดียวกับที่ส่งให้ Backend:
 *   choice/truefalse = id · multi = [id] · match = {ซ้าย: ขวา} · order = [id] · categorize = {การ์ด: กลุ่ม} · fill = [id|null ต่อช่อง] · numeric = ข้อความที่พิมพ์
 * ui = สถานะชั่วคราวของข้อนั้น (กำลังเลือกอะไรอยู่) ไม่ส่งไป Backend
 * หน้าจัดการแตะผ่าน data-fx / data-id / data-i (applyAction) ส่วน choice/truefalse ใช้ data-choice เหมือนเดิม
 */
import { esc, ICON } from './study-ui.js';
import { choiceLabel } from './study-format.js';
import { choiceImageHtml } from './study-media.js';

export const formatOf = (q) => (q && q.format) || 'choice';
/** ตอบด้วย id ของตัวเลือกเดียว (คลิกผ่าน data-choice) */
export const isChoiceLike = (q) => formatOf(q) === 'choice' || formatOf(q) === 'truefalse';

const MARKER_RE = /\[\[(\d{1,2})\]\]/g;
const list = (v) => (Array.isArray(v) ? v : []);
const textOf = (items, id) => { const it = list(items).find((x) => x.id === id); return it ? it.text : ''; };

/** "3,5" "๓.๕" "1,000" "−2" → ตัวเลข หรือ null (กติกาเดียวกับ Backend) */
export function parseNumber(raw) {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    if (typeof raw !== 'string') return null;
    let t = raw.trim().replace(/[๐-๙]/g, (d) => String(d.charCodeAt(0) - 0x0E50)).replace(/[−–﹣－]/g, '-').replace(/\s+/g, '');
    if (t === '' || t.length > 24) return null;
    if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
    else if (/^[+-]?\d+,\d+$/.test(t)) t = t.replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

// ───────────── สถานะ ─────────────
/** คำตอบเริ่มต้นของข้อ (ยังไม่ได้แตะอะไร) */
export function emptyPick(q) {
    switch (formatOf(q)) {
        case 'multi': case 'order': return [];
        case 'match': case 'categorize': return {};
        case 'fill': return Array.from({ length: Number(q.spec && q.spec.blanks) || 0 }, () => null);
        case 'numeric': return '';
        default: return undefined;
    }
}

/** ผู้เรียนแตะอะไรไปแล้วบ้างไหม (Mock: นับว่าตอบแล้ว / ส่งไปบันทึก) */
export function hasAnswer(q, pick) {
    if (pick === undefined || pick === null) return false;
    switch (formatOf(q)) {
        case 'choice': case 'truefalse': return typeof pick === 'string';
        case 'numeric': return typeof pick === 'string' && pick.trim() !== '';
        case 'fill': return list(pick).some((v) => v !== null);
        case 'match': case 'categorize': return Object.keys(pick).length > 0;
        default: return list(pick).length > 0;
    }
}

/** ตอบครบพอจะกด "ตรวจคำตอบ" ได้ไหม (Quiz) */
export function isReady(q, pick) {
    if (!hasAnswer(q, pick)) return false;
    const s = q.spec || {};
    switch (formatOf(q)) {
        case 'numeric': return parseNumber(pick) !== null;
        case 'match': return list(s.left).every((l) => typeof pick[l.id] === 'string');
        case 'order': return pick.length === list(s.items).length;
        case 'categorize': return list(s.items).every((it) => typeof pick[it.id] === 'string');
        case 'fill': return list(pick).every((v) => v !== null);
        default: return true;
    }
}

/** ค่าที่ส่งให้ Backend (ตัดช่องว่างท้ายข้อความตัวเลข) */
export const toAnswer = (q, pick) => (formatOf(q) === 'numeric' ? String(pick).trim() : pick);

/** ล้างค่าที่ Backend อาจส่งกลับมาไม่ตรงโจทย์ (ข้อที่ตอบไว้ก่อน แล้วเนื้อหาถูกแก้) ให้เป็นรูปร่างที่หน้าวาดได้เสมอ */
export function sanitizePick(q, pick) {
    if (pick === undefined || pick === null) return undefined;
    const f = formatOf(q);
    if (f === 'choice' || f === 'truefalse') return typeof pick === 'string' ? pick : undefined;
    if (f === 'numeric') return typeof pick === 'number' ? String(pick) : typeof pick === 'string' ? pick : undefined;
    if (f === 'fill') {
        const n = Number(q.spec && q.spec.blanks) || 0;
        return Array.from({ length: n }, (_, i) => (typeof list(pick)[i] === 'string' ? pick[i] : null));
    }
    if (f === 'match' || f === 'categorize') return pick && typeof pick === 'object' && !Array.isArray(pick) ? pick : {};
    return Array.isArray(pick) ? pick.filter((v) => typeof v === 'string') : [];
}

/**
 * แตะหนึ่งครั้ง → คำตอบและสถานะใหม่ (ไม่แก้ของเดิม)
 * @param {object} action  { fx, id, i } จาก data-fx / data-id / data-i
 */
export function applyAction(q, pick, ui, action) {
    const u = { ...(ui || {}) };
    const { fx, id } = action;
    switch (fx) {
        case 'x-tog': { // multi
            const has = list(pick).includes(id);
            const next = has ? list(pick).filter((v) => v !== id) : [...list(pick), id];
            const order = list(q.choices).map((c) => c.id);
            return { pick: order.filter((c) => next.includes(c)), ui: u };
        }
        case 'm-left': case 'm-right': { // match: แตะข้างไหนก่อนก็ได้
            const p = { ...(pick || {}) };
            const side = fx === 'm-left' ? 'L' : 'R';
            const mine = side === 'L' ? 'armL' : 'armR';
            const other = side === 'L' ? 'armR' : 'armL';
            const partner = side === 'L' ? p[id] : Object.keys(p).find((l) => p[l] === id);
            if (u[other]) { // อีกข้างรออยู่ → จับคู่
                const left = side === 'L' ? id : u[other];
                const right = side === 'L' ? u[other] : id;
                for (const l of Object.keys(p)) if (l === left || p[l] === right) delete p[l];
                p[left] = right;
                return { pick: p, ui: { ...u, armL: null, armR: null } };
            }
            if (partner !== undefined) { // แตะข้างที่จับคู่แล้ว → ยกเลิกคู่ แล้วรอจับใหม่
                if (side === 'L') delete p[id]; else delete p[partner];
                return { pick: p, ui: { ...u, armL: null, armR: null, [mine]: id } };
            }
            return { pick: p, ui: { ...u, armL: null, armR: null, [mine]: u[mine] === id ? null : id } };
        }
        case 'o-pick': return { pick: list(pick).includes(id) ? list(pick) : [...list(pick), id], ui: u }; // order
        case 'o-undo': return { pick: list(pick).filter((v) => v !== id), ui: u };
        case 'c-item': { // categorize: แตะการ์ดเพื่อเลือก / แตะการ์ดที่วางแล้วเพื่อเอากลับ
            const p = { ...(pick || {}) };
            if (typeof p[id] === 'string') { delete p[id]; return { pick: p, ui: { ...u, cur: id } }; }
            return { pick: p, ui: { ...u, cur: u.cur === id ? null : id } };
        }
        case 'c-group': {
            const cur = currentCard(q, pick, u);
            if (!cur) return { pick, ui: u };
            return { pick: { ...(pick || {}), [cur]: id }, ui: { ...u, cur: null } };
        }
        case 'f-word': { // fill
            const p = list(pick).slice();
            if (p.includes(id)) return { pick: p, ui: u };
            const target = u.arm !== undefined && u.arm !== null ? u.arm : p.findIndex((v) => v === null);
            if (target < 0 || target >= p.length) return { pick: p, ui: u };
            p[target] = id;
            return { pick: p, ui: { ...u, arm: null } };
        }
        case 'f-blank': {
            const i = Number(action.i);
            const p = list(pick).slice();
            if (!(i >= 0 && i < p.length)) return { pick: p, ui: u };
            if (p[i] !== null) { p[i] = null; return { pick: p, ui: { ...u, arm: i } }; }
            return { pick: p, ui: { ...u, arm: u.arm === i ? null : i } };
        }
        default: return { pick, ui: u };
    }
}

/** การ์ดที่รอจัดกลุ่มอยู่ตอนนี้ (ที่ผู้เรียนเลือกไว้ ไม่งั้นใบแรกที่ยังไม่ได้วาง) */
function currentCard(q, pick, ui) {
    const items = list(q.spec && q.spec.items);
    const free = items.filter((it) => typeof (pick || {})[it.id] !== 'string');
    if (ui && ui.cur && free.some((it) => it.id === ui.cur)) return ui.cur;
    return free.length ? free[0].id : null;
}

// ───────────── แสดงผล ─────────────
const MARK = { ok: ICON.check(20, 3.4), bad: ICON.x(20, 3.4) };
const PAIR_COLORS = 6;

/** ผลของส่วนย่อยหลังตรวจ: 'ok' | 'bad' | '' (ยังไม่ตรวจ) */
const verdict = (fb, same) => (fb ? (same ? 'ok' : 'bad') : '');

function choiceButtons(q, pick, fb, locked) {
    const multi = formatOf(q) === 'multi';
    const correct = multi && fb ? list(fb.correct) : [];
    const chosen = multi ? list(pick) : [];
    return `<div class="choices" role="${multi ? 'group' : 'radiogroup'}" aria-label="ตัวเลือกคำตอบ">${list(q.choices).map((c, i) => {
        let cls = 'choice';
        let mark = '';
        if (multi) {
            const on = chosen.includes(c.id);
            if (fb) {
                if (on && correct.includes(c.id)) { cls += ' is-ok'; mark = ICON.check(24, 3); }
                else if (on) { cls += ' is-bad'; mark = ICON.x(24, 3); }
                else if (correct.includes(c.id)) { cls += ' is-miss'; mark = ICON.check(24, 3); }
                else cls += ' is-dim';
            } else if (on) cls += ' is-sel';
            return `<button type="button" class="${cls}" role="checkbox" aria-checked="${on}" data-fx="x-tog" data-id="${esc(c.id)}"${fb || locked ? ' disabled' : ''}>
              <span class="choice-l ck">${on || (fb && correct.includes(c.id)) ? ICON.check(16, 3.6) : ''}</span><span class="choice-t">${choiceImageHtml(c)}<span>${esc(c.text)}</span></span><span class="choice-m">${mark}</span>
            </button>`;
        }
        if (fb) {
            if (c.id === fb.correctChoiceId) { cls += ' is-ok'; mark = ICON.check(24, 3); }
            else if (c.id === fb.yourChoiceId) { cls += ' is-bad'; mark = ICON.x(24, 3); }
            else cls += ' is-dim';
        } else if (c.id === pick) cls += ' is-sel';
        return `<button type="button" class="${cls}" role="radio" aria-checked="${c.id === pick}" data-choice="${esc(c.id)}"${fb || locked ? ' disabled' : ''}>
          <span class="choice-l">${choiceLabel(i)}</span><span class="choice-t">${choiceImageHtml(c)}<span>${esc(c.text)}</span></span><span class="choice-m">${mark}</span>
        </button>`;
    }).join('')}</div>`;
}

function trueFalseCards(q, pick, fb, locked, swipe) {
    const card = (id, label, icon) => {
        let cls = `tf-card tf-${id}`;
        if (fb) cls += id === fb.correctChoiceId ? ' is-ok' : id === fb.yourChoiceId ? ' is-bad' : ' is-dim';
        else if (pick === id) cls += ' is-sel';
        else if (pick) cls += ' is-off';
        return `<button type="button" class="${cls}" role="radio" aria-checked="${pick === id}" data-choice="${id}"${fb || locked ? ' disabled' : ''}><span class="tf-ic" aria-hidden="true">${icon}</span><b>${label}</b></button>`;
    };
    return `<div class="tf" role="radiogroup" aria-label="จริงหรือเท็จ">${card('f', 'เท็จ', ICON.x(34, 3.6))}${card('t', 'จริง', ICON.check(34, 3.6))}</div><p class="qhint">${swipe ? 'แตะ หรือปัดการ์ดไปทางที่เลือก' : 'แตะการ์ดที่เลือก'}</p>`;
}

function matchHtml(q, pick, ui, fb, locked) {
    const { left = [], right = [] } = q.spec || {};
    const p = pick || {};
    const pairOf = new Map(Object.entries(p).map(([l, r]) => [r, l]));
    const lIndex = new Map(left.map((l, i) => [l.id, i]));
    const correct = fb ? (fb.correct || {}) : null;
    const dis = fb || locked ? ' disabled' : '';
    const leftBtns = left.map((l, i) => {
        const r = p[l.id];
        const v = verdict(fb, r !== undefined && correct && correct[l.id] === r);
        const wrongHint = fb && v === 'bad' ? `<small class="mt-ans">ที่ถูก: ${esc(textOf(right, correct && correct[l.id]))}</small>` : '';
        return `<button type="button" class="mt-i${r !== undefined ? ' paired' : ''}${ui.armL === l.id ? ' armed' : ''}${v ? ` is-${v}` : ''}" data-pc="${i % PAIR_COLORS}" data-fx="m-left" data-id="${esc(l.id)}"${dis}><span>${esc(l.text)}</span>${v ? `<em class="mt-m">${MARK[v]}</em>` : r !== undefined ? '<i class="mt-dot"></i>' : ''}${wrongHint}</button>`;
    }).join('');
    const rightBtns = right.map((r) => {
        const owner = pairOf.get(r.id);
        const v = fb && owner !== undefined ? verdict(fb, correct && correct[owner] === r.id) : '';
        return `<button type="button" class="mt-i${owner !== undefined ? ' paired' : ''}${ui.armR === r.id ? ' armed' : ''}${v ? ` is-${v}` : ''}" data-pc="${owner !== undefined ? (lIndex.get(owner) || 0) % PAIR_COLORS : 0}" data-fx="m-right" data-id="${esc(r.id)}"${dis}><span>${esc(r.text)}</span>${owner !== undefined ? '<i class="mt-dot"></i>' : ''}</button>`;
    }).join('');
    return `<p class="qhint">แตะซ้าย แล้วแตะขวาที่ตรงกัน</p><div class="mt"><div class="mt-col">${leftBtns}</div><div class="mt-col">${rightBtns}</div></div>`;
}

function orderHtml(q, pick, fb, locked) {
    const items = list(q.spec && q.spec.items);
    const p = list(pick);
    const correct = fb ? list(fb.correct) : [];
    const dis = fb || locked ? ' disabled' : '';
    const slots = items.map((_, i) => {
        const id = p[i];
        const v = fb ? verdict(fb, id !== undefined && correct[i] === id) : '';
        return `<li class="od-slot${id ? ' filled' : ''}${v ? ` is-${v}` : ''}"><span class="od-n">${i + 1}</span>${id ? `<button type="button" class="od-it" data-fx="o-undo" data-id="${esc(id)}"${dis}>${esc(textOf(items, id))}</button>` : '<span class="od-empty"></span>'}${v ? `<em class="od-m">${MARK[v]}</em>` : ''}</li>`;
    }).join('');
    const bank = items.filter((it) => !p.includes(it.id));
    const bankHtml = fb ? '' : `<div class="od-bank" aria-label="ขั้นตอนที่ยังไม่ได้เรียง">${bank.map((it) => `<button type="button" class="od-chip" data-fx="o-pick" data-id="${esc(it.id)}"${dis}>${esc(it.text)}</button>`).join('')}</div>`;
    const wrong = fb && !fb.isCorrect ? `<div class="od-key"><b>ลำดับที่ถูก</b><ol>${correct.map((id) => `<li>${esc(textOf(items, id))}</li>`).join('')}</ol></div>` : '';
    return `<p class="qhint">แตะเรียงตามลำดับ ${fb ? '' : '(แตะที่เรียงแล้วเพื่อเอาออก)'}</p><ol class="od-slots">${slots}</ol>${bankHtml}${wrong}`;
}

function categorizeHtml(q, pick, ui, fb, locked) {
    const { groups = [], items = [] } = q.spec || {};
    const p = pick || {};
    const cur = fb ? null : currentCard(q, p, ui);
    const free = items.filter((it) => typeof p[it.id] !== 'string');
    const correct = fb ? (fb.correct || {}) : null;
    const dis = fb || locked ? ' disabled' : '';
    const top = fb ? '' : cur
        ? `<div class="ct-cur"><div class="ct-card" data-key="ct-${esc(cur)}">${esc(textOf(items, cur))}</div><span class="ct-left">เหลือ ${free.length}</span></div>`
        : '<div class="ct-cur done"><span class="ct-ok">จัดครบแล้ว</span></div>';
    const pool = !fb && free.length > 1 ? `<div class="ct-pool" aria-label="การ์ดที่รอจัด">${free.filter((it) => it.id !== cur).map((it) => `<button type="button" class="od-chip" data-fx="c-item" data-id="${esc(it.id)}"${dis}>${esc(it.text)}</button>`).join('')}</div>` : '';
    const boxes = groups.map((g, gi) => {
        const mine = items.filter((it) => p[it.id] === g.id);
        const chips = mine.map((it) => {
            const v = fb ? verdict(fb, correct && correct[it.id] === g.id) : '';
            const hint = fb && v === 'bad' ? `<small class="mt-ans">ที่ถูก: ${esc(textOf(groups, correct && correct[it.id]))}</small>` : '';
            return `<button type="button" class="ct-chip${v ? ` is-${v}` : ''}" data-fx="c-item" data-id="${esc(it.id)}"${dis}><span>${esc(it.text)}</span>${v ? `<em class="mt-m">${MARK[v]}</em>` : ''}${hint}</button>`;
        }).join('');
        return `<div class="ct-g" data-pc="${gi % PAIR_COLORS}"><button type="button" class="ct-gb" data-fx="c-group" data-id="${esc(g.id)}"${fb || locked || !cur ? ' disabled' : ''}><b>${esc(g.text)}</b></button><div class="ct-in">${chips}</div></div>`;
    }).join('');
    // การ์ดที่ไม่ได้วางเลย (ตอนตรวจ) แสดงว่าตกหล่นและกลุ่มที่ถูก
    const missed = fb ? items.filter((it) => typeof p[it.id] !== 'string') : [];
    const missedHtml = missed.length ? `<div class="ct-miss">${missed.map((it) => `<span class="ct-chip is-bad"><span>${esc(it.text)}</span><small class="mt-ans">ที่ถูก: ${esc(textOf(groups, correct && correct[it.id]))}</small></span>`).join('')}</div>` : '';
    return `<p class="qhint">แตะกลุ่มที่การ์ดใบบนสุดควรอยู่</p>${top}${pool}<div class="ct-groups" data-n="${groups.length}">${boxes}</div>${missedHtml}`;
}

/** โจทย์เติมคำ: ข้อความโจทย์ที่มี [[1]] [[2]] กลายเป็นช่องว่างที่แตะได้ */
function fillStem(q, pick, ui, fb, locked) {
    const bank = list(q.spec && q.spec.bank);
    const p = list(pick);
    const correct = fb ? list(fb.correct) : [];
    return String(q.text ?? '').split(MARKER_RE).map((part, idx) => {
        if (idx % 2 === 0) return esc(part);
        const i = Number(part) - 1;
        const id = p[i];
        const v = fb ? verdict(fb, id !== null && id !== undefined && correct[i] === id) : '';
        const label = id ? esc(textOf(bank, id)) : '&nbsp;';
        return `<button type="button" class="fl-blank${id ? ' filled' : ''}${ui.arm === i ? ' armed' : ''}${v ? ` is-${v}` : ''}" data-fx="f-blank" data-i="${i}" aria-label="ช่องว่างที่ ${i + 1}"${fb || locked ? ' disabled' : ''}>${label}</button>`;
    }).join('');
}

function fillBank(q, pick, fb, locked) {
    const bank = list(q.spec && q.spec.bank);
    const p = list(pick);
    const key = fb && !fb.isCorrect ? `<p class="fl-key">เฉลย ${list(fb.correct).map((id, i) => `<b>${i + 1}.</b> ${esc(textOf(bank, id))}`).join('  ')}</p>` : '';
    if (fb) return key;
    return `<p class="qhint">แตะคำเพื่อใส่ในช่องว่าง (แตะช่องที่ใส่แล้วเพื่อเอาออก)</p><div class="fl-bank" aria-label="คลังคำ">${bank.map((w) => `<button type="button" class="od-chip${p.includes(w.id) ? ' used' : ''}" data-fx="f-word" data-id="${esc(w.id)}"${p.includes(w.id) || locked ? ' disabled' : ''}>${esc(w.text)}</button>`).join('')}</div>`;
}

function numericHtml(q, pick, fb, locked) {
    const unit = q.spec && q.spec.unit ? `<span class="nm-u">${esc(q.spec.unit)}</span>` : '';
    const v = fb ? (fb.isCorrect ? 'ok' : 'bad') : '';
    const c = fb ? fb.correct || {} : null;
    const tol = c && Number(c.tolerance) > 0 ? ` ± ${esc(c.tolerance)}` : '';
    const key = fb && !fb.isCorrect ? `<p class="nm-key">เฉลย <b>${esc(c.value)}${tol}</b> ${esc(c.unit || '')}</p>` : '';
    return `<p class="qhint">พิมพ์เป็นตัวเลข เช่น 3.5</p><div class="nm${v ? ` is-${v}` : ''}"><input class="nm-in" type="text" inputmode="decimal" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" maxlength="24" placeholder="คำตอบ" aria-label="คำตอบ" data-fx="n-input" value="${esc(pick ?? '')}"${fb || locked ? ' disabled' : ''}>${unit}${v ? `<em class="nm-m">${MARK[v]}</em>` : ''}</div>${key}`;
}

/** ข้อความโจทย์ (เติมคำ = มีช่องว่างแทรก) */
export function stemHtml(q, pick, ui, { fb = null, locked = false } = {}) {
    return formatOf(q) === 'fill' ? fillStem(q, pick, ui || {}, fb, locked) : esc(q.text);
}

/** ส่วนตอบของโจทย์ (ใต้ข้อความ/ภาพ) fb = เฉลยของข้อนี้หลังตรวจ (ไม่มี = ยังตอบอยู่) */
export function answerHtml(q, pick, ui, { fb = null, locked = false, swipe = true } = {}) {
    const u = ui || {};
    switch (formatOf(q)) {
        case 'truefalse': return trueFalseCards(q, pick, fb, locked, swipe);
        case 'multi': return `<p class="qhint">เลือกได้หลายข้อ</p>${choiceButtons(q, pick, fb, locked)}`;
        case 'match': return matchHtml(q, pick, u, fb, locked);
        case 'order': return orderHtml(q, pick, fb, locked);
        case 'categorize': return categorizeHtml(q, pick, u, fb, locked);
        case 'fill': return fillBank(q, pick, fb, locked);
        case 'numeric': return numericHtml(q, pick, fb, locked);
        default: return choiceButtons(q, pick, fb, locked);
    }
}

/** ได้บางส่วน (ไม่ถูกหมดแต่ไม่ใช่ศูนย์) */
export const isPartial = (fb) => !!fb && !fb.isCorrect && Number(fb.score) > 0;

/** บรรทัดสรุปคะแนนบางส่วนในแผงเฉลย: "ถูก 3 จาก 4 คู่" (ว่างเมื่อไม่ใช่บางส่วน) */
export function partialLine(q, pick, fb) {
    if (!isPartial(fb)) return '';
    const f = formatOf(q);
    const c = fb.correct;
    const p = pick;
    let right = null;
    let total = null;
    let unit = '';
    if (f === 'match') { total = Object.keys(c || {}).length; right = Object.keys(c || {}).filter((l) => (p || {})[l] === c[l]).length; unit = 'คู่'; }
    else if (f === 'order') { total = list(c).length; right = list(c).filter((id, i) => list(p)[i] === id).length; unit = 'ตำแหน่ง'; }
    else if (f === 'categorize') { total = Object.keys(c || {}).length; right = Object.keys(c || {}).filter((it) => (p || {})[it] === c[it]).length; unit = 'ใบ'; }
    else if (f === 'fill') { total = list(c).length; right = list(c).filter((id, i) => list(p)[i] === id).length; unit = 'ช่อง'; }
    else if (f === 'multi') return `<p class="fb-ans">ได้ <b>${Math.round(Number(fb.score) * 100)}%</b> ของข้อนี้ ติ๊กถูกบางข้อ</p>`;
    if (total === null) return '';
    return `<p class="fb-ans">ถูก <b>${right} จาก ${total} ${unit}</b></p>`;
}

/** เฉลยสั้น ๆ ของรูปแบบที่ตัวโจทย์ยังไม่ได้แสดงเฉลยเองในข้อ (choice/truefalse ใช้ correctChoiceId) */
export function keyLine(q, fb) {
    if (!fb || fb.isCorrect) return '';
    const f = formatOf(q);
    if (f === 'numeric') {
        const c = fb.correct || {};
        return `<p class="fb-ans">เฉลย <b>${esc(c.value)}${Number(c.tolerance) > 0 ? ` ± ${esc(c.tolerance)}` : ''} ${esc(c.unit || '')}</b></p>`;
    }
    if (f === 'truefalse') return `<p class="fb-ans">เฉลย <b>${fb.correctChoiceId === 't' ? 'จริง' : 'เท็จ'}</b></p>`;
    if (f === 'multi') {
        const names = list(q.choices).map((c, i) => (list(fb.correct).includes(c.id) ? `${choiceLabel(i)} ${esc(c.text)}` : null)).filter(Boolean);
        return `<p class="fb-ans">เฉลย <b>${names.join(' • ')}</b></p>`;
    }
    return '';
}

// ───────────── หน้าทบทวน (ผลสรุป) ─────────────
const row = (cls, a, b, c) => `<li class="rv-row ${cls}"><span class="rv-l">${a}</span>${b ? `<span class="rv-y">${b}</span>` : ''}${c ? `<span class="rv-r">${ICON.check(14, 3.4)} ${c}</span>` : ''}</li>`;

/** สิ่งที่ผู้เรียนตอบกับเฉลย ของข้อที่ผิด (item = รายการ review จาก Backend) ใช้ในหน้าทบทวนทีละข้อ */
export function reviewAnswersHtml(item) {
    const f = formatOf(item);
    const yours = item.yourAnswer;
    const key = item.correct;
    const s = item.spec || {};
    if (f === 'choice' || f === 'truefalse') return null; // ให้ผู้เรียกใช้รูปแบบเดิม
    if (f === 'multi') {
        const rows = list(item.choices).map((c, i) => {
            const on = list(yours).includes(c.id);
            const should = list(key).includes(c.id);
            if (!on && !should) return '';
            return row(on && should ? 'ok' : on ? 'bad' : 'miss', `${choiceLabel(i)} ${esc(c.text)}`, on ? '' : 'ยังไม่ได้เลือก', '');
        }).join('');
        return `<ul class="rv">${rows}</ul>`;
    }
    if (f === 'match') {
        const rows = list(s.left).map((l) => {
            const y = (yours || {})[l.id];
            const k = (key || {})[l.id];
            const text = esc(l.text);
            if (y === k) return row('ok', text, '', esc(textOf(s.right, k)));
            return row('bad', text, y ? `<s>${esc(textOf(s.right, y))}</s>` : 'ยังไม่ได้จับคู่', esc(textOf(s.right, k)));
        }).join('');
        return `<ul class="rv">${rows}</ul>`;
    }
    if (f === 'order') {
        const rows = list(key).map((id, i) => {
            const y = list(yours)[i];
            const text = `${i + 1}. ${esc(textOf(s.items, id))}`;
            return y === id ? row('ok', text, '', '') : row('bad', text, y ? `<s>${esc(textOf(s.items, y))}</s>` : 'ว่าง', '');
        }).join('');
        return `<ul class="rv">${rows}</ul>`;
    }
    if (f === 'categorize') {
        const rows = list(s.items).map((it) => {
            const y = (yours || {})[it.id];
            const k = (key || {})[it.id];
            const text = esc(it.text);
            return y === k ? row('ok', text, '', esc(textOf(s.groups, k))) : row('bad', text, y ? `<s>${esc(textOf(s.groups, y))}</s>` : 'ยังไม่ได้จัด', esc(textOf(s.groups, k)));
        }).join('');
        return `<ul class="rv">${rows}</ul>`;
    }
    if (f === 'fill') {
        const rows = list(key).map((id, i) => {
            const y = list(yours)[i];
            const text = `ช่อง ${i + 1}`;
            return y === id ? row('ok', text, '', esc(textOf(s.bank, id))) : row('bad', text, y ? `<s>${esc(textOf(s.bank, y))}</s>` : 'ว่าง', esc(textOf(s.bank, id)));
        }).join('');
        return `<ul class="rv">${rows}</ul>`;
    }
    if (f === 'numeric') {
        const c = key || {};
        return `<ul class="rv">${row('bad', 'คำตอบของคุณ', yours === null || yours === undefined ? 'ยังไม่ได้ตอบ' : `<s>${esc(yours)}</s>`, `<b>${esc(c.value)}${Number(c.tolerance) > 0 ? ` ± ${esc(c.tolerance)}` : ''} ${esc(c.unit || '')}</b>`)}</ul>`;
    }
    return null;
}

/** ข้อความโจทย์ของหน้าทบทวน (เติมคำ = ใส่คำเฉลยลงในช่องว่าง) */
export function reviewStemText(item) {
    if (formatOf(item) !== 'fill') return esc(item.text);
    const bank = list(item.spec && item.spec.bank);
    const key = list(item.correct);
    return String(item.text ?? '').split(MARKER_RE).map((part, idx) => (idx % 2 === 0 ? esc(part) : `<b class="fl-fill">${esc(textOf(bank, key[Number(part) - 1]))}</b>`)).join('');
}
