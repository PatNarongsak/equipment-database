import { useState } from "react";

// รวม logic ของ 3 หน้าต่างที่ super_admin/super_super_admin ใช้: ดู Log,
// รายการแทงจำหน่าย (archive), และจัดการผู้ใช้ (เฉพาะ super_super_admin)
export function useAdminPanels({ authFetch, authFetchJson, handleAuthError }) {
  // ---------- Activity log state ----------
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

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

  const openLogs = () => {
    setShowLogs(true);
    fetchLogs();
  };

  // ดาวน์โหลด blob ที่ได้จาก endpoint ที่ต้องแนบ token (ใช้ <a download> ธรรมดาแนบ header ไม่ได้)
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ---------- รายการแทงจำหน่าย (ที่รอ export) ----------
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedItems, setDeletedItems] = useState([]);
  const [isLoadingDeleted, setIsLoadingDeleted] = useState(false);
  const [isExportingDeleted, setIsExportingDeleted] = useState(false);

  // preview รูปภาพ (lightbox ในตาราง)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

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

  const openDeleted = () => {
    setShowDeleted(true);
    fetchDeletedItems();
  };

  // Export .xlsx (สร้างฝั่ง server: sheet สรุป + 1 sheet ต่อรายการ ตามเทมเพลต)
  // หลัง export server จะย้ายรายการเข้าประวัติการ export -> โหลดตารางใหม่ (จะว่าง)
  const exportDeletedToExcel = async () => {
    setIsExportingDeleted(true);
    try {
      const res = await authFetch("/deleted-equipments/export");
      if (await handleAuthError(res)) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "สร้างไฟล์ Excel ไม่สำเร็จ");
        return;
      }

      const blob = await res.blob();
      downloadBlob(
        blob,
        `รายการครุภัณฑ์แทงจำหน่าย_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      alert("Export สำเร็จ — รายการถูกย้ายไปที่ “ประวัติการ export” แล้ว");
      fetchDeletedItems();
    } catch {
      alert("เกิดข้อผิดพลาดในการดาวน์โหลดไฟล์");
    } finally {
      setIsExportingDeleted(false);
    }
  };

  const openPhotoPreview = async (deletedId) => {
    setIsLoadingPhoto(true);
    try {
      const res = await authFetch(`/deleted-equipments/${deletedId}/photo`);
      if (await handleAuthError(res)) return;

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "ไม่พบรูปภาพ");
        return;
      }
      const blob = await res.blob();
      setPhotoPreviewUrl(URL.createObjectURL(blob));
    } catch {
      alert("เกิดข้อผิดพลาดในการโหลดรูปภาพ");
    } finally {
      setIsLoadingPhoto(false);
    }
  };

  const closePhotoPreview = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl("");
  };

  // ---------- ประวัติการ export ----------
  const [showExportHistory, setShowExportHistory] = useState(false);
  const [exportBatches, setExportBatches] = useState([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [openBatchId, setOpenBatchId] = useState(null);
  const [batchItems, setBatchItems] = useState([]);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  const fetchExportBatches = async () => {
    setIsLoadingBatches(true);
    try {
      const res = await authFetch("/export-batches");
      if (await handleAuthError(res)) return;
      const data = await res.json();
      if (data.success) setExportBatches(data.data);
    } catch (err) {
      console.error("Error fetching export batches:", err);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const openExportHistory = () => {
    setShowExportHistory(true);
    setOpenBatchId(null);
    setBatchItems([]);
    fetchExportBatches();
  };

  const viewBatchItems = async (batchId) => {
    if (openBatchId === batchId) {
      setOpenBatchId(null);
      setBatchItems([]);
      return;
    }
    try {
      const res = await authFetch(`/export-batches/${batchId}/items`);
      if (await handleAuthError(res)) return;
      const data = await res.json();
      if (data.success) {
        setBatchItems(data.data);
        setOpenBatchId(batchId);
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการโหลดรายการ");
    }
  };

  const deleteBatch = async (batchId) => {
    if (
      !window.confirm(
        "ลบประวัติการ export นี้?\nรายการครุภัณฑ์ใน batch นี้จะถูกลบออกจากระบบ (ไฟล์ Excel ที่ดาวน์โหลดไปแล้วยังอยู่)"
      )
    )
      return;

    setIsDeletingBatch(true);
    try {
      const res = await authFetch(`/export-batches/${batchId}`, {
        method: "DELETE",
      });
      if (await handleAuthError(res)) return;
      const data = await res.json();
      if (data.success) {
        setOpenBatchId(null);
        setBatchItems([]);
        fetchExportBatches();
      } else {
        alert(data.message || "ลบไม่สำเร็จ");
      }
    } catch {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Server");
    } finally {
      setIsDeletingBatch(false);
    }
  };

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
    } catch {
      setNewUserError("ไม่สามารถเชื่อมต่อ Server ได้");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const previousUsers = users;
    setUsers((prev) =>
      prev.map((u) => (u.user_id === userId ? { ...u, role: newRole } : u))
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
    } catch {
      setUsers(previousUsers);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Server");
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`ต้องการลบผู้ใช้ "${username}" ใช่หรือไม่?`)) return;

    const previousUsers = users;
    setUsers((prev) => prev.filter((u) => u.user_id !== userId));

    try {
      const res = await authFetch(`/users/${userId}`, { method: "DELETE" });

      if (
        await handleAuthError(res, {
          onPermissionDenied: (msg) => {
            setUsers(previousUsers);
            alert(msg);
          },
        })
      ) {
        return;
      }

      const data = await res.json();
      if (!data.success) {
        setUsers(previousUsers);
        alert(`${data.message || "ลบผู้ใช้ไม่สำเร็จ"}`);
      }
    } catch {
      setUsers(previousUsers);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ Server");
    }
  };

  return {
    showLogs,
    setShowLogs,
    logs,
    isLoadingLogs,
    openLogs,
    showDeleted,
    setShowDeleted,
    deletedItems,
    isLoadingDeleted,
    openDeleted,
    exportDeletedToExcel,
    isExportingDeleted,
    photoPreviewUrl,
    isLoadingPhoto,
    openPhotoPreview,
    closePhotoPreview,
    showExportHistory,
    setShowExportHistory,
    exportBatches,
    isLoadingBatches,
    openExportHistory,
    openBatchId,
    batchItems,
    viewBatchItems,
    deleteBatch,
    isDeletingBatch,
    openUserManagement,
    showUserManagement,
    setShowUserManagement,
    users,
    isLoadingUsers,
    newUserForm,
    setNewUserForm,
    newUserError,
    isCreatingUser,
    handleCreateUser,
    handleRoleChange,
    handleDeleteUser,
  };
}