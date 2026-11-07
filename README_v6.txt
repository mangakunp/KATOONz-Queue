KATOONz x TOMO Queue Manager v6.0.0
Smartphone-first + Pairing Modes

ไฟล์ในชุดนี้
- index.html  -> ใช้แทน index.html เดิม
- mobile-enhancements.css -> ไฟล์ใหม่
- mobile-enhancements.js  -> ไฟล์ใหม่
- README_v6.txt

สำคัญ:
ชุดนี้เป็น "ส่วนอัปเกรด" สำหรับ Repository KATOONz-Queue ปัจจุบัน v5.9.9.2
อย่าลบไฟล์เดิมต่อไปนี้:
- app.js
- style.css
- service-worker.js
- manifest.webmanifest
- icon-192.png
- icon-512.png

วิธีอัป:
1. แตก ZIP
2. เข้า GitHub Repository: KATOONz-Queue
3. อัป index.html + mobile-enhancements.css + mobile-enhancements.js
4. ให้ index.html ทับไฟล์เดิม
5. Commit changes
6. เปิด GitHub Pages และ Hard Refresh 1 ครั้ง

ของใหม่
1) Smartphone-first
- สนามขึ้นก่อนคิว
- ปุ่มสนามขนาดใหญ่ขึ้น
- Bottom Navigation: คิว / สนาม / สมาชิก / ค่าใช้จ่าย
- แถบสถานะ Online / จำนวนคน / คนรอ / จำนวนสนาม
- คิวล่วงหน้าบนมือถือแสดง 3 เกมแรก
- Sidebar เดิมยังเปิดจากปุ่ม ☰ เพื่อใช้ Custom Rules, Frequency, Backup

2) โหมดการจัดคู่ 5 แบบ
- สมดุล: คนต้นคิว + ลดคู่/คู่แข่งซ้ำ
- เจอคนใหม่: ลดจำนวนครั้งที่ผู้เล่น 4 คนเคยเจอกัน
- คู่ไม่ซ้ำ: ให้โทษการเป็นพาร์ตเนอร์เดิมสูงมาก
- สุ่มสนุก: รักษา 2 คนที่รอนานสุด แล้วสุ่มอีก 2 คนจากกลุ่มต้นคิว
- กำหนดเอง: เรียก 4 คนต้นคิว แล้วแตะชื่อในสนามเพื่อสลับ/จัดคู่

Custom Pairing Rules ยังเป็นกฎบังคับและมีผลเหนือ Pairing Mode

ข้อมูลเดิม
- ใช้ localStorage key เดิม katoonz_tomo_v5_offline
- รายชื่อ/ประวัติ/ค่าใช้จ่ายเดิมไม่ต้องสร้างใหม่
