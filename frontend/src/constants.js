export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// สถานะครุภัณฑ์ 5 หมวด (ชื่อเดียวกับไฟล์รายงานสินทรัพย์จากส่วนกลาง)
export const STATUS_LABELS = {
  ใช้ได้: "ใช้ได้",
  ชำรุดรอซ่อม: "ชำรุดรอซ่อม",
  สิ้นสภาพ: "สิ้นสภาพ",
  ไม่มีให้ตรวจ: "ไม่มีให้ตรวจ",
  อื่นๆ: "อื่นๆ",
};

// ใช้ชื่อ class ภาษาอังกฤษแทนค่าสถานะภาษาไทยตอนต่อ CSS class (กันปัญหา class name ที่ไม่ใช่ ASCII)
export const STATUS_CLASS_MAP = {
  ใช้ได้: "usable",
  ชำรุดรอซ่อม: "damaged",
  สิ้นสภาพ: "endoflife",
  ไม่มีให้ตรวจ: "notinspected",
  อื่นๆ: "other",
};

// รายการตัวเลือกสถานะ ใช้ซ้ำได้ทุกจุดที่มี dropdown เลือกสถานะ
export const STATUS_OPTIONS = [
  "ใช้ได้",
  "ชำรุดรอซ่อม",
  "สิ้นสภาพ",
  "ไม่มีให้ตรวจ",
  "อื่นๆ",
];

export const ROLE_LABELS = {
  admin: "ผู้ใช้ทั่วไป",
  super_admin: "Admin",
  super_super_admin: "Admin+",
};