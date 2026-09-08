export default function LogsModal({ onClose, logs, isLoadingLogs }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>ประวัติการทำรายการ (Log)</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        <div className="modal-scroll-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ผู้ใช้</th>
                <th>การทำรายการ</th>
                <th>เลขครุภัณฑ์</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>
                    ยังไม่มีประวัติการทำรายการ
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.log_id}>
                    <td>{log.created_at}</td>
                    <td>{log.username}</td>
                    <td>{log.action}</td>
                    <td>{log.target || "-"}</td>
                    <td>{log.details || "-"}</td>
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
