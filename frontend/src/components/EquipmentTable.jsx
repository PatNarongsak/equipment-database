import { STATUS_CLASS_MAP, STATUS_OPTIONS } from "../constants";

export default function EquipmentTable({
  isGuest,
  isSuperAdmin,
  isLoadingList,
  filteredEquipments,
  searchTerm,
  setSearchTerm,
  isImporting,
  handleImportExcel,
  exportToExcel,
  openScanner,
  handleStatusChange,
  toggleActionMenu,
}) {
  return (
    <div className="card list-card">
      <div className="list-header">
        <h3>รายการครุภัณฑ์ทั้งหมด ({filteredEquipments.length})</h3>
        <div style={{ display: "flex", gap: "10px" }}>
          {isSuperAdmin && (
            <label className="btn-import">
              {isImporting ? "กำลังนำเข้า..." : "Import Excel"}
              <input
                type="file"
                accept=".xlsx"
                onChange={handleImportExcel}
                disabled={isImporting}
                style={{ display: "none" }}
              />
            </label>
          )}
          <button onClick={exportToExcel} className="btn-export">
            Export Excel
          </button>
          <button onClick={() => openScanner("qr")} className="btn-scan">
            สแกน QR
          </button>
          <button
            onClick={() => openScanner("barcode")}
            className="btn-barcode-scan"
          >
            สแกนบาร์โค้ด
          </button>
          <input
            type="text"
            placeholder="🔍 ค้นหาอุปกรณ์, ตึก, ห้อง..."
            aria-label="ค้นหา"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <colgroup>
            {!isGuest ? (
              <>
                <col style={{ width: "13%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "11%" }} />
              </>
            ) : (
              <>
                <col style={{ width: "35%" }} />
                <col style={{ width: "40%" }} />
                <col style={{ width: "25%" }} />
              </>
            )}
          </colgroup>
          <thead>
            {!isGuest ? (
              <tr>
                <th>เลขครุภัณฑ์</th>
                <th>ชื่ออุปกรณ์</th>
                <th>วันที่รับ</th>
                <th>สถานที่</th>
                <th>ผู้รับผิดชอบ</th>
                <th>ราคา</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            ) : (
              <tr>
                <th>ชื่ออุปกรณ์</th>
                <th>สถานที่</th>
                <th>ผู้รับผิดชอบ</th>
              </tr>
            )}
          </thead>
          <tbody>
            {isLoadingList ? (
              <tr>
                <td colSpan={isGuest ? 3 : 8} style={{ textAlign: "center" }}>
                  กำลังโหลดข้อมูล...
                </td>
              </tr>
            ) : filteredEquipments.length === 0 ? (
              <tr>
                <td colSpan={isGuest ? 3 : 8} style={{ textAlign: "center" }}>
                  ไม่พบข้อมูลครุภัณฑ์
                </td>
              </tr>
            ) : isGuest ? (
              filteredEquipments.map((item) => (
                <tr key={item.equipment_id}>
                  <td>{item.name}</td>
                  <td>
                    {item.building || item.room
                      ? `${item.building || ""} / ${item.room || ""}`
                      : "-"}
                  </td>
                  <td>{item.responsible_person || "-"}</td>
                </tr>
              ))
            ) : (
              filteredEquipments.map((item) => (
                <tr key={item.equipment_id}>
                  <td className="serial-no">{item.serial_number}</td>
                  <td>{item.name}</td>
                  <td>
                    {item.received_date
                      ? new Date(item.received_date).toLocaleDateString("th-TH")
                      : "-"}
                  </td>
                  <td>
                    {item.building || item.room
                      ? `${item.building || ""} / ${item.room || ""}`
                      : "-"}
                  </td>
                  <td>{item.responsible_person || "-"}</td>
                  <td>
                    {item.price
                      ? `${Number(item.price).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} บาท`
                      : "-"}
                  </td>
                  <td>
                    <select
                      className={`status-select status-${
                        STATUS_CLASS_MAP[item.status] || "other"
                      }`}
                      value={item.status}
                      onChange={(e) =>
                        handleStatusChange(item.equipment_id, e.target.value)
                      }
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      className="action-dropdown-trigger"
                      onClick={(e) => toggleActionMenu(item, e)}
                    >
                      จัดการ ▾
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
