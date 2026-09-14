export default function EditEquipmentModal({
  onClose,
  editForm,
  setEditForm,
  editError,
  editingRawName,
  isSavingEdit,
  handleEditSubmit,
  isSuperAdmin,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>แก้ไขข้อมูลครุภัณฑ์</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        {editError && <div className="error-banner">{editError}</div>}
        <form onSubmit={handleEditSubmit}>
          {isSuperAdmin && (
            <div className="form-group">
              <label htmlFor="edit-serial">เลขครุภัณฑ์</label>
              <input
                id="edit-serial"
                type="text"
                value={editForm.serial_number}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    serial_number: e.target.value,
                  })
                }
                required
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="edit-name">ชื่ออุปกรณ์ (ชื่อที่โชว์บนเว็บ)</label>
            <input
              id="edit-name"
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              required
            />
            {editingRawName && editingRawName !== editForm.name && (
              <p className="field-hint">
                ชื่อจริงตามไฟล์นำเข้า (ใช้ตอนแทงจำหน่าย): {editingRawName}
              </p>
            )}
          </div>
          {isSuperAdmin && (
            <div className="form-group">
              <label htmlFor="edit-date">วันที่รับ</label>
              <input
                id="edit-date"
                type="date"
                value={editForm.received_date}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    received_date: e.target.value,
                  })
                }
              />
            </div>
          )}
          <div className="form-group">
            <label>สถานที่ (ตึก / ห้อง)</label>
            <div className="input-row">
              <input
                type="text"
                placeholder="ตึก"
                aria-label="ตึก"
                value={editForm.building}
                onChange={(e) =>
                  setEditForm({ ...editForm, building: e.target.value })
                }
              />
              <input
                type="text"
                placeholder="ห้อง"
                aria-label="ห้อง"
                value={editForm.room}
                onChange={(e) =>
                  setEditForm({ ...editForm, room: e.target.value })
                }
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="edit-responsible">ผู้รับผิดชอบ</label>
            <input
              id="edit-responsible"
              type="text"
              value={editForm.responsible_person}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  responsible_person: e.target.value,
                })
              }
            />
          </div>
          {isSuperAdmin && (
            <div className="form-group">
              <label htmlFor="edit-price">ราคา</label>
              <input
                id="edit-price"
                type="number"
                min="0"
                step="0.01"
                value={editForm.price}
                onChange={(e) =>
                  setEditForm({ ...editForm, price: e.target.value })
                }
              />
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={isSavingEdit}>
            {isSavingEdit ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
          </button>
        </form>
      </div>
    </div>
  );
}
