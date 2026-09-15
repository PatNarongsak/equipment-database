import { useState } from "react";
import "./App.css";

import { useAuth } from "./hooks/useAuth";
import { useEquipments } from "./hooks/useEquipments";
import { useAdminPanels } from "./hooks/useAdminPanels";
import { useQRCode } from "./hooks/useQRCode";

import Header from "./components/Header";
import Footer from "./components/Footer";
import LoginScreen from "./components/LoginScreen";
import EquipmentForm from "./components/EquipmentForm";
import EquipmentTable from "./components/EquipmentTable";
import ActionMenu from "./components/ActionMenu";
import QRCodeModal from "./components/QRCodeModal";
import QRScannerModal from "./components/QRScannerModal";
import ChangePasswordModal from "./components/modals/ChangePasswordModal";
import LogsModal from "./components/modals/LogsModal";
import DeletedItemsModal from "./components/modals/DeletedItemsModal";
import ExportHistoryModal from "./components/modals/ExportHistoryModal";
import UserManagementModal from "./components/modals/UserManagementModal";
import EditEquipmentModal from "./components/modals/EditEquipmentModal";
import WriteoffModal from "./components/modals/WriteoffModal";
import EquipmentPhotoModal from "./components/modals/EquipmentPhotoModal";

function App() {
  // ---------- Mobile UI state (เล็กพอที่จะเก็บไว้ตรงนี้ ไม่แยก hook) ----------
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showAddFormMobile, setShowAddFormMobile] = useState(false);

  // ---------- Auth (login/logout/เปลี่ยนรหัสผ่าน + fetch helpers ให้ hook อื่นใช้ต่อ) ----------
  const auth = useAuth();

  // ---------- รายการครุภัณฑ์: โหลด/ค้นหา/เพิ่ม/แก้/ลบ/สถานะ/import-export ----------
  const equip = useEquipments({
    token: auth.token,
    authFetch: auth.authFetch,
    authFetchJson: auth.authFetchJson,
    handleAuthError: auth.handleAuthError,
    isSuperAdmin: auth.isSuperAdmin,
  });

  // ---------- Log / รายการแทงจำหน่าย / จัดการผู้ใช้ (เฉพาะ super_admin ขึ้นไป) ----------
  const admin = useAdminPanels({
    authFetch: auth.authFetch,
    authFetchJson: auth.authFetchJson,
    handleAuthError: auth.handleAuthError,
  });

  // ---------- QR Code: แสดง/ดาวน์โหลด/พิมพ์ + สแกนกล้อง ----------
  const qr = useQRCode({ setSearchTerm: equip.setSearchTerm });

  // ---------- Login screen ----------
  if (!auth.token && !auth.isGuest) {
    return (
      <LoginScreen
        loginData={auth.loginData}
        setLoginData={auth.setLoginData}
        loginError={auth.loginError}
        isLoggingIn={auth.isLoggingIn}
        rememberUsername={auth.rememberUsername}
        setRememberUsername={auth.setRememberUsername}
        handleLogin={auth.handleLogin}
        setIsGuest={auth.setIsGuest}
      />
    );
  }

  // ---------- Main screen ----------
  return (
    <div className="app-container">
      <Header
        showMobileMenu={showMobileMenu}
        setShowMobileMenu={setShowMobileMenu}
        isGuest={auth.isGuest}
        setIsGuest={auth.setIsGuest}
        currentUser={auth.currentUser}
        userRole={auth.userRole}
        isSuperAdmin={auth.isSuperAdmin}
        isSuperSuperAdmin={auth.isSuperSuperAdmin}
        openLogs={admin.openLogs}
        openDeleted={admin.openDeleted}
        openUserManagement={admin.openUserManagement}
        setShowChangePassword={auth.setShowChangePassword}
        handleLogout={auth.handleLogout}
      />

      {auth.showChangePassword && (
        <ChangePasswordModal
          onClose={auth.closeChangePasswordModal}
          passwordForm={auth.passwordForm}
          setPasswordForm={auth.setPasswordForm}
          passwordError={auth.passwordError}
          isChangingPassword={auth.isChangingPassword}
          handleChangePassword={auth.handleChangePassword}
        />
      )}

      {admin.showLogs && (
        <LogsModal
          onClose={() => admin.setShowLogs(false)}
          logs={admin.logs}
          isLoadingLogs={admin.isLoadingLogs}
        />
      )}

      {admin.showDeleted && (
        <DeletedItemsModal
          onClose={() => admin.setShowDeleted(false)}
          deletedItems={admin.deletedItems}
          isLoadingDeleted={admin.isLoadingDeleted}
          exportDeletedToExcel={admin.exportDeletedToExcel}
          isExportingDeleted={admin.isExportingDeleted}
          openExportHistory={admin.openExportHistory}
          photoPreviewUrl={admin.photoPreviewUrl}
          isLoadingPhoto={admin.isLoadingPhoto}
          openPhotoPreview={admin.openPhotoPreview}
          closePhotoPreview={admin.closePhotoPreview}
        />
      )}

      {admin.showExportHistory && (
        <ExportHistoryModal
          onClose={() => admin.setShowExportHistory(false)}
          batches={admin.exportBatches}
          isLoadingBatches={admin.isLoadingBatches}
          batchItems={admin.batchItems}
          openBatchId={admin.openBatchId}
          viewBatchItems={admin.viewBatchItems}
          deleteBatch={admin.deleteBatch}
          isDeletingBatch={admin.isDeletingBatch}
        />
      )}

      {admin.showUserManagement && (
        <UserManagementModal
          onClose={() => admin.setShowUserManagement(false)}
          newUserForm={admin.newUserForm}
          setNewUserForm={admin.setNewUserForm}
          newUserError={admin.newUserError}
          isCreatingUser={admin.isCreatingUser}
          handleCreateUser={admin.handleCreateUser}
          users={admin.users}
          isLoadingUsers={admin.isLoadingUsers}
          currentUser={auth.currentUser}
          handleRoleChange={admin.handleRoleChange}
          handleDeleteUser={admin.handleDeleteUser}
        />
      )}

      {equip.showEditModal && (
        <EditEquipmentModal
          onClose={equip.closeEditModal}
          editForm={equip.editForm}
          setEditForm={equip.setEditForm}
          editError={equip.editError}
          editingRawName={equip.editingRawName}
          isSavingEdit={equip.isSavingEdit}
          handleEditSubmit={equip.handleEditSubmit}
          isSuperAdmin={auth.isSuperAdmin}
        />
      )}

      <ActionMenu
        actionMenuItem={equip.actionMenuItem}
        actionMenuPos={equip.actionMenuPos}
        setActionMenuItem={equip.setActionMenuItem}
        setQrCodeItem={qr.setQrCodeItem}
        openEditModal={equip.openEditModal}
        openPhotoModal={equip.openPhotoModal}
        openWriteoffModal={equip.openWriteoffModal}
        isSuperAdmin={auth.isSuperAdmin}
      />

      {equip.showWriteoffModal && (
        <WriteoffModal
          onClose={equip.closeWriteoffModal}
          item={equip.writeoffItem}
          error={equip.writeoffError}
          isSubmitting={equip.isWritingOff}
          onSubmit={equip.submitWriteoff}
        />
      )}

      {equip.showPhotoModal && (
        <EquipmentPhotoModal
          onClose={equip.closePhotoModal}
          item={equip.photoItem}
          photoPreviewUrl={equip.photoPreviewUrl}
          isLoadingPhoto={equip.isLoadingPhoto}
          isUploadingPhoto={equip.isUploadingPhoto}
          photoError={equip.photoError}
          onUpload={equip.uploadItemPhoto}
          onDelete={equip.deleteItemPhoto}
          canManage={auth.isSuperAdmin}
        />
      )}

      <QRCodeModal
        qrCodeItem={qr.qrCodeItem}
        setQrCodeItem={qr.setQrCodeItem}
      />

      <QRScannerModal
        showScanner={qr.showScanner}
        closeScanner={qr.closeScanner}
        scannerError={qr.scannerError}
        scannerDivId={qr.scannerDivId}
        scanMode={qr.scanMode}
      />

      <main
        className={
          auth.isGuest || !auth.isSuperAdmin
            ? "main-content guest-mode"
            : "main-content"
        }
      >
        {!auth.isGuest && auth.isSuperAdmin && (
          <EquipmentForm
            showAddFormMobile={showAddFormMobile}
            setShowAddFormMobile={setShowAddFormMobile}
            form={equip.form}
            setForm={equip.setForm}
            isSaving={equip.isSaving}
            handleSubmit={equip.handleSubmit}
          />
        )}

        <EquipmentTable
          isGuest={auth.isGuest}
          isSuperAdmin={auth.isSuperAdmin}
          isLoadingList={equip.isLoadingList}
          filteredEquipments={equip.filteredEquipments}
          searchTerm={equip.searchTerm}
          setSearchTerm={equip.setSearchTerm}
          isImporting={equip.isImporting}
          handleImportExcel={equip.handleImportExcel}
          exportToExcel={equip.exportToExcel}
          openScanner={qr.openScanner}
          handleStatusChange={equip.handleStatusChange}
          toggleActionMenu={equip.toggleActionMenu}
          openPhotoModal={equip.openPhotoModal}
        />
      </main>

      <Footer />
    </div>
  );
}

export default App;
