/**
 * js/auth.js — HEADFACE Shared Auth Client สำหรับ Subdomain (study.headface.app)
 * รองรับทั้ง ES Module (import/export) และ Global Window Object (window.StudyAuth)
 */

export const API_BASE_URL = window.HEADFACE_API_BASE || 'https://beta-headface.ac-headface.workers.dev';
export const LOGIN_PAGE_URL = 'https://beta.headface.app/login';

let cachedUser = null;
let activeAuthPromise = null;

/**
 * ฟังก์ชันอ่านค่า Cookie จาก document.cookie
 */
export function getCookie(name) {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * ดึงข้อมูลผู้ใช้ปัจจุบันจากหน่วยความจำ (หรือ sessionStorage)
 */
export function getAuthUser() {
    if (cachedUser) return cachedUser;
    try {
        const stored = sessionStorage.getItem('study_user');
        if (stored) {
            cachedUser = JSON.parse(stored);
            return cachedUser;
        }
    } catch (_) {}
    return null;
}

/**
 * ดึงหรือขอ CSRF Token ล่าสุดจาก Backend (จะ Set-Cookie hf_csrf ให้ด้วย)
 */
export async function getCsrfToken() {
    let token = getCookie('hf_csrf') || sessionStorage.getItem('hf_csrf_token');
    if (!token) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.csrf_token) {
                    token = data.csrf_token;
                    sessionStorage.setItem('hf_csrf_token', token);
                }
            }
        } catch (err) {
            console.warn('[StudyAuth] getCsrfToken failed:', err);
        }
    }
    return token;
}

/**
 * ตรวจสอบสถานะการล็อกอินกับ Backend Worker ทุกครั้ง
 * @param {boolean} force - บังคับยิงเช็กกับเซิร์ฟเวอร์จริงทุกครั้ง (ค่าเริ่มต้น: true)
 * @returns {Promise<object|null>} คืนค่า User Profile หรือ null
 */
export async function checkSession(force = true) {
    if (!force && cachedUser) return cachedUser;
    if (activeAuthPromise && !force) return activeAuthPromise;

    activeAuthPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
                method: 'GET',
                credentials: 'include', // 🔥 ส่ง hf_session ข้าม Subdomain อัตโนมัติ
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'       // 🔥 บังคับยิงเช็กเซิร์ฟเวอร์จริง ห้ามแคช
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.user) {
                    cachedUser = data.user;
                    sessionStorage.setItem('study_user', JSON.stringify(cachedUser));
                    
                    // Dispatch Custom Event แจ้งเตือนทั้งหน้าเว็บว่า Auth พร้อมแล้ว
                    window.dispatchEvent(new CustomEvent('headface-auth-ready', { detail: { user: cachedUser } }));
                    return cachedUser;
                }
            }

            // ถ้า HTTP 401 หรือผลลัพธ์ไม่ถูกต้อง ถือว่าไม่มีเซสชัน
            handleUnauthenticated();
            return null;
        } catch (err) {
            console.error('[StudyAuth] Session check failed:', err);
            handleUnauthenticated();
            return null;
        } finally {
            activeAuthPromise = null;
        }
    })();

    return activeAuthPromise;
}

/**
 * ป้องกันหน้าเว็บ (Route Guard): ตรวจสอบสิทธิ์กับ Backend หากไม่มีเซสชัน ให้พาไปหน้า Login กลางทันที
 * @param {boolean} force - บังคับยิงเช็กกับเซิร์ฟเวอร์จริง (ค่าเริ่มต้น: true)
 */
export function requireAuth(force = true) {
    return checkSession(force).then(user => {
        if (!user) {
            redirectToLogin();
        }
        return user;
    });
}

/**
 * Redirect ผู้ใช้ไปยังหน้าล็อกอินกลาง (beta.headface.app/login) พร้อมแนบ URL ปัจจุบัน
 */
export function redirectToLogin() {
    const currentUrl = window.location.href;
    const loginUrl = `${LOGIN_PAGE_URL}?redirect=${encodeURIComponent(currentUrl)}`;
    window.location.replace(loginUrl);
}

/**
 * ฟังก์ชันออกจากระบบ (Logout)
 * ทำ Handshake ขอ CSRF Token จาก Backend เพื่อให้ Set-Cookie hf_csrf และ X-CSRF-Token ตรงกัน 100%
 * จากนั้นส่งคำขอ POST /api/auth/logout เพื่อยกเลิก Session Key ในฐานข้อมูล D1 จริง
 */
export async function logout() {
    // 1. ทำ Handshake ขอ CSRF Token สดใหม่จาก Backend ก่อนเสมอ
    // ขั้นตอนนี้จะบังคับให้ backend ส่ง Set-Cookie hf_csrf และคืน token ออกมาใน JSON
    let csrfToken = getCookie('hf_csrf') || sessionStorage.getItem('hf_csrf_token');
    try {
        const csrfRes = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });
        if (csrfRes.ok) {
            const csrfData = await csrfRes.json();
            if (csrfData?.csrf_token) {
                csrfToken = csrfData.csrf_token;
                sessionStorage.setItem('hf_csrf_token', csrfToken);
            }
        }
    } catch (e) {
        console.warn('[StudyAuth] Pre-logout CSRF handshake warning:', e);
    }

    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    // 2. ส่งคำขอ Logout ไปยัง Backend เพื่อเพิกถอน Session Key ใน D1
    try {
        const res = await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers
        });

        // หากติด 403 CSRF_VERIFICATION_FAILED ให้ลองขอ CSRF token ใหม่อีกครั้งแล้ว retry
        if (res.status === 403) {
            console.warn('[StudyAuth] Logout 403 CSRF, retrying with fresh CSRF token...');
            const retryCsrf = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
                method: 'GET',
                credentials: 'include',
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });
            if (retryCsrf.ok) {
                const retryData = await retryCsrf.json();
                if (retryData?.csrf_token) {
                    headers['X-CSRF-Token'] = retryData.csrf_token;
                    sessionStorage.setItem('hf_csrf_token', retryData.csrf_token);
                    await fetch(`${API_BASE_URL}/api/auth/logout`, {
                        method: 'POST',
                        credentials: 'include',
                        headers
                    });
                }
            }
        } else if (res.ok) {
            console.log('[StudyAuth] Successfully revoked session in backend D1');
        } else {
            console.warn('[StudyAuth] Logout responded with status:', res.status);
        }
    } catch (err) {
        console.warn('[StudyAuth] Logout network error:', err);
    }

    // 3. ล้างแคชในฝั่ง Client ทั้งหมด
    handleUnauthenticated();

    // 4. นำทางกลับหน้า Login กลาง
    redirectToLogin();
}

export function handleUnauthenticated() {
    cachedUser = null;
    sessionStorage.removeItem('study_user');
    sessionStorage.removeItem('hf_csrf_token');
    localStorage.removeItem('study_user');
}

// Bind to window.StudyAuth for non-module script compatibility
if (typeof window !== 'undefined') {
    window.StudyAuth = {
        API_BASE_URL,
        LOGIN_PAGE_URL,
        getCookie,
        getAuthUser,
        getCsrfToken,
        checkSession,
        requireAuth,
        redirectToLogin,
        logout,
        handleUnauthenticated
    };
}
