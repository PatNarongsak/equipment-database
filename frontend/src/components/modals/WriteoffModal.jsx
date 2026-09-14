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

// ตัวเลือกดรอปดาวน์ - เลือก "อื่นๆ" แล้วมีช่องระบุเพิ่มโผล่มา (ดูตอน render)
const FUNDING_SOURCE_OPTIONS = ["เงินรายได้", "เงินงบประมาณ", "อื่นๆ"];
const DISPOSAL_REASON_OPTIONS = ["ไม่คุ้มค่าในการซ่อมแซม", "อื่นๆ"];
const OTHER_OPTION = "อื่นๆ";

const EMPTY_FORM = {
  report_no: "",
  budget_year: "",
  quantity: "1",
  funding_source: FUNDING_SOURCE_OPTIONS[0],
  usage_location: "",
  usage_nature: "",
  failure_cause: "สิ้นสภาพการใช้งาน",
  damage_detail: "",
  disposal_reason: DISPOSAL_REASON_OPTIONS[0],
  org_name: "ภาควิชาฟิสิกส์ คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร",
  certifier_name: "",
  certifier_title: "หัวหน้าภาควิชาฟิสิกส์",
};

// prefill ค่าที่เดาได้จากตัวครุภัณฑ์ + ปี พ.ศ. ปัจจุบันเป็นค่าเริ่มต้น (แก้ไขได้)
function buildInitialForm(item) {
  const currentBuddhistYear = new Date().getFullYear() + 543;
  return {
    ...EMPTY_FORM,
    usage_location: [item?.building, item?.room]
      .filter(Boolean)
      .join(" ")
      .trim(),
    budget_year: String(currentBuddhistYear),
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
  // ช่อง "ระบุ..." เพิ่มเติมตอนเลือก "อื่นๆ" ในดรอปดาวน์ - เก็บแยกจาก form หลัก แล้วค่อยประกอบรวมตอน submit
  const [fundingSourceOther, setFundingSourceOther] = useState("");
  const [disposalReasonOther, setDisposalReasonOther] = useState("");
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
        "กรุณาแนบรูปภาพครุภัณฑ์ หรือติ๊ก “ไม่มีรูปภาพ” แล้วระบุเหตุผล",
      );
      return;
    }

    // เหตุผลที่ขอจำหน่าย = "อื่นๆ" ต้องระบุเหตุผลเพิ่ม บังคับ (ประเภทเงินที่มา "อื่นๆ" ไม่บังคับ)
    if (form.disposal_reason === OTHER_OPTION && !disposalReasonOther.trim()) {
      setClientError('กรุณาระบุเหตุผลที่ขอจำหน่าย (กรณีเลือก "อื่นๆ")');
      return;
    }

    const missing = Object.keys(FIELD_LABELS).filter(
      (k) => !String(form[k] || "").trim(),
    );
    if (missing.length > 0) {
      setClientError(
        `กรุณากรอกให้ครบ: ${missing.map((k) => FIELD_LABELS[k]).join(", ")}`,
      );
      return;
    }

    // เลือก "อื่นๆ" แล้วกรอกช่องระบุ -> ส่งแค่ข้อความที่กรอก (ไม่ติดคำว่า "อื่นๆ" นำหน้า)
    // funding_source: ไม่บังคับกรอก - ถ้าเว้นว่างไว้ค่อย fallback เป็น "อื่นๆ"
    // disposal_reason: บังคับกรอก (เช็คไปแล้วด้านบน) เลยมีข้อความเสมอ
    const finalFundingSource =
      form.funding_source === OTHER_OPTION
        ? fundingSourceOther.trim() || OTHER_OPTION
        : form.funding_source;
    const finalDisposalReason =
      form.disposal_reason === OTHER_OPTION
        ? disposalReasonOther.trim()
        : form.disposal_reason;

    const fd = new FormData();
    if (noPhoto) {
      fd.append("no_photo", "true");
      fd.append("writeoff_note", noteTrim);
    } else {
      fd.append("photo", photo);
      if (noteTrim) fd.append("writeoff_note", noteTrim);
    }
    for (const k of Object.keys(FIELD_LABELS)) {
      const value =
        k === "funding_source"
          ? finalFundingSource
          : k === "disposal_reason"
            ? finalDisposalReason
            : String(form[k]).trim();
      fd.append(k, value);
    }
    onSubmit(fd);
  };

  const shownError = clientError || error;

  // ฟิลด์ funding_source / disposal_reason เป็นดรอปดาวน์ (มีช่อง "ระบุ..." โผล่มาถ้าเลือก "อื่นๆ")
  // ฟิลด์อื่นในกลุ่มเดียวกันยังเป็น input ข้อความธรรมดาเหมือนเดิม
  const renderField = (key) => {
    if (key === "funding_source") {
      return (
        <div key={key} className="form-group">
          <label>{FIELD_LABELS[key]}</label>
          <select
            value={form.funding_source}
            onChange={(e) => setField("funding_source", e.target.value)}
          >
            {FUNDING_SOURCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {form.funding_source === OTHER_OPTION && (
            <input
              type="text"
              placeholder="ระบุที่มา (ถ้ามี)"
              value={fundingSourceOther}
              onChange={(e) => setFundingSourceOther(e.target.value)}
            />
          )}
        </div>
      );
    }
    if (key === "disposal_reason") {
      return (
        <div key={key} className="form-group">
          <label>{FIELD_LABELS[key]}</label>
          <select
            value={form.disposal_reason}
            onChange={(e) => setField("disposal_reason", e.target.value)}
          >
            {DISPOSAL_REASON_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {form.disposal_reason === OTHER_OPTION && (
            <input
              type="text"
              placeholder="ระบุเหตุผล (บังคับ)"
              value={disposalReasonOther}
              onChange={(e) => setDisposalReasonOther(e.target.value)}
            />
          )}
        </div>
      );
    }
    return (
      <div key={key} className="form-group">
        <label>{FIELD_LABELS[key]}</label>
        <input
          type="text"
          value={form[key] || ""}
          onChange={(e) => setField(key, e.target.value)}
        />
      </div>
    );
  };

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
          {item.raw_name && item.raw_name !== item.name && (
            <>
              <br />
              <span className="field-hint">
                ชื่อที่จะใช้ในรายงาน : <strong>{item.raw_name}</strong>
              </span>
            </>
          )}
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
                {group.fields.map((key) => renderField(key))}
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
