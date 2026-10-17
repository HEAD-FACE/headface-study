/**
 * js/study-live-quiz.js — Quiz หนึ่งชุด (วงกลม 1 วงบนเส้นทางเรียน) โหมดข้อมูลจริง
 *
 * ตรวจคำตอบที่ Backend ทั้งหมด: หน้านี้ไม่เคยได้เฉลยก่อนตอบ ตอบทีละข้อแล้ว Backend ส่งเฉลยของข้อนั้นกลับมา
 * และส่งผลสรุปทั้งชุดหลังกดส่ง ตัวนี้จึงแค่แสดงผลและเรียก API ตามลำดับ intro → ถามทีละข้อ → ผลคะแนน
 * โจทย์มีภาพ/วิดีโอประกอบได้ (media) และตัวเลือกมีภาพได้ (choice.image)
 *
 * ข้อความน้อยที่สุด และไม่กะพริบ: html() คืนมุมมองที่มี data-key (intro / ข้อที่ N / ผลคะแนน) หน้าถูกแก้เฉพาะจุด (study-dom.js)
 * เลือกตัวเลือก/กดตรวจ = เปลี่ยนแค่สีและกล่องเฉลย ไม่วาดโจทย์ใหม่ เปลี่ยนข้อ = การ์ดข้อใหม่เลื่อนเข้ามา แถบความคืบหน้าวิ่งต่อ
 */
import { StudyApiError } from './study-api.js';
import { $, esc, ICON, abar, ringHtml, animateRing } from './study-ui.js';
import { choiceLabel, scoreMessage } from './study-format.js';
import { questionMediaHtml, choiceImageHtml } from './study-media.js';
import { burst, confetti, countUp, pop, shake } from './study-fx.js';
import { animateReward, expPillHtml } from './study-reward.js';

const messageOf = (err) => (err instanceof StudyApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');

/**
 * @param {object} deps
 * @param {{ id: string }} deps.subject
 * @param {number} deps.lessonNo           เลขบทที่ Quiz ชุดนี้อยู่
 * @param {object} deps.node               node ชนิด quiz จาก API: { id, title, quiz: {available, questionCount, passPct}, progress: {attempts, best, last, passed} }
 * @param {object} deps.api                studyApi
 * @param {(opts?: {focus?: boolean}) => void} deps.render  วาดหน้าใหม่
 * @param {(done: object) => void} deps.applyProgress  ผลหลังส่งชุด (คำตอบของ submit: node / lesson / current)
 * @param {string|null} deps.nextHref     ลิงก์ไปกิจกรรมถัดไป (null = ไม่มี)
 * @param {string} deps.courseHref
 * @param {string} [deps.reviewHref]      ลิงก์กลับไปทบทวนเนื้อหาของบทนี้
 */
export function createQuiz({ subject, lessonNo, node, api, render, applyProgress, nextHref, courseHref, reviewHref }) {
    const fresh = () => ({ phase: 'intro', attempt: null, i: 0, picks: {}, feedback: {}, busy: false, error: null, result: null, lessonStatus: null, fx: null, streak: 0, dir: 0, reward: null });
    let s = fresh();

    const passPct = () => (node.quiz ? node.quiz.passPct : null);
    const passText = () => (passPct() === null || passPct() === undefined
        ? 'ทำครบแล้วส่ง 1 ครั้งถือว่าผ่าน'
        : `ผ่านเมื่อตอบถูกอย่างน้อย ${passPct()}% ในการทำ 1 ครั้ง`);

    const errorBox = () => (s.error ? `<p class="errbox" role="alert">${esc(s.error)}</p>` : '');

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
          </div>` : '<p class="note">Quiz ชุดนี้ยังไม่มีโจทย์</p>'}
          ${errorBox()}
          ${available ? `<button type="button" class="btn btn-lg btn-block" data-act="quiz-start"${s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังเตรียมโจทย์...' : attempts ? 'ทำ Quiz อีกครั้ง' : 'เริ่มทำ Quiz'}</span>${s.busy ? '' : ICON.next(14)}</button>` : ''}
        </section>`;
    }

    // ───── question ─────
    function choicesHtml(q, pick, fb) {
        return `<div class="choices" role="radiogroup" aria-label="ตัวเลือกคำตอบ">${q.choices.map((c, i) => {
            let cls = 'choice';
            let mark = '';
            if (fb) {
                if (c.id === fb.correctChoiceId) { cls += ' is-ok'; mark = ICON.check(24, 3); }
                else if (c.id === fb.yourChoiceId) { cls += ' is-bad'; mark = ICON.x(24, 3); }
                else cls += ' is-dim';
            } else if (c.id === pick) {
                cls += ' is-sel';
            }
            return `<button type="button" class="${cls}" role="radio" aria-checked="${c.id === pick}" data-choice="${esc(c.id)}"${fb || s.busy ? ' disabled' : ''}>
              <span class="choice-l">${choiceLabel(i)}</span><span class="choice-t">${choiceImageHtml(c)}<span>${esc(c.text)}</span></span><span class="choice-m">${mark}</span>
            </button>`;
        }).join('')}</div>`;
    }

    function feedbackHtml(fb) {
        const ok = fb.isCorrect;
        return `<div class="fb ${ok ? 'ok' : 'bad'}" role="status">
          <span class="fb-i" aria-hidden="true">${ok ? ICON.check(22, 3.4) : ICON.x(22, 3.4)}</span>
          <div class="fb-b">
            <h3><span>${ok ? 'ถูกต้อง!' : 'ยังไม่ถูกต้อง'}</span>${ok && s.streak >= 3 ? `<em class="streak">${ICON.flame(14)} ติดกัน ${s.streak} ข้อ</em>` : ''}</h3>
            ${fb.explanation ? `<p>${esc(fb.explanation)}</p>` : ''}
            ${!ok && reviewHref ? `<a class="linkbtn" href="${esc(reviewHref)}">ทบทวนเนื้อหา</a>` : ''}
          </div>
        </div>`;
    }

    function questionHtml() {
        const total = s.attempt.questions.length;
        const q = s.attempt.questions[s.i];
        const pick = s.picks[q.id];
        const fb = s.feedback[q.id];
        const last = s.i + 1 >= total;
        const checked = s.i + (fb ? 1 : 0);
        const action = fb
            ? `<button type="button" class="btn btn-lg ${fb.isCorrect ? 'btn-ok' : 'btn-bad'}" data-act="quiz-next"${s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังสรุปผล...' : last ? 'ดูผลคะแนน' : 'ข้อถัดไป'}</span>${s.busy ? '' : ICON.next(14)}</button>`
            : `<button type="button" class="btn btn-lg" data-act="quiz-check"${!pick || s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังตรวจ...' : 'ตรวจคำตอบ'}</span></button>`;
        return `<div class="qhead" data-key="qhead"><div class="qbar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.i + 1}"><i style="width:${(checked / total) * 100}%"></i></div><span class="qcount">${s.i + 1}/${total}</span></div>
        <div class="qview" data-key="q-${esc(q.id)}" data-dir="${s.dir}">
          <section class="qcard" aria-labelledby="q-t">
            <p class="qtopic">${esc(q.topic)}</p>
            <h2 class="qtext" id="q-t" style="white-space:pre-line">${esc(q.text)}</h2>
            ${questionMediaHtml(q.media)}
            ${choicesHtml(q, pick, fb)}
          </section>
          ${fb ? feedbackHtml(fb) : ''}
          ${errorBox()}
        </div>
        ${abar(action, fb ? (fb.isCorrect ? 'is-ok' : 'is-bad') : '')}`;
    }

    // ───── result ─────
    function resultHtml() {
        const r = s.result;
        const wrong = r.review.filter((x) => !x.isCorrect);
        const pills = [
            r.passed === true ? `<span class="pill ok">${ICON.check(14, 3.4)} ผ่านเกณฑ์</span>`
                : r.passed === false ? `<span class="pill warn">ยังไม่ถึงเกณฑ์ ${passPct() === null || passPct() === undefined ? '' : `${passPct()}%`}</span>` : '',
            s.lessonStatus === 'done' ? '<span class="pill gold">บทนี้เสร็จสมบูรณ์ 🎉</span>' : '',
            expPillHtml(s.reward),
        ].filter(Boolean).join('');
        const review = wrong.map((x) => {
            const ci = x.choices.findIndex((c) => c.id === x.correctChoiceId);
            const correct = ci >= 0 ? `${choiceLabel(ci)} ${esc(x.choices[ci].text)}` : '';
            return `<div class="review-i bad"><h3>${x.yourChoiceId ? ICON.x(16) : ICON.info(16)}<span>ข้อ ${x.n} ${esc(x.text)}${x.yourChoiceId ? '' : ' — ยังไม่ได้ตอบ'}</span></h3>${questionMediaHtml(x.media)}<p>เฉลย: ${correct}</p>${x.explanation ? `<p>${esc(x.explanation)}</p>` : ''}</div>`;
        }).join('');
        return `<section class="rblock result" data-key="result">
          ${ringHtml(r.percent, `${r.correct}/${r.total} ข้อ`)}
          <h2>${esc(scoreMessage(r.percent))}</h2>
          ${pills ? `<div class="pills">${pills}</div>` : ''}
          ${wrong.length ? `<details class="fold"><summary><span>ข้อที่ควรทบทวน (${wrong.length})</span><i>${ICON.down(18)}</i></summary><div class="review">${review}</div></details>` : ''}
          <div class="res-actions">
            ${nextHref ? `<a class="btn btn-lg btn-block" href="${esc(nextHref)}" style="margin-top:0"><span>ไปกิจกรรมถัดไป</span>${ICON.next(14)}</a>` : `<a class="btn btn-lg btn-block" href="${esc(courseHref)}" style="margin-top:0"><span>กลับไปเส้นทางเรียน</span>${ICON.next(14)}</a>`}
            <button type="button" class="btn btn-lg btn-block btn-line" data-act="quiz-start" style="margin-top:0">ทำ Quiz อีกครั้ง</button>
            <div class="res-links">${reviewHref ? `<a class="linkbtn" href="${esc(reviewHref)}">ทบทวนเนื้อหา</a>` : ''}${nextHref ? `<a class="linkbtn" href="${esc(courseHref)}">เส้นทางเรียน</a>` : ''}</div>
          </div>
        </section>`;
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
        s = { ...fresh(), phase: 'q', attempt, dir: 1 };
        window.scrollTo(0, 0);
    }, true);

    const check = () => {
        const q = s.attempt.questions[s.i];
        if (!s.picks[q.id] || s.feedback[q.id]) return; // ยังไม่ได้เลือก หรือข้อนี้ตรวจไปแล้ว
        return run(async () => {
            const { feedback } = await api.answerQuiz(s.attempt.id, q.id, s.picks[q.id]);
            s.feedback[q.id] = feedback;
            s.streak = feedback.isCorrect ? s.streak + 1 : 0;
            s.fx = feedback.isCorrect ? 'ok' : 'bad';
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
            s.fx = done.result.passed === true || (done.result.passed === null && done.result.percent >= 50) ? 'pass' : 'done';
            applyProgress(done);
            window.scrollTo(0, 0);
        }, true);
    };

    return {
        hasAbar: () => s.phase === 'q',
        html() {
            return s.phase === 'intro' ? introHtml() : s.phase === 'result' ? resultHtml() : questionHtml();
        },
        afterRender(root) {
            if (!root || typeof root.querySelector !== 'function') return;
            const fx = s.fx;
            s.fx = null;
            s.dir = 0;
            if (s.phase === 'result') {
                animateRing(root);
                const pctEl = $('.ring-t b', root);
                if (pctEl) countUp(pctEl, s.result.percent, { ms: 900, format: (n) => `${n}%` });
                animateReward(root);
                if (fx === 'pass') confetti();
            } else if (fx === 'ok') {
                const el = $('.choice.is-ok', root);
                pop(el, { scale: 1.05, ms: 380 });
                burst(el);
                pop($('.fb-i', root), { scale: 1.3, ms: 460 });
            } else if (fx === 'bad') {
                shake($('.choice.is-bad', root));
            } else if (fx === 'pick') {
                pop($('.choice.is-sel', root), { scale: 1.03, ms: 220 });
            }
        },
        /** ส่งต่อเหตุการณ์คลิกจากหน้ากิจกรรม; คืน true เมื่อจัดการแล้ว */
        handleClick(e) {
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
            return false;
        },
    };
}
