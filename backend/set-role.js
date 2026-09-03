// set-role.js
// วิธีใช้: node set-role.js <username> <role>
// role ที่รองรับ: admin, super_admin, super_super_admin
// ตัวอย่าง: node set-role.js admin super_super_admin

const db = require('./database.js')

const [, , username, role] = process.argv
const VALID_ROLES = ['admin', 'super_admin', 'super_super_admin']

if (!username || !role) {
  console.log('❌ กรุณาระบุ username และ role')
  console.log('   วิธีใช้: node set-role.js <username> <role>')
  console.log('   role ที่รองรับ: admin, super_admin')
  process.exit(1)
}

if (!VALID_ROLES.includes(role)) {
  console.log(`❌ role ไม่ถูกต้อง ต้องเป็น: ${VALID_ROLES.join(' หรือ ')}`)
  process.exit(1)
}

const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
if (!user) {
  console.log(`❌ ไม่พบ username "${username}" ในระบบ`)
  process.exit(1)
}

db.prepare('UPDATE users SET role = ? WHERE username = ?').run(role, username)

console.log(`✅ เปลี่ยนสิทธิ์ของ "${username}" เป็น "${role}" สำเร็จ`)