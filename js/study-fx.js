/**
 * js/study-fx.js — เอฟเฟกต์เคลื่อนไหวเล็ก ๆ ที่ทำให้การเรียนสนุกขึ้น (ไม่พึ่งไลบรารี: Web Animations API + canvas)
 *
 * ทุกฟังก์ชันปลอดภัยเสมอ: ถ้าผู้ใช้ตั้งค่า "ลดการเคลื่อนไหว" (prefers-reduced-motion) หรือเบราว์เซอร์/เทสต์ไม่มี DOM
 * จะไม่ทำอะไรเลย (หน้าทำงานเหมือนเดิมทุกอย่าง) เอฟเฟกต์ไม่เคยเปลี่ยนข้อมูลหรือสถานะของหน้า
 */
const hasDom = () => typeof document !== 'undefined' && typeof window !== 'undefined' && typeof document.createElement === 'function';

export function reducedMotion() {
    try {
        return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {
        return false;
    }
}

const canAnimate = (el) => hasDom() && !reducedMotion() && !!el && typeof el.animate === 'function';

export const PALETTE = Object.freeze(['#10B981', '#34D399', '#FBBF24', '#F59E0B', '#38BDF8', '#818CF8', '#F472B6', '#FB7185']);

/** เด้งเล็ก ๆ (เมื่อได้คำตอบถูก / ทำสำเร็จ) */
function popUnsafe(el, { scale = 1.12, ms = 320 } = {}) {
    if (!canAnimate(el)) return;
    el.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})`, offset: 0.4 }, { transform: 'scale(1)' }], { duration: ms, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}

/** สั่นซ้าย-ขวา (เมื่อคำตอบผิด) */
function shakeUnsafe(el, { px = 7, ms = 380 } = {}) {
    if (!canAnimate(el)) return;
    el.animate([
        { transform: 'translateX(0)' }, { transform: `translateX(${-px}px)`, offset: 0.18 }, { transform: `translateX(${px}px)`, offset: 0.36 },
        { transform: `translateX(${-px * 0.6}px)`, offset: 0.55 }, { transform: `translateX(${px * 0.4}px)`, offset: 0.75 }, { transform: 'translateX(0)' },
    ], { duration: ms, easing: 'ease-out' });
}

/** ให้องค์ประกอบทยอยลอยเข้ามาทีละชิ้น */
function staggerInUnsafe(elements, { delay = 45, ms = 420, y = 14 } = {}) {
    if (!hasDom() || reducedMotion()) return;
    Array.from(elements || []).forEach((el, i) => {
        if (typeof el.animate !== 'function') return;
        el.animate([{ opacity: 0, transform: `translateY(${y}px) scale(.98)` }, { opacity: 1, transform: 'none' }], { duration: ms, delay: i * delay, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    });
}

/** ตัวเลขนับขึ้นจาก 0 ถึงค่าสุดท้าย (เช่น ดาว / คะแนน) */
export function countUp(el, to, { ms = 900, format = (n) => String(n) } = {}) {
    if (!el) return;
    const target = Number(to);
    if (!Number.isFinite(target) || !hasDom() || reducedMotion() || typeof requestAnimationFrame !== 'function') { el.textContent = format(target); return; }
    const t0 = performance.now();
    const tick = (now) => {
        const t = Math.min(1, (now - t0) / ms);
        const eased = 1 - (1 - t) ** 3;
        el.textContent = format(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
    };
    el.textContent = format(0);
    requestAnimationFrame(tick);
}

/** ดาว/จุดสีกระจายออกจากกลางองค์ประกอบ (เมื่อตอบถูก) */
function burstUnsafe(el, { count = 10, colors = PALETTE, radius = 70 } = {}) {
    if (!canAnimate(el) || !document.body) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('span');
        const size = 6 + Math.random() * 7;
        dot.setAttribute('aria-hidden', 'true');
        dot.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;border-radius:${i % 2 ? '50%' : '2px'};background:${colors[i % colors.length]};pointer-events:none;z-index:300`;
        document.body.appendChild(dot);
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const dist = radius * (0.6 + Math.random() * 0.6);
        const a = dot.animate([
            { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(1)`, opacity: 1, offset: 0.7 },
            { transform: `translate(calc(-50% + ${Math.cos(angle) * dist * 1.15}px), calc(-50% + ${Math.sin(angle) * dist * 1.15 + 14}px)) scale(.6)`, opacity: 0 },
        ], { duration: 650 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.3,1)' });
        a.onfinish = () => dot.remove();
    }
}

/** ริบบิ้นสีตกทั้งหน้าจอ (เมื่อผ่าน Quiz / จบเนื้อหา / ได้คะแนนดี) */
function confettiUnsafe({ count = 110, ms = 2200, colors = PALETTE } = {}) {
    if (!hasDom() || reducedMotion() || !document.body || typeof requestAnimationFrame !== 'function') return;
    const canvas = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:310';
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    document.body.appendChild(canvas);
    const pieces = Array.from({ length: count }, (_, i) => ({
        x: w * (0.15 + Math.random() * 0.7), y: h * 0.35 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 9, vy: -6 - Math.random() * 9, g: 0.28 + Math.random() * 0.14,
        s: 5 + Math.random() * 6, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, c: colors[i % colors.length], round: i % 3 === 0,
    }));
    const t0 = performance.now();
    const frame = (now) => {
        const t = now - t0;
        ctx.clearRect(0, 0, w, h);
        const fade = t > ms - 500 ? Math.max(0, (ms - t) / 500) : 1;
        for (const p of pieces) {
            p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vx *= 0.995;
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.r);
            ctx.fillStyle = p.c;
            if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
            ctx.restore();
        }
        if (t < ms) requestAnimationFrame(frame); else canvas.remove();
    };
    requestAnimationFrame(frame);
}

/** เอฟเฟกต์ไม่เคยทำให้หน้าพัง: ข้อผิดพลาดใด ๆ ในการเคลื่อนไหวถูกกลืนไว้ (หน้าทำงานต่อได้เหมือนไม่มีเอฟเฟกต์) */
const safe = (fn) => (...args) => { try { return fn(...args); } catch (_) { return undefined; } };
export const pop = safe(popUnsafe);
export const shake = safe(shakeUnsafe);
export const staggerIn = safe(staggerInUnsafe);
export const burst = safe(burstUnsafe);
export const confetti = safe(confettiUnsafe);
