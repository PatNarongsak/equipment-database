export default function QRScannerModal({
  showScanner,
  closeScanner,
  scannerError,
  scannerDivId,
  scanMode = "qr",
}) {
  if (!showScanner) return null;

  const isBarcode = scanMode === "barcode";

  return (
    <div className="modal-overlay" onClick={closeScanner}>
      <div
        className="modal-box scanner-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{isBarcode ? "สแกนบาร์โค้ด" : "สแกน QR Code"}</h3>
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
            {isBarcode
              ? "เล็งกล้องไปที่บาร์โค้ดบนตัวครุภัณฑ์"
              : "เล็งกล้องไปที่ QR Code บนตัวครุภัณฑ์"}
          </p>
        )}
        <div id={scannerDivId} className="scanner-region"></div>
      </div>
    </div>
  );
}
