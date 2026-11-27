# HEADFACE Study — คลิปสอน (Shorts + คลิปยาว)

เอกสารนี้อธิบายระบบคลิปสอนทั้งหมด: วิธีเพิ่มคลิปผ่าน **Admin API** (ยังไม่มีหน้าจอ Admin — ทำเฉพาะ API + เอกสารตามที่ตกลง),
API ฝั่งผู้เรียน กฎโควตา/ดูจบ/EXP และหน้าเว็บที่เกี่ยวข้อง

| | |
|---|---|
| Backend | `src/study/videoService.js`, เส้นทางใน `src/study/routes.js`, migration `0049_study_videos.sql`, เทสต์ `test/study-videos-test.js` (18 ข้อ) |
| Frontend | `videos.html` + `js/study-videos.js` (หน้ารวม), `shorts.html` + `js/study-shorts.js` (ฟีด Shorts), `watch.html` + `js/study-watch.js` (คลิปยาว), `js/yt-player.js`, `js/video-tracker.js`, `css/videos.css`, เทสต์ `test/study-videos.test.mjs` |
| สถานะ | **Preview**: migration 0049 + Worker ขึ้นแล้ว (2026-11-27), หน้าเว็บอยู่บน `test` · **Production: ยังไม่ขึ้น** (ดูข้อ 1 ก่อน) |

---

## 1. ⚠️ อ่านก่อน: นโยบายของ YouTube

ตอนนี้คลิปเก็บบน **YouTube** (ฝังผ่าน YouTube IFrame Player API) ตรวจนโยบายฉบับจริงแล้ว (2026-11-25) พบว่าขัดกับระบบที่ตกลงไว้ 3 เรื่อง:

1. **ห้ามให้รางวัลแก่การดูคลิป** — [Developer Policies](https://developers.google.com/youtube/terms/developer-policies) หัวข้อ *Playback Integrity* ห้าม API Client ให้ incentive/reward แก่ผู้ใช้สำหรับการดูคลิป → **EXP เมื่อดูจบขัดตรง ๆ**
2. **ห้ามเก็บเงินเพื่อดูคลิปที่ฝัง และห้ามกั้นการดูด้วยเงื่อนไขอื่นนอกจากกดเล่น** (ล็อกอินได้) → โควตา FREE 10/5 ต่อวันที่แพลนเสียเงินดูได้ไม่จำกัด **น่าจะขัด**
3. **ห้ามวางสิ่งใดทับตัวเล่น และห้ามใช้การแตะบนตัวเล่นสั่งงาน** — [Required Minimum Functionality](https://developers.google.com/youtube/terms/required-minimum-functionality) → หน้า Shorts (ชื่อคลิป ปุ่ม แถบความคืบหน้า และชั้นรับการแตะวางทับวิดีโอ) **ขัด**

ผลที่ตามมาได้ถ้าใช้จริง: YouTube ระงับการฝังคลิปหรือสิทธิ์ใช้ API

**การตัดสินใจ (เจ้าของระบบ, 2026-11-25): ใช้แบบเดิมไปก่อนเพื่อทดสอบบน Preview แล้วตัดสินเรื่องที่เก็บคลิปก่อนขึ้น Production** ทางเลือก:

| ทาง | ผล |
|---|---|
| **Cloudflare Stream** (แนะนำ) | คลิปอยู่ในบัญชี Cloudflare เดิม อัปโหลดผ่าน Dashboard ได้ ไม่ต้องจัดการ bucket แบบ R2 · ใช้ EXP / โควตา / หน้า Shorts แบบเดิมได้ครบ · ลิงก์เล่นแบบมีลายเซ็น (signed URL) ทำให้เปิดดูนอกแอปไม่ได้และโควตามีผลจริง · ราคา ([หน้าราคา](https://developers.cloudflare.com/stream/pricing/)): พื้นที่ $5/เดือน ต่อ 1,000 นาที (จ่ายล่วงหน้า) + การดู $1 ต่อ 1,000 นาที ไม่มีค่า bandwidth แยก · Backend เตรียมช่อง `source` ไว้แล้ว ต้องเพิ่ม `source='stream'` + เปลี่ยนตัวเล่นฝั่งหน้าเว็บ |
| YouTube ตามนโยบาย | ตัด EXP จากการดู ตัดโควตารายวัน จัดหน้า Shorts ใหม่ไม่ให้มีอะไรทับวิดีโอ — ยังเก็บความคืบหน้า/ดูต่อ/เครื่องหมายดูจบได้ |

ข้อจำกัดอื่นของ YouTube (แม้ทำตามนโยบาย):
- รหัสคลิป YouTube ส่งให้ผู้เรียนหลัง `/play` และรูปปกก็มาจาก `i.ytimg.com/vi/<รหัส>` → ใครตั้งใจหาก็เปิดดูบน YouTube ตรง ๆ ได้ → **โควตาบน YouTube เป็นแค่ "นุ่ม"**
- คลิปต้องตั้งเป็น **Unlisted** (ไม่แสดงต่อสาธารณะ) — *Private เล่นนอก YouTube ไม่ได้* — และเปิด **Allow embedding**
- เจ้าของช่องลบ/ปิดคลิปได้ทุกเมื่อ หน้าเว็บจะขึ้น "คลิปนี้ถูกลบหรือตั้งเป็นส่วนตัวบน YouTube แล้ว"

---

## 2. ภาพรวม

- คลิปมี 2 ชนิด: **`short`** (ไม่เกิน 180 วินาที, ฟีดเต็มจอปัดขึ้นลง) และ **`long`** (ไม่เกิน 6 ชั่วโมง, หน้าดูพร้อมรายละเอียด)
- คลิป 1 คลิปเป็นของ **1 วิชา** (`subjectId`) ผูกกับบทเรียนได้ (`lessonNo`) — ปุ่ม "ไปเรียนบทที่ n" จะลิงก์ไป `lesson.html?s=<วิชา>&l=<n>`
- สถานะเหมือนเนื้อหาอื่น: `draft → in_review → published` (ผู้เรียนเห็นเฉพาะ `published`) และ `archived` แทนการลบ
- ทางเข้าของผู้เรียน: แท็บ **"คลิป"** ที่แถบล่าง (ช่องที่ 4) และการ์ด **"คลิปสอนวิชานี้"** ในหน้ารายวิชา (แสดงเมื่อวิชานั้นมีคลิปที่เผยแพร่แล้ว)

---

## 3. Admin API (เพิ่ม/แก้/เผยแพร่คลิป)

- **สิทธิ์**: ผู้ดูแล (`role = admin`) ที่ล็อกอินด้วย cookie เซสชัน คำขอที่ไม่ใช่ GET ต้องมีหัว `X-CSRF-Token` (ค่าจากคุกกี้ `hf_csrf`) และส่ง `credentials: 'include'` — เหมือน [study-admin-api.md](study-admin-api.md)
- **วิชาต้องมีอยู่แล้ว** (เริ่มวิชาแล้ว) ไม่อย่างนั้นได้ 404 — ดู `POST /admin/subjects/:id/start` ใน study-admin-api.md
- ฐาน URL: `https://<api>/api/study/admin`

| วิธี | เส้นทาง | ทำอะไร |
|---|---|---|
| GET | `/subjects/:subjectId/videos?kind=short\|long&includeArchived=1` | รายการคลิปของวิชา (ไม่รวม archived ถ้าไม่ขอ) + จำนวนแยกสถานะ |
| POST | `/subjects/:subjectId/videos` | สร้างคลิปใหม่ — **เป็นฉบับร่าง (`draft`) เสมอ** ตอบ 201 |
| GET | `/subjects/:subjectId/videos/:id` | คลิปเดียว + สถิติ `{ viewers, finished }` |
| PUT | `/subjects/:subjectId/videos/:id` | แก้เฉพาะช่องที่ส่งมา — **สถานะไม่เปลี่ยน** (คลิปที่เผยแพร่แล้วยังเผยแพร่อยู่) |
| POST | `/subjects/:subjectId/videos/:id/status` body `{ "to": "in_review" }` | เปลี่ยนสถานะ |
| DELETE | `/subjects/:subjectId/videos/:id` | = เปลี่ยนเป็น `archived` (ไม่ลบจริง ข้อมูลการดู/EXP ที่จ่ายไปแล้วยังอยู่) |

### 3.1 ช่องข้อมูล

| ช่อง | ต้องมีตอนสร้าง | กติกา |
|---|---|---|
| `id` | ไม่ | a-z 0-9 และ `-` ยาว 2–60 ตัว ไม่ใส่ = สร้างให้ `<subjectId>-v-xxxxxxxx` · ซ้ำ = 409 `ALREADY_EXISTS` · แก้ภายหลังไม่ได้ |
| `kind` | ✔ | `"short"` หรือ `"long"` |
| `title` | ✔ | 1–200 ตัวอักษร |
| `youtube` | ✔ | ลิงก์ YouTube แบบไหนก็ได้ (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`, youtube-nocookie) หรือรหัสคลิป 11 ตัว — Backend แยกรหัสให้เอง |
| `durationSec` | ✔ | ความยาวคลิปเป็นวินาที (จำนวนเต็ม) Shorts 1–180, คลิปยาว 1–21600 · **ต้องตรงกับความยาวจริง** เพราะใช้ตัดสิน "ดูจบ" (Backend ไม่ได้ถาม YouTube) |
| `exp` | ไม่ (0) | EXP ที่ได้เมื่อดูจบครั้งแรก 0–1000 (0 = ไม่มีรางวัล) |
| `lessonNo` | ไม่ | เลขบท 1–9999 หรือ `null` |
| `topic` | ไม่ | หัวข้อสั้น ๆ ไม่เกิน 80 ตัว |
| `description` | ไม่ | ไม่เกิน 2000 ตัว (ขึ้นบรรทัดใหม่ได้) |
| `sortNo` | ไม่ (0) | ลำดับในหน้าวิชา (น้อยมาก่อน) 0–100000 · หน้ารวมทุกวิชาเรียงคลิปใหม่สุดก่อน |
| `thumbnailUrl` | ไม่ | รูปปกของเอง (`https://` เท่านั้น ≤ 500 ตัว) ไม่ใส่ = ใช้รูปของ YouTube |

ช่องผิด → **422 `IMPORT_INVALID`** พร้อม `errors: [{ path, code, message }]` (ข้อความภาษาไทย แสดงใต้ช่องได้เลย) รหัส: `INVALID_ID`, `INVALID_KIND`, `INVALID_TITLE`, `INVALID_YOUTUBE`, `INVALID_DURATION`, `INVALID_EXP`, `INVALID_LESSON_NO`, `INVALID_TOPIC`, `INVALID_DESCRIPTION`, `INVALID_SORT_NO`, `INVALID_URL`

### 3.2 ขั้นสถานะ

```
draft ──► in_review ──► published
  ▲  ◄──────┘  ▲            │
  │            └─(กลับ draft)┘
  └──── archived ◄── (ทุกสถานะ)
```

`draft → in_review | archived` · `in_review → draft | published | archived` · `published → draft | archived` · `archived → draft`
ขั้นที่ไม่อนุญาต → 409 `INVALID_TRANSITION` (`details: { from, to }`) · ข้อมูลคลิปไม่ครบตอนเผยแพร่ → 409 `PUBLISH_BLOCKED`

### 3.3 ตัวอย่าง (เปิด DevTools ของหน้า Admin ที่ล็อกอินแล้ว)

```js
const API = 'https://test.beta-api.headface.app/api/study/admin'; // Preview
const csrf = decodeURIComponent((document.cookie.match(/(?:^|; )hf_csrf=([^;]+)/) || [])[1] || '');
const call = (method, path, body) => fetch(API + path, {
  method, credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
  body: body ? JSON.stringify(body) : undefined
}).then((r) => r.json());

// คำตอบเป็น { success: true, ...ข้อมูล } (ไม่มีชั้น data) ล้มเหลว = { success: false, error, message, errors? }
// 1) สร้างคลิปยาว (เข้าเป็นฉบับร่าง) → { success, saved, created, video }
const created = await call('POST', '/subjects/sci/videos', {
  kind: 'long',
  title: 'ปฏิกิริยาเคมีในชีวิตประจำวัน',
  youtube: 'https://youtu.be/XXXXXXXXXXX',
  durationSec: 754,          // 12:34
  exp: 20,
  lessonNo: 1,
  topic: 'ปฏิกิริยาเคมี',
  description: 'สรุปบทที่ 1 ใน 12 นาที'
});
// 2) ส่งตรวจ แล้วเผยแพร่
await call('POST', `/subjects/sci/videos/${created.video.id}/status`, { to: 'in_review' });
await call('POST', `/subjects/sci/videos/${created.video.id}/status`, { to: 'published' });

// Shorts: แบบเดียวกัน kind 'short' และ durationSec ≤ 180
await call('POST', '/subjects/sci/videos', { kind: 'short', title: 'ปฏิกิริยาคายความร้อนใน 60 วิ', youtube: 'https://www.youtube.com/shorts/XXXXXXXXXXX', durationSec: 58, exp: 3, lessonNo: 1 });

// แก้ EXP ของคลิปที่เผยแพร่แล้ว (สถานะคงเดิม)
await call('PUT', '/subjects/sci/videos/sci-v-1a2b3c4d', { exp: 30 });
```

> การแก้ `exp` มีผลกับคนที่ดูจบ **หลังจากนี้** เท่านั้น EXP ที่จ่ายไปแล้วไม่ถูกแก้ย้อนหลัง

### 3.4 คำตอบของคลิป (ฝั่ง Admin)

```json
{ "id": "sci-v-1a2b3c4d", "subjectId": "sci", "kind": "long", "title": "…", "description": "…",
  "source": "youtube", "youtubeId": "XXXXXXXXXXX", "thumbnailUrl": null,
  "thumbnailShown": "https://i.ytimg.com/vi/XXXXXXXXXXX/hqdefault.jpg",
  "durationSec": 754, "exp": 20, "lessonNo": 1, "topic": "…", "sortNo": 0,
  "status": "published", "publishedAt": 1795600000000, "createdAt": 1795500000000, "updatedAt": 1795600000000 }
```

---

## 4. API ฝั่งผู้เรียน (`/api/study`, ต้องล็อกอิน)

| วิธี | เส้นทาง | ใช้ทำอะไร | นับโควตา |
|---|---|---|---|
| GET | `/videos?subject=&kind=short\|long&offset=&limit=` | รายการคลิปที่เผยแพร่ (`limit` ค่าเริ่ม 24 สูงสุด 50) + `subjects` ที่มีคลิป + `quota` ของวันนี้ | ไม่ |
| GET | `/videos/:id` | คลิปเดียว (ไม่มีรหัส YouTube) + `quota` | ไม่ |
| POST | `/videos/:id/play` | เริ่มเล่น: ตรวจสิทธิ์รายวัน แล้วได้ `source: { type: 'youtube', id }` + `resumeAt` | **นับ** (คลิปละครั้งต่อวัน) |
| PUT | `/videos/:id/progress` body `{ position, ended? }` | รายงานตำแหน่งที่ดูถึง Backend ตัดสินว่าดูจบหรือยัง | ไม่ |

การ์ดคลิป (`videos[]`, `video`):
```json
{ "id": "sci-v-1a2b3c4d", "subjectId": "sci", "subject": { "id": "sci", "title": "วิทยาศาสตร์", "emoji": "🔬", "hue": "emerald" },
  "kind": "long", "title": "…", "description": "…", "durationSec": 754, "exp": 20, "expEarned": null,
  "lessonNo": 1, "topic": "…", "thumbnailUrl": "https://i.ytimg.com/…", "publishedAt": 1795600000000,
  "progress": { "positionSec": 120, "watchedSec": 118, "pct": 15, "completed": false, "completedAt": null } }
```
`quota`: `{ short: { allowed, limit, used, left }, long: { … }, period: 'daily' }` — `limit: null` = ไม่จำกัด (PLUS/MAX)

`/play` ตอบ `{ video, source, resumeAt, counted, quota }` · `/progress` ตอบ `{ progress, completedNow, reward }` โดย `reward = { exp, totals, levelUp }` เฉพาะคำขอที่จ่าย EXP

ข้อผิดพลาด: 429 `FEATURE_QUOTA_EXCEEDED` (`details: { usage, limit, period, kind }`) · 403 `FEATURE_FORBIDDEN` (แพลนปิดฟีเจอร์นี้) · 409 `VIDEO_NOT_STARTED` (รายงานก่อน `/play`) · 400 `BAD_REQUEST` (ตำแหน่งเกินความยาวคลิป +30 วินาที) · 404 `NOT_FOUND` (ไม่มี/ยังไม่เผยแพร่) · 503 `STUDY_NOT_READY` (ยังไม่รัน migration 0049)

`GET /subjects/:id` มีช่อง `videos: { short, long }` (จำนวนคลิปที่เผยแพร่ของวิชา, `null` ถ้ายังไม่รัน 0049) ใช้แสดงการ์ด "คลิปสอนวิชานี้"

---

## 5. กติกา

### 5.1 โควตารายวัน (แผน FREE)
- **FREE: Shorts 10 คลิป + คลิปยาว 5 คลิป ต่อวัน** · PLUS / MAX ไม่จำกัด — ค่าอยู่ในตาราง `plan_features` (`study.video_short`, `study.video_long`) เปลี่ยนได้โดยไม่ต้องแก้โค้ด (migration 0049 ไม่ทับค่าที่แอดมินเปลี่ยนไว้)
- นับตอน `POST /play` เท่านั้น **คลิปเดิมในวันเดียวกันนับครั้งเดียว** (ดูซ้ำ/กลับมาดูต่อได้ไม่เสียเพิ่ม) วันตัดตามเวลาไทย (เที่ยงคืน)
- เปิดหน้า `watch.html` ยังไม่นับ — นับเมื่อกดเล่น · ฟีด Shorts นับเมื่อคลิปค้างกลางจอ ≥ 0.45 วินาที (ปัดผ่านเร็ว ๆ ไม่เสีย)
- ครบแล้วแสดงการ์ด "วันนี้ดูครบ … แล้ว" พร้อมปุ่มดูแพลน

### 5.2 ดูจบ (Backend ตัดสิน)
- หน้าเว็บรายงานตำแหน่ง: Shorts ทุก 3 วินาที คลิปยาวทุก 10 วินาที + ตอนหยุด/จบ/ปิดหน้า (`keepalive`)
- เครดิตต่อรายงาน = ระยะที่เดินหน้า แต่ **ไม่เกินเวลาจริงที่ผ่านไป × 2 + 3 วินาที** (กรอข้าม = ไม่ได้เครดิต)
- **ดูจบ = เครดิตรวม ≥ 90% ของความยาว และตำแหน่งถึง 5 วินาทีสุดท้าย** (หรือ `ended`) — ใช้กฎเดียวกันทั้ง Shorts และคลิปยาว
- **EXP จ่ายครั้งเดียว** ตอนดูจบครั้งแรก (ตาราง `study_video_rewards` UNIQUE ผู้เรียน+คลิป) รวมเข้า EXP รวม/เลเวลแล้ว · ดูการ์ดจะเห็น "ได้ n EXP แล้ว"
- การดูคลิปไม่นับเป็น Streak (เรียนต่อเนื่อง)

### 5.3 ดูต่อจากเดิม
`resumeAt` = ตำแหน่งที่ค้าง ยกเว้นดูจบไปแล้วหรือค้างอยู่ใน 10 วินาทีสุดท้าย → เริ่มจาก 0

---

## 6. หน้าเว็บ

| หน้า | ชนิด | สิ่งที่ทำ |
|---|---|---|
| `videos.html[?s=วิชา]` | Barba (namespace `videos`) | ชิปเลือกวิชา · บรรทัด "วันนี้ดูได้อีก" (FREE) · แถว Shorts · รายการคลิปยาว + "ดูคลิปเพิ่ม" |
| `shorts.html[?s=วิชา][&v=คลิป]` | หน้าเต็มจอ (พื้นมืดเสมอ, ไม่มีแถบล่าง) | ปัดทีละคลิป เล่นอัตโนมัติแบบปิดเสียง แตะเพื่อเปิดเสียง/หยุด จบแล้วเลื่อนไปคลิปถัดไป เล่นทีละคลิปเดียว |
| `watch.html?v=คลิป` | หน้ากลุ่มเรียน (แถบหัวลอย) | ภาพปก + ปุ่มเล่น (ยังไม่โหลด YouTube) → เล่นต่อจากเดิม · สถานะ/EXP · ไปเรียนบทที่ n · คลิปอื่นในวิชา · ถ้าเป็น Short จะพาไป shorts.html |

ตัวเล่น: `youtube-nocookie.com`, `rel=0` (ไม่แนะนำคลิปช่องอื่น), `playsinline=1` (iOS), `iv_load_policy=3` · ระหว่างโหลดแสดงโครงเปล่าเท่านั้น ไม่มีข้อมูลตัวอย่าง

---

## 7. ยังไม่ได้ทำ / ยังไม่ได้ตรวจ

- หน้าจอ Admin (ตกลงให้ทำแค่ API + เอกสาร)
- ตัดสินเรื่องที่เก็บคลิปก่อนขึ้น Production (ข้อ 1)
- ยังไม่ได้ลองกับบัญชีจริงบน Preview (ยังไม่มีคลิปจริงในระบบ) — ทดสอบแล้วด้วย Backend ในหน่วยความจำ (เทสต์ 18 ข้อ) และหน้าเว็บจริงกับ API จำลอง + ตัวเล่น YouTube จริงที่ 375px / 320px และ dark mode
- ยังไม่ได้ลองบนมือถือจริง (การปัด, เสียงเปิดอัตโนมัติบน iOS)
