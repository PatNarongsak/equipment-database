import { useState, useRef, useEffect } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

const SCANNER_DIV_ID = "qr-scanner-region";

// จำกัดฟอร์แมตที่ scanner จะลองอ่าน แยกตามโหมด - ช่วยให้อ่านเร็วขึ้นและแม่นขึ้น
// (ไม่ต้องไล่เดาทุกฟอร์แมตในทุกเฟรม)
const QR_FORMATS = [Html5QrcodeSupportedFormats.QR_CODE];

// บาร์โค้ด 1 มิติที่พบบนสติกเกอร์ครุภัณฑ์ทั่วไป (เลขครุภัณฑ์/รหัสสินทรัพย์)
const BARCODE_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

// รวม logic ของ QR Code: modal แสดง/ดาวน์โหลด/พิมพ์ QR ของแต่ละรายการ
// และตัวสแกนกล้อง (ต้องส่ง setSearchTerm เข้ามา เพื่อเติมช่องค้นหาอัตโนมัติเมื่อสแกนเจอ)
// ตัวสแกนใช้เครื่องเดียวกันทั้งโหมด QR และโหมดบาร์โค้ด ต่างกันแค่ฟอร์แมตที่รับ + ข้อความบน modal
export function useQRCode({ setSearchTerm }) {
  const [qrCodeItem, setQrCodeItem] = useState(null); // item ที่กำลังโชว์ QR อยู่
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState("qr"); // "qr" | "barcode"
  const [scannerError, setScannerError] = useState("");
  const scannerRef = useRef(null); // เก็บ instance ของ Html5Qrcode

  const openScanner = (mode = "qr") => {
    setScannerError("");
    setScanMode(mode === "barcode" ? "barcode" : "qr");
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

    const isBarcode = scanMode === "barcode";

    const html5Qrcode = new Html5Qrcode(SCANNER_DIV_ID, {
      formatsToSupport: isBarcode ? BARCODE_FORMATS : QR_FORMATS,
      verbose: false,
    });
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

    // บาร์โค้ดเป็นแถบแนวนอน ใช้กรอบกว้างเตี้ยจะเล็งง่ายกว่า / QR ใช้กรอบจัตุรัส
    const qrbox = isBarcode
      ? { width: 300, height: 150 }
      : { width: 250, height: 250 };

    html5Qrcode
      .start(
        { facingMode: "environment" }, // ใช้กล้องหลังเป็นค่าเริ่มต้น (เหมาะกับมือถือ/แท็บเล็ต)
        { fps: 10, qrbox },
        onScanSuccess,
        () => {} // error callback ตอนยังไม่เจอโค้ดในเฟรม ไม่ต้องแสดงอะไร
      )
      .catch((err) => {
        setScannerError(
          "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์ หรือเช็คว่าเครื่องมีกล้องหรือไม่"
        );
        console.error("Scanner start error:", err);
      });

    // safety net เผื่อ component หลุดออกจาก DOM ด้วยเหตุผลอื่น (ไม่ใช่ทางหลักที่ใช้ปิดกล้องแล้ว
    // เพราะ closeScanner/onScanSuccess จัดการ stop() เองก่อนซ่อน modal อยู่แล้ว)
    return () => {
      isStopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScanner]);

  return {
    qrCodeItem,
    setQrCodeItem,
    showScanner,
    scanMode,
    scannerError,
    openScanner,
    closeScanner,
    scannerDivId: SCANNER_DIV_ID,
  };
}
