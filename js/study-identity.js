// HEADFACE STUDY - ตัวตนบนแถบหัว: รูปโปรไฟล์จริง + วงแหวนตามแพลน + ป้ายแพลน (ทำให้เหมือนปุ่มโปรไฟล์ของเว็บหลัก)
// ข้อมูลมาจากเซิร์ฟเวอร์ที่เดียวกับเว็บหลัก: GET /api/profile/identity (แพลน + รูปที่ผู้ใช้เลือก) ไม่เก็บสำเนาไว้ในเครื่อง
// ระหว่างรอ: รูปเป็น skeleton (ห้ามใส่รูปสมมติ) — ถ้าโหลดไม่ได้ จึงใช้ภาพเงาคนกลาง ๆ ที่ไม่ใช่ใบหน้าของใคร
//
// รูปแบบใน HTML:
//   <span class="hf-ring-host" data-hf-ring data-ring-surface="on-color"><img data-hf-avatar class="skl" ...></span>
//   <span data-hf-plan-chip hidden class="hf-plan-tag"></span>

const PLAN_TIERS = ['free', 'plus', 'max'];
const PLAN_LABELS = { plus: 'PLUS', max: 'MAX' };
const BADGE_SESSION_KEY = 'study_plan_badge';
const BADGE_START_DELAY_MS = 700;
const BADGE_LIFETIME_MS = 3800;

/** ภาพเงาคนกลาง ๆ (ใช้เมื่อโหลดรูปจริงไม่ได้เท่านั้น) */
export const NEUTRAL_AVATAR = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#E2E8F0"/><circle cx="32" cy="25" r="11" fill="#94A3B8"/><path d="M10 58c2-13 11-19 22-19s20 6 22 19z" fill="#94A3B8"/></svg>',
);

/** "free" | "plus" | "max" (อะไรที่ไม่รู้จัก = free: ไม่มีวงแหวน) */
export function planTierOf(identity) {
    const id = String(identity?.plan?.id || '').toLowerCase();
    return PLAN_TIERS.includes(id) ? id : 'free';
}

/** "PLUS" | "MAX" | "" */
export function planLabelOf(identity) {
    return PLAN_LABELS[planTierOf(identity)] || '';
}

/** เก็บเฉพาะสิ่งที่หน้าต้องใช้ — รูปต้องเป็น https (หรือ http บน localhost) เท่านั้น */
export function normalizeIdentity(data) {
    if (!data || typeof data !== 'object' || !data.plan || !data.avatar) return null;
    const url = data.avatar.url;
    if (typeof url !== 'string' || !/^https:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(url)) return null;
    return {
        plan: { id: String(data.plan.id || 'free'), display_name: String(data.plan.display_name || '') },
        avatar: { url },
    };
}

export function avatarSrcOf(identity) {
    return identity?.avatar?.url || NEUTRAL_AVATAR;
}

/** วาดตัวตนลงหน้า: รูป วงแหวน ป้ายแพลน */
export function applyIdentity(identity, root = typeof document !== 'undefined' ? document : null) {
    if (!root || !identity) return;
    const tier = planTierOf(identity);
    const src = avatarSrcOf(identity);
    root.querySelectorAll('[data-hf-ring]').forEach((host) => { if (host.dataset.plan !== tier) host.dataset.plan = tier; });
    root.querySelectorAll('img[data-hf-avatar]').forEach((img) => setAvatar(img, src));
    const label = PLAN_LABELS[tier] || '';
    root.querySelectorAll('[data-hf-plan-chip]').forEach((chip) => {
        chip.hidden = !label;
        chip.dataset.plan = tier;
        if (chip.textContent !== label) chip.textContent = label;
    });
}

const bound = new WeakSet();
function setAvatar(img, src) {
    if (!bound.has(img)) {
        bound.add(img);
        // รูปที่โหลดไม่ได้ (ออฟไลน์ ลิงก์หมดอายุ) → ภาพเงากลาง ๆ หนึ่งครั้ง
        img.addEventListener('error', () => {
            if (img.getAttribute('src') !== NEUTRAL_AVATAR) img.setAttribute('src', NEUTRAL_AVATAR);
            img.classList.remove('skl');
        });
        img.addEventListener('load', () => img.classList.remove('skl'));
    }
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
}

/** ขอตัวตนจากเซิร์ฟเวอร์ (ไม่โยน error: ถ้าไม่ได้ก็คืน null) */
export async function fetchIdentity(fetcher) {
    try {
        const res = await fetcher('/api/profile/identity', { method: 'GET' });
        if (!res || !res.ok) return null;
        return normalizeIdentity(await res.json());
    } catch (_) {
        return null;
    }
}

/** ป้ายแพลนเลื่อนลงจากใต้รูปครั้งหนึ่งต่อเซสชัน (PLUS/MAX เท่านั้น) */
export function showPlanBadge(identity, doc = typeof document !== 'undefined' ? document : null) {
    const tier = planTierOf(identity);
    const label = PLAN_LABELS[tier];
    if (!label || !doc || doc.visibilityState === 'hidden') return false;
    try { if (sessionStorage.getItem(BADGE_SESSION_KEY) === tier) return false; } catch (_) { /* ไม่มี sessionStorage: แสดงได้ */ }
    const host = doc.querySelector('#profileBtn [data-hf-ring]');
    if (!host) return false;
    const badge = doc.createElement('span');
    badge.className = 'hf-plan-badge';
    badge.dataset.plan = tier;
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = label;
    host.appendChild(badge);
    try { sessionStorage.setItem(BADGE_SESSION_KEY, tier); } catch (_) { /* ignore */ }
    let removed = false;
    const remove = () => { if (!removed) { removed = true; badge.remove?.(); } };
    badge.addEventListener('animationend', remove);
    setTimeout(remove, BADGE_LIFETIME_MS + 700);
    return true;
}

let started = false;

/** เรียกครั้งเดียวต่อหน้า: โหลดตัวตนแล้ววาด (แถบหัวอยู่นอก Barba จึงไม่ต้องโหลดซ้ำเมื่อเปลี่ยนหน้า) */
export async function initIdentity({ fetcher, root } = {}) {
    if (started) return null;
    started = true;
    let useFetcher = fetcher;
    if (!useFetcher) {
        const mod = await import('./api-client.js');
        useFetcher = mod.apiFetch;
    }
    const identity = await fetchIdentity(useFetcher);
    if (!identity) {
        // โหลดไม่ได้: ไม่ทิ้งให้เป็น skeleton ค้าง
        (root || document).querySelectorAll('img[data-hf-avatar]').forEach((img) => setAvatar(img, NEUTRAL_AVATAR));
        started = false;
        return null;
    }
    applyIdentity(identity, root);
    setTimeout(() => { try { showPlanBadge(identity); } catch (_) { /* เพียงลูกเล่น */ } }, BADGE_START_DELAY_MS);
    return identity;
}

if (typeof window !== 'undefined') window.StudyIdentity = { applyIdentity, initIdentity, planTierOf };
