const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// ปกติใช้ physics_inventory.db - ตั้ง DB_PATH ใน env เพื่อชี้ไปไฟล์อื่น (เช่นสำเนาไว้ทดสอบ)
const db = new Database(process.env.DB_PATH || 'physics_inventory.db');

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
    status TEXT DEFAULT 'ใช้ได้',
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

  -- เก็บสำเนาครุภัณฑ์ที่ถูกแทงจำหน่าย (record ตัวอักษร - เก็บถาวร ไม่มีการล้าง)
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

  -- เก็บรูปภาพครุภัณฑ์ตอนแทงจำหน่าย (BLOB ที่บีบอัดแล้ว) แยกจาก record ตัวอักษร
  -- image = NULL หมายถึงรูปถูกล้างทิ้งไปแล้ว (หลัง export รูปจะถูกฝังในไฟล์ Excel แล้ว blob จะถูกล้าง)
  CREATE TABLE IF NOT EXISTS writeoff_photos (
    photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
    deleted_id INTEGER NOT NULL REFERENCES deleted_equipments(deleted_id) ON DELETE CASCADE,
    image BLOB,
    bytes INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    exported_at TEXT,
    purged_at TEXT
  );

  -- ประวัติการ export: แต่ละครั้งที่กด Export ในรายการแทงจำหน่าย = 1 batch
  -- รายการใน deleted_equipments ที่ export_batch_id = ค่านี้ ถือว่า "export แล้ว" (ออกจากรายการที่รอ)
  CREATE TABLE IF NOT EXISTS export_batches (
    batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
    exported_at TEXT DEFAULT CURRENT_TIMESTAMP,
    exported_by TEXT,
    item_count INTEGER,
    filename TEXT
  );
`);

// migration: เพิ่มคอลัมน์ที่ deleted_equipments รุ่นเก่ายังไม่มี (เพิ่มเฉพาะที่ขาด)
// - writeoff_note: เหตุผลกรณีแทงจำหน่ายโดยไม่มีรูป
// - ฟิลด์ตามเทมเพลต "ประวัติครุภัณฑ์" ที่ต้องกรอกตอนแทงจำหน่าย
// - export_batch_id: NULL = ยังอยู่ในรายการที่รอ export, มีค่า = อยู่ในประวัติการ export แล้ว
const WRITEOFF_EXTRA_COLUMNS = [
  ['writeoff_note', 'TEXT'],
  ['report_no', 'TEXT'],       // ลำดับที่ เช่น 355/1
  ['budget_year', 'TEXT'],     // ปี (พ.ศ.)
  ['quantity', 'TEXT'],        // จำนวน
  ['funding_source', 'TEXT'],  // ประเภทเงินที่มา
  ['usage_location', 'TEXT'],  // ใช้งานที่
  ['usage_nature', 'TEXT'],    // ลักษณะการใช้งาน
  ['failure_cause', 'TEXT'],   // สาเหตุที่เสีย
  ['damage_detail', 'TEXT'],   // สภาพชำรุด
  ['disposal_reason', 'TEXT'], // เหตุผลที่ขอจำหน่าย
  ['org_name', 'TEXT'],        // ชื่อหน่วยงาน
  ['certifier_name', 'TEXT'],  // ชื่อผู้รับรอง
  ['certifier_title', 'TEXT'], // ตำแหน่งผู้รับรอง
  ['export_batch_id', 'INTEGER'],
];
const deletedCols = db.prepare('PRAGMA table_info(deleted_equipments)').all();
for (const [name, type] of WRITEOFF_EXTRA_COLUMNS) {
  if (!deletedCols.some((c) => c.name === name)) {
    db.exec(`ALTER TABLE deleted_equipments ADD COLUMN ${name} ${type}`);
  }
}

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