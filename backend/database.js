const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('physics_inventory.db');

db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin'
  );

  CREATE TABLE IF NOT EXISTS categories (
    category_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS equipments (
    equipment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    received_date TEXT,
    building TEXT,
    room TEXT,
    responsible_person TEXT,
    price REAL,
    category_id INTEGER,
    status TEXT DEFAULT 'available',
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
  );

  -- เก็บประวัติการทำรายการของ admin แต่ละคน (เพิ่ม/ลบ/เปลี่ยนสถานะ/นำเข้า)
  CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- เก็บสำเนาครุภัณฑ์ที่ถูกลบไว้ (สำหรับ export และเก็บย้อนหลังได้ 1 ปี)
  CREATE TABLE IF NOT EXISTS deleted_equipments (
    deleted_id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER,
    serial_number TEXT,
    name TEXT,
    received_date TEXT,
    building TEXT,
    room TEXT,
    responsible_person TEXT,
    price REAL,
    category_id INTEGER,
    status TEXT,
    deleted_by TEXT,
    deleted_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// สร้าง Admin เริ่มต้นถ้ายังไม่มีในระบบ (Username: admin / Password: adminpassword)
// บัญชีแรกนี้ได้สิทธิ์ super_super_admin สูงสุด (ลบข้อมูลได้ + จัดการผู้ใช้ได้) เพราะเป็นบัญชีตั้งต้นของระบบ
const adminCheck = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminCheck) {
  const hashedPassword = bcrypt.hashSync('adminpassword', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'super_super_admin');
  console.log('Default Admin Account Created: admin / adminpassword (role: super_super_admin)');
}

console.log('Database initialized successfully.');

module.exports = db;