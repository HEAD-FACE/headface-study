/**
 * js/study-ranking.js — ตารางอันดับดาว (Leaderboard) และแอนิเมชันเลื่อนอันดับ (สัญญา: docs/study-api-contract.md ข้อ 2.13)
 *
 *   • หน้า Progress: Top 10 (โพเดียม 3 อันดับแรก + รายการ 4–10), การ์ดอันดับของฉัน (ขาดอีกกี่ดาวถึงจะขยับ) และสวิตช์ "ซ่อนชื่อฉัน"
 *   • หน้าสรุปผล Mock: ถ้าดาวที่ได้ทำให้อันดับขยับ (หรือเพิ่งติดอันดับครั้งแรก) มีหน้า "เลื่อนอันดับ" ที่คนที่แซงไปเลื่อนลง
 *     ตัวเราเลื่อนขึ้น ตัวเลขอันดับนับลง และมีเอฟเฟกต์ฉลอง
 *
 * อันดับคิดที่ Backend จากผลรวมดาวของทุกครั้งที่ทำ Mock (ดาวเท่ากัน = อันดับเดียวกัน) หน้านี้แค่แสดง ไม่คำนวณอันดับเอง
 * ชื่อของผู้อื่นมาเป็น "ชื่อ + อักษรตัวแรกของนามสกุล" และภาพที่เปิดเผยได้เท่านั้น (ไม่มีภาพถ่ายที่อัปโหลด) ทุกข้อความผ่าน esc
 */
import { esc } from './study-ui.js';
import { burst, confetti, pop, reducedMotion } from './study-fx.js';
import { patchHtml } from './study-dom.js';

const STAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="#D97706" aria-hidden="true"><path d="M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z"/></svg>';
const STAR_BIG = STAR.replace('width="12" height="12"', 'width="18" height="18"').replace('#D97706', '#FCD34D');
const starChip = (n) => `<span class="starchip">${STAR}<span>${Number(n) || 0}</span></span>`;
const safeUrl = (url) => (typeof url === 'string' && /^https?:\/\/[^\s"'<>]+$|^assets\/[\w./-]+$/i.test(url) ? url : 'assets/avatar.png');
const img = (url, size, cls, alt = '') => `<img class="${cls}" src="${esc(safeUrl(url))}" alt="${esc(alt)}" width="${size}" height="${size}" loading="lazy" decoding="async">`;

/** ข้อความใต้ชื่อของฉัน: ขาดอีกกี่ดาวถึงจะขยับอันดับ */
export function nextHint(me) {
    if (!me || me.stars <= 0 || me.rank === null) return 'ทำ Mock Exam เพื่อรับดาวแรกและติดอันดับ';
    if (me.rank === 1) return 'คุณอยู่อันดับ 1 รักษาตำแหน่งไว้ให้ได้!';
    if (me.toNext) return `ขาดอีก ${me.toNext.stars} ดาวขึ้นสู่อันดับ ${me.toNext.rank}!`;
    return 'ทำ Mock Exam เพื่อสะสมดาวเพิ่ม';
}

const PODIUM = [
    { ring: '#D97706', rk: '#B45309', medal: '🥇', height: 72, block: 'background:linear-gradient(180deg,#FCD34D,#FBBF24);border-color:#D97706', size: 72 },
    { ring: '#94A3B8', rk: '#475569', medal: '🥈', height: 48, block: 'background:#E2E8F0;border-color:#94A3B8', size: 56 },
    { ring: '#C2410C', rk: '#9A3412', medal: '🥉', height: 36, block: 'background:#FED7AA;border-color:#FB923C', size: 56 },
];

function podiumColumn(entry, i) {
    const p = PODIUM[i];
    if (!entry) return `<div class="pod-col is-empty"><div class="pod-av" style="--ring:#CBD5E1;--rk:#94A3B8"><span class="pod-ph" style="width:${p.size}px;height:${p.size}px" aria-hidden="true">?</span></div><p class="pod-name">ว่าง</p><div class="pod-block" style="height:${p.height}px;${p.block};opacity:.45"><span aria-hidden="true">${p.medal}</span></div></div>`;
    return `<div class="pod-col${entry.isMe ? ' is-me' : ''}" data-rank-row>
      ${i === 0 ? '<div class="crown" aria-hidden="true">👑</div>' : ''}
      <div class="pod-av" style="--ring:${p.ring};--rk:${p.rk}">${img(entry.avatar, p.size, '', `อันดับ ${entry.rank}`)}<span class="rank">${entry.rank}</span></div>
      <p class="pod-name">${esc(entry.name)}${entry.isMe ? ' <span class="me-chip lb-me">ฉัน</span>' : ''}</p>
      ${starChip(entry.stars)}
      <div class="pod-block" style="height:${p.height}px;${p.block}"><span aria-hidden="true">${p.medal}</span></div>
    </div>`;
}

function listRow(entry) {
    return `<div class="lb-row${entry.isMe ? ' is-me' : ''}" data-rank-row>
      <span class="lb-rank">${entry.rank}</span>${img(entry.avatar, 40, 'lb-av')}
      <div class="lb-t"><h3>${esc(entry.name)}${entry.isMe ? ' <span class="me-chip lb-me">ฉัน</span>' : ''}</h3></div>${starChip(entry.stars)}
    </div>`;
}

function meCard(me) {
    return `<div class="me" data-rank-row>
      <span class="me-rank">${me.rank === null ? '—' : `#${me.rank}`}</span>
      ${img(me.avatar, 44, 'me-av', 'ภาพของฉัน')}
      <div class="me-t"><p class="me-name"><span>${esc(me.name)}</span><span class="me-chip">ฉัน</span></p><p class="me-sub">${esc(nextHint(me))}</p></div>
      <div class="me-r"><p class="me-star">${STAR_BIG}<span>${me.stars}</span></p><p class="me-cap">ดาวสะสม</p></div>
    </div>
    <button type="button" class="lb-anon" data-act="rank-anon" aria-pressed="${me.anonymous}">${me.anonymous
        ? 'คนอื่นเห็นคุณเป็น “ผู้เรียนนิรนาม” • แตะเพื่อแสดงชื่อของฉัน'
        : 'ซ่อนชื่อของฉันจากคนอื่น (ยังติดอันดับเหมือนเดิม)'}</button>`;
}

/** เนื้อหาของส่วนอันดับ (ใต้หัวข้อ) จากคำตอบของ GET /ranking */
export function rankingBodyHtml(data) {
    if (!data || data.available === false) {
        return '<p class="lb-empty" role="status">ตารางอันดับยังไม่เปิดใช้งาน เมื่อพร้อมจะแสดงที่นี่</p>';
    }
    const top = Array.isArray(data.top) ? data.top : [];
    const me = data.me || { rank: null, stars: 0, name: 'ฉัน', avatar: null, anonymous: false, toNext: null };
    if (top.length === 0) {
        return `<div class="lb-empty" role="status"><span class="lb-empty-i" aria-hidden="true">⭐</span><p><b>ยังไม่มีใครติดอันดับ</b><br>ทำ Mock Exam เพื่อรับดาวแรก แล้วคุณจะเป็นคนแรกบนตาราง!</p></div>${meCard(me)}`;
    }
    const pod = `<div class="pod" data-key="pod">${podiumColumn(top[1], 1)}${podiumColumn(top[0], 0)}${podiumColumn(top[2], 2)}</div>`;
    const rest = top.slice(3);
    // ถ้าฉันไม่ได้อยู่ใน 10 อันดับแรก การ์ดอันดับของฉันอยู่ใต้โพเดียม (อยู่ในรายการอยู่แล้วก็ยังแสดงเพื่อบอกว่าขาดอีกกี่ดาว)
    return `${pod}${meCard(me)}${rest.length ? `<div class="lb-list" data-key="list">${rest.map(listRow).join('')}</div>` : ''}${Number(data.total) > 0 ? `<p class="lb-total">ติดอันดับแล้ว ${Number(data.total)} คน</p>` : ''}`;
}

// ───────────── หน้า Progress ─────────────
let loading = false;

async function load(api, host) {
    try {
        patchHtml(host, rankingBodyHtml(await api.getRanking()));
    } catch (err) {
        patchHtml(host, '<p class="lb-empty" role="alert">โหลดตารางอันดับไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>');
        console.warn('[Study] โหลดอันดับไม่ได้:', err && err.message);
    }
}

/** เติมตารางอันดับจริงลง #lb-body ของหน้า Progress (โหมดตัวอย่างไม่เรียกฟังก์ชันนี้) */
export async function hydrateRanking(scope, api) {
    const host = scope.querySelector && scope.querySelector('#lb-body');
    if (!host || host.dataset.live === '1') return;
    host.dataset.live = '1';
    host.setAttribute('aria-busy', 'true');
    await load(api, host);
    host.removeAttribute('aria-busy');
    host.onclick = async (e) => {
        const btn = e.target.closest && e.target.closest('[data-act="rank-anon"]');
        if (!btn || loading) return;
        loading = true;
        btn.disabled = true;
        try {
            await api.setRankingAnonymous(btn.getAttribute('aria-pressed') !== 'true');
            await load(api, host);
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'บันทึกไม่สำเร็จ ลองอีกครั้ง';
        } finally {
            loading = false;
        }
    };
}

// ───────────── แอนิเมชันเลื่อนอันดับ (หน้าสรุปผล Mock) ─────────────
/** มีอะไรให้ฉลองไหม: เพิ่งติดอันดับครั้งแรก หรืออันดับขยับขึ้น (ดาวเพิ่มแต่อันดับเท่าเดิม = ไม่มีหน้านี้) */
export const hasRankMove = (ranking) => !!ranking && !!ranking.after && (ranking.entered === true || Number(ranking.moved) > 0);

/**
 * หน้า "เลื่อนอันดับ": ลำดับก่อนหน้าอยู่ในสถานะเริ่มต้น (--y) แล้วเลื่อนไปลำดับใหม่ (--y2) เมื่อใส่คลาส go
 * ก่อน: คนที่เราแซง (อยู่เหนือเรา) → เรา   หลัง: เรา → คนที่ถูกแซงเลื่อนลงหนึ่งช่อง
 */
export function rankStepHtml(ranking) {
    const passed = (ranking.passed || []).slice(0, 3);
    const k = passed.length;
    const others = passed.map((p, i) => `<div class="rk-row is-other" style="--y:${i};--y2:${i + 1}">${img(p.avatar, 36, 'rk-av')}<span class="rk-name">${esc(p.name)}</span><span class="rk-st">${STAR}${Number(p.stars) || 0}</span><i class="rk-down" aria-hidden="true">▼</i></div>`).join('');
    const me = `<div class="rk-row is-me${ranking.entered ? ' is-new' : ''}" style="--y:${k};--y2:0">${img(ranking.me && ranking.me.avatar, 36, 'rk-av', 'ฉัน')}<span class="rk-name">คุณ</span><span class="rk-st">${STAR}${Number(ranking.after.stars) || 0}</span></div>`;
    const title = ranking.entered ? 'ติดอันดับแล้ว!' : 'เลื่อนอันดับ!';
    const gain = ranking.entered
        ? '<span class="pill gold rk-pill">เข้าสู่ตารางอันดับดาว</span>'
        : `<span class="pill gold rk-pill"><b aria-hidden="true">▲</b> ขึ้น ${ranking.moved} อันดับ</span>`;
    // ตัวเลขเริ่มที่อันดับเดิม (ไม่เคยติดอันดับ = ไล่ลงมาจากใต้คนที่เราแซง) แล้ว playRankUp นับไปถึงอันดับใหม่
    const from = ranking.before && ranking.before.rank !== null ? ranking.before.rank : ranking.after.rank + k;
    return `<section class="rs-card rs-rank">
      <p class="rs-k">${esc(title)}</p>
      <p class="rs-big gold rk-num" aria-label="อันดับ ${ranking.after.rank}">#<span data-roll="${from},${ranking.after.rank}">${from}</span></p>
      ${gain}
      <div class="rk-ladder" style="--rows:${Math.max(1, k + 1)}">${others}${me}</div>
      <p class="rs-cap">${k ? `แซง ${k} คน • ` : ''}ดาวสะสม ${Number(ranking.after.stars) || 0} จาก ${Number(ranking.total) || 0} คนในตาราง</p>
    </section>`;
}

/** ตัวเลขนับจาก→ถึง (ไล่ทีละอันดับ) ถ้าผู้ใช้ปิดแอนิเมชันก็ขึ้นค่าสุดท้ายเลย */
export function rollNumber(el, from, to, ms = 1100) {
    if (!el) return;
    const a = Number(from);
    const b = Number(to);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b || reducedMotion() || typeof requestAnimationFrame !== 'function') { el.textContent = String(b); return; }
    const t0 = performance.now();
    let last = a;
    el.textContent = String(a);
    const tick = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const eased = 1 - (1 - t) ** 3;
        const value = Math.round(a + (b - a) * eased);
        if (value !== last) { last = value; el.textContent = String(value); pop(el, { scale: 1.25, ms: 160 }); }
        if (t < 1) requestAnimationFrame(tick); else el.textContent = String(b);
    };
    requestAnimationFrame(tick);
}

/** เล่นแอนิเมชันของหน้าเลื่อนอันดับ (เรียกครั้งเดียวตอนหน้าโผล่) */
export function playRankUp(root, ranking) {
    if (!root || typeof root.querySelector !== 'function') return;
    const ladder = root.querySelector('.rk-ladder');
    const num = root.querySelector('[data-roll]');
    if (ladder && typeof ladder.classList !== 'undefined') {
        if (reducedMotion()) ladder.classList.add('go');
        else setTimeout(() => ladder.classList.add('go'), 650);
    }
    if (num) {
        const [from, to] = String(num.getAttribute('data-roll')).split(',').map(Number);
        setTimeout(() => rollNumber(num, from, to, 1000), 650);
    }
    const pill = root.querySelector('.rk-pill');
    setTimeout(() => {
        pop(pill, { scale: 1.3, ms: 520 });
        if (ranking && ranking.after && ranking.after.rank <= 3) confetti({ count: 140 });
        else burst(root.querySelector('.rk-num'), { count: 14, radius: 90, colors: ['#FBBF24', '#F59E0B', '#FDE68A', '#FCD34D'] });
    }, 1500);
}
