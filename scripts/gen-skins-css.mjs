#!/usr/bin/env node
/**
 * scripts/gen-skins-css.mjs — สร้าง css/skins.css (ธีมรางวัลของ HEADFACE: ทะเลยามเช้า / แสงเหนือ / ราตรีทองคำ) สำหรับ HEADFACE Study
 *
 * ธีมคืออะไร: นักเรียนเลือกธีมที่หน้าโปรไฟล์ของเว็บหลัก (headface.app) แล้ว "ทั้งแอป" เปลี่ยนสี รวมถึง Study
 *   js/theme.js ใส่ <html data-hf-skin="ocean|aurora|gold"> ก่อนวาดหน้า (จากคุกกี้ที่เว็บหลักเขียนไว้) และ js/study-identity.js
 *   ยืนยันกับเซิร์ฟเวอร์อีกครั้ง (GET /api/profile/identity → theme.key) ไม่มี attribute = หน้าตาปกติ (เขียวมิ้นต์) ไม่มีอะไรเปลี่ยน
 *
 * ทำไมสร้างด้วยโปรแกรม: สีเขียวของ Study เขียนเป็นเลขฐานสิบหกตรง ๆ หลายร้อยจุด (แบบเดียวกับที่ scripts/gen-dark-css.mjs เจอ)
 * วิธีทำ: อ่านทุกกฎใน css/*.css และ css/dark.css แล้วสำหรับ declaration ที่มี "สีเขียวของแบรนด์" (เฉดมิ้นต์/มรกต) สร้างกฎคู่
 *   :where(html[data-hf-skin]) ...                      จากกฎสว่าง
 *   :where(html[data-hf-skin][data-theme="dark"]) ...   จากกฎมืด
 * โดยแทนสีด้วยตัวแปร --k-xxxxxx (ชื่อ = สีเดิม) ซึ่งแต่ละธีมให้ค่าของตัวเอง: ตำแหน่งเดียวกันบนไล่สีของธีม (เขียว 700 → สีหลัก 700 ของธีม ฯลฯ)
 * :where() = น้ำหนักเท่ากฎเดิม และไฟล์นี้อยู่หลัง dark.css จึงชนะเฉพาะกฎเดิมของตัวเอง (กฎที่เจาะจงกว่ายังชนะเหมือนเดิม)
 *
 * สิ่งที่ "ไม่" เปลี่ยนสี (SEMANTIC): เขียวที่แปลว่า "ตอบถูก / ผ่าน / ระดับง่าย" และสีประจำวิชา (.hue-*, .tile-*) — ความหมายต้องเหมือนเดิมทุกธีม
 * ลายและแอนิเมชันของหัวหน้าเว็บ + ค่าสีของธีม มาจาก scripts/skin-themes.mjs (สำเนาเดียวกับเว็บหลัก: ต้องตรงกับ css/skins.css ของ headface)
 * ปรับเฉพาะจุดใน scripts/skins-manual.css (ต่อท้ายไฟล์ที่สร้าง) ห้ามแก้ css/skins.css ตรง ๆ
 *
 * ใช้: node scripts/gen-skins-css.mjs          เขียน css/skins.css  (รัน gen-dark-css.mjs ก่อนเสมอถ้าแก้ CSS สว่าง)
 *      node scripts/gen-skins-css.mjs --check  ตรวจว่า css/skins.css ตรงกับที่สร้างได้ตอนนี้
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, parseBlocks, parseColor, parseDecls, splitTop, stripComments, toHsl } from './gen-dark-css.mjs';
import { THEMES, hexToRgb, mix, motionCss, rgbToHex, themeVars } from './skin-themes.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIN = ':where(html[data-hf-skin])';
const SKIN_DARK = ':where(html[data-hf-skin][data-theme="dark"])';
const DARK_PREFIX = ':where(html[data-theme="dark"])';

// ───────────── สีเขียวของแบรนด์ ─────────────
/** เฉดมิ้นต์/มรกต/เขียวอมฟ้า (hue 148-180) ที่มีสีจริง — เขียว "ถูกต้อง" ของ Tailwind (hue ~142) ไม่นับ */
export function isBrand(token) {
    const c = parseColor(token);
    if (!c) return false;
    const { h, s } = toHsl(c);
    return s >= 0.2 && h >= 148 && h <= 180;
}

// ไล่สีมรกตที่ Study ใช้ (ตำแหน่ง 0-10) และความสว่างของแต่ละขั้น: ใช้หาว่าสีต้นทาง "อยู่ขั้นไหน"
const EMERALD = ['#ECFDF5', '#D1FAE5', '#A7F3D0', '#6EE7B7', '#34D399', '#10B981', '#059669', '#047857', '#065F46', '#064E3B', '#022C22'];
const hslOf = (hex) => { const [r, g, b] = hexToRgb(hex); return toHsl({ r, g, b }); };
const EM = EMERALD.map(hslOf);
const lerp = (a, b, t) => a + (b - a) * t;

/** ไล่สี 11 ขั้นของธีม: 50 100 200 300 400 500 600 700 800 900 950 (300 และ 800 ขึ้นไปคำนวณจากขั้นข้างเคียง) */
function rampOf(key) {
    const R = THEMES[key].ramp;
    return [R[50], R[100], R[200], mix(R[200], R[400], 0.5), R[400], R[500], R[600], R[700], mix(R[700], '#000000', 0.22), mix(R[700], '#000000', 0.4), mix(R[700], '#000000', 0.62)];
}

function hslToRgb({ h, s, l }) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map((v) => Math.round((v + m) * 255));
}

/** สีต้นทาง (เขียวแบรนด์) → สีของธีม `key`: ขั้นเดียวกันบนไล่สี และคงความ "หม่น" ของสีต้นทาง (เช่นพื้นมืดที่ลดความสดไว้) */
export function mapBrand(rgb, key) {
    const src = toHsl({ r: rgb[0], g: rgb[1], b: rgb[2] });
    const ramp = rampOf(key);
    let out;
    let refS;
    if (src.l >= EM[0].l) { // สว่างกว่าขั้น 50: เข้าหาขาว
        out = mix(ramp[0], '#ffffff', (src.l - EM[0].l) / (1 - EM[0].l || 1));
        refS = EM[0].s;
    } else if (src.l <= EM[10].l) { // มืดกว่าขั้น 950: เข้าหาดำ
        out = mix(ramp[10], '#000000', 1 - src.l / (EM[10].l || 1));
        refS = EM[10].s;
    } else {
        let i = 0;
        while (i < 9 && src.l < EM[i + 1].l) i += 1;
        const t = (EM[i].l - src.l) / (EM[i].l - EM[i + 1].l);
        out = mix(ramp[i], ramp[i + 1], t);
        refS = lerp(EM[i].s, EM[i + 1].s, t);
    }
    const k = Math.min(1, src.s / refS);
    if (k < 0.92) {
        const o = hslOf(out);
        out = rgbToHex(hslToRgb({ h: o.h, s: o.s * k, l: o.l }));
    }
    return hexToRgb(out);
}

// ───────────── สิ่งที่ไม่เปลี่ยนสี ─────────────
// เขียวที่มีความหมาย: ตอบถูก (.is-ok .ok เฉลย *-key) ผ่าน ระดับง่าย หัวข้อที่ทำได้ดี และสีประจำวิชา/ไทล์
export const SEMANTIC = /\.is-ok(?![\w-])|\.ok(?![\w-])|\.is-miss(?![\w-])|-key(?![\w-])|\.btn-ok(?![\w-])|\.passed-now|\.rs-right|\.rs-marks|\.pk-dots|\.ct-ok|\.mt-ans|\.rv-r(?![\w-])|\.delta(?![\w-])|\.lvl-|\.hue-|\.tile-|\.pc-good|\.strong(?![\w-])|\.tf-t(?![\w-])|\.fl-fill|\.fb-i(?![\w-])/;
// หัวหน้าเว็บ: ใช้ลายของธีมทั้งผืน (เขียนด้วยมือด้านล่าง) ไม่ใช่การแทนสีทีละค่า
const BAND = /^(#mainBlueBg|\.header-bg-shell|\.flow-shell)(?![\w-])/;
// ตัวแปรที่เป็นจานสีของกราฟ/สีประจำแพลน ไม่ใช่สีแบรนด์
const SKIP_PROP = /^--(pc\d+|hf-)/;

const TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
const hex6 = (rgb) => rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** แทนสีแบรนด์ในค่าด้วยตัวแปร; คืน null ถ้าไม่มีสีแบรนด์ — `seen` เก็บสีต้นทางทุกสีที่ถูกใช้ */
function mapValue(value, seen) {
    let changed = false;
    const out = value.replace(TOKEN, (t) => {
        if (!isBrand(t)) return t;
        const c = parseColor(t);
        const name = hex6([c.r, c.g, c.b]);
        seen.set(name, [c.r, c.g, c.b]);
        changed = true;
        return c.a < 1 ? `rgb(var(--k-${name}) / ${+c.a.toFixed(3)})` : `rgb(var(--k-${name}))`;
    });
    return changed ? out : null;
}

function skinSelector(sel, prefix) {
    const s = sel.trim();
    if (s === 'html' || s === ':root') return prefix;
    if (/^html[.\[:#]/.test(s)) return prefix + s.slice(4);
    if (/^:root[.\[:#]/.test(s)) return prefix + s.slice(5);
    return `${prefix} ${s}`;
}

/** ตัวเลือกของกฎมืด → ตัวเลือกเดิม (ไม่มีส่วนนำ) หรือ null ถ้าไม่ใช่กฎของธีมมืด */
function darkBase(sel) {
    const s = sel.trim();
    if (s.startsWith(DARK_PREFIX)) return s.slice(DARK_PREFIX.length).trim() || ':root';
    if (s.startsWith('html[data-theme="dark"]')) return s.slice('html[data-theme="dark"]'.length).trim() || ':root';
    return null;
}

/**
 * @param {'light'|'dark'} mode
 * @param {Map} seen สีต้นทางที่ถูกใช้
 * @param {Set} lightKeys "ตัวเลือก|property" ที่กฎสว่างของธีมตั้งไว้ (กฎมืดของคู่เดียวกันต้องถูกย้ำ ไม่งั้นค่ามืดเดิมจะถูกทับ)
 * @param {Map} frames ชื่อ keyframes ที่มีสีแบรนด์ → ชื่อใหม่
 */
function emit(nodes, mode, seen, lightKeys, frames, indent = '') {
    const lines = [];
    for (const node of nodes) {
        if (node.type === 'rule') {
            const decls = parseDecls(node.body);
            for (const rawSel of splitTop(node.selector, ',').map((x) => x.trim())) {
                const base = mode === 'dark' ? darkBase(rawSel) : rawSel;
                if (base === null || SEMANTIC.test(base) || BAND.test(base)) continue;
                const out = [];
                for (const { prop, value } of decls) {
                    if (SKIP_PROP.test(prop)) continue;
                    const key = `${base}|${prop}`;
                    let next = mapValue(value, seen);
                    // แอนิเมชันที่ keyframes มีสีแบรนด์: ชี้ไปที่ชุดของธีม
                    if (!next && /^animation(-name)?$/.test(prop)) {
                        const swapped = value.replace(/[A-Za-z_][\w-]*/g, (w) => frames.get(w) || w);
                        if (swapped !== value) next = swapped;
                    }
                    if (next) { out.push(`${prop}: ${next};`); if (mode === 'light') lightKeys.add(key); } else if (mode === 'dark' && lightKeys.has(key)) out.push(`${prop}: ${value};`);
                }
                if (!out.length) continue;
                const sel = skinSelector(base, mode === 'dark' ? SKIN_DARK : SKIN);
                lines.push(`${indent}${sel} { ${out.join(' ')} }`);
            }
        } else if (node.type === 'at' && node.children && (node.name === 'media' || node.name === 'supports')) {
            const inner = emit(node.children, mode, seen, lightKeys, frames, indent + '  ');
            if (inner.length) lines.push(`${indent}${node.prelude} {\n${inner.join('\n')}\n${indent}}`);
        }
    }
    return lines;
}

/** keyframes ที่มีสีแบรนด์ → สำเนาชื่อ sk-<เดิม> ที่ใช้ตัวแปรของธีม */
function collectFrames(nodes, seen, frames, out) {
    for (const node of nodes) {
        if (node.type === 'at' && node.name === 'keyframes') {
            const name = node.prelude.replace(/^@keyframes\s+/i, '').trim();
            const body = mapValue(node.body, seen);
            if (body && !frames.has(name)) { frames.set(name, `sk-${name}`); out.push(`@keyframes sk-${name} {${body.replace(/\s+/g, ' ')}}`); }
        } else if (node.children) collectFrames(node.children, seen, frames, out);
    }
}

export function generateSkinsCss(rootDir = root) {
    const read = (file) => stripComments(fs.readFileSync(path.join(rootDir, 'css', file), 'utf8'));
    const trees = SOURCES.map((file) => [file, parseBlocks(read(file))]);
    const darkTree = parseBlocks(read('dark.css'));
    const seen = new Map();
    const lightKeys = new Set();
    const frames = new Map();
    const frameCss = [];
    for (const [, tree] of trees) collectFrames(tree, seen, frames, frameCss);
    const light = trees.map(([file, tree]) => `/* ── จาก css/${file} ── */\n${emit(tree, 'light', seen, lightKeys, frames).join('\n')}`);
    const dark = emit(darkTree, 'dark', seen, lightKeys, frames);
    const names = [...seen.keys()].sort();
    const keys = Object.keys(THEMES);

    const themeBlocks = keys.map((key) => {
        const t = THEMES[key];
        return `/* ${t.title.split('\n')[0]} */
html[data-hf-skin="${key}"] {
${themeVars(key).map((l) => '  ' + l).join('\n')}
${names.map((n) => `  --k-${n}: ${mapBrand(seen.get(n), key).join(' ')};`).join('\n')}
}`;
    }).join('\n\n');

    const band = (key) => `html[data-hf-skin="${key}"] #mainBlueBg`;
    const manual = fs.readFileSync(path.join(rootDir, 'scripts', 'skins-manual.css'), 'utf8');
    return `/* css/skins.css — ธีมรางวัลของ HEADFACE บน Study (สร้างอัตโนมัติ ห้ามแก้ตรงนี้)
   แหล่งที่มา: css/*.css + css/dark.css (สีเขียวของแบรนด์ถูกแทนด้วยตัวแปรของธีมโดย scripts/gen-skins-css.mjs)
   + scripts/skin-themes.mjs (สีและลายของแต่ละธีม ชุดเดียวกับเว็บหลัก) + scripts/skins-manual.css (ปรับเฉพาะจุด)
   สร้างใหม่: node scripts/gen-skins-css.mjs   ·   ใช้เฉพาะเมื่อ <html data-hf-skin="..."> (js/theme.js ตั้งค่านี้ก่อนวาดหน้า)
   ไม่มี attribute = หน้าตาปกติของ Study ทุกจุด */

/* ══════════ 1. สีและลายของแต่ละธีม (--sk-* เหมือนเว็บหลัก, --k-xxxxxx = สีที่ใช้แทนสีเขียว #xxxxxx ของ Study) ══════════ */
${themeBlocks}

/* ══════════ 2. หัวหน้าเว็บ: ลายของธีม (ขนาดคงที่เป็น px ยึดกับขอบบน/ล่าง: หัวยืดหดได้โดยไม่ต้องวาดลายใหม่ทุกเฟรม) ══════════ */
html[data-hf-skin] #mainBlueBg, html[data-hf-skin] .header-bg-shell { background: var(--sk-band); }
html[data-hf-skin][data-theme="dark"] #mainBlueBg, html[data-hf-skin][data-theme="dark"] .header-bg-shell { background: var(--sk-band-dark); }
html[data-hf-skin] .flow-shell { background: var(--sk-base); }
html[data-hf-skin][data-theme="dark"] .flow-shell { background: var(--sk-base-dark); }

${motionCss({ band })}
/* ══════════ 3. แอนิเมชันที่มีสีเขียวของแบรนด์ (สำเนาที่ใช้สีของธีม) ══════════ */
${frameCss.join('\n')}

/* ══════════ 4. สีเขียวของแบรนด์ → สีของธีม (ธีมสว่างและสีที่ใช้ทั้งสองโหมด) ══════════ */
${light.join('\n\n')}

/* ══════════ 5. เช่นเดียวกัน สำหรับธีมมืด (จาก css/dark.css) ══════════ */
${dark.join('\n')}

/* ══════════ 6. จาก scripts/skins-manual.css ══════════ */
${manual.trim()}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const out = path.join(root, 'css', 'skins.css');
    const text = generateSkinsCss();
    if (process.argv.includes('--check')) {
        const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
        if (current.replace(/\r\n/g, '\n') !== text) { console.error('css/skins.css ไม่ตรงกับที่สร้างได้: รัน node scripts/gen-skins-css.mjs'); process.exit(1); }
        console.log('css/skins.css ตรงกับที่สร้างได้');
    } else {
        fs.writeFileSync(out, text);
        console.log(`เขียน css/skins.css (${text.split('\n').length} บรรทัด, ${Math.round(text.length / 1024)} KB)`);
    }
}
