/**
 * js/study-media.js — แสดงภาพ / วิดีโอ ในเนื้อหา โจทย์ Quiz และ Mock Exam
 *
 * ที่อยู่ของสื่อมาจากไฟล์เนื้อหาที่ admin นำเข้า (Backend ตรวจแล้วว่าเป็น https:// หรือไฟล์ใต้ assets/ ของเว็บ)
 * แต่หน้าเว็บตรวจซ้ำอีกชั้นเสมอ: ข้อความทุกช่องผ่าน esc, ลิงก์ที่ไม่ผ่านกติกาไม่ถูกแสดง และ iframe ฝังได้เฉพาะ
 * เว็บวิดีโอที่รู้จัก (YouTube / Vimeo) พร้อม sandbox ลิงก์วิดีโอเว็บอื่นเปิดในแท็บใหม่แทนการฝัง
 */
import { esc } from './study-ui.js';

const ASSET_PATH_RE = /^assets\/(?:[A-Za-z0-9][A-Za-z0-9._~-]*\/)*[A-Za-z0-9][A-Za-z0-9._~-]*$/;
const VIDEO_FILE_RE = /\.(mp4|webm|ogg|mov)(\?|#|$)/i;
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

/** https://… หรือไฟล์ใต้ assets/ ของเว็บ (กติกาเดียวกับ Backend) */
export function isAllowedMediaUrl(url) {
    if (typeof url !== 'string' || url.length === 0 || url.length > 500) return false;
    if (ASSET_PATH_RE.test(url) && !url.split('/').includes('..')) return true;
    return /^https:\/\/[^\s"'<>\\]+$/i.test(url);
}

/** ลิงก์ที่เป็นไฟล์วิดีโอเล่นในหน้าได้ (mp4 / webm / ogg / mov) */
export const isVideoFile = (url) => VIDEO_FILE_RE.test(url || '');

function startSeconds(raw) {
    const m = /^(\d+)(?:s)?$/.exec(String(raw || ''));
    return m ? Number(m[1]) : 0;
}

/**
 * ลิงก์ฝังของวิดีโอจากเว็บที่อนุญาต หรือ null
 *   YouTube: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID  → youtube-nocookie.com/embed/ID
 *   Vimeo:   vimeo.com/ID, player.vimeo.com/video/ID          → player.vimeo.com/video/ID
 */
export function videoEmbedUrl(url) {
    if (!isAllowedMediaUrl(url) || !/^https:/i.test(url)) return null;
    let u;
    try { u = new URL(url); } catch (_) { return null; }
    const host = u.hostname.toLowerCase();
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (YOUTUBE_HOSTS.has(host)) {
        if (u.pathname === '/watch') id = u.searchParams.get('v');
        else {
            const m = /^\/(?:embed|shorts|live)\/([^/?#]+)/.exec(u.pathname);
            if (m) id = m[1];
        }
    }
    if (id !== null) {
        if (!YOUTUBE_ID_RE.test(id)) return null;
        const start = startSeconds(u.searchParams.get('t') || u.searchParams.get('start'));
        return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1${start ? `&start=${start}` : ''}`;
    }
    if (host === 'vimeo.com' || host === 'www.vimeo.com') {
        const m = /^\/(\d{5,12})$/.exec(u.pathname);
        return m ? `https://player.vimeo.com/video/${m[1]}` : null;
    }
    if (host === 'player.vimeo.com') {
        const m = /^\/video\/(\d{5,12})$/.exec(u.pathname);
        return m ? `https://player.vimeo.com/video/${m[1]}` : null;
    }
    return null;
}

/**
 * สื่อชิ้นเดียว { kind: 'image'|'video', url, alt, caption } เป็น HTML (ที่อยู่ที่ไม่ผ่านกติกา = ไม่แสดงอะไร)
 * @param {{ zoom?: boolean }} [options] zoom: แตะภาพเพื่อขยาย (ค่าเริ่มต้นเปิด)
 */
export function mediaHtml(item, { zoom = true } = {}) {
    if (!item || !isAllowedMediaUrl(item.url)) return '';
    const cap = item.caption ? `<figcaption class="cap rcap">${esc(item.caption)}</figcaption>` : '';
    if (item.kind === 'image') {
        return `<figure class="rfig has-media"><img src="${esc(item.url)}" alt="${esc(item.alt || '')}" loading="lazy" decoding="async"${zoom ? ' data-zoom="1" tabindex="0"' : ''}>${cap}</figure>`;
    }
    if (item.kind !== 'video') return '';
    const label = esc(item.caption || 'วิดีโอประกอบ');
    const embed = videoEmbedUrl(item.url);
    let media;
    if (embed) {
        media = `<div class="rvid"><iframe src="${esc(embed)}" title="${label}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>`;
    } else if (isVideoFile(item.url)) {
        media = `<video controls preload="metadata" playsinline src="${esc(item.url)}" aria-label="${label}"></video>`;
    } else {
        media = `<a class="btn btn-line" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">เปิดวิดีโอ</a>`;
    }
    return `<figure class="rfig has-media is-video">${media}${cap}</figure>`;
}

/** สื่อประกอบโจทย์ (ภาพ/วิดีโอเหนือข้อความโจทย์): รายการว่าง = ไม่มีอะไร */
export function questionMediaHtml(list) {
    const items = Array.isArray(list) ? list.map((m) => mediaHtml(m)).filter(Boolean) : [];
    return items.length ? `<div class="qmedia">${items.join('')}</div>` : '';
}

/** ภาพของตัวเลือก (แสดงเหนือข้อความตัวเลือก) หรือข้อความว่าง */
export function choiceImageHtml(choice) {
    const image = choice && choice.image;
    if (!image || !isAllowedMediaUrl(image.url)) return '';
    return `<img class="choice-img" src="${esc(image.url)}" alt="${esc(image.alt || '')}" loading="lazy" decoding="async">`;
}

// ───────────── ขยายภาพ (แตะภาพเพื่อดูเต็มจอ) ─────────────
let zoomInstalled = false;

/** ติดตั้งตัวขยายภาพครั้งเดียวต่อหน้า: แตะ/กด Enter ที่ภาพซึ่งมี data-zoom เพื่อเปิด แตะอีกครั้งหรือกด Esc เพื่อปิด */
export function installImageZoom(doc = typeof document !== 'undefined' ? document : null) {
    if (!doc || zoomInstalled || typeof doc.addEventListener !== 'function') return;
    zoomInstalled = true;
    const close = () => { doc.getElementById('zoomView')?.remove(); };
    const open = (img) => {
        close();
        const box = doc.createElement('div');
        box.id = 'zoomView';
        box.className = 'zoomv';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'ภาพขยาย แตะเพื่อปิด');
        box.innerHTML = `<img src="${esc(img.getAttribute('src'))}" alt="${esc(img.getAttribute('alt') || '')}"><button type="button" class="zoomv-x" aria-label="ปิดภาพขยาย">✕</button>`;
        box.addEventListener('click', close);
        doc.body.appendChild(box);
        box.querySelector('button')?.focus();
    };
    doc.addEventListener('click', (e) => {
        const img = e.target.closest && e.target.closest('img[data-zoom]');
        if (img) open(img);
    });
    doc.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
        else if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('img[data-zoom]')) open(e.target);
    });
}
