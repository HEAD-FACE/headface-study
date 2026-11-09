#!/usr/bin/env node
/**
 * scripts/gen-dark-css.mjs — สร้าง css/dark.css (ธีมมืดของ HEADFACE Study) จาก CSS สว่างที่เขียนไว้แล้ว
 *
 * ทำไมสร้างด้วยโปรแกรม: CSS ของ Study เขียนสีเป็นเลขฐานสิบหกตรง ๆ หลายร้อยจุด การไล่แก้ทีละจุดจะตกหล่นและเพี้ยนเมื่อมีคนเพิ่มสีใหม่
 * วิธีทำ: อ่านทุกกฎใน css/*.css (ยกเว้น dark.css) แล้วสำหรับแต่ละ declaration ที่มีสี สร้างกฎคู่ที่ขึ้นต้นด้วย
 *   html[data-theme="dark"] ...   (ใช้เฉพาะตอนธีมมืด; ตอนสว่างไม่มีอะไรเปลี่ยน)
 * โดยแปลงสีตาม "บทบาท" ของ property: พื้นหลัง (ทำให้มืด คงเฉดสี) / ตัวอักษร (ทำให้สว่าง) / เส้นขอบและเงาขอบ (มืดกว่าพื้นเล็กน้อย)
 * สีเด่นกลาง ๆ (ปุ่มเขียว แถบสี สถานะ) ไม่ถูกแตะ เพราะอ่านได้ทั้งสองธีม
 * แก้ไขรายละเอียดเฉพาะจุดใน scripts/dark-manual.css (ถูกต่อท้ายไฟล์ที่สร้าง) ห้ามแก้ css/dark.css ตรง ๆ
 *
 * ใช้: node scripts/gen-dark-css.mjs          เขียน css/dark.css
 *      node scripts/gen-dark-css.mjs --check  ตรวจว่า css/dark.css ตรงกับที่สร้างได้ตอนนี้ (เทสต์เรียกใช้ฟังก์ชัน generateDarkCss ด้วย)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// :where() = ไม่เพิ่มน้ำหนักตัวเลือก: กฎมืดมีน้ำหนักเท่ากฎสว่างเดิมของตัวเอง และอยู่หลังสุด จึงชนะเฉพาะกฎสว่างที่เป็นตัวเลือกเดียวกันหรือเบากว่า
// (กฎสว่างที่เจาะจงกว่า เช่น .tt-b.tt-mic ยังชนะกฎพื้นฐาน .tt-b แบบเดียวกับตอนสว่าง)
const DARK = ':where(html[data-theme="dark"])';

// ───────────── สี ─────────────
function parseColor(token) {
    let m = /^#([0-9a-f]{3,8})$/i.exec(token);
    if (m) {
        let h = m[1];
        if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
        if (h.length !== 6 && h.length !== 8) return null;
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1, kind: 'hex' };
    }
    m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(token);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4], kind: 'rgb' };
    return null;
}

function toHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return { h: 0, s: 0, l };
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h * 60, s, l };
}

function fromHsl({ h, s, l }) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let rgb;
    if (h < 60) rgb = [c, x, 0];
    else if (h < 120) rgb = [x, c, 0];
    else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c];
    else if (h < 300) rgb = [x, 0, c];
    else rgb = [c, 0, x];
    return rgb.map((v) => Math.round((v + m) * 255));
}

const hex2 = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
function format(rgb, a, kind) {
    if (a < 1 || kind === 'rgb') return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${+a.toFixed(3)})`;
    return `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`.toUpperCase();
}

const isSlate = ({ h, s }) => s < 0.08 || (s < 0.6 && h >= 190 && h <= 250);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// สีที่ต้องการค่าเฉพาะ (พื้นหน้าเว็บ)
const PAGE_BG = { '#EEF4F8': '#0B1220', '#EEF2F6': '#0F1727' };

function lerp(points, x) {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i += 1) {
        if (x <= points[i][0]) {
            const [x0, y0] = points[i - 1];
            const [x1, y1] = points[i];
            return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
        }
    }
    return points[points.length - 1][1];
}

const TEXT_ANCHORS = [[0, 0.97], [0.09, 0.96], [0.17, 0.92], [0.27, 0.84], [0.35, 0.77], [0.47, 0.68], [0.6, 0.64]];

/** @param {'bg'|'text'|'border'|'edge'} role */
export function mapColor(token, role) {
    const c = parseColor(token);
    if (!c) return token;
    const hsl = toHsl(c);
    const upper = token.toUpperCase();
    if (role === 'bg') {
        if (c.kind === 'hex' && PAGE_BG[upper] && c.a === 1) return PAGE_BG[upper];
        if (c.kind === 'rgb' && c.r === 238 && c.g === 244 && c.b === 248) return format([11, 18, 32], c.a, 'rgb');
        if (hsl.l < 0.72) return token;
        // ฟิล์มขาวโปร่งแสง (เงาแวบ ฉากเรืองแสง) ไม่ใช่พื้นของการ์ด: คงไว้ ใช้ได้ทั้งสองธีม
        if (c.r >= 235 && c.g >= 235 && c.b >= 235 && c.a <= 0.65) return token;
        const slate = isSlate(hsl);
        const l = 0.15 + (1 - hsl.l) * 0.5;
        const out = slate ? fromHsl({ h: 217, s: 0.32, l }) : fromHsl({ h: hsl.h, s: hsl.s * 0.55, l });
        return format(out, c.a, c.kind);
    }
    if (role === 'text') {
        if (hsl.l > 0.75) return token;
        if (isSlate(hsl)) {
            if (hsl.l > 0.6) return token;
            return format(fromHsl({ h: 215, s: Math.min(hsl.s, 0.3), l: lerp(TEXT_ANCHORS, hsl.l) }), c.a, c.kind);
        }
        if (hsl.l > 0.5) return token;
        const l = Math.max(hsl.l, 0.93 - hsl.l * 0.9);
        return format(fromHsl({ h: hsl.h, s: clamp(hsl.s * 0.85, 0, 1), l }), c.a, c.kind);
    }
    // border / edge (เงาขอบหนาแบบปุ่มเกม)
    if (c.r >= 235 && c.g >= 235 && c.b >= 235 && c.a < 1) return role === 'edge' ? token : 'rgba(255, 255, 255, 0.1)';
    if (hsl.l < (role === 'edge' ? 0.75 : 0.62)) return token;
    const l = 0.34 - (hsl.l - 0.62) * (isSlate(hsl) ? 0.4 : 0.45);
    const out = isSlate(hsl) ? fromHsl({ h: 217, s: 0.3, l }) : fromHsl({ h: hsl.h, s: hsl.s * 0.5, l });
    return format(out, c.a, c.kind);
}

const COLOR_TOKEN = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;
// สีสำรองใน var(--x, #hex) ไม่แปลง: ตัวแปรถูกตั้งค่าไว้เสมอ (และการแปลงจะทำให้กฎถูกสร้างซ้ำโดยไม่จำเป็นจนทับกฎอื่นที่ควรชนะ)
const mapValue = (value, role) => value.replace(COLOR_TOKEN, (t, offset) => (/var\(\s*--[\w-]+\s*,\s*$/.test(value.slice(0, offset)) ? t : mapColor(t, role)));

// ───────────── บทบาทของ property ─────────────
function roleOf(prop) {
    const p = prop.toLowerCase();
    if (p.startsWith('--')) {
        if (/^--(bg|chip|skl-a|skl-b)$/.test(p)) return 'bg';
        if (/^--(bd|edge)$/.test(p)) return 'border';
        return null;
    }
    if (/^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color)$/.test(p)) return 'text';
    if (/^background(-color|-image)?$/.test(p)) return 'bg';
    if (p === 'box-shadow') return 'edge';
    if (/^(border|outline)(-[a-z]+)*(-color)?$/.test(p) || p === 'column-rule') return 'border';
    return null;
}

// ───────────── ตัวอ่าน CSS แบบย่อ ─────────────
function stripComments(css) {
    let out = '';
    for (let i = 0; i < css.length; i += 1) {
        const ch = css[i];
        if (ch === '"' || ch === "'") {
            const q = ch;
            out += ch;
            i += 1;
            while (i < css.length && css[i] !== q) { if (css[i] === '\\') { out += css[i]; i += 1; } out += css[i]; i += 1; }
            out += q;
        } else if (ch === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            i = end < 0 ? css.length : end + 1;
        } else out += ch;
    }
    return out;
}

/** ตัด string ตามตัวคั่นเฉพาะที่ระดับนอกสุด (ไม่ตัดในวงเล็บ/เครื่องหมายคำพูด) */
function splitTop(text, sep) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let cur = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quote) { cur += ch; if (ch === '\\') { cur += text[i + 1] ?? ''; i += 1; } else if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth += 1;
        if (ch === ')' || ch === ']') depth -= 1;
        if (ch === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) parts.push(cur);
    return parts;
}

/** อ่านเป็นต้นไม้: { type: 'rule', selector, body } | { type: 'at', prelude, children?, body? } */
function parseBlocks(css) {
    const nodes = [];
    let i = 0;
    const n = css.length;
    while (i < n) {
        while (i < n && /\s/.test(css[i])) i += 1;
        if (i >= n) break;
        // อ่าน prelude จนเจอ { หรือ ;
        let start = i;
        let depth = 0;
        let quote = null;
        while (i < n) {
            const ch = css[i];
            if (quote) { if (ch === '\\') i += 1; else if (ch === quote) quote = null; i += 1; continue; }
            if (ch === '"' || ch === "'") { quote = ch; i += 1; continue; }
            if (ch === '(' || ch === '[') depth += 1;
            if (ch === ')' || ch === ']') depth -= 1;
            if (depth === 0 && (ch === '{' || ch === ';')) break;
            i += 1;
        }
        const prelude = css.slice(start, i).trim();
        if (i >= n) break;
        if (css[i] === ';') { nodes.push({ type: 'statement', prelude }); i += 1; continue; }
        // { ... } จับคู่
        i += 1;
        const bodyStart = i;
        depth = 1;
        quote = null;
        while (i < n && depth > 0) {
            const ch = css[i];
            if (quote) { if (ch === '\\') i += 1; else if (ch === quote) quote = null; i += 1; continue; }
            if (ch === '"' || ch === "'") { quote = ch; i += 1; continue; }
            if (ch === '(') {
                // ข้ามเนื้อใน url(...)/วงเล็บทั้งก้อน เพราะอาจมี { } ใน data URI
                let d = 1; i += 1;
                while (i < n && d > 0) { if (css[i] === '(') d += 1; else if (css[i] === ')') d -= 1; i += 1; }
                continue;
            }
            if (ch === '{') depth += 1;
            if (ch === '}') depth -= 1;
            i += 1;
        }
        const body = css.slice(bodyStart, i - 1);
        if (prelude.startsWith('@')) {
            const name = /^@([a-z-]+)/i.exec(prelude)?.[1]?.toLowerCase();
            if (name === 'media' || name === 'supports' || name === 'layer') nodes.push({ type: 'at', name, prelude, children: parseBlocks(body) });
            else nodes.push({ type: 'at', name, prelude, body });
        } else nodes.push({ type: 'rule', selector: prelude, body });
    }
    return nodes;
}

function parseDecls(body) {
    return splitTop(body, ';').map((d) => d.trim()).filter(Boolean).map((d) => {
        const idx = d.indexOf(':');
        if (idx < 0) return null;
        return { prop: d.slice(0, idx).trim(), value: d.slice(idx + 1).trim() };
    }).filter(Boolean);
}

function prefixSelector(sel) {
    const s = sel.trim();
    if (s === 'html' || s === ':root') return DARK;
    if (/^html[.\[:#]/.test(s)) return DARK + s.slice(4);
    if (/^:root[.\[:#]/.test(s)) return DARK + s.slice(5);
    return `${DARK} ${s}`;
}

const TEXT_VARS = [['--strong', '--strong-t'], ['--bar', '--bar-t']];

function darkDecls(decls) {
    const out = [];
    for (const { prop, value } of decls) {
        // สีหัวข้อของแต่ละ hue: เก็บ --strong/--bar เดิมไว้ใช้เป็นพื้นปุ่ม แล้วเพิ่มรุ่นสว่างไว้ใช้เป็นตัวอักษร (color: var(--strong-t))
        const pair = TEXT_VARS.find(([from]) => from === prop);
        if (pair) {
            const lit = mapColor(value.trim(), 'text');
            if (lit !== value.trim()) out.push(`${pair[1]}: ${lit};`);
            continue;
        }
        const role = roleOf(prop);
        if (!role) continue;
        let next = mapValue(value, role);
        if (prop === 'color') {
            for (const [from, to] of TEXT_VARS) next = next.split(`var(${from})`).join(`var(${to}, var(${from}))`);
        }
        if (next !== value) out.push(`${prop}: ${next};`);
    }
    return out;
}

// กฎของหัวเขียว (ตัวขาวบนพื้นเขียว/สี) ไม่แปลง: ใช้ได้ทั้งสองธีมอยู่แล้ว
const KEEP_AS_IS = /^(.hdr|.chd|.cp-head|.header-bg-shell|#mainBlueBg|.flow-shell|.profile-btn|.profile-wrap)(?![a-z0-9_-])/i;

function emit(nodes, indent = '') {
    const lines = [];
    for (const node of nodes) {
        if (node.type === 'rule') {
            const sels = splitTop(node.selector, ',').map((x) => x.trim());
            if (sels.every((x) => KEEP_AS_IS.test(x))) continue;
            const decls = darkDecls(parseDecls(node.body));
            if (!decls.length) continue;
            const selectors = splitTop(node.selector, ',').map(prefixSelector).join(',\n' + indent);
            lines.push(`${indent}${selectors} {\n${decls.map((d) => `${indent}  ${d}`).join('\n')}\n${indent}}`);
        } else if (node.type === 'at' && node.children && (node.name === 'media' || node.name === 'supports')) {
            // ข้ามค่าที่ไม่ใช่การแสดงผล (print / reduced-motion ไม่มีสี แต่ถ้ามีจะถูกแปลงให้ด้วย)
            const inner = emit(node.children, indent + '  ');
            if (inner.length) lines.push(`${indent}${node.prelude} {\n${inner.join('\n')}\n${indent}}`);
        }
        // @keyframes / @font-face / @property / @import: ไม่แปลง (keyframes ไม่มีสีที่ต้องกลับด้าน)
    }
    return lines;
}

export const SOURCES = ['style.css', 'course.css', 'delight.css', 'flow.css', 'formats.css', 'fx.css', 'identity.css', 'settings.css', 'loading.css', 'ranking.css', 'tutor.css'];

export function generateDarkCss(rootDir = root) {
    const parts = [];
    for (const file of SOURCES) {
        const css = stripComments(fs.readFileSync(path.join(rootDir, 'css', file), 'utf8'));
        const rules = emit(parseBlocks(css));
        parts.push(`/* ── จาก css/${file} ── */\n${rules.join('\n')}`);
    }
    const manual = fs.readFileSync(path.join(rootDir, 'scripts', 'dark-manual.css'), 'utf8');
    return `/* css/dark.css — ธีมมืดของ HEADFACE Study (สร้างอัตโนมัติ ห้ามแก้ตรงนี้)
   แหล่งที่มา: css/*.css (สีถูกแปลงด้วย scripts/gen-dark-css.mjs) + scripts/dark-manual.css (ปรับเฉพาะจุด)
   สร้างใหม่: node scripts/gen-dark-css.mjs   ·   ใช้เฉพาะเมื่อ <html data-theme="dark"> (js/theme.js ตั้งค่านี้ก่อนวาดหน้า) */

${parts.join('\n\n')}

/* ── จาก scripts/dark-manual.css ── */
${manual.trim()}
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const out = path.join(root, 'css', 'dark.css');
    const text = generateDarkCss();
    if (process.argv.includes('--check')) {
        const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
        if (current.replace(/\r\n/g, '\n') !== text) { console.error('css/dark.css ไม่ตรงกับที่สร้างได้: รัน node scripts/gen-dark-css.mjs'); process.exit(1); }
        console.log('css/dark.css ตรงกับที่สร้างได้');
    } else {
        fs.writeFileSync(out, text);
        console.log(`เขียน css/dark.css (${text.split('\n').length} บรรทัด)`);
    }
}
