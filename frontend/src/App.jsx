import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { QRCodeCanvas } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// สถานะครุภัณฑ์ 5 หมวด (ชื่อเดียวกับไฟล์รายงานสินทรัพย์จากส่วนกลาง)
const STATUS_LABELS = {
  ใช้ได้: "ใช้ได้",
  ชำรุดรอซ่อม: "ชำรุดรอซ่อม",
  สิ้นสภาพ: "สิ้นสภาพ",
  ไม่มีให้ตรวจ: "ไม่มีให้ตรวจ",
  อื่นๆ: "อื่นๆ",
};

// ใช้ชื่อ class ภาษาอังกฤษแทนค่าสถานะภาษาไทยตอนต่อ CSS class (กันปัญหา class name ที่ไม่ใช่ ASCII)
const STATUS_CLASS_MAP = {
  ใช้ได้: "usable",
  ชำรุดรอซ่อม: "damaged",
  สิ้นสภาพ: "endoflife",
  ไม่มีให้ตรวจ: "notinspected",
  อื่นๆ: "other",
};

// รายการตัวเลือกสถานะ ใช้ซ้ำได้ทุกจุดที่มี dropdown เลือกสถานะ
const STATUS_OPTIONS = [
  "ใช้ได้",
  "ชำรุดรอซ่อม",
  "สิ้นสภาพ",
  "ไม่มีให้ตรวจ",
  "อื่นๆ",
];

const ROLE_LABELS = {
  admin: "ผู้ใช้ทั่วไป",
  super_admin: "Admin",
  super_super_admin: "Admin+",
};

function App() {
  // ---------- Auth state ----------
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem("username") || "",
  );
  const [userRole, setUserRole] = useState(localStorage.getItem("role") || "");
  const [isGuest, setIsGuest] = useState(false);

  // ---------- Mobile UI state ----------
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAddFormMobile, setShowAddFormMobile] = useState(false);

  // ---------- QR code state ----------
  const [qrCodeItem, setQrCodeItem] = useState(null); // item ที่กำลังโชว์ QR อยู่
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef(null); // เก็บ instance ของ Html5Qrcode
  const scannerDivId = "qr-scanner-region";

  const isSuperAdmin =
    userRole === "super_admin" || userRole === "super_super_admin";
  const isSuperSuperAdmin = userRole === "super_super_admin";

  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberUsername, setRememberUsername] = useState(false);

  // โหลด username ที่เคยจดจำไว้ (ถ้ามี) มาใส่ในฟอร์ม login ตอนเปิดหน้าเว็บ
  useEffect(() => {
    const savedUsername = localStorage.getItem("rememberedUsername");
    if (savedUsername) {
      setLoginData((prev) => ({ ...prev, username: savedUsername }));
      setRememberUsername(true);
    }
  }, []);

  // ---------- Change password state ----------
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // ---------- Activity log state ----------
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // ---------- Deleted equipments archive state ----------
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedItems, setDeletedItems] = useState([]);
  const [isLoadingDeleted, setIsLoadingDeleted] = useState(false);

  // ---------- User management state (เฉพาะ super_super_admin) ----------
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: "",
    password: "",
    role: "admin",
  });
  const [newUserError, setNewUserError] = useState("");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // ---------- Equipment list state ----------
  const [equipments, setEquipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(false);

  // ---------- Form state ----------
  const [form, setForm] = useState({
    serial_number: "",
    name: "",
    received_date: "",
    building: "",
    room: "",
    responsible_person: "",
    price: "",
    status: "ใช้ได้",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // ---------- Edit equipment state ----------
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    serial_number: "",
    name: "",
    received_date: "",
    building: "",
    room: "",
    responsible_person: "",
    price: "",
  });
  const [editError, setEditError] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ---------- Row action dropdown state (จัดการ: แก้ไข/ลบ) ----------
  const [actionMenuItem, setActionMenuItem] = useState(null);
  const [actionMenuPos, setActionMenuPos] = useState({ top: 0, left: 0 });

  const toggleActionMenu = (item, e) => {
    if (actionMenuItem?.equipment_id === item.equipment_id) {
      setActionMenuItem(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActionMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - 150),
    });
    setActionMenuItem(item);
  };

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        !e.target.closest(".action-dropdown-trigger") &&
        !e.target.closest(".action-dropdown-menu-fixed")
      ) {
        setActionMenuItem(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ปิด dropdown เมื่อ scroll/resize (กันตำแหน่งเพี้ยน)
  useEffect(() => {
    if (!actionMenuItem) return;
    const close = () => setActionMenuItem(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [actionMenuItem]);

  // ---------- QR Scanner handlers ----------
  const openScanner = () => {
    setScannerError("");
    setShowScanner(true);
  };

  // สำคัญ: ต้องสั่งปิดกล้องให้เสร็จก่อน แล้วค่อยซ่อน modal
  // (ถ้าซ่อน modal ก่อน DOM ที่กล้องใช้งานจะถูกลบไปทันที ทำให้ library เข้าถึง element ที่หายไปแล้ว
  // เกิด error จนทำให้หน้าเว็บพัง/ค้างเป็นจอขาว)
  const closeScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        // อาจจะยังไม่ทันเริ่มสแกน หรือปิดไปแล้ว - ไม่ต้องทำอะไรต่อ
      }
    }
    setShowScanner(false);
    setScannerError("");
  };

  // เริ่มกล้องหลังจาก modal ถูก render แล้วเท่านั้น (ต้องมี div id อยู่ใน DOM ก่อน)
  useEffect(() => {
    if (!showScanner) return;

    const html5Qrcode = new Html5Qrcode(scannerDivId);
    scannerRef.current = html5Qrcode;
    let isStopped = false;

    const onScanSuccess = (decodedText) => {
      if (isStopped) return;
      isStopped = true;
      setSearchTerm(decodedText.trim());
      html5Qrcode
        .stop()
        .then(() => html5Qrcode.clear())
        .catch(() => {})
        .finally(() => {
          setShowScanner(false);
        });
    };

    html5Qrcode
      .start(
        { facingMode: "environment" }, // ใช้กล้องหลังเป็นค่าเริ่มต้น (เหมาะกับมือถือ/แท็บเล็ต)
        { fps: 10, qrbox: { width: 250, height: 250 } },
        onScanSuccess,
        () => {}, // error callback ตอนยังไม่เจอ QR ในเฟรม ไม่ต้องแสดงอะไร
      )
      .catch((err) => {
        setScannerError(
          "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ หรือเช็คว่าเครื่องมีกล้องหรือไม่",
        );
        console.error("QR Scanner start error:", err);
      });

    // safety net เผื่อ component หลุดออกจาก DOM ด้วยเหตุผลอื่น (ไม่ใช่ทางหลักที่ใช้ปิดกล้องแล้ว
    // เพราะ closeScanner/onScanSuccess จัดการ stop() เองก่อนซ่อน modal อยู่แล้ว)
    return () => {
      isStopped = true;
    };
  }, [showScanner]);

  // ---------- Data fetching ----------
  const fetchEquipments = async () => {
    setIsLoadingList(true);
    try {
      const res = await fetch(`${API_URL}/equipments`);
      const data = await res.json();
      if (data.success) {
        setEquipments(data.data);
      } else {
        console.error("Fetch equipments failed:", data.message);
      }
    } catch (err) {
      console.error("Error fetching equipments:", err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ปลอดภัย: setState เกิดหลัง await เสร็จ ไม่ใช่ synchronous
    fetchEquipments();
  }, []);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await authFetch("/logs");
      if (await handleAuthError(res)) return;
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchDeletedItems = async () => {
    setIsLoadingDeleted(true);
    try {
      const res = await authFetch("/deleted-equipments");
      if (await handleAuthError(res)) return;
      const data = await res.json();
      if (data.success) {
        setDeletedItems(data.data);
      }
    } catch (err) {
      console.error("Error fetching deleted items:", err);
    } finally {
      setIsLoadingDeleted(false);
    }
  };

  const openLogs = () => {
    setShowLogs(true);
    fetchLogs();
  };

  const openDeleted = () => {
    setShowDeleted(true);
    fetchDeletedItems();
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await authFetch("/users");
      if (await handleAuthError(res)) return;
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const openUserManagement = () => {
    setShowUserManagement(true);
    fetchUsers();
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setNewUserError("");
    setIsCreatingUser(true);
    try {
      const res = await authFetchJson("/users", "POST", newUserForm);
      if (await handleAuthError(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        setNewUserForm({ username: "", password: "", role: "admin" });
        fetchUsers();
      } else {
        setNewUserError(data.message || "เพิ่มผู้ใช้ไม่สำเร็จ");
      }
    } catch (err) {
      setNewUserError("ไม่สามารถเชื่อมต่อ Server ได้");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const previousUsers = users;
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u)),
    );

    try {
      const res = await authFetchJson(`/users/${userId}/role`, "PATCH", {
        role: newRole,
      });
      if (await handleAuthError(res)) {
        setUsers(previousUsers);
        return;
      }

      const data = await res.json();
      if (!data.success) {
        setUsers(previousUsers);
        alert(`${data.message || "ปรับระดับสิทธิ์ไม่สำเร็จ"}`);
      }
    } catch (err) {
      setUsers(previousUsers);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Server");
    }
  };

  const exportDeletedToExcel = () => {
    if (deletedItems.length === 0) {
      alert("ไม่มีข้อมูลสำหรับ Export");
      return;
    }

    const excelData = deletedItems.map((item, index) => ({
      ลำดับ: index + 1,
      เลขครุภัณฑ์: item.serial_number || "-",
      ชื่ออุปกรณ์: item.name || "-",
      อาคาร: item.building || "-",
      ห้อง: item.room || "-",
      ผู้รับผิดชอบ: item.responsible_person || "-",
      "ราคา (บาท)": item.price ? Number(item.price) : 0,
      สถานะก่อนลบ: STATUS_LABELS[item.status] || item.status || "-",
      ลบโดย: item.deleted_by || "-",
      วันที่ลบ: item.deleted_at || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "รายการที่ถูกลบ");

    XLSX.writeFile(
      workbook,
      `รายการครุภัณฑ์ที่ถูกลบ_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  // ---------- Auth handlers ----------
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

  // ---------- API helpers (รวมโค้ดที่เดิมซ้ำกันในทุกจุดที่ยิง request) ----------

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

  // ---------- Change password handler ----------
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

  // ---------- Equipment CRUD handlers ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const payload = {
      serial_number: form.serial_number,
      name: form.name,
      received_date: form.received_date || null,
      building: form.building || null,
      room: form.room || null,
      responsible_person: form.responsible_person || null,
      price: form.price ? parseFloat(form.price) : null,
      status: form.status,
    };

    try {
      const res = await authFetchJson("/equipments", "POST", payload);
      if (await handleAuthError(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        alert("บันทึกข้อมูลสำเร็จ!");
        setForm({
          serial_number: "",
          name: "",
          received_date: "",
          building: "",
          room: "",
          responsible_person: "",
          price: "",
          status: "ใช้ได้",
        });
        fetchEquipments();
      } else {
        alert(`${data.message || "บันทึกไม่สำเร็จ"}`);
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Server");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("คุณต้องการลบรายการนี้ใช่หรือไม่?")) return;

    try {
      const res = await authFetch(`/equipments/${id}`, { method: "DELETE" });

      if (
        await handleAuthError(res, {
          onPermissionDenied: (msg) => alert(`${msg}`),
        })
      )
        return;

      const data = await res.json();
      if (data.success) {
        fetchEquipments();
      } else {
        alert(`${data.message || "ลบไม่สำเร็จ"}`);
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const openEditModal = (item) => {
    setEditingId(item.equipment_id);
    setEditForm({
      serial_number: item.serial_number || "",
      name: item.name || "",
      received_date: item.received_date || "",
      building: item.building || "",
      room: item.room || "",
      responsible_person: item.responsible_person || "",
      price: item.price != null ? String(item.price) : "",
    });
    setEditError("");
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingId(null);
    setEditError("");
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError("");

    if (!editForm.name.trim()) {
      setEditError("กรุณากรอกชื่ออุปกรณ์");
      return;
    }
    if (isSuperAdmin && !editForm.serial_number.trim()) {
      setEditError("กรุณากรอกเลขครุภัณฑ์");
      return;
    }

    setIsSavingEdit(true);
    const payload = {
      name: editForm.name,
      building: editForm.building || null,
      room: editForm.room || null,
      responsible_person: editForm.responsible_person || null,
      price: editForm.price ? parseFloat(editForm.price) : null,
    };
    if (isSuperAdmin) {
      payload.serial_number = editForm.serial_number;
      payload.received_date = editForm.received_date || null;
    }

    try {
      const res = await authFetchJson(
        `/equipments/${editingId}`,
        "PATCH",
        payload,
      );

      if (
        await handleAuthError(res, {
          onPermissionDenied: (msg) => setEditError(msg),
        })
      )
        return;

      const data = await res.json();
      if (res.ok && data.success) {
        closeEditModal();
        fetchEquipments();
      } else {
        setEditError(data.message || "แก้ไขไม่สำเร็จ");
      }
    } catch (err) {
      setEditError("ไม่สามารถเชื่อมต่อ Server ได้");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    const previousEquipments = equipments;
    setEquipments((prev) =>
      prev.map((item) =>
        item.equipment_id === id ? { ...item, status: newStatus } : item,
      ),
    );

    try {
      const res = await authFetchJson(`/equipments/${id}/status`, "PATCH", {
        status: newStatus,
      });

      if (await handleAuthError(res)) {
        setEquipments(previousEquipments);
        return;
      }

      const data = await res.json();
      if (!data.success) {
        setEquipments(previousEquipments);
        alert(`${data.message || "เปลี่ยนสถานะไม่สำเร็จ"}`);
      }
    } catch (err) {
      setEquipments(previousEquipments);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Server");
    }
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      alert(
        "รองรับเฉพาะไฟล์ .xlsx เท่านั้น กรุณาเปิดไฟล์ด้วย Excel แล้วเลือก Save As เป็นชนิด .xlsx ก่อนอัปโหลด",
      );
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsImporting(true);
    try {
      // หมายเหตุ: ไม่ใช้ authFetchJson เพราะ FormData ต้องให้ browser ตั้ง Content-Type
      // (multipart boundary) ให้เอง ห้ามกำหนดเอง ไม่งั้น server จะอ่านไฟล์ไม่ได้
      const res = await authFetch("/equipments/import", {
        method: "POST",
        body: formData,
      });

      if (await handleAuthError(res)) return;

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`${data.message}`);
        fetchEquipments();
      } else {
        alert(`${data.message || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล"}`);
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Server");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const exportToExcel = () => {
    if (filteredEquipments.length === 0) {
      alert("ไม่มีข้อมูลสำหรับ Export");
      return;
    }

    const excelData = filteredEquipments.map((item, index) => ({
      ลำดับ: index + 1,
      เลขครุภัณฑ์: item.serial_number || "-",
      ชื่ออุปกรณ์: item.name || "-",
      วันที่รับ: item.received_date
        ? new Date(item.received_date).toLocaleDateString("th-TH")
        : "-",
      อาคาร: item.building || "-",
      ห้อง: item.room || "-",
      ผู้รับผิดชอบ: item.responsible_person || "-",
      "ราคา (บาท)": item.price ? Number(item.price) : 0,
      สถานะ: STATUS_LABELS[item.status] || item.status || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "รายการครุภัณฑ์");

    XLSX.writeFile(
      workbook,
      `รายการครุภัณฑ์_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  // ---------- Derived data ----------
  const filteredEquipments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return equipments.filter(
      (item) =>
        item.name?.toLowerCase().includes(term) ||
        item.serial_number?.toLowerCase().includes(term) ||
        item.building?.toLowerCase().includes(term) ||
        item.room?.toLowerCase().includes(term) ||
        item.responsible_person?.toLowerCase().includes(term),
    );
  }, [equipments, searchTerm]);

  // ---------- Login screen ----------
  if (!token && !isGuest) {
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
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบเจ้าหน้าที่"}
            </button>
          </form>
          <div className="guest-link">
            <button onClick={() => setIsGuest(true)} className="btn-link">
              เข้าชมในฐานะผู้มาเยือน
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Main screen ----------
  return (
    <div className="app-container">
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

      {showChangePassword && (
        <div className="modal-overlay" onClick={closeChangePasswordModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>เปลี่ยนรหัสผ่าน</h3>
              <button
                className="modal-close"
                onClick={closeChangePasswordModal}
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            {passwordError && (
              <div className="error-banner">{passwordError}</div>
            )}
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
      )}

      {showLogs && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div
            className="modal-box modal-box-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>ประวัติการทำรายการ (Log)</h3>
              <button
                className="modal-close"
                onClick={() => setShowLogs(false)}
                aria-label="ปิด"
              >
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
      )}

      {showDeleted && (
        <div className="modal-overlay" onClick={() => setShowDeleted(false)}>
          <div
            className="modal-box modal-box-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>รายการครุภัณฑ์ที่ถูกลบ (เก็บย้อนหลังได้ 1 ปี)</h3>
              <button
                className="modal-close"
                onClick={() => setShowDeleted(false)}
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <button onClick={exportDeletedToExcel} className="btn-export">
                Export Excel
              </button>
            </div>
            <div className="modal-scroll-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>เลขครุภัณฑ์</th>
                    <th>ชื่ออุปกรณ์</th>
                    <th>สถานะก่อนลบ</th>
                    <th>ลบโดย</th>
                    <th>วันที่ลบ</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingDeleted ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center" }}>
                        กำลังโหลด...
                      </td>
                    </tr>
                  ) : deletedItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center" }}>
                        ยังไม่มีรายการที่ถูกลบ
                      </td>
                    </tr>
                  ) : (
                    deletedItems.map((item) => (
                      <tr key={item.deleted_id}>
                        <td className="serial-no">{item.serial_number}</td>
                        <td>{item.name}</td>
                        <td>
                          <span
                            className={`status-badge status-${
                              STATUS_CLASS_MAP[item.status] || "other"
                            }`}
                          >
                            {STATUS_LABELS[item.status] || item.status}
                          </span>
                        </td>
                        <td>{item.deleted_by}</td>
                        <td>{item.deleted_at}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showUserManagement && (
        <div
          className="modal-overlay"
          onClick={() => setShowUserManagement(false)}
        >
          <div
            className="modal-box modal-box-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>จัดการผู้ใช้ระบบ</h3>
              <button
                className="modal-close"
                onClick={() => setShowUserManagement(false)}
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>

            <div className="user-add-form">
              <h4>เพิ่มผู้ใช้ใหม่</h4>
              {newUserError && (
                <div className="error-banner">{newUserError}</div>
              )}
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
      )}

      {showEditModal && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>แก้ไขข้อมูลครุภัณฑ์</h3>
              <button
                className="modal-close"
                onClick={closeEditModal}
                aria-label="ปิด"
              >
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
                <label htmlFor="edit-name">ชื่ออุปกรณ์</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                />
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
              <button
                type="submit"
                className="btn-primary"
                disabled={isSavingEdit}
              >
                {isSavingEdit ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </form>
          </div>
        </div>
      )}

      {actionMenuItem && (
        <div
          className="action-dropdown-menu-fixed"
          style={{ top: actionMenuPos.top, left: actionMenuPos.left }}
        >
          <button
            onClick={() => {
              setQrCodeItem(actionMenuItem);
              setActionMenuItem(null);
            }}
            className="action-dropdown-item action-dropdown-item-neutral qr-dropdown-item"
          >
            QR Code
          </button>
          <button
            onClick={() => {
              openEditModal(actionMenuItem);
              setActionMenuItem(null);
            }}
            className="action-dropdown-item"
          >
            แก้ไข
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => {
                handleDelete(actionMenuItem.equipment_id);
                setActionMenuItem(null);
              }}
              className="action-dropdown-item action-dropdown-item-danger"
            >
              ลบ
            </button>
          )}
        </div>
      )}

      {qrCodeItem && (
        <div className="modal-overlay" onClick={() => setQrCodeItem(null)}>
          <div
            className="modal-box qr-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>QR Code ครุภัณฑ์</h3>
              <button
                className="modal-close"
                onClick={() => setQrCodeItem(null)}
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            <div className="qr-modal-content">
              <QRCodeCanvas
                id="qr-canvas-download"
                value={qrCodeItem.serial_number}
                size={220}
                level="M"
                includeMargin
              />
              <p className="qr-serial-text">{qrCodeItem.serial_number}</p>
              <p className="qr-name-text">{qrCodeItem.name}</p>
              <div className="qr-modal-actions">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    const canvas =
                      document.getElementById("qr-canvas-download");
                    const url = canvas.toDataURL("image/png");
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `QR-${qrCodeItem.serial_number}.png`;
                    link.click();
                  }}
                >
                  ดาวน์โหลด
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const canvas =
                      document.getElementById("qr-canvas-download");
                    const dataUrl = canvas.toDataURL("image/png");
                    const printWindow = window.open("", "_blank");
                    printWindow.document.write(`
                      <html>
                        <head><title>${qrCodeItem.serial_number}</title></head>
                        <body style="text-align:center; font-family: sans-serif; padding-top: 40px;">
                          <img src="${dataUrl}" style="width:220px;height:220px;" />
                          <p style="font-size:16px; font-weight:bold;">${qrCodeItem.serial_number}</p>
                          <p style="font-size:14px;">${qrCodeItem.name}</p>
                          <script>window.onload = () => window.print();</script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                >
                  พิมพ์
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <div className="modal-overlay" onClick={closeScanner}>
          <div
            className="modal-box scanner-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>สแกน QR Code</h3>
              <button
                className="modal-close"
                onClick={closeScanner}
                aria-label="ปิด"
              >
                ✕
              </button>
            </div>
            {scannerError ? (
              <div className="error-banner">{scannerError}</div>
            ) : (
              <p className="scanner-hint">
                เล็งกล้องไปที่ QR Code บนตัวครุภัณฑ์
              </p>
            )}
            <div id={scannerDivId} className="scanner-region"></div>
          </div>
        </div>
      )}

      <main className={isGuest ? "main-content guest-mode" : "main-content"}>
        {!isGuest && (
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
              className={`card form-card ${
                showAddFormMobile ? "mobile-open" : ""
              }`}
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
                    onChange={(e) =>
                      setForm({ ...form, building: e.target.value })
                    }
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
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={isSaving}
                >
                  {isSaving ? "กำลังบันทึก..." : "+ บันทึกข้อมูล"}
                </button>
              </form>
            </div>
          </>
        )}

        <div className="card list-card">
          <div className="list-header">
            <h3>รายการครุภัณฑ์ทั้งหมด ({filteredEquipments.length})</h3>
            <div style={{ display: "flex", gap: "10px" }}>
              {!isGuest && (
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
              <button onClick={openScanner} className="btn-scan">
                สแกน QR
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
                    <td
                      colSpan={isGuest ? 3 : 8}
                      style={{ textAlign: "center" }}
                    >
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : filteredEquipments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isGuest ? 3 : 8}
                      style={{ textAlign: "center" }}
                    >
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
                          ? new Date(item.received_date).toLocaleDateString(
                              "th-TH",
                            )
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
                            handleStatusChange(
                              item.equipment_id,
                              e.target.value,
                            )
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
      </main>
    </div>
  );
}

export default App;
