KATOONz x TOMO Queue Manager v5.9.8.2 — ADD TODAY FIX OFFLINE

แก้ไข:
- ปุ่ม “เพิ่มวันนี้” กดไม่ได้ใน v5.9.8 / v5.9.8.1
- สาเหตุ: ฟังก์ชัน ensureToday() ถูกลบโดยไม่ตั้งใจตอนตัดระบบ Level ออก
- คืน ensureToday() จาก v5.9.7 กลับมา โดยไม่คืนระบบ Level

การทำงานหลังแก้:
- กด “เพิ่มวันนี้” → ผู้เล่นเข้าคิวรอทันที
- บันทึก joinedAt / waitStart / queuePos ตามระบบเดิม
- เคลียร์แผนคิวล่วงหน้าให้ระบบคำนวณใหม่
- ข้อมูล Local Storage เดิมใช้ต่อได้

ยังคงไม่มีระบบ Level
และเก็บฟังก์ชัน v5.9.7 ไว้ครบ:
Readable Rows, Font Size, Smart Rotation, Round-Robin Mixer,
Lookahead Queue, Custom Pairing Rules, Court Timer, History,
Costs, QR, Backup/Restore และ Offline PWA
