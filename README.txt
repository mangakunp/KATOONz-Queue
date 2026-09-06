KATOONz x TOMO Queue Manager v5.9.8.1 — ADD PLAYER HOTFIX OFFLINE

แก้ปัญหา:
- กด “เพิ่มผู้เล่น” แล้วไม่ทำงาน หลังอัปจาก v5.9.7 → v5.9.8
- สาเหตุหลัก: PWA/Service Worker อาจโหลด index.html ใหม่ แต่ app.js เก่าจาก v5.9.7
  ทำให้ JS เก่ายังหา memberLvSelect ซึ่งถูกเอาออกไปแล้ว

สิ่งที่แก้:
1. app.js / style.css ใช้ version query เพื่อ Cache Bust
2. Service Worker เปลี่ยน core files เป็น Network-first ตอนออนไลน์
3. เพิ่ม compatibility Level fields แบบซ่อน 100% เผื่อ app.js เก่าค้างอยู่
4. UI ยังคง “ไม่มี Level” เหมือน v5.9.8
5. Offline-first, Readable Rows, Font Size, Queue, Rules, Timer, History,
   Cost, QR, Backup/Restore ยังอยู่ครบ

หลังอัป GitHub:
1. Upload ไฟล์ทั้งหมดทับของเดิม
2. Commit changes
3. เปิดเว็บขณะมีอินเทอร์เน็ต
4. กด Ctrl+Shift+R หนึ่งครั้งบน PC
   หรือบน iPad/มือถือ ปิด Web App แล้วเปิด Safari เข้าเว็บใหม่ 1 ครั้ง
5. ตรวจว่าแสดง v5.9.8.1
6. ทดลอง “เพิ่มผู้เล่น”
7. หลังจากนั้นกลับไปใช้งาน Offline ได้
