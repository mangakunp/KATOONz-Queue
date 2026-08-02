KATOONz x TOMO Queue Manager v4.1 Firebase Fix

แก้ปัญหา:
- ดึงข้อมูลไม่สำเร็จ: รูปแบบข้อมูลไม่ถูกต้อง
- รองรับข้อมูล Firebase ที่ส่ง array กลับมาเป็น object
- รองรับ players/courts/favorites/history ที่เป็น null หรือว่าง
- รองรับข้อมูล Cloud แบบเก่าและแบบใหม่
- ปรับ slots ของคอร์ทให้ครบ 4 ตำแหน่งอัตโนมัติ

หลังอัปเดต:
1. แตก ZIP
2. ใส่ Firebase config จริงใน firebase-config.js
3. อัปโหลดไฟล์ทั้งหมดทับไฟล์เดิมบน GitHub
4. Commit changes
5. ปิด Web App ทุกเครื่องแล้วเปิดใหม่
6. ที่เครื่องซึ่งมีข้อมูลถูกต้องที่สุด กด “ส่งขึ้น Cloud” หนึ่งครั้ง
7. ที่เครื่องอื่นกด “ดึงจาก Cloud”

หมายเหตุ:
firebase-config.js ใน ZIP เป็นไฟล์ตัวอย่าง หากอัปโหลดทับไฟล์เดิม ต้องนำ config จริงของคุณใส่กลับก่อน Commit
