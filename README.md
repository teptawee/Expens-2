# 💰 บันทึกค่าใช้จ่าย

ระบบบันทึกค่าใช้จ่ายส่วนตัว พร้อม Dashboard สวยงาม ใช้งานฟรี 100%

## 🏗️ สถาปัตยกรรม

- **Frontend:** HTML/CSS/JS (host บน GitHub Pages)
- **Backend:** Google Apps Script + Google Sheets
- **Communication:** REST API ผ่าน `doPost()`

## 🚀 วิธีติดตั้ง

### ขั้นตอนที่ 1: ตั้งค่า Backend (Google Sheets + Apps Script)

1. สร้าง Google Sheet ใหม่
2. ไปที่ **Extensions** → **Apps Script**
3. วางโค้ดจาก `Code.gs` ลงในไฟล์ `Code.gs`
4. สร้างไฟล์ HTML ชื่อ `Index` แล้ววางโค้ดจาก `Index.html`
5. Run ฟังก์ชัน `setup()` → อนุญาตสิทธิ์
6. Run ฟังก์ชัน `importData()` (ถ้าต้องการข้อมูลตัวอย่าง)
7. **Deploy** → **New deployment** → **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** ⚠️
8. คัดลอก **Web App URL**

### ขั้นตอนที่ 2: ตั้งค่า Frontend

1. แก้ไข `Index.html` 2 จุด:
   - `API_URL` = Web App URL ที่คัดลอกจากขั้นที่ 8
   - `API_TOKEN` = ค่าเดียวกับ `API_SECRET` ใน `Code.gs`

2. อัปโหลดขึ้น GitHub:

```bash
git init
git add Index.html README.md
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
git push -u origin main
