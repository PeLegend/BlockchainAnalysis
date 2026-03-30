# ใช้ Node.js เวอร์ชันที่มีขนาดเล็ก
FROM node:18-alpine

# ตั้งค่า Directory เริ่มต้นใน Container
WORKDIR /app

# คัดลอกไฟล์จัดการ package มาติดตั้งก่อนเพื่อความรวดเร็ว
COPY package.json package-lock.json ./
RUN npm ci

# คัดลอกออพเจคและไฟล์ทั้งหมดในโปรเจกต์
COPY . .

# สร้าง Build สำหรับนำไปรัน
RUN npm run build

# เตรียมพอร์ต
EXPOSE 3000

# คำสั่งตอนสั่งรันโปรเจกต์
CMD ["npm", "start"]
