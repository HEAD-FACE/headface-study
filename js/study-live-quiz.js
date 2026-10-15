/**
 * js/study-live-quiz.js — แท็บ Quiz ของหน้าบทเรียน (โหมดข้อมูลจริง)
 *
 * ตรวจคำตอบที่ Backend ทั้งหมด: หน้านี้ไม่เคยได้เฉลยก่อนตอบ ตอบทีละข้อแล้ว Backend ส่งเฉลยของข้อนั้นกลับมา
 * และส่งผลสรุปทั้งชุดหลังกดส่ง ตัวนี้จึงแค่แสดงผลและเรียก API ตามลำดับ intro → ถามทีละข้อ → ผลคะแนน
 */
import { StudyApiError } from './study-api.js';
import { esc, ICON, abar, ringHtml, animateRing } from './study-ui.js';
import { choiceLabel, scoreMessage } from './study-format.js';

const messageOf = (err) => (err instanceof StudyApiError ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');

/**
 * @param {object} deps
 * @param {{ id: string }} deps.subject
 * @param {object} deps.lesson            ข้อมูลบทเรียนจาก API (ถูกอัปเดตผ่าน applyProgress)
 * @param {object} deps.api               studyApi
 * @param {(opts?: {focus?: boolean}) => void} deps.render  วาดหน้าใหม่
 * @param {(patch: {status: string, quiz: object}) => void} deps.applyProgress  ผลหลังส่งชุด (สถานะบท + สรุป Quiz)
 * @param {string|null} deps.nextHref     ลิงก์ไปบทถัดไป (null = ไม่มี)
 * @param {string} deps.courseHref
 */
export function createQuiz({ subject, lesson, api, render, applyProgress, nextHref, courseHref }) {
    const fresh = () => ({ phase: 'intro', attempt: null, i: 0, picks: {}, feedback: {}, busy: false, error: null, result: null });
    let s = fresh();

    const passText = () => (lesson.quiz.passPct === null || lesson.quiz.passPct === undefined
        ? 'ทำครบแล้วส่ง 1 ครั้งถือว่าผ่าน'
        : `ผ่านเมื่อตอบถูกอย่างน้อย ${lesson.quiz.passPct}% ในการทำ 1 ครั้ง`);

    const errorBox = () => (s.error ? `<p class="errbox" role="alert">${esc(s.error)}</p>` : '');

    // ───── intro ─────
    function introHtml() {
        const last = lesson.progress.quiz.last;
        const best = lesson.progress.quiz.best;
        const available = lesson.quiz.available;
        return `<section class="rblock intro fade-in">
          <span class="tile tile-teal" aria-hidden="true">🧠</span>
          <h2>Quiz ท้ายบท</h2>
          <p>ตรวจความเข้าใจของบทนี้ ตอบแล้วกด "ตรวจคำตอบ" เพื่อดูเฉลยพร้อมคำอธิบายทีละข้อ</p>
          <div class="facts">
            ${available ? `<span class="chip chip-g">${lesson.quiz.questionCount} ข้อ</span><span class="chip chip-g">มีเฉลยและคำอธิบาย</span>` : ''}
            ${best ? `<span class="chip chip-amber">ดีที่สุด ${best.correct}/${best.total}</span>` : ''}
            ${last ? `<span class="chip chip-amber">ล่าสุด ${last.correct}/${last.total}</span>` : ''}
          </div>
          ${available ? `<p class="note">${esc(passText())} — บทจะเสร็จสมบูรณ์เมื่อ <b>อ่านเนื้อหาจบ</b> และผ่าน Quiz</p>` : '<p class="note">บทนี้ยังไม่มีโจทย์ Quiz</p>'}
          ${errorBox()}
          ${available ? `<button type="button" class="btn btn-lg btn-block" data-act="quiz-start"${s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังเตรียมโจทย์...' : lesson.progress.quiz.attempts ? 'ทำ Quiz อีกครั้ง' : 'เริ่มทำ Quiz'}</span>${s.busy ? '' : ICON.next(14)}</button>` : ''}
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
            } else if (c.id === pick) {
                cls += ' is-sel';
            }
            return `<button type="button" class="${cls}" role="radio" aria-checked="${c.id === pick}" data-choice="${esc(c.id)}"${fb || s.busy ? ' disabled' : ''}>
              <span class="choice-l">${choiceLabel(i)}</span><span class="choice-t">${esc(c.text)}</span><span class="choice-m">${mark}</span>
            </button>`;
        }).join('')}</div>`;
    }

    function questionHtml() {
        const total = s.attempt.questions.length;
        const q = s.attempt.questions[s.i];
        const pick = s.picks[q.id];
        const fb = s.feedback[q.id];
        const last = s.i + 1 >= total;
        const checked = s.i + (fb ? 1 : 0);
        const action = fb
            ? `<button type="button" class="btn btn-lg" data-act="quiz-next"${s.busy ? ' disabled' : ''}><span>${s.busy ? 'กำลังสรุปผล...' : last ? 'ดูผลคะแนน' : 'ข้อถัดไป'}</span>${s.busy ? '' : ICON.next(14)}</button>`
            : `<button type="button" class="btn btn-lg" data-act="quiz-check"${!pick || s.busy ? ' disabled' : ''}>${s.busy ? 'กำลังตรวจ...' : 'ตรวจคำตอบ'}</button>`;
        return `<div class="fade-in">
          <div class="qhead"><div class="qbar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${s.i + 1}"><i style="width:${(checked / total) * 100}%"></i></div><span class="qcount">ข้อ ${s.i + 1}/${total}</span></div>
          <section class="qcard" aria-labelledby="q-t">
            <p class="qtopic">${esc(q.topic)}</p>
            <h2 class="qtext" id="q-t">${esc(q.text)}</h2>
            ${choicesHtml(q, pick, fb)}
            ${fb ? `<div class="fb ${fb.isCorrect ? 'ok' : 'bad'}" role="status"><h3>${fb.isCorrect ? ICON.check(20) : ICON.x(20)}<span>${fb.isCorrect ? 'ถูกต้อง' : 'ยังไม่ถูกต้อง'}</span></h3>${fb.explanation ? `<p>${esc(fb.explanation)}</p>` : ''}<button type="button" class="linkbtn" data-tab="content">กลับไปทบทวนเนื้อหาที่เกี่ยวข้อง</button></div>` : ''}
            ${errorBox()}
          </section>
        </div>
        ${abar(action)}`;
    }

    // ───── result ─────
    function resultHtml() {
        const r = s.result;
        const wrong = r.review.filter((x) => !x.isCorrect);
        const passLine = r.passed === true ? `<p class="note ok">${ICON.check(16)} ผ่านเกณฑ์ของบทนี้ (${esc(passText())})</p>`
            : r.passed === false ? `<p class="note warn">ยังไม่ถึงเกณฑ์ของบทนี้ — ${esc(passText())} ลองทำอีกครั้งได้</p>`
            : '<p class="note ok">ทำ Quiz ครบแล้ว บทนี้ไม่ได้กำหนดคะแนนขั้นต่ำ</p>';
        const done = lesson.progress.status === 'done';
        const lessonLine = done
            ? `<p class="note ok">${ICON.check(16)} บทนี้เสร็จสมบูรณ์แล้ว (อ่านจบและผ่าน Quiz)</p>`
            : (r.passed !== false && !lesson.progress.contentReadAt
                ? '<p class="note">ยังเหลืออีกขั้น: อ่านเนื้อหาให้จบแล้วกด "ทำเครื่องหมายว่าอ่านจบแล้ว" บทนี้จึงจะเสร็จสมบูรณ์ <button type="button" class="linkbtn" data-tab="content">ไปที่เนื้อหา</button></p>'
                : '');
        const review = wrong.map((x) => {
            const ci = x.choices.findIndex((c) => c.id === x.correctChoiceId);
            const correct = ci >= 0 ? `${choiceLabel(ci)} ${esc(x.choices[ci].text)}` : '';
            return `<div class="review-i bad"><h3>${x.yourChoiceId ? ICON.x(16) : ICON.info(16)}<span>ข้อ ${x.n} ${esc(x.text)}${x.yourChoiceId ? '' : ' — ยังไม่ได้ตอบ'}</span></h3><p>เฉลย: ${correct}</p>${x.explanation ? `<p>${esc(x.explanation)}</p>` : ''}</div>`;
        }).join('');
        return `<section class="rblock result fade-in">
          ${ringHtml(r.percent, `${r.correct}/${r.total} ข้อ`)}
          <h2>${esc(scoreMessage(r.percent))}</h2>
          <p>ตอบถูก ${r.correct} จาก ${r.total} ข้อ</p>
          <div class="rows"><div class="row"><span class="k">ตอบถูก</span><span class="v">${r.correct}</span></div><div class="row"><span class="k">ตอบผิดหรือไม่ได้ตอบ</span><span class="v">${r.total - r.correct}</span></div></div>
          ${passLine}${lessonLine}
          ${wrong.length ? `<div class="review"><h3 class="fsec-h" style="font-size:16px">ข้อที่ควรทบทวน</h3>${review}</div>` : ''}
          <div class="res-actions">
            <button type="button" class="btn btn-lg btn-block" data-act="quiz-start" style="margin-top:0">ทำ Quiz อีกครั้ง</button>
            <button type="button" class="btn btn-lg btn-block btn-line" data-tab="content" style="margin-top:0">กลับไปทบทวนเนื้อหา</button>
            ${nextHref ? `<a class="btn btn-lg btn-block btn-line" href="${esc(nextHref)}" style="margin-top:0">ไปบทถัดไป</a>` : `<a class="btn btn-lg btn-block btn-line" href="${esc(courseHref)}" style="margin-top:0">กลับหน้ารายละเอียดวิชา</a>`}
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
        const { attempt } = await api.startQuiz(subject.id, lesson.no);
        s = { ...fresh(), phase: 'q', attempt };
        window.scrollTo(0, 0);
    }, true);

    const check = () => {
        const q = s.attempt.questions[s.i];
        if (!s.picks[q.id] || s.feedback[q.id]) return; // ยังไม่ได้เลือก หรือข้อนี้ตรวจไปแล้ว
        return run(async () => {
            const { feedback } = await api.answerQuiz(s.attempt.id, q.id, s.picks[q.id]);
            s.feedback[q.id] = feedback;
        });
    };

    const next = () => {
        if (s.i + 1 < s.attempt.questions.length) {
            s.i++;
            window.scrollTo(0, 0);
            return render({ focus: true });
        }
        return run(async () => {
            const done = await api.submitQuiz(s.attempt.id);
            s.result = done.result;
            s.phase = 'result';
            applyProgress(done.lesson);
            window.scrollTo(0, 0);
        }, true);
    };

    return {
        hasAbar: () => s.phase === 'q',
        html() {
            return s.phase === 'intro' ? introHtml() : s.phase === 'result' ? resultHtml() : questionHtml();
        },
        afterRender(root) {
            if (s.phase === 'result') animateRing(root);
        },
        /** ส่งต่อเหตุการณ์คลิกจากหน้าบทเรียน; คืน true เมื่อจัดการแล้ว */
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
                render();
                document.querySelector(`[data-choice="${CSS.escape(s.picks[q.id])}"]`)?.focus({ preventScroll: true });
                return true;
            }
            return false;
        },
    };
}
