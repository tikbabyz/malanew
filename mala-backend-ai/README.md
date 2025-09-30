# Mala AI Backend

## TL;DR
- Flask + SQLAlchemy backend ที่ให้บริการ REST API และ YOLOv11 inference สำหรับระบบร้านหมาล่า
- ใช้ MySQL เป็นฐานข้อมูลหลัก และจัดการสื่อ (ใบสลิป, QR, รูปสินค้า) ในโฟลเดอร์ `uploads/`
- ตั้งค่า virtualenv, ติดตั้ง dependencies (`pip install -r requirements.txt`), กำหนด `.env`, แล้วรัน `python server.py`

## Overview
The backend powers every data & AI interaction for the Mala Restaurant platform. It exposes a REST API for:

- **Authentication** & role/permission management
- **Product / Announcement / Payment** CRUD endpoints consumed by the React admin console
- **Image uploads** (QR code, product imagery, payment slips)
- **YOLOv11-based colour detection** with configurable ROI and HSV tuning

The service is organised as a Flask application factory (`app:create_app`) with blueprints split by resource domain.

### Core stack
- Flask 3, Flask-CORS, Flask-SQLAlchemy, Flask-Migrate
- MySQL (via PyMySQL) for persistence
- Torch 2.8 + Ultralytics for YOLOv11 inference
- Pillow / OpenCV for image post-processing

## Requirements
- Python **3.10 หรือใหม่กว่า** (ทดสอบกับ 3.13)
- MySQL 8+ พร้อมฐานข้อมูลว่างสำหรับโปรเจ็กต์นี้
- ระบบที่รองรับ Torch + Ultralytics (CPU build ที่ระบุใน `requirements.txt`)
- (แนะนำ) `virtualenv` หรือ `conda`

## Setup
```bash
python -m venv venv
# Windows PowerShell
venv\Scripts\activate
# macOS / Linux
# source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### Environment configuration
สร้างไฟล์ `.env` (อยู่ระดับเดียวกับ `server.py`) แล้วใส่ค่าตัวอย่างด้านล่าง:
```ini
# Database
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/mala_restaurant
SECRET_KEY=change-this-in-prod

# YOLO model
MALA_MODEL_PATH=models/best.pt
MALA_CONF=0.35
MALA_IOU=0.50
MALA_IMG=1024

# Optional tuning
MALA_COLOR_OVERRIDE_MIN=0.60
MALA_MODEL_TRUST=0.62
MALA_RESPECT_USER_ROI=1

# Bootstrap database (สร้างตาราง + seed ข้อมูลตัวอย่าง)
AUTO_CREATE_DB=1
SEED_ADMIN=1

# Server port override (ถ้าไม่กำหนดจะใช้ 8000)
MALA_PORT=8000
```
> ใส่ไฟล์โมเดล (เช่น `best.pt`) ไว้ในโฟลเดอร์ `models/` หรือแก้ `MALA_MODEL_PATH`

### Database migrations
ติดตั้ง Flask CLI และสร้างตารางด้วยคำสั่งต่อไปนี้ (ครั้งแรกเท่านั้น):
```bash
# ตั้งค่าให้ Flask CLI รู้จัก factory
$env:FLASK_APP = "app:create_app"      # PowerShell
# export FLASK_APP=app:create_app      # Bash/Zsh

flask db upgrade
```
ถ้ากำหนด `AUTO_CREATE_DB=1` ระบบจะเรียก `db.create_all()` ให้อัตโนมัติอยู่แล้ว แต่การใช้ migration จะปลอดภัยกว่าสำหรับ production

### Seeding sample data
เปิดใช้งาน `AUTO_CREATE_DB=1` และ `SEED_ADMIN=1` ใน `.env` แล้วสตาร์ทเซิร์ฟเวอร์หนึ่งครั้ง ระบบจะสร้าง:
- Admin (`admin` / `admin123`)
- Staff (`staff` / `123456`)
- Colour price presets, default announcements และค่า QR เริ่มต้น

## Running the server
```bash
# Dev (debug=True, auto reload)
python server.py

# Production style (Gunicorn)
venv\Scripts\activate  # หรือ source venv/bin/activate
pip install gunicorn
HTTP_WORKERS=2 gunicorn "app:create_app()" -b 0.0.0.0:8000
```
> เมื่อสตาร์ทสำเร็จ API จะพร้อมใช้งานที่ `http://127.0.0.1:8000`

## API surface (หลัก)
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check (status + model info) |
| POST | `/api/login` | Username/password authentication (plain or sha256: hash) |
| GET | `/api/users` | รายชื่อผู้ใช้ (admin only) |
| POST | `/api/users` | สร้างผู้ใช้ใหม่ |
| PUT/DELETE | `/api/users/<id>` | ปรับปรุง / ลบ ผู้ใช้ |
| GET/POST | `/api/products` | CRUD ข้อมูลสินค้า + ค่าสี |
| GET/POST | `/api/payments/settings` | อ่าน/บันทึกค่า QR และข้อมูลโอน |
| GET/POST | `/api/announcements` | จัดการประกาศ |
| POST | `/api/detect` | อัปโหลดภาพ (`multipart/form-data` ช่อง `image`) เพื่อรัน YOLO + คืน bounding box |
| POST | `/api/upload/image` | อัปโหลดรูปสินค้า (multipart) |
| GET | `/api/qr/images/<filename>` | ดึงรูป QR code |

Blueprints อยู่ใน `app/routes/` หากต้องการดูรายละเอียด payload ที่คาดหวัง

## File storage
- รูปสินค้า: `uploads/products/`
- รูปสลิป: `uploads/slips/`
- รูป QR: `uploads/qr_codes/`

โฟลเดอร์จะถูกสร้างอัตโนมัติเมื่อเรียก `create_app()` (ดู `app/utils.py`)

## Troubleshooting
- **Torch ติดตั้งไม่สำเร็จ**: ใช้ Python 64-bit และอัปเดต `pip`; บน Windows บางครั้งต้องติดตั้ง Visual C++ Build Tools
- **MySQL connection refused**: ตรวจสอบ `DATABASE_URL`, สิทธิ์ของ user, และเปิด `mysqld --skip-name-resolve`
- **CORS ปัญหา**: ปรับ origin ที่อนุญาตใน `app/__init__.py`
- **โมเดลหาไม่เจอ**: ยืนยัน path ใน `MALA_MODEL_PATH` และสิทธิ์อ่านไฟล์ `.pt`

## Useful commands
```bash
# รัน health check test ด้วย curl
curl http://127.0.0.1:8000/api/health

# ตรวจสอบผู้ใช้ทั้งหมด (debug endpoint)
curl http://127.0.0.1:8000/api/users/debug

# อัปโหลดรูปทดสอบ YOLO
test-img.png
curl -F "image=@test-img.png" http://127.0.0.1:8000/api/detect
```

## Contributing
- ใช้ Black/PEP8 เป็นแนวทางจัด format (ยังไม่รวมไว้ใน requirements)
- แยก logic ใหม่เป็นโมดูลใน `app/routes/` หรือ `app/services/` ก่อนเชื่อม blueprint
- ถ้าเพิ่มคอลัมน์ในโมเดล อย่าลืมสร้าง migration `flask db migrate -m "describe change"` และ `flask db upgrade`
