/**
 * js/study-live-practice.js — Practice หนึ่งชุด (วงกลม 1 วงบนเส้นทางเรียน) โหมดข้อมูลจริง
 *
 * โจทย์ฝึกที่ผู้เรียนทำเองบนกระดาษ แล้วดูเฉลยและกด "ทำถูก/ทำผิด" ด้วยตัวเอง ระบบไม่ตรวจให้
 * (จึงไม่นับเป็นดาวและไม่ใช้วิเคราะห์จุดอ่อน) เฉลยจะถูกขอจาก Backend เมื่อกด "ดูเฉลย" เท่านั้น
 */
import { esc, ICON } from './study-ui.js';
import { messageOf } from './study-live-common.js';
import { questionMediaHtml } from './study-media.js';
import { burst, pop } from './study-fx.js';

const LEVELS = { easy: 'ง่าย', medium: 'กลาง', hard: 'ยาก' };

/**
 * @param {object} deps
 * @param {{ id: string }} deps.subject
 * @param {number} deps.lessonNo        เลขบทที่ชุดนี้อยู่
 * @param {{ id: string }} deps.node     node ชนิด practice
 * @param {object} deps.api
 * @param {(opts?: {focus?: boolean}) => void} deps.render
 * @param {(summary: {total:number, done:number, ok:number, wrong:number}) => void} deps.applySummary  แจ้งสรุปกลับไปที่สถานะบทเรียน
 */
export function createPractice({ subject, lessonNo, node, api, render, applySummary }) {
    const s = { load: 'idle', items: [], summary: null, filter: 'all', shown: {}, solutions: {}, busy: new Set(), error: null, fx: null };

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

    const filters = () => {
        const wrong = s.items.filter((i) => i.result === 'wrong').length;
        return [['all', 'ทั้งหมด'], ['easy', 'ง่าย'], ['medium', 'กลาง'], ['hard', 'ยาก'], ['wrong', `ที่ทำผิด${wrong ? ` (${wrong})` : ''}`]];
    };

    function card(item) {
        const shown = !!s.shown[item.id];
        const sol = s.solutions[item.id];
        const busy = s.busy.has(item.id);
        const label = LEVELS[item.level] || item.level;
        const solution = shown
            ? `<div class="pcard-sol" role="region" aria-label="เฉลย"><b>เฉลยและวิธีคิด</b><span style="white-space:pre-line">${sol === undefined ? 'กำลังโหลดเฉลย...' : esc(sol)}</span></div>`
            : '';
        return `<article class="pcard${item.result === 'ok' ? ' ok' : item.result === 'wrong' ? ' bad' : ''}">
          <div class="pcard-h"><span class="lvl lvl-${esc(label)}">${esc(label)}</span><span class="cap">${esc(item.topic)}</span></div>
          <p class="pcard-q" style="white-space:pre-line">ข้อ ${item.n} ${esc(item.text)}</p>
          ${questionMediaHtml(item.media)}
          ${solution}
          <div class="pcard-act">
            <button type="button" class="pbtn" data-pshow="${esc(item.id)}" aria-expanded="${shown}">${shown ? 'ซ่อนเฉลย' : 'ดูเฉลย'}</button>
            <button type="button" class="pbtn ok${item.result === 'ok' ? ' on' : ''}" data-pmark="${esc(item.id)}:ok" aria-pressed="${item.result === 'ok'}"${busy ? ' disabled' : ''}>${ICON.check(16)}<span>ทำถูก</span></button>
            <button type="button" class="pbtn bad${item.result === 'wrong' ? ' on' : ''}" data-pmark="${esc(item.id)}:wrong" aria-pressed="${item.result === 'wrong'}"${busy ? ' disabled' : ''}>${ICON.x(16)}<span>ทำผิด</span></button>
          </div>
        </article>`;
    }

    function html() {
        if (s.load === 'idle' || s.load === 'loading') return '<div class="loading" role="status" aria-live="polite">กำลังโหลดโจทย์...</div>';
        if (s.load === 'error') {
            return `<section class="notfound" role="alert"><h2>โหลดโจทย์ไม่สำเร็จ</h2><p>${esc(s.error)}</p><div class="notfound-act"><button type="button" class="btn" data-act="practice-retry">ลองใหม่</button></div></section>`;
        }
        if (s.items.length === 0) return '<p class="empty-p fade-in">ชุดนี้ยังไม่มีโจทย์ฝึก ระหว่างนี้ทำ Quiz หรืออ่านเนื้อหาซ้ำได้</p>';
        const { total, done, ok } = s.summary;
        const list = s.items.filter((i) => s.filter === 'all' || (s.filter === 'wrong' ? i.result === 'wrong' : i.level === s.filter));
        return `<div class="fade-in">
          <div class="psum"><b>ทำแล้ว ${done}/${total}</b><div class="bar" aria-hidden="true"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div><b>ถูก ${ok}</b></div>
          <p class="cap" style="margin-top:8px">ลองทำเองก่อน แล้วค่อยดูเฉลย จากนั้นกดบอกว่าทำถูกหรือทำผิด (ระบบไม่ตรวจให้ ผลนี้ไว้ให้คุณติดตามตัวเอง)</p>
          <div class="pfilter" role="group" aria-label="กรองโจทย์" style="margin-top:12px">${filters().map(([k, name]) => `<button type="button" class="fchip${s.filter === k ? ' on' : ''}" data-pf="${k}" aria-pressed="${s.filter === k}">${esc(name)}</button>`).join('')}</div>
          ${s.error ? `<p class="errbox" role="alert">${esc(s.error)}</p>` : ''}
          <div class="plist">${list.length ? list.map(card).join('') : `<p class="empty-p">ยังไม่มีโจทย์ในหมวดนี้ ${s.filter === 'wrong' ? '— ข้อที่ทำผิดจะมารวมอยู่ที่นี่เพื่อให้ฝึกซ้ำ' : ''}</p>`}</div>
          ${done ? '<p style="text-align:center;margin-top:12px"><button type="button" class="linkbtn" data-act="practice-reset" style="min-height:44px;font-size:14px;font-weight:700;text-decoration:underline;color:#475569">ล้างผลการฝึกของชุดนี้</button></p>' : ''}
        </div>`;
    }

    async function showSolution(id) {
        s.shown[id] = !s.shown[id];
        s.error = null;
        render();
        document.querySelector(`[data-pshow="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
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
        try {
            const { summary } = await api.setPracticeResult(subject.id, lessonNo, id, result, node.id);
            if (result === 'ok') s.fx = id;
            s.items = s.items.map((i) => (i.id === id ? { ...i, result } : i));
            s.summary = summary;
            applySummary(summary);
        } catch (err) {
            s.error = messageOf(err);
        } finally {
            s.busy.delete(id);
            render();
            document.querySelector(`[data-pmark="${CSS.escape(`${id}:${result}`)}"]`)?.focus({ preventScroll: true });
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
        /** เอฟเฟกต์หลังวาดหน้า: ทำถูกแล้วปุ่มเด้งเล็ก ๆ */
        afterRender(root) {
            const id = s.fx;
            s.fx = null;
            if (!id || !root || typeof root.querySelector !== 'function') return;
            const btn = root.querySelector(`[data-pmark="${id}:ok"]`);
            pop(btn);
            burst(btn, { count: 8, radius: 50 });
        },
        handleClick(e) {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'practice-retry') { load(); return true; }
            if (act === 'practice-reset') { reset(); return true; }
            const filter = e.target.closest('[data-pf]');
            if (filter) { s.filter = filter.dataset.pf; render(); return true; }
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
    };
}
