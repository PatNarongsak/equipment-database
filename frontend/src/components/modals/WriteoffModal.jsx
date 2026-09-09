import { useEffect, useState } from "react";

// modal ยืนยันการแทงจำหน่าย + บังคับแนบรูปภาพครุภัณฑ์
// (หรือติ๊ก "ไม่มีรูปภาพ" แล้วกรอกเหตุผล เช่น ครุภัณฑ์สูญหาย)
export default function WriteoffModal({
  onClose,
  item,
  photo,
  setPhoto,
  note,
  setNote,
  noPhoto,
  setNoPhoto,
  error,
  isSubmitting,
  onSubmit,
}) {
  const [previewUrl, setPreviewUrl] = useState("");

  // สร้าง/คืน object URL สำหรับ preview รูปที่เลือก
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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

        <form onSubmit={onSubmit}>
          {!noPhoto && (
            <div className="form-group">
              <label>รูปภาพครุภัณฑ์ (บังคับ)</label>
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

          <div className="form-group">
            <label>
              {noPhoto ? "เหตุผล (บังคับ)" : "หมายเหตุ (ถ้ามี)"}
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                noPhoto
                  ? "ระบุเหตุผลที่ไม่มีรูปภาพ"
                  : "รายละเอียดเพิ่มเติม (ไม่บังคับ)"
              }
            />
          </div>

          {error && <div className="error-banner">{error}</div>}

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
