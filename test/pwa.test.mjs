// test/pwa.test.mjs — HEADFACE Study as an installable app ("Add to Home Screen"): manifest, icons, worker, offline page, and that every page links them.
// (The full behaviour of the worker is tested in the main repo, test/pwa-test.js, which reads both apps.)

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const PAGES = ['index.html', 'course.html', 'lesson.html', 'progress.html', 'report.html', 'subject.html', 'mock-exam.html'];

describe('HEADFACE Study PWA', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));

    test('manifest: its own app (name, standalone, scope, start page, colours)', () => {
        assert.equal(manifest.name, 'HEADFACE Study');
        assert.equal(manifest.short_name, 'Study');
        assert.equal(manifest.display, 'standalone');
        assert.equal(manifest.scope, '/');
        assert.equal(manifest.start_url, '/');
        assert.equal(manifest.theme_color.toLowerCase(), '#10b981');
    });

    test('manifest: 192 and 512 icons, normal and maskable, all exist', () => {
        for (const size of [192, 512]) {
            for (const purpose of ['any', 'maskable']) {
                const icon = manifest.icons.find((i) => i.sizes === `${size}x${size}` && i.purpose === purpose);
                assert.ok(icon, `${size} ${purpose}`);
                assert.ok(existsSync(path.join(ROOT, icon.src.replace(/^\//, ''))), icon.src);
            }
        }
        for (const f of ['apple-touch-icon.png', 'favicon-32x32.png', 'favicon-16x16.png']) assert.ok(existsSync(path.join(ROOT, 'assets/icons', f)), f);
    });

    test('the worker keeps only the offline page and never answers other requests', () => {
        const sw = read('pwa-worker.js');
        assert.match(sw, /addEventListener\('fetch'/);
        assert.match(sw, /request\.method !== 'GET'\) return/);
        assert.match(sw, /url\.origin !== self\.location\.origin\) return/);
        assert.match(sw, /request\.mode === 'navigate'/);
        assert.match(sw, /const OFFLINE_URL = '\/offline\.html'/);
        assert.match(sw, /const KEPT = \[OFFLINE_URL, '\/assets\/icons\/icon-192\.png'\]/);
        assert.ok(existsSync(path.join(ROOT, 'offline.html')));
    });

    test('every page links the manifest, the iOS tags, the touch icon and the registration script', () => {
        for (const page of PAGES) {
            const html = read(page);
            assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest">/, page);
            assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/, page);
            assert.match(html, /<link rel="apple-touch-icon" href="\/assets\/icons\/apple-touch-icon\.png">/, page);
            assert.match(html, /<script src="\/js\/pwa\.js" defer><\/script>/, page);
        }
    });

    test('_headers: manifest type and a worker that is never kept stale', () => {
        const headers = read('_headers');
        assert.match(headers, /\/manifest\.webmanifest\s+Content-Type: application\/manifest\+json/);
        assert.match(headers, /\/pwa-worker\.js\s+Cache-Control: no-cache\s+Service-Worker-Allowed: \//);
    });
});
