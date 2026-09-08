export default function ActionMenu({
  actionMenuItem,
  actionMenuPos,
  setActionMenuItem,
  setQrCodeItem,
  openEditModal,
  handleDelete,
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
  );
}
