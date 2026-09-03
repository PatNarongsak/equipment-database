// create-admin.js
// วิธีใช้: node create-admin.js <username> <password> [role]
// role ที่รองรับ:
//   admin            (ค่าเริ่มต้น - เพิ่ม/แก้สถานะได้ ลบไม่ได้)
//   super_admin       (ทำได้ทุกอย่างของ admin + ลบข้อมูลได้ + ดู log/รายการที่ถูกลบ)
//   super_super_admin (ทำได้ทุกอย่างของ super_admin + จัดการผู้ใช้/ปรับระดับสิทธิ์คนอื่นได้)
// ตัวอย่าง: node create-admin.js somchai mySecurePass123
// ตัวอย่าง: node create-admin.js wichai mySecurePass456 super_admin

const bcrypt = require('bcryptjs')
const db = require('./database.js')

const [, , username, password, roleArg] = process.argv
const VALID_ROLES = ['admin', 'super_admin', 'super_super_admin']
const role = roleArg || 'admin'

if (!username || !password) {
  console.log('❌ กรุณาระบุ username และ password')
  console.log('   วิธีใช้: node create-admin.js <username> <password> [role]')
  process.exit(1)
}

if (!VALID_ROLES.includes(role)) {
  console.log(`❌ role ไม่ถูกต้อง ต้องเป็น: ${VALID_ROLES.join(' หรือ ')}`)
  process.exit(1)
}

if (password.length < 6) {
  console.log('❌ รหัสผ่านควรมีอย่างน้อย 6 ตัวอักษร')
  process.exit(1)
}

const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
if (existing) {
  console.log(`❌ มี username "${username}" อยู่ในระบบแล้ว`)
  process.exit(1)
}

const hashedPassword = bcrypt.hashSync(password, 10)

db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
  .run(username, hashedPassword, role)

console.log(`✅ สร้างบัญชีใหม่สำเร็จ: ${username} (role: ${role})`)