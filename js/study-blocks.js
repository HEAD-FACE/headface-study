/**
 * js/study-blocks.js — แปลงบล็อกเนื้อหาของหน้าเรียน (heading / paragraph / figure / callout / steps / checklist) เป็น HTML
 * ข้อความทุกช่องผ่าน esc (ข้อความธรรมดาเท่านั้น); ภาพ/วิดีโอผ่าน study-media.js (ตรวจที่อยู่ซ้ำเสมอ)
 */
import { esc, ICON } from './study-ui.js';
import { mediaHtml } from './study-media.js';

const multiline = (text) => `<span style="white-space:pre-line">${esc(text)}</span>`;

/** บล็อกของ 1 หน้า → HTML (heading/paragraph/figure รวมเป็นการ์ดเดียว callout/steps/checklist แยกการ์ด) */
export function blocksHtml(blocks) {
    const out = [];
    let article = null;
    const open = () => { if (!article) article = ['<article class="rblock">']; };
    const close = () => { if (article) { article.push('</article>'); out.push(article.join('')); article = null; } };

    for (const b of blocks || []) {
        if (b.type === 'heading') { open(); article.push(`<h2 class="rh">${esc(b.text)}</h2>`); }
        else if (b.type === 'paragraph') { open(); article.push(`<p class="rp">${multiline(b.text)}</p>`); }
        else if (b.type === 'figure') { open(); article.push(mediaHtml(b)); }
        else if (b.type === 'callout') {
            close();
            out.push(`<aside class="rblock callout" style="box-shadow:none">${b.title ? `<h3>${ICON.star(16)} ${esc(b.title)}</h3>` : ''}<p>${multiline(b.text)}</p></aside>`);
        } else if (b.type === 'steps') {
            close();
            out.push(`<article class="rblock">${b.title ? `<h2 class="rh">${esc(b.title)}</h2>` : ''}<ol class="steps">${b.items.map((t) => `<li>${multiline(t)}</li>`).join('')}</ol></article>`);
        } else if (b.type === 'checklist') {
            close();
            out.push(`<article class="rblock">${b.title ? `<h2 class="rh">${esc(b.title)}</h2>` : ''}<ul class="checks">${b.items.map((t) => `<li>${ICON.check(20)}<span>${multiline(t)}</span></li>`).join('')}</ul></article>`);
        }
    }
    close();
    return out.join('');
}
