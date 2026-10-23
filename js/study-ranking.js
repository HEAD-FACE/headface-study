/**
 * js/study-ranking.js — ตารางอันดับดาว (Leaderboard) และแอนิเมชันเลื่อนอันดับ (สัญญา: docs/study-api-contract.md ข้อ 2.13)
 *
 *   • หน้า Progress: โพเดียม SVG 3 อันดับแรก (ขั้นบันไดทอง/เงิน/ทองแดง มีแอนิเมชัน; มอบให้เฉพาะคนที่มีดาวแล้วเท่านั้น),
 *     รายชื่อ "ทุกคน" ถัดจากโพเดียมทีละหน้า (คนที่ยังไม่มีดาวก็แสดง ไม่มีเลขอันดับ อยู่ท้ายสุด + ปุ่มโหลดเพิ่ม), การ์ดอันดับของฉัน
 *     และ "แถบชื่อของฉัน" ที่ลอยเหนือ navbar ตลอดเวลา — ชื่อของตัวเองแสดงเต็มเสมอ ไม่มีทางซ่อน (ตั้งใจ ไม่มีสวิตช์ซ่อนชื่อ)
 *   • หน้าสรุปผล Mock: ถ้าดาวที่ได้ทำให้อันดับขยับ (หรือเพิ่งติดอันดับครั้งแรก) มีหน้า "เลื่อนอันดับ" ที่คนที่แซงไปเลื่อนลง
 *     ตัวเราเลื่อนขึ้น ตัวเลขอันดับนับลง และมีเอฟเฟกต์ฉลอง
 *
 * อันดับคิดที่ Backend จากผลรวมดาวของทุกครั้งที่ทำ Mock (ดาวเท่ากัน = อันดับเดียวกัน) หน้านี้แค่แสดง ไม่คำนวณอันดับเอง
 * ชื่อของผู้อื่นมาเป็น "ชื่อ + อักษรตัวแรกของนามสกุล" และภาพที่เปิดเผยได้เท่านั้น (ไม่มีภาพถ่ายที่อัปโหลด) ทุกข้อความผ่าน esc
 */
import { esc } from './study-ui.js';
import { burst, confetti, pop, reducedMotion } from './study-fx.js';
import { patchHtml } from './study-dom.js';

const STAR_PATH = 'M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z';
const star = (size, fill) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
const STAR = star(12, '#D97706');
const STAR_BIG = star(18, '#FCD34D');
const starChip = (n) => `<span class="starchip">${STAR}<span>${Number(n) || 0}</span></span>`;
const safeUrl = (url) => (typeof url === 'string' && /^https?:\/\/[^\s"'<>]+$|^assets\/[\w./-]+$/i.test(url) ? url : 'assets/avatar.png');
const img = (url, size, cls, alt = '') => `<img class="${cls}" src="${esc(safeUrl(url))}" alt="${esc(alt)}" width="${size}" height="${size}" loading="lazy" decoding="async">`;
const MY_BADGE = '<span class="me-chip lb-me">ฉัน</span>';

/** ข้อความใต้ชื่อของฉัน: ขาดอีกกี่ดาวถึงจะขยับอันดับ */
export function nextHint(me) {
    if (!me || me.stars <= 0 || me.rank === null) return 'ทำ Mock Exam เพื่อรับดาวแรกและติดอันดับ';
    if (me.rank === 1) return 'คุณอยู่อันดับ 1 รักษาตำแหน่งไว้ให้ได้!';
    if (me.toNext) return `ขาดอีก ${me.toNext.stars} ดาวขึ้นสู่อันดับ ${me.toNext.rank}!`;
    return 'ทำ Mock Exam เพื่อสะสมดาวเพิ่ม';
}

// ───────────── โพเดียม SVG ─────────────
/** สีของแต่ละขั้น: [ด้านบน, หน้าตัวหลัก (บน→กลาง→ล่าง), ด้านข้าง, ขอบ/ตัวเลข] */
const METAL = [
    { name: 'gold', top: ['#FEF3C7', '#FCD34D'], front: ['#FDE68A', '#F59E0B', '#B45309'], side: '#92400E', edge: '#78350F', ring: '#D97706', glow: '#FBBF24' },
    { name: 'silver', top: ['#F8FAFC', '#CBD5E1'], front: ['#F1F5F9', '#A9B8CB', '#64748B'], side: '#475569', edge: '#334155', ring: '#94A3B8', glow: '#CBD5E1' },
    { name: 'bronze', top: ['#FFEDD5', '#FDBA74'], front: ['#FED7AA', '#EA7B2C', '#9A3412'], side: '#7C2D12', edge: '#7C2D12', ring: '#C2410C', glow: '#FB923C' },
];
const STEP_H = [150, 112, 84]; // ความสูงของหน้าตัวหลัก (หน่วย viewBox) อันดับ 1 สูงสุด
const SPARK = 'M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7Z';

/** ใบลอเรล 1 ใบ (วงรีเอียง) */
const leaf = (x, y, rot, fill) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="7" transform="rotate(${rot} ${x} ${y})" fill="${fill}" opacity=".9"/>`;

/**
 * ขั้นโพเดียมหนึ่งขั้นเป็น SVG ชิ้นเดียว: ผิวโลหะไล่สี มีด้านบน/ด้านข้างให้เป็นทรง 3 มิติ ประกายเลื่อนผ่านทุก ๆ ไม่กี่วินาที
 * ตัวเลขอันดับแกะนูนกลางขั้น อันดับ 1 มีพวงลอเรลและดาว ทุกขั้นมีประกายระยิบ — แอนิเมชันอยู่ใน css/ranking.css (ปิดเมื่อผู้ใช้ตั้งลดการเคลื่อนไหว)
 * @param {number} place   0 = ที่หนึ่ง (กลาง), 1 = ที่สอง (ซ้าย), 2 = ที่สาม (ขวา)
 * @param {string|number} label  ตัวเลขที่แสดง (อันดับจริง ดาวเท่ากันอาจเป็น 2 สองคน)
 */
export function podiumStepSvg(place, label, { empty = false } = {}) {
    const m = METAL[place] || METAL[2];
    const h = STEP_H[place] || STEP_H[2];
    const H = h + 24;
    const id = `pd-${m.name}`;
    const numY = 24 + h * 0.62;
    const laurel = place === 0
        ? `<g class="pd-laurel">${[0, 1, 2, 3].map((i) => leaf(24 - i * 1.5, numY - 14 + i * 9, -35 - i * 6, '#FEF3C7')).join('')}${[0, 1, 2, 3].map((i) => leaf(80 + i * 1.5, numY - 14 + i * 9, 35 + i * 6, '#FEF3C7')).join('')}</g>`
        : '';
    const rivets = place === 0 ? '' : `<circle cx="20" cy="${H - 12}" r="2" fill="${m.edge}" opacity=".35"/><circle cx="84" cy="${H - 12}" r="2" fill="${m.edge}" opacity=".35"/>`;
    return `<svg class="pd-svg${empty ? ' is-empty' : ''}" viewBox="0 0 120 ${H}" role="img" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.front[0]}"/><stop offset=".45" stop-color="${m.front[1]}"/><stop offset="1" stop-color="${m.front[2]}"/></linearGradient>
        <linearGradient id="${id}-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m.top[0]}"/><stop offset="1" stop-color="${m.top[1]}"/></linearGradient>
        <linearGradient id="${id}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.side}" stop-opacity=".85"/><stop offset="1" stop-color="${m.edge}"/></linearGradient>
        <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <linearGradient id="${id}-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <clipPath id="${id}-c"><rect x="8" y="24" width="88" height="${h}" rx="3"/></clipPath>
      </defs>
      <ellipse cx="60" cy="${H - 1}" rx="54" ry="3.5" fill="#0F172A" opacity=".18"/>
      <polygon points="96,24 112,11 112,${H - 13} 96,${H}" fill="url(#${id}-s)"/>
      <rect x="8" y="24" width="88" height="${h}" rx="3" fill="url(#${id}-f)" stroke="${m.edge}" stroke-opacity=".5" stroke-width="1"/>
      <polygon points="8,24 96,24 112,11 24,11" fill="url(#${id}-t)" stroke="${m.edge}" stroke-opacity=".4" stroke-width="1" stroke-linejoin="round"/>
      <rect x="8" y="24" width="88" height="${h * 0.5}" fill="url(#${id}-g)" clip-path="url(#${id}-c)"/>
      <line x1="8" y1="${H - 30}" x2="96" y2="${H - 30}" stroke="${m.edge}" stroke-opacity=".22" stroke-width="1.4"/>
      <line x1="8" y1="${H - 26}" x2="96" y2="${H - 26}" stroke="#fff" stroke-opacity=".28" stroke-width="1"/>
      ${laurel}
      <text x="52" y="${numY + 20}" text-anchor="middle" class="pd-num" font-size="${place === 0 ? 62 : 52}" font-weight="900" fill="${m.front[0]}" stroke="${m.edge}" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke">${esc(label)}</text>
      <text x="52" y="${numY + 20}" text-anchor="middle" font-size="${place === 0 ? 62 : 52}" font-weight="900" fill="url(#${id}-g)" aria-hidden="true">${esc(label)}</text>
      ${rivets}
      <g clip-path="url(#${id}-c)"><rect class="pd-shine" x="-40" y="22" width="26" height="${h + 4}" fill="url(#${id}-h)" transform="skewX(-18)"/></g>
      <g class="pd-spark" style="--s:0"><path d="${SPARK}" transform="translate(104 ${place === 0 ? 40 : 52}) scale(.9)" fill="#fff"/></g>
      <g class="pd-spark" style="--s:1"><path d="${SPARK}" transform="translate(18 ${H - 40}) scale(.7)" fill="#fff"/></g>
      <g class="pd-spark" style="--s:2"><path d="${SPARK}" transform="translate(70 18) scale(.6)" fill="${m.top[0]}"/></g>
    </svg>`;
}

/** มงกุฎของที่หนึ่ง: ทองเหลือบแสง ลอยขึ้นลงเบา ๆ มีประกายวิ่งผ่าน */
const CROWN = `<svg class="pd-crown-svg" viewBox="0 0 64 46" width="54" height="40" aria-hidden="true" focusable="false">
  <defs><linearGradient id="pd-crown-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FEF3C7"/><stop offset=".5" stop-color="#FBBF24"/><stop offset="1" stop-color="#B45309"/></linearGradient></defs>
  <path d="M6 38 L2 12 L19 24 L32 4 L45 24 L62 12 L58 38 Z" fill="url(#pd-crown-g)" stroke="#92400E" stroke-width="2" stroke-linejoin="round"/>
  <rect x="6" y="38" width="52" height="6" rx="2.5" fill="#F59E0B" stroke="#92400E" stroke-width="2"/>
  <circle cx="32" cy="4" r="3.4" fill="#FEF3C7" stroke="#92400E" stroke-width="1.6"/><circle cx="2" cy="12" r="3" fill="#FEF3C7" stroke="#92400E" stroke-width="1.6"/><circle cx="62" cy="12" r="3" fill="#FEF3C7" stroke="#92400E" stroke-width="1.6"/>
  <circle cx="32" cy="30" r="3.6" fill="#EF4444" stroke="#7F1D1D" stroke-width="1.2"/><circle cx="17" cy="33" r="2.6" fill="#38BDF8" stroke="#075985" stroke-width="1.1"/><circle cx="47" cy="33" r="2.6" fill="#34D399" stroke="#065F46" stroke-width="1.1"/>
  <path class="pd-crown-glint" d="M14 36 L22 18" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const AVATAR_SIZE = [84, 66, 66];

function podiumColumn(entry, place) {
    const m = METAL[place];
    if (!entry) {
        return `<div class="pod-col is-empty" style="--ring:#CBD5E1;--i:${place}"><div class="pod-info"><span class="pod-ph" style="width:${AVATAR_SIZE[place]}px;height:${AVATAR_SIZE[place]}px" aria-hidden="true">?</span><p class="pod-name">ว่าง</p></div><div class="pod-step">${podiumStepSvg(place, '–', { empty: true })}</div></div>`;
    }
    return `<div class="pod-col pod-p${place}${entry.isMe ? ' is-me' : ''}" style="--ring:${m.ring};--glow:${m.glow};--i:${place}" data-rank-row>
      <div class="pod-info">
        ${place === 0 ? `<div class="crown" aria-hidden="true">${CROWN}</div>` : ''}
        <div class="pod-av">${img(entry.avatar, AVATAR_SIZE[place], '', `อันดับ ${entry.rank}`)}</div>
        <p class="pod-name">${esc(entry.name)}${entry.isMe ? ` ${MY_BADGE}` : ''}</p>
        ${starChip(entry.stars)}
      </div>
      <div class="pod-step">${podiumStepSvg(place, entry.rank)}</div>
    </div>`;
}

function listRow(entry) {
    const none = entry.rank === null || entry.rank === undefined; // ยังไม่มีดาว = ไม่มีอันดับ
    return `<div class="lb-row${entry.isMe ? ' is-me' : ''}${none ? ' no-star' : ''}" data-rank-row>
      <span class="lb-rank${none ? ' is-none' : ''}"${none ? ' aria-label="ยังไม่มีอันดับ"' : ''}>${none ? '–' : entry.rank}</span>${img(entry.avatar, entry.isMe ? 46 : 40, 'lb-av')}
      <div class="lb-t"><h3>${esc(entry.name)}${entry.isMe ? ` ${MY_BADGE}` : ''}</h3></div>${starChip(entry.stars)}
    </div>`;
}

function meCard(me) {
    return `<div class="me" data-rank-row>
      <span class="me-rank">${me.rank === null ? '—' : `#${me.rank}`}</span>
      ${img(me.avatar, 44, 'me-av', 'ภาพของฉัน')}
      <div class="me-t"><p class="me-name"><span>${esc(me.name)}</span>${MY_BADGE.replace(' lb-me', '')}</p><p class="me-sub">${esc(nextHint(me))}</p></div>
      <div class="me-r"><p class="me-star">${STAR_BIG}<span>${me.stars}</span></p><p class="me-cap">ดาวสะสม</p></div>
    </div>`;
}

const DEFAULT_ME = { rank: null, stars: 0, name: 'ฉัน', avatar: null, toNext: null };

/** เนื้อหาของส่วนอันดับ (ใต้หัวข้อ) จากคำตอบของ GET /ranking */
export function rankingBodyHtml(data) {
    if (!data || data.available === false) {
        return '<p class="lb-empty" role="status">ตารางอันดับยังไม่เปิดใช้งาน เมื่อพร้อมจะแสดงที่นี่</p>';
    }
    const top = Array.isArray(data.top) ? data.top : [];
    const me = data.me || DEFAULT_ME;
    if (top.length === 0) {
        return `<div class="lb-empty" role="status"><span class="lb-empty-i" aria-hidden="true">⭐</span><p><b>ยังไม่มีใครติดอันดับ</b><br>ทำ Mock Exam เพื่อรับดาวแรก แล้วคุณจะเป็นคนแรกบนตาราง!</p></div>${meCard(me)}${memberListHtml(data, top)}${totalLine(data)}`;
    }
    const pod = `<div class="pod" data-key="pod">${podiumColumn(top[1], 1)}${podiumColumn(top[0], 0)}${podiumColumn(top[2], 2)}</div>`;
    return `${pod}${meCard(me)}${memberListHtml(data, top)}${totalLine(data)}`;
}

/** รายชื่อถัดจากโพเดียม: ทุกคน (data.members) — ถ้า Backend รุ่นเก่าไม่ส่งมาก็ใช้ที่เหลือของ top */
function memberListHtml(data, top) {
    const m = data.members;
    const items = m && Array.isArray(m.items) ? m.items : top.slice(3);
    if (items.length === 0) return '';
    const more = m && m.hasMore ? moreButton(m) : '';
    return `<div class="lb-list" data-key="list">${items.map(listRow).join('')}</div>${more}`;
}

const moreButton = (m) => `<button type="button" class="lb-more" data-act="lb-more" data-next="${(Number(m.offset) || 0) + (Number(m.limit) || 0)}">ดูเพิ่มอีก</button>`;

function totalLine(data) {
    const ranked = Number(data.total) || 0;
    const everyone = data.members ? Number(data.members.count) || 0 : 0;
    if (ranked <= 0 && everyone <= 0) return '';
    return `<p class="lb-total">ติดอันดับแล้ว ${ranked} คน${everyone > ranked ? ` • ผู้เรียนทั้งหมด ${everyone} คน` : ''}</p>`;
}

// ───────────── แถบชื่อของฉัน: ลอยเหนือ navbar ตลอด ─────────────
/** แถบลอย: อันดับ ภาพ ชื่อเต็ม และดาวของฉัน (ไม่มีปุ่มปิด/ซ่อน) */
export function floatBarHtml(me) {
    const m = me || DEFAULT_ME;
    return `<span class="lf-rank${m.rank === null ? ' is-none' : ''}" aria-label="${m.rank === null ? 'ยังไม่มีอันดับ' : `อันดับ ${m.rank}`}">${m.rank === null ? '—' : `#${m.rank}`}</span>
      ${img(m.avatar, 40, 'lf-av', 'ภาพของฉัน')}
      <span class="lf-t"><b class="lf-name">${esc(m.name)}</b><span class="lf-sub">${esc(nextHint(m))}</span></span>
      <span class="lf-st" aria-label="${Number(m.stars) || 0} ดาว">${STAR_BIG}<b>${Number(m.stars) || 0}</b></span>`;
}

/** วางหรืออัปเดตแถบลอย (อยู่ใต้ <body> เพื่อไม่ถูก transform ของ Barba รบกวน) */
export function showFloatBar(me, doc = typeof document !== 'undefined' ? document : null) {
    if (!doc || typeof doc.createElement !== 'function' || !doc.body) return null;
    let bar = doc.getElementById('lb-float');
    if (!bar) {
        bar = doc.createElement('div');
        bar.id = 'lb-float';
        bar.className = 'lb-float';
        bar.setAttribute('role', 'status');
        bar.setAttribute('aria-label', 'อันดับของฉัน');
        doc.body.appendChild(bar);
    }
    const nav = doc.getElementById('bottom-navbar');
    if (nav && bar.style) bar.style.setProperty('--nav-h', `${nav.offsetHeight || 76}px`);
    bar.innerHTML = floatBarHtml(me);
    return bar;
}

export function hideFloatBar(doc = typeof document !== 'undefined' ? document : null) {
    const bar = doc && typeof doc.getElementById === 'function' ? doc.getElementById('lb-float') : null;
    if (bar && typeof bar.remove === 'function') bar.remove();
}

// ───────────── หน้า Progress ─────────────
/** กด "ดูเพิ่มอีก": ดึงหน้าถัดไปของรายชื่อมาต่อท้าย (ปุ่มหายเมื่อหมด; โหลดพลาดก็ให้กดซ้ำได้) */
export async function loadMoreMembers(api, host, button) {
    if (!button || button.disabled) return;
    const offset = Number(button.getAttribute ? button.getAttribute('data-next') : button.dataset && button.dataset.next) || 0;
    button.disabled = true;
    try {
        const data = await api.getRanking({ offset });
        const m = data && data.members;
        const list = host.querySelector && host.querySelector('.lb-list');
        if (m && Array.isArray(m.items) && list && typeof list.insertAdjacentHTML === 'function') {
            list.insertAdjacentHTML('beforeend', m.items.map(listRow).join(''));
            if (m.hasMore) { button.setAttribute('data-next', String((Number(m.offset) || 0) + (Number(m.limit) || 0))); button.disabled = false; } else button.remove();
        } else button.disabled = false;
    } catch (err) {
        button.disabled = false;
        console.warn('[Study] โหลดรายชื่อเพิ่มไม่ได้:', err && err.message);
    }
}

async function load(api, host, doc) {
    try {
        const data = await api.getRanking();
        patchHtml(host, rankingBodyHtml(data));
        if (typeof host.addEventListener === 'function' && !host.dataset.more) {
            host.dataset.more = '1';
            host.addEventListener('click', (event) => {
                const button = event.target && event.target.closest ? event.target.closest('[data-act="lb-more"]') : null;
                if (button) loadMoreMembers(api, host, button);
            });
        }
        if (data && data.available !== false && data.me) {
            showFloatBar(data.me, doc);
            // เว้นที่ท้ายหน้าไม่ให้แถบลอยบังเนื้อหา
            const section = host.closest ? host.closest('#lb-section') : null;
            if (section && !section.querySelector('.lb-float-gap') && typeof section.insertAdjacentHTML === 'function') section.insertAdjacentHTML('beforeend', '<div class="lb-float-gap" aria-hidden="true"></div>');
        } else hideFloatBar(doc);
    } catch (err) {
        patchHtml(host, '<p class="lb-empty" role="alert">โหลดตารางอันดับไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>');
        hideFloatBar(doc);
        console.warn('[Study] โหลดอันดับไม่ได้:', err && err.message);
    }
}

/** เติมตารางอันดับจริงลง #lb-body ของหน้า Progress (โหมดตัวอย่างไม่เรียกฟังก์ชันนี้) */
export async function hydrateRanking(scope, api, doc = typeof document !== 'undefined' ? document : null) {
    const host = scope.querySelector && scope.querySelector('#lb-body');
    if (!host || host.dataset.live === '1') return;
    host.dataset.live = '1';
    host.setAttribute('aria-busy', 'true');
    await load(api, host, doc);
    host.removeAttribute('aria-busy');
}

// ออกจากหน้า Progress (Barba สลับหน้า) → เอาแถบลอยออก
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('study:page', (event) => {
        const container = event.detail && event.detail.container;
        if (container && typeof container.querySelector === 'function' && !container.querySelector('#lb-body')) hideFloatBar();
    });
}

// ───────────── แอนิเมชันเลื่อนอันดับ (หน้าสรุปผล Mock) ─────────────
/** มีอะไรให้ฉลองไหม: เพิ่งติดอันดับครั้งแรก หรืออันดับขยับขึ้น (ดาวเพิ่มแต่อันดับเท่าเดิม = ไม่มีหน้านี้) */
export const hasRankMove = (ranking) => !!ranking && !!ranking.after && (ranking.entered === true || Number(ranking.moved) > 0);

/**
 * หน้า "เลื่อนอันดับ": ลำดับก่อนหน้าอยู่ในสถานะเริ่มต้น (--y) แล้วเลื่อนไปลำดับใหม่ (--y2) เมื่อใส่คลาส go
 * ก่อน: คนที่เราแซง (อยู่เหนือเรา) → เรา   หลัง: เรา → คนที่ถูกแซงเลื่อนลงหนึ่งช่อง (ชื่อของฉันแสดงเต็มเสมอ)
 */
export function rankStepHtml(ranking) {
    const passed = (ranking.passed || []).slice(0, 3);
    const k = passed.length;
    const others = passed.map((p, i) => `<div class="rk-row is-other" style="--y:${i};--y2:${i + 1}">${img(p.avatar, 36, 'rk-av')}<span class="rk-name">${esc(p.name)}</span><span class="rk-st">${STAR}${Number(p.stars) || 0}</span><i class="rk-down" aria-hidden="true">▼</i></div>`).join('');
    const myName = ranking.me && ranking.me.name ? ranking.me.name : 'คุณ';
    const me = `<div class="rk-row is-me${ranking.entered ? ' is-new' : ''}" style="--y:${k};--y2:0">${img(ranking.me && ranking.me.avatar, 36, 'rk-av', 'ฉัน')}<span class="rk-name">${esc(myName)}</span><span class="rk-st">${STAR}${Number(ranking.after.stars) || 0}</span></div>`;
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
