// เริ่มโหลดตัวตนบนแถบหัว (รูป + วงแหวนแพลน) ทุกหน้าที่มีปุ่มโปรไฟล์ — ตัวจริงอยู่ที่ js/study-identity.js
import { initIdentity } from './study-identity.js';

if (typeof document !== 'undefined' && document.getElementById('profileBtn')) {
    initIdentity();
}
