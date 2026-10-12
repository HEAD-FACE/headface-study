/**
 * js/env.js — HEADFACE Study: ค่าตั้งค่ากลางของ environment และโดเมน backend
 *
 * โค้ดชุดเดียวใช้ได้ทั้ง production และ preview โดยเลือกค่าจากชื่อโดเมนของหน้าที่เปิดอยู่
 *   study.headface.app       → production → https://api.headface.app
 *   beta-study.headface.app  → preview    → https://test.beta-api.headface.app
 *
 * กฎตัดสิน (ดู detectEnvironment):
 *   - headface.app หรือ subdomain ของมันที่ "ไม่มี label ใดขึ้นต้นด้วย beta" → production
 *   - ที่เหลือทั้งหมด (localhost, file://, *.pages.dev, โดเมนที่ไม่รู้จัก) → preview
 *     ไม่แน่ใจเมื่อไรให้ตกเป็น preview เสมอ เพื่อไม่ให้หน้าทดสอบเผลอเขียนข้อมูลบน production
 *
 * URL ของ API / หน้า login / หน้า profile และชื่อ cookie ต้องอยู่ในไฟล์นี้ที่เดียวเท่านั้น
 * (มีเทสต์ test/env.test.mjs ตรวจว่าไม่มี URL ค้างอยู่ในไฟล์อื่น)
 */

export const API_BASES = {
    production: 'https://api.headface.app',
    preview: 'https://test.beta-api.headface.app'
};

// เว็บหลักที่เป็นเจ้าของหน้า login / profile (ตรงกับ APP_BASE_URL ใน wrangler.jsonc ของ backend)
export const APP_BASES = {
    production: 'https://headface.app',
    preview: 'https://beta.headface.app'
};

// ต้องตรงกับ COOKIE_SUFFIX ใน wrangler.jsonc ของ backend
// (vars → production, previews.vars → preview) คนละชื่อกันเพื่อไม่ให้ login ฝั่ง beta ทับ login จริง
export const COOKIE_SUFFIXES = {
    production: '',
    preview: '_beta'
};

const PRODUCTION_DOMAIN = 'headface.app';
const CSRF_COOKIE_BASE_NAME = 'hf_csrf';
const PREVIEW_LABEL_PREFIX = 'beta';

/**
 * ตัดสินว่าชื่อโดเมน (hostname ไม่รวม port) เป็น production หรือ preview
 * @param {string} hostname
 * @returns {'production'|'preview'}
 */
export function detectEnvironment(hostname) {
    if (typeof hostname !== 'string') return 'preview';

    // ไม่สนตัวพิมพ์ใหญ่-เล็ก, ช่องว่าง และจุดท้ายชื่อ (FQDN เช่น "study.headface.app.")
    const host = hostname.trim().toLowerCase().replace(/\.$/, '');
    if (!host) return 'preview';

    if (host === PRODUCTION_DOMAIN) return 'production';

    const suffix = `.${PRODUCTION_DOMAIN}`;
    // ต้องลงท้ายด้วย ".headface.app" จริง ๆ ไม่ใช่แค่ต่อท้ายข้อความ (กัน evilheadface.app)
    if (!host.endsWith(suffix)) return 'preview';

    // เช็กทุก label ไม่ใช่แค่ตัวแรก เช่น "test.beta-api" ก็เป็น preview; label ว่าง (".." ) ถือว่าผิดปกติ
    const labels = host.slice(0, -suffix.length).split('.');
    const isPreview = labels.some((label) => label === '' || label.startsWith(PREVIEW_LABEL_PREFIX));
    return isPreview ? 'preview' : 'production';
}

/** environment ของหน้าที่เปิดอยู่ (นอกเบราว์เซอร์ เช่น Node ให้เป็น preview) */
export function getEnvironmentName() {
    const hostname = (typeof window !== 'undefined' && window && window.location && window.location.hostname) || '';
    return detectEnvironment(hostname);
}

function cleanBaseUrl(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\/+$/, '');
}

/**
 * Base URL ของ API ที่ต้องใช้ ลำดับความสำคัญ:
 *   1. window.HEADFACE_API_BASE
 *   2. window.__ENV__.API_BASE
 *   3. process.env.API_BASE (Node / เทสต์ เท่านั้น)
 *   4. ค่าจากการ detect ตามชื่อโดเมน
 * @returns {string}
 */
export function getApiBaseUrl() {
    if (typeof window !== 'undefined' && window) {
        const fromWindow = cleanBaseUrl(window.HEADFACE_API_BASE);
        if (fromWindow) return fromWindow;

        const fromEnvObject = cleanBaseUrl(window.__ENV__ && window.__ENV__.API_BASE);
        if (fromEnvObject) return fromEnvObject;
    }

    if (typeof process !== 'undefined' && process && process.env) {
        const fromProcess = cleanBaseUrl(process.env.API_BASE);
        if (fromProcess) return fromProcess;
    }

    return API_BASES[getEnvironmentName()];
}

/** เว็บหลักของ environment ปัจจุบัน (เจ้าของหน้า login / profile) */
export function getAppBaseUrl() {
    return APP_BASES[getEnvironmentName()];
}

export function getLoginPageUrl() {
    return `${getAppBaseUrl()}/login`;
}

export function getProfilePageUrl() {
    return `${getAppBaseUrl()}/profile.html`;
}

/** ชื่อ cookie CSRF (อ่านได้ด้วย JS) ของ environment ปัจจุบัน: hf_csrf หรือ hf_csrf_beta */
export function getCsrfCookieName() {
    return CSRF_COOKIE_BASE_NAME + COOKIE_SUFFIXES[getEnvironmentName()];
}

/**
 * ใส่ <meta name="robots" content="noindex"> เมื่อเป็น preview เพื่อไม่ให้เว็บทดสอบติดผลค้นหา
 * @returns {boolean} true เมื่อมีการเพิ่ม meta จริง
 */
export function applyRobotsMeta(doc = (typeof document !== 'undefined' ? document : undefined)) {
    if (getEnvironmentName() !== 'preview') return false;
    if (!doc || !doc.head) return false;
    if (doc.querySelector('meta[name="robots"]')) return false;

    const meta = doc.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    doc.head.appendChild(meta);
    return true;
}

// Bind to window.StudyEnv สำหรับ classic script (เช่น js/main.js) ที่ import ไม่ได้
// หมายเหตุ: ไม่เขียนค่ากลับลง window.__ENV__ เพราะ getApiBaseUrl() อ่านที่นั่นเป็น override
if (typeof window !== 'undefined' && window) {
    window.StudyEnv = {
        API_BASES,
        APP_BASES,
        COOKIE_SUFFIXES,
        detectEnvironment,
        getEnvironmentName,
        getApiBaseUrl,
        getAppBaseUrl,
        getLoginPageUrl,
        getProfilePageUrl,
        getCsrfCookieName
    };
    applyRobotsMeta();
}
