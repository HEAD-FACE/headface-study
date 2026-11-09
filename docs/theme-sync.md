# ธีมสว่าง/มืด — ซิงก์ Study ↔ เว็บหลัก

## ปัญหา
เว็บหลัก (`headface.app`, ไฟล์ `js/theme-init.js`) เก็บธีมที่ผู้ใช้เลือกใน `localStorage["hf_theme"]` ซึ่ง **แยกตามโดเมน**
`study.headface.app` มองไม่เห็นค่านั้น (และกลับกัน) ทั้งที่ทั้งสองเว็บอยู่ใต้โดเมนแม่เดียวกัน `.headface.app`

## สัญญากลาง (ที่ Study ทำแล้ว — `js/theme.js`)
| รายการ | ค่า |
|---|---|
| ชื่อคุกกี้ | `hf_theme` |
| ค่า | `light` หรือ `dark` เท่านั้น (ตามเครื่อง = ไม่มีคุกกี้) |
| โดเมน / พาธ | `Domain=.headface.app; Path=/` (ไม่ใส่ Domain บน localhost) |
| อื่น ๆ | `SameSite=Lax; Secure; Max-Age=31536000` |
| ลำดับการอ่าน | คุกกี้ → `localStorage["hf_theme"]` → ตามเครื่อง |
| การเขียน | ทุกครั้งที่ผู้ใช้เลือกธีม เขียนทั้ง localStorage และคุกกี้ |

ชื่อคลาส/attribute เหมือนเว็บหลัก: `<html data-theme="light|dark" data-theme-mode="system|light|dark">`

## สิ่งที่ยังต้องทำฝั่งเว็บหลัก (ไม่ได้ทำ — อยู่นอกขอบเขตงาน Study)
จนกว่าเว็บหลักจะอ่าน/เขียนคุกกี้นี้ ธีมจะตรงกันเฉพาะกรณีที่ผู้ใช้เลือก "ตามเครื่อง" ทั้งสองฝั่ง หรือเลือกจากหน้าต่างตั้งค่าของ Study
(Study → เว็บหลักยังไม่ตามจนกว่าจะเพิ่มโค้ดด้านล่าง; เว็บหลัก → Study ไม่ตามเพราะคุกกี้เก่ายังอยู่)

แก้ `js/theme-init.js` ของเว็บหลัก 2 จุด:

```js
// 1) readMode(): อ่านคุกกี้ก่อน
function readCookie() {
  var m = /(?:^|;\s*)hf_theme=(light|dark)(?:;|$)/.exec(document.cookie || "");
  return m ? m[1] : "";
}
function readMode() {
  var c = readCookie();
  if (c) return c;
  try {
    var value = localStorage.getItem(KEY);
    return MODES.indexOf(value) > -1 ? value : "system";
  } catch (e) { return "system"; }
}

// 2) setMode(): เขียนคุกกี้ควบคู่ localStorage
function writeCookie(mode) {
  var host = location.hostname;
  var domain = /(^|\.)headface\.app$/.test(host) ? "; Domain=.headface.app" : "";
  var secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = "hf_theme=" + (mode === "system" ? "" : mode) + "; Path=/" + domain + "; SameSite=Lax" + secure +
    (mode === "system" ? "; Max-Age=0" : "; Max-Age=31536000");
}
// เรียก writeCookie(mode) ภายใน setMode() หลังจากเขียน/ลบ localStorage
```

เว็บหลักต้องรองรับ `beta.headface.app` ด้วย (คุกกี้โดเมนแม่เดียวกันจึงใช้ร่วมกันได้ทั้ง production และ beta —
ผู้ทดสอบจะเห็นธีมเดียวกันทั้งสองสภาพแวดล้อม ซึ่งเป็นสิ่งที่ต้องการ)

## ความเป็นส่วนตัว
คุกกี้มีแค่คำว่า `light`/`dark` ไม่ผูกกับบัญชีและไม่มีข้อมูลส่วนตัว
