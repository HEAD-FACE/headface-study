// test/env.test.mjs — เทสต์ของ js/env.js (การเลือก API ตามชื่อโดเมน)
// รัน: node --test test/env.test.mjs   (ต้องใช้ Node 18+ ไม่ต้องมี package.json)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_SOURCE = readFileSync(path.join(ROOT, 'js', 'env.js'), 'utf8');

const PROD_API = 'https://api.headface.app';
const PREVIEW_API = 'https://test.beta-api.headface.app';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ตั้งค่า global ชั่วคราว (undefined = ลบทิ้ง) แล้วคืนค่าเดิมหลังจบ — ใช้กับโค้ดแบบ sync เท่านั้น */
function withGlobals(overrides, fn) {
    const saved = new Map();
    for (const [key, value] of Object.entries(overrides)) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        if (value === undefined) {
            delete globalThis[key];
        } else {
            Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
        }
    }
    try {
        return fn();
    } finally {
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
}

let importCounter = 0;
/** โหลด js/env.js เป็นสำเนาใหม่ทุกครั้ง (รัน side effect ระดับบนสุดใหม่) โดยไม่ต้องมี package.json */
async function loadEnvModule(globals = {}) {
    const source = `${ENV_SOURCE}\n//# fresh-copy-${++importCounter}`;
    const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
    const saved = new Map();
    for (const [key, value] of Object.entries(globals)) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    try {
        return await import(url);
    } finally {
        for (const [key, descriptor] of saved) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
}

const fakeWindow = (hostname, extra = {}) => ({ location: { hostname }, ...extra });

function fakeDocument({ existingRobots = null } = {}) {
    const children = existingRobots ? [{ tagName: 'META', name: 'robots', content: existingRobots }] : [];
    return {
        children,
        head: { appendChild: (el) => { children.push(el); return el; } },
        createElement: (tag) => ({ tagName: tag.toUpperCase() }),
        querySelector: (selector) =>
            selector === 'meta[name="robots"]'
                ? children.find((el) => el.tagName === 'META' && el.name === 'robots') || null
                : null
    };
}

const env = await loadEnvModule();

// ---------------------------------------------------------------------------
// detectEnvironment
// ---------------------------------------------------------------------------

describe('detectEnvironment', () => {
    const cases = [
        // production: โดเมนหลักและ subdomain ปกติ
        ['headface.app', 'production', 'โดเมน production พอดี'],
        ['study.headface.app', 'production', 'subdomain ปกติ (study)'],
        ['shop.headface.app', 'production', 'subdomain ปกติ (shop)'],
        ['admin.headface.app', 'production', 'subdomain ปกติ (admin)'],
        ['a.b.headface.app', 'production', 'subdomain หลายชั้นที่ไม่มี beta'],
        // preview: label ใดก็ได้ที่ขึ้นต้นด้วย beta
        ['beta.headface.app', 'preview', 'beta.*'],
        ['beta-study.headface.app', 'preview', 'beta-study'],
        ['betamax.headface.app', 'preview', 'ขึ้นต้นด้วย beta (ไม่ต้องมีขีด)'],
        ['test.beta-api.headface.app', 'preview', 'test.beta-api.* (beta อยู่ใน label ที่ไม่ใช่ตัวแรก)'],
        ['study.beta.headface.app', 'preview', 'beta อยู่ label ที่สอง'],
        // preview: ไม่ใช่โดเมน production
        ['localhost', 'preview', 'localhost'],
        ['127.0.0.1', 'preview', 'IPv4 loopback'],
        ['[::1]', 'preview', 'IPv6 loopback'],
        ['', 'preview', 'ว่าง (file:// ไม่มี hostname)'],
        ['headface.pages.dev', 'preview', '*.pages.dev'],
        ['headface-study.pages.dev', 'preview', '*.pages.dev อีกชื่อ'],
        ['abc123.headface-study.pages.dev', 'preview', 'preview deployment ของ Pages'],
        ['example.com', 'preview', 'โดเมนมั่ว'],
        ['evilheadface.app', 'preview', 'ต่อท้ายข้อความ headface.app แต่ไม่ใช่ subdomain'],
        ['notheadface.app', 'preview', 'ลงท้าย headface.app แต่ไม่มีจุดคั่น'],
        ['headface.app.evil.com', 'preview', 'headface.app อยู่กลางชื่อ'],
        ['study.headface.app.evil.com', 'preview', 'subdomain หลอก'],
        ['headface.app:8080', 'preview', 'ใส่ port มาด้วยถือว่าไม่ตรง ตกเป็น preview'],
        ['.headface.app', 'preview', 'ชื่อผิดรูป (label ว่าง)'],
        ['study..headface.app', 'preview', 'ชื่อผิดรูป (label ว่างตรงกลาง)'],
        // ตัวพิมพ์ใหญ่ / ช่องว่าง / จุดท้ายชื่อ
        ['STUDY.HEADFACE.APP', 'production', 'ตัวพิมพ์ใหญ่ production'],
        ['Headface.App', 'production', 'ตัวพิมพ์ผสม production'],
        ['BETA-STUDY.HEADFACE.APP', 'preview', 'ตัวพิมพ์ใหญ่ preview'],
        ['Test.Beta-Api.Headface.App', 'preview', 'ตัวพิมพ์ผสม preview'],
        ['  study.headface.app  ', 'production', 'มีช่องว่างล้อมรอบ'],
        ['study.headface.app.', 'production', 'มีจุดท้ายชื่อ (FQDN)'],
        ['beta-study.headface.app.', 'preview', 'มีจุดท้ายชื่อ (FQDN) แบบ preview']
    ];

    for (const [hostname, expected, label] of cases) {
        test(`${label}: ${JSON.stringify(hostname)} → ${expected}`, () => {
            assert.equal(env.detectEnvironment(hostname), expected);
        });
    }

    test('ค่าที่ไม่ใช่ string → preview', () => {
        for (const value of [undefined, null, 0, {}, []]) {
            assert.equal(env.detectEnvironment(value), 'preview');
        }
    });
});

// ---------------------------------------------------------------------------
// getEnvironmentName
// ---------------------------------------------------------------------------

describe('getEnvironmentName', () => {
    test('อ่านจาก window.location.hostname', () => {
        assert.equal(withGlobals({ window: fakeWindow('study.headface.app') }, () => env.getEnvironmentName()), 'production');
        assert.equal(withGlobals({ window: fakeWindow('beta-study.headface.app') }, () => env.getEnvironmentName()), 'preview');
    });

    test('ไม่มี window (Node) → preview', () => {
        assert.equal(withGlobals({ window: undefined }, () => env.getEnvironmentName()), 'preview');
    });

    test('file:// (hostname ว่าง) → preview', () => {
        assert.equal(withGlobals({ window: fakeWindow('') }, () => env.getEnvironmentName()), 'preview');
    });

    test('มี window แต่ไม่มี location → preview ไม่ error', () => {
        assert.equal(withGlobals({ window: {} }, () => env.getEnvironmentName()), 'preview');
    });
});

// ---------------------------------------------------------------------------
// getApiBaseUrl
// ---------------------------------------------------------------------------

describe('getApiBaseUrl — เลือกตามโดเมน', () => {
    const cases = [
        ['study.headface.app', PROD_API],
        ['headface.app', PROD_API],
        ['beta-study.headface.app', PREVIEW_API],
        ['beta.headface.app', PREVIEW_API],
        ['test.beta-api.headface.app', PREVIEW_API],
        ['localhost', PREVIEW_API],
        ['headface-study.pages.dev', PREVIEW_API],
        ['example.com', PREVIEW_API],
        ['STUDY.HEADFACE.APP', PROD_API],
        ['BETA-STUDY.HEADFACE.APP', PREVIEW_API]
    ];

    for (const [hostname, expected] of cases) {
        test(`${hostname} → ${expected}`, () => {
            const result = withGlobals({ window: fakeWindow(hostname), process: { env: {} } }, () => env.getApiBaseUrl());
            assert.equal(result, expected);
        });
    }

    test('API_BASES ที่ export ตรงกับค่าที่กำหนด', () => {
        assert.equal(env.API_BASES.production, PROD_API);
        assert.equal(env.API_BASES.preview, PREVIEW_API);
    });
});

describe('getApiBaseUrl — override ชนะการ detect', () => {
    const OVERRIDE = 'https://override.example.test';

    test('window.HEADFACE_API_BASE ชนะการ detect (บนโดเมน production)', () => {
        const result = withGlobals(
            { window: fakeWindow('study.headface.app', { HEADFACE_API_BASE: OVERRIDE }), process: { env: {} } },
            () => env.getApiBaseUrl()
        );
        assert.equal(result, OVERRIDE);
    });

    test('window.HEADFACE_API_BASE ชนะบนโดเมน preview', () => {
        const result = withGlobals(
            { window: fakeWindow('beta-study.headface.app', { HEADFACE_API_BASE: OVERRIDE }), process: { env: {} } },
            () => env.getApiBaseUrl()
        );
        assert.equal(result, OVERRIDE);
    });

    test('window.__ENV__.API_BASE ชนะการ detect', () => {
        const result = withGlobals(
            { window: fakeWindow('study.headface.app', { __ENV__: { API_BASE: OVERRIDE } }), process: { env: {} } },
            () => env.getApiBaseUrl()
        );
        assert.equal(result, OVERRIDE);
    });

    test('process.env.API_BASE ชนะการ detect', () => {
        const result = withGlobals(
            { window: fakeWindow('study.headface.app'), process: { env: { API_BASE: OVERRIDE } } },
            () => env.getApiBaseUrl()
        );
        assert.equal(result, OVERRIDE);
    });

    test('ลำดับ: HEADFACE_API_BASE > __ENV__.API_BASE > process.env.API_BASE', () => {
        const all = withGlobals(
            {
                window: fakeWindow('study.headface.app', { HEADFACE_API_BASE: 'https://one.test', __ENV__: { API_BASE: 'https://two.test' } }),
                process: { env: { API_BASE: 'https://three.test' } }
            },
            () => env.getApiBaseUrl()
        );
        assert.equal(all, 'https://one.test');

        const noFirst = withGlobals(
            {
                window: fakeWindow('study.headface.app', { __ENV__: { API_BASE: 'https://two.test' } }),
                process: { env: { API_BASE: 'https://three.test' } }
            },
            () => env.getApiBaseUrl()
        );
        assert.equal(noFirst, 'https://two.test');
    });

    test('ตัด / ท้ายและช่องว่างของ override ออก', () => {
        const result = withGlobals(
            { window: fakeWindow('study.headface.app', { HEADFACE_API_BASE: '  https://override.example.test//  ' }), process: { env: {} } },
            () => env.getApiBaseUrl()
        );
        assert.equal(result, OVERRIDE);
    });

    test('override ว่าง/ไม่ใช่ string ถูกข้าม แล้วใช้ค่าที่ detect', () => {
        for (const bad of ['', '   ', null, 123, {}]) {
            const result = withGlobals(
                { window: fakeWindow('study.headface.app', { HEADFACE_API_BASE: bad, __ENV__: { API_BASE: bad } }), process: { env: { API_BASE: bad } } },
                () => env.getApiBaseUrl()
            );
            assert.equal(result, PROD_API, `override ${JSON.stringify(bad)} ต้องถูกข้าม`);
        }
    });

    test('ไม่มี process (เช่นในเบราว์เซอร์) → ไม่ error และใช้ค่าที่ detect', () => {
        const result = withGlobals({ window: fakeWindow('study.headface.app'), process: undefined }, () => {
            assert.equal(typeof process, 'undefined');
            return env.getApiBaseUrl();
        });
        assert.equal(result, PROD_API);
    });

    test('process ไม่มี env → ไม่ error', () => {
        const result = withGlobals({ window: fakeWindow('beta-study.headface.app'), process: {} }, () => env.getApiBaseUrl());
        assert.equal(result, PREVIEW_API);
    });

    test('ไม่มีทั้ง window และ process → preview', () => {
        const result = withGlobals({ window: undefined, process: undefined }, () => env.getApiBaseUrl());
        assert.equal(result, PREVIEW_API);
    });

    test('Node: process.env.API_BASE ใช้งานได้เมื่อไม่มี window', () => {
        const result = withGlobals({ window: undefined, process: { env: { API_BASE: OVERRIDE } } }, () => env.getApiBaseUrl());
        assert.equal(result, OVERRIDE);
    });
});

// ---------------------------------------------------------------------------
// URL หน้า login / profile และชื่อ cookie
// ---------------------------------------------------------------------------

describe('login / profile / cookie ตาม environment', () => {
    test('production', () => {
        withGlobals({ window: fakeWindow('study.headface.app') }, () => {
            assert.equal(env.getLoginPageUrl(), 'https://headface.app/login');
            assert.equal(env.getProfilePageUrl(), 'https://headface.app/profile.html');
            assert.equal(env.getCsrfCookieName(), 'hf_csrf');
        });
    });

    test('preview', () => {
        withGlobals({ window: fakeWindow('beta-study.headface.app') }, () => {
            assert.equal(env.getLoginPageUrl(), 'https://beta.headface.app/login');
            assert.equal(env.getProfilePageUrl(), 'https://beta.headface.app/profile.html');
            assert.equal(env.getCsrfCookieName(), 'hf_csrf_beta');
        });
    });

    test('localhost ตกเป็น preview ทั้งหมด', () => {
        withGlobals({ window: fakeWindow('localhost') }, () => {
            assert.equal(env.getLoginPageUrl(), 'https://beta.headface.app/login');
            assert.equal(env.getCsrfCookieName(), 'hf_csrf_beta');
        });
    });
});

// ---------------------------------------------------------------------------
// meta robots noindex + window.StudyEnv
// ---------------------------------------------------------------------------

describe('meta robots noindex', () => {
    test('preview → ใส่ noindex อัตโนมัติตอนโหลดโมดูล', async () => {
        const document = fakeDocument();
        await loadEnvModule({ window: fakeWindow('beta-study.headface.app'), document });
        assert.equal(document.children.length, 1);
        assert.equal(document.children[0].name, 'robots');
        assert.match(document.children[0].content, /noindex/);
    });

    test('localhost และ *.pages.dev → ใส่ noindex', async () => {
        for (const hostname of ['localhost', 'headface-study.pages.dev']) {
            const document = fakeDocument();
            await loadEnvModule({ window: fakeWindow(hostname), document });
            assert.equal(document.children.length, 1, hostname);
        }
    });

    test('production → ไม่ใส่', async () => {
        const document = fakeDocument();
        await loadEnvModule({ window: fakeWindow('study.headface.app'), document });
        assert.equal(document.children.length, 0);
    });

    test('มี meta robots อยู่แล้ว → ไม่เพิ่มซ้ำ', async () => {
        const document = fakeDocument({ existingRobots: 'index' });
        await loadEnvModule({ window: fakeWindow('beta-study.headface.app'), document });
        assert.equal(document.children.length, 1);
        assert.equal(document.children[0].content, 'index');
    });

    test('ไม่มี document → ไม่ error', async () => {
        await assert.doesNotReject(loadEnvModule({ window: fakeWindow('beta-study.headface.app') }));
    });

    test('เรียก applyRobotsMeta ซ้ำไม่เพิ่มซ้ำ', () => {
        const document = fakeDocument();
        withGlobals({ window: fakeWindow('beta-study.headface.app') }, () => {
            assert.equal(env.applyRobotsMeta(document), true);
            assert.equal(env.applyRobotsMeta(document), false);
        });
        assert.equal(document.children.length, 1);
    });
});

describe('window.StudyEnv', () => {
    test('เปิดให้ classic script ใช้ และไม่เขียนทับ window.__ENV__', async () => {
        const window = fakeWindow('study.headface.app');
        await loadEnvModule({ window });
        assert.equal(typeof window.StudyEnv.getLoginPageUrl, 'function');
        assert.equal(typeof window.StudyEnv.getProfilePageUrl, 'function');
        assert.equal(window.__ENV__, undefined);
    });
});

// ---------------------------------------------------------------------------
// ไม่ให้เหลือ URL ของ API/โดเมน hard-code นอกไฟล์กลาง
// ---------------------------------------------------------------------------

describe('ไม่มี URL hard-code นอก js/env.js', () => {
    const SKIP_DIRS = new Set(['.git', '.agents', 'node_modules', 'assets', 'test']);
    const URL_PATTERN = /https?:\/\/[^\s"'`)<>]*(headface\.app|workers\.dev)/i;

    function collectSourceFiles(dir) {
        const files = [];
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!SKIP_DIRS.has(entry.name)) files.push(...collectSourceFiles(path.join(dir, entry.name)));
            } else if (/\.(html|js|mjs|css)$/i.test(entry.name)) {
                files.push(path.join(dir, entry.name));
            }
        }
        return files;
    }

    const files = collectSourceFiles(ROOT).filter((file) => path.basename(file) !== 'env.js');

    test('พบไฟล์ต้นทางให้ตรวจ', () => {
        assert.ok(files.length >= 6, `พบเพียง ${files.length} ไฟล์`);
    });

    for (const file of files) {
        const relative = path.relative(ROOT, file).replaceAll('\\', '/');
        test(relative, () => {
            const source = readFileSync(file, 'utf8');
            const match = source.match(URL_PATTERN);
            assert.equal(match, null, `พบ URL ที่ hard-code: ${match && match[0]}`);
            assert.doesNotMatch(source, /['"`]hf_csrf['"`]/, 'ชื่อ cookie CSRF ต้องมาจาก getCsrfCookieName()');
        });
    }

    test('ลิงก์โปรไฟล์ในทุกหน้ามี id ให้ main.js ตั้ง href ตาม environment', () => {
        for (const page of ['index.html', 'subject.html', 'progress.html']) {
            const source = readFileSync(path.join(ROOT, page), 'utf8');
            assert.match(source, /id="dropdownProfileLink"/, page);
        }
    });
});
