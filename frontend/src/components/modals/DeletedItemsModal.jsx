import { STATUS_CLASS_MAP, STATUS_LABELS } from "../../constants";

export default function DeletedItemsModal({
  onClose,
  deletedItems,
  isLoadingDeleted,
  exportDeletedToExcel,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>รายการครุภัณฑ์ที่ถูกลบ</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <button onClick={exportDeletedToExcel} className="btn-export">
            Export Excel
          </button>
        </div>
        <div className="modal-scroll-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>เลขครุภัณฑ์</th>
                <th>ชื่ออุปกรณ์</th>
                <th>สถานะก่อนลบ</th>
                <th>ลบโดย</th>
                <th>วันที่ลบ</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingDeleted ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : deletedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    ยังไม่มีรายการที่ถูกลบ
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
