export default function QRScannerModal({
  showScanner,
  closeScanner,
  scannerError,
  scannerDivId,
}) {
  if (!showScanner) return null;

  return (
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
          <p className="scanner-hint">เล็งกล้องไปที่ QR Code บนตัวครุภัณฑ์</p>
        )}
        <div id={scannerDivId} className="scanner-region"></div>
      </div>
    </div>
  );
}
