export default function UserManagementModal({
  onClose,
  newUserForm,
  setNewUserForm,
  newUserError,
  isCreatingUser,
  handleCreateUser,
  users,
  isLoadingUsers,
  currentUser,
  handleRoleChange,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>จัดการผู้ใช้ระบบ</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>

        <div className="user-add-form">
          <h4>เพิ่มผู้ใช้ใหม่</h4>
          {newUserError && <div className="error-banner">{newUserError}</div>}
          <form onSubmit={handleCreateUser} className="user-add-form-row">
            <input
              type="text"
              placeholder="Username"
              aria-label="Username"
              value={newUserForm.username}
              onChange={(e) =>
                setNewUserForm({ ...newUserForm, username: e.target.value })
              }
              required
            />
            <input
              type="password"
              placeholder="Password"
              aria-label="Password"
              value={newUserForm.password}
              onChange={(e) =>
                setNewUserForm({ ...newUserForm, password: e.target.value })
              }
              required
              minLength={6}
            />
            <select
              aria-label="ระดับสิทธิ์"
              value={newUserForm.role}
              onChange={(e) =>
                setNewUserForm({ ...newUserForm, role: e.target.value })
              }
            >
              <option value="admin">ผู้ใช้ทั่วไป</option>
              <option value="super_admin">Admin</option>
            </select>
            <button
              type="submit"
              className="btn-submit"
              disabled={isCreatingUser}
            >
              {isCreatingUser ? "กำลังเพิ่ม..." : "+ เพิ่มผู้ใช้"}
            </button>
          </form>
        </div>

        <div className="modal-scroll-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>ระดับสิทธิ์ปัจจุบัน</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center" }}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ textAlign: "center" }}>
                    ยังไม่มีผู้ใช้ในระบบ
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id}>
                    <td>{u.username}</td>
                    <td>
                      <select
                        className="role-select"
                        value={u.role}
                        disabled={
                          u.username === currentUser ||
                          u.role === "super_super_admin"
                        }
                        onChange={(e) =>
                          handleRoleChange(u.user_id, e.target.value)
                        }
                      >
                        <option value="admin">ผู้ใช้ทั่วไป</option>
                        <option value="super_admin">Admin</option>
                        {u.role === "super_super_admin" && (
                          <option value="super_super_admin">Admin+</option>
                        )}
                      </select>
                      {u.username === currentUser && (
                        <span className="role-self-note">
                          {" "}
                          (บัญชีตัวเอง แก้ไม่ได้)
                        </span>
                      )}
                      {u.role === "super_super_admin" &&
                        u.username !== currentUser && (
                          <span className="role-self-note">
                            {" "}
                            (ตั้งค่าผ่าน server เท่านั้น)
                          </span>
                        )}
                    </td>
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
