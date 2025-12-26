SmartNurseHub2026/
├─ index.html              ← หน้าเว็บหลัก (root)
├─ server.js               ← เซิร์ฟเวอร์ Node.js / Express
├─ package.json
├─ package-lock.json
├─ .env
├─ README.md
├─ config/
│   └─ credentials.json    ← Google API / Sheet credential
├─ public/                 ← static assets
│   ├─ js/
│   │   └─ nursingRecords.js
│   ├─ views/
│   │   ├─ appointments.html
│   │   ├─ nursingRecords.html
│   │   ├─ patients.html
│   │   └─ sticker.html
│   ├─ image/
│   │   └─ LOGO.png
│   └─ style.css
├─ routes/
│   └─ sheets.js           ← API routes สำหรับ Google Sheets
└─ uploads/                ← สำหรับไฟล์ upload ชั่วคราว
