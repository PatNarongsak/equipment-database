import { useState } from "react";
import * as XLSX from "xlsx";
import { STATUS_LABELS } from "../constants";

// รวม logic ของ 3 หน้าต่างที่ super_admin/super_super_admin ใช้: ดู Log,
// รายการที่ถูกลบ (archive), และจัดการผู้ใช้ (เฉพาะ super_super_admin)
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

  // ---------- Deleted equipments archive state ----------
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedItems, setDeletedItems] = useState([]);
  const [isLoadingDeleted, setIsLoadingDeleted] = useState(false);

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
      `รายการครุภัณฑ์ที่ถูกลบ_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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