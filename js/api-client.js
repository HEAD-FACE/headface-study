/**
 * js/api-client.js — Centralized API Client สำหรับ Subdomain
 * จัดการ credentials: 'include' และ X-CSRF-Token อัตโนมัติทุกคำขอ
 */
import { API_BASE_URL, getCookie, redirectToLogin } from './auth.js';

export async function apiFetch(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const opts = { ...options };

    // 1. บังคับใส่ credentials: 'include' เพื่อส่งคุกกี้เซสชันเสมอ
    opts.credentials = 'include';

    // 2. จัดการ Headers
    const headers = new Headers(opts.headers || {});
    if (!headers.has('Content-Type') && !(opts.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    // 3. แนบ X-CSRF-Token สำหรับคำขอที่แก้ไขข้อมูล (POST, PUT, DELETE, PATCH)
    const method = (opts.method || 'GET').toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        const csrfToken = getCookie('hf_csrf');
        if (csrfToken) {
            headers.set('X-CSRF-Token', csrfToken);
        }
    }
    opts.headers = headers;

    // 4. ดำเนินการยิง Request
    const response = await fetch(url, opts);

    // 5. หากเซสชันหมดอายุ (HTTP 401) ให้พาผู้ใช้ไปล็อกอินใหม่
    if (response.status === 401) {
        console.warn('[API] Session expired or invalid (HTTP 401)');
        redirectToLogin();
        throw new Error('UNAUTHORIZED');
    }

    return response;
}

// Bind to window for non-module script compatibility
if (typeof window !== 'undefined') {
    window.apiFetch = apiFetch;
}
