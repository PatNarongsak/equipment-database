# ระบบจัดการครุภัณฑ์

ภาควิชาฟิสิกส์ มหาวิทยาลัยศิลปากร

ระบบสำหรับบันทึก ค้นหา และติดตามสถานะครุภัณฑ์ (มีอยู่ / เสียหาย / สูญหาย) พร้อมนำเข้า-ส่งออกข้อมูลเป็น Excel

## โครงสร้างโปรเจกต์

```
Equipment-Database/
├── backend/       # Node.js + Express + better-sqlite3
│   ├── server.js
│   ├── database.js
│   └── package.json
└── frontend/       # React (Vite)
    ├── src/
    │   ├── App.jsx
    │   └── App.css
    └── package.json
```

## เทคโนโลยีที่ใช้

- **Backend:** Node.js, Express, better-sqlite3, JWT (jsonwebtoken), bcryptjs, Multer, ExcelJS
- **Frontend:** React, Vite, SheetJS (xlsx)

## วิธีติดตั้งและรัน

### 1. Backend

```bash
cd backend
npm install
node server.js
```

รันสำเร็จจะขึ้นข้อความ:

```
Database initialized successfully.
🚀 Backend (better-sqlite3) Running on http://localhost:3000
```

> เปิด terminal นี้ทิ้งไว้ ห้ามปิดระหว่างใช้งานระบบ

### 2. Frontend

เปิด terminal ใหม่อีกหน้าต่าง:

```bash
cd frontend
npm install
npm run dev
```

จากนั้นเปิดเบราว์เซอร์ไปที่ URL ที่ Vite แจ้ง (ปกติคือ `http://localhost:5173`)

## บัญชีผู้ใช้เริ่มต้น

ระบบจะสร้างบัญชี admin ให้อัตโนมัติในการรันครั้งแรก:

| Username | Password      |
| -------- | ------------- |
| admin    | adminpassword |

> แนะนำให้เปลี่ยนรหัสผ่านหลังใช้งานจริง

## ฟีเจอร์หลัก

- เข้าสู่ระบบเจ้าหน้าที่ / เข้าชมแบบผู้มาเยือน (อ่านอย่างเดียว)
- เพิ่ม / ลบ ครุภัณฑ์
- เปลี่ยนสถานะครุภัณฑ์ได้จากตารางโดยตรง: **มีอยู่**, **เสียหาย**, **สูญหาย**
- ค้นหาจากเลขครุภัณฑ์ ชื่ออุปกรณ์ อาคาร ห้อง หรือผู้รับผิดชอบ
- นำเข้าข้อมูลจากไฟล์ Excel (.xlsx / .xls)
- ส่งออกรายการที่กรองอยู่เป็นไฟล์ Excel

## หมายเหตุ

- ฐานข้อมูลเก็บเป็นไฟล์ SQLite (`physics_inventory.db`) อยู่ในโฟลเดอร์ `backend/` — สำรองไฟล์นี้ไว้เป็นระยะเพื่อกันข้อมูลหาย
- การนำเข้า Excel ยังไม่รองรับการอ่านคอลัมน์สถานะจากไฟล์ (รายการที่ import จะได้สถานะ "มีอยู่" เป็นค่าเริ่มต้นเสมอ)
