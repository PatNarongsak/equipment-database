export default function ActionMenu({
  actionMenuItem,
  actionMenuPos,
  setActionMenuItem,
  setQrCodeItem,
  openEditModal,
  openPhotoModal,
  openWriteoffModal,
  isSuperAdmin,
}) {
  if (!actionMenuItem) return null;

  return (
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
      <button
        onClick={() => {
          openPhotoModal(actionMenuItem);
          setActionMenuItem(null);
        }}
        className="action-dropdown-item"
      >
        รูปภาพครุภัณฑ์
      </button>
      {isSuperAdmin && (
        <button
          onClick={() => {
            openWriteoffModal(actionMenuItem);
            setActionMenuItem(null);
          }}
          className="action-dropdown-item action-dropdown-item-danger"
        >
          แทงจำหน่าย
        </button>
      )}
    </div>
  );
}
