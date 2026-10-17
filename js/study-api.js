/**
 * js/study-api.js — ตัวเรียก API ของ Study (สัญญา: docs/study-api-contract.md)
 *
 * ทุกคำขอไปที่ ${API_BASE_URL}/api/study ผ่าน apiFetch (แนบ cookie เซสชัน + X-CSRF-Token ให้เอง)
 * ผิดพลาดทุกกรณีโยน StudyApiError ที่มี code / status / message ภาษาไทยพร้อมแสดงผู้ใช้
 * createStudyApi รับฟังก์ชันส่งคำขอเข้ามา เพื่อให้เทสต์ใน Node ไม่ต้องพึ่งเบราว์เซอร์
 */
export const CONTRACT_VERSION = 2;

export class StudyApiError extends Error {
    constructor(code, status, message, body = null) {
        super(message || code);
        this.name = 'StudyApiError';
        this.code = code;
        this.status = status;
        this.body = body;
    }
}

const NETWORK_MESSAGE = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง';
const FALLBACK_MESSAGE = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';

/** @param {(path: string, options?: object) => Promise<Response>} send ส่งคำขอไปที่ path (ขึ้นต้นด้วย /api/study/...) */
export function createStudyApi(send) {
    async function request(path, { method = 'GET', body } = {}) {
        let response;
        try {
            response = await send(`/api/study${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        } catch (err) {
            if (err && err.message === 'UNAUTHORIZED') throw new StudyApiError('UNAUTHORIZED', 401, 'กรุณาเข้าสู่ระบบอีกครั้ง');
            throw new StudyApiError('NETWORK', 0, NETWORK_MESSAGE);
        }
        let data = null;
        try { data = await response.json(); } catch (_) { /* ไม่ใช่ JSON */ }
        if (!response.ok || !data || data.success !== true) {
            throw new StudyApiError((data && data.error) || `HTTP_${response.status}`, response.status, (data && data.message) || FALLBACK_MESSAGE, data);
        }
        return data;
    }

    const seg = (value) => encodeURIComponent(String(value));
    // กิจกรรม (วงกลมบนเส้นทาง) ถ้าระบุ nodeId ใช้เส้นทางของ node ไม่ระบุ = node แรกของชนิดนั้นในบท (สัญญาข้อแรก)
    const lessonPath = (subjectId, no, nodeId) => `/subjects/${seg(subjectId)}/lessons/${seg(no)}${nodeId ? `/nodes/${seg(nodeId)}` : ''}`;
    return {
        request,
        getMe: () => request('/me'),
        listSubjects: () => request('/subjects'),
        getSubject: (subjectId) => request(`/subjects/${seg(subjectId)}`),
        getLesson: (subjectId, no) => request(`/subjects/${seg(subjectId)}/lessons/${seg(no)}`),
        getNode: (subjectId, no, nodeId) => request(`${lessonPath(subjectId, no, nodeId)}`),
        setNodeProgress: (subjectId, no, nodeId, progress) => request(`${lessonPath(subjectId, no, nodeId)}/progress`, { method: 'PUT', body: progress }),
        setRead: (subjectId, no, read) => request(`/subjects/${seg(subjectId)}/lessons/${seg(no)}/read`, { method: 'PUT', body: { read } }),
        startQuiz: (subjectId, no, nodeId) => request(`${lessonPath(subjectId, no, nodeId)}/quiz-attempts`, { method: 'POST', body: {} }),
        // answer = คำตอบของโจทย์รูปแบบใดก็ได้ (id ตัวเลือก / รายการ / ออบเจ็กต์ / ตัวเลข) ดู study-qformats.js
        // ข้อความ (id ตัวเลือก) ส่ง choiceId ไปด้วย เพื่อให้ Backend รุ่นก่อนข้อ 2.12 ยังรับโจทย์เลือก 1 ข้อได้
        answerQuiz: (attemptId, questionId, answer) => request(`/quiz-attempts/${seg(attemptId)}/answer`, { method: 'POST', body: { questionId, answer, ...(typeof answer === 'string' ? { choiceId: answer } : {}) } }),
        submitQuiz: (attemptId) => request(`/quiz-attempts/${seg(attemptId)}/submit`, { method: 'POST', body: {} }),
        getProgress: () => request('/progress'),
        getSubjectProgress: (subjectId) => request(`/progress/subjects/${seg(subjectId)}`),
        getPractice: (subjectId, no, nodeId) => request(`${lessonPath(subjectId, no, nodeId)}/practice`),
        getSolution: (subjectId, no, questionId, nodeId) => request(`${lessonPath(subjectId, no, nodeId)}/practice/${seg(questionId)}/solution`),
        setPracticeResult: (subjectId, no, questionId, result, nodeId) => request(`${lessonPath(subjectId, no, nodeId)}/practice/${seg(questionId)}/result`, { method: 'PUT', body: { result } }),
        resetPractice: (subjectId, no, nodeId) => request(`${lessonPath(subjectId, no, nodeId)}/practice/results`, { method: 'DELETE' }),
        getMockInfo: (subjectId) => request(`/subjects/${seg(subjectId)}/mock`),
        startMock: (subjectId) => request(`/subjects/${seg(subjectId)}/mock-attempts`, { method: 'POST', body: {} }),
        getMockAttempt: (attemptId) => request(`/mock-attempts/${seg(attemptId)}`),
        saveMockAnswers: (attemptId, state) => request(`/mock-attempts/${seg(attemptId)}/answers`, { method: 'PUT', body: state }),
        submitMock: (attemptId, state = {}) => request(`/mock-attempts/${seg(attemptId)}/submit`, { method: 'POST', body: state }),
    };
}

// เบราว์เซอร์: โหลด apiFetch เมื่อใช้งานจริงเท่านั้น (api-client.js ผูกกับ auth.js ซึ่งต้องมี window)
export const studyApi = createStudyApi((path, options) => import('./api-client.js').then((m) => m.apiFetch(path, options)));
