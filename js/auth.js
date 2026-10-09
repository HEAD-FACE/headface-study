/**
 * js/auth.js — HEADFACE Shared Auth Client สำหรับ Subdomain (study.headface.app)
 * รองรับทั้ง ES Module (import/export) และ Global Window Object (window.StudyAuth)
 */

export const API_BASE_URL = window.HEADFACE_API_BASE || 'https://beta-headface.ac-headface.workers.dev';
export const LOGIN_PAGE_URL = 'https://headface.app/login.html';

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
 * ตรวจสอบสถานะการล็อกอินกับ Backend Worker
 * @param {boolean} force - บังคับยิงเช็กใหม่โดยไม่สนแคช
 * @returns {Promise<object|null>} คืนค่า User Profile หรือ null
 */
export async function checkSession(force = false) {
    if (!force && cachedUser) return cachedUser;
    if (activeAuthPromise) return activeAuthPromise;

    activeAuthPromise = (async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
                method: 'GET',
                credentials: 'include', // 🔥 ส่ง hf_session ข้าม Subdomain อัตโนมัติ
                headers: { 'Accept': 'application/json' }
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

            // ถ้า HTTP 401 หรืออื่นๆ แปลว่าไม่ได้ล็อกอิน
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
 * ป้องกันหน้าเว็บ (Route Guard): หากยังไม่ล็อกอิน ให้พาไปหน้า Login กลางทันที
 */
export function requireAuth() {
    return checkSession().then(user => {
        if (!user) {
            redirectToLogin();
        }
        return user;
    });
}

/**
 * Redirect ผู้ใช้ไปยังหน้าล็อกอินกลาง พร้อมแนบ URL ปัจจุบันเพื่อให้ Redirect กลับมา
 */
export function redirectToLogin() {
    const currentUrl = window.location.href;
    const loginUrl = `${LOGIN_PAGE_URL}?redirect=${encodeURIComponent(currentUrl)}`;
    window.location.replace(loginUrl);
}

/**
 * ฟังก์ชันออกจากระบบ (Logout)
 */
export async function logout() {
    const csrfToken = getCookie('hf_csrf') || '';
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
    }

    try {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers
        });
    } catch (err) {
        console.warn('[StudyAuth] Logout network error:', err);
    }

    // ล้างแคชในฝั่ง Client
    cachedUser = null;
    sessionStorage.removeItem('study_user');
    localStorage.removeItem('study_user');

    // นำทางกลับหน้า Login
    window.location.replace(LOGIN_PAGE_URL);
}

function handleUnauthenticated() {
    cachedUser = null;
    sessionStorage.removeItem('study_user');
}

// Bind to window.StudyAuth for non-module script compatibility
if (typeof window !== 'undefined') {
    window.StudyAuth = {
        API_BASE_URL,
        LOGIN_PAGE_URL,
        getCookie,
        getAuthUser,
        checkSession,
        requireAuth,
        redirectToLogin,
        logout
    };
}
