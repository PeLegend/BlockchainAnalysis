# คู่มือติดตั้งโปรแกรม (Installation Guide)

## 1. ความต้องการของระบบ (System Requirements)

### 1.1 ด้านฮาร์ดแวร์และระบบปฏิบัติการ (OS & Hardware)
- **ระบบปฏิบัติการ:** Windows 10 หรือ Windows 11 (64-bit), macOS, หรือ Linux ที่รองรับระบบ Docker
- **หน่วยความจำ (RAM):** แนะนำขั้นต่ำ 8 GB (เพื่อให้เพียงพอต่อการรัน Docker Container ของทั้งเซิร์ฟเวอร์เว็บและฐานข้อมูล)

### 1.2 โปรแกรมและเครื่องมือที่จำเป็น (Software & Tools)
- **Docker Desktop:** เป็นโปรแกรมหลักที่จำเป็นต้องติดตั้ง เพื่อใช้จำลองสภาพแวดล้อมและรันระบบทั้งหมด (เว็บแอปพลิเคชัน Next.js และฐานข้อมูล Neo4j) 
- **Code Editor:** โปรแกรมอิดิเตอร์สำหรับตรวจสอบและแก้ไขซอร์สโค้ด (โครงงานนี้ใช้ Visual Studio Code)
- **Web Browser:** เว็บเบราว์เซอร์สำหรับใช้ทดสอบและแสดงผลหน้าเว็บไซต์ (เช่น Google Chrome, Microsoft Edge, Firefox)

### 1.3 เทคโนโลยีและเฟรมเวิร์กที่ใช้ในโครงงาน (Tech Stack)
- **Front-end & Back-end:** Next.js (App Router), TypeScript, Tailwind CSS
- **Database:** Neo4j (Graph Database สำหรับจัดเก็บและแสดงผลเส้นทางบล็อกเชน)
- **Infrastructure:** Docker & Docker Compose (สำหรับจัดการ Container ระบบทั้งหมด)
