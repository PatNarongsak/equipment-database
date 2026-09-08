import { ROLE_LABELS } from "../constants";

export default function Header({
  showMobileMenu,
  setShowMobileMenu,
  isGuest,
  setIsGuest,
  currentUser,
  userRole,
  isSuperAdmin,
  isSuperSuperAdmin,
  openLogs,
  openDeleted,
  openUserManagement,
  setShowChangePassword,
  handleLogout,
}) {
  return (
    <header className="header">
      <div className="header-title">
        <h1>ระบบจัดการครุภัณฑ์</h1>
        <p>ภาควิชาฟิสิกส์ มหาวิทยาลัยศิลปากร</p>
      </div>
      <button
        className="hamburger-btn"
        onClick={() => setShowMobileMenu((v) => !v)}
        aria-label="เมนู"
      >
        {showMobileMenu ? "✕" : "☰"}
      </button>
      <div className="header-user">
        {isGuest ? (
          <div className={`header-actions ${showMobileMenu ? "open" : ""}`}>
            <span className="header-status">สถานะ: ผู้มาเยือน</span>
            <button
              onClick={() => {
                setIsGuest(false);
                setShowMobileMenu(false);
              }}
              className="btn-logout"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        ) : (
          <div className={`header-actions ${showMobileMenu ? "open" : ""}`}>
            <span className="header-status">
              👤 {currentUser}
              {userRole !== "admin" && ` (${ROLE_LABELS[userRole] || ""})`}
            </span>
            {isSuperAdmin && (
              <>
                <button
                  onClick={() => {
                    openLogs();
                    setShowMobileMenu(false);
                  }}
                  className="btn-secondary"
                >
                  ดู Log
                </button>
                <button
                  onClick={() => {
                    openDeleted();
                    setShowMobileMenu(false);
                  }}
                  className="btn-secondary"
                >
                  รายการที่ถูกลบ
                </button>
              </>
            )}
            {isSuperSuperAdmin && (
              <button
                onClick={() => {
                  openUserManagement();
                  setShowMobileMenu(false);
                }}
                className="btn-secondary"
              >
                จัดการผู้ใช้
              </button>
            )}
            <button
              onClick={() => {
                setShowChangePassword(true);
                setShowMobileMenu(false);
              }}
              className="btn-secondary"
            >
              เปลี่ยนรหัสผ่าน
            </button>
            <button
              onClick={() => {
                handleLogout();
                setShowMobileMenu(false);
              }}
              className="btn-logout"
            >
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
