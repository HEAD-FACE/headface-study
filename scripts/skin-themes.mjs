// The themes as data: colours, art (readable SVG, encoded for CSS) and the tokens derived from them.
// Used by gen-skins-css.mjs (this site) and, for the main site, by hand / a one-off script (headface/css/skins.css parts 1 and 4) so
// both sites wear the same tone (test/skins.test.mjs checks that the colours agree).

export const enc = (svg) => `url("data:image/svg+xml,${svg.replace(/\s+/g, ' ').replace(/> </g, '><').trim()
  .replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'").replace(/\{/g, '%7B').replace(/\}/g, '%7D')}")`;
const r = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- colour helpers
export const hexToRgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
export const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
export const triple = (hex) => hexToRgb(hex).join(' ');
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
export const luminance = (hex) => { const [R, G, B] = hexToRgb(hex).map(lin); return 0.2126 * R + 0.7152 * G + 0.0722 * B; };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** `hex` made darker (towards black) until it reads on `on` at `min`:1. */
export function readable(hex, on, min = 4.5, towards = '#000000') {
  let out = hex;
  for (let i = 0; i < 40 && contrast(out, on) < min; i += 1) out = mix(out, towards, 0.05);
  return out;
}

// ---------------------------------------------------------------- art
const stars = (w, h, list, fill = '#fff') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${list.map(([x, y, rr, o]) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="${fill}" fill-opacity="${o}"/>`).join('')}</svg>`;
const sparkle = (x, y, s) => `<path d="M${x} ${r(y - 3 * s)}L${r(x + .7 * s)} ${r(y - .7 * s)}L${r(x + 3 * s)} ${y}L${r(x + .7 * s)} ${r(y + .7 * s)}L${x} ${r(y + 3 * s)}L${r(x - .7 * s)} ${r(y + .7 * s)}L${r(x - 3 * s)} ${y}L${r(x - .7 * s)} ${r(y - .7 * s)}Z" fill="#fff"/>`;

const wave = (two) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 60" preserveAspectRatio="none"><path d="M0 36C150 18 300 18 450 36S750 56 900 36 1100 18 1200 28" fill="none" stroke="#fff" stroke-opacity="${two ? '.2' : '.1'}" stroke-width="2"/>${two ? '<path d="M0 47C200 30 350 33 500 45S800 59 1000 45 1150 37 1200 41" fill="none" stroke="#fff" stroke-opacity=".11" stroke-width="2"/>' : ''}</svg>`;

const auroraStars = stars(260, 130, [[12, 18, .9, .7], [48, 62, .6, .45], [83, 24, 1.1, .8], [120, 90, .7, .5], [150, 40, .8, .6], [188, 14, .6, .45], [212, 70, 1, .7], [240, 108, .7, .45], [30, 104, .8, .55], [100, 120, .5, .4], [170, 100, .6, .45], [250, 36, .5, .4]]);
const auroraSparkles = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 180">${sparkle(40, 30, 1.3)}${sparkle(210, 22, 1)}${sparkle(320, 64, 1.5)}${sparkle(130, 120, .9)}${sparkle(270, 150, 1.1)}<circle cx="96" cy="58" r="1.2" fill="#fff"/><circle cx="356" cy="132" r="1" fill="#fff"/><circle cx="18" cy="150" r=".9" fill="#fff"/></svg>`;
// A soft ribbon WITHOUT a blur filter (a filter is the slow part of drawing): the same curve stroked several times, wide and faint to
// narrow, so the middle is bright and the edges fade.
const soft = (d, width, peak) => [1, .82, .66, .5, .36, .24, .13].map((k) => `<path stroke-width="${r(width * k)}" stroke-opacity="${peak}" d="${d}"/>`).join('');
const ribbons = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 250" preserveAspectRatio="none">
<defs><linearGradient id="a" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#7cf2d4" stop-opacity="0"/><stop offset=".2" stop-color="#7cf2d4"/><stop offset=".55" stop-color="#a99bff"/><stop offset=".82" stop-color="#ff9fd8"/><stop offset="1" stop-color="#ff9fd8" stop-opacity="0"/></linearGradient></defs>
<g fill="none" stroke="url(#a)" stroke-linecap="round">
${soft('M-50 206C200 152 420 238 700 192S1150 150 1650 202', 62, .1)}
${soft('M-50 112C260 52 520 150 820 96S1300 32 1650 102', 48, .065)}
<path stroke-width="3" stroke-opacity=".5" d="M-50 200C210 150 425 230 700 188S1150 150 1650 198"/>
</g></svg>`;

const fan = (mirror) => {
  const cx = mirror ? 0 : 420, cy = 260;
  const arcs = [[70, .5], [110, .38], [150, .3], [190, .22], [230, .15]].map(([rr, o]) => `<circle cx="${cx}" cy="${cy}" r="${rr}" stroke-opacity="${o}"/>`).join('');
  const rays = [];
  for (let a = 0; a <= 90; a += 9) {
    const rad = (a * Math.PI) / 180;
    const dx = Math.cos(rad) * (mirror ? 1 : -1), dy = -Math.sin(rad);
    rays.push(`<path stroke-opacity=".16" d="M${r(cx + dx * 70)} ${r(cy + dy * 70)}L${r(cx + dx * 230)} ${r(cy + dy * 230)}"/>`);
  }
  const gems = [[150, 45], [190, 27], [110, 63]].map(([rr, a]) => {
    const rad = (a * Math.PI) / 180;
    const x = r(cx + Math.cos(rad) * rr * (mirror ? 1 : -1)), y = r(cy - Math.sin(rad) * rr);
    return `<path fill="#e7c97e" fill-opacity=".7" stroke="none" d="M${x} ${r(y - 3)}L${r(x + 3)} ${y}L${x} ${r(y + 3)}L${r(x - 3)} ${y}Z"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260"><g fill="none" stroke="#e7c97e" stroke-width="1.2">${arcs}${rays.join('')}</g>${gems}</svg>`;
};
const goldDust = stars(300, 160, [[14, 20, 1.2, .7], [62, 88, .8, .5], [110, 30, 1.5, .55], [150, 130, .9, .6], [196, 64, 1.1, .45], [240, 18, .7, .5], [276, 110, 1.3, .6], [40, 146, .7, .4], [222, 150, .6, .45], [90, 140, 1, .35], [130, 74, .6, .5], [290, 58, .8, .4]], '#f3d98f');

// neon (night city, redrawn 18 Nov 2026): ONE wide picture (2400 x 150, never tiled, so no block repeats on a wide screen): a far
// skyline in violet haze, a near skyline in ink with a few warm / cyan / pink windows and two thin neon roof lines, a horizon that
// glows, and a fine floor grid that fades towards the horizon. What moves is light only: car light trails gliding along the horizon
// (one strip, translateX, seamless) and a slow twinkle of the sky (opacity, eased: no hard flicker).
const seeded = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const NEON_W = 2400, NEON_H = 150, HORIZON = 118;
/** A skyline as one path: towers of random width / height, some with a setback top or a mast. Returns { d, towers }. */
function skyline(rand, { minW, maxW, minH, maxH, gap, masts }) {
  let x = -10;
  const parts = [];
  const towers = [];
  while (x < NEON_W + 10) {
    const w = Math.round(minW + rand() * (maxW - minW));
    const h = Math.round(minH + rand() * (maxH - minH));
    const top = HORIZON - h;
    let d = `M${x} ${HORIZON}V${top}`;
    if (rand() < 0.3 && w > 26) { // a setback: a narrower crown
      const inset = Math.round(w * (0.18 + rand() * 0.14));
      const crown = Math.round(8 + rand() * 16);
      d += `H${x + inset}V${top - crown}H${x + w - inset}V${top}`;
      towers.push({ x, w, top: top - crown, inset });
    } else {
      towers.push({ x, w, top, inset: 0 });
    }
    d += `H${x + w}V${HORIZON}Z`;
    if (masts && rand() < 0.18) {
      const mx = x + Math.round(w / 2);
      const t = towers[towers.length - 1].top;
      d += `M${mx - .6} ${t}V${t - 10 - Math.round(rand() * 10)}H${mx + .6}V${t}Z`;
    }
    parts.push(d);
    x += w + Math.round(rand() * gap);
  }
  return { d: parts.join(''), towers };
}
const neonCity = (() => {
  const rand = seeded(20261118);
  const far = skyline(rand, { minW: 22, maxW: 58, minH: 34, maxH: 96, gap: 4, masts: true });
  const near = skyline(rand, { minW: 30, maxW: 84, minH: 16, maxH: 62, gap: 10, masts: false });
  // windows on the near skyline: a few lit ones in three colours, now and then a whole floor lit (an office working late)
  const lit = { warm: [], cyan: [], pink: [] };
  for (const t of near.towers) {
    for (let y = t.top + 6; y < HORIZON - 6; y += 6) {
      const floor = rand() < 0.05 && t.w > 30;
      for (let x = t.x + 4; x < t.x + t.w - 4; x += 5) {
        if (!floor && rand() > 0.1) continue;
        const k = floor ? 0 : rand();
        (k < 0.62 ? lit.warm : k < 0.86 ? lit.cyan : lit.pink).push(`M${x} ${y}h1.6v2.2h-1.6z`);
      }
    }
  }
  // a thin neon line on a few near roofs
  const roofs = near.towers.filter((_, i) => i % 7 === 3).map((t) => `M${t.x + t.inset + 3} ${t.top + .6}H${t.x + t.w - t.inset - 3}`).join('');
  const roofs2 = near.towers.filter((_, i) => i % 11 === 6).map((t) => `M${t.x + t.inset + 3} ${t.top + .6}H${t.x + t.w - t.inset - 3}`).join('');
  // the floor grid: rows closer together towards the horizon, columns running to a vanishing point in the middle
  const rows = [121, 124.5, 129, 135, 142.5, 150].map((y) => `M0 ${y}H${NEON_W}`).join('');
  const cols = [];
  for (let k = -30; k <= 30; k += 1) {
    const xb = NEON_W / 2 + k * 90;
    const xt = NEON_W / 2 + (xb - NEON_W / 2) * 0.18;
    cols.push(`M${r(xt)} ${HORIZON}L${xb} ${NEON_H}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${NEON_W} ${NEON_H}">
<defs>
<linearGradient id="h" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff3fc8" stop-opacity="0"/><stop offset=".55" stop-color="#ff3fc8" stop-opacity=".1"/><stop offset=".79" stop-color="#ff3fc8" stop-opacity=".34"/><stop offset=".79" stop-color="#0b0522" stop-opacity="1"/><stop offset="1" stop-color="#05020f" stop-opacity="1"/></linearGradient>
<linearGradient id="f" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="${HORIZON}"><stop offset=".1" stop-color="#5a2aa8" stop-opacity=".38"/><stop offset="1" stop-color="#2a1262" stop-opacity=".88"/></linearGradient>
<linearGradient id="z" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="40" y2="${HORIZON}"><stop offset="0" stop-color="#ff3fc8" stop-opacity="0"/><stop offset="1" stop-color="#ff3fc8" stop-opacity=".2"/></linearGradient>
<linearGradient id="n" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="50" y2="${HORIZON}"><stop offset="0" stop-color="#171037"/><stop offset="1" stop-color="#07041b"/></linearGradient>
<pattern id="w" width="5" height="6" patternUnits="userSpaceOnUse"><rect x="1.7" y="2" width="1.6" height="2.2" fill="#d9ccff" fill-opacity=".1"/></pattern>
<pattern id="v" width="4" height="5" patternUnits="userSpaceOnUse"><rect x="1.4" y="1.6" width="1.2" height="1.8" fill="#e6dcff" fill-opacity=".055"/></pattern>
<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${HORIZON}" y2="${NEON_H}"><stop offset="0" stop-color="#5ff0ff" stop-opacity=".05"/><stop offset="1" stop-color="#5ff0ff" stop-opacity=".42"/></linearGradient>
</defs>
<rect width="${NEON_W}" height="${NEON_H}" fill="url(#h)"/>
<path fill="url(#f)" d="${far.d}"/>
<path fill="url(#v)" d="${far.d}"/>
<rect y="40" width="${NEON_W}" height="${HORIZON - 40}" fill="url(#z)"/>
<path fill="url(#n)" stroke="#ff7ae0" stroke-opacity=".2" stroke-width="1" d="${near.d}"/>
<path fill="url(#w)" d="${near.d}"/>
<path fill="#ffd9a8" fill-opacity=".72" d="${lit.warm.join('')}"/>
<path fill="#8ff6ff" fill-opacity=".7" d="${lit.cyan.join('')}"/>
<path fill="#ffa6ea" fill-opacity=".7" d="${lit.pink.join('')}"/>
<g fill="none" stroke-width="1.2"><path stroke="#5ff0ff" stroke-opacity=".85" d="${roofs}"/><path stroke="#ff6fdc" stroke-opacity=".85" d="${roofs2}"/></g>
<g fill="none" stroke="url(#g)" stroke-width="1"><path d="${rows}"/><path d="${cols.join('')}"/></g>
<g fill="none" stroke="#ff4fd8"><path stroke-width="7" stroke-opacity=".08" d="M0 ${HORIZON}H${NEON_W}"/><path stroke-width="3.5" stroke-opacity=".16" d="M0 ${HORIZON}H${NEON_W}"/><path stroke-width="1.2" stroke-opacity=".9" stroke="#ff8ae6" d="M0 ${HORIZON}H${NEON_W}"/></g>
</svg>`;
})();
// light trails along the horizon: a 900 x 12 strip that repeats sideways and glides (one tile per loop: seamless)
const neonTrail = (x, len, y, color, w, o) => `<linearGradient id="t${x}" x1="0" x2="1"><stop offset="0" stop-color="${color}" stop-opacity="0"/><stop offset=".85" stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="#ffffff" stop-opacity="${o}"/></linearGradient><path stroke="url(#t${x})" stroke-width="${w}" stroke-linecap="round" d="M${x} ${y}H${x + len}"/>`;
const neonTrails = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 12"><g fill="none">${neonTrail(40, 170, 4, '#5ff0ff', 1.6, .95)}${neonTrail(380, 120, 8, '#ff6fdc', 1.4, .85)}${neonTrail(640, 70, 5.5, '#ffd9a8', 1.1, .8)}</g></svg>`;
// the sky: a few stars, a little brighter now and then (the whole layer breathes, eased)
const neonStars = stars(320, 120, [[18, 14, .8, .7], [70, 52, .55, .45], [126, 22, 1, .8], [172, 76, .6, .45], [214, 10, .7, .6], [262, 44, .9, .7], [300, 92, .55, .4], [40, 96, .6, .45], [150, 104, .5, .35], [236, 112, .5, .35], [96, 6, .5, .5], [292, 18, .6, .5]], '#e9e4ff');

// ---------------------------------------------------------------- the themes
// ramp: 50 100 200 400 500 600 700 (600 = the main colour). dark: the dark mode surfaces bg s1 s2 s3 s4.
// images: i1.. (the art). band / mini: the art layers of the header band (fixed pixel sizes: nothing is drawn again when the band grows)
// and of the small preview (sizes relative to the preview).
export const THEMES = {
  ocean: {
    title: 'ทะเลยามเช้า (morning sea): sea-green blue with a warm early light',
    ramp: { 50: '#ebf8fa', 100: '#d4f0f3', 200: '#aee3ea', 400: '#3db3c2', 500: '#1597ab', 600: '#0b7f95', 700: '#08687a' },
    lightRgb: '120 214 226', textDark: '#7fd6e3', page: '#eef6f7', meta: '#0b7f95', glow: '#2fb0b5', spark: '#5cc2cc',
    dark: ['#07131a', '#0d1c24', '#12252e', '#193039', '#213b45'],
    images: { i1: wave(true), i2: wave(false) },
    base: 'radial-gradient(130% 160% at 92% -30%, rgba(255, 214, 170, .55), rgba(255, 214, 170, 0) 52%), linear-gradient(160deg, #0a6a80 0%, #0f8aa0 48%, #2fb0b5 100%)',
    baseDark: 'radial-gradient(130% 160% at 92% -30%, rgba(255, 196, 150, .16), rgba(255, 196, 150, 0) 52%), linear-gradient(160deg, #052a36 0%, #0a4352 50%, #0e5b67 100%)',
    band: 'var(--sk-i1) left bottom / 100% 54px no-repeat', bandDark: 'var(--sk-i2) left bottom / 100% 54px no-repeat',
    mini: 'var(--sk-i1) left bottom / 100% 60% no-repeat', miniDark: 'var(--sk-i2) left bottom / 100% 60% no-repeat'
  },
  aurora: {
    title: 'แสงเหนือ (aurora) · PLUS: a night sky in amethyst with slow aurora ribbons and twinkling stars (the art and motion: part 4 below).\n   A PLAN theme: worn only while the PLUS / MAX plan is active (the server decides, PLAN_THEMES in the backend), never sold or given.',
    ramp: { 50: '#f4effd', 100: '#e9defb', 200: '#d5c2f6', 400: '#a57ee8', 500: '#8a5cdb', 600: '#7442c8', 700: '#5f33a8' },
    lightRgb: '190 160 245', textDark: '#cbb4ff', page: '#f5f2fc', meta: '#1f1050', glow: '#a57ee8', spark: '#7cf2d4',
    dark: ['#0c0a1a', '#141127', '#1a1631', '#221d3d', '#2b2549'],
    images: { i1: auroraStars, i2: ribbons, i3: auroraSparkles },
    base: 'radial-gradient(120% 150% at 86% -25%, rgba(124, 242, 212, .3), rgba(124, 242, 212, 0) 55%), radial-gradient(90% 130% at 8% 125%, rgba(255, 150, 211, .26), rgba(255, 150, 211, 0) 60%), linear-gradient(165deg, #150c3c 0%, #2a1564 46%, #4b2594 100%)',
    baseDark: 'radial-gradient(120% 150% at 86% -25%, rgba(124, 242, 212, .18), rgba(124, 242, 212, 0) 55%), radial-gradient(90% 130% at 8% 125%, rgba(255, 150, 211, .14), rgba(255, 150, 211, 0) 60%), linear-gradient(165deg, #0b0726 0%, #190d42 50%, #2b1663 100%)',
    band: 'var(--sk-i1) 0 0 / 260px 130px repeat', bandDark: 'var(--sk-i1) 0 0 / 260px 130px repeat',
    mini: 'var(--sk-i1) 0 0 / 130px 65px repeat', miniDark: 'var(--sk-i1) 0 0 / 130px 65px repeat'
  },
  gold: {
    title: 'ราตรีทองคำ (midnight gold) · MAX: fine gold line art on a midnight sky, a sheen of light now and then, rising gold dust.\n   A PLAN theme: worn only while the MAX plan is active, never sold or given.',
    ramp: { 50: '#fbf6ea', 100: '#f5ead0', 200: '#ead5a3', 400: '#c9a24f', 500: '#b38a35', 600: '#977226', 700: '#7b5b1c' },
    lightRgb: '230 200 130', textDark: '#e7c97e', page: '#f8f5ee', meta: '#101221', glow: '#e7c97e', spark: '#f3d98f',
    dark: ['#0b0c14', '#12141f', '#181a28', '#1f2132', '#282a3d'],
    images: { i1: fan(false), i2: fan(true), i3: goldDust },
    base: 'radial-gradient(110% 150% at 88% -30%, rgba(231, 201, 126, .26), rgba(231, 201, 126, 0) 55%), linear-gradient(165deg, #0f1222 0%, #1a1c33 50%, #2a2540 100%)',
    baseDark: 'radial-gradient(110% 150% at 88% -30%, rgba(231, 201, 126, .16), rgba(231, 201, 126, 0) 55%), linear-gradient(165deg, #07080f 0%, #0e1020 50%, #181629 100%)',
    band: 'var(--sk-i1) right bottom / auto 200px no-repeat, var(--sk-i2) left bottom / auto 124px no-repeat',
    bandDark: 'var(--sk-i1) right bottom / auto 200px no-repeat, var(--sk-i2) left bottom / auto 124px no-repeat',
    mini: 'var(--sk-i1) right bottom / auto 100% no-repeat, var(--sk-i2) left bottom / auto 62% no-repeat',
    miniDark: 'var(--sk-i1) right bottom / auto 100% no-repeat, var(--sk-i2) left bottom / auto 62% no-repeat'
  },
  neon: {
    title: 'นีออนซิตี้ (neon city): a night city in one wide picture (far skyline in violet haze, near skyline in ink with a few lit windows,\n   a glowing horizon, a fine floor grid), car light trails gliding along the horizon and a softly twinkling sky; HUD corners on the\n   homework cards (part 6). A REWARD theme like ocean (sold, won or given).',
    ramp: { 50: '#fdf0fb', 100: '#f9dcf3', 200: '#f2b5e6', 400: '#e05cc6', 500: '#cc35ad', 600: '#b0218f', 700: '#8f1873' },
    lightRgb: '255 140 225', textDark: '#ff8ae0', page: '#f7f3fa', meta: '#0b0620', glow: '#22e4ff', spark: '#22e4ff',
    dark: ['#08060f', '#0f0c1a', '#151124', '#1c172f', '#251e3b'],
    images: { i1: neonCity, i2: neonTrails, i3: neonStars },
    base: 'radial-gradient(70% 110% at 80% -20%, rgba(255, 46, 196, .42), rgba(255, 46, 196, 0) 60%), radial-gradient(60% 90% at 12% 120%, rgba(34, 228, 255, .22), rgba(34, 228, 255, 0) 62%), linear-gradient(180deg, #070320 0%, #120838 58%, #2a0c52 100%)',
    baseDark: 'radial-gradient(70% 110% at 80% -20%, rgba(255, 46, 196, .3), rgba(255, 46, 196, 0) 60%), radial-gradient(60% 90% at 12% 120%, rgba(34, 228, 255, .14), rgba(34, 228, 255, 0) 62%), linear-gradient(180deg, #040212 0%, #0a0528 58%, #19073a 100%)',
    band: 'var(--sk-i1) center bottom / 2400px 150px no-repeat',
    bandDark: 'var(--sk-i1) center bottom / 2400px 150px no-repeat',
    mini: 'var(--sk-i1) center bottom / 1200px 75px no-repeat', miniDark: 'var(--sk-i1) center bottom / 1200px 75px no-repeat'
  }
};
/** The themes whose header band moves (part 4 / the motion section). */
export const MOVING = ['aurora', 'gold', 'neon'];

/** The variables of one theme, as CSS declarations (no selector). `withArt` false = colours only. */
export function themeVars(key, { withArt = true } = {}) {
  const t = THEMES[key];
  const R = t.ramp;
  const [dbg, d1, d2, d3, d4] = t.dark;
  // the tokens of the LYNX page and chat: an action colour that white text reads on, tinted paper and lines
  const lxAccent = readable(R[600], '#ffffff', 4.6);
  const lxText = readable(R[700], mix(t.page, R[600], 0.06), 5);
  const lines = [
    ...Object.entries(R).map(([n, hex]) => `--sk-${n}: ${hex};`),
    `--sk-rgb: ${triple(R[600])};`,
    `--sk-200-rgb: ${triple(R[200])};`,
    `--sk-light-rgb: ${t.lightRgb};`,
    `--sk-text-dark: ${t.textDark};`,
    `--sk-page: ${t.page};`,
    `--sk-meta: ${t.meta};`,
    `--sk-glow: ${t.glow};`,
    `--sk-spark: ${t.spark};`,
    `--sk-lx-accent: ${lxAccent};`,
    `--sk-lx-hover: ${mix(lxAccent, '#000000', 0.14)};`,
    `--sk-lx-text: ${lxText};`,
    `--sk-paper-2: ${mix(t.page, R[600], 0.07)};`,
    `--sk-paper-3: ${mix(t.page, R[600], 0.045)};`,
    `--sk-line: ${mix(t.page, R[600], 0.17)};`,
    `--sk-line-2: ${mix(t.page, R[600], 0.3)};`,
    `--sk-paper-2-rgb: ${triple(mix(t.page, R[600], 0.07))};`,
    `--sk-d-bg: ${dbg};`, `--sk-d-s1: ${d1};`, `--sk-d-s2: ${d2};`, `--sk-d-s3: ${d3};`, `--sk-d-s4: ${d4};`,
    `--sk-d-line-2: ${mix(d4, '#ffffff', 0.1)};`,
    `--sk-d-soft: ${mix(dbg, R[600], 0.34)};`,
    `--sk-d-hover: ${mix(t.textDark, '#ffffff', 0.3)};`,
    `--sk-d-s1-rgb: ${triple(d1)};`, `--sk-d-s2-rgb: ${triple(d2)};`, `--sk-d-s3-rgb: ${triple(d3)};`
  ];
  if (withArt) {
    for (const [name, svg] of Object.entries(t.images)) lines.push(`--sk-${name}: ${enc(svg)};`);
    lines.push(`--sk-base: ${t.base};`, `--sk-base-dark: ${t.baseDark};`);
    lines.push(`--sk-band: ${t.band}, var(--sk-base);`, `--sk-band-dark: ${t.bandDark}, var(--sk-base-dark);`);
    lines.push(`--sk-mini: ${t.mini}, var(--sk-base);`, `--sk-mini-dark: ${t.miniDark}, var(--sk-base-dark);`);
  }
  return lines;
}

/**
 * Part 4: the art that moves. `band` = the selector of the header band for a theme key; `preview` = the same for the small preview
 * (leave it out on a site that shows no previews); `pauseWhen` = band selectors under which the art rests.
 */
export function motionCss({ band, preview = null, pauseWhen = [] }) {
  const list = (key, pseudo) => [band(key) + pseudo, preview ? preview(key) + pseudo : ''].filter(Boolean).join(', ');
  const all = (pseudo) => MOVING.map((k) => list(k, pseudo)).join(',\n');
  const mini = (css) => (preview ? css + '\n' : '');
  return `${[...MOVING.map(band), ...(preview ? MOVING.map(preview) : [])].join(', ')} { overflow: hidden; }
${all('::before')},
${all('::after')} { content: ""; position: absolute; pointer-events: none; will-change: transform, opacity; }

/* aurora: the ribbons drift and breathe, the bright stars twinkle */
${band('aurora')}::before { left: -25%; width: 150%; bottom: 0; height: 250px; }
${mini(`${preview ? preview('aurora') : ''}::before { left: -25%; width: 150%; top: 0; bottom: 0; }`)}${list('aurora', '::before')} { background: var(--sk-i2) center / 100% 100% no-repeat; animation: hf-sk-aurora 26s ease-in-out infinite alternate; }
${band('aurora')}::after { top: 0; left: 0; right: 0; height: 380px; background: var(--sk-i3) 40px 8px / 380px 180px repeat; }
${mini(`${preview ? preview('aurora') : ''}::after { inset: 0; background: var(--sk-i3) 10px 2px / 190px 90px repeat; }`)}${list('aurora', '::after')} { animation: hf-sk-twinkle 3.8s ease-in-out infinite alternate; }
@keyframes hf-sk-aurora {
  0% { transform: translate3d(-6%, 3px, 0); opacity: .66; }
  50% { transform: translate3d(2%, -5px, 0); opacity: 1; }
  100% { transform: translate3d(8%, 2px, 0); opacity: .76; }
}
@keyframes hf-sk-twinkle { 0% { opacity: .2; } 60% { opacity: .85; } 100% { opacity: .45; } }

/* gold: a gold hairline along the curve, a sheen of light now and then, gold dust rising */
${band('gold')} { box-shadow: inset 0 -1.5px 0 rgba(231, 201, 126, .55), 0 10px 24px -16px rgba(13, 15, 28, .7); }
${band('gold')}::before { top: 0; left: 0; width: 45%; height: 380px; }
${mini(`${preview ? preview('gold') : ''}::before { top: 0; bottom: 0; left: 0; width: 45%; }`)}${list('gold', '::before')} {
  background: linear-gradient(105deg, rgba(255, 226, 160, 0) 30%, rgba(255, 226, 160, .17) 50%, rgba(255, 226, 160, 0) 70%);
  transform: translate3d(-110%, 0, 0); animation: hf-sk-sheen 9s cubic-bezier(.45, .05, .35, 1) infinite;
}
${band('gold')}::after { top: 0; left: 0; right: 0; height: 540px; background: var(--sk-i3) 0 0 / 300px 160px repeat; animation: hf-sk-rise 22s linear infinite; }
${mini(`${preview ? preview('gold') : ''}::after { top: 0; left: 0; right: 0; height: calc(100% + 80px); background: var(--sk-i3) 0 0 / 150px 80px repeat; animation: hf-sk-rise-mini 22s linear infinite; }`)}${list('gold', '::after')} { opacity: .75; }
@keyframes hf-sk-sheen { 0% { transform: translate3d(-110%, 0, 0); } 45%, 100% { transform: translate3d(330%, 0, 0); } }
@keyframes hf-sk-rise { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(0, -160px, 0); } }
${mini('@keyframes hf-sk-rise-mini { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(0, -80px, 0); } }')}
/* neon: a neon hairline under the band, car light trails gliding along the horizon (one strip, seamless), the sky twinkling softly */
${band('neon')} { box-shadow: inset 0 -1px 0 rgba(255, 111, 220, .55), 0 10px 24px -20px rgba(255, 46, 196, .45); }
${band('neon')}::before { top: 0; left: 0; right: 0; height: 160px; background: var(--sk-i3) 20px 6px / 320px 120px repeat; }
${mini(`${preview ? preview('neon') : ''}::before { inset: 0; background: var(--sk-i3) 6px 2px / 160px 60px repeat; }`)}${list('neon', '::before')} { animation: hf-sk-twinkle 4.6s ease-in-out infinite alternate; }
${band('neon')}::after { left: -900px; right: 0; bottom: 30px; height: 12px; background: var(--sk-i2) left top / 900px 12px repeat-x; animation: hf-sk-trails 16s linear infinite; }
${mini(`${preview ? preview('neon') : ''}::after { left: -450px; right: 0; bottom: 15px; height: 6px; background: var(--sk-i2) left top / 450px 6px repeat-x; animation: hf-sk-trails-mini 16s linear infinite; }
@keyframes hf-sk-trails-mini { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(450px, 0, 0); } }`)}@keyframes hf-sk-trails { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(900px, 0, 0); } }
${mini(`/* a small preview moves only while it is the one chosen (or under the pointer): a window full of previews stays still */
[data-hf-skin-preview] .sk-band::before, [data-hf-skin-preview] .sk-band::after { animation-play-state: paused; }
.is-selected > .cp-preview [data-hf-skin-preview] .sk-band::before, .is-selected > .cp-preview [data-hf-skin-preview] .sk-band::after,
[data-hf-skin-preview]:hover .sk-band::before, [data-hf-skin-preview]:hover .sk-band::after { animation-play-state: running; }`)}${pauseWhen.length ? `/* a window is open over the page: the band rests (a frosted window over moving art is drawn again on every frame) */
${pauseWhen.map((sel) => `${sel}::before, ${sel}::after`).join(',\n')} { animation-play-state: paused; }
` : ''}
@media (prefers-reduced-motion: reduce) {
  ${MOVING.map(band).flatMap((b) => [`${b}::before`, `${b}::after`]).join(', ')}${preview ? `,
  [data-hf-skin-preview] .sk-band::before, [data-hf-skin-preview] .sk-band::after` : ''} { animation: none; }
  ${['gold'].flatMap((k) => [band(k) + '::before', preview ? preview(k) + '::before' : '']).filter(Boolean).join(', ')} { display: none; }
}
`;
}
