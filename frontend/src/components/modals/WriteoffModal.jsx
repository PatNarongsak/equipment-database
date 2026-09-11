import { useEffect, useMemo, useState } from "react";

// modal ยืนยันการแทงจำหน่าย
// - บังคับแนบรูปภาพครุภัณฑ์ (หรือติ๊ก "ไม่มีรูปภาพ" แล้วกรอกเหตุผล)
// - บังคับกรอกฟิลด์ตามเทมเพลต "ประวัติครุภัณฑ์" ให้ครบทุกช่อง
// state ของฟอร์มทั้งหมดอยู่ในคอมโพเนนต์นี้ (ไม่ยกขึ้น App) เพื่อไม่ให้พิมพ์แต่ละตัวอักษร
// ไป re-render ตารางครุภัณฑ์ทั้งหน้า
const FIELD_LABELS = {
  report_no: "ลำดับที่",
  budget_year: "ปี (พ.ศ.)",
  quantity: "จำนวน",
  funding_source: "ประเภทเงินที่มา",
  usage_location: "ใช้งานที่",
  usage_nature: "ลักษณะการใช้งาน",
  failure_cause: "สาเหตุที่เสีย",
  damage_detail: "สภาพชำรุด",
  disposal_reason: "เหตุผลที่ขอจำหน่าย",
  org_name: "ชื่อหน่วยงาน",
  certifier_name: "ชื่อผู้รับรอง",
  certifier_title: "ตำแหน่งผู้รับรอง",
};

const FIELD_GROUPS = [
  { title: "ข้อมูลรายงาน", fields: ["report_no", "budget_year", "quantity"] },
  {
    title: "ข้อมูลครุภัณฑ์",
    fields: ["funding_source", "usage_location", "usage_nature"],
  },
  {
    title: "สภาพและเหตุผล",
    fields: ["failure_cause", "damage_detail", "disposal_reason"],
  },
  {
    title: "หน่วยงาน / ผู้รับรอง",
    fields: ["org_name", "certifier_name", "certifier_title"],
  },
];

const EMPTY_FORM = {
  report_no: "",
  budget_year: "",
  quantity: "1",
  funding_source: "",
  usage_location: "",
  usage_nature: "",
  failure_cause: "",
  damage_detail: "",
  disposal_reason: "",
  org_name: "ภาควิชาฟิสิกส์ คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร",
  certifier_name: "",
  certifier_title: "หัวหน้าภาควิชาฟิสิกส์",
};

// prefill ค่าที่เดาได้จากตัวครุภัณฑ์
function buildInitialForm(item) {
  const year = item?.received_date
    ? new Date(item.received_date).getFullYear() + 543
    : "";
  return {
    ...EMPTY_FORM,
    usage_location: [item?.building, item?.room]
      .filter(Boolean)
      .join(" ")
      .trim(),
    budget_year: year ? String(year) : "",
  };
}

export default function WriteoffModal({
  onClose,
  item,
  error, // error จาก server (ผ่าน hook)
  isSubmitting,
  onSubmit, // (formData) => void
}) {
  const initialForm = useMemo(() => buildInitialForm(item), [item]);
  const [form, setForm] = useState(initialForm);
  const [photo, setPhoto] = useState(null);
  const [note, setNote] = useState("");
  const [noPhoto, setNoPhoto] = useState(false);
  const [clientError, setClientError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!photo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  if (!item) return null;

  const setField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setClientError("");

    const noteTrim = note.trim();
    if (noPhoto) {
      if (!noteTrim) {
        setClientError("กรุณาระบุเหตุผลที่ไม่มีรูปภาพ");
        return;
      }
    } else if (!photo) {
      setClientError(
        "กรุณาแนบรูปภาพครุภัณฑ์ หรือติ๊ก “ไม่มีรูปภาพ” แล้วระบุเหตุผล"
      );
      return;
    }

    const missing = Object.keys(FIELD_LABELS).filter(
      (k) => !String(form[k] || "").trim()
    );
    if (missing.length > 0) {
      setClientError(
        `กรุณากรอกให้ครบ: ${missing.map((k) => FIELD_LABELS[k]).join(", ")}`
      );
      return;
    }

    const fd = new FormData();
    if (noPhoto) {
      fd.append("no_photo", "true");
      fd.append("writeoff_note", noteTrim);
    } else {
      fd.append("photo", photo);
      if (noteTrim) fd.append("writeoff_note", noteTrim);
    }
    for (const k of Object.keys(FIELD_LABELS)) {
      fd.append(k, String(form[k]).trim());
    }
    onSubmit(fd);
  };

  const shownError = clientError || error;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>แทงจำหน่ายครุภัณฑ์</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <p className="writeoff-target">
          <strong>{item.name}</strong>
          <br />
          <span className="serial-no">{item.serial_number}</span>
        </p>

        <form className="writeoff-form" onSubmit={handleSubmit}>
          {!noPhoto && (
            <div className="form-group">
              <label>รูปภาพครุภัณฑ์</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhoto(e.target.files[0] || null)}
              />
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="ตัวอย่างรูปภาพ"
                  className="writeoff-preview"
                />
              )}
            </div>
          )}

          <label className="writeoff-nophoto-toggle">
            <input
              type="checkbox"
              checked={noPhoto}
              onChange={(e) => {
                setNoPhoto(e.target.checked);
                if (e.target.checked) setPhoto(null);
              }}
            />
            ไม่มีรูปภาพ (เช่น ครุภัณฑ์สูญหาย)
          </label>

          {noPhoto && (
            <div className="form-group">
              <label>เหตุผลที่ไม่มีรูปภาพ (บังคับ)</label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ระบุเหตุผลที่ไม่มีรูปภาพ"
              />
            </div>
          )}

          {FIELD_GROUPS.map((group) => (
            <div key={group.title} className="writeoff-field-group">
              <h4>{group.title}</h4>
              <div className="writeoff-field-grid">
                {group.fields.map((key) => (
                  <div key={key} className="form-group">
                    <label>{FIELD_LABELS[key]}</label>
                    <input
                      type="text"
                      value={form[key] || ""}
                      onChange={(e) => setField(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!noPhoto && (
            <div className="form-group">
              <label>หมายเหตุเพิ่มเติม (ถ้ามี)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}

          {shownError && <div className="error-banner">{shownError}</div>}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={isSubmitting}
            >
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันแทงจำหน่าย"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
