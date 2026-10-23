/**
 * js/study-live-quiz.js — Quiz หนึ่งชุด (วงกลม 1 วงบนเส้นทางเรียน) โหมดข้อมูลจริง
 *
 * ตรวจคำตอบที่ Backend ทั้งหมด: หน้านี้ไม่เคยได้เฉลยก่อนตอบ ตอบทีละข้อแล้ว Backend ส่งเฉลยของข้อนั้นกลับมา
 * และส่งผลสรุปทั้งชุดหลังกดส่ง ตัวนี้จึงแค่แสดงผลและเรียก API ตามลำดับ intro → ถามทีละข้อ → ผลสรุปทีละหน้า
 * โจทย์มีภาพ/วิดีโอประกอบได้ (media) และตัวเลือกมีภาพได้ (choice.image)
 *
 * ให้อยากทำต่อ: ตอบถูก = เด้ง + ดาวกระจาย + "+N EXP" ลอยขึ้น ตัวนับ EXP ขยับ (และบอกเมื่อถึงเกณฑ์ผ่าน);
 * ตอบผิด = สั่นเบา ๆ และ "เฉลย + เหตุผล" ขึ้นทันทีใต้ข้อ (ในแถบล่าง เห็นโดยไม่ต้องเลื่อน); ก่อนเริ่มบอก EXP ขั้นต่ำ/สูงสุด
 * จบชุด: หน้าสรุปทีละหน้า (คะแนน → ทบทวนข้อที่ผิดทีละข้อ → EXP ที่ได้ → เลื่อนเลเวล) ดู study-result.js
 * หน้าแก้เฉพาะจุดที่เปลี่ยน (study-dom.js): data-key = มุมมอง (intro / ข้อที่ N / ผลสรุป)
 */
import { StudyApiError } from './study-api.js';
import { $, esc, ICON, abar } from './study-ui.js';
import { choiceLabel } from './study-format.js';
import { questionMediaHtml } from './study-media.js';
import { answerHtml, applyAction, emptyPick, formatOf, isPartial, isReady, keyLine, partialLine, stemHtml, toAnswer } from './study-qformats.js';
import { burst, confetti, floatText, pop, shake } from './study-fx.js';
import { expRangeChipsHtml } from './study-reward.js';
import { countAll, createResultFlow, reviewStepHtml, rewardSteps, scoreStepHtml } from './study-result.js';

const messageOf = (err) => (err instanceof StudyApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
const CHEERS = ['ถูกต้อง!', 'เยี่ยมมาก!', 'เก่งมาก!', 'ใช่เลย!', 'สุดยอด!'];
/** หลังตรวจ เฉลยบนตัวข้อ (เช่น ลำดับที่ถูก) อาจยาวจนแถบล่างบัง: เลื่อนหน้าให้ท้ายการ์ดอยู่เหนือแถบ */
function revealAnswer(root) {
    if (typeof window === 'undefined' || typeof window.scrollBy !== 'function' || !root || typeof root.querySelector !== 'function') return;
    setTimeout(() => {
        const card = root.querySelector('.qcard');
        const bar = root.querySelector('.abar');
        if (!card || !bar || typeof card.getBoundingClientRect !== 'function') return;
        const over = card.getBoundingClientRect().bottom - (bar.getBoundingClientRect().top - 12);
        if (over > 0) window.scrollBy({ top: over, behavior: 'smooth' });
    }, 260);
}

const BOLT = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11"/></svg>';

/**
 * @param {object} deps
 * @param {{ id: string }} deps.subject
 * @param {number} deps.lessonNo           เลขบทที่ Quiz ชุดนี้อยู่
 * @param {object} deps.node               node ชนิด quiz จาก API: { id, title, quiz: {available, questionCount, passPct}, progress: {attempts, best, last, passed}, reward }
 * @param {object} deps.api                studyApi
 * @param {(opts?: {focus?: boolean}) => void} deps.render  วาดหน้าใหม่
 * @param {(done: object) => void} deps.applyProgress  ผลหลังส่งชุด (คำตอบของ submit: node / lesson / current)
 * @param {string|null} deps.nextHref     ลิงก์ไปกิจกรรมถัดไป (null = ไม่มี)
 * @param {string} deps.courseHref
 * @param {string} [deps.reviewHref]      ลิงก์กลับไปทบทวนเนื้อหาของบทนี้
 */
export function createQuiz({ subject, lessonNo, node, api, render, applyProgress, nextHref, courseHref, reviewHref }) {
    const fresh = () => ({
        phase: 'intro', attempt: null, i: 0, picks: {}, ui: {}, focusedQ: null, feedback: {}, busy: false, error: null, result: null, lessonStatus: null,
        fx: null, streak: 0, dir: 0, reward: null, flow: null, xp: 0, right: 0, repeat: false, passShown: false, passNow: {},
    });
    let s = fresh();

    const passPct = () => (node.quiz ? node.quiz.passPct : null);
    const errorBox = () => (s.error ? `<p class="errbox" role="alert">${esc(s.error)}</p>` : '');
    /** EXP ที่แสดงระหว่างทำ: ทำซ้ำได้ครึ่งเดียว (ตอนจบมีหน้าที่บอกยอดจริงเสมอ) */
    const shownExp = (n) => (s.repeat ? Math.floor(n / 2) : n);

    // ───── intro ─────
    function introHtml() {
        const { best, attempts, passed } = node.progress;
        const available = node.quiz.available;
        const pass = passPct();
        return `<section class="rblock intro" data-key="intro">
          <span class="intro-tile" aria-hidden="true">🧠</span>
          <h2>${esc(node.title || 'Quiz')}</h2>
          ${available ? `<div class="facts">
            <span class="chip chip-g">${node.quiz.questionCount} ข้อ</span>
            <span class="chip chip-g">${pass === null || pass === undefined ? 'ทำครบ = ผ่าน' : `ผ่าน ≥ ${pass}%`}</span>
            ${passed ? '<span class="chip chip-amber">ผ่านแล้ว ✓</span>' : ''}
            ${best ? `<span class="chip chip-amber">ดีที่สุด ${best.correct}/${best.total}</span>` : ''}
          </div>
          ${node.reward ? `<div class="facts">${expRangeChipsHtml(node.reward)}</div>` : ''}` : '<p class="note">Quiz ชุดนี้ยังไม่มีโจทย์</p>'}
          ${errorBox()}
          ${available ? `<button type="button" class="btn btn-lg btn-block" data-act="quiz-start"${s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังเตรียมโจทย์...' : attempts ? 'ทำ Quiz อีกครั้ง' : 'เริ่มทำ Quiz'}</span>${s.busy ? '' : ICON.next(14)}</button>` : ''}
        </section>`;
    }

    // ───── question ─────
    /** เฉลยทันที: อยู่ในแถบล่างเหนือปุ่ม (ผิด = เฉลย + เหตุผล, ถูก = ชม + EXP ที่ได้ + ถึงเกณฑ์ผ่านแล้ว) */
    function feedbackPanel(q, fb) {
        const ok = fb.isCorrect;
        const part = isPartial(fb);
        const ci = formatOf(q) === 'choice' ? q.choices.findIndex((c) => c.id === fb.correctChoiceId) : -1;
        const gain = shownExp(Number(fb.exp) || 0);
        const icon = ok ? ICON.check(22, 3.4) : part ? ICON.info(22) : ICON.x(22, 3.4);
        return `<div class="abar-fb fb ${ok ? 'ok' : part ? 'part' : 'bad'}" data-key="fb" role="status">
          <span class="fb-i" aria-hidden="true">${icon}</span>
          <div class="fb-b">
            <h3><span>${ok ? CHEERS[s.i % CHEERS.length] : part ? 'ได้บางส่วน' : 'ยังไม่ถูกต้อง'}</span>${gain > 0 ? `<em class="xp-gain">${BOLT} +${gain} EXP</em>` : ''}${ok && s.streak >= 3 ? `<em class="streak">${ICON.flame(14)} ติดกัน ${s.streak} ข้อ</em>` : ''}${ok && s.passNow[q.id] ? '<em class="passed-now">ผ่านเกณฑ์แล้ว!</em>' : ''}</h3>
            ${!ok && ci >= 0 ? `<p class="fb-ans">เฉลย <b>${choiceLabel(ci)} ${esc(q.choices[ci].text)}</b></p>` : ''}
            ${partialLine(q, s.picks[q.id], fb)}${keyLine(q, fb)}
            ${fb.explanation ? `<p>${esc(fb.explanation)}</p>` : ''}
            ${!ok && reviewHref ? `<a class="linkbtn" href="${esc(reviewHref)}">ทบทวนเนื้อหา</a>` : ''}
          </div>
        </div>`;
    }

    function questionHtml() {
        const total = s.attempt.questions.length;
        const q = s.attempt.questions[s.i];
        const pick = s.picks[q.id];
        const ui = s.ui[q.id] || {};
        const fb = s.feedback[q.id];
        const part = isPartial(fb);
        const last = s.i + 1 >= total;
        const checked = s.i + (fb ? 1 : 0);
        const action = fb
            ? `<button type="button" class="btn btn-lg ${fb.isCorrect ? 'btn-ok' : part ? 'btn-part' : 'btn-bad'}" data-act="quiz-next"${s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังสรุปผล...' : last ? 'ดูผลคะแนน' : 'ข้อถัดไป'}</span>${s.busy ? '' : ICON.next(14)}</button>`
            : `<button type="button" class="btn btn-lg" data-act="quiz-check"${!isReady(q, pick) || s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังตรวจ...' : 'ตรวจคำตอบ'}</span></button>`;
        const xp = shownExp(s.xp);
        return `<div class="qhead" data-key="qhead"><div class="qbar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.i + 1}"><i style="width:${(checked / total) * 100}%"></i></div><span class="qcount">${s.i + 1}/${total}</span>${xp > 0 ? `<span class="xp-pill" aria-label="EXP ที่สะสมแล้ว ${xp}">${BOLT}<b>${xp}</b></span>` : ''}</div>
        <div class="qview" data-key="q-${esc(q.id)}" data-dir="${s.dir}">
          <section class="qcard" aria-labelledby="q-t">
            <p class="qtopic">${esc(q.topic)}</p>
            <h2 class="qtext" id="q-t" style="white-space:pre-line">${stemHtml(q, pick, ui, { fb, locked: s.busy })}</h2>
            ${questionMediaHtml(q.media)}
            ${answerHtml(q, pick, ui, { fb, locked: s.busy })}
          </section>
          ${errorBox()}
        </div>
        ${abar(action, fb ? (fb.isCorrect ? 'is-ok' : part ? 'is-part' : 'is-bad') : '', fb ? feedbackPanel(q, fb) : '')}`;
    }

    // ───── result: ทีละหน้า ─────
    function buildFlow() {
        const r = s.result;
        const wrong = r.review.filter((x) => !x.isCorrect);
        const celebrate = r.passed === true || (r.passed === null && r.percent >= 50);
        const steps = [{
            key: 'score',
            html: () => scoreStepHtml({ correct: r.correct, total: r.total, marks: r.review.map((x) => x.isCorrect), passed: r.passed, lessonDone: s.lessonStatus === 'done' }),
            label: 'ต่อไป',
            fx(root) { countAll(root); if (celebrate) confetti(); },
        }];
        if (wrong.length) {
            steps.push({
                key: 'review', count: wrong.length, skippable: true,
                html: (sub) => reviewStepHtml({ item: wrong[sub], index: sub, count: wrong.length }),
                label: (sub) => (sub + 1 < wrong.length ? 'ข้อถัดไป' : 'เข้าใจแล้ว'),
            });
        }
        steps.push(...rewardSteps(s.reward, { title: 'EXP ที่ได้รับ' }));
        const links = `<button type="button" class="linkbtn" data-act="quiz-start">ทำอีกครั้ง</button>${nextHref ? `<a class="linkbtn" href="${esc(courseHref)}">เส้นทางเรียน</a>` : reviewHref ? `<a class="linkbtn" href="${esc(reviewHref)}">ทบทวนเนื้อหา</a>` : ''}`;
        return createResultFlow({ steps, render, finalCta: nextHref ? { href: nextHref, label: 'ไปกิจกรรมถัดไป' } : { href: courseHref, label: 'กลับไปเส้นทางเรียน' }, linksHtml: links });
    }

    // ───── actions ─────
    async function run(work, focus = false) {
        if (s.busy) return;
        s.busy = true;
        s.error = null;
        render();
        try {
            await work();
        } catch (err) {
            s.error = messageOf(err);
            if (err instanceof StudyApiError && err.code === 'ATTEMPT_CLOSED') s = { ...fresh(), error: `${s.error} กรุณาเริ่ม Quiz ใหม่` };
        } finally {
            s.busy = false;
            render({ focus: focus && !s.error });
        }
    }

    const start = () => run(async () => {
        const { attempt } = await api.startQuiz(subject.id, lessonNo, node.id);
        s = { ...fresh(), phase: 'q', attempt, dir: 1, repeat: !!(attempt.reward && attempt.reward.repeat) };
        window.scrollTo(0, 0);
    }, true);

    const check = () => {
        const q = s.attempt.questions[s.i];
        if (!isReady(q, s.picks[q.id]) || s.feedback[q.id]) return; // ยังตอบไม่ครบ หรือข้อนี้ตรวจไปแล้ว
        return run(async () => {
            const { feedback } = await api.answerQuiz(s.attempt.id, q.id, toAnswer(q, s.picks[q.id]));
            s.feedback[q.id] = feedback;
            s.streak = feedback.isCorrect ? s.streak + 1 : 0;
            s.xp += Number(feedback.exp) || 0; // ตอบถูกบางส่วนก็ได้ EXP ส่วนนั้น
            if (feedback.isCorrect) {
                s.right++;
                const pass = passPct();
                if (!s.passShown && pass !== null && pass !== undefined && s.right * 100 >= pass * s.attempt.questions.length) { s.passShown = true; s.passNow[q.id] = true; }
            }
            s.fx = feedback.isCorrect ? 'ok' : isPartial(feedback) ? 'part' : 'bad';
        });
    };

    const next = () => {
        if (s.i + 1 < s.attempt.questions.length) {
            s.i++;
            s.dir = 1;
            window.scrollTo(0, 0);
            return render({ focus: true });
        }
        return run(async () => {
            const done = await api.submitQuiz(s.attempt.id);
            s.result = done.result;
            s.lessonStatus = done.lesson ? done.lesson.status : null;
            s.reward = done.reward || null;
            s.phase = 'result';
            applyProgress(done);
            s.flow = buildFlow();
            window.scrollTo(0, 0);
        }, true);
    };

    return {
        hasAbar: () => s.phase === 'q' || s.phase === 'result',
        html() {
            return s.phase === 'intro' ? introHtml() : s.phase === 'result' ? s.flow.html() : questionHtml();
        },
        afterRender(root) {
            if (!root || typeof root.querySelector !== 'function') return;
            const fx = s.fx;
            s.fx = null;
            s.dir = 0;
            if (s.phase === 'result') {
                s.flow.afterRender(root);
            } else if (fx === 'ok') {
                const el = $('.qcard .is-ok', root);
                pop(el, { scale: 1.05, ms: 380 });
                burst(el);
                pop($('.fb-i', root), { scale: 1.3, ms: 460 });
                const gain = $('.xp-gain', root);
                if (gain) floatText(gain, gain.textContent.trim(), { color: '#B45309' });
                const pill = $('.xp-pill', root);
                if (pill && typeof pill.classList !== 'undefined') { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
                if ($('.passed-now', root)) confetti({ count: 60 });
                // ตอบถูกติดกัน: ยิ่งยาวยิ่งฉลองแรง (ครั้งที่ 3, 5, 8 และทุก 5 หลังจากนั้น)
                if (s.streak >= 3) {
                    const tag = $('.streak', root);
                    if (tag) { pop(tag, { scale: 1.35, ms: 520 }); floatText(tag, `🔥 ×${s.streak}`, { color: s.streak >= 8 ? '#DC2626' : '#EA580C' }); }
                    if (s.streak === 5 || s.streak === 8 || (s.streak > 8 && s.streak % 5 === 0)) confetti({ count: 50 + Math.min(60, s.streak * 5) });
                }
            } else if (fx === 'bad') {
                shake($('.qcard .is-bad', root) || $('.qcard', root));
            } else if (fx === 'part') {
                pop($('.fb-i', root), { scale: 1.25, ms: 420 });
                const gain = $('.xp-gain', root);
                if (gain) floatText(gain, gain.textContent.trim(), { color: '#B45309' });
                const pill = $('.xp-pill', root);
                if (pill && typeof pill.classList !== 'undefined') { pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
            } else if (fx === 'pick') {
                pop($('.qcard .is-sel', root), { scale: 1.03, ms: 220 });
            }
            if (fx === 'ok' || fx === 'bad' || fx === 'part') revealAnswer(root);
            this.focusNumeric(root);
        },
        /** ส่งต่อเหตุการณ์คลิกจากหน้ากิจกรรม; คืน true เมื่อจัดการแล้ว */
        handleClick(e) {
            if (s.phase === 'result' && s.flow && s.flow.handleClick(e)) return true;
            const act = e.target.closest('[data-act]')?.dataset.act;
            if (act === 'quiz-start') { start(); return true; }
            if (act === 'quiz-check') { check(); return true; }
            if (act === 'quiz-next') { next(); return true; }
            const choice = e.target.closest('[data-choice]');
            if (choice && s.phase === 'q' && !s.busy) {
                const q = s.attempt.questions[s.i];
                if (s.feedback[q.id]) return true;
                s.picks[q.id] = choice.dataset.choice;
                s.fx = 'pick';
                render();
                return true;
            }
            // รูปแบบอื่น (จับคู่ เรียงลำดับ จัดกลุ่ม เติมคำ เลือกหลายข้อ): แตะแล้วเปลี่ยนคำตอบ/สถานะของข้อ
            const tap = e.target.closest('[data-fx]');
            if (tap && s.phase === 'q' && !s.busy) {
                const q = s.attempt.questions[s.i];
                if (s.feedback[q.id] || tap.dataset.fx === 'n-input') return true;
                const next = applyAction(q, s.picks[q.id] === undefined ? emptyPick(q) : s.picks[q.id], s.ui[q.id], { fx: tap.dataset.fx, id: tap.dataset.id, i: tap.dataset.i });
                s.picks[q.id] = next.pick;
                s.ui[q.id] = next.ui;
                s.fx = 'pick';
                render();
                return true;
            }
            return false;
        },
        /** พิมพ์ในช่องตัวเลข (โจทย์กรอกตัวเลข) */
        handleInput(e) {
            const input = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-fx="n-input"]') : null;
            if (!input || s.phase !== 'q' || s.busy) return false;
            const q = s.attempt.questions[s.i];
            if (s.feedback[q.id]) return true;
            s.picks[q.id] = input.value;
            render();
            return true;
        },
        /** Enter ในช่องตัวเลข = ตรวจคำตอบ */
        handleKey(e) {
            if (e.key !== 'Enter' || s.phase !== 'q' || s.busy) return false;
            const input = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-fx="n-input"]') : null;
            if (!input) return false;
            if (e.preventDefault) e.preventDefault();
            check();
            return true;
        },
        /** ปัดการ์ดข้อจริง/เท็จ: ปัดขวา = จริง ปัดซ้าย = เท็จ (ใช้ได้เฉพาะข้อที่ยังไม่ได้ตรวจ) */
        swipe(direction) {
            if (s.phase !== 'q' || s.busy) return false;
            const q = s.attempt.questions[s.i];
            if (formatOf(q) !== 'truefalse' || s.feedback[q.id]) return false;
            s.picks[q.id] = direction === 'right' ? 't' : 'f';
            s.fx = 'pick';
            render();
            return true;
        },
        /** ข้อกรอกตัวเลข: โฟกัสช่องพิมพ์ครั้งแรกที่เปิดข้อ เพื่อให้คีย์บอร์ดขึ้นทันที */
        focusNumeric(root) {
            if (s.phase !== 'q' || !s.attempt) return;
            const q = s.attempt.questions[s.i];
            if (formatOf(q) !== 'numeric' || s.feedback[q.id] || s.focusedQ === q.id) return;
            s.focusedQ = q.id;
            const input = $('.nm-in', root);
            if (input && typeof input.focus === 'function') input.focus({ preventScroll: true });
        },
    };
}
