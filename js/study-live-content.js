/**
 * js/study-live-content.js — ชุดเนื้อหาหนึ่งชุด (วงกลม 1 วงบนเส้นทางเรียน) แบ่งเป็นหลายหน้า
 *
 * เนื้อหาเรื่องเดียวกันถูกแบ่งเป็นหน้า ๆ ให้อ่านทีละหน้า (ไม่จำกัดจำนวนบล็อกต่อหน้า) มีแถบความคืบหน้าแบบแบ่งช่อง
 * ปุ่มก่อนหน้า/ถัดไป (ปัดซ้าย-ขวาหรือกดลูกศรได้) หน้าสุดท้ายกด "จบเนื้อหา" เพื่อบันทึกว่าเรียนชุดนี้จบแล้ว
 * ที่ค้างอยู่ถูกจำไว้ที่ Backend: เปิดใหม่จะกลับไปหน้าที่อ่านถึง
 */
import { esc, ICON, abar } from './study-ui.js';
import { blocksHtml } from './study-blocks.js';
import { messageOf } from './study-live-common.js';
import { confetti, pop } from './study-fx.js';

/**
 * @param {object} deps
 * @param {{ id: string }} deps.subject
 * @param {number} deps.lessonNo
 * @param {object} deps.node           node ชนิด content: { id, title, pages: [{title, blocks}], progress: {pageReached, completedAt} }
 * @param {object} deps.api
 * @param {(opts?: {focus?: boolean}) => void} deps.render
 * @param {(done: object) => void} [deps.applyProgress]  คำตอบของ PUT .../progress (progress ของบท)
 * @param {string|null} deps.nextHref  ลิงก์ไปกิจกรรมถัดไป (null = ไม่มี)
 * @param {string} deps.courseHref
 */
export function createContent({ subject, lessonNo, node, api, render, applyProgress = () => {}, nextHref, courseHref }) {
    const pages = Array.isArray(node.pages) ? node.pages : [];
    const last = Math.max(0, pages.length - 1);
    const reached = Number(node.progress && node.progress.pageReached) || 0;
    const wasDone = !!(node.progress && node.progress.completedAt);

    const s = { phase: 'read', page: wasDone ? 0 : Math.min(reached, last), dir: 0, busy: false, error: null, saved: reached, fx: null };

    /** บันทึกหน้าที่อ่านถึง (ไม่รอผล: ถ้าล้มเหลวก็แค่เปิดใหม่แล้วเริ่มหน้าก่อนหน้า) */
    function savePage() {
        if (s.page <= s.saved) return;
        s.saved = s.page;
        api.setNodeProgress(subject.id, lessonNo, node.id, { page: s.page }).catch(() => { s.saved = Math.max(0, s.page - 1); });
    }

    function go(delta) {
        const to = Math.min(last, Math.max(0, s.page + delta));
        if (to === s.page) return false;
        s.dir = delta;
        s.page = to;
        savePage();
        window.scrollTo(0, 0);
        render({ focus: true });
        return true;
    }

    async function finish() {
        if (s.busy) return;
        s.busy = true;
        s.error = null;
        render();
        try {
            const done = await api.setNodeProgress(subject.id, lessonNo, node.id, { page: last, completed: true });
            applyProgress(done);
            s.phase = 'done';
            s.fx = 'finish';
            window.scrollTo(0, 0);
        } catch (err) {
            s.error = messageOf(err);
        } finally {
            s.busy = false;
            render({ focus: !s.error });
        }
    }

    const dots = () => {
        if (pages.length < 2) return '';
        return `<div class="cn-dots" role="progressbar" aria-valuemin="1" aria-valuemax="${pages.length}" aria-valuenow="${s.page + 1}" aria-label="หน้า ${s.page + 1} จาก ${pages.length}">${pages.map((_, i) => `<i class="${i < s.page ? 'on' : i === s.page ? 'cur' : ''}"></i>`).join('')}</div>`;
    };

    function readHtml() {
        if (pages.length === 0) return '<p class="empty-p fade-in">ชุดเนื้อหานี้ยังไม่มีหน้า</p>';
        const page = pages[s.page];
        const isLast = s.page === last;
        const action = isLast
            ? `<button type="button" class="btn btn-lg" data-act="cn-finish"${s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังบันทึก...' : wasDone ? 'จบ ✓' : 'จบเนื้อหา ✓'}</span></button>`
            : `<button type="button" class="btn btn-lg" data-act="cn-next"><span>ถัดไป</span>${ICON.next(14)}</button>`;
        return `<div class="cn">
          ${dots()}
          <p class="cn-meta">${pages.length > 1 ? `หน้า ${s.page + 1}/${pages.length}` : 'เนื้อหา'}${page.title ? ` • ${esc(page.title)}` : ''}</p>
          <div class="read cn-page" id="cn-page" data-dir="${s.dir}">${blocksHtml(page.blocks) || '<p class="empty-p">หน้านี้ยังไม่มีเนื้อหา</p>'}</div>
          ${s.error ? `<p class="errbox" role="alert">${esc(s.error)}</p>` : ''}
        </div>
        ${abar(`<button type="button" class="btn btn-lg btn-line" data-act="cn-prev"${s.page === 0 ? ' disabled' : ''} style="flex:.8">ก่อนหน้า</button>${action}`)}`;
    }

    function doneHtml() {
        return `<section class="rblock result cn-done fade-in">
          <div class="cn-medal" aria-hidden="true">🎉</div>
          <h2>เรียนจบ “${esc(node.title)}” แล้ว</h2>
          <p>อ่านครบ ${pages.length} หน้า เก่งมาก! ไปทำกิจกรรมถัดไปต่อเลย</p>
          <div class="res-actions">
            ${nextHref ? `<a class="btn btn-lg btn-block" href="${esc(nextHref)}" style="margin-top:0"><span>ไปกิจกรรมถัดไป</span>${ICON.next(14)}</a>` : ''}
            <a class="btn btn-lg btn-block${nextHref ? ' btn-line' : ''}" href="${esc(courseHref)}" style="margin-top:0">กลับไปเส้นทางเรียน</a>
            <button type="button" class="btn btn-lg btn-block btn-line" data-act="cn-again" style="margin-top:0">อ่านอีกครั้ง</button>
          </div>
        </section>`;
    }

    return {
        hasAbar: () => s.phase === 'read' && pages.length > 0,
        html: () => (s.phase === 'done' ? doneHtml() : readHtml()),
        afterRender(root) {
            const fx = s.fx;
            const dir = s.dir;
            s.fx = null;
            s.dir = 0;
            if (!root || typeof root.querySelector !== 'function') return;
            if (fx === 'finish') {
                confetti({ count: 90 });
                pop(root.querySelector('.cn-medal'), { scale: 1.3, ms: 600 });
            } else if (dir) {
                const el = root.querySelector('#cn-page');
                if (el && typeof el.animate === 'function') {
                    el.animate([{ opacity: 0, transform: `translateX(${dir > 0 ? 28 : -28}px)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
                }
            }
        },
        handleClick(e) {
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'cn-next') { go(1); return true; }
            if (act === 'cn-prev') { go(-1); return true; }
            if (act === 'cn-finish') { finish(); return true; }
            if (act === 'cn-again') { s.phase = 'read'; s.page = 0; s.dir = -1; render({ focus: true }); return true; }
            return false;
        },
        /** ปัดนิ้ว / กดลูกศร: +1 = หน้าถัดไป, −1 = หน้าก่อนหน้า (ใช้ได้ตอนอ่านเท่านั้น) */
        step(delta) { return s.phase === 'read' ? go(delta) : false; },
    };
}
