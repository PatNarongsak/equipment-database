import Footer from "./Footer";

export default function LoginScreen({
  loginData,
  setLoginData,
  loginError,
  isLoggingIn,
  rememberUsername,
  setRememberUsername,
  handleLogin,
  setIsGuest,
}) {
  return (
    <div className="login-container">
      <div className="login-box">
        <img
          src="/favicon.jpg"
          alt="โลโก้ระบบจัดการครุภัณฑ์"
          className="login-logo"
        />
        <h2>ระบบจัดการครุภัณฑ์</h2>
        <p className="subtitle">ภาควิชาฟิสิกส์ มหาวิทยาลัยศิลปากร</p>
        {loginError && <div className="error-banner">{loginError}</div>}
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="login-username">ชื่อผู้ใช้งาน (Username)</label>
            <input
              id="login-username"
              type="text"
              value={loginData.username}
              onChange={(e) =>
                setLoginData({ ...loginData, username: e.target.value })
              }
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="login-password">รหัสผ่าน (Password)</label>
            <input
              id="login-password"
              type="password"
              value={loginData.password}
              onChange={(e) =>
                setLoginData({ ...loginData, password: e.target.value })
              }
              required
            />
          </div>
          <div className="remember-me">
            <label htmlFor="remember-username">
              <input
                id="remember-username"
                type="checkbox"
                checked={rememberUsername}
                onChange={(e) => setRememberUsername(e.target.checked)}
              />
              จดจำชื่อผู้ใช้งาน
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={isLoggingIn}>
            {isLoggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบเจ้าหน้าที่"}
          </button>
        </form>
        <div className="guest-link">
          <button onClick={() => setIsGuest(true)} className="btn-link">
            เข้าชมในฐานะผู้มาเยือน
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
