export default function ChangePasswordModal({
  onClose,
  passwordForm,
  setPasswordForm,
  passwordError,
  isChangingPassword,
  handleChangePassword,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>เปลี่ยนรหัสผ่าน</h3>
          <button className="modal-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        {passwordError && <div className="error-banner">{passwordError}</div>}
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label htmlFor="current-password">รหัสผ่านเดิม</label>
            <input
              id="current-password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  currentPassword: e.target.value,
                })
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">รหัสผ่านใหม่</label>
            <input
              id="new-password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  newPassword: e.target.value,
                })
              }
              required
              minLength={6}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label>
            <input
              id="confirm-password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({
                  ...passwordForm,
                  confirmPassword: e.target.value,
                })
              }
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={isChangingPassword}
          >
            {isChangingPassword ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
          </button>
        </form>
      </div>
    </div>
  );
}
