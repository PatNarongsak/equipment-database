// รูปภาพอ้างอิงของครุภัณฑ์ - ไว้ดูหน้าตาเฉยๆ ใส่หรือไม่ใส่ก็ได้ ใส่ได้ทุกเมื่อ
// แยกขาดจากรูปตอนแทงจำหน่ายโดยสิ้นเชิง (คนละตาราง คนละ endpoint ไม่ถูกใช้ที่อื่นเลย)
export default function EquipmentPhotoModal({
  onClose,
  item,
  photoPreviewUrl,
  isLoadingPhoto,
  isUploadingPhoto,
  photoError,
  onUpload,
  onDelete,
  canManage, // true = super_admin ขึ้นไป (อัปโหลด/ลบได้) — false = ดูได้อย่างเดียว (admin ทั่วไป/ผู้มาเยือน)
}) {
  if (!item) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>รูปภาพครุภัณฑ์</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <p className="writeoff-target">
          <strong>{item.name}</strong>
          <br />
          <span className="serial-no">{item.serial_number}</span>
        </p>

        {isLoadingPhoto ? (
          <p>กำลังโหลดรูปภาพ...</p>
        ) : photoPreviewUrl ? (
          <img
            src={photoPreviewUrl}
            alt="รูปภาพครุภัณฑ์"
            className="writeoff-preview"
          />
        ) : (
          <p className="field-hint">ยังไม่มีรูปภาพ</p>
        )}

        {canManage && (
          <div className="form-group" style={{ marginTop: 14 }}>
            <label>{photoPreviewUrl ? "เปลี่ยนรูปภาพ" : "เพิ่มรูปภาพ"}</label>
            <input
              type="file"
              accept="image/*"
              disabled={isUploadingPhoto}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) onUpload(file);
                e.target.value = "";
              }}
            />
            {isUploadingPhoto && <p className="field-hint">กำลังอัปโหลด...</p>}
          </div>
        )}

        {photoError && <div className="error-banner">{photoError}</div>}

        <div className="modal-actions">
          {canManage && photoPreviewUrl && (
            <button
              type="button"
              className="btn-danger"
              onClick={onDelete}
              disabled={isUploadingPhoto}
            >
              ลบรูปภาพ
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
