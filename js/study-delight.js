/**
 * js/study-delight.js — ความตื่นเต้นและแรงจูงใจเล็ก ๆ ที่ทำให้อยากเรียนต่อ (ใช้ทุกหน้า; css/delight.css เป็นส่วนวาด)
 *
 * แต่ละอย่างอิงหลักจิตวิทยาที่ใช้จริงในแอปการเรียน:
 *   • Goal-gradient   แถบความคืบหน้าที่ใกล้เต็ม (80–99%) เรืองแสงเต้นเบา ๆ + ป้าย "ใกล้ครบแล้ว!" — คนเร่งเมื่อเห็นเส้นชัย
 *   • Endowed progress ตัวเลขสะสม (EXP ดาว ข้อที่ทำ ความแม่นยำ) นับขึ้นจาก 0 ให้รู้สึกว่า "ได้มาเอง" ทุกครั้งที่เปิดหน้า
 *   • Variable reward  ประกายลอยในพื้นหลัง ดาวระยิบ เปลวไฟ Streak ไหว — ของเล็ก ๆ ที่ไม่ซ้ำกันเป๊ะ ทำให้หน้าดูมีชีวิต
 *   • Zeigarnik        ปุ่ม "เรียนต่อ" หายใจเข้าออกช้า ๆ ชี้งานที่ค้างอยู่ ไม่เร่งหรือกดดัน
 *   • Peak celebration เรียนครบ 100% ของวิชา → ริบบิ้นฉลอง (ครั้งเดียวต่อวิชาต่อรอบที่เปิดแอป ไม่รบกวนซ้ำ)
 *   • Tactile feedback คลื่นสัมผัสที่ปุ่มทุกครั้งที่กด
 *   • Reveal on scroll เนื้อหาโผล่ทีละชิ้นขณะเลื่อนลง (เห็นเฉพาะที่ตกลงมาใหม่ ไม่ซ่อนของที่เห็นอยู่แล้ว)
 *
 * ปลอดภัยเสมอ: ผู้ใช้ตั้ง "ลดการเคลื่อนไหว" หรือไม่มี DOM (เทสต์) = ไม่ทำอะไร หน้ายังใช้ได้ครบ; เอฟเฟกต์ไม่เปลี่ยนข้อมูล
 * ทุกฟังก์ชันซ้ำได้ (idempotent) จึงเรียกจากทั้ง main.js และหลังโหลดข้อมูลจริงได้
 */
import { confetti, countUp, pop, reducedMotion, staggerIn } from './study-fx.js';

const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function' && typeof window !== 'undefined';
const on = () => hasDom() && !reducedMotion();

// ───────────── ตัวเลข ─────────────
/**
 * แยกข้อความสถิติเป็น หน้า/ตัวเลข/หลัง เช่น "2,480" "88%" "248 ข้อ" "Lv. 14"; อ่านไม่ได้ ("—", ว่าง) = null
 * @returns {{prefix:string, value:number, suffix:string, grouped:boolean}|null}
 */
export function parseStat(text) {
    const m = /^(\D*?)(\d{1,3}(?:,\d{3})+|\d+)(\D*)$/.exec(String(text ?? '').trim());
    if (!m) return null;
    const value = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(value) || value > 1e9) return null;
    return { prefix: m[1], value, suffix: m[3], grouped: m[2].includes(',') };
}

/** ข้อความของตัวเลข n ในรูปเดียวกับต้นฉบับ (หน้า/หลัง/คั่นหลักพัน) */
export function formatStat(stat, n) {
    return `${stat.prefix}${stat.grouped ? Math.round(n).toLocaleString('en-US') : Math.round(n)}${stat.suffix}`;
}

const COUNT_SELECTOR = '[data-study-reward="exp"], [data-study-reward="stars"], [data-study-stat], .qs-v, .mp-pct .num, .pc-val .num, .sum-pct .num';

/** นับตัวเลขสถิติขึ้นจาก 0 (ค่าเดิมที่เคยนับแล้วไม่นับซ้ำ; 0 และข้อความที่ไม่ใช่ตัวเลขไม่ต้องนับ) */
export function countStats(scope) {
    if (!on() || !scope || typeof scope.querySelectorAll !== 'function') return 0;
    let n = 0;
    for (const el of scope.querySelectorAll(COUNT_SELECTOR)) {
        const text = (el.textContent || '').trim();
        const stat = parseStat(text);
        if (!stat || stat.value === 0 || el.dataset.counted === text) continue;
        el.dataset.counted = text;
        countUp(el, stat.value, { ms: 850 + Math.min(700, stat.value * 2), format: (v) => formatStat(stat, v) });
        n++;
    }
    return n;
}

// ───────────── แถบความคืบหน้า ─────────────
/** ใกล้เส้นชัย: 80–99% */
export const isNearComplete = (pct) => Number.isFinite(pct) && pct >= 80 && pct < 100;

const widthOf = (el) => {
    const m = /(\d+(?:\.\d+)?)%/.exec((el.style && el.style.width) || '');
    return m ? Number(m[1]) : NaN;
};

const NEAR_HOSTS = '.mp-row .mp-t h3, .cc .cc-top .cc-chip';

/** ใส่เรืองแสงที่แถบใกล้ครบ และป้าย "ใกล้ครบแล้ว!" ที่การ์ดวิชา (ครั้งเดียวต่อการ์ด) */
export function markNearBars(scope) {
    if (!hasDom() || !scope || typeof scope.querySelectorAll !== 'function') return 0;
    let n = 0;
    for (const fill of scope.querySelectorAll('.mp-row .bar > i, .cc .bar > i, .sc .bar > i, .sum .bar > i')) {
        const bar = fill.parentElement;
        const near = isNearComplete(widthOf(fill));
        if (bar && bar.classList) bar.classList.toggle('near', near);
        if (!near) continue;
        n++;
        const card = fill.closest && fill.closest('.mp-row, .cc');
        const host = card && card.querySelector ? card.querySelector(NEAR_HOSTS) : null;
        if (host && !card.querySelector('.near-chip') && typeof host.insertAdjacentHTML === 'function') host.insertAdjacentHTML('afterend', '<span class="near-chip">ใกล้ครบแล้ว!</span>');
    }
    return n;
}

// ───────────── เนื้อหาโผล่ตอนเลื่อน ─────────────
const REVEAL_SELECTOR = '.mp-row, .mp-card, .wk-card, .lb-row, .lb-list .me, .tcard, .lr, .hist-i, .fsec, .sum, .cp-unit';

/**
 * องค์ประกอบที่อยู่ใต้จอ ซ่อนไว้ก่อนแล้วค่อยโผล่เมื่อเลื่อนมาถึง; ที่อยู่ในจออยู่แล้วทยอยลอยเข้าทันที (ไม่ซ่อนของที่เห็นอยู่)
 * มีตัวกันพลาด: ถ้า IntersectionObserver ไม่ทำงานภายใน 2.5 วินาที จะแสดงทั้งหมด
 */
export function revealOnScroll(scope) {
    if (!on() || !scope || typeof scope.querySelectorAll !== 'function') return 0;
    const height = window.innerHeight || 700;
    const fresh = [...scope.querySelectorAll(REVEAL_SELECTOR)].filter((el) => !el.dataset.rv);
    const visible = [];
    const later = [];
    for (const el of fresh) {
        el.dataset.rv = '1';
        const top = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect().top : 0;
        (top < height ? visible : later).push(el);
    }
    staggerIn(visible, { delay: 55, ms: 480, y: 16 });
    if (later.length === 0) return fresh.length;
    if (typeof IntersectionObserver !== 'function') return fresh.length;
    for (const el of later) el.classList.add('rv');
    const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('in');
            io.unobserve(entry.target);
        }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    later.forEach((el, i) => { el.style.setProperty('--rv-d', `${Math.min(i, 4) * 60}ms`); io.observe(el); });
    setTimeout(() => { for (const el of later) el.classList.add('in'); io.disconnect(); }, 2500);
    return fresh.length;
}

// ───────────── ฉลองเรียนครบวิชา ─────────────
/** รหัสไว้กันฉลองซ้ำในรอบที่เปิดแอปเดียวกัน */
export const milestoneKey = (id) => `study:done:${String(id)}`;

function seenThisSession(key) {
    try {
        if (typeof sessionStorage === 'undefined') return false;
        if (sessionStorage.getItem(key)) return true;
        sessionStorage.setItem(key, '1');
        return false;
    } catch (_) {
        return false;
    }
}

/** แถวความคืบหน้าที่ครบ 100% (data-done="1") → ริบบิ้นฉลอง 1 ครั้ง + แถวนั้นเด้ง */
export function celebrateMilestones(scope) {
    if (!on() || !scope || typeof scope.querySelectorAll !== 'function') return 0;
    let n = 0;
    for (const row of scope.querySelectorAll('[data-done="1"]')) {
        const id = row.getAttribute('data-subject') || row.getAttribute('href') || '';
        if (!id || seenThisSession(milestoneKey(id))) continue;
        n++;
        setTimeout(() => { pop(row, { scale: 1.04, ms: 520 }); if (n === 1) confetti({ count: 90 }); }, 700);
    }
    return n;
}

// ───────────── ประกายลอยในพื้นหลังสีเขียว ─────────────
const SPARKLES = [[8, 0, 7], [21, 2.2, 9], [37, 4.1, 6], [52, 1.1, 8], [66, 3.3, 10], [79, 5.2, 7], [91, 0.7, 6]];

/** ใส่ประกายสีขาวลอยขึ้นช้า ๆ ในพื้นหลังหัวหน้า (ครั้งเดียว; พื้นหลังอยู่ตลอดตอน Barba สลับหน้า) */
export function ensureSparkles(doc = hasDom() ? document : null) {
    if (!doc || !on()) return null;
    const bg = doc.getElementById('mainBlueBg');
    if (!bg || (bg.querySelector && bg.querySelector('.amb')) || typeof bg.insertAdjacentHTML !== 'function') return null;
    bg.insertAdjacentHTML('beforeend', `<div class="amb" aria-hidden="true">${SPARKLES.map(([x, d, s]) => `<i style="left:${x}%;animation-delay:${d}s;--sz:${s}px"></i>`).join('')}</div>`);
    return bg.querySelector('.amb');
}

// ───────────── ปุ่มหายใจ + คลื่นสัมผัส ─────────────
const CTA_SELECTOR = '.cc .btn, .sum .btn-lg, .wk-go, .exam-btn, .go-next';

/** ปุ่มหลักที่ชวนไปต่อของหน้า หายใจเข้าออกช้า ๆ (ตัวแรกตัวเดียว) */
export function breatheCta(scope) {
    if (!on() || !scope || typeof scope.querySelector !== 'function') return null;
    const prior = scope.querySelector('.breathe');
    if (prior) return prior;
    const cta = scope.querySelector(CTA_SELECTOR);
    if (cta && cta.classList) cta.classList.add('breathe');
    return cta;
}

let rippleBound = false;
/** คลื่นวงกลมจากจุดที่แตะ (ผูกครั้งเดียวทั้งเอกสาร) */
export function bindRipple(doc = hasDom() ? document : null) {
    if (!doc || rippleBound || !on() || typeof doc.addEventListener !== 'function') return false;
    rippleBound = true;
    doc.addEventListener('pointerdown', (event) => {
        const host = event.target && event.target.closest ? event.target.closest('.btn, .exam-btn, .lb-more') : null;
        if (!host || host.disabled || typeof host.getBoundingClientRect !== 'function') return;
        const r = host.getBoundingClientRect();
        const size = Math.max(r.width, r.height) * 1.4;
        const wave = doc.createElement('span');
        wave.className = 'rpl';
        wave.setAttribute('aria-hidden', 'true');
        wave.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - r.left - size / 2}px;top:${event.clientY - r.top - size / 2}px`;
        host.appendChild(wave);
        setTimeout(() => wave.remove(), 650);
    }, { passive: true });
    return true;
}

// ───────────── รวม ─────────────
/** เรียกเมื่อหน้าแสดง (main.js ทุกครั้งที่ Barba สลับหน้า) — ของที่ไม่ต้องรอข้อมูล */
export function enhancePage(scope) {
    try {
        ensureSparkles();
        bindRipple();
        markNearBars(scope);
        revealOnScroll(scope);
        breatheCta(scope);
    } catch (_) { /* เอฟเฟกต์ไม่เคยทำให้หน้าพัง */ }
}

/** เรียกหลังเติมข้อมูลจริงลงหน้า (ตัวเลข แถบ แถวใหม่ที่เพิ่งวาด) */
export function settle(scope) {
    try {
        markNearBars(scope);
        countStats(scope);
        revealOnScroll(scope);
        breatheCta(scope);
        celebrateMilestones(scope);
    } catch (_) { /* เอฟเฟกต์ไม่เคยทำให้หน้าพัง */ }
}
