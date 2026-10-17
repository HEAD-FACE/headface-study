/**
 * js/study-result.js — หน้าสรุปผลแบบ "ทีละหน้า" (Quiz / Mock Exam / จบเนื้อหา / จบ Practice)
 *
 * แทนที่หน้าสรุปยาว ๆ ที่มีกราฟ ตาราง และปุ่มหลายปุ่มในหน้าเดียว: แต่ละหน้ามีเรื่องเดียว ข้อความสั้น มีแอนิเมชัน และมีปุ่มหลักปุ่มเดียว
 *   คะแนน (ถูกกี่ข้อ เป็นลูกบอลโผล่ทีละลูก) → ทบทวนข้อที่ผิดทีละข้อ → ดาว (Mock) → EXP ที่ได้ → เลื่อนเลเวล (ถ้าได้เลื่อน) → ปุ่มไปต่อ
 * หน้าสุดท้ายมีปุ่มหลัก 1 ปุ่ม กับลิงก์เล็ก ๆ ไม่เกิน 2 ลิงก์
 *
 * ไม่คำนวณรางวัลเอง: EXP / เลเวล / เลื่อนเลเวล มาจาก reward ที่ Backend ส่งมา (docs/study-api-contract.md ข้อ 2.11)
 */
import { esc, ICON, abar } from './study-ui.js';
import { choiceLabel, scoreMessage } from './study-format.js';
import { questionMediaHtml } from './study-media.js';
import { confetti, countUp, pop, burst } from './study-fx.js';

const BOLT = (size = 44) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/></svg>`;

/** ช่วง EXP ของเลเวล n: ต้องตรงกับ levelOf ที่ Backend (เลเวล n เริ่มที่ 50 × (n−1)² EXP) ใช้แค่เล่นแอนิเมชันแถบ */
export const levelRange = (level) => ({ from: 50 * (level - 1) ** 2, to: 50 * level ** 2 });

const pctIn = (exp, range) => Math.max(0, Math.min(100, Math.floor(((exp - range.from) * 100) / (range.to - range.from))));

/** แถบเลเวลของรางวัลที่เพิ่งได้: เลเวลที่แสดง และ % ก่อน/หลัง (เลื่อนเลเวล = วิ่งเต็มแถบ) null เมื่อไม่มีข้อมูล */
export function levelBar(reward) {
    const t = reward && reward.totals;
    if (!t || !t.level) return null;
    const before = Math.max(0, Number(t.exp) - Number(reward.exp));
    if (reward.levelUp) return { level: reward.levelUp.from, from: pctIn(before, levelRange(reward.levelUp.from)), to: 100 };
    return { level: t.level.level, from: pctIn(before, { from: t.level.from, to: t.level.to }), to: t.level.pct };
}

// ───────────── หน้าแต่ละแบบ ─────────────
/** หน้าคะแนน: ถูกกี่ข้อ (ตัวเลขใหญ่ + ลูกบอลโผล่ทีละลูก) ไม่มีกราฟ */
export function scoreStepHtml({ correct, total, marks, passed, lessonDone = false, extra = '' }) {
    const percent = total > 0 ? Math.round((correct * 100) / total) : 0;
    const emoji = percent >= 80 ? '🏆' : percent >= 60 ? '🎉' : percent >= 40 ? '💪' : '🌱';
    const badge = passed === true ? `<span class="pill ok rs-badge">${ICON.check(14, 3.4)} ผ่านเกณฑ์!</span>` : passed === false ? '<span class="pill warn rs-badge">เกือบผ่านแล้ว ลองอีกครั้งนะ</span>' : '';
    return `<section class="rs-card rs-score">
      <div class="rs-emoji" aria-hidden="true">${emoji}</div>
      <p class="rs-k">ถูก</p>
      <p class="rs-big"><span data-count="${correct}">${correct}</span><small>/ ${total} ข้อ</small></p>
      <div class="rs-marks" aria-hidden="true">${marks.map((ok, i) => `<i class="${ok ? 'ok' : 'bad'}" style="--i:${i}">${ok ? ICON.check(14, 3.6) : ICON.x(14, 3.6)}</i>`).join('')}</div>
      <h2>${esc(scoreMessage(percent))}</h2>
      <div class="rs-pills">${badge}${lessonDone ? '<span class="pill gold rs-badge">บทนี้เสร็จสมบูรณ์ 🎉</span>' : ''}${extra}</div>
    </section>`;
}

/** หน้าทบทวน 1 ข้อ: คำตอบที่ถูกกับเหตุผล (ข้อความสั้น) item = รายการ review ของ Backend */
export function reviewStepHtml({ item, index, count }) {
    const ci = item.choices.findIndex((c) => c.id === item.correctChoiceId);
    const yi = item.choices.findIndex((c) => c.id === item.yourChoiceId);
    return `<section class="rs-card rs-review">
      <p class="rs-k">มาทบทวนกัน${count > 1 ? ` <em>${index + 1}/${count}</em>` : ''}</p>
      <h3 class="rs-q" style="white-space:pre-line">ข้อ ${item.n} ${esc(item.text)}</h3>
      ${questionMediaHtml(item.media)}
      <p class="rs-yours">${yi >= 0 ? `คุณตอบ <s>${choiceLabel(yi)} ${esc(item.choices[yi].text)}</s>` : 'ยังไม่ได้ตอบข้อนี้'}</p>
      <p class="rs-right">${ICON.check(18, 3.4)}<span>เฉลย <b>${ci >= 0 ? `${choiceLabel(ci)} ${esc(item.choices[ci].text)}` : ''}</b></span></p>
      ${item.explanation ? `<p class="rs-why">${esc(item.explanation)}</p>` : ''}
    </section>`;
}

/** หน้าดาว (Mock): ดาวที่ได้นับขึ้น พร้อมที่มาสั้น ๆ */
export function starsStepHtml({ stars, base, bonus, percent }) {
    return `<section class="rs-card rs-stars">
      <div class="rs-star" aria-hidden="true">${ICON.star(64, '#F59E0B')}</div>
      <p class="rs-big gold"><span data-count="${stars}">${stars}</span><small>ดาว</small></p>
      <p class="rs-cap">${stars > 0 ? `จากคะแนน ${percent}% = ${base} ดาว${bonus ? ` + โบนัสเวลา ${bonus}` : ''}` : 'ครั้งนี้ยังไม่ได้ดาว ลองอีกครั้งนะ'}</p>
    </section>`;
}

/** หน้า EXP ที่ได้รับ: ตัวเลขใหญ่นับขึ้น ที่มาสั้น ๆ (ข้อถูก + ทำเสร็จ) และแถบเลเวลที่วิ่งขึ้น */
export function expStepHtml({ reward, emoji = '', title = 'ได้รับ EXP' }) {
    const bar = levelBar(reward);
    const parts = reward.parts && (reward.parts.answers > 0 || reward.parts.completion > 0)
        ? `<div class="rs-parts">${reward.parts.answers > 0 ? `<span>ข้อที่ถูก +${reward.parts.answers}</span>` : ''}${reward.parts.completion > 0 ? `<span>ทำเสร็จ +${reward.parts.completion}</span>` : ''}</div>`
        : '';
    return `<section class="rs-card rs-exp">
      ${emoji ? `<div class="rs-emoji" aria-hidden="true">${emoji}</div>` : ''}
      <div class="rs-bolt" aria-hidden="true">${BOLT(46)}</div>
      <p class="rs-k">${esc(title)}</p>
      <p class="rs-big gold" aria-label="ได้รับ ${reward.exp} EXP">+<span data-count="${reward.exp}">${reward.exp}</span><small>EXP</small></p>
      ${parts}
      ${reward.halved ? '<p class="rs-cap">ทำซ้ำ ได้ครึ่งเดียว</p>' : ''}
      ${bar ? `<div class="rs-lvl"><b>Lv. ${bar.level}</b><div class="rs-lbar"><i data-to="${bar.to}" style="width:${bar.from}%"></i></div></div>` : ''}
    </section>`;
}

/** หน้าเลื่อนเลเวล */
export function levelUpStepHtml(reward) {
    return `<section class="rs-card rs-levelup">
      <div class="rs-emoji" aria-hidden="true">🆙</div>
      <p class="rs-k">เลื่อนเป็นเลเวล</p>
      <p class="rs-big gold">Lv. <span data-count="${reward.levelUp.to}">${reward.levelUp.to}</span></p>
      <h2>เก่งมาก ไปต่อกันเลย!</h2>
    </section>`;
}

// ───────────── แอนิเมชันของแต่ละหน้า ─────────────
export function countAll(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count), { ms: 950 }));
}
export function fillBars(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('.rs-lbar i[data-to]').forEach((el) => setTimeout(() => { el.style.width = `${el.dataset.to}%`; }, 450));
}

/** ชุดหน้าที่ใช้ร่วมกัน: ขั้นตอน EXP + เลื่อนเลเวล (ต่อท้ายหน้าอื่นของแต่ละกิจกรรม) */
export function rewardSteps(reward, { emoji = '', title } = {}) {
    const steps = [];
    if (reward && Number(reward.exp) > 0) {
        steps.push({
            key: 'exp',
            html: () => expStepHtml({ reward, emoji, title }),
            label: 'ต่อไป',
            fx(root) { countAll(root); fillBars(root); pop(root.querySelector('.rs-bolt'), { scale: 1.35, ms: 600 }); burst(root.querySelector('.rs-bolt'), { count: 12, radius: 80, colors: ['#FBBF24', '#F59E0B', '#FDE68A', '#FCD34D'] }); },
        });
    }
    if (reward && reward.levelUp) {
        steps.push({
            key: 'level',
            html: () => levelUpStepHtml(reward),
            label: 'ต่อไป',
            fx(root) { countAll(root); confetti({ count: 120 }); pop(root.querySelector('.rs-emoji'), { scale: 1.4, ms: 700 }); },
        });
    }
    return steps;
}

// ───────────── ตัวเดินหน้า ─────────────
/**
 * @param {object} o
 * @param {Array<{key: string, count?: number, html: (sub: number) => string, label: string|((sub:number)=>string), fx?: (root: Element) => void}>} o.steps
 * @param {(opts?: {focus?: boolean}) => void} o.render
 * @param {{ href: string, label: string }} o.finalCta   ปุ่มหลักของหน้าสุดท้าย
 * @param {string} [o.linksHtml]                          ลิงก์เล็ก ๆ ท้ายหน้าสุดท้าย (ไม่เกิน 2)
 */
export function createResultFlow({ steps, render, finalCta, linksHtml = '' }) {
    let at = 0;
    let sub = 0;
    const seen = new Set();
    const subCount = (step) => Math.max(1, step.count || 1);
    const isLast = () => at === steps.length - 1 && sub === subCount(steps[at]) - 1;
    const labelOf = (step) => (typeof step.label === 'function' ? step.label(sub) : step.label);

    function advance() {
        const step = steps[at];
        if (sub + 1 < subCount(step)) sub++;
        else if (at + 1 < steps.length) { at++; sub = 0; } else return false;
        window.scrollTo(0, 0);
        render({ focus: true });
        return true;
    }

    /** ข้ามหน้าที่ข้ามได้ (เช่น ทบทวนข้อที่ผิดทั้งหมด) ไปหน้าถัดไปของหัวข้ออื่นเลย */
    function skip() {
        if (at + 1 >= steps.length) return false;
        at++;
        sub = 0;
        window.scrollTo(0, 0);
        render({ focus: true });
        return true;
    }

    return {
        advance,
        skip,
        isLast,
        get stepKey() { return `${steps[at].key}-${sub}`; },
        html() {
            const step = steps[at];
            const dots = steps.length > 1
                ? `<div class="rs-dots" role="progressbar" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${at + 1}" aria-label="หน้า ${at + 1} จาก ${steps.length}">${steps.map((_, i) => `<i class="${i < at ? 'on' : i === at ? 'cur' : ''}"></i>`).join('')}</div>`
                : '';
            const action = isLast()
                ? `<a class="btn btn-lg" href="${esc(finalCta.href)}"><span>${esc(finalCta.label)}</span>${ICON.next(14)}</a>`
                : `<button type="button" class="btn btn-lg" data-act="rs-next"><span>${esc(labelOf(step))}</span>${ICON.next(14)}</button>`;
            return `<div data-key="rs">${dots}<div class="rs-view" data-key="${step.key}-${sub}" data-dir="1">${step.html(sub)}${isLast() && linksHtml ? `<div class="res-links">${linksHtml}</div>` : ''}${step.skippable && !isLast() && at + 1 < steps.length ? '<div class="res-links"><button type="button" class="linkbtn" data-act="rs-skip">ข้ามการทบทวน</button></div>' : ''}</div></div>${abar(action)}`;
        },
        /** เล่นแอนิเมชันของหน้าที่เพิ่งโผล่ (ครั้งเดียวต่อหน้า) */
        afterRender(root) {
            if (!root || typeof root.querySelector !== 'function') return;
            const id = `${steps[at].key}-${sub}`;
            if (seen.has(id)) return;
            seen.add(id);
            const step = steps[at];
            if (step.fx) step.fx(root);
        },
        handleClick(e) {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'rs-next') { advance(); return true; }
            if (act === 'rs-skip') { skip(); return true; }
            return false;
        },
    };
}
