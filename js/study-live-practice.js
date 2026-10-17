/**
 * js/study-live-practice.js — Practice หนึ่งชุด (วงกลม 1 วงบนเส้นทางเรียน) โหมดข้อมูลจริง
 *
 * โจทย์ฝึกที่ผู้เรียนทำเองบนกระดาษ แล้วดูเฉลยและกด "ทำถูก/ทำผิด" ด้วยตัวเอง ระบบไม่ตรวจให้
 * (จึงไม่นับเป็นดาวและไม่ใช้วิเคราะห์จุดอ่อน) เฉลยจะถูกขอจาก Backend เมื่อกด "ดูเฉลย" เท่านั้น
 *
 * ทำทีละข้อ (ข้อความต่อหน้าน้อยที่สุด): โจทย์ 1 ข้อ → ดูเฉลย → ทำถูก/ทำผิด → ข้อถัดไปเลื่อนเข้ามาเอง จบชุดมีหน้าสรุปสั้น ๆ
 * ปัดซ้าย/ขวาหรือกดลูกศรเพื่อข้ามข้อได้ หน้าแก้เฉพาะจุดที่เปลี่ยน (study-dom.js) จึงไม่กะพริบเมื่อกดปุ่ม
 */
import { esc, ICON, abar } from './study-ui.js';
import { messageOf } from './study-live-common.js';
import { questionMediaHtml } from './study-media.js';
import { burst, pop, shake } from './study-fx.js';
import { animateReward, expPillHtml } from './study-reward.js';

const LEVELS = { easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' };
const MAX_DOTS = 14;

/**
 * @param {object} deps
 * @param {{ id: string }} deps.subject
 * @param {number} deps.lessonNo        เลขบทที่ชุดนี้อยู่
 * @param {{ id: string }} deps.node     node ชนิด practice
 * @param {object} deps.api
 * @param {(opts?: {focus?: boolean}) => void} deps.render
 * @param {(summary: {total:number, done:number, ok:number, wrong:number}) => void} deps.applySummary  แจ้งสรุปกลับไปที่สถานะบทเรียน
 * @param {string|null} [deps.nextHref]  ลิงก์ไปกิจกรรมถัดไป (หน้าสรุป)
 * @param {string} [deps.courseHref]
 * @param {number} [deps.advanceMs]      หน่วงก่อนไปข้อถัดไปหลังกดทำถูก/ทำผิด (<= 0 = ไม่ไปเอง)
 */
export function createPractice({ subject, lessonNo, node, api, render, applySummary, nextHref = null, courseHref = '', advanceMs = 650 }) {
    const s = { load: 'idle', items: [], summary: null, filter: 'all', idx: 0, dir: 0, shown: {}, solutions: {}, busy: new Set(), error: null, fx: null, reward: null, rewardShown: false };
    let advanceToken = 0;

    async function load() {
        s.load = 'loading';
        s.error = null;
        render();
        try {
            const data = await api.getPractice(subject.id, lessonNo, node.id);
            s.items = data.items;
            s.summary = data.summary;
            s.load = 'ready';
            applySummary(data.summary);
        } catch (err) {
            s.load = 'error';
            s.error = messageOf(err);
        }
        render();
    }

    const deck = () => s.items.filter((i) => s.filter === 'all' || (s.filter === 'wrong' ? i.result === 'wrong' : i.level === s.filter));
    const filters = () => {
        const wrong = s.items.filter((i) => i.result === 'wrong').length;
        return [['all', 'ทั้งหมด'], ['easy', 'ง่าย'], ['medium', 'กลาง'], ['hard', 'ยาก'], ['wrong', `ที่ทำผิด${wrong ? ` (${wrong})` : ''}`]];
    };

    const topHtml = (cards) => {
        const total = cards.length;
        const at = Math.min(s.idx, total - 1);
        const dots = total <= MAX_DOTS
            ? `<div class="pk-dots" aria-hidden="true">${cards.map((c, i) => `<i class="${c.result === 'ok' ? 'ok' : c.result === 'wrong' ? 'bad' : ''}${i === at && s.idx < total ? ' cur' : ''}"></i>`).join('')}</div>`
            : `<div class="qbar" aria-hidden="true"><i style="width:${(cards.filter((c) => c.result).length / total) * 100}%"></i></div>`;
        return `<div class="pk-top" data-key="pk-top">${dots}<span class="qcount" aria-label="ข้อที่ ${at + 1} จาก ${total}">${Math.min(s.idx, total - 1) + 1}/${total}</span></div>`;
    };

    function cardHtml(item) {
        const shown = !!s.shown[item.id];
        const sol = s.solutions[item.id];
        const label = LEVELS[item.level] || item.level;
        const solution = shown
            ? `<div class="pcard-sol" role="region" aria-label="เฉลย"><b>เฉลยและวิธีคิด</b>${sol === undefined ? '<span class="sk-inline"><i class="sk sk-line"></i><i class="sk sk-line s"></i><span class="sr-only">กำลังโหลดเฉลย...</span></span>' : `<span style="white-space:pre-line">${esc(sol)}</span>`}</div>`
            : '';
        const mark = item.result === 'ok' ? `<span class="pcard-r ok" aria-label="ทำถูกแล้ว">${ICON.check(14, 3.6)}</span>` : item.result === 'wrong' ? `<span class="pcard-r bad" aria-label="ทำผิดแล้ว">${ICON.x(14, 3.6)}</span>` : '';
        return `<div class="pk-view" data-key="c-${esc(item.id)}" data-dir="${s.dir}">
          <article class="pcard${item.result === 'ok' ? ' ok' : item.result === 'wrong' ? ' bad' : ''}">
            <div class="pcard-h"><span class="lvl lvl-${esc(label)}">${esc(label)}</span><span class="cap pcard-topic">${esc(item.topic)}</span>${mark}<span class="pcard-nav"><button type="button" data-act="pk-prev" aria-label="ข้อก่อนหน้า"${s.idx === 0 ? ' disabled' : ''}>${ICON.prev(16)}</button><button type="button" data-act="pk-next" aria-label="ข้อถัดไป">${ICON.next(16)}</button></span></div>
            <p class="pcard-q" style="white-space:pre-line">ข้อ ${item.n} ${esc(item.text)}</p>
            ${questionMediaHtml(item.media)}
            ${solution}
          </article>
        </div>`;
    }

    function barHtml(item) {
        const shown = !!s.shown[item.id];
        const busy = s.busy.has(item.id);
        if (!shown) return abar(`<button type="button" class="btn btn-lg" data-key="reveal" data-pshow="${esc(item.id)}" aria-expanded="false"><span>ดูเฉลย</span></button>`);
        return abar(`<button type="button" class="btn btn-lg btn-bad${item.result === 'wrong' ? ' on' : ''}" data-key="m-wrong" data-pmark="${esc(item.id)}:wrong" aria-pressed="${item.result === 'wrong'}"${busy ? ' disabled' : ''}>${ICON.x(18, 3.2)}<span>ทำผิด</span></button><button type="button" class="btn btn-lg btn-ok${item.result === 'ok' ? ' on' : ''}" data-key="m-ok" data-pmark="${esc(item.id)}:ok" aria-pressed="${item.result === 'ok'}"${busy ? ' disabled' : ''}>${ICON.check(18, 3.2)}<span>ทำถูก</span></button>`);
    }

    function doneHtml(cards) {
        const ok = cards.filter((c) => c.result === 'ok').length;
        const wrong = cards.filter((c) => c.result === 'wrong').length;
        const left = cards.length - ok - wrong;
        return `<section class="rblock result pk-done" data-key="pk-done">
          <div class="cn-medal" aria-hidden="true">🏁</div>
          <h2>ครบ ${cards.length} ข้อแล้ว</h2>
          <div class="pills"><span class="pill ok">${ICON.check(14, 3.4)} ถูก ${ok}</span>${wrong ? `<span class="pill warn">${ICON.x(14, 3.4)} ผิด ${wrong}</span>` : ''}${left ? `<span class="pill">ยังไม่ได้ทำ ${left}</span>` : ''}${expPillHtml(s.reward)}</div>
          <div class="res-actions">
            ${wrong ? `<button type="button" class="btn btn-lg btn-block btn-bad" data-pf="wrong" style="margin-top:0"><span>ฝึกข้อที่ผิดอีกครั้ง (${wrong})</span></button>` : ''}
            ${nextHref ? `<a class="btn btn-lg btn-block" href="${esc(nextHref)}" style="margin-top:0"><span>ไปกิจกรรมถัดไป</span>${ICON.next(14)}</a>` : ''}
            ${courseHref ? `<a class="btn btn-lg btn-block btn-line" href="${esc(courseHref)}" style="margin-top:0">กลับไปเส้นทางเรียน</a>` : ''}
            <div class="res-links"><button type="button" class="linkbtn" data-act="pk-restart">ทำตั้งแต่ข้อแรก</button><button type="button" class="linkbtn" data-act="practice-reset">ล้างผลการฝึก</button></div>
          </div>
        </section>`;
    }

    function html() {
        if (s.load === 'idle' || s.load === 'loading') return '<div class="sk-wrap" role="status" aria-live="polite" aria-busy="true"><span class="sr-only">กำลังโหลดโจทย์...</span><i class="sk sk-line"></i><i class="sk sk-card"></i></div>';
        if (s.load === 'error') {
            return `<section class="notfound" role="alert"><h2>โหลดโจทย์ไม่สำเร็จ</h2><p>${esc(s.error)}</p><div class="notfound-act"><button type="button" class="btn" data-act="practice-retry">ลองใหม่</button></div></section>`;
        }
        if (s.items.length === 0) return '<p class="empty-p fade-in" data-key="empty">ชุดนี้ยังไม่มีโจทย์ฝึก ระหว่างนี้ทำ Quiz หรืออ่านเนื้อหาซ้ำได้</p>';
        const cards = deck();
        const chips = `<div class="pfilter" role="group" aria-label="กรองโจทย์" data-key="pk-filter">${filters().map(([k, name]) => `<button type="button" class="fchip${s.filter === k ? ' on' : ''}" data-pf="${k}" aria-pressed="${s.filter === k}">${esc(name)}</button>`).join('')}</div>`;
        const err = s.error ? `<p class="errbox" role="alert">${esc(s.error)}</p>` : '';
        if (cards.length === 0) {
            return `${chips}<p class="empty-p" data-key="none-${esc(s.filter)}">ยังไม่มีโจทย์ในหมวดนี้${s.filter === 'wrong' ? ' — ข้อที่ทำผิดจะมารวมอยู่ที่นี่' : ''}</p>${err}`;
        }
        if (s.idx >= cards.length) return `${chips}${doneHtml(cards)}${err}`;
        const item = cards[s.idx];
        return `${chips}${topHtml(cards)}${cardHtml(item)}${err}${barHtml(item)}`;
    }

    function go(delta) {
        const cards = deck();
        const to = Math.min(cards.length, Math.max(0, s.idx + delta));
        if (to === s.idx || cards.length === 0) return false;
        advanceToken++;
        s.dir = delta;
        s.idx = to;
        window.scrollTo(0, 0);
        render({ focus: true });
        return true;
    }

    async function showSolution(id) {
        s.shown[id] = !s.shown[id];
        s.error = null;
        render({ focus: true });
        if (!s.shown[id] || s.solutions[id] !== undefined) return;
        try {
            s.solutions[id] = (await api.getSolution(subject.id, lessonNo, id, node.id)).solution;
        } catch (err) {
            s.shown[id] = false;
            s.error = messageOf(err);
        }
        render();
    }

    async function mark(id, result) {
        if (s.busy.has(id)) return;
        s.busy.add(id);
        s.error = null;
        render();
        let saved = false;
        try {
            const { summary, reward } = await api.setPracticeResult(subject.id, lessonNo, id, result, node.id);
            s.fx = { id, result };
            if (reward) { s.reward = reward; s.rewardShown = false; }
            s.items = s.items.map((i) => (i.id === id ? { ...i, result } : i));
            s.summary = summary;
            saved = true;
            applySummary(summary);
        } catch (err) {
            s.error = messageOf(err);
        } finally {
            s.busy.delete(id);
            render();
        }
        // บันทึกแล้ว: ให้เห็นผล (ติ๊ก/เขย่า) สักครู่ แล้วเลื่อนไปข้อถัดไปเอง ถ้าผู้ใช้ไม่ได้ย้ายข้อไปก่อน
        if (saved && advanceMs > 0) {
            const token = ++advanceToken;
            const timer = setTimeout(() => { if (token === advanceToken && deck()[s.idx] && deck()[s.idx].id === id) go(1); }, advanceMs);
            if (timer && typeof timer.unref === 'function') timer.unref();
        }
    }

    async function reset() {
        if (!s.summary || s.summary.done === 0) return;
        s.error = null;
        try {
            const { summary } = await api.resetPractice(subject.id, lessonNo, node.id);
            s.items = s.items.map((i) => ({ ...i, result: null }));
            s.summary = summary;
            s.shown = {};
            s.idx = 0;
            s.dir = -1;
            s.reward = null;
            applySummary(summary);
        } catch (err) {
            s.error = messageOf(err);
        }
        render();
    }

    return {
        /** เรียกเมื่อเปิดแท็บ: โหลดโจทย์ครั้งแรก */
        open() { if (s.load === 'idle') load(); },
        html,
        hasAbar: () => {
            if (s.load !== 'ready') return false;
            const cards = deck();
            return cards.length > 0 && s.idx < cards.length;
        },
        /** เอฟเฟกต์หลังวาดหน้า: ทำถูก = ปุ่มเด้ง+ดาวกระจาย, ทำผิด = การ์ดสั่นเบา ๆ */
        afterRender(root) {
            const fx = s.fx;
            s.fx = null;
            s.dir = 0;
            // ตัวเลข EXP นับขึ้นครั้งเดียวตอนหน้าสรุปโผล่ (ไม่นับซ้ำทุกครั้งที่วาดหน้า)
            if (s.reward && !s.rewardShown && root && typeof root.querySelector === 'function' && root.querySelector('[data-exp-count]')) { s.rewardShown = true; animateReward(root); }
            if (!fx || !root || typeof root.querySelector !== 'function') return;
            if (fx.result === 'ok') {
                const btn = root.querySelector('.btn-ok');
                pop(btn, { scale: 1.1, ms: 380 });
                burst(btn, { count: 12, radius: 70 });
            } else {
                shake(root.querySelector('.pcard'));
            }
        },
        handleClick(e) {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'practice-retry') { load(); return true; }
            if (act === 'practice-reset') { reset(); return true; }
            if (act === 'pk-prev') { go(-1); return true; }
            if (act === 'pk-next') { go(1); return true; }
            if (act === 'pk-restart') { advanceToken++; s.idx = 0; s.dir = -1; render({ focus: true }); return true; }
            const filter = e.target.closest('[data-pf]');
            if (filter) { advanceToken++; s.filter = filter.dataset.pf; s.idx = 0; s.dir = 0; render(); return true; }
            const show = e.target.closest('[data-pshow]');
            if (show) { showSolution(show.dataset.pshow); return true; }
            const markBtn = e.target.closest('[data-pmark]');
            if (markBtn) {
                const [id, result] = markBtn.dataset.pmark.split(':');
                mark(id, result);
                return true;
            }
            return false;
        },
        /** ปัดนิ้ว / กดลูกศร: +1 = ข้อถัดไป, −1 = ข้อก่อนหน้า */
        step(delta) { return s.load === 'ready' ? go(delta) : false; },
    };
}
