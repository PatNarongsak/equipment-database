require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const ExcelJS = require('exceljs')
const db = require('./database.js')

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-key-for-dev'

// สถานะครุภัณฑ์ที่ระบบรองรับ
const VALID_STATUSES = ['ใช้ได้', 'ชำรุดรอซ่อม', 'สิ้นสภาพ', 'ไม่มีให้ตรวจ', 'อื่นๆ']

// ระดับสิทธิ์ผู้ใช้ที่ระบบรองรับ
const VALID_ROLES = ['admin', 'super_admin', 'super_super_admin']

// Setup Multer (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() })

// รันหลัง reverse proxy (nginx ฯลฯ) 1 ชั้น - ให้ req.ip อ่านค่าจริงจาก X-Forwarded-For
// ถ้า deploy แบบไม่มี proxy คั่น ค่านี้ไม่มีผลเสีย
app.set('trust proxy', 1)

// Middleware
app.use(cors())
app.use(express.json())

// ---------- Rate limiting หน้า login (กัน brute-force) ----------
// เก็บสถิติ login ที่ล้มเหลวแยกตาม IP ไว้ใน memory (แอปรันโปรเซสเดียว + SQLite ใช้ Map พอ ไม่ต้องพึ่ง lib)
// ผิดครบ 5 ครั้งใน 15 นาที -> บล็อค IP นั้นชั่วคราว 15 นาที, ตัวนับรีเซ็ตเมื่อ login สำเร็จ
const LOGIN_MAX_ATTEMPTS = 5
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const loginAttempts = new Map() // ip -> { count, firstAttempt, blockedUntil }

const loginRateLimiter = (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  const now = Date.now()
  const entry = loginAttempts.get(ip)

  if (entry?.blockedUntil && now < entry.blockedUntil) {
    const waitMin = Math.ceil((entry.blockedUntil - now) / 60000)
    return res.status(429).json({
      success: false,
      message: `พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอประมาณ ${waitMin} นาทีแล้วลองใหม่`,
    })
  }

  // พ้นช่วง window แล้ว - ล้างสถิติเดิมทิ้ง เริ่มนับใหม่
  if (entry && now - entry.firstAttempt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip)
  }
  req.clientIp = ip
  next()
}

const registerFailedLogin = (ip) => {
  const now = Date.now()
  const entry = loginAttempts.get(ip) || { count: 0, firstAttempt: now, blockedUntil: 0 }
  entry.count += 1
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.blockedUntil = now + LOGIN_WINDOW_MS
  }
  loginAttempts.set(ip, entry)
}

// กัน Map โตไม่จำกัด - เก็บกวาด entry ที่หมดอายุทุก 10 นาที
setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of loginAttempts) {
    const windowDone = now - entry.firstAttempt > LOGIN_WINDOW_MS
    const blockDone = !entry.blockedUntil || now > entry.blockedUntil
    if (windowDone && blockDone) loginAttempts.delete(ip)
  }
}, 10 * 60 * 1000).unref()

// Middleware: Verify JWT Token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Access token missing' })
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Forbidden: Invalid token' })
    }
    req.user = decoded
    next()
  })
}

// Middleware: อนุญาต super_admin ขึ้นไป (ใช้กับ endpoint ที่ต้องสิทธิ์สูง เช่น ลบข้อมูล, ดู log)
// super_super_admin มีสิทธิ์ทุกอย่างของ super_admin โดยอัตโนมัติ
const requireSuperAdmin = (req, res, next) => {
  if (!['super_admin', 'super_super_admin'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'เฉพาะ Super Admin ขึ้นไปเท่านั้นที่มีสิทธิ์ทำรายการนี้' })
  }
  next()
}

// Middleware: อนุญาตเฉพาะ super_super_admin (จัดการบัญชีผู้ใช้/ปรับระดับสิทธิ์)
const requireSuperSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'super_super_admin') {
    return res.status(403).json({ success: false, message: 'เฉพาะ Super Super Admin เท่านั้นที่มีสิทธิ์ทำรายการนี้' })
  }
  next()
}

// Helper: บันทึก activity log
const logActivity = (username, action, target, details) => {
  try {
    db.prepare(`
      INSERT INTO activity_logs (username, action, target, details)
      VALUES (?, ?, ?, ?)
    `).run(username, action, target || null, details || null)
  } catch (err) {
    console.error('Log Activity Error:', err.message)
  }
}

// หมายเหตุ: เดิมมีระบบล้างรายการที่ถูกลบออกจาก archive อัตโนมัติหลังเก็บไว้ 1 ปี
// ตอนนี้เอาออกแล้ว - รายการที่ถูกลบจะเก็บไว้ใน archive ตลอดไป ไม่มีการล้างอัตโนมัติอีก

// Helper: Safely Extract Cell Value from ExcelJS
const getCellValue = (cell) => {
  if (!cell || cell.value === null || cell.value === undefined) return ''
  if (typeof cell.value === 'object') {
    if (cell.value instanceof Date) return cell.value.toISOString().split('T')[0]
    if (cell.value.richText && Array.isArray(cell.value.richText)) {
      return cell.value.richText.map(rt => rt.text || '').join('').trim()
    }
    if (cell.value.result !== undefined && cell.value.result !== null) {
      if (cell.value.result instanceof Date) return cell.value.result.toISOString().split('T')[0]
      return String(cell.value.result).trim()
    }
    if (cell.value.text !== undefined) return String(cell.value.text).trim()
    return ''
  }
  return String(cell.value).trim()
}

// Helper: Parse Date Formats (Excel Serial / DD/MM/YYYY / YYYY-MM-DD)
const parseExcelDate = (val) => {
  if (!val) return null
  if (!isNaN(val) && Number(val) > 10000) {
    const jsDate = new Date((Number(val) - (25567 + 2)) * 86400 * 1000)
    if (!isNaN(jsDate.getTime())) return jsDate.toISOString().split('T')[0]
  }
  if (typeof val === 'string' && val.includes('/')) {
    const parts = val.split('/')
    if (parts.length === 3) {
      let [d, m, y] = parts
      if (parseInt(y) > 2500) y = parseInt(y) - 543
      const formatted = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
      const dt = new Date(formatted)
      if (!isNaN(dt.getTime())) return formatted
    }
  }
  const dt = new Date(val)
  return !isNaN(dt.getTime()) ? dt.toISOString().split('T')[0] : null
}

// ---------- Auth ----------
app.post('/api/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

  if (!user || !bcrypt.compareSync(password, user.password)) {
    // นับเฉพาะกรณีกรอกครบแต่รหัสผิด (การเดา credential) ไม่นับกรณีเว้นช่องว่าง
    registerFailedLogin(req.clientIp)
    return res.status(400).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' })
  }

  // login สำเร็จ - ล้างสถิติที่ล้มเหลวของ IP นี้ทิ้ง
  loginAttempts.delete(req.clientIp)

  const token = jwt.sign(
    { id: user.user_id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  )

  res.json({ success: true, token, username: user.username, role: user.role })
})

// เปลี่ยนรหัสผ่านของบัญชีตัวเอง (ต้อง login และรู้รหัสผ่านเดิม)
app.patch('/api/users/change-password', verifyToken, (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่านเดิมและรหัสผ่านใหม่' })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ควรมีอย่างน้อย 6 ตัวอักษร' })
  }

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.user.id)
  if (!user) {
    return res.status(404).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้' })
  }

  if (!bcrypt.compareSync(currentPassword, user.password)) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' })
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10)
  db.prepare('UPDATE users SET password = ? WHERE user_id = ?').run(hashedPassword, user.user_id)

  res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
})

// ---------- Equipments ----------

// GET (public - ผู้มาเยือนดูได้โดยไม่ต้อง login)
// ผู้มาเยือน (ไม่มี token / token ไม่ถูกต้อง): เห็นแค่ ชื่ออุปกรณ์ / สถานที่ (อาคาร-ห้อง) / ผู้รับผิดชอบ
// ผู้ใช้ที่ login แล้ว (แนบ token ถูกต้อง): เห็นข้อมูลครบทุกคอลัมน์ (เลขครุภัณฑ์ / ราคา / วันที่รับ / สถานะ)
app.get('/api/equipments', (req, res) => {
  try {
    let isAuthed = false
    const token = req.headers['authorization']?.split(' ')[1]
    if (token) {
      try {
        jwt.verify(token, JWT_SECRET)
        isAuthed = true
      } catch {
        isAuthed = false
      }
    }

    const rows = isAuthed
      ? db.prepare('SELECT * FROM equipments ORDER BY equipment_id DESC').all()
      : db.prepare(
          'SELECT equipment_id, name, building, room, responsible_person FROM equipments ORDER BY equipment_id DESC'
        ).all()

    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// CREATE (ต้อง login - admin ทุกระดับทำได้)
app.post('/api/equipments', verifyToken, (req, res) => {
  const { serial_number, name, received_date, building, room, responsible_person, price, category_id, status } = req.body

  if (!serial_number || !name) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกเลขครุภัณฑ์และชื่ออุปกรณ์' })
  }

  const finalStatus = VALID_STATUSES.includes(status) ? status : 'ใช้ได้'

  try {
    const stmt = db.prepare(`
      INSERT INTO equipments (serial_number, name, received_date, building, room, responsible_person, price, category_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const info = stmt.run(
      serial_number,
      name,
      received_date || null,
      building || null,
      room || null,
      responsible_person || null,
      price || null,
      category_id || null,
      finalStatus
    )

    logActivity(req.user.username, 'เพิ่มครุภัณฑ์', serial_number, `ชื่อ: ${name}`)

    res.json({ success: true, id: info.lastInsertRowid })
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ success: false, message: `เลขครุภัณฑ์ "${serial_number}" มีอยู่ในระบบแล้ว` })
    }
    res.status(500).json({ success: false, message: err.message })
  }
})

// UPDATE ทั่วไป (ต้อง login)
// Admin ทั่วไป: แก้ได้แค่ ชื่ออุปกรณ์ / สถานที่ (ตึก-ห้อง) / ผู้รับผิดชอบ / ราคา
// Super Admin ขึ้นไป: แก้ได้ทุกฟิลด์ รวมถึงเลขครุภัณฑ์และวันที่รับ
app.patch('/api/equipments/:id', verifyToken, (req, res) => {
  const BASIC_EDITABLE_FIELDS = ['name', 'building', 'room', 'responsible_person', 'price']
  const RESTRICTED_EDITABLE_FIELDS = ['serial_number', 'received_date']
  const isSuperAdminUser = ['super_admin', 'super_super_admin'].includes(req.user?.role)

  const attemptedRestricted = RESTRICTED_EDITABLE_FIELDS.filter((f) => req.body[f] !== undefined)
  if (!isSuperAdminUser && attemptedRestricted.length > 0) {
    return res.status(403).json({ success: false, message: 'เฉพาะ Super Admin ขึ้นไปเท่านั้นที่แก้ไขเลขครุภัณฑ์หรือวันที่รับได้' })
  }

  const updates = {}
  for (const field of BASIC_EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) updates[field] = req.body[field]
  }
  if (isSuperAdminUser) {
    for (const field of RESTRICTED_EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลที่จะแก้ไข' })
  }
  if (updates.name !== undefined && !updates.name.trim()) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่ออุปกรณ์' })
  }
  if (updates.serial_number !== undefined && !updates.serial_number.trim()) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกเลขครุภัณฑ์' })
  }

  try {
    const existing = db.prepare('SELECT * FROM equipments WHERE equipment_id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการที่ต้องการแก้ไข' })
    }

    const setClauses = Object.keys(updates).map((field) => `${field} = ?`).join(', ')
    const values = Object.keys(updates).map((field) =>
      field === 'price' ? (updates.price ? parseFloat(updates.price) : null) : (updates[field] || null)
    )

    db.prepare(`UPDATE equipments SET ${setClauses} WHERE equipment_id = ?`).run(...values, req.params.id)

    logActivity(
      req.user.username,
      'แก้ไขครุภัณฑ์',
      updates.serial_number || existing.serial_number,
      `แก้ไข: ${Object.keys(updates).join(', ')}`
    )

    res.json({ success: true })
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ success: false, message: `เลขครุภัณฑ์ "${updates.serial_number}" มีอยู่ในระบบแล้ว` })
    }
    res.status(500).json({ success: false, message: err.message })
  }
})

// UPDATE STATUS ONLY (ต้อง login - admin ทุกระดับทำได้)
app.patch('/api/equipments/:id/status', verifyToken, (req, res) => {
  const { status } = req.body

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' })
  }

  try {
    const existing = db.prepare('SELECT * FROM equipments WHERE equipment_id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการที่ต้องการอัปเดต' })
    }

    db.prepare('UPDATE equipments SET status = ? WHERE equipment_id = ?').run(status, req.params.id)

    logActivity(
      req.user.username,
      'เปลี่ยนสถานะ',
      existing.serial_number,
      `${existing.status} → ${status}`
    )

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// DELETE (เฉพาะ super_admin เท่านั้น) - ย้ายไปเก็บใน archive ก่อนลบจริง
app.delete('/api/equipments/:id', verifyToken, requireSuperAdmin, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM equipments WHERE equipment_id = ?').get(req.params.id)
    if (!existing) {
      return res.status(404).json({ success: false, message: 'ไม่พบรายการที่ต้องการลบ' })
    }

    // เก็บสำเนาไว้ใน archive ก่อนลบจริง (เก็บได้สูงสุด 1 ปี)
    db.prepare(`
      INSERT INTO deleted_equipments
        (equipment_id, serial_number, name, received_date, building, room, responsible_person, price, category_id, status, deleted_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      existing.equipment_id,
      existing.serial_number,
      existing.name,
      existing.received_date,
      existing.building,
      existing.room,
      existing.responsible_person,
      existing.price,
      existing.category_id,
      existing.status,
      req.user.username
    )

    db.prepare('DELETE FROM equipments WHERE equipment_id = ?').run(req.params.id)

    logActivity(req.user.username, 'ลบครุภัณฑ์', existing.serial_number, `ชื่อ: ${existing.name}`)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// IMPORT EXCEL (ต้อง login - admin ทุกระดับทำได้) - อ่านสถานะจากคอลัมน์แยกหมวด/คอลัมน์สถานะถ้ามี ไม่งั้น default เป็น 'ใช้ได้'
// ถ้าไฟล์มีคอลัมน์สถานะที่ระบบรู้จัก (เช่นไฟล์จากส่วนกลาง) จะอ่านค่ามาแปลงให้ด้วย ไม่งั้นเป็น 'available' เสมอ
// ชื่อหัวตารางที่ระบบรู้จัก (รองรับหลายชื่อเรียกสำหรับคอลัมน์เดียวกัน รวมถึงไฟล์รายงานสินทรัพย์จากส่วนกลาง)
const IMPORT_HEADER_ALIASES = {
  serial_number: ['เลขครุภัณฑ์', 'รหัสครุภัณฑ์', 'สินทรัพย์'],
  name: ['ชื่ออุปกรณ์', 'ชื่อครุภัณฑ์', 'คำอธิบาย'],
  extra_detail: ['รายละเอียดเพิ่มเติม'], // ต่อท้ายชื่ออุปกรณ์ ถ้ามีคอลัมน์นี้ในไฟล์
  received_date: ['วันที่รับ'],
  building: ['อาคาร', 'ตึก', 'ที่ตั้งสินทรัพย์ถาวร (ครุภัณฑ์)'],
  room: ['ห้อง'],
  responsible_person: ['ผู้รับผิดชอบ'],
  price: ['ราคา (บาท)', 'ราคา', 'จำนวนเงิน'],
  status: ['สถานะ', 'สถานะของสินทรัพย์'],
  // คอลัมน์แยกตามหมวดสถานะ (พบในไฟล์รายงานสินทรัพย์จากส่วนกลาง) - แต่ละคอลัมน์คือ 1 ใน 5 สถานะ
  // ถ้าคอลัมน์ไหนมีค่า (ไม่ว่างเปล่า) ในแถวนั้น แปลว่ารายการนั้นมีสถานะตามชื่อคอลัมน์นั้น
  status_usable: ['ใช้ได้'],
  status_damaged: ['ชำรุดรอซ่อม'],
  status_endoflife: ['สิ้นสภาพ'],
  status_notinspected: ['ไม่มีให้ตรวจ'],
  status_other: ['อื่นๆ'],
}

// แปลงค่าจากคอลัมน์ "สถานะ"/"สถานะของสินทรัพย์" (ข้อความอิสระ) ให้เป็นค่าสถานะที่ระบบใช้จริง
// รองรับทั้งชื่อสถานะปัจจุบันของระบบ และคำที่พบได้ในไฟล์ส่วนกลาง/ไฟล์เก่า
// ค่าที่ไม่รู้จักจะ fallback เป็น 'ใช้ได้' เสมอ
const IMPORT_STATUS_MAP = {
  'ใช้ได้': 'ใช้ได้',
  'พร้อมใช้งาน': 'ใช้ได้',
  'มีอยู่': 'ใช้ได้', // ชื่อสถานะรุ่นเก่าของระบบเอง (ก่อนขยายเป็น 5 สถานะ)
  'ชำรุดรอซ่อม': 'ชำรุดรอซ่อม',
  'ชำรุด': 'ชำรุดรอซ่อม',
  'เสียหาย': 'ชำรุดรอซ่อม', // ชื่อสถานะรุ่นเก่าของระบบเอง
  'สิ้นสภาพ': 'สิ้นสภาพ',
  'ไม่มีให้ตรวจ': 'ไม่มีให้ตรวจ',
  'สูญหาย': 'ไม่มีให้ตรวจ', // ชื่อสถานะรุ่นเก่าของระบบเอง
  'อื่นๆ': 'อื่นๆ',
}

// ลำดับความสำคัญเวลาเช็คคอลัมน์แยกตามหมวด (J-N) - เจอคอลัมน์ไหนมีค่าก่อน ใช้คอลัมน์นั้นเลย
const STATUS_FLAG_FIELDS = [
  { field: 'status_usable', status: 'ใช้ได้' },
  { field: 'status_damaged', status: 'ชำรุดรอซ่อม' },
  { field: 'status_endoflife', status: 'สิ้นสภาพ' },
  { field: 'status_notinspected', status: 'ไม่มีให้ตรวจ' },
  { field: 'status_other', status: 'อื่นๆ' },
]

// อ่านแถวหัวตาราง (แถวแรก) แล้วสร้าง map: field -> เลขคอลัมน์ ไม่ว่าจะเรียงคอลัมน์แบบไหนหรือมีคอลัมน์เกินมากี่คอลัมน์ก็ได้
// หมายเหตุ: ถ้ามีหลายคอลัมน์ชื่อซ้ำกัน (เช่นไฟล์ส่วนกลางมี "จำนวนเงิน" 3 คอลัมน์ = ราคาทุน/ค่าเสื่อม/มูลค่าสุทธิ)
// จะใช้ "คอลัมน์แรกที่เจอ" เสมอ (ซ้ายสุด) เพราะไฟล์ส่วนกลางเรียงราคาทุนไว้เป็นคอลัมน์แรกพอดี
const buildColumnMap = (headerRow) => {
  const columnMap = {}
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const headerText = getCellValue(cell).trim()
    for (const [field, aliases] of Object.entries(IMPORT_HEADER_ALIASES)) {
      if (columnMap[field] === undefined && aliases.includes(headerText)) {
        columnMap[field] = colNumber
      }
    }
  })
  return columnMap
}

app.post('/api/equipments/import', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาแนบไฟล์ Excel' })

    if (!req.file.originalname.toLowerCase().endsWith('.xlsx')) {
      return res.status(400).json({ success: false, message: 'รองรับเฉพาะไฟล์ .xlsx เท่านั้น กรุณา Save As เป็น .xlsx ก่อนอัปโหลด' })
    }

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(req.file.buffer)

    // บังคับให้ไฟล์ที่อัปโหลดมีแค่ sheet เดียวเท่านั้น (กันเผลอ import ผิด sheet โดยไม่รู้ตัว
    // เช่นไฟล์รายงานสินทรัพย์จากส่วนกลางที่มีหลาย sheet ปนกัน ต้องแยก sheet ที่ต้องการ
    // ออกมาเป็นไฟล์เดี่ยวก่อนอัปโหลด)
    if (workbook.worksheets.length > 1) {
      return res.status(400).json({
        success: false,
        message: `ไฟล์นี้มี ${workbook.worksheets.length} sheet (${workbook.worksheets.map((s) => s.name).join(', ')}) กรุณาแยก sheet ที่ต้องการนำเข้าออกมาเป็นไฟล์ .xlsx เดี่ยวก่อน แล้วค่อยอัปโหลดใหม่`
      })
    }

    // หมายเหตุ: ใช้ workbook.worksheets[0] แทน getWorksheet(1) เพราะ getWorksheet()
    // อ้างอิงจาก internal sheet ID ของไฟล์ ซึ่งบางไฟล์ (โดยเฉพาะไฟล์เก่าที่ผ่านการบันทึกซ้ำหลายรอบ)
    // ID ภายในอาจไม่เริ่มจาก 1 ทำให้หา sheet ไม่เจอทั้งที่ไฟล์มีข้อมูลอยู่จริง
    const worksheet = workbook.worksheets[0]

    if (!worksheet) return res.status(400).json({ success: false, message: 'ไม่พบ Sheet ในไฟล์ Excel' })

    const headerRow = worksheet.getRow(1)
    const columnMap = buildColumnMap(headerRow)

    // ต้องมีอย่างน้อยคอลัมน์เลขครุภัณฑ์และชื่ออุปกรณ์ ไม่งั้นไม่รู้จะ import อะไร
    if (columnMap.serial_number === undefined || columnMap.name === undefined) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบคอลัมน์ "เลขครุภัณฑ์" หรือ "ชื่ออุปกรณ์" ในแถวหัวตาราง (แถวแรก) กรุณาตรวจสอบชื่อหัวตารางในไฟล์ Excel'
      })
    }

    const rowsToInsert = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip Header

      const getField = (field) =>
        columnMap[field] !== undefined ? getCellValue(row.getCell(columnMap[field])) : ''

      const serial_number = getField('serial_number')
      const name = getField('name')
      const extra_detail = getField('extra_detail')
      const rawDate = getField('received_date')
      const building = getField('building')
      const room = getField('room')
      const responsible_person = getField('responsible_person')
      const rawPrice = getField('price')
      const rawStatus = getField('status').trim()

      // แถวสรุปยอด/หมวดหมู่บัญชี (พบในไฟล์รายงานส่วนกลาง เช่น "หมวดสินทรัพย์...", "บัญชีงบดุล...")
      // จะมีข้อความอยู่ในคอลัมน์แรกแต่ไม่มีชื่ออุปกรณ์ - ต้องมีครบทั้งคู่ถึงจะนับเป็นรายการจริง
      if (serial_number && name) {
        const cleanPrice = String(rawPrice || '0').replace(/,/g, '')
        const price = parseFloat(cleanPrice) || 0
        const fullName = extra_detail ? `${name} ${extra_detail}` : name

        // ลำดับการตัดสินสถานะ:
        // 1) เช็คคอลัมน์แยกตามหมวด (ใช้ได้/ชำรุดรอซ่อม/สิ้นสภาพ/ไม่มีให้ตรวจ/อื่นๆ) ก่อน - ถ้าคอลัมน์ไหนมีค่า ใช้คอลัมน์นั้นเลย
        // 2) ถ้าไม่มีคอลัมน์แยกเลย ลองอ่านจากคอลัมน์ "สถานะ"/"สถานะของสินทรัพย์" แทน
        // 3) ถ้าไม่มีข้อมูลอะไรเลย fallback เป็น 'ใช้ได้'
        let status = null
        for (const { field, status: mappedStatus } of STATUS_FLAG_FIELDS) {
          if (getField(field)) {
            status = mappedStatus
            break
          }
        }
        if (!status) {
          status = IMPORT_STATUS_MAP[rawStatus] || 'ใช้ได้'
        }

        rowsToInsert.push({
          serial_number,
          name: fullName,
          received_date: parseExcelDate(rawDate),
          building,
          room,
          responsible_person,
          price,
          status
        })
      }
    })

    if (rowsToInsert.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบรายการข้อมูลในไฟล์ Excel' })
    }

    const findExistingStmt = db.prepare('SELECT equipment_id, serial_number, status FROM equipments WHERE serial_number = ?')
    const updateStatusStmt = db.prepare('UPDATE equipments SET status = ? WHERE equipment_id = ?')
    const insertStmt = db.prepare(`
      INSERT INTO equipments (serial_number, name, received_date, building, room, responsible_person, price, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // ห่อทั้งก้อนใน transaction เดียว: เร็วขึ้นมาก (หลักพันแถวจาก insert ทีละครั้ง -> commit ครั้งเดียว)
    // และเป็น all-or-nothing ถ้าพังกลางคันจะ rollback ทั้งหมด ไม่ทิ้งข้อมูลค้างครึ่งเดียว
    // หมายเหตุ: error ตอน insert รายแถว (เช่นชน UNIQUE) ถูก catch ไว้ในลูป จึงไม่ทำให้ทั้ง transaction rollback
    const runImport = db.transaction((rows) => {
      let imported = 0
      let statusUpdated = 0
      let skipped = 0

      for (const item of rows) {
        const existing = findExistingStmt.get(item.serial_number)

        if (existing) {
          // เลขครุภัณฑ์ซ้ำ (มีอยู่แล้วในระบบ) - ไม่แตะข้อมูลอื่นเลย (ชื่อ/ราคา/อาคาร ฯลฯ คงเดิม)
          // เช็คแค่ "สถานะ" อย่างเดียวว่าค่าจากไฟล์ต่างจากที่มีอยู่ไหม ถ้าต่างถึงจะอัปเดต
          if (existing.status !== item.status) {
            updateStatusStmt.run(item.status, existing.equipment_id)
            statusUpdated++
          } else {
            skipped++
          }
          continue
        }

        try {
          insertStmt.run(
            item.serial_number,
            item.name,
            item.received_date,
            item.building,
            item.room,
            item.responsible_person,
            item.price,
            item.status
          )
          imported++
        } catch (err) {
          // เผื่อกรณีชนกันแบบ race condition หรือ error อื่นตอน insert - ข้ามแล้วนับไว้รายงานผล
          skipped++
        }
      }

      return { imported, statusUpdated, skipped }
    })

    const { imported: importedCount, statusUpdated: statusUpdatedCount, skipped: skippedCount } =
      runImport(rowsToInsert)

    const messageParts = []
    if (importedCount > 0) messageParts.push(`เพิ่มใหม่ ${importedCount} รายการ`)
    if (statusUpdatedCount > 0) messageParts.push(`อัปเดตสถานะ ${statusUpdatedCount} รายการ`)
    if (skippedCount > 0) messageParts.push(`ข้าม ${skippedCount} รายการ (ข้อมูลซ้ำ ไม่มีอะไรเปลี่ยน)`)
    const message = messageParts.length > 0 ? messageParts.join(', ') : 'ไม่มีการเปลี่ยนแปลง'

    logActivity(
      req.user.username,
      'นำเข้า Excel',
      null,
      `เพิ่มใหม่ ${importedCount} รายการ, อัปเดตสถานะ ${statusUpdatedCount} รายการ, ข้าม ${skippedCount} รายการ`
    )

    res.json({ success: true, message })
  } catch (err) {
    console.error('Import Error:', err)
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการนำเข้าไฟล์ Excel' })
  }
})

// ---------- Activity Logs (เฉพาะ super_admin) ----------
app.get('/api/logs', verifyToken, requireSuperAdmin, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM activity_logs ORDER BY log_id DESC LIMIT 500').all()
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ---------- Deleted Equipments Archive (เฉพาะ super_admin) ----------
app.get('/api/deleted-equipments', verifyToken, requireSuperAdmin, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM deleted_equipments ORDER BY deleted_id DESC').all()
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ---------- User Management (เฉพาะ super_super_admin) ----------

// รายชื่อผู้ใช้ทั้งหมด (ไม่ส่ง password กลับไป)
app.get('/api/users', verifyToken, requireSuperSuperAdmin, (req, res) => {
  try {
    const rows = db.prepare('SELECT user_id, username, role FROM users ORDER BY user_id ASC').all()
    res.json({ success: true, data: rows })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// เพิ่มผู้ใช้ใหม่เข้าระบบ admin
// หมายเหตุ: ตั้งค่า role เป็น super_super_admin ผ่านหน้าเว็บไม่ได้ - สงวนไว้สำหรับตั้งผ่าน server เท่านั้น (ใช้ create-admin.js)
app.post('/api/users', verifyToken, requireSuperSuperAdmin, (req, res) => {
  const { username, password, role } = req.body

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' })
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านควรมีอย่างน้อย 6 ตัวอักษร' })
  }
  if (role === 'super_super_admin') {
    return res.status(403).json({ success: false, message: 'ไม่สามารถตั้งค่าระดับ Super Super Admin ผ่านหน้าเว็บได้ ต้องตั้งผ่าน server เท่านั้น' })
  }
  const WEB_ASSIGNABLE_ROLES = ['admin', 'super_admin']
  const finalRole = WEB_ASSIGNABLE_ROLES.includes(role) ? role : 'admin'

  try {
    const hashedPassword = bcrypt.hashSync(password, 10)
    const info = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)')
      .run(username, hashedPassword, finalRole)

    logActivity(req.user.username, 'เพิ่มผู้ใช้ระบบ', username, `role: ${finalRole}`)

    res.json({ success: true, id: info.lastInsertRowid })
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ success: false, message: `มี username "${username}" อยู่ในระบบแล้ว` })
    }
    res.status(500).json({ success: false, message: err.message })
  }
})

// ปรับระดับสิทธิ์ผู้ใช้ที่มีอยู่แล้ว
// หมายเหตุ: ตั้งค่า role เป็น super_super_admin ผ่านหน้าเว็บไม่ได้ - สงวนไว้สำหรับตั้งผ่าน server เท่านั้น (ใช้ set-role.js)
app.patch('/api/users/:id/role', verifyToken, requireSuperSuperAdmin, (req, res) => {
  const { role } = req.body

  if (role === 'super_super_admin') {
    return res.status(403).json({ success: false, message: 'ไม่สามารถตั้งค่าระดับ Super Super Admin ผ่านหน้าเว็บได้ ต้องตั้งผ่าน server เท่านั้น' })
  }

  const WEB_ASSIGNABLE_ROLES = ['admin', 'super_admin']
  if (!WEB_ASSIGNABLE_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'ระดับสิทธิ์ไม่ถูกต้อง' })
  }

  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยนระดับสิทธิ์ของบัญชีตัวเองได้ กรุณาให้ Super Super Admin คนอื่นเป็นผู้เปลี่ยนแทน' })
  }

  try {
    const target = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.params.id)
    if (!target) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้ที่ต้องการแก้ไข' })
    }

    db.prepare('UPDATE users SET role = ? WHERE user_id = ?').run(role, req.params.id)

    logActivity(req.user.username, 'ปรับระดับสิทธิ์', target.username, `${target.role} → ${role}`)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ลบผู้ใช้ออกจากระบบ (เผื่อกรณีพิมพ์ username ผิด/สร้างบัญชีผิดพลาดตอนเพิ่มผู้ใช้)
// หมายเหตุ: ลบบัญชีตัวเองไม่ได้ และลบบัญชี super_super_admin ผ่านหน้าเว็บไม่ได้ (กันลบบัญชีสูงสุดผิดพลาด)
app.delete('/api/users/:id', verifyToken, requireSuperSuperAdmin, (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'ไม่สามารถลบบัญชีตัวเองได้' })
  }

  try {
    const target = db.prepare('SELECT * FROM users WHERE user_id = ?').get(req.params.id)
    if (!target) {
      return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้ที่ต้องการลบ' })
    }
    if (target.role === 'super_super_admin') {
      return res.status(403).json({ success: false, message: 'ไม่สามารถลบบัญชี Super Super Admin ผ่านหน้าเว็บได้' })
    }

    db.prepare('DELETE FROM users WHERE user_id = ?').run(req.params.id)

    logActivity(req.user.username, 'ลบผู้ใช้ระบบ', target.username, `role เดิม: ${target.role}`)

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Backend (better-sqlite3) Running on http://localhost:${PORT}`)
})