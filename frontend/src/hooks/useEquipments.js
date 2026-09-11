import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { STATUS_LABELS } from "../constants";

// รวม logic ทั้งหมดที่เกี่ยวกับตารางครุภัณฑ์: โหลดรายการ, ค้นหา, เพิ่ม/แก้/ลบ,
// เปลี่ยนสถานะ, import/export Excel, และ dropdown "จัดการ" ต่อแถว
// ต้องรับ authFetch/authFetchJson/handleAuthError/isSuperAdmin มาจาก useAuth()
export function useEquipments({
  token,
  authFetch,
  authFetchJson,
  handleAuthError,
  isSuperAdmin,
}) {
  // ---------- Equipment list state ----------
  const [equipments, setEquipments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(false);

  // ---------- Form state (เพิ่มครุภัณฑ์ใหม่) ----------
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

  // ---------- Write-off (แทงจำหน่าย) modal ----------
  // หมายเหตุ: state ของฟอร์ม (12 ช่อง + รูป + note) อยู่ใน WriteoffModal เอง
  // เพื่อไม่ให้การพิมพ์แต่ละตัวอักษร re-render ทั้ง App (ตารางครุภัณฑ์ ~1500 แถว)
  const [showWriteoffModal, setShowWriteoffModal] = useState(false);
  const [writeoffItem, setWriteoffItem] = useState(null);
  const [writeoffError, setWriteoffError] = useState("");
  const [isWritingOff, setIsWritingOff] = useState(false);

  // ---------- Row action dropdown state (จัดการ: QR/แก้ไข/แทงจำหน่าย) ----------
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

  // ---------- Data fetching ----------
  const fetchEquipments = async () => {
    setIsLoadingList(true);
    try {
      // endpoint นี้เปิดสาธารณะ แต่ถ้าแนบ token ไปด้วย server จะส่งข้อมูลครบทุกคอลัมน์กลับมา
      // (ผู้มาเยือนที่ไม่มี token จะได้แค่ ชื่ออุปกรณ์/สถานที่/ผู้รับผิดชอบ)
      // authFetch จะแนบ Authorization header ให้เองเฉพาะตอนมี token เท่านั้น
      const res = await authFetch("/equipments");
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

  // โหลดครั้งแรกตอน mount และโหลดใหม่ทุกครั้งที่ token เปลี่ยน (login/logout)
  // เพื่อสลับระหว่างข้อมูลแบบเต็ม (มี token) กับแบบจำกัดคอลัมน์ (ผู้มาเยือน)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ปลอดภัย: setState เกิดหลัง await เสร็จ ไม่ใช่ synchronous
    fetchEquipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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

  const openWriteoffModal = (item) => {
    setWriteoffItem(item);
    setWriteoffError("");
    setShowWriteoffModal(true);
  };

  const closeWriteoffModal = () => {
    setShowWriteoffModal(false);
    setWriteoffItem(null);
    setWriteoffError("");
  };

  // รับ FormData ที่ WriteoffModal ประกอบ + validate มาแล้ว
  const submitWriteoff = async (formData) => {
    setWriteoffError("");
    setIsWritingOff(true);
    try {
      // ไม่ใช้ authFetchJson เพราะเป็น FormData (ต้องให้ browser ตั้ง Content-Type/boundary เอง)
      const res = await authFetch(`/equipments/${writeoffItem.equipment_id}`, {
        method: "DELETE",
        body: formData,
      });

      if (
        await handleAuthError(res, {
          onPermissionDenied: (msg) => setWriteoffError(msg),
        })
      )
        return;

      const data = await res.json();
      if (res.ok && data.success) {
        closeWriteoffModal();
        fetchEquipments();
      } else {
        setWriteoffError(data.message || "แทงจำหน่ายไม่สำเร็จ");
      }
    } catch {
      setWriteoffError("เกิดข้อผิดพลาดในการเชื่อมต่อ Server");
    } finally {
      setIsWritingOff(false);
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

    // Admin ทั่วไปแก้ได้แค่ สถานที่ / ผู้รับผิดชอบ - ชื่อ/ราคา/เลขครุภัณฑ์/วันที่รับ เฉพาะ Super Admin ขึ้นไป
    if (isSuperAdmin && !editForm.name.trim()) {
      setEditError("กรุณากรอกชื่ออุปกรณ์");
      return;
    }
    if (isSuperAdmin && !editForm.serial_number.trim()) {
      setEditError("กรุณากรอกเลขครุภัณฑ์");
      return;
    }

    setIsSavingEdit(true);
    const payload = {
      building: editForm.building || null,
      room: editForm.room || null,
      responsible_person: editForm.responsible_person || null,
    };
    if (isSuperAdmin) {
      payload.name = editForm.name;
      payload.price = editForm.price ? parseFloat(editForm.price) : null;
      payload.serial_number = editForm.serial_number;
      payload.received_date = editForm.received_date || null;
    }

    try {
      const res = await authFetchJson(
        `/equipments/${editingId}`,
        "PATCH",
        payload
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
        item.equipment_id === id ? { ...item, status: newStatus } : item
      )
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
        "รองรับเฉพาะไฟล์ .xlsx เท่านั้น กรุณาเปิดไฟล์ด้วย Excel แล้วเลือก Save As เป็นชนิด .xlsx ก่อนอัปโหลด"
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

  // ---------- Derived data ----------
  const filteredEquipments = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return equipments.filter(
      (item) =>
        item.name?.toLowerCase().includes(term) ||
        item.serial_number?.toLowerCase().includes(term) ||
        item.building?.toLowerCase().includes(term) ||
        item.room?.toLowerCase().includes(term) ||
        item.responsible_person?.toLowerCase().includes(term)
    );
  }, [equipments, searchTerm]);

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
      `รายการครุภัณฑ์_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return {
    equipments,
    searchTerm,
    setSearchTerm,
    isLoadingList,
    filteredEquipments,
    form,
    setForm,
    isSaving,
    isImporting,
    showEditModal,
    editingId,
    editForm,
    setEditForm,
    editError,
    isSavingEdit,
    actionMenuItem,
    setActionMenuItem,
    actionMenuPos,
    toggleActionMenu,
    fetchEquipments,
    handleSubmit,
    openEditModal,
    closeEditModal,
    handleEditSubmit,
    handleStatusChange,
    handleImportExcel,
    exportToExcel,
    // ---------- แทงจำหน่าย ----------
    showWriteoffModal,
    writeoffItem,
    writeoffError,
    isWritingOff,
    openWriteoffModal,
    closeWriteoffModal,
    submitWriteoff,
  };
}