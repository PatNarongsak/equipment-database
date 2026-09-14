// footer มาตรฐาน - ใช้ข้อความเดียวกับเว็บหลักของภาควิชา (phy.sc.su.ac.th) เพื่อให้ดูเป็นหน่วยงานเดียวกัน
// โชว์ทั้งหน้า login และหน้าหลัก (ผู้มาเยือน/เจ้าหน้าที่) เพราะตอนนี้เปิดให้นักศึกษาเข้าดูได้ผ่านโหมดผู้มาเยือนด้วย
export default function Footer() {
  return (
    <footer className="app-footer">
      <p className="app-footer-contact">
        สำนักงานภาควิชาฟิสิกส์ อาคารวิทยาศาสตร์ 3 คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร
        วิทยาเขตพระราชวังสนามจันทร์
        <br />
        เลขที่ 6 ถนนราชมรรคาใน อ.เมือง จ.นครปฐม 73000 · โทร. 034-147029 (ภายใน
        207400, 207403)
      </p>
      <p className="app-footer-copyright">
        Copyright © Department of Physics, Faculty of Science, Silpakorn
        University ({new Date().getFullYear()})
      </p>
    </footer>
  );
}
