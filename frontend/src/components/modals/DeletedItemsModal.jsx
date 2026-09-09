import { STATUS_CLASS_MAP, STATUS_LABELS } from "../../constants";

function PhotoCell({ item, onView }) {
  if (item.has_photo) {
    return (
      <div className="writeoff-photo-cell">
        <button
          type="button"
          className="btn-link"
          onClick={() => onView(item.deleted_id)}
        >
          ดูรูป
        </button>
        <span
          className={
            item.photo_exported_at ? "photo-tag photo-tag-ok" : "photo-tag"
          }
        >
          {item.photo_exported_at ? "export แล้ว" : "ยังไม่ export"}
        </span>
      </div>
    );
  }
  if (item.photo_purged_at) {
    return (
      <span className="photo-tag photo-tag-muted">
        รูปถูกล้าง {String(item.photo_purged_at).slice(0, 10)}
      </span>
    );
  }
  if (item.writeoff_note) {
    return <span className="photo-tag photo-tag-muted">ไม่มีรูป</span>;
  }
  return <span>-</span>;
}

export default function DeletedItemsModal({
  onClose,
  deletedItems,
  isLoadingDeleted,
  exportDeletedToExcel,
  isExportingDeleted,
  photoPreviewUrl,
  isLoadingPhoto,
  openPhotoPreview,
  closePhotoPreview,
  purgeMonths,
  setPurgeMonths,
  purgePreview,
  previewPurgePhotos,
  runPurgePhotos,
  isPurging,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>รายการครุภัณฑ์แทงจำหน่าย</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <div className="writeoff-toolbar">
          <button
            onClick={exportDeletedToExcel}
            className="btn-export"
            disabled={isExportingDeleted}
          >
            {isExportingDeleted ? "กำลังสร้างไฟล์..." : "Export Excel (พร้อมรูป)"}
          </button>

          <div className="purge-panel">
            <span>ล้างรูปภาพที่เก่ากว่า</span>
            <input
              type="number"
              min={1}
              value={purgeMonths}
              onChange={(e) => setPurgeMonths(e.target.value)}
              className="purge-months-input"
            />
            <span>เดือน</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={previewPurgePhotos}
            >
              ตรวจสอบ
            </button>
            {purgePreview && (
              <>
                <span className="purge-preview-text">
                  จะล้าง {purgePreview.eligibleCount} รูป (~
                  {(purgePreview.eligibleBytes / 1024 / 1024).toFixed(1)} MB)
                  {purgePreview.skippedNotExportedCount > 0 &&
                    ` · ข้าม ${purgePreview.skippedNotExportedCount} รูปที่ยังไม่ export`}
                </span>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={runPurgePhotos}
                  disabled={isPurging || purgePreview.eligibleCount === 0}
                >
                  {isPurging ? "กำลังล้าง..." : "ยืนยันล้าง"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="modal-scroll-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขครุภัณฑ์</th>
                <th>ชื่ออุปกรณ์</th>
                <th>สถานะก่อนแทงจำหน่าย</th>
                <th>แทงจำหน่ายโดย</th>
                <th>วันที่แทงจำหน่าย</th>
                <th>หมายเหตุ</th>
                <th>รูปภาพ</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingDeleted ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : deletedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    ยังไม่มีรายการแทงจำหน่าย
                  </td>
                </tr>
              ) : (
                deletedItems.map((item) => (
                  <tr key={item.deleted_id}>
                    <td className="serial-no">{item.serial_number}</td>
                    <td>{item.name}</td>
                    <td>
                      <span
                        className={`status-badge status-${
                          STATUS_CLASS_MAP[item.status] || "other"
                        }`}
                      >
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td>{item.deleted_by}</td>
                    <td>{item.deleted_at}</td>
                    <td>{item.writeoff_note || "-"}</td>
                    <td>
                      <PhotoCell item={item} onView={openPhotoPreview} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(photoPreviewUrl || isLoadingPhoto) && (
        <div
          className="modal-overlay photo-lightbox"
          onClick={(e) => {
            e.stopPropagation();
            closePhotoPreview();
          }}
        >
          {isLoadingPhoto ? (
            <p style={{ color: "#fff" }}>กำลังโหลดรูปภาพ...</p>
          ) : (
            <img src={photoPreviewUrl} alt="รูปครุภัณฑ์แทงจำหน่าย" />
          )}
        </div>
      )}
    </div>
  );
}
