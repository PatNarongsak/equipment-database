import { Fragment } from "react";
import { STATUS_LABELS } from "../../constants";

// ประวัติการ export ของรายการแทงจำหน่าย
// แต่ละ batch = 1 ครั้งที่กด Export; กด "ดูรายการ" เพื่อดูครุภัณฑ์ใน batch, "ลบประวัติ" เพื่อลบทั้ง batch
export default function ExportHistoryModal({
  onClose,
  batches,
  isLoadingBatches,
  batchItems,
  openBatchId,
  viewBatchItems,
  deleteBatch,
  isDeletingBatch,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>ประวัติการ Export</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <div className="modal-scroll-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>ครั้งที่</th>
                <th>วันที่ Export</th>
                <th>โดย</th>
                <th>จำนวนรายการ</th>
                <th>ชื่อไฟล์</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingBatches ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center" }}>
                    ยังไม่มีประวัติการ export
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <Fragment key={b.batch_id}>
                    <tr>
                      <td>#{b.batch_id}</td>
                      <td>{b.exported_at}</td>
                      <td>{b.exported_by || "-"}</td>
                      <td>{b.actual_count ?? b.item_count}</td>
                      <td style={{ wordBreak: "break-all" }}>
                        {b.filename || "-"}
                      </td>
                      <td>
                        <div className="writeoff-photo-cell">
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => viewBatchItems(b.batch_id)}
                          >
                            {openBatchId === b.batch_id ? "ซ่อน" : "ดูรายการ"}
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => deleteBatch(b.batch_id)}
                            disabled={isDeletingBatch}
                          >
                            ลบประวัติ
                          </button>
                        </div>
                      </td>
                    </tr>
                    {openBatchId === b.batch_id && (
                      <tr>
                        <td colSpan={6}>
                          <table className="data-table nested-table">
                            <thead>
                              <tr>
                                <th>เลขครุภัณฑ์</th>
                                <th>ชื่ออุปกรณ์</th>
                                <th>ลำดับที่</th>
                                <th>สถานะก่อนแทงจำหน่าย</th>
                                <th>เหตุผลที่ขอจำหน่าย</th>
                                <th>แทงจำหน่ายโดย</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchItems.length === 0 ? (
                                <tr>
                                  <td colSpan={6} style={{ textAlign: "center" }}>
                                    ไม่มีรายการ
                                  </td>
                                </tr>
                              ) : (
                                batchItems.map((it) => (
                                  <tr key={it.deleted_id}>
                                    <td className="serial-no">
                                      {it.serial_number}
                                    </td>
                                    <td>{it.name}</td>
                                    <td>{it.report_no || "-"}</td>
                                    <td>
                                      {STATUS_LABELS[it.status] || it.status}
                                    </td>
                                    <td>{it.disposal_reason || "-"}</td>
                                    <td>{it.deleted_by}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
