# Nurse Organizations System (Node + Express + Google Sheets)

## สิ่งที่ต้องเตรียม
1. Node.js (v18+ แนะนำ)
2. Google Cloud Service Account พร้อมเปิด Google Sheets API
3. Spreadsheet ID (จาก URL ของ Google Sheet)

## สร้าง Service Account & ดาวน์โหลด credentials.json
1. ไปที่ Google Cloud Console -> IAM & admin -> Service accounts
2. สร้าง service account ใหม่ แล้วสร้าง key (JSON) ดาวน์โหลดไฟล์
3. เปิด **APIs & Services** -> Library -> เปิดใช้งาน **Google Sheets API**
4. แชร์ Google Sheet ให้ service account email (ตัวอย่าง: `xxx@project.iam.gserviceaccount.com`) ด้วยสิทธิ์อ่าน (หรือแก้ไขตามต้องการ)

## วาง credentials
- วางไฟล์ JSON ที่ดาวน์โหลดไว้ที่ `config/credentials.json`
- หรือจะตั้ง path ไว้นอกโปรเจ็กต์แล้วกำหนด ENV `GOOGLE_APPLICATION_CREDENTIALS` ให้ชี้ไปยังไฟล์นั้น

## ตั้งค่า .env
คัดลอก `.env.example` เป็น `.env` และแก้ค่า:


1.แก้ไฟล์ index.html ให้สมบูรณ์พร้อม name ทุก input และ form id ให้คุณได้เลย
2.จัดระเบียนโค๊ดให้เป็นแยกสัดส่วน อ่านง่าย 
3.ใส่ comment อธิบายโค๊ดแต่ละบรรทัดสั้นๆ
4.ขอให้สรุปรายละเอียดการเปลี่ยนแปลงทุกครั้งสั้นๆ ว่ามีแก้ไขส่วนไหนบ้างจากไฟล์เดิม ลบข้อมูลส่วนไหนออกบ้าง


✔ จัดให้เป็น ESM แบบ Vanilla (แยกไฟล์เป็น module)
✔ เพิ่มคอมเมนต์สองแบบในทุกฟังก์ชัน / บรรทัดสำคัญ
    คอมเมนต์อธิบายโค้ดแต่ละบรรทัด (ทำอะไร)
    คอมเมนต์อธิบายความสัมพันธ์กับไฟล์อื่น เช่น view / HTML / API
✔ สามารถ คัดลอกไปใช้งานได้ทันที ไม่ใส่ Canvas

ESM แบบ Vanilla (แยกไฟล์เป็น module)

node server.js


✅ วิธี 1: ใช้คำสั่ง netstat + taskkill
netstat -ano | findstr :3000




TCP    0.0.0.0:3000    ...    <PID>


จากนั้นใช้ PID ที่เจอไป kill:

taskkill /PID <PID> /F




ตรวจสอบไฟล์งานของฉัน ทำให้ ข้อมูล <tbody id="nursingTableBody"></tbody> และ <input type="text" class="form-control" id="NSR" name="NSR">ทีละไฟล์  
โดยการทำงานคือ จะมีหน้าหลักคือ 
1.เริ่มต้นเปิดหน้า index.html เมื่อเลือก sider menu ก็จะนำ views มาแสดงที่ <main id="content" class="flex-grow-1"> ของ  index.html 
2.เมื่อ views : nursingRecords.html แสดงในหหน้า index.html เมื่อ เลือก <li><a class="dropdown-item open-tab" data-target-tab="online">เพิ่มใหม่</a></li> จะมี <form id="nursingForm" class="row g-3"> แสดงพร้อมกับแสดงเลขรันอัตโนมัติ  ในช่อง <input type="text" class="form-control" id="NSR" name="NSR">,<input type="text" class="form-control" id="Stamp" name="Stamp"> และ ดึงข้อมูลมาแสดง <tbody id="nursingTableBody"></tbody> นี้ 
ปัญหาคือ ไม่มีข้อมูลเลขรันอัตโนมัติ และ ตาราง
ขอคุณจะตรวจไฟล์งานที่เกี่ยวข้องจากไฟล์ของฉัน คุณจะตรวจไฟล์ไหนก่อนไหนก่อน


git add .
git commit -m "fix static paths and express static"
git push