# เช็กลิสต์นำระบบ Study ขึ้น Preview (beta-study) และสิ่งที่ต้องตรวจ

ระยะ v1 (หัวข้อ 1–7) ถูกนำขึ้น Preview ไปแล้ว ส่วน **v2 (หัวข้อ 0) ยังอยู่ในเครื่องทั้งหมด** ไม่ได้ commit / deploy / รัน migration ใด ๆ
ลำดับสำคัญ: **Backend (migration → deploy Preview) → นำเข้าเนื้อหา → ค่อย push Frontend** ถ้า push Frontend ก่อน หน้ารายละเอียดวิชา/บทเรียนจะขึ้น "โหลดข้อมูลไม่สำเร็จ"
(หน้า Home/Subjects/Progress จะคงตัวเลขตัวอย่างเดิมไว้เพราะเติมข้อมูลจริงไม่ได้)

## 0. อัปเดต v2 (2026-10-16): เส้นทางวงกลม + เนื้อหาหลายหน้า + ภาพ/วิดีโอ — ทำหลังจาก Preview ใช้ v1 ได้แล้ว

ลำดับ: **migration → deploy Backend → นำเข้าเนื้อหา v2 ซ้ำ → push Frontend (พร้อมโฟลเดอร์ `assets/study/`)** ถ้า push Frontend ก่อน หน้าวิชาจะอ่านข้อมูลรูปแบบใหม่ไม่ได้ และถ้ารัน Backend ใหม่ก่อน migration จะตอบ 503 `STUDY_NOT_READY`

- [ ] สำเนา Backend ก่อนแก้ v2 อยู่ที่ `C:\Users\ASUS\OneDrive\Documents\cloudflare\headface-backend.snapshot-study-pre-nodes-20261016` (เฉพาะไฟล์ Study: `src/study`, `test`, migration 0006–0007, `schema.sql`, `package.json`)
- [ ] รัน `npm run test:all` ใน Backend (ผ่านแล้ว exit 0; ชุด Study 185 ข้อ) และ `node --test test/*.test.mjs` ใน Frontend
- [ ] **migration ใหม่ 2 ไฟล์: `0008_study_nodes.sql`, `0009_study_node_progress.sql`** — รันด้วย `npm run db:migrate:preview` **ครั้งเดียวเท่านั้น** (ใช้ `ALTER TABLE ADD COLUMN` ซึ่งรันซ้ำด้วยมือไม่ได้: ถ้าเจอ "duplicate column name" แปลว่าเคยรันไปแล้ว อย่ารันซ้ำ ให้ตรวจ `npx wrangler d1 migrations list PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc` ก่อนเสมอ)
  - เพิ่มคอลัมน์ `nodes_json`, `pages_json` (บท), `node_id`, `media_json` (โจทย์), `node_id` (การทำ Quiz) และตาราง `study_node_progress` — ไม่แก้/ลบตารางเดิม
- [ ] deploy Preview (`npm run preview` หรือคำสั่งเดิม)
- [ ] **นำเข้าไฟล์ `docs/examples/study-content.sci-mock.json` (รุ่น 2) ซ้ำทับของเดิม**: บทและโจทย์ที่เผยแพร่อยู่จะเปลี่ยนเนื้อหา จึงต้อง `dryRun` ก่อน แล้วนำเข้าด้วย `confirmUnpublish: true` จากนั้น `overview` → `in_review` → `published` (cascade) ตามคู่มือ (Console คำสั่งเดิม)
- [ ] push Frontend **รวมโฟลเดอร์ `assets/study/sci/`** (ภาพ SVG ของเนื้อหาจำลองอยู่ที่นั่น; ถ้าไม่ push ภาพจะไม่ขึ้น)
- [ ] **ความคืบหน้าที่เคยทดสอบบน Preview จะเริ่มนับใหม่**: ความคืบหน้าเก็บต่อ node ในตารางใหม่ (เดิมเก็บต่อบท) ข้อมูลเก่าไม่ถูกลบแต่ไม่ถูกใช้ — กระทบเฉพาะบัญชีทดสอบ (Production ยังไม่เคยมีข้อมูล Study)
- [ ] ตรวจบน beta-study (มือถือ + เดสก์ท็อป): (1) กดการ์ดวิทยาศาสตร์ที่หน้า Home/Subjects → หน้าวิชาเปลี่ยนแบบ Barba พื้นที่สีเขียวด้านบนต่อเนื่อง (ไม่โหลดหน้าใหม่ทั้งหน้า) แล้วกดย้อนกลับก็ต่อเนื่อง (2) เส้นทางวงกลม แยกสีตามบท กดวงกลมแล้วเห็นการ์ด "เริ่ม" (3) ชุดเนื้อหาหลายหน้าอ่านทีละหน้า ปัดซ้าย/ขวาได้ มีภาพและวิดีโอ จบเนื้อหาแล้วมีริบบิ้น (4) Quiz/Mock มีโจทย์ที่เป็นภาพและตัวเลือกเป็นภาพ (5) เปิดหน้าใหม่ซ้ำ ๆ ไม่มีค้าง/กระพริบ
- [ ] ที่ผมตรวจไม่ได้: ลักษณะการทำงานบน Cloudflare จริง (CORS/cookie ข้ามโดเมนของเส้นทาง API ใหม่), การฝัง YouTube ในเบราว์เซอร์จริง (ในเครื่องทดสอบเฉพาะตัวสร้างลิงก์ ไม่ได้โหลดวิดีโอ YouTube จริง), ความเร็วบนมือถือรุ่นเก่า, และเบราว์เซอร์ที่เก่ากว่า Chrome 90 / Safari 16 (ใช้ `overflow-x: clip` ให้ส่วนหัวของหน่วยค้างขอบบนได้)

## 1. ก่อนเริ่ม (ข้อกำหนดของระยะ v1 เดิม)
- [ ] Backend (`C:\Users\ASUS\OneDrive\Documents\cloudflare\headface-backend`) **ไม่ได้อยู่ใน git** — สำเนาก่อนแก้อยู่ที่ `headface-backend.snapshot-20261014` (มีงานอื่นแก้ไฟล์ในโฟลเดอร์เดียวกันด้วย เช่น homework / AIagent) ควร `git init` + commit หรือสำรองโฟลเดอร์ก่อน deploy
- [ ] รัน `npm run test:all` ใน Backend ให้ผ่าน (ตอนส่งมอบผ่านทั้งหมด exit 0)
- [ ] รัน `node --test test/*.test.mjs` ใน Frontend ให้ผ่าน (223 ข้อ)

## 2. Backend → Preview
ไฟล์ที่ผมเพิ่ม/แก้ใน Backend (ไฟล์เดิมที่แก้มี 3 ไฟล์เท่านั้น):
- ใหม่: `migrations/0006_study_core.sql`, `migrations/0007_study_learner.sql`, `src/study/*` (16 ไฟล์), `test/study-*-test.js`, `test/studyWorld.js`
- แก้: `src/worker.js` (import + route `/api/study` + งาน cron ที่ 5), `schema.sql` (ต่อท้าย), `package.json` (`test:all`)

- [ ] **ก่อนรัน migrate ให้เช็กว่า 0005 ถูกบันทึกไว้แล้วหรือยัง** (`npx wrangler d1 migrations list PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc`). ถ้า 0005 ขึ้นว่ายังไม่ได้รัน *ทั้งที่* คอลัมน์ `homework.details` / `homework_status.dismissed_at` และตาราง `announcements` มีอยู่แล้ว (เคยรันมือ) คำสั่ง migrate จะหยุดที่ 0005 ด้วย "duplicate column name" และ 0006/0007 จะไม่ถูกรัน → หน้าวิชาขึ้น 503 `STUDY_NOT_READY` (เดิมเป็น 500) แก้โดยบันทึก 0005 ให้เป็นรันแล้วก่อน:
  `npx wrangler d1 execute PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc --command "INSERT INTO d1_migrations (name) VALUES ('0005_homework_overhaul.sql')"`
- [ ] `npm run db:migrate:preview` — จะรัน 0006 และ 0007
- [ ] `npm run preview` (หรือคำสั่งที่ใช้ deploy Preview เดิม)
- [ ] ตรวจว่ามีตาราง 11 ตัวขึ้นต้น `study_` ใน D1 `headface-preview`
- [ ] ค่า `study.mock` ของแพลน FREE ใน D1 จริง: ผมเข้าใจว่าไม่จำกัด (ตาม `featureRegistry.js`) แต่ `schema.sql` เก่าเขียน 5/วัน — ตรวจด้วย `SELECT plan_id, enabled, limit_value FROM plan_features WHERE feature_key IN ('study.mock','study.quiz','study.quiz_advanced','study.mock_advanced')` ถ้าไม่ตรงกับที่ตั้งใจ (FREE ไม่จำกัด, PLUS/MAX เปิด advanced) ให้รัน `/admin/platform/init-schema` หรือแก้ค่า
- [ ] ตรวจ CORS: `wrangler.jsonc` (previews.vars) มี `https://beta-study.headface.app` แล้ว

## 3. นำเข้าเนื้อหา (ทำตาม `docs/study-content-guide.md`)
- [ ] ล็อกอิน beta-study ด้วยบัญชี `role = admin` เปิด Console แล้วลอง **dry run** ไฟล์ตัวอย่าง `docs/examples/study-content.sample.json` ก่อน (อย่า Publish ไฟล์ตัวอย่าง — เป็นข้อความ `[...]` ไม่ใช่เนื้อหาจริง)
- [ ] นำเข้าเนื้อหาวิชานำร่อง **วิทยาศาสตร์ (`sci`)** → ตรวจด้วย `overview` → ส่งรีวิว → เผยแพร่
- [ ] ไฟล์เนื้อหา **จำลอง** สำหรับทดสอบระบบ: `docs/examples/study-content.sci-mock.json` (วิทยาศาสตร์ 4 บท โจทย์ 44 ข้อ ดูรายละเอียดใน `study-content-guide.md`) — นำเข้าได้ทันทีตามขั้นตอนในคู่มือ
- [ ] เนื้อหาหลักสูตรจริงยังไม่ได้ร่าง เพราะยังไม่มีระดับชั้น/รายชื่อหน่วย-บท (ส่งมาแล้วผมร่างไฟล์ให้ตรวจได้) — เมื่อพร้อมให้ตรวจข้อ 3 ในคู่มือ แล้วนำเข้าซ้ำทับ (`confirmUnpublish: true` ถ้าแถวเผยแพร่อยู่)

## 4. Push Frontend (branch `test` → beta-study)
ไฟล์ใหม่/แก้อยู่ใน `git status` ของรีโพนี้ (ยังไม่ commit): หน้าใหม่ `report.html`, `js/study-*.js`, แก้ `index/subject/progress.html`, `css/*`, `js/main.js`, `docs/*`, `test/*`

## 5. สิ่งที่ต้องตรวจบน beta-study ด้วยตัวเอง (ผมตรวจได้เฉพาะในเครื่อง)
ใช้อย่างน้อย 2 บัญชี: FREE และ PLUS/MAX (ตั้งแพลนผ่าน `/admin/platform/set-plan`) และ 1 บัญชี admin

| ตรวจอะไร | ผลที่ควรเห็น |
|---|---|
| Home / Subjects | วิทยาศาสตร์แสดง 0% (บัญชีใหม่) ลิงก์เข้าได้; วิชาอื่นขึ้น "เร็ว ๆ นี้" ไม่มีลิงก์ |
| หน้าบทเรียน | เนื้อหาตรงไฟล์ที่นำเข้า; รูป/วิดีโอโหลดได้; มือถือ 375px อ่านสบาย |
| อ่านจบ → Quiz | ปุ่มอ่านจบเปลี่ยนสถานะและยังอยู่หลังรีโหลด; Quiz เห็นเฉลยทีละข้อหลังกดตรวจเท่านั้น (ดู Network: ตอนเริ่ม Quiz ต้องไม่มีเฉลยในโจทย์) |
| จบบท | ต้อง **อ่านจบ + Quiz ≥ 50% ในครั้งเดียว** ถึงขึ้น "เรียนแล้ว"; ผ่าน Quiz อย่างเดียวหรืออ่านอย่างเดียวไม่พอ |
| Practice | ดูเฉลยเมื่อกด; ทำถูก/ผิดแล้วนับในแท็บ ไม่ทำให้บทเสร็จ |
| Mock Exam | เวลาถอยหลังถูก; ปิดแท็บแล้วเปิดใหม่ → "ทำต่อ" คำตอบ+ธงยังอยู่ เวลาไม่ถูกรีเซ็ต; ส่งแล้วเห็นเฉลย+ดาว; ทำซ้ำได้ไม่จำกัด (FREE) |
| FREE vs PLUS | FREE ไม่เจอข้อ "ข้อพิเศษ"; PLUS/MAX เจอบางครั้งและได้ดาวมากกว่า |
| หมดเวลา | ปล่อยให้หมดเวลา → ส่งอัตโนมัติ ได้ผลตามคำตอบที่บันทึกไว้ ไม่มีโบนัสเวลา |
| Progress | "ผลการเรียนของฉัน" ขึ้น; ทำโจทย์สะสม/แม่นยำเฉลี่ยตรงกับที่ทำจริง; กดวิชาไปหน้าผลการเรียน |
| ผลการเรียนรายวิชา | จุดแข็ง/ควรทบทวนขึ้นเมื่อตอบหัวข้อเดียวกันครบ 5 ข้อ ก่อนหน้านั้นขึ้น "ข้อมูลยังไม่เพียงพอ" |
| ความเป็นส่วนตัว | บัญชี A มองไม่เห็นผล/ประวัติของบัญชี B |
| Admin | นักเรียนเรียก `/api/study/admin/*` ไม่ได้ (403) |

## 6. ถ้ามีปัญหา
- เนื้อหาผิด: แก้ไฟล์แล้วนำเข้าซ้ำ (ถ้าแถวเผยแพร่อยู่ ต้องใส่ `confirmUnpublish: true`) หรือเปลี่ยนสถานะแถวนั้นเป็น `draft` เพื่อซ่อนทันที
- ถอยหลัง Frontend: revert commit — Backend ใหม่ไม่กระทบหน้าเดิม (เส้นทางใหม่ทั้งหมดอยู่ใต้ `/api/study`)
- ตารางใหม่เป็นแบบเพิ่มอย่างเดียว ไม่มีการแก้/ลบตารางเดิม จึงไม่ต้อง rollback ฐานข้อมูลเพื่อถอยโค้ด
- Worker ทำงานได้ทั้งก่อนและหลังรัน migration 0007 (ก่อนรัน: อ่านได้เป็น "ยังไม่มีความคืบหน้า" ส่วนบันทึกตอบ 503)

## 7. สิ่งที่ผมไม่แน่ใจ / ยังตรวจไม่ได้
- **ขีดจำกัดของ D1 และ Workers บนบัญชีคุณ**: นำเข้าเขียนทีละชุด 80 คำสั่ง; `/api/study/me` ใช้ประมาณ 30 query (ฝั่งหน้าเว็บยังไม่เรียกตัวนี้); หน้ารายวิชา/บทเรียนใช้ 5–10 query ต่อครั้ง ถ้าแพลนจำกัด query ต่อคำขอต่ำกว่านี้ ต้องลองนำเข้าบน Preview ก่อน (การนำเข้ารันซ้ำได้ ไม่เสียหาย)
- พฤติกรรมจริงของ cookie ข้ามโดเมน (`.headface.app`) และ CORS บน Cloudflare — ทดสอบในเครื่องกับ Worker จริงแต่ไม่ใช่บน Cloudflare
- Google login จริง (ผมทดสอบด้วย session ที่สร้างเอง)
- ไม่มี rate limit ต่อคำขอสำหรับ "บันทึกคำตอบ" (จำกัดเฉพาะการเริ่ม Quiz 60/ชม. และ Mock 30/ชม.) ถ้าต้องการกันการยิงถี่เพิ่ม แนะนำตั้ง Rate Limiting rule ของ Cloudflare ที่ `/api/study/*`
