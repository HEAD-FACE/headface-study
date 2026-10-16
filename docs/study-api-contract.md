# HEADFACE Study — สัญญา API (Contract v2)

เอกสารนี้เป็นสัญญากลางระหว่าง Backend (`src/study/` ใน Worker `headface`) กับ Frontend (`js/study-api.js`)
ใช้เป็นแหล่งอ้างอิงเดียวสำหรับทั้งโค้ดและเทสต์ (fixture JSON จะสร้างจากตัวอย่างในเอกสารนี้ตอน M1)

สถานะ: **v1 ตกลงแล้ว (M0)** และ **ทำครบ M1–M4 ในโค้ดแล้ว** (Backend `src/study/*`, Frontend `js/study-*.js`) — ตัวอย่าง JSON ในเอกสารนี้ตรงกับที่ Backend ตอบจริง (ตรวจด้วยเทสต์ของทั้งสองฝั่ง) ผู้ใช้ตอบข้อ 5 ครบเมื่อ 2026-10-14 (ดูท้ายเอกสาร)

**v2 (2026-10-16): กิจกรรม (node) — วงกลมบนเส้นทางเรียน.** บทเรียนไม่ใช่ก้อนเดียวที่มีแท็บเนื้อหา/Quiz/Practice อีกต่อไป แต่เป็นรายการของ **node** แต่ละ node = กิจกรรม 1 อย่าง (ชุดเนื้อหาหลายหน้า / Quiz 1 ชุด / Practice 1 ชุด) ที่เปิดจากวงกลม 1 วง
ดู **ข้อ 2.10** (ภาพรวมและกติกา) การเปลี่ยนแปลงอื่นของ v2 อยู่ในข้อที่เกี่ยวข้อง ทำเครื่องหมาย **(v2)** — เส้นทางระดับบทของ v1 ยังใช้ได้ทั้งหมด (หมายถึง node แรกของชนิดนั้นในบท) และบทที่เขียนด้วย `blocks` แบบเดิมถูกแปลงเป็น node ให้เอง
สื่อ (ภาพ/วิดีโอ) ใส่ได้ในเนื้อหา โจทย์ Quiz/Practice/Mock และตัวเลือก (ข้อ 2.10.4)

---

## 0. ข้อกำหนดทั่วไป

| หัวข้อ | กติกา |
|---|---|
| Base URL | `${API_BASE_URL}/api/study` (`API_BASE_URL` มาจาก `js/env.js` ตามโดเมนของหน้า) |
| Auth | cookie `hf_session` (ส่งด้วย `credentials: 'include'`) — **ไม่รับ token ใน URL** |
| CSRF | ทุก request ที่ไม่ใช่ GET ต้องมี header `X-CSRF-Token` (ใช้ `apiFetch` ที่แนบให้อัตโนมัติ) |
| CORS | ตาม allowlist เดิมของ Worker (`applyCorsHeaders`) |
| รูปแบบ | JSON UTF-8, `Cache-Control: no-store` ทุก response |
| เวลา | จำนวนเต็ม **epoch มิลลิวินาที** (`*At`) และ `serverNow` ใน response ที่เกี่ยวกับเวลาสอบ; Frontend เป็นผู้จัดรูปแบบวันที่ไทย |
| รหัสผู้ใช้ | ไม่ส่งใน URL/body เลย — Backend อ่านจาก session เท่านั้น |
| รหัสวิชา | slug ตัวพิมพ์เล็ก เช่น `sci`, `mat` (ตรงกับ `?s=` ใน URL หน้า Frontend) `^[a-z][a-z0-9-]{1,23}$` |
| เลขบท | `no` จำนวนเต็มบวกนับต่อเนื่องทั้งวิชา (ไม่รีเซ็ตตามหน่วย) ตรงกับ `?l=` ใน URL; ที่ path ใช้ได้ `current` = บทที่ค้าง |
| รหัส attempt/คำถาม | สตริงทึบ (opaque) ห้าม Frontend ตีความ |
| จำนวนผลลัพธ์ | รายการประวัติคืนล่าสุดไม่เกิน 20 รายการ |

### Response

สำเร็จ: `HTTP 200` (สร้างใหม่ `201`) → `{ "success": true, ... }`
ล้มเหลว: `{ "success": false, "error": "CODE", "message": "ข้อความไทยที่แสดงผู้ใช้ได้" }` (+ `details` เมื่อจำเป็น)
ข้อความ error **ไม่เคยมีเฉลย ชื่อไฟล์ หรือ SQL**

| HTTP | `error` | ความหมาย |
|---|---|---|
| 400 | `BAD_REQUEST` | body/พารามิเตอร์ไม่ถูกต้อง (รวมเกินขนาด 64 KB) |
| 401 | `UNAUTHORIZED` | ไม่มี session หรือหมดอายุ → Frontend พาไปหน้า login (ทำใน `apiFetch` อยู่แล้ว) |
| 403 | `CSRF_INVALID` | ตรวจ CSRF ไม่ผ่าน |
| 403 | `FEATURE_FORBIDDEN` | แพลนไม่มีสิทธิ์ (`details.feature` = เช่น `study.mock`) |
| 403 | `FORBIDDEN_NOT_ADMIN` | เส้นทาง admin |
| 404 | `NOT_FOUND` | ไม่พบ **หรือยังไม่ Published** (ไม่บอกความต่าง เพื่อไม่เปิดเผยว่ามี Draft) และใช้กับ attempt ของคนอื่น |
| 409 | `ATTEMPT_CLOSED` | attempt ส่ง/หมดเวลาไปแล้ว (แนบ `details.result` ถ้าเป็น mock) |
| 429 | `FEATURE_QUOTA_EXCEEDED` | ใช้เกินโควตาของแพลน (`details.usage/limit/period`) |
| 429 | `RATE_LIMITED` | เริ่มทำถี่เกินไป: Quiz ไม่เกิน 60 ครั้ง/ชั่วโมง, Mock Test ไม่เกิน 30 ครั้ง/ชั่วโมง ต่อคน |
| 409 | `QUIZ_UNAVAILABLE` | บทนี้ไม่มีโจทย์ Quiz ที่เผยแพร่แล้ว |
| 409 | `MOCK_UNAVAILABLE` | ชุด Mock ยังไม่เผยแพร่หรือโจทย์ standard ไม่พอ |
| 405 | `METHOD_NOT_ALLOWED` | ใช้วิธีเรียกที่ path นี้ไม่รองรับ (มี header `Allow`) |
| 503 | `STUDY_NOT_READY` | ฐานข้อมูลยังไม่มีตาราง/คอลัมน์ของ Study: ถ้าขาด migration 0006 (ตารางเนื้อหา) หรือ 0008 (คอลัมน์ node/สื่อของเนื้อหา) ทุกเส้นทางตอบ 503; ถ้าขาดเฉพาะ 0007 / 0009 (ตารางข้อมูลผู้เรียน) การอ่านยังใช้ได้เป็น "ยังไม่มีความคืบหน้า" แต่การบันทึกตอบ 503 (Worker log จะมีบรรทัด `[study] database not ready`) — รัน migration **ก่อน** deploy Worker เสมอ |
| 500 | `INTERNAL_ERROR` | ข้อผิดพลาดภายใน (รายละเอียดอยู่ใน server log เท่านั้น) |

---

## 1. กฎด้านความถูกต้องของข้อสอบ (ต้องผ่านเทสต์)

1. **ไม่มีเฉลยในโจทย์**: ฟิลด์ `correct`, `correctChoiceId`, `explanation`, `solution` ไม่ปรากฏใน response ใดที่ส่งโจทย์ออกไป
2. **Quiz**: เฉลย+คำอธิบายของข้อใด ส่งกลับเฉพาะหลังตอบข้อนั้นแล้ว (response ของ `answer`) หรือหลัง `submit`
3. **Mock**: ไม่มีเฉลยจนกว่าสถานะเป็น `submitted`/`expired`
4. **Practice**: เฉลยส่งเมื่อผู้เรียนขอดูเท่านั้น (endpoint `solution`)
5. **เวลาสอบเป็นของ server**: `deadlineAt = startedAt + durationSec*1000`; คำตอบที่ถึง server หลัง `deadlineAt + 15 วินาที` ถูกทิ้ง
6. **ตรึงชุดข้อสอบ**: โจทย์และลำดับถูกสุ่ม/เลือกตอนเริ่ม แล้วเก็บใน attempt; ผลย้อนดูได้ครบแม้ภายหลังเนื้อหาถูกแก้
7. **เจ้าของ attempt เท่านั้น**: อ่าน/แก้ attempt ของคนอื่น → `404 NOT_FOUND`
8. **ตอบซ้ำได้ผลเดิม** (idempotent): ตอบข้อเดิมซ้ำใน Quiz คืนผลเดิมพร้อม `alreadyAnswered: true` ไม่เปลี่ยนคำตอบ

---

## 2. นักเรียน

### 2.1 `GET /me`
สิทธิ์ที่เกี่ยวกับ Study (ใช้แทน `/me/entitlements` ที่รับเฉพาะ token)

```json
{
  "success": true,
  "contractVersion": 1,
  "serverNow": 1790932177871,
  "plan": { "id": "plus", "name": "HEADFACE+" },
  "entitlements": {
    "quiz":            { "enabled": true,  "limit": null },
    "mock":            { "enabled": true,  "limit": null, "period": null },
    "quizAdvanced":    { "enabled": true },
    "mockAdvanced":    { "enabled": true },
    "aiTutor":         { "enabled": true,  "limit": 5, "period": "daily" },
    "summaryMedia":    { "enabled": true },
    "interactiveMedia":{ "enabled": true },
    "videoSummary":    { "enabled": true }
  }
}
```
ถ้า `contractVersion` ไม่ตรงกับที่ Frontend รองรับ ให้แสดงข้อความ "กรุณารีเฟรชหน้า"

### 2.2 `GET /subjects`
รายวิชาที่ Published พร้อมความคืบหน้าของผู้ใช้ (ใช้กับ Home, Subjects, Progress)

```json
{
  "success": true,
  "serverNow": 1790932177871,
  "subjects": [
    {
      "id": "sci", "no": 1,
      "title": "วิทยาศาสตร์",
      "eyebrow": "วิชาที่ 1 • วิทยาศาสตร์",
      "description": "…",
      "metaText": "16 บทเรียน • 110 แบบฝึกหัด",
      "hue": "emerald", "emoji": "🔬",
      "lessonsTotal": 16, "lessonsDone": 12, "pct": 75,
      "state": "in_progress",
      "current": { "no": 13, "title": "กรด-เบสและการแตกตัว" },
      "lastActivityAt": 1790932000000,
      "mock": { "available": true, "attempts": 2, "lastPercent": 70 }
    }
  ]
}
```
- `state`: `not_started` | `in_progress` | `completed` (ตัวกรอง "กำลังเรียน / เรียนจบ / ยังไม่เริ่ม" ตาม Blueprint 5.2)
- `current`: บทแรกที่ยังไม่ `done`; `null` เมื่อเรียนครบ
- `pct = round(lessonsDone / lessonsTotal * 100)`; `lessonsTotal` นับเฉพาะบท Published
- `hue`/`emoji` อาจเป็น `null` → Frontend ใช้ค่าเริ่มต้น (ภาพเคลื่อนไหวเฉพาะวิชามีเฉพาะ 10 key ที่รู้จัก)
- **API ส่งเฉพาะวิชาที่ Published** วิชาที่ยังไม่เผยแพร่ไม่ปรากฏในรายการ (บอกไม่ได้ว่ามี Draft) — การ์ด 10 วิชาในหน้า Home/Subjects เป็น HTML ตายตัวของ Frontend; วิชาที่ไม่อยู่ใน response แสดงเป็น "เร็ว ๆ นี้" ไม่มีลิงก์และไม่มีตัวเลข

### 2.3 `GET /subjects/:subjectId`
หน้ารายละเอียดวิชา (Course Outline)

```json
{
  "success": true,
  "subject": {
    "id": "sci", "no": 1, "title": "วิทยาศาสตร์", "eyebrow": "วิชาที่ 1 • วิทยาศาสตร์",
    "description": "…", "objectives": ["…"], "level": "ม.ปลาย", "metaText": "…",
    "hue": "emerald", "emoji": "🔬"
  },
  "progress": { "lessonsTotal": 16, "lessonsDone": 12, "pct": 75, "lastActivityAt": 1790932000000 },
  "current": { "no": 13, "title": "กรด-เบสและการแตกตัว", "node": { "id": "sci-n21", "type": "content", "title": "pH และกระดาษลิตมัส" } },
  "units": [
    {
      "no": 1, "id": "sci-u1", "title": "สารและสมบัติของสาร",
      "doneCount": 4, "lessonCount": 4,
      "lessons": [
        {
          "no": 1, "title": "…", "summary": "…",
          "status": "done",
          "access": "open",
          "estimatedMin": 15,
          "activities": {
            "content":  { "done": true },
            "quiz":     { "done": true, "best": { "correct": 4, "total": 5 }, "attempts": 2 },
            "practice": { "done": 3, "ok": 2, "total": 6 }
          },
          "nodes": [
            { "id": "sci-n01", "type": "content", "title": "pH และกระดาษลิตมัส", "status": "done", "pageCount": 3,
              "progress": { "pageCount": 3, "pageReached": 2, "completedAt": 1790930000000 } },
            { "id": "sci-z01", "type": "quiz", "title": "Quiz: กรด-เบส", "status": "done", "questionCount": 4,
              "progress": { "attempts": 2, "best": { "correct": 4, "total": 4 }, "last": { "correct": 3, "total": 4, "at": 1790931000000 }, "passed": true, "passPct": 50 } },
            { "id": "sci-p01", "type": "practice", "title": "ฝึก: กรด-เบส", "status": "todo",
              "progress": { "done": 0, "ok": 0, "wrong": 0, "total": 3 } }
          ]
        }
      ]
    }
  ],
  "mock": { "available": true, "attempts": 2, "lastPercent": 70, "lastAt": 1790930000000 }
}
```
- `status` ของบท: `todo` | `now` | `done` — `done` = **ทุก node เนื้อหาจบแล้ว และทุก node Quiz (ที่มีโจทย์) ผ่านเกณฑ์แล้ว (v2; ข้อ 2.10.2)**; `now` = บทที่ค้างหรือที่เริ่มกิจกรรมแล้วแต่ยังไม่ `done`
- เกณฑ์ผ่าน Quiz = `quizPassPct` ของบท **ค่าเริ่มต้น 50** (ตั้งต่อ node ได้ด้วย `passPct`): ผ่านเมื่อมี **การทำ 1 ครั้ง** ที่ `correct × 100 ≥ เกณฑ์ × total` (ไม่รวมคะแนนหลายครั้ง และไม่ปัดเศษ — เช่น 5 ข้อต้องถูก ≥ 3); เกณฑ์ `null` หมายถึง "ส่ง Quiz อย่างน้อย 1 ครั้งก็ผ่าน" — **อ่านจบอย่างเดียวไม่ทำให้บทเสร็จ** (Blueprint 7.3)
- `nodes[]` (v2): วงกลมของบทตามลำดับ; `status` ของ node = `done` | `now` | `todo` โดย `now` มี **วงเดียวทั้งวิชา** (กิจกรรมถัดไปที่ต้องทำ: เนื้อหา/Quiz ตัวแรกที่ยังไม่เสร็จ ข้าม Practice) ทุกวงเปิดได้เสมอ (`access: open`, ไม่ล็อก)
- `access`: `open` | `locked` (ช่องสำหรับข้อจำกัดสิทธิ์ตาม Blueprint 6.2; ตอนนี้เป็น `open` ทุกบท)
- ถ้า Mock ของวิชายังไม่ Published หรือโจทย์ standard ที่เผยแพร่แล้วยังไม่พอ → `mock.available = false`
- วิชาไม่มีอยู่/ยังไม่ Published → `404 NOT_FOUND`

### 2.4 `GET /subjects/:subjectId/lessons/:no`
เนื้อหาบท (`:no` เป็นเลข หรือ `current`) — **GET นี้ไม่เขียนข้อมูล**

```json
{
  "success": true,
  "subject": { "id": "sci", "title": "วิทยาศาสตร์", "eyebrow": "วิชาที่ 1 • วิทยาศาสตร์", "hue": "emerald", "emoji": "🔬", "lessonsTotal": 16 },
  "lesson": {
    "subjectId": "sci", "no": 13, "title": "กรด-เบสและการแตกตัว",
    "unit": { "no": 4, "title": "…" },
    "summary": "…", "estimatedMin": 15,
    "blocks": [
      { "type": "heading",   "text": "…" },
      { "type": "paragraph", "text": "…" },
      { "type": "figure",    "kind": "image", "url": "https://…", "alt": "…", "caption": "…" },
      { "type": "figure",    "kind": "video", "url": "https://…", "caption": "…" },
      { "type": "callout",   "title": "สูตรสำคัญ / คำศัพท์", "text": "…" },
      { "type": "steps",     "title": "ตัวอย่างและวิธีคิด", "items": ["…", "…"] },
      { "type": "checklist", "title": "สรุปเนื้อหาสำคัญ", "items": ["…", "…"] }
    ],
    "progress": {
      "status": "now",
      "contentReadAt": null,
      "quiz": { "attempts": 1, "best": { "correct": 3, "total": 5 }, "last": { "correct": 3, "total": 5, "at": 1790932000000 }, "passed": false },
      "practice": { "done": 2, "ok": 1, "wrong": 1, "total": 6 }
    },
    "quiz":     { "available": true, "questionCount": 5, "passPct": 50 },
    "practice": { "total": 6, "byLevel": { "easy": 2, "medium": 2, "hard": 2 } },
    "nav": { "prev": { "no": 12, "title": "…" }, "next": { "no": 14, "title": "…" } }
  }
}
```
- `quiz.passPct` = เกณฑ์ผ่านของบท (`null` = ทำครบ 1 ครั้งก็ผ่าน); `quiz.questionCount` = จำนวนข้อที่จะได้ (ขึ้นกับ `quizSize` และโจทย์ที่แพลนนี้เข้าถึงได้)
- `current` ใช้ได้ที่ `:no` — คือบทแรกที่ยังไม่ `done`; ถ้าเรียนครบทุกบทแล้วคือบทสุดท้าย
- ชนิดบล็อกที่รองรับ (ไม่บังคับครบ ตามข้อ 7.1): `heading`, `paragraph`, `figure` (`image`|`video`), `callout`, `steps`, `checklist`
- **ข้อความทุกช่องเป็น plain text** — Frontend ต้องแสดงด้วย `textContent`/escape เสมอ ห้ามมี HTML (Backend ปฏิเสธตอน Import)
- `url` ของสื่อ: `https://…` หรือไฟล์ใต้ `assets/` ของเว็บ (เช่น `assets/study/sci/ph-scale.svg`) เท่านั้น (v2)
- (v2) `blocks` = บล็อกของทุกหน้าของทุก node เนื้อหาในบท ต่อกันเป็นรายการเดียว (ไว้ให้ Frontend รุ่นเก่า) และมี `lesson.nodes` (รูปเดียวกับข้อ 2.3) — หน้าใหม่ใช้ `GET …/nodes/:nodeId` (ข้อ 2.10.3)

### 2.5 `PUT /subjects/:subjectId/lessons/:no/read`
```json
{ "read": true }
```
→ `{ "success": true, "progress": { …เหมือน lesson.progress… } }` — `read:false` ยกเลิกได้
อัปเดต `lastActivityAt`
(v2) หมายถึง **ทุก node เนื้อหาของบท** ถูกทำเครื่องหมายว่าจบ/ยกเลิกพร้อมกัน; หน้าใหม่ใช้ `PUT …/nodes/:nodeId/progress` ต่อชุดเนื้อหา (ข้อ 2.10.3)

### 2.6 Quiz

**เริ่ม** `POST /subjects/:subjectId/lessons/:no/nodes/:nodeId/quiz-attempts` body `{}` (v2: Quiz 1 ชุด = 1 node; เส้นทางเดิม `…/lessons/:no/quiz-attempts` หมายถึง node Quiz แรกของบท; node ที่ไม่ใช่ Quiz → `404`)
- เลือกโจทย์ `kind=mcq` ที่ `uses` มี `quiz` **และผูกกับ node นี้**: ทุกคน = `tier: standard`; ผู้มี `study.quiz_advanced` = standard + advanced; จำนวน = `quizSize` ของ node (ไม่ตั้ง = ของบท; ไม่ตั้ง = 5 หรือเท่าที่มี)
- ต้องผ่าน `study.quiz` (`FEATURE_FORBIDDEN` ถ้าไม่มี)
- attempt ที่ยังไม่ส่งของ **Quiz ชุดเดียวกัน** ถูกปิดเป็น `abandoned` (Quiz ชุดอื่นของบทเดียวกันไม่ถูกแตะ; ตอบ/ส่งชุดที่ถูกปิดแล้ว → `409 ATTEMPT_CLOSED`)
- ไม่มีโจทย์ → `409 QUIZ_UNAVAILABLE`; เริ่มเกิน 60 ครั้ง/ชั่วโมง → `429 RATE_LIMITED`; การเริ่มแต่ละครั้งถูกนับในโควตาของ `study.quiz` (ถ้าแอดมินตั้ง limit ไว้เกิน → `429 FEATURE_QUOTA_EXCEEDED`)

```json
{
  "success": true,
  "attempt": {
    "id": "qa_8f3k2…", "status": "in_progress", "startedAt": 1790932000000,
    "total": 5,
    "node": { "id": "sci-z01", "title": "Quiz: กรด-เบส" },
    "questions": [
      { "id": "q_a1b2…", "n": 1, "topic": "กรด-เบส", "text": "…",
        "media": [ { "kind": "image", "url": "assets/study/sci/ph-scale.svg", "alt": "…", "caption": "…" } ],
        "choices": [ { "id": "a", "text": "…" }, { "id": "b", "text": "…", "image": { "url": "https://…", "alt": "…" } }, { "id": "c", "text": "…" }, { "id": "d", "text": "…" } ] }
    ]
  }
}
```
UI แสดงป้ายตัวเลือก ก ข ค ง ตามลำดับตำแหน่ง ไม่ใช่จาก `id`
(v2) `media` = รายการสื่อประกอบโจทย์ (ว่างได้) และตัวเลือกมี `image` ได้ — ดูข้อ 2.10.4; **สื่อไม่เคยมีเฉลย** (Backend ไม่ส่งคำใบ้ใดนอกจากที่ผู้เขียนใส่ในสื่อเอง)

**ตอบรายข้อ** `POST /quiz-attempts/:attemptId/answer`
```json
{ "questionId": "q_a1b2…", "choiceId": "b" }
```
→
```json
{ "success": true, "alreadyAnswered": false,
  "feedback": { "questionId": "q_a1b2…", "isCorrect": false, "yourChoiceId": "b", "correctChoiceId": "c", "explanation": "…", "topic": "กรด-เบส" } }
```
เปลี่ยนคำตอบหลังเห็นเฉลยไม่ได้: ตอบข้อเดิมซ้ำคืนคำตอบแรกที่บันทึกไว้พร้อม `alreadyAnswered: true` (ใช้ `choiceId` ที่ไม่ได้อยู่ในข้อนั้น → `400`; ข้อที่ไม่ได้อยู่ในชุดนี้ → `400`; ชุดของคนอื่น → `404`)

**ส่ง** `POST /quiz-attempts/:attemptId/submit` body `{}`
ข้อที่ไม่ได้ตอบนับเป็นไม่ถูก
```json
{
  "success": true,
  "result": {
    "attemptId": "qa_8f3k2…", "correct": 3, "total": 5, "answered": 5, "percent": 60,
    "passed": null,
    "review": [
      { "questionId": "q_a1b2…", "n": 1, "topic": "กรด-เบส", "text": "…", "media": [],
        "choices": [ { "id": "a", "text": "…" } ],
        "yourChoiceId": "b", "correctChoiceId": "c", "isCorrect": false, "explanation": "…" }
    ]
  },
  "node": { "id": "sci-z01", "status": "now", "progress": { "attempts": 2, "best": { "correct": 3, "total": 5 }, "last": { "correct": 3, "total": 5, "at": 1790932000000 }, "passed": false, "passPct": 60 } },
  "lesson": { "status": "now", "quiz": { "attempts": 2, "best": { "correct": 3, "total": 5 }, "passed": false } },
  "current": { "lessonNo": 2, "nodeId": "sci-n03", "type": "content" }
}
```
(v2) `node` = ผลของ Quiz ชุดนี้ (สถานะวงกลม + ความคืบหน้า), `lesson` = สถานะของบท, `current` = กิจกรรมถัดไปของทั้งวิชา (หรือ `null` เมื่อครบ)
- `passed`: `true`/`false` ตามเกณฑ์ `quizPassPct` ของบท (ค่าเริ่มต้น 50) เฉพาะ **ครั้งนี้**; `null` เฉพาะบทที่ตั้ง `quizPassPct = null`
- ส่งซ้ำ → `200` ผลเดิม (idempotent)
- ข้อความให้กำลังใจ ("ยอดเยี่ยม/ทำได้ดี…") เป็นหน้าที่ Frontend คำนวณจาก `percent`

### 2.7 Practice (ผู้เรียนกด "ทำถูก/ทำผิด" เอง ตาม UI ปัจจุบัน)

`GET /subjects/:subjectId/lessons/:no/nodes/:nodeId/practice` (v2: Practice 1 ชุด = 1 node; เส้นทางเดิม `…/lessons/:no/practice` = node Practice แรกของบท และตอบรายการว่างถ้าบทไม่มี; โจทย์/เฉลย/ผล/ล้างผลของแต่ละชุดแยกกัน)
```json
{
  "success": true,
  "node": { "id": "sci-p01", "title": "ฝึก: กรด-เบส" },
  "summary": { "total": 6, "done": 2, "ok": 1, "wrong": 1 },
  "items": [
    { "id": "q_c3d4…", "n": 1, "level": "easy", "topic": "…", "text": "…", "media": [], "result": "ok" },
    { "id": "q_e5f6…", "n": 2, "level": "medium", "topic": "…", "text": "…", "media": [], "result": null }
  ]
}
```
- `level`: `easy` | `medium` | `hard` (UI แปลงเป็น ง่าย/กลาง/ยาก); `result`: `ok` | `wrong` | `null`
- โจทย์ Practice เป็นชนิด `open` (โจทย์ + เฉลยวิธีคิด) ไม่ใช่ตัวเลือก; **ไม่แยก tier** (ทุกคนเห็นเหมือนกัน) เรียงตามลำดับในไฟล์นำเข้า
- ผลที่กดเอง **ไม่ทำให้บทเสร็จ ไม่นับเป็นดาว และไม่ใช้วิเคราะห์จุดอ่อน** (เป็นแค่กิจกรรมของบทและช่วยให้ผู้เรียนติดตามตัวเอง); โจทย์ที่ถูกถอนออก (ไม่ Published) ไม่ถูกนับ
- โจทย์/เฉลยของบทอื่นหรือของ Quiz → `404`; `result` นอกจาก `ok|wrong` → `400`

`GET …/practice/:questionId/solution` → `{ "success": true, "questionId": "q_c3d4…", "solution": "…" }`
`PUT …/practice/:questionId/result` body `{ "result": "ok" | "wrong" }` → `{ "success": true, "summary": { … } }`
`DELETE …/practice/results` → `{ "success": true, "summary": { "total": 6, "done": 0, "ok": 0, "wrong": 0 } }`
(ทั้งสามมีรูปแบบ node ด้วย: `…/lessons/:no/nodes/:nodeId/practice/…` — โจทย์ของ Practice ชุดอื่นในบทเดียวกัน → `404`; ล้างผลล้างเฉพาะชุดนั้น)

### 2.8 Mock Test

`GET /subjects/:subjectId/mock` — เงื่อนไขก่อนสอบ + ประวัติ
```json
{
  "success": true, "serverNow": 1790932177871,
  "subject": { "id": "sci", "title": "วิทยาศาสตร์", "eyebrow": "วิชาที่ 1 • วิทยาศาสตร์", "hue": "emerald", "emoji": "🔬" },
  "mock": {
    "available": true,
    "title": "Mock Exam ประจำวิชาวิทยาศาสตร์",
    "questionCount": 10, "durationMin": 20, "passMarkPct": null,
    "format": "mcq",
    "stars": { "timeBonusPct": 25 },
    "advanced": { "unlocked": true }
  },
  "active": null,
  "history": [
    { "attemptId": "ma_9x…", "status": "submitted", "startedAt": 1790930000000, "submittedAt": 1790931000000,
      "correct": 7, "total": 10, "percent": 70, "secondsUsed": 900, "starsEarned": 8 }
  ],
  "best": { "percent": 70, "attemptId": "ma_9x…" },
  "deltaVsPrevious": 10
}
```
- `passMarkPct: null` = ยังไม่กำหนด (UI แสดง `[ยังไม่กำหนด]`)
- `advanced.unlocked = false` สำหรับ FREE → UI แสดงว่า PLUS/MAX มีข้อพิเศษและดาวมากกว่า (ข้อความโฆษณาเป็นการตัดสินใจฝั่ง UI)
- `active` = `{ "attemptId", "deadlineAt" }` เมื่อมีการสอบค้างอยู่ → UI เสนอ "ทำต่อ"
- `deltaVsPrevious` = ผลต่าง percent ของ 2 ครั้งล่าสุดที่ส่งแล้ว; `null` ถ้ายังไม่ถึง 2 ครั้ง
- ชุดที่ยังไม่เผยแพร่: `200` โดย `mock.available = false` และฟิลด์ `title/questionCount/durationMin/passMarkPct` เป็น `null` (วิชาไม่เผยแพร่ → `404`)
- `history` ล่าสุดก่อน ไม่เกิน 20 รายการ (รวม `expired`); ข้อสอบที่หมดเวลาแล้วจะถูกตรวจ/ปิดก่อนตอบ จึงไม่ค้างเป็น `active`

**เริ่ม** `POST /subjects/:subjectId/mock-attempts` body `{}` → `201`
- ต้องผ่าน `study.mock`; ไม่จำกัดจำนวนครั้งต่อวันสำหรับ FREE (ตามที่ตัดสินใจ — ผ่านค่าใน `featureRegistry` เดิม)
- มี attempt `in_progress` อยู่แล้ว → คืนอันเดิม (`200`, `resumed: true`) ไม่สร้างซ้ำ และไม่นับเป็นการใช้ใหม่ (สร้างใหม่ตอบ `201`, `resumed: false`); เริ่มพร้อมกัน 2 คำขอได้ attempt เดียว
- attempt เดิมที่เลยเวลา+ผ่อนผันแล้วถูกตรวจเป็น `expired` ก่อน แล้วจึงเริ่มชุดใหม่
- เกิน 30 ครั้ง/ชั่วโมง → `429 RATE_LIMITED`; ชุดไม่พร้อม → `409 MOCK_UNAVAILABLE`; การเริ่มแต่ละครั้งนับในโควตา `study.mock`
- pool: ทุกคน = standard; ผู้มี `study.mock_advanced` = standard + advanced; สุ่ม `questionCount` ข้อแล้วตรึงลำดับ

```json
{
  "success": true, "resumed": false, "serverNow": 1790932177871,
  "attempt": {
    "id": "ma_9x…", "status": "in_progress",
    "startedAt": 1790932177871, "deadlineAt": 1790933377871, "durationSec": 1200,
    "total": 10,
    "questions": [
      { "id": "q_…", "n": 1, "topic": "…", "text": "…", "special": false,
        "choices": [ { "id": "a", "text": "…" } ] }
    ],
    "answers": {}, "flags": []
  }
}
```
`special: true` = ข้อใน pool ขั้นสูง (UI จะแสดงป้ายหรือไม่ก็ได้) — ไม่เปิดเผยค่าดาวของข้อ

**ทำต่อ** `GET /mock-attempts/:attemptId`
- `in_progress` → รูปเดียวกับด้านบน พร้อม `answers` / `flags` ที่บันทึกไว้ และ `serverNow`
- ถ้าเลย `deadlineAt + 15s` → server ตรวจและปิดเป็น `expired` แล้วคืนผลสรุป (รูปเดียวกับข้อ "ผลสรุป")
- `submitted`/`expired` → ผลสรุป

**บันทึกระหว่างสอบ (autosave)** `PUT /mock-attempts/:attemptId/answers`
```json
{ "answers": { "q_…": "b", "q_2…": null }, "flags": ["q_2…"] }
```
→ `{ "success": true, "serverNow": 1790932200000, "deadlineAt": 1790933377871, "saved": 2 }`
- รวมเข้ากับที่บันทึกไว้ (ค่า `null` = ล้างคำตอบ); ข้อที่ไม่ใช่ของ attempt นี้ถูกปฏิเสธ `400`
- Frontend: ส่งทุกครั้งที่เลือก/ติดธง (debounce ~1 วินาที) และทุก 30 วินาที
- หลังหมดเวลา (+ ผ่อนผัน 15 วินาที) → `409 ATTEMPT_CLOSED` พร้อม `details.result` (ผลที่ตรวจจากคำตอบที่บันทึกไว้ก่อนหน้า — คำตอบที่เพิ่งส่งมาถูกทิ้ง)
- ตรวจทั้งก้อนก่อนเขียน: `answers` ต้องเป็นออบเจ็กต์, คีย์ต้องเป็นข้อของ attempt นี้, ค่าต้องเป็น id ตัวเลือกของข้อนั้นหรือ `null`, `flags` ต้องเป็นรายการ id ของข้อใน attempt (ผิดข้อเดียว → `400` ไม่มีอะไรถูกบันทึก)
- การส่งที่ช้าไม่เกินช่วงผ่อนผันยังนับเป็น `submitted` ปกติ

**ส่ง** `POST /mock-attempts/:attemptId/submit` body `{ "answers": {…}, "flags": […] }` (ส่ง state สุดท้ายได้ ไม่บังคับ)
- ส่งซ้ำ → `200` ผลเดิม (idempotent)

**ผลสรุป** (response ของ submit และของ GET เมื่อปิดแล้ว)
```json
{
  "success": true,
  "result": {
    "attemptId": "ma_9x…", "status": "submitted", "autoSubmitted": false,
    "correct": 7, "total": 10, "answered": 9, "percent": 70, "passed": null,
    "secondsUsed": 900, "durationSec": 1200, "submittedAt": 1790931000000,
    "starsEarned": 8, "starsBase": 7, "starsTimeBonus": 1,
    "deltaVsPrevious": 10,
    "topics": [ { "topic": "…", "correct": 2, "total": 3 } ],
    "review": [
      { "n": 1, "questionId": "q_…", "text": "…", "topic": "…",
        "choices": [ { "id": "a", "text": "…" } ],
        "yourChoiceId": "b", "correctChoiceId": "c", "isCorrect": false,
        "explanation": "…", "flagged": true, "special": false }
    ]
  }
}
```
- `autoSubmitted: true` เมื่อ `expired`
- ข้อที่ไม่ได้ตอบนับเป็นไม่ถูก; `topics` นับทุกข้อของชุด; `deltaVsPrevious` เทียบกับครั้งก่อนที่ส่งไปแล้ว (`null` = ครั้งแรก)
- ผลที่ตรวจแล้วเปลี่ยนอีกไม่ได้: ส่งซ้ำ/ขอผลซ้ำได้ผลเดิม แม้เนื้อหาโจทย์ถูกแก้ภายหลัง คะแนนไม่ถูกคำนวณใหม่
- **สูตรดาว** (ผู้ใช้สั่ง "คิดเวลาด้วย"):
  - `starsBase` = ผลรวม `starValue` ของข้อที่ตอบถูก (ค่าต่อข้อตั้งตอน Import; ข้อพิเศษตั้งสูงกว่าข้อปกติ)
  - `speed` = `clamp(1 − secondsUsed / durationSec, 0, 1)` (ใช้เวลาน้อย = ใกล้ 1)
  - `starsTimeBonus` = `round(starsBase × timeBonusPct / 100 × speed)`
  - `starsEarned = starsBase + starsTimeBonus`
  - `timeBonusPct` ตั้งต่อชุด Mock (ค่าเริ่มต้น **25**; `0` = ไม่คิดเวลา) — ปรับได้ที่ข้อมูลโดยไม่แก้โค้ด; ตอบผิดหมด = 0 ดาวเสมอ เวลาไม่ช่วย จึงไม่คุ้มที่จะเดาเร็ว ๆ
  - ผล `expired` (หมดเวลา) ใช้ `secondsUsed = durationSec` จึงไม่ได้โบนัสเวลา
  - **ค่าเริ่มต้น 25% เป็นข้อเสนอของผม** ผู้ใช้ยังไม่ได้ระบุสัดส่วน — ปรับได้ตลอด
- `passed`: `null` เมื่อวิชายังไม่กำหนด `passMarkPct`

### 2.9 Progress

`GET /progress` — ภาพรวม (Home / Progress)
```json
{
  "success": true,
  "overall": { "lessonsDone": 31, "lessonsTotal": 120, "pct": 26, "subjectsStarted": 4, "subjectsCompleted": 0 },
  "answers": { "total": 248, "correct": 218, "accuracy": 88 },
  "subjects": [ { "id": "sci", "pct": 75, "lessonsDone": 12, "lessonsTotal": 16, "lastActivityAt": 1790932000000 } ],
  "continue": [ { "subjectId": "sci", "lessonNo": 13, "lessonTitle": "…", "lastActivityAt": 1790932000000 } ],
  "recent": [ { "type": "quiz", "subjectId": "sci", "lessonNo": 12, "at": 1790932000000, "correct": 4, "total": 5 },
              { "type": "mock", "subjectId": "mat", "at": 1790931000000, "correct": 7, "total": 10 } ]
}
```
- `continue`: ไม่เกิน 3 วิชาที่มีกิจกรรมล่าสุด และยังมีบทค้าง (Blueprint 4.2 A)
- `answers` = คำตอบที่ระบบตรวจแล้วทุกวิชา (Quiz และ Mock; `accuracy` เป็น `null` เมื่อยังไม่มีคำตอบ) ใช้กับสถิติ "ทำโจทย์สะสม / แม่นยำเฉลี่ย"
- `recent` ล่าสุดก่อน ไม่เกิน 10 รายการ
- ไม่มีข้อมูล EXP / ดาวรวม / อันดับ (คงเป็นตัวอย่างในหน้า Home/Progress ตามที่ตัดสินใจ)

`GET /progress/subjects/:subjectId` — ผลการเรียนรายวิชา (Blueprint 8.3 – 8.5) ของตัวเองเท่านั้น
```json
{
  "success": true,
  "subject": { "id": "sci", "title": "วิทยาศาสตร์", "eyebrow": "…", "hue": "emerald", "emoji": "🔬" },
  "progress": { "lessonsTotal": 16, "lessonsDone": 12, "pct": 75, "lastActivityAt": 1790932000000 },
  "lessons": [
    { "no": 1, "title": "…", "status": "done",
      "quiz": { "best": { "correct": 4, "total": 5 }, "attempts": 2, "passed": true },
      "practice": { "done": 6, "ok": 5, "total": 6 } }
  ],
  "answers": { "total": 64, "correct": 48, "accuracy": 75 },
  "quiz": { "recent": [ { "lessonNo": 12, "at": 1790932000000, "correct": 4, "total": 5, "percent": 80 } ] },
  "mock": {
    "available": true,
    "attempts": [ { "attemptId": "ma_…", "status": "submitted", "at": 1790931000000, "percent": 70, "correct": 7, "total": 10, "secondsUsed": 900, "starsEarned": 8 } ],
    "best": { "percent": 70, "attemptId": "ma_…" },
    "trend": [ { "at": 1780000000000, "percent": 40 }, { "at": 1790931000000, "percent": 70 } ]
  },
  "review": {
    "sufficient": true, "minAnswersPerTopic": 5,
    "topics": [ { "topic": "กรด-เบส", "correct": 3, "total": 8, "accuracy": 38, "level": "weak", "lessons": [ { "no": 13, "title": "…" } ] } ],
    "pending": [ { "topic": "สมดุลเคมี", "total": 2 } ],
    "message": null
  }
}
```
- `quiz.recent` ล่าสุดก่อน ไม่เกิน 10; `mock.attempts` ล่าสุดก่อน ไม่เกิน 20; `mock.trend` เรียงเก่า→ใหม่ (ไม่เกิน 10) สำหรับกราฟ
- `review.topics` คำนวณจากคำตอบที่ระบบตรวจแล้วเท่านั้น (**Quiz และ Mock**; Practice ที่กดเองไม่นับ; ข้อที่ข้ามไม่นับ; ชุดที่ยังไม่ส่ง/ยังไม่ตรวจไม่นับ)
- ตัดสินหัวข้อได้เมื่อมี ≥ `minAnswersPerTopic` (5) คำตอบในหัวข้อนั้น; หัวข้อที่ยังน้อยอยู่ใน `pending` (ไม่ตัดสินว่าอ่อนหรือเก่ง); ถ้าไม่มีหัวข้อใดถึงเกณฑ์ → `sufficient: false` และ `message` อธิบาย (Blueprint 8.5)
- `level`: `weak` (< 50%) | `ok` | `strong` (≥ 80%); เรียงอ่อนสุดก่อน (คะแนนเท่ากัน → หัวข้อที่ตอบมากกว่าก่อน); `lessons` = บทที่มีโจทย์ของหัวข้อนั้น (ไม่เกิน 3) ไว้ลิงก์ "กลับไปทบทวน"
- วิชาที่ไม่เผยแพร่ → `404`

### 2.10 กิจกรรม (node) — วงกลมบนเส้นทางเรียน (v2)

#### 2.10.1 โมเดล
- วิชา → หน่วย → **บท** (สีประจำบท + เส้นคั่นบนหน้าเส้นทางเรียน) → **node** (วงกลม 1 วง = กิจกรรม 1 อย่าง)
- ชนิดของ node: `content` (ชุดเนื้อหา แบ่งเป็นหลายหน้า เรื่องเดียวกัน) · `quiz` (Quiz 1 ชุด) · `practice` (Practice 1 ชุด)
- บทหนึ่งมี node ชนิดใดกี่วงก็ได้ (เช่น เนื้อหา 2 ชุด + Quiz 2 ชุด + Practice 1 ชุด) เรียงตามลำดับที่ผู้เขียนกำหนด
- id ของ node ขึ้นต้นด้วย `{subject.id}-` เหมือน id อื่น (`^[a-z0-9][a-z0-9-]{1,79}$` ใน path)
- บทที่ไม่มี `nodes` (เขียนด้วย `blocks` แบบ v1) ถูกแปลงตอนนำเข้า: 1 node เนื้อหา (`{บท}-content`, 1 หน้า) + node Quiz `{บท}-quiz` / Practice `{บท}-practice` เมื่อมีโจทย์ใช้งานนั้น; บทที่นำเข้าก่อน migration 0008 อ่านได้เหมือนกัน (node เดียวกันนี้) จนกว่าจะนำเข้าซ้ำ

#### 2.10.2 กติกาความคืบหน้า (เก็บต่อ node ในตาราง `study_node_progress`; "เสร็จ" คำนวณทุกครั้ง ไม่เก็บค่า)
| node | เสร็จเมื่อ |
|---|---|
| `content` | ผู้เรียนกด "จบเนื้อหา" (`completed: true`) — การเปิดหรืออ่านถึงหน้าสุดท้ายยังไม่นับ |
| `quiz` | มีการทำ 1 ครั้งที่ถึงเกณฑ์ผ่าน (`passPct` ของ node ถ้าตั้งไว้ ไม่งั้น `quizPassPct` ของบท; `null` = ส่งครั้งเดียวก็ผ่าน) |
| `practice` | ผู้เรียนกดทำถูก/ทำผิดครบทุกข้อของชุด — **แสดงบนวงกลมเท่านั้น ไม่นับต่อบท/ดาว/จุดอ่อน** |

- **บทเสร็จ** = ทุก node เนื้อหาเสร็จ **และ** ทุก node Quiz ที่มีโจทย์เผยแพร่แล้วผ่าน (Quiz ที่ไม่มีโจทย์ไม่ถูกเรียกร้อง — ไม่ให้บทค้างตลอดไป); บทที่ไม่มี node เนื้อหาเลยไม่มีวัน "เสร็จ"
- node `now` มีวงเดียวทั้งวิชา = เนื้อหา/Quiz ตัวแรกที่ยังไม่เสร็จของบทแรกที่ยังไม่เสร็จ (ข้าม Practice); วงอื่นที่ยังไม่เสร็จ = `todo`

#### 2.10.3 Endpoint
`GET /subjects/:subjectId/lessons/:no/nodes/:nodeId` (`:no` = เลขบท หรือ `current`) — เปิดวงกลม 1 วง (GET นี้ไม่เขียนข้อมูล; ไม่มีเฉลยเสมอ)
```json
{
  "success": true,
  "subject": { "id": "sci", "title": "วิทยาศาสตร์", "eyebrow": "…", "hue": "emerald", "emoji": "🔬", "lessonsTotal": 4 },
  "lesson": { "subjectId": "sci", "no": 2, "title": "กรด-เบสเบื้องต้น", "unit": { "no": 1, "title": "…" }, "estimatedMin": 15, "status": "now" },
  "node": {
    "id": "sci-n03", "type": "content", "title": "pH และกระดาษลิตมัส", "status": "now", "pageCount": 3,
    "progress": { "pageCount": 3, "pageReached": 1, "completedAt": null },
    "pages": [ { "title": "ค่า pH", "blocks": [ { "type": "paragraph", "text": "…" } ] } ]
  },
  "nav": { "prev": { "lessonNo": 1, "lessonTitle": "…", "nodeId": "sci-p01", "type": "practice", "title": "…" },
           "next": { "lessonNo": 2, "lessonTitle": "…", "nodeId": "sci-n04", "type": "content", "title": "…" } }
}
```
- `node.pages` มีเฉพาะ node `content` (แต่ละหน้า `title` เป็น `null` ได้, `blocks` ≥ 1 บล็อก ชนิดเดียวกับข้อ 2.4); node `quiz` มี `quiz: { available, questionCount, passPct }` แทน และ node `practice` มี `practice: { total, byLevel }`
- `nav.prev/next` = วงก่อน/หลังในลำดับของทั้งวิชา (ต่อข้ามบทได้) หรือ `null`
- ไม่พบ node / บทหรือหน่วยยังไม่ Published / node ไม่ได้อยู่ในบทนี้ → `404`

`PUT /subjects/:subjectId/lessons/:no/nodes/:nodeId/progress` — เฉพาะ node `content`
```json
{ "page": 1, "completed": true }
```
- `page` = หน้าที่กำลังอ่าน (เลข 0 เริ่มที่หน้าแรก, ต้องอยู่ในช่วง `0 … pageCount−1`); Backend เก็บ **หน้าที่ไกลที่สุด** (ย้อนกลับไม่ลดค่า) ไว้ให้เปิดใหม่แล้วต่อจากหน้าเดิม
- `completed: true` = จบเนื้อหา (เก็บเวลาแรกที่จบไว้ ครั้งต่อไปไม่เปลี่ยน), `false` = เอาเครื่องหมายกลับ (ไม่ลดหน้า), ไม่ส่ง = ไม่แตะ; ต้องส่งอย่างน้อยหนึ่งอย่าง ไม่งั้น `400`
- → `{ "success": true, "progress": { "status", "contentReadAt", "quiz", "practice", "nodes": [ { "id", "type", "status", "progress" } ], "current": { "lessonNo", "nodeId", "type" } | null } }`
- node ที่ไม่ใช่ `content` → `404`; หน้านอกช่วง/ชนิดข้อมูลผิด → `400`

#### 2.10.4 สื่อ (ภาพ / วิดีโอ)
- **ในเนื้อหา**: บล็อก `figure` (`kind: image|video`, `url`, `alt` (บังคับเมื่อเป็นภาพ), `caption`)
- **ในโจทย์** (Quiz, Practice, Mock): `media: [ { kind, url, alt, caption } ]` ไม่เกิน 3 ชิ้นต่อข้อ — แสดงใต้ข้อความโจทย์ และในหน้าเฉลยเมื่อทำเสร็จ
- **ในตัวเลือก** (mcq): `choices[].image = { url, alt }` (`text` ยังบังคับ เป็นป้ายของตัวเลือก)
- `url`: `https://…` หรือไฟล์ของเว็บเองใต้ `assets/` (ไม่มี `..`, ไม่ขึ้นต้นด้วย `/`) — `http://`, `javascript:`, `data:` ถูกปฏิเสธตอนนำเข้า (`URL_NOT_ALLOWED`) และ Frontend ตรวจซ้ำก่อนแสดง
- วิดีโอ: ไฟล์ `.mp4 .webm .ogg .mov` เล่นในหน้า; ลิงก์ YouTube (`watch?v=`, `youtu.be`, `/embed/`, `/shorts/`) และ Vimeo ถูกฝังด้วย `youtube-nocookie.com` / `player.vimeo.com` พร้อม `sandbox` (รองรับ `?t=` เวลาเริ่ม); ลิงก์วิดีโอเว็บอื่นเป็นปุ่มเปิดแท็บใหม่ (ไม่ฝัง)
- ภาพที่ใช้ในโจทย์ **ต้องไม่มีข้อความที่เฉลยคำตอบอยู่ในภาพ** (ผู้เขียนรับผิดชอบ) และข้อความ `alt` ควรบอกสิ่งที่เห็น ไม่ใช่คำตอบ

---

## 3. ผู้ดูแล (`requireAdmin`; ทุก endpoint เป็น POST + CSRF)

### 3.1 `POST /admin/import`
นำเข้าหนึ่งวิชาต่อครั้ง (ไฟล์ JSON เดียว) — **เข้าเป็น `draft` เสมอ ไม่เผยแพร่เอง**

```json
{
  "dryRun": true,
  "subject": {
    "id": "sci", "no": 1, "title": "วิทยาศาสตร์", "eyebrow": "วิชาที่ 1 • วิทยาศาสตร์",
    "description": "…", "objectives": ["…"], "level": "ม.ปลาย", "metaText": "…", "hue": "emerald", "emoji": "🔬",
    "units": [
      { "id": "sci-u1", "title": "…",
        "lessons": [
          { "id": "sci-l01", "no": 1, "title": "…", "summary": "…", "estimatedMin": 15,
            "quizSize": 5, "quizPassPct": 50,
            "nodes": [
              { "id": "sci-n01", "type": "content", "title": "สสารและ 3 สถานะ",
                "pages": [
                  { "title": "สสารคืออะไร", "blocks": [ { "type": "paragraph", "text": "…" }, { "type": "figure", "kind": "image", "url": "assets/study/sci/states.svg", "alt": "…", "caption": "…" } ] },
                  { "title": null, "blocks": [ { "type": "figure", "kind": "video", "url": "https://youtu.be/…", "caption": "…" } ] }
                ] },
              { "id": "sci-z01", "type": "quiz", "title": "Quiz: สถานะของสสาร", "quizSize": 4, "passPct": 60 },
              { "id": "sci-p01", "type": "practice", "title": "ฝึก: สถานะของสสาร" }
            ] }
        ] }
    ],
    "mock": { "id": "sci-mock", "title": "…", "questionCount": 10, "durationMin": 20, "passMarkPct": null, "timeBonusPct": 25 },
    "questions": [
      { "id": "sci-q001", "kind": "mcq", "lessonNo": 1, "node": "sci-z01", "uses": ["quiz", "mock"],
        "difficulty": "easy", "topic": "กรด-เบส", "tier": "standard", "starValue": 1,
        "stem": "…", "media": [ { "kind": "image", "url": "assets/study/sci/q1.svg", "alt": "…", "caption": null } ],
        "choices": [ { "id": "a", "text": "…" }, { "id": "b", "text": "…", "image": { "url": "https://…", "alt": "…" } } ],
        "correct": "b", "explanation": "…" },
      { "id": "sci-q050", "kind": "open", "lessonNo": 1, "node": "sci-p01", "uses": ["practice"],
        "difficulty": "medium", "topic": "…", "tier": "standard", "starValue": 0,
        "stem": "…", "solution": "…" }
    ]
  }
}
```
กติกาของ node และสื่อ (v2):
- บทเขียนได้ 2 แบบ: `blocks` (เนื้อหาชุดเดียวหน้าเดียว แบบ v1) **หรือ** `nodes` (ใช้ `nodes` ถ้าใส่ทั้งคู่ — `blocks` ถูกข้ามพร้อมคำเตือน `IGNORED_FIELD`); `nodes` ต้องไม่เกิน 30 รายการ
- node `content`: `pages` 1–40 หน้า (แต่ละหน้า `blocks` 1–100 บล็อก) หรือใช้ `blocks` แทน `pages` เมื่อมีหน้าเดียว; node `quiz`: `quizSize` 1–30 (ไม่ใส่ = ของบท) และ `passPct` 0–100 หรือ `null` (ไม่ใส่ = `quizPassPct` ของบท); node `practice`: ไม่มีฟิลด์เพิ่ม
- โจทย์ที่ใช้ `quiz`/`practice` ผูกกับ node ด้วย `node` (ระบุ `node` อย่างเดียวก็พอ ไม่ต้องใส่ `lessonNo`); ถ้าไม่ระบุ: บทที่มี node ชนิดนั้น **ชุดเดียว** → ผูกกับชุดนั้นอัตโนมัติ, **หลายชุด** → `NODE_REQUIRED`, ไม่มีเลย → `NO_NODE_OF_TYPE`; ชนิดไม่ตรง (`NODE_TYPE_MISMATCH`), ไม่พบ (`NODE_NOT_FOUND`), อยู่คนละบท (`NODE_LESSON_MISMATCH`), โจทย์ที่ใช้ `mock` อย่างเดียวห้ามมี `node` (`NODE_NOT_ALLOWED`)
- `media` ไม่เกิน 3 ชิ้นต่อข้อ; ภาพต้องมี `alt`; `url` ต้องเป็น `https://…` หรือ `assets/…` (`URL_NOT_ALLOWED`)
- เพิ่มโจทย์ใหม่เข้า node ที่มีอยู่แล้ว **ไม่เปลี่ยนเนื้อหาของบท** (ไม่กลับเป็น Draft) แต่การแก้หน้า/ชื่อ/ลำดับ node ทำให้บทนั้นกลับเป็น Draft และต้องส่ง `confirmUnpublish` ถ้าเผยแพร่อยู่

กติกา (เดิม):
- `id` ทุกชนิดเป็นคีย์ upsert (นำเข้าซ้ำได้ ไม่ซ้ำซ้อน) และ **ต้องขึ้นต้นด้วย `{subject.id}-`** (เช่น `sci-l01`) เพื่อไม่ให้ชนกับวิชาอื่น; แถวที่ไม่มีในไฟล์ **ไม่ถูกลบ** (ตอบกลับใน `missingFromFile`; ใช้ `archived` ผ่าน `/admin/status`)
- แถวที่เปลี่ยนเนื้อหา → กลับเป็น `draft` ตัวใหม่ (version +1) และเก็บ revision; แถวที่ไม่เปลี่ยน → ไม่แตะ (สถานะเดิมคงอยู่)
- **เนื้อหาที่ Published อยู่แล้วจะไม่ถูกดึงกลับเป็น Draft เงียบ ๆ**: ถ้าไฟล์จะแก้แถวที่ Published ระบบตอบ `409 WOULD_UNPUBLISH` พร้อม `wouldUnpublish[]` (ใน `dryRun` ได้รายการเดียวกันโดยไม่ error) ต้องส่ง `"confirmUnpublish": true` จึงจะแก้ได้ — แถวนั้นหายจากฝั่งนักเรียนจนกว่าจะผ่านรีวิวและเผยแพร่ใหม่
- เลขบท (`no`) ที่ถูกใช้โดยบทที่อยู่ในระบบแต่ไม่อยู่ในไฟล์ → `422` (`LESSON_NO_CONFLICT`); วิชาหนึ่งมี Mock ได้ชุดเดียว (เปลี่ยน id ไม่ได้: `MOCK_ID_CHANGED`)
- **ผิดข้อเดียว = ไม่เขียนอะไรเลย** (ตรวจครบทั้งไฟล์ก่อนเขียน; ทั้ง `dryRun` จริงและไม่จริง) ส่วนการเขียนลงฐานข้อมูลแบ่งเป็นชุดย่อย ถ้าล้มกลางทางให้รันนำเข้าไฟล์เดิมซ้ำ — แถวที่ไม่เปลี่ยนถูกข้าม จึงต่อจนครบได้ และทุกอย่างเป็น Draft นักเรียนไม่เห็น
- ตรวจ: ชนิด/ความยาว (ข้อความ ≤ 4,000, หัวข้อ ≤ 200 ตัวอักษร), ไม่มีแท็ก HTML จริง เช่น `<script>` `<br>` `<img>` (สูตรอย่าง `pH < 7` หรือ `x<y` ใช้ได้), `url` ต้อง `https://`, `no` ไม่ซ้ำในวิชา, `lessonNo` ต้องมีอยู่, `mcq` มีตัวเลือก 2–6 ข้อ id ไม่ซ้ำ และ `correct` ตรง 1 ตัวเลือก, `open` ต้องมี `solution`, `uses` ใช้ได้ `quiz|practice|mock`, `tier` ∈ `standard|advanced`, `starValue` จำนวนเต็ม 0–20, ขนาด body ≤ 1 MB

```json
{
  "success": true, "dryRun": true,
  "summary": {
    "subjects":  { "created": 1, "updated": 0, "unchanged": 0 },
    "units":     { "created": 4, "updated": 0, "unchanged": 0 },
    "lessons":   { "created": 16, "updated": 0, "unchanged": 0 },
    "questions": { "created": 120, "updated": 0, "unchanged": 0 },
    "mock":      { "created": 1, "updated": 0, "unchanged": 0 }
  },
  "missingFromFile": { "units": 0, "lessons": 0, "questions": 0 },
  "wouldUnpublish": [],
  "warnings": [ { "path": "subject.questions[7].explanation", "code": "NO_EXPLANATION", "message": "…" } ]
}
```
คำเตือน (`warnings`) ไม่ทำให้นำเข้าไม่ผ่าน แต่บอกสิ่งที่ยังเผยแพร่ไม่ได้ (เช่น `NO_EXPLANATION`, `NO_BLOCKS`) หรือฟิลด์ที่ไม่รู้จัก (`UNKNOWN_FIELD`)

ไม่ผ่าน: `HTTP 422`
```json
{ "success": false, "error": "IMPORT_INVALID", "message": "ไฟล์นำเข้ามี 2 ข้อผิดพลาด",
  "errors": [ { "path": "subject.questions[3].correct", "code": "CORRECT_NOT_IN_CHOICES", "message": "…" } ] }
```

### 3.2 `POST /admin/status`
```json
{ "entity": "subject", "id": "sci", "to": "in_review", "cascade": true, "reason": "…" }
```
- `entity`: `subject` | `unit` | `lesson` | `question` | `mock`; `to`: `draft` | `in_review` | `published` | `archived`
- ลำดับที่อนุญาต: `draft → in_review → published → archived`, ถอยกลับเป็น `draft` ได้จากทุกสถานะ (ผู้ใช้จะเห็นเฉพาะ `published`)
- `cascade: true` (เฉพาะ `subject`) เปลี่ยนลูกที่สถานะอยู่ก่อนหน้าไปพร้อมกัน
- ลำดับที่ข้ามขั้นไม่ได้ (เช่น `draft → published`) → `409 INVALID_TRANSITION`
- ก่อน `published` ตรวจเกณฑ์ (Blueprint 10.4) **เฉพาะแถวที่กำลังจะเผยแพร่ในครั้งนี้** บนสถานะหลังเปลี่ยน (ถ้า `cascade` ก็ตรวจทั้งชุดรวมกัน): โจทย์ `mcq` ต้องมีคำอธิบายเฉลย (`NO_EXPLANATION`), โจทย์ `open` ต้องมีเฉลย (`NO_SOLUTION`), บทต้องมีเนื้อหา ≥ 1 บล็อก (`LESSON_EMPTY`; นับรวมทุกหน้าของทุก node เนื้อหา), **node Quiz/Practice ที่ไฟล์ประกาศไว้ต้องมีโจทย์ที่เผยแพร่แล้ว ≥ 1 ข้อ (`QUIZ_NODE_EMPTY`, `PRACTICE_NODE_EMPTY`; v2)**, Mock ต้องมีโจทย์ `mcq` ระดับ `standard` ที่เผยแพร่แล้วอย่างน้อยเท่า `questionCount` (`MOCK_POOL_TOO_SMALL`), วิชาต้องมีบทที่เผยแพร่แล้วในหน่วยที่เผยแพร่แล้วอย่างน้อย 1 บท (`NO_PUBLISHED_LESSON`)
- ไม่ผ่านเกณฑ์: `422 PUBLISH_BLOCKED` + `errors[]` (path = id ของแถวนั้น) และ **ไม่เปลี่ยนอะไรเลย**
- คำเตือน `MOCK_POOL_SHRUNK`: ถอนโจทย์ออกจาก pool ของ Mock ที่เผยแพร่อยู่จนไม่พอ — ทำได้ แต่ Mock จะแสดง `available: false` จนกว่าจะเติม
- `entity` ที่ไม่รู้จัก → `400`; ไม่พบแถว → `404`
- ทุกการเปลี่ยนสถานะเก็บ revision (ใครทำ เมื่อไร เหตุผล)

### 3.3 `POST /admin/overview`
`{ "subjectId": "sci" }` → โครงหน่วย/บท **รวม Draft** พร้อมสถานะ, จำนวนโจทย์ต่อบท (`quizStandard`, `quizAdvanced`, `practice`), ขนาด pool ของ Mock (`pool.standard/advanced`), `publishable: true|false` และ `blockers[]` ถ้าเลื่อนทุกแถวที่ยังไม่เผยแพร่เป็น Published ตอนนี้ — ใช้ตรวจก่อนเผยแพร่
`{}` (ไม่ระบุ `subjectId`) → รายการทุกวิชาพร้อมจำนวนบท/โจทย์แยกตามสถานะ

---

## 4. การเชื่อมกับ Frontend (แทนที่ `js/study-data.js`)

**สถานะ:** ทำแล้ว — หน้า course / lesson (เนื้อหา, อ่านจบ, Quiz, Practice) / mock-exam / report (ผลการเรียนรายวิชา ใหม่) และการ์ดวิชา/แถว "ทำต่อ"/ส่วน "ผลการเรียนของฉัน" ใน Home, Subjects, Progress ใช้ข้อมูลจริง; `study-data.js` เหลือไว้ให้โหมดตัวอย่าง `?demo=1` (preview เท่านั้น) และเทสต์

**v2 (2026-10-16):** หน้าวิชา (`course.html`) เป็นหน้าใน **Barba** ร่วมกับ Home/Subjects/Progress (พื้นที่สีเขียวด้านบนต่อเนื่อง) แสดงเป็นเส้นทางวงกลมของ node (`js/study-course.js`, `css/course.css`); `lesson.html` กลายเป็นหน้า **กิจกรรมหนึ่งวงกลม** `lesson.html?s=&l=&n=<nodeId>` (`js/study-node.js`: ชุดเนื้อหาหลายหน้า `study-live-content.js`, Quiz, Practice) — ลิงก์เก่า `?s=&l=N[&tab=quiz|practice]` ที่ไม่มี `n` ยังเปิดได้ (ระบบเลือก node ให้); ภาพ/วิดีโอแสดงโดย `js/study-media.js` ทั้งในเนื้อหา Quiz Practice และ Mock; แอนิเมชันอยู่ใน `js/study-fx.js` + `css/fx.css` (ปิดเองเมื่อผู้ใช้ตั้งค่าลดการเคลื่อนไหว)

ทุกหน้าใช้ `js/study-api.js` (ใหม่) ผ่าน `apiFetch` เดิม; `study-data.js` ถูกเก็บไว้เป็นผู้ให้ข้อมูลตัวอย่างสำหรับเทสต์/โหมด demo เท่านั้น (เลือกด้วย `?demo=1` บนโดเมนที่ไม่ใช่ production)

| ปัจจุบัน (`study-data.js`) | แทนด้วย |
|---|---|
| `SUBJECTS`, `getSubject` | `GET /subjects` (+ ค่าตกแต่งเริ่มต้นสำหรับ key ที่ไม่รู้จัก) |
| `buildOutline` | `GET /subjects/:id` |
| `resolveLessonNo(… 'current')` | path `:no = current` |
| บล็อกเนื้อหา placeholder ใน `contentPanel` | `lesson.blocks` |
| `makeQuiz`, `scoreAnswers` (Quiz) | `quiz-attempts` + `answer` + `submit` |
| `makePractice` | `…/practice` + `solution` + `result` |
| `makeMock`, `MOCK_SAMPLE`, ตัวจับเวลา `endAt` | `…/mock`, `mock-attempts` (ใช้ `deadlineAt − serverNow` คำนวณเวลาที่เหลือ ไม่เชื่อนาฬิกาเครื่อง) |
| `store` (localStorage), ปุ่ม "ล้างข้อมูลตัวอย่าง", แถบ `DEMO_NOTE` | ลบออกจากหน้าจริง |
| การ์ดวิชา/เปอร์เซ็นต์/ลุยต่อ ที่เป็น HTML ตายตัวใน index/subject/progress | เติมจาก `GET /subjects` และ `GET /progress` |

สถานะที่ Frontend ต้องมีทุกหน้า: กำลังโหลด (skeleton), ว่าง, ผิดพลาดพร้อมปุ่มลองใหม่, ไม่มีสิทธิ์ (`FEATURE_FORBIDDEN` → ข้อความ + ลิงก์แพลน), เกินโควตา (`429`), ปุ่มที่กำลังส่งข้อมูลถูกล็อก

---

## 5. การตัดสินใจ (ปิดแล้ว 2026-10-14)

**ผู้ใช้ตอบ**
1. **ดาวคิดเวลาด้วย** → สูตรในข้อ 2.8 (สัดส่วนโบนัสเวลาเริ่มที่ 25% ตั้งต่อชุด Mock แก้ได้ที่ข้อมูล) ข้อความในหน้า Mock Exam ("คำนวณจากคะแนนและเวลาที่ใช้") จึงถูกต้องตามเดิม
2. **เกณฑ์จบบท** → ต้องได้อย่างน้อย **50% ในการทำ Quiz 1 ครั้ง** (`quizPassPct` ค่าเริ่มต้น 50) ร่วมกับอ่านจบ
3. **วิชานำร่อง** → **วิทยาศาสตร์ (`sci`)**; AI ร่างเนื้อหา ผู้ใช้เป็นผู้ตรวจก่อน Published

**ค่าเริ่มต้นที่ผมตั้งเอง (ไม่ได้ถูกค้าน — เปลี่ยนได้)**
- Practice: ผู้เรียนกดเอง ไม่ตรวจโดยระบบ ไม่นับในการวิเคราะห์จุดอ่อน ไม่แยก tier
- Route ของบท: `/subjects/:subjectId/lessons/:no` (แทน `/lessons/:id` ในแผน) ให้ตรงกับ `?s=&l=` ของหน้า
- เวลาผ่อนผันส่งช้า: 15 วินาที (ค่าคงที่ฝั่ง server)
- ป้าย "ข้อพิเศษ" (`special`): มีฟิลด์ให้ ตัดสินใจเรื่องการแสดงผลตอนทำ M3
- ลำดับตัวเลือกไม่สลับ; โจทย์สุ่มจาก pool
- Quiz ที่ไม่ได้ตั้ง `quizSize` ใช้ 5 ข้อ (หรือเท่าที่มี)
