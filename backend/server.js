require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const ExcelJS = require('exceljs')
const db = require('./database.js')

const app = express()
const PORT = 3000
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-key-for-dev'

// สถานะครุภัณฑ์ที่ระบบรองรับ
const VALID_STATUSES = ['available', 'damaged', 'lost']

// ระดับสิทธิ์ผู้ใช้ที่ระบบรองรับ
const VALID_ROLES = ['admin', 'super_admin', 'super_super_admin']

// เก็บของที่ถูกลบไว้ในระบบได้นานสูงสุด (วัน) ก่อนถูกล้างอัตโนมัติ
const DELETED_RETENTION_DAYS = 365

// Setup Multer (Memory Storage)
const upload = multer({ storage: multer.memoryStorage() })

// Middleware
app.use(cors())
app.use(express.json())

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

// Helper: ล้างรายการที่ถูกลบซึ่งเก็บไว้เกิน 1 ปีออกจาก archive
const purgeOldDeletedEquipments = () => {
  try {
    const info = db.prepare(`
      DELETE FROM deleted_equipments
      WHERE deleted_at < datetime('now', ?)
    `).run(`-${DELETED_RETENTION_DAYS} days`)
    if (info.changes > 0) {
      console.log(`🗑️  ล้างรายการที่ถูกลบซึ่งเก็บไว้เกิน ${DELETED_RETENTION_DAYS} วัน จำนวน ${info.changes} รายการ`)
    }
  } catch (err) {
    console.error('Purge Error:', err.message)
  }
}

// รันตอนเริ่ม server และวนซ้ำทุก 24 ชั่วโมง
purgeOldDeletedEquipments()
setInterval(purgeOldDeletedEquipments, 24 * 60 * 60 * 1000)

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
app.post('/api/login', (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอก Username และ Password' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ success: false, message: 'Username หรือ Password ไม่ถูกต้อง' })
  }

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
app.get('/api/equipments', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM equipments ORDER BY equipment_id DESC').all()
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

  const finalStatus = VALID_STATUSES.includes(status) ? status : 'available'

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

// IMPORT EXCEL (ต้อง login - admin ทุกระดับทำได้) - รายการที่ import จะได้สถานะเริ่มต้น 'available' (มีอยู่)
// ชื่อหัวตารางที่ระบบรู้จัก (รองรับหลายชื่อเรียกสำหรับคอลัมน์เดียวกัน)
const IMPORT_HEADER_ALIASES = {
  serial_number: ['เลขครุภัณฑ์', 'รหัสครุภัณฑ์'],
  name: ['ชื่ออุปกรณ์', 'ชื่อครุภัณฑ์'],
  received_date: ['วันที่รับ'],
  building: ['อาคาร', 'ตึก'],
  room: ['ห้อง'],
  responsible_person: ['ผู้รับผิดชอบ'],
  price: ['ราคา (บาท)', 'ราคา'],
}

// อ่านแถวหัวตาราง (แถวแรก) แล้วสร้าง map: field -> เลขคอลัมน์ ไม่ว่าจะเรียงคอลัมน์แบบไหนหรือมีคอลัมน์เกินมากี่คอลัมน์ก็ได้
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

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(req.file.buffer)
    const worksheet = workbook.getWorksheet(1)

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
      const rawDate = getField('received_date')
      const building = getField('building')
      const room = getField('room')
      const responsible_person = getField('responsible_person')
      const rawPrice = getField('price')

      if (serial_number || name) {
        const cleanPrice = String(rawPrice || '0').replace(/,/g, '')
        const price = parseFloat(cleanPrice) || 0

        rowsToInsert.push({
          serial_number,
          name,
          received_date: parseExcelDate(rawDate),
          building,
          room,
          responsible_person,
          price
        })
      }
    })

    if (rowsToInsert.length === 0) {
      return res.status(400).json({ success: false, message: 'ไม่พบรายการข้อมูลในไฟล์ Excel' })
    }

    const insertStmt = db.prepare(`
      INSERT INTO equipments (serial_number, name, received_date, building, room, responsible_person, price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    let importedCount = 0
    let skippedCount = 0

    for (const item of rowsToInsert) {
      try {
        insertStmt.run(
          item.serial_number,
          item.name,
          item.received_date,
          item.building,
          item.room,
          item.responsible_person,
          item.price
        )
        importedCount++
      } catch (err) {
        // เลขครุภัณฑ์ซ้ำ (UNIQUE constraint) -> ข้ามรายการนี้ แล้วนับไว้รายงานผล
        skippedCount++
      }
    }

    const message = skippedCount > 0
      ? `นำเข้าข้อมูลสำเร็จ ${importedCount} รายการ (ข้าม ${skippedCount} รายการที่เลขครุภัณฑ์ซ้ำ)`
      : `นำเข้าข้อมูลสำเร็จ ${importedCount} รายการ`

    logActivity(req.user.username, 'นำเข้า Excel', null, `นำเข้าสำเร็จ ${importedCount} รายการ, ข้าม ${skippedCount} รายการ`)

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
    purgeOldDeletedEquipments()
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

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Backend (better-sqlite3) Running on http://localhost:${PORT}`)
})