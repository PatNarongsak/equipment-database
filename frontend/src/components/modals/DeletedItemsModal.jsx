import { STATUS_CLASS_MAP, STATUS_LABELS } from "../../constants";

function PhotoCell({ item, onView }) {
  if (item.has_photo) {
    return (
      <button
        type="button"
        className="btn-link"
        onClick={() => onView(item.deleted_id)}
      >
        ดูรูป
      </button>
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
  openExportHistory,
  photoPreviewUrl,
  isLoadingPhoto,
  openPhotoPreview,
  closePhotoPreview,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>รายการแทงจำหน่าย</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <div className="writeoff-toolbar">
          <button
            onClick={exportDeletedToExcel}
            className="btn-export"
            disabled={isExportingDeleted || deletedItems.length === 0}
          >
            {isExportingDeleted ? "กำลังสร้างไฟล์..." : "Export Excel"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              onClose();
              openExportHistory();
            }}
          >
            ประวัติการ export
          </button>
        </div>

        <div className="modal-scroll-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขครุภัณฑ์</th>
                <th>ชื่ออุปกรณ์</th>
                <th>ลำดับที่</th>
                <th>สถานะก่อนแทงจำหน่าย</th>
                <th>เหตุผลที่ขอจำหน่าย</th>
                <th>แทงจำหน่ายโดย</th>
                <th>วันที่</th>
                <th>รูปภาพ</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingDeleted ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : deletedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    ไม่มีรายการที่รอ Export
                  </td>
                </tr>
              ) : (
                deletedItems.map((item) => (
                  <tr key={item.deleted_id}>
                    <td className="serial-no">{item.serial_number}</td>
                    <td>{item.name}</td>
                    <td>{item.report_no || "-"}</td>
                    <td>
                      <span
                        className={`status-badge status-${
                          STATUS_CLASS_MAP[item.status] || "other"
                        }`}
                      >
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td>{item.disposal_reason || "-"}</td>
                    <td>{item.deleted_by}</td>
                    <td>{item.deleted_at}</td>
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
