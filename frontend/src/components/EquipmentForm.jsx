import { STATUS_OPTIONS } from "../constants";

export default function EquipmentForm({
  showAddFormMobile,
  setShowAddFormMobile,
  form,
  setForm,
  isSaving,
  handleSubmit,
}) {
  return (
    <>
      <button
        className="mobile-form-toggle"
        onClick={() => setShowAddFormMobile((v) => !v)}
      >
        {showAddFormMobile
          ? "▲ ซ่อนฟอร์มบันทึกครุภัณฑ์ใหม่"
          : "▼ บันทึกครุภัณฑ์ใหม่"}
      </button>
      <div
        className={`card form-card ${showAddFormMobile ? "mobile-open" : ""}`}
      >
        <h3>บันทึกครุภัณฑ์ใหม่</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="เลขครุภัณฑ์ *"
            aria-label="เลขครุภัณฑ์"
            value={form.serial_number}
            onChange={(e) =>
              setForm({ ...form, serial_number: e.target.value })
            }
            required
          />
          <input
            type="text"
            placeholder="ชื่ออุปกรณ์ *"
            aria-label="ชื่ออุปกรณ์"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="date"
            aria-label="วันที่รับ"
            value={form.received_date}
            onChange={(e) =>
              setForm({ ...form, received_date: e.target.value })
            }
          />
          <div className="input-row">
            <input
              type="text"
              placeholder="ตึก"
              aria-label="ตึก"
              value={form.building}
              onChange={(e) => setForm({ ...form, building: e.target.value })}
            />
            <input
              type="text"
              placeholder="ห้อง"
              aria-label="ห้อง"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
            />
          </div>
          <input
            type="text"
            placeholder="ผู้รับผิดชอบ"
            aria-label="ผู้รับผิดชอบ"
            value={form.responsible_person}
            onChange={(e) =>
              setForm({ ...form, responsible_person: e.target.value })
            }
          />
          <input
            type="number"
            placeholder="ราคา"
            aria-label="ราคา"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <div className="form-group">
            <label htmlFor="form-status">สถานะ</label>
            <select
              id="form-status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-submit" disabled={isSaving}>
            {isSaving ? "กำลังบันทึก..." : "+ บันทึกข้อมูล"}
          </button>
        </form>
      </div>
    </>
  );
}
