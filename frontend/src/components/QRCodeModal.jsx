import { QRCodeCanvas } from "qrcode.react";

export default function QRCodeModal({ qrCodeItem, setQrCodeItem }) {
  if (!qrCodeItem) return null;

  const handleDownload = () => {
    const qrCanvas = document.getElementById("qr-canvas-download");
    const qrSize = qrCanvas.width;
    const padding = 16;
    const serialFontSize = 20;
    const nameFontSize = 14;
    const textBlockHeight = serialFontSize + 8 + nameFontSize + padding * 2;

    // สร้าง canvas ใหม่ที่สูงกว่าเดิม เอาไว้วาด QR + ข้อความรวมในภาพเดียวกัน
    const composite = document.createElement("canvas");
    composite.width = qrSize;
    composite.height = qrSize + textBlockHeight;
    const ctx = composite.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, composite.width, composite.height);
    ctx.drawImage(qrCanvas, 0, 0);

    ctx.textAlign = "center";
    ctx.fillStyle = "#0f172a";
    ctx.font = `bold ${serialFontSize}px sans-serif`;
    ctx.fillText(
      qrCodeItem.serial_number,
      qrSize / 2,
      qrSize + padding + serialFontSize,
    );

    // ตัดชื่ออุปกรณ์ให้พอดีความกว้างภาพ กันข้อความยาวล้นขอบ
    ctx.font = `${nameFontSize}px sans-serif`;
    ctx.fillStyle = "#475569";
    const maxWidth = qrSize - padding * 2;
    let name = qrCodeItem.name || "";
    let truncated = false;
    while (ctx.measureText(name).width > maxWidth && name.length > 1) {
      name = name.slice(0, -1);
      truncated = true;
    }
    if (truncated) name = name.slice(0, -1) + "…";
    ctx.fillText(
      name,
      qrSize / 2,
      qrSize + padding + serialFontSize + 8 + nameFontSize,
    );

    const url = composite.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = `QR-${qrCodeItem.serial_number}.png`;
    link.click();
  };

  const handlePrint = () => {
    const canvas = document.getElementById("qr-canvas-download");
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
  };

  return (
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
            <button className="btn-secondary" onClick={handleDownload}>
              ดาวน์โหลด
            </button>
            <button className="btn-primary" onClick={handlePrint}>
              พิมพ์
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
