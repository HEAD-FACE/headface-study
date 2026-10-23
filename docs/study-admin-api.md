# HEADFACE Study — Admin API สำหรับสร้างและแก้เนื้อหา (สำหรับทีม Admin Frontend)

เอกสารนี้เขียนให้ **Admin Frontend** (และ AI ที่ช่วยเขียนมัน) ใช้ต่อเชื่อมกับ Backend ของ Study ได้โดยไม่ต้องอ่านโค้ด Backend
ขอบเขตของฝั่ง Study: Backend ส่วน Study + Admin API นี้ (`/api/study/admin/*`) และเอกสารนี้ — **ตัวหน้าจอ Admin ไม่ได้อยู่ในงานนี้**
(สัญญาฝั่งผู้เรียนอยู่ที่ [study-api-contract.md](study-api-contract.md); รูปแบบไฟล์นำเข้าอยู่ที่ [study-content-guide.md](study-content-guide.md))

สถานะ: ทำเสร็จและทดสอบแล้วในเครื่อง (เทสต์ `test/study-admin-api-test.js` 19 ข้อ) **ยังไม่ได้ deploy** — ก่อนใช้งานจริงต้องรัน migration 0006–0013 บน Preview ตามลำดับใน [study-rollout-checklist.md](study-rollout-checklist.md)

---

## 1. แนวทางที่แนะนำ (ตอบคำถาม "UI → JSON → ยัดเข้า Backend หรือมีวิธีที่ดีกว่า")

**ไม่แนะนำให้ UI สร้างไฟล์ JSON ทั้งวิชาแล้วส่งทุกครั้งที่แก้โจทย์ข้อเดียว** เพราะ
- แก้ข้อเดียวต้องโหลด/ส่งทั้งวิชา (โจทย์ได้ถึง 2,000 ข้อ) และถ้าสองคนแก้พร้อมกัน ใครส่งทีหลังเขียนทับของอีกคนเงียบ ๆ
- ข้อผิดพลาดบอกตำแหน่งเป็น `subject.questions[137].pairs[1].right` ซึ่งฟอร์มเอาไปแสดงที่ช่องไหนไม่ได้
- เสี่ยงทำให้เนื้อหาที่เผยแพร่แล้วกลับเป็นฉบับร่างทั้งชุดโดยไม่ตั้งใจ

**แนวทางที่ทำไว้ให้ (และแนะนำ) คือ "แก้ทีละชิ้น + ฟอร์มตาม schema + ตรวจสดก่อนบันทึก"** โดยแบ่งเป็น 4 ทาง ใช้คู่กันได้:

| ทาง | ใช้เมื่อ | เรียกอะไร |
|---|---|---|
| **A. ฟอร์มทีละชิ้น (ทางหลัก)** | ครูพิมพ์โจทย์/บทเรียนเอง ทีละข้อ | `GET /admin/schema` สร้างฟอร์ม → `POST …/validate` ตรวจสด → `POST/PUT …/questions` บันทึก |
| **B. นำเข้าชุดใหญ่** | AI ร่างเนื้อหาทั้งบท/ทั้งวิชา หรือย้ายเนื้อหาจากที่อื่น | อัปโหลดไฟล์ → `POST /admin/import` ด้วย `dryRun:true` → แสดงตารางตรวจ → นำเข้าจริง (เข้าเป็นฉบับร่างเสมอ) |
| **C. ผู้ช่วย AI ในฟอร์ม** | "สร้างโจทย์จากบทเรียนนี้" | Frontend เรียก AI ของตัวเอง → เติมลงฟอร์ม (ไม่ใช่บันทึกเลย) → `validate` → **คนตรวจแล้วกดบันทึก** (หลัก AI-Assisted, Human-Reviewed) |
| **D. วางจากตาราง (Excel/Sheets)** | โจทย์ทีละมาก ๆ ที่ครูมีเป็นตาราง | Frontend แปลงแถวเป็นโจทย์ → `validate` ทีละข้อ แสดงแถวที่ผิดพร้อมเหตุผล → ส่งผ่านไฟล์นำเข้า (ทาง B) หรือ `POST …/questions` ทีละข้อ |

ทุกทางผ่านตัวตรวจ (validator) ตัวเดียวกันและเข้าเป็น **ฉบับร่าง (draft)** เสมอ — คนต้องกดเผยแพร่เอง (`POST /admin/status`) หลังตรวจ "ความพร้อมเผยแพร่" (`readiness`)

หลักการออกแบบ API นี้ (เพื่อให้เข้าใจพฤติกรรมที่เจอ):
1. **แก้ชิ้นเดียวเขียนชิ้นเดียว** — ระบบแปลงวิชาเป็นเอกสาร แก้ชิ้นเดียว ตรวจทั้งเอกสาร แล้วเขียนเฉพาะแถวที่เปลี่ยน แถวอื่น (แฮช เวอร์ชัน สถานะ เวลาแก้ไข) ไม่ถูกแตะ ทดสอบแล้ว
2. **ไม่มีการลบจริง** — "ลบ" = `archived` (ซ่อนจากตัวแก้ไขและจากผู้เรียน กู้คืนได้) เรียงลำดับของข้ออื่นไม่เปลี่ยน
3. **เวอร์ชันและประวัติทุกครั้งที่บันทึก** — มี `version` ต่อแถว, ประวัติ (ใครบันทึกเมื่อไหร่), อ่านเวอร์ชันเก่าและกู้คืนได้
4. **เนื้อหาที่เผยแพร่แล้วไม่ถูกดึงกลับเงียบ ๆ** — แก้แถวที่เผยแพร่อยู่ต้องส่ง `confirmUnpublish:true` ถึงจะบันทึก (แถวนั้นกลับเป็น draft แถวอื่นยังเผยแพร่อยู่)
5. **ไม่ต้องคิด id** — เว้น id ของโจทย์/บท/หน่วย/node/ตัวเลือกไว้ได้ ระบบตั้งให้

---

## 2. พื้นฐาน

- **Base URL**: `${API_BASE}/api/study/admin` (Preview: `https://beta-…` ของ API เดียวกับที่หน้า Study ใช้)
- **สิทธิ์**: ผู้ดูแล (`role = admin`) ที่ล็อกอินผ่าน **cookie เซสชัน** เท่านั้น (Bearer token ไม่รับ) ทุกคำขอที่ไม่ใช่ GET ต้องมีหัว `X-CSRF-Token` (ค่าจากคุกกี้ `hf_csrf`) — ใช้ `apiFetch` ชุดเดียวกับหน้าอื่นได้ทันที; ส่ง `credentials: 'include'`
- **CORS**: อนุญาต `https://admin.headface.app` (Production) และ `https://beta-admin.headface.app` (Preview) พร้อม GET/POST/PUT/DELETE
- **รูปคำตอบ**: สำเร็จ `{ "success": true, … }` ล้มเหลว `{ "success": false, "error": "CODE", "message": "ข้อความไทย", …เพิ่มเติม }` ทุกคำตอบ `Cache-Control: no-store`
- **ขนาดคำขอ**: ไม่เกิน 1 MB; ข้อความทุกช่องเป็นข้อความธรรมดา (ห้ามแท็ก HTML — ตัวตรวจปฏิเสธ), ลิงก์สื่อต้องเป็น `https://…` หรือไฟล์ใต้ `assets/…` ของเว็บเท่านั้น
- ก่อนใช้ต้องมี migration **0006–0013** (ถ้าไม่ครบจะตอบ `503 STUDY_NOT_READY` ไม่ใช่ 500)

### รหัสข้อผิดพลาดที่ต้องรองรับ

| HTTP | `error` | ความหมาย / UI ควรทำ |
|---|---|---|
| 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN_NOT_ADMIN` / `CSRF_INVALID` / `ADMIN_COOKIE_REQUIRED` | ให้ล็อกอินใหม่ / ไม่มีสิทธิ์ |
| 400 | `BAD_REQUEST` | คำขอผิดรูป (เช่น `entity` ไม่รู้จัก, `expectedVersion` ไม่ใช่จำนวนเต็ม) เป็นบั๊กของ UI |
| 404 | `NOT_FOUND` | ไม่พบ (หรือเป็นของอีกวิชา) |
| 409 | `ALREADY_EXISTS` | id วิชาซ้ำ |
| 409 | `VERSION_CONFLICT` | มีคนบันทึกก่อน — มี `current: { version, status, updatedAt }` ให้โหลดฉบับล่าสุดแล้วให้ผู้ใช้เลือก |
| 409 | `WOULD_UNPUBLISH` | แก้/เก็บแถวที่เผยแพร่อยู่ — มี `wouldUnpublish: [{ entity, id }]` แสดงให้ผู้ใช้ยืนยัน แล้วส่งซ้ำพร้อม `confirmUnpublish: true` |
| 422 | `IMPORT_INVALID` | ข้อมูลไม่ผ่านตัวตรวจ — `errors: [{ path, code, message, other? }]`, `warnings` (ดูหัวข้อ 4) |
| 422 | `PUBLISH_BLOCKED` | เผยแพร่ไม่ได้ — `errors[]` คือสิ่งที่ต้องแก้ (จาก `POST /admin/status`) |
| 503 | `STUDY_NOT_READY` | ยังไม่ได้รัน migration |

---

## 3. Endpoint ทั้งหมด

(`:sid` = id วิชา เช่น `sci`; `:id` = id ของโจทย์/บท/หน่วย)

### 3.0 วิชา 10 วิชาของเว็บ = "ช่อง" ที่แก้ได้ หรือเพิ่มวิชาใหม่

10 วิชาที่มีในเว็บอยู่แล้วเป็นข้อมูลชุดคงที่ใน Backend (`sci mat tha eng soc his phy inf chn iel` — ชื่อ อีโมจิ สี ลำดับ ตรงกับการ์ดในหน้า Subjects) ไม่ใช่วิชาที่ต้องสร้างเอง:

| | วิชาใน 10 วิชา | วิชาที่เพิ่มเอง |
|---|---|---|
| `GET /subjects` | แสดงเสมอ `catalog:true` — ยังไม่มีเนื้อหา = `exists:false, status:null, version:null` (แสดงเป็น "ยังไม่เริ่ม") เริ่มแล้ว = `exists:true` พร้อมสถานะ/จำนวน | `catalog:false, exists:true` เลข `no` ≥ 11 ต่อท้าย 10 วิชา |
| เริ่ม | `POST /subjects/:sid/start` **หรือบันทึกอะไรลงไปเลย** (เพิ่มหน่วย/บท/โจทย์/Mock/แก้ข้อมูลวิชา) ระบบเริ่มวิชาให้เองด้วยค่าของการ์ด | `POST /subjects` |
| แก้ภายหลัง | endpoint เดียวกันทุกตัว (หัวข้อ 3.2) | เหมือนกัน |
| อ่าน/ตรวจ/ดูตัวอย่างก่อนเริ่ม | `GET /subjects/:sid` ได้โครงว่าง + `readiness.blockers = [NOT_STARTED]`; `validate` และ `dryRun` ทำได้โดย **ไม่สร้างแถวใดในฐานข้อมูล** | – |

รายการ 10 วิชาอยู่ใน `GET /schema → subjectCatalog` ด้วย (`id, no, title, eyebrow, emoji, hue, category`) — ใช้ทำปุ่ม "เริ่มวิชานี้" และตัวเลือกสี/อีโมจิได้
แนะนำหน้าแรกของแอดมิน: แสดง 10 การ์ดตามลำดับ (วิชาที่ยังไม่เริ่มสีจาง มีปุ่ม "เริ่มเขียนเนื้อหา") ตามด้วยวิชาที่เพิ่มเอง และปุ่ม "+ เพิ่มวิชาใหม่" — ผู้เรียนยังเห็นเฉพาะวิชาที่ `published` เหมือนเดิม จึงไม่มีวิชาว่างโผล่ในหน้าเว็บ

### 3.1 อ่านข้อมูลเพื่อสร้างหน้าจอ

| Endpoint | ให้อะไร |
|---|---|
| `GET /schema` | **คำอธิบายเนื้อหาทั้งหมดเป็นข้อมูล** เพื่อสร้างฟอร์ม: รูปแบบโจทย์ทุกแบบ (ฟิลด์ ขีดจำกัด วิธีให้คะแนน ตัวอย่างที่ผ่านตัวตรวจจริง), ชนิดบล็อกเนื้อหา, ค่าเริ่มต้น EXP/ดาว, ขีดจำกัดทุกอย่าง, ลำดับสถานะ, เกณฑ์ก่อนเผยแพร่ — **เรียกครั้งเดียวตอนเปิดแอป แล้วสร้างฟอร์มจากมัน** ไม่ฝังตัวเลขในโค้ด Frontend |
| `GET /subjects?includeArchived=1` | รายวิชา **ครบ 10 วิชาของเว็บเสมอ** (ดูหัวข้อ 3.0) + วิชาที่เพิ่มเอง: `id, no, title, eyebrow, emoji, hue, exists, catalog, status, version, updatedAt, counts{units,lessons,questions,questionsByStatus}, mock` |
| `GET /subjects/:sid` | **โครงของวิชา** (วิชาใน 10 วิชาที่ยังไม่เริ่ม → 200 `exists:false` โครงว่าง ไม่ใช่ 404) สำหรับเมนูนำทาง: `subject`, `units[]→lessons[]→nodes[]` (แต่ละตัวมี `status`, `version`; node มี `type`, `exp`, `quizSize`, `passPct`, จำนวน `pages` หรือ `questions`), `mock`, `questions{total, byFormat}`, `readiness{publishable, blockers[], warnings[], mockPool}` |
| `GET /subjects/:sid/lessons/:id` | บทเดียวแบบเต็ม (ทุก node, ทุกหน้า, ทุกบล็อก) พร้อม `unitId, status, version` |
| `GET /subjects/:sid/questions?…` | **คลังโจทย์** (ดูหัวข้อ 3.3) |
| `GET /subjects/:sid/questions/:id` | โจทย์เดียวในรูปที่ฟอร์มแก้ + `status, version` + `preview` |
| `GET /subjects/:sid/export` | ทั้งวิชาในรูปแบบไฟล์นำเข้า (ดาวน์โหลดสำรอง/แก้ด้วยเครื่องมืออื่น) นำเข้ากลับได้ทันที ไม่เปลี่ยนอะไร |

### 3.2 สร้าง / แก้ / ซ่อน

รูปแบบคำขอเขียนทุกตัว: `{ "<entity>": { …ฟิลด์… }, "expectedVersion"?: n, "dryRun"?: bool, "confirmUnpublish"?: bool }`
คำตอบสำเร็จ (บันทึกแล้ว): `{ saved: true, id, entity: {…ฉบับที่บันทึก…}, status, version, summary, wouldUnpublish, warnings }`
`dryRun: true` = ตรวจและคำนวณว่าจะเปลี่ยนอะไร **โดยไม่เขียน** (`saved: false`)

| Endpoint | ทำอะไร |
|---|---|
| `POST /subjects/:sid/start` (ไม่ต้องมี body) | **เริ่มวิชาใน 10 วิชาของเว็บ** ด้วยชื่อ/อีโมจิ/สี/ลำดับของการ์ดเดิม (201, draft) — มีแล้ว → 409 `ALREADY_EXISTS`; ไม่ใช่ 1 ใน 10 → 404 |
| `POST /subjects` `{ subject: { id, title, no?, eyebrow?, description?, objectives?, level?, metaText?, hue?, emoji? } }` | **เพิ่มวิชาใหม่** (201, เป็น draft) — `no` ไม่ใส่ = ต่อท้าย (เลข 11 ขึ้นไป); ถ้า `id` เป็น 1 ใน 10 ฟิลด์ที่ไม่ส่งจะใช้ค่าของการ์ดเดิม |
| `PUT /subjects/:sid` `{ subject: {…เฉพาะฟิลด์ที่แก้…} }` | แก้ข้อมูลวิชา (ฟิลด์ที่ไม่ส่ง = คงเดิม; ส่ง `null` = ล้าง) |
| `POST /subjects/:sid/units` `{ unit: { title, position? } }` | เพิ่มหน่วย (201) `position` = ตำแหน่ง (เริ่ม 0) |
| `PUT /subjects/:sid/units/:id` `{ unit: { title, position? } }` | แก้ชื่อ/ย้ายลำดับหน่วย |
| `POST /subjects/:sid/lessons` `{ unitId, lesson }` | เพิ่มบท (201) — `lesson.no` ไม่ใส่ = ต่อท้าย; node ที่ไม่มี `id` ระบบตั้งเป็น `<lessonId>-<type><n>` |
| `PUT /subjects/:sid/lessons/:id` `{ lesson, unitId? }` | บันทึกบท **ทั้งบท** (ส่งรายการ `nodes` ครบ — แนะนำให้ `GET` มาแก้แล้วส่งกลับ); ใส่ `unitId` อื่น = ย้ายไปหน่วยนั้น |
| `POST /subjects/:sid/questions` `{ question }` | เพิ่มโจทย์ (201) เว้น `id` ได้ |
| `PUT /subjects/:sid/questions/:id` `{ question }` | บันทึกโจทย์ (สร้างถ้ายังไม่มี) |
| `PUT /subjects/:sid/mock` `{ mock: { title, questionCount, durationMin, passMarkPct?, timeBonusPct?, exp?, maxStars? } }` | ตั้งชุด Mock (วิชาละ 1 ชุด id คงเดิม) |
| `DELETE /subjects/:sid/(questions|lessons|units)/:id` | **ซ่อน (archived)** — ถ้าเผยแพร่อยู่ต้องต่อ `?confirmUnpublish=1` ; DELETE `/subjects/:sid` ซ่อนทั้งวิชา |
| `POST /status` `{ entity, id, to, cascade?, reason? }` | (มีอยู่เดิม) เปลี่ยนสถานะ draft → in_review → published; `to: "draft"` = กู้จาก archived — ดูหัวข้อ 5 |
| `POST /overview` `{ subjectId }` | (มีอยู่เดิม) รายละเอียดสิ่งที่ขวางการเผยแพร่ — ข้อมูลเดียวกับ `readiness` ของ `GET /subjects/:sid` |

`entity` ในคำขอของโจทย์ใช้รูปเดียวกับ "ไฟล์นำเข้า" (หัวข้อ 4 และ [study-content-guide.md](study-content-guide.md)); ข้อแตกต่างที่ทำให้ฟอร์มง่ายขึ้น:
- ไม่ต้องใส่ `kind` — ถ้า `uses` มี `practice` เป็น `open` นอกนั้นเป็น `mcq`
- ไม่ต้องใส่ `id` ของโจทย์ และ `id` ของตัวเลือก (`choices[].id`; ตั้ง a b c … ตามลำดับ — แต่ `correct` ต้องอ้างเป็นตัวอักษรนั้น)
- ใส่ `node` (id ของ node ชนิด quiz/practice ที่โจทย์อยู่) ได้เลย ไม่ต้องใส่ `lessonNo`

### 3.3 คลังโจทย์ `GET /subjects/:sid/questions`

กรองด้วย query: `lesson=<lessonId>`, `node=<nodeId>`, `format=choice|truefalse|multi|match|order|categorize|fill|numeric|open`, `use=quiz|practice|mock`, `status=draft|in_review|published|archived` (ไม่ใส่ = ทุกสถานะ **ยกเว้น archived**), `tier=standard|advanced`, `topic=<หัวข้อตรงตัว>`, `q=<ค้นในโจทย์และหัวข้อ>`, `limit` (≤200, ค่าเริ่มต้น 50), `offset`
คืน `{ total, limit, offset, questions: [{ id, kind, format, stem (ตัดที่ 140 ตัวอักษร), topic, difficulty, tier, uses[], lessonId, lessonNo, nodeId, exp, status, version, updatedAt }] }` เรียงตามลำดับในคลัง
ค่าที่ไม่รู้จัก → `400`

### 3.4 ตรวจสด `POST /subjects/:sid/validate`

ใช้ระหว่างพิมพ์ (แนะนำ debounce ~600 ms) **ไม่เขียนอะไรเลย** ตอบ 200 เสมอ (แม้ข้อมูลผิด) ยกเว้นคำขอผิดรูป (400)
```json
{ "entity": "question", "id": "sci-q012"?, "data": { …โจทย์… }, "unitId"?: "…" }
```
`entity` = `question | lesson | unit | mock | subject` (ไม่ใส่ `id` = ถือเป็นของใหม่)
```json
{ "valid": false,
  "errors":   [ { "path": "question.pairs[0].right", "code": "REQUIRED", "message": "ต้องระบุ" } ],
  "warnings": [ { "path": "question.explanation", "code": "NO_EXPLANATION", "message": "…" } ] }
```
เมื่อ `valid` และเป็นโจทย์ มี **`preview`**: `{ student: {…สิ่งที่ผู้เรียนจะได้รับ ไม่มีเฉลย…}, key: {…เฉลย…} }` — `student` เป็นรูปเดียวกับที่ Quiz/Mock ส่งให้หน้าเรียน (id ใน `key` ตรงกับ id ใน `student`) ใช้วาดตัวอย่าง "ผู้เรียนจะเห็นแบบนี้" และ "เฉลยคือ…" ได้เลย

### 3.5 ประวัติและกู้คืน

| Endpoint | ทำอะไร |
|---|---|
| `GET /subjects/:sid/history?entity=question&id=…&limit=` | รายการล่าสุดก่อน: `{ id, version, action (import \| status), fromStatus, toStatus, actorId, reason, createdAt, restorable }` |
| `GET /subjects/:sid/history/:revisionId` | เนื้อหาของเวอร์ชันนั้น **ในรูปที่ฟอร์มแก้** (เทียบกับฉบับปัจจุบันเพื่อแสดง diff ได้) — เฉพาะที่ `restorable` |
| `POST /subjects/:sid/history/:revisionId/restore` `{ expectedVersion?, confirmUnpublish? }` | บันทึกเนื้อหาเก่าเป็น **เวอร์ชันใหม่** (กลับเป็น draft) |

---

## 4. ข้อผิดพลาดของตัวตรวจ (`errors[].path`)

path ถูกย่อให้เป็นชื่อสิ่งที่กำลังแก้: `question.stem`, `question.choices[2].text`, `question.pairs[0].right`, `lesson.nodes[1].quizSize`, `lesson.nodes[0].pages[2].blocks[3].text`, `mock.questionCount`, `unit.title`, `subject.title` — **ใช้ path นี้ผูกข้อความผิดกับช่องในฟอร์มโดยตรง**
`other: true` = ข้อผิดพลาดที่อยู่นอกสิ่งที่กำลังแก้ (เช่น node ที่โจทย์อื่นอ้างถึงหายไปหลังแก้บท — path เป็นของทั้งเอกสาร `subject.questions[3].node`) แสดงเป็นข้อความรวมของหน้า ไม่ผูกช่อง
`warnings` ไม่ขวางการบันทึก แต่บอกสิ่งที่ยังเผยแพร่ไม่ได้ (เช่น `NO_EXPLANATION`) หรือฟิลด์ที่ไม่รู้จัก (`UNKNOWN_FIELD`) หรือฟิลด์ของรูปแบบอื่นที่ใส่มาโดยไม่ใช้ (`IGNORED_FIELD`)

รหัสที่เจอบ่อย: `REQUIRED`, `TOO_LONG`, `HTML_NOT_ALLOWED`, `DUPLICATE_ITEM` (ข้อความซ้ำในรายการเดียวกัน), `BLANK_MARKERS` (ช่องว่าง `[[n]]` ไม่ตรงกับ `blanks`), `GROUP_NOT_FOUND`, `EMPTY_GROUP`, `CORRECT_NOT_IN_CHOICES`, `TOO_FEW` / `TOO_FEW_CHOICES`, `BAD_NUMBER`, `ID_PREFIX` (id ต้องขึ้นต้นด้วย `{subjectId}-`), `NODE_NOT_FOUND`, `NODE_TYPE_MISMATCH`, `URL_NOT_ALLOWED`, `MCQ_NOT_PRACTICE`, `BAD_FORMAT`

---

## 5. ขั้นตอนเผยแพร่

1. ทุกอย่างที่สร้าง/แก้ผ่าน API นี้เป็น **draft** (ผู้เรียนมองไม่เห็น)
2. ดู `readiness` ของ `GET /subjects/:sid` — `publishable: true` เมื่อไม่มีอะไรขวาง; `blockers[]` บอกเป็นรายการ (เช่น โจทย์ไม่มีคำอธิบายเฉลย, บทไม่มีเนื้อหา, ชุด Quiz ไม่มีโจทย์, Mock มีโจทย์ standard ไม่พอ)
3. `POST /status { entity: "subject", id: "sci", to: "in_review", cascade: true }` แล้ว `to: "published"` — `cascade: true` เปลี่ยนทั้งวิชาและทุกอย่างที่อยู่ในนั้นพร้อมกัน; ไม่ผ่านเกณฑ์ → `422 PUBLISH_BLOCKED` พร้อมรายการที่ต้องแก้
4. แก้ของที่เผยแพร่แล้วภายหลัง: ได้ (ต้อง `confirmUnpublish`) — แถวนั้นกลับเป็น draft และหายจากผู้เรียนจนกว่าจะเผยแพร่ใหม่ (ทำเป็นข้อ 3 กับ `entity: "question"` ฯลฯ ได้ทีละแถว)

---

## 6. คู่มือออกแบบหน้าจอ (ข้อเสนอ ไม่บังคับ)

**โครงหน้า**: รายวิชา → โครงวิชา (ต้นไม้ หน่วย > บท > กิจกรรม + สถานะสี) → (ก) ตัวแก้บท (ข) คลังโจทย์ + ตัวแก้โจทย์ (ค) ตั้งค่า Mock → หน้าตรวจก่อนเผยแพร่

**ตัวแก้บท**: เป็นลิสต์ของ "กิจกรรม" (วงกลมบนเส้นทางเรียน) ลากเรียง/เพิ่ม/ลบได้ — เนื้อหา (หลายหน้า แต่ละหน้าเป็นลิสต์บล็อก heading / paragraph / figure / callout / steps / checklist), Quiz (ขนาดชุด, เกณฑ์ผ่าน, EXP), Practice (EXP) ใช้ฟิลด์จาก `schema.blocks` / `schema.nodes` บันทึกทั้งบทด้วย `PUT …/lessons/:id`

**ตัวแก้โจทย์ (หัวใจ)** — ขั้นตอนที่ใช้ง่ายสำหรับครู:
1. เลือก "รูปแบบโจทย์" เป็นการ์ดใหญ่พร้อมไอคอนและคำอธิบายสั้น ๆ (จาก `schema.formats[].label`) แทนการให้พิมพ์ชื่อ format
2. ฟอร์มแสดงเฉพาะฟิลด์ของรูปแบบนั้น (จาก `schema.formats[].fields` + `schema.questionCommon`) พร้อมข้อความช่วยและขีดจำกัด (`min`/`max`)
3. ตรวจสดผ่าน `…/validate` แล้วแสดงข้อผิดใต้ช่องด้วย `path`; ปุ่ม "บันทึก" ปิดเมื่อมี `errors` (เปิดได้เมื่อมีแต่ `warnings` แต่แสดงเตือน)
4. แผงตัวอย่างด้านข้าง: วาด `preview.student` แบบที่ผู้เรียนเห็น + ปุ่ม "แสดงเฉลย" วาดจาก `preview.key`
5. บันทึกด้วย `POST` (ใหม่) หรือ `PUT` (แก้) พร้อม `expectedVersion` ที่ได้ตอนโหลด; เจอ `VERSION_CONFLICT` → แสดงฉบับของอีกคน; เจอ `WOULD_UNPUBLISH` → กล่องยืนยัน "ข้อนี้เผยแพร่อยู่ แก้แล้วจะกลับเป็นฉบับร่าง"

**ตัวอย่างวิธีสร้างช่องกรอกของแต่ละรูปแบบ** (ตรงกับ `schema.formats[].fields[].type`):

| รูปแบบ | ช่องในฟอร์มที่เหมาะ |
|---|---|
| เลือก 1 ข้อ | รายการตัวเลือก (เพิ่ม/ลบ/ลากเรียง) + ปุ่มวิทยุเลือกข้อที่ถูก; ตัวเลือกใส่รูปได้ |
| จริง/เท็จ | สวิตช์ "ข้อความนี้จริง" |
| เลือกหลายข้อ | รายการตัวเลือก + ช่องติ๊กข้อที่ถูก |
| จับคู่ | ตาราง 2 คอลัมน์ (ซ้าย ขวา) เพิ่มทีละคู่ + ช่อง "ตัวหลอกฝั่งขวา" |
| เรียงลำดับ | รายการขั้นตอน **เรียงตามลำดับที่ถูก** (ลากสลับได้) — ระบบสับให้ผู้เรียนเอง |
| จัดกลุ่ม | รายชื่อกลุ่ม (2–4) + ตารางรายการ (ข้อความ, เลือกกลุ่มจากเมนู) |
| เติมคำ | ช่องประโยค พิมพ์ `[[1]]` `[[2]]` ได้ + ปุ่ม "แทรกช่องว่าง" ที่ใส่ให้เอง + รายการคำเฉลยตามลำดับช่อง + รายการคำหลอก |
| กรอกตัวเลข | ช่องตัวเลข (คำตอบ) + ช่อง ± ความคลาดเคลื่อน + ช่องหน่วย |

**คลังโจทย์**: ตารางพร้อมตัวกรองบนหัวคอลัมน์ (`format`, `status`, `use`, `tier`, `topic`, บท/ชุด) และช่องค้นหา แสดงป้ายสถานะ (draft/in_review/published) และรูปแบบ; แก้หลายข้อพร้อมกัน (เช่น เปลี่ยนสถานะทั้งหมดที่กรองไว้) ทำด้วยการเรียก `POST /status` ทีละแถว

**นำเข้าชุดใหญ่ (ทาง B/D)**: ปุ่ม "นำเข้าจากไฟล์" → อ่านไฟล์ → `POST /import { …ไฟล์…, dryRun: true }` → แสดงตาราง "จะสร้าง X / แก้ Y / ไม่เปลี่ยน Z" และ `warnings`/`errors` พร้อม path → ผู้ใช้ยืนยัน → ส่งซ้ำไม่มี `dryRun` (ต้อง `confirmUnpublish: true` ถ้ามีแถวที่เผยแพร่อยู่จะถูกแก้) ทำให้ **นำเข้าซ้ำไฟล์เดิมได้โดยไม่ซ้ำซ้อน** (id เป็นคีย์)
ถ้าจะเติมโจทย์จำนวนมากเข้าวิชาที่มีอยู่: `GET /export` → เติมโจทย์ใหม่ต่อท้าย `subject.questions` (ใส่ `sortNo` ต่อจากตัวสุดท้าย) → `POST /import` — แถวเดิมที่ไม่เปลี่ยนจะไม่ถูกแตะ

**สิ่งที่ Frontend ไม่ต้องทำเอง**: ตรวจกฎเนื้อหา (ให้ `validate` ตัดสิน), สร้าง id, สับลำดับ/ซ่อนเฉลย, คำนวณคะแนนหรือแฮช

---

## 7. ตัวอย่างครบวงจร (สร้างวิชา → Quiz จับคู่ → เผยแพร่)

```http
POST /api/study/admin/subjects
{ "subject": { "id": "chem", "title": "เคมี", "emoji": "⚗️", "hue": "violet" } }
→ 201 { "saved": true, "subject": { "id": "chem", "status": "draft", "version": 1 }, "units": [] }

POST /api/study/admin/subjects/chem/units
{ "unit": { "title": "กรด-เบส" } }
→ 201 { "id": "chem-uk3j9x0qp1ab", … }

POST /api/study/admin/subjects/chem/lessons
{ "unitId": "chem-uk3j9x0qp1ab",
  "lesson": { "title": "pH เบื้องต้น",
    "nodes": [ { "type": "content", "title": "อ่าน", "pages": [ { "blocks": [ { "type": "paragraph", "text": "pH บอกความเป็นกรด-เบส" } ] } ] },
               { "type": "quiz", "title": "Quiz", "quizSize": 3 } ] } }
→ 201 { "id": "chem-lm0abc123xyz", "entity": { "nodes": [ { "id": "chem-lm0abc123xyz-content1", … }, { "id": "chem-lm0abc123xyz-quiz2", … } ] } }

POST /api/study/admin/subjects/chem/validate            ← ระหว่างพิมพ์
{ "entity": "question", "data": { "format": "match", "node": "chem-lm0abc123xyz-quiz2", "uses": ["quiz"],
    "difficulty": "easy", "topic": "กรด-เบส", "stem": "จับคู่", "pairs": [ { "left": "HCl", "right": "กรด" }, { "left": "NaOH", "right": "" } ] } }
→ 200 { "valid": false, "errors": [ { "path": "question.pairs[1].right", "code": "REQUIRED", "message": "ต้องระบุ" } ],
        "warnings": [ { "path": "question.explanation", "code": "NO_EXPLANATION", … } ] }

POST /api/study/admin/subjects/chem/questions
{ "question": { "format": "match", "node": "chem-lm0abc123xyz-quiz2", "uses": ["quiz"], "difficulty": "easy", "topic": "กรด-เบส",
    "stem": "จับคู่สารกับประเภท", "pairs": [ { "left": "HCl", "right": "กรด" }, { "left": "NaOH", "right": "เบส" } ],
    "explanation": "HCl เป็นกรด NaOH เป็นเบส", "exp": 8 } }
→ 201 { "saved": true, "id": "chem-qm0abc9x1", "status": "draft", "version": 1, "entity": { … } }

GET /api/study/admin/subjects/chem                       ← ดู readiness
→ { …, "readiness": { "publishable": false, "blockers": [ { "path": "…", "code": "MOCK_…" } ] } }

POST /api/study/admin/status
{ "entity": "subject", "id": "chem", "to": "in_review", "cascade": true }   แล้ว   { …, "to": "published", "cascade": true }
```

---

## 8. สิ่งที่ยังไม่มี (ตัดสินใจร่วมกันถ้าต้องการ)

- **อัปโหลดรูป/วิดีโอ**: API นี้รับเฉพาะลิงก์ `https://…` หรือไฟล์ใต้ `assets/study/…` ที่ commit ไว้กับเว็บ Study — ถ้า Admin ต้องอัปโหลดรูปเอง ต้องมีที่เก็บไฟล์ (เช่น Cloudinary ที่ระบบรูปโปรไฟล์ใช้อยู่) เพิ่ม
- **นำเข้าโจทย์ชุดใหญ่แบบแบตช์ในคำขอเดียว** ที่ไม่ต้องส่งทั้งวิชา: ตอนนี้ใช้ `export → เติม → import` (หัวข้อ 6) ถ้าช้าหรืออึดอัดค่อยเพิ่ม `POST …/questions/bulk`
- **บทบาทอื่นนอกจาก admin** (เช่น ครูที่แก้ได้เฉพาะวิชาตัวเอง): ตอนนี้ admin ทุกคนแก้ได้ทุกวิชา
- **ความขัดแย้งแบบมีคนแก้พร้อมกันระดับย่อย**: ล็อกด้วย `expectedVersion` ต่อชิ้น (โจทย์/บท) เท่านั้น ยังไม่มีการล็อกแบบเรียลไทม์
- **เรียงลำดับโจทย์ในคลัง** ลากสลับ: ลำดับถูกเก็บ (`sortNo`) แต่ยังไม่มี endpoint ย้ายตำแหน่ง (ลำดับนี้กระทบแค่การสุ่ม/แสดงในคลัง ไม่กระทบผู้เรียน)
- **ลบจริง**: ไม่มีโดยตั้งใจ (archive แทน)
