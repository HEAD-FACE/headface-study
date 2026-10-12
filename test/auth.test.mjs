// test/auth.test.mjs — เทสต์พฤติกรรมของ js/auth.js ที่เกี่ยวกับ environment และการตรวจเซสชัน
// รัน: node --test test/auth.test.mjs   (ต้องใช้ Node 18+ ไม่ต้องมี package.json)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_SOURCE = readFileSync(path.join(ROOT, 'js', 'env.js'), 'utf8');
const AUTH_SOURCE = readFileSync(path.join(ROOT, 'js', 'auth.js'), 'utf8');

const toDataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

let importCounter = 0;
/** โหลด auth.js เป็นสำเนาใหม่ (state ภายในโมดูลเริ่มใหม่) โดยชี้ ./env.js ไปที่สำเนา env.js แบบ data URL */
async function loadAuth() {
    const n = ++importCounter;
    const envUrl = toDataUrl(`${ENV_SOURCE}\n//# env-copy-${n}`);
    assert.ok(AUTH_SOURCE.includes("from './env.js'"), 'auth.js ต้อง import ./env.js');
    const patched = AUTH_SOURCE.replace("from './env.js'", `from '${envUrl}'`);
    return import(toDataUrl(`${patched}\n//# auth-copy-${n}`));
}

function makeStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => { data.set(key, String(value)); },
        removeItem: (key) => { data.delete(key); },
        has: (key) => data.has(key)
    };
}

const jsonResponse = (status, body) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
        if (body instanceof Error) throw body;
        return body;
    }
});

/**
 * จำลองเบราว์เซอร์ที่เปิดหน้าบน hostname ที่กำหนด แล้วรัน fn
 * @returns {{ redirects: string[], calls: Array<{url:string, opts:object}>, sessionStorage, localStorage }}
 */
async function inBrowser({ hostname, cookie = '', fetchImpl, session = {} }, fn) {
    const redirects = [];
    const calls = [];
    const sessionStorage = makeStorage(session);
    const localStorage = makeStorage();
    const window = {
        location: {
            hostname,
            href: `https://${hostname}/index.html`,
            replace: (url) => { redirects.push(url); }
        },
        dispatchEvent: () => true
    };
    const globals = {
        window,
        document: { cookie },
        sessionStorage,
        localStorage,
        fetch: async (url, opts) => {
            calls.push({ url, opts });
            return fetchImpl(url, opts);
        }
    };

    const saved = new Map();
    for (const [key, value] of Object.entries(globals)) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    try {
        await fn({ redirects, calls, sessionStorage, localStorage });
    } finally {
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
}

const USER = { student_id: 12345, first_name: 'ทดสอบ', last_name: 'ระบบ' };

describe('auth.js เลือก API และหน้า login ตามโดเมน', () => {
    for (const [hostname, api, login] of [
        ['study.headface.app', 'https://api.headface.app', 'https://headface.app/login'],
        ['beta-study.headface.app', 'https://test.beta-api.headface.app', 'https://beta.headface.app/login'],
        ['localhost', 'https://test.beta-api.headface.app', 'https://beta.headface.app/login']
    ]) {
        test(`${hostname}: API_BASE_URL / LOGIN_PAGE_URL / คำขอ /api/auth/me`, async () => {
            await inBrowser({ hostname, fetchImpl: async () => jsonResponse(200, { success: true, user: USER }) }, async ({ calls }) => {
                const auth = await loadAuth();
                assert.equal(auth.API_BASE_URL, api);
                assert.equal(auth.LOGIN_PAGE_URL, login);

                await auth.checkSession(true);
                assert.equal(calls.length, 1);
                assert.equal(calls[0].url, `${api}/api/auth/me`);
                assert.equal(calls[0].opts.credentials, 'include');
            });
        });
    }

    test('window.HEADFACE_API_BASE ยังใช้ override ได้', async () => {
        await inBrowser({ hostname: 'study.headface.app', fetchImpl: async () => jsonResponse(200, { success: true, user: USER }) }, async () => {
            globalThis.window.HEADFACE_API_BASE = 'https://override.example.test/';
            const auth = await loadAuth();
            assert.equal(auth.API_BASE_URL, 'https://override.example.test');
        });
    });
});

describe('requireAuth — redirect เฉพาะเมื่อ Backend ตอบ 401', () => {
    test('HTTP 401 → ล้างเซสชันฝั่ง client และ redirect ไป login พร้อม redirect=URL ปัจจุบัน', async () => {
        await inBrowser(
            {
                hostname: 'beta-study.headface.app',
                session: { study_user: JSON.stringify(USER), hf_csrf_token: 'abc' },
                fetchImpl: async () => jsonResponse(401, { success: false })
            },
            async ({ redirects, sessionStorage }) => {
                const auth = await loadAuth();
                const user = await auth.requireAuth(true);
                assert.equal(user, null);
                assert.equal(redirects.length, 1);
                assert.equal(
                    redirects[0],
                    `https://beta.headface.app/login?redirect=${encodeURIComponent('https://beta-study.headface.app/index.html')}`
                );
                assert.equal(sessionStorage.has('study_user'), false);
                assert.equal(sessionStorage.has('hf_csrf_token'), false);
            }
        );
    });

    test('HTTP 200 + user → คืนผู้ใช้, เก็บแคช, ไม่ redirect', async () => {
        await inBrowser(
            { hostname: 'study.headface.app', fetchImpl: async () => jsonResponse(200, { success: true, user: USER }) },
            async ({ redirects, sessionStorage }) => {
                const auth = await loadAuth();
                assert.deepEqual(await auth.requireAuth(true), USER);
                assert.equal(redirects.length, 0);
                assert.deepEqual(JSON.parse(sessionStorage.getItem('study_user')), USER);
            }
        );
    });

    for (const status of [500, 502, 503, 403, 429]) {
        test(`HTTP ${status} → ไม่ redirect และไม่ล้างเซสชัน (ใช้ผู้ใช้ที่แคชไว้)`, async () => {
            await inBrowser(
                {
                    hostname: 'study.headface.app',
                    session: { study_user: JSON.stringify(USER), hf_csrf_token: 'abc' },
                    fetchImpl: async () => jsonResponse(status, { success: false })
                },
                async ({ redirects, sessionStorage }) => {
                    const auth = await loadAuth();
                    assert.deepEqual(await auth.requireAuth(true), USER);
                    assert.equal(redirects.length, 0);
                    assert.equal(sessionStorage.has('study_user'), true);
                    assert.equal(sessionStorage.has('hf_csrf_token'), true);
                }
            );
        });
    }

    test('เครือข่ายหลุด/ติด CORS (fetch throw) → ไม่ redirect ไม่ล้างเซสชัน', async () => {
        await inBrowser(
            {
                hostname: 'beta-study.headface.app',
                session: { study_user: JSON.stringify(USER) },
                fetchImpl: async () => { throw new TypeError('Failed to fetch'); }
            },
            async ({ redirects, sessionStorage }) => {
                const auth = await loadAuth();
                assert.deepEqual(await auth.requireAuth(true), USER);
                assert.equal(redirects.length, 0);
                assert.equal(sessionStorage.has('study_user'), true);
            }
        );
    });

    test('ตรวจสอบไม่ได้และไม่เคยมีผู้ใช้ในแคช → คืน null แต่ไม่ redirect', async () => {
        await inBrowser(
            { hostname: 'study.headface.app', fetchImpl: async () => jsonResponse(503, {}) },
            async ({ redirects }) => {
                const auth = await loadAuth();
                assert.equal(await auth.requireAuth(true), null);
                assert.equal(redirects.length, 0);
            }
        );
    });

    test('HTTP 200 แต่ JSON อ่านไม่ได้ / ไม่มี user → ไม่ redirect', async () => {
        for (const body of [new Error('bad json'), { success: true }, { success: false }, null]) {
            await inBrowser(
                { hostname: 'study.headface.app', session: { study_user: JSON.stringify(USER) }, fetchImpl: async () => jsonResponse(200, body) },
                async ({ redirects, sessionStorage }) => {
                    const auth = await loadAuth();
                    assert.deepEqual(await auth.requireAuth(true), USER);
                    assert.equal(redirects.length, 0);
                    assert.equal(sessionStorage.has('study_user'), true);
                }
            );
        }
    });

    test('checkSession คืน null เมื่อ 401 และไม่ redirect เอง (redirect เป็นหน้าที่ของ requireAuth)', async () => {
        await inBrowser(
            { hostname: 'study.headface.app', fetchImpl: async () => jsonResponse(401, {}) },
            async ({ redirects }) => {
                const auth = await loadAuth();
                assert.equal(await auth.checkSession(true), null);
                assert.equal(redirects.length, 0);
            }
        );
    });
});

describe('getCsrfToken — อ่าน cookie ตามชื่อของ environment', () => {
    test('preview อ่าน hf_csrf_beta ไม่ใช่ hf_csrf ของ production ที่แชร์โดเมน .headface.app', async () => {
        await inBrowser(
            {
                hostname: 'beta-study.headface.app',
                cookie: 'hf_csrf=PROD_TOKEN; hf_csrf_beta=BETA_TOKEN',
                fetchImpl: async () => { throw new Error('ต้องไม่เรียกเครือข่าย'); }
            },
            async ({ calls }) => {
                const auth = await loadAuth();
                assert.equal(await auth.getCsrfToken(), 'BETA_TOKEN');
                assert.equal(calls.length, 0);
            }
        );
    });

    test('production อ่าน hf_csrf ไม่ใช่ hf_csrf_beta', async () => {
        await inBrowser(
            {
                hostname: 'study.headface.app',
                cookie: 'hf_csrf_beta=BETA_TOKEN; hf_csrf=PROD_TOKEN',
                fetchImpl: async () => { throw new Error('ต้องไม่เรียกเครือข่าย'); }
            },
            async () => {
                const auth = await loadAuth();
                assert.equal(await auth.getCsrfToken(), 'PROD_TOKEN');
            }
        );
    });

    test('preview ที่มีแต่ cookie ของ production → ไม่หยิบมาใช้ แต่ขอ token ใหม่จาก API ของ preview', async () => {
        await inBrowser(
            {
                hostname: 'beta-study.headface.app',
                cookie: 'hf_csrf=PROD_TOKEN',
                fetchImpl: async () => jsonResponse(200, { success: true, csrf_token: 'FRESH_BETA' })
            },
            async ({ calls }) => {
                const auth = await loadAuth();
                assert.equal(await auth.getCsrfToken(), 'FRESH_BETA');
                assert.equal(calls[0].url, 'https://test.beta-api.headface.app/api/auth/csrf');
            }
        );
    });
});
