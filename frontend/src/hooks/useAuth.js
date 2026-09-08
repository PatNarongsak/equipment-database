import { useState } from "react";
import { API_URL } from "../constants";

// รวม: state การ login, เปลี่ยนรหัสผ่าน, และฟังก์ชัน fetch กลาง (authFetch/authFetchJson/handleAuthError)
// ที่ hook อื่นๆ (useEquipments, useAdminPanels) ต้องเรียกใช้ต่อ
export function useAuth() {
  // ---------- Auth state ----------
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("username") || ""
  );
  const [userRole, setUserRole] = useState(localStorage.getItem("role") || "");
  const [isGuest, setIsGuest] = useState(false);

  const isSuperAdmin =
    userRole === "super_admin" || userRole === "super_super_admin";
  const isSuperSuperAdmin = userRole === "super_super_admin";

  const [loginData, setLoginData] = useState(() => ({
    username: localStorage.getItem("rememberedUsername") || "",
    password: "",
  }));
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(
    () => !!localStorage.getItem("rememberedUsername")
  );

  // ---------- Change password state ----------
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setToken(data.token);
        setCurrentUser(data.username);
        setUserRole(data.role);
        localStorage.setItem("token", data.token);
        localStorage.setItem("username", data.username);
        localStorage.setItem("role", data.role);
        if (rememberUsername) {
          localStorage.setItem("rememberedUsername", data.username);
        } else {
          localStorage.removeItem("rememberedUsername");
        }
        setIsGuest(false);
      } else {
        setLoginError(data.message || "Username หรือ Password ไม่ถูกต้อง");
      }
    } catch (err) {
      setLoginError("ไม่สามารถเชื่อมต่อ Server ได้ (กรุณาแจ้งผู้ดูแลระบบ)");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken("");
    setCurrentUser("");
    setUserRole("");
    setIsGuest(false);
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
  };

  // ---------- API helpers (ให้ hook อื่นเรียกใช้ต่อ กันโค้ดซ้ำเรื่อง auth header/401/403) ----------

  // เรียก fetch พร้อมแนบ Authorization header ให้อัตโนมัติถ้ามี token
  const authFetch = (endpoint, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_URL}${endpoint}`, { ...options, headers });
  };

  // เหมือน authFetch แต่สำหรับ request ที่ส่ง JSON body (ตั้ง Content-Type + stringify ให้)
  const authFetchJson = (endpoint, method, body) =>
    authFetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // เช็คว่า response เป็น 401 (เซสชันหมดอายุ) หรือ 403 (ไม่มีสิทธิ์) หรือไม่
  // คืนค่า true = ควรหยุดทำงานต่อ (จัดการ error ให้แล้ว), false = ไม่ใช่ error สิทธิ์ ทำงานต่อได้ตามปกติ
  // onPermissionDenied: ถ้าระบุไว้ และเป็น 403 ที่มีข้อความจาก server จะเรียกใช้แทนการ logout อัตโนมัติ
  const handleAuthError = async (res, { onPermissionDenied } = {}) => {
    if (res.status !== 401 && res.status !== 403) return false;

    if (res.status === 403 && onPermissionDenied) {
      const data = await res.json().catch(() => null);
      if (data?.message) {
        onPermissionDenied(data.message);
        return true;
      }
    }

    alert("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
    handleLogout();
    return true;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("รหัสผ่านใหม่ควรมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await authFetchJson("/users/change-password", "PATCH", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      if (await handleAuthError(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        alert("เปลี่ยนรหัสผ่านสำเร็จ!");
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setShowChangePassword(false);
      } else {
        setPasswordError(data.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      }
    } catch (err) {
      setPasswordError("ไม่สามารถเชื่อมต่อ Server ได้");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const closeChangePasswordModal = () => {
    setShowChangePassword(false);
    setPasswordError("");
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  return {
    token,
    currentUser,
    userRole,
    isGuest,
    setIsGuest,
    isSuperAdmin,
    isSuperSuperAdmin,
    loginData,
    setLoginData,
    loginError,
    isLoggingIn,
    rememberUsername,
    setRememberUsername,
    handleLogin,
    handleLogout,
    showChangePassword,
    setShowChangePassword,
    passwordForm,
    setPasswordForm,
    passwordError,
    isChangingPassword,
    handleChangePassword,
    closeChangePasswordModal,
    authFetch,
    authFetchJson,
    handleAuthError,
  };
}