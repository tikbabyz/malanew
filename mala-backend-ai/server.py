from pathlib import Path
import os, base64, json, uuid, mimetypes, hashlib
# Temporary: Skip AI libraries
try:
    import cv2, numpy as np
    AI_AVAILABLE = True
except ImportError:
    cv2, np = None, None
    AI_AVAILABLE = False
    print("⚠️ AI libraries not available - some features disabled")
from datetime import datetime, timezone
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory, url_for
# Helper สำหรับสร้าง absolute URL
def abs_url_for(endpoint, **values):
    rel = url_for(endpoint, **values)
    host = request.host_url.rstrip('/')
    return f"{host}{rel}"
from flask_cors import CORS
app = Flask(__name__)



# อนุญาต CORS จากทั้ง localhost และ IP network
from flask_cors import CORS

CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            r"https://.*\.ngrok\.app",   # ครอบคลุมทุกโดเมน ngrok
        ],
        "methods": ["GET","POST","PUT","DELETE","OPTIONS"],
        "allow_headers": ["Content-Type","Authorization"],
    }
})

# optional: ช่วยตอบ preflight เร็ว ๆ
@app.route("/api/<path:_any>", methods=["OPTIONS"])
def _cors_preflight(_any):
    return ("", 204)


# Re-add necessary imports
try:
    from ultralytics import YOLO
    from PIL import Image, ImageOps
    from flask_sqlalchemy import SQLAlchemy
    from sqlalchemy.dialects.postgresql import JSONB
    IMPORTS_AVAILABLE = True
except ImportError:
    YOLO, Image, ImageOps, SQLAlchemy, JSONB = None, None, None, None, None
    IMPORTS_AVAILABLE = False
    print("⚠️ Some libraries not available - features will be limited")

# รองรับ HEIC/HEIF (ถ้ามีการติดตั้ง pillow-heif)
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except Exception:
    pass

# ---------- ENV / CONFIG ----------
BASE_DIR = Path(__file__).resolve().parent
load_dotenv()

# Upload configuration
UPLOAD_FOLDER = BASE_DIR / "uploads" / "slips"
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)

# Create upload directories
PRODUCTS_UPLOAD_DIR = BASE_DIR / "uploads" / "products"
QR_UPLOAD_DIR = BASE_DIR / "uploads" / "qr_codes"
PRODUCTS_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
QR_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'}

MODEL_PATH = os.getenv("MALA_MODEL_PATH", str(BASE_DIR / "models" / "best.pt"))
CONF = float(os.getenv("MALA_CONF", "0.35"))
IOU  = float(os.getenv("MALA_IOU",  "0.50"))
IMG  = int(os.getenv("MALA_IMG",   "1024"))

COLOR_OVERRIDE_MIN = float(os.getenv("MALA_COLOR_OVERRIDE_MIN", "0.60"))
MODEL_TRUST        = float(os.getenv("MALA_MODEL_TRUST", "0.62"))
CENTER_SHRINK      = float(os.getenv("MALA_CENTER_SHRINK", "0.60"))
SV_MIN             = int(os.getenv("MALA_SV_MIN", "50"))
MIN_PIXELS         = int(os.getenv("MALA_MIN_PIXELS", "60"))


RESPECT_USER_ROI = os.getenv("MALA_RESPECT_USER_ROI", "1") == "1"
USER_PAD = float(os.getenv("MALA_USER_PAD", "0.10"))

ROI_SCALES = [float(x.strip()) for x in os.getenv(
    "MALA_ROI_SCALES", "0.90,1.00,1.15,1.30,1.45"
).split(",")]

EDGE_MARGIN = float(os.getenv("MALA_EDGE_MARGIN", "0.08"))
DENSITY_TGT_MIN = float(os.getenv("MALA_DENSITY_MIN", "0.06"))
DENSITY_TGT_MAX = float(os.getenv("MALA_DENSITY_MAX", "0.22"))

if not os.path.isabs(MODEL_PATH):
    MODEL_PATH = str((BASE_DIR / MODEL_PATH).resolve())

# ---------- APP ----------
# Flask app already created above, don't duplicate
# ขนาดอัปโหลดสูงสุด (กันพลาดไฟล์ใหญ่เกิน)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB
# === DB setup (ADD) ===
DB_URL = os.getenv("DATABASE_URL")  # .env: postgresql+psycopg2://user:pass@host:5432/dbname

# ตรวจสอบว่ามี Database URL หรือไม่
if DB_URL:
    app.config["SQLALCHEMY_DATABASE_URI"] = DB_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    
    try:
        db = SQLAlchemy(app)
        DATABASE_ENABLED = True
        print("✅ Database connection configured")
    except Exception as e:
        print(f"⚠️ Database configuration failed: {e}")
        DATABASE_ENABLED = False
        db = None
else:
    print("⚠️ No DATABASE_URL found in .env - running without database")
    DATABASE_ENABLED = False
    db = None

# ---------- LOAD MODEL ----------

# ✅ In-memory storage (fallback when no database)
MEMORY_STORAGE = {
    "users": [
        {"id": 1, "username": "admin", "password": "admin123", "role": "ADMIN", "name": "ผู้ดูแลระบบ", "active": True, "phone": "", "email": "", "perms": ["pos", "products", "users", "announcements", "reports"]},
        {"id": 2, "username": "staff", "password": "123456", "role": "STAFF", "name": "พนักงานหน้าร้าน", "active": True, "phone": "", "email": "", "perms": ["pos", "products"]}
    ],
    "products": [
        {"id": 1, "name": "หม่าล่าหมูสไลด์", "price": 189, "image": "product_20250914_003612_LINE_ALBUM_31768_250904_3.jpg"},
        {"id": 2, "name": "เห็ดโคนสด", "price": 129, "image": "product_20250914_011000_chutima2.jpg"},
        {"id": 3, "name": "เต้าหู้สด", "price": 89, "image": "product_20250918_000617_taohuu.jpg"}
    ],
    "announcements": [],
    "orders": [],
    "next_ids": {"user": 3, "product": 4, "announcement": 1, "order": 1}
}
# --- PaymentSettings Model ---
class PaymentSettings(db.Model):
    __tablename__ = "payment_settings"
    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    qr_image = db.Column(db.Text)
    qr_label = db.Column(db.Text)

# --- PaymentSettings API ---

# ✅ ADD: Models
class User(db.Model):
    __tablename__ = "users"
    id        = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    username  = db.Column(db.Text, unique=True, nullable=False)
    password  = db.Column(db.Text)
    role      = db.Column(db.Text, nullable=False)   # ADMIN / STAFF
    name      = db.Column(db.Text)
    active    = db.Column(db.Boolean, nullable=False, default=True)
    phone     = db.Column(db.Text)
    email     = db.Column(db.Text)
    perms     = db.Column(JSONB, default=list)  # << เดิมเป็น JSONB เฉย ๆ

class Product(db.Model):
    __tablename__ = "products"
    id          = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    name        = db.Column(db.Text, nullable=False)
    price       = db.Column(db.Numeric(12,2), nullable=False, default=0)
    category    = db.Column(db.Text, nullable=False)
    stock       = db.Column(db.Integer, nullable=False, default=0)
    active      = db.Column(db.Boolean, nullable=False, default=True)
    color       = db.Column(db.Text)
    image       = db.Column(db.Text)

class ColorPrice(db.Model):
    __tablename__ = "color_prices"
    color = db.Column(db.Text, primary_key=True)
    price = db.Column(db.Numeric(12,2), nullable=False)

# ✅ Password hashing functions (moved here to be available early)
def make_password_hash(plain_password):
    """Create password hash in same format as frontend: sha256:base64"""
    if not plain_password:
        return ""
    # Convert to SHA-256 then base64 (same as frontend)
    sha256_hash = hashlib.sha256(plain_password.encode('utf-8')).digest()
    b64_hash = base64.b64encode(sha256_hash).decode('ascii')
    return f"sha256:{b64_hash}"

def verify_password(plain_password, stored_hash):
    """Verify password against stored hash"""
    if not stored_hash:
        # If no hash stored, compare as plain text (for backward compatibility)
        return (stored_hash or "") == (plain_password or "")
    
    if stored_hash.startswith("sha256:"):
        # Hash format - compare hashes
        expected_hash = make_password_hash(plain_password)
        return stored_hash == expected_hash
    else:
        # Plain text format - direct compare
        return stored_hash == plain_password

class Order(db.Model):
    __tablename__ = "orders"
    id         = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    items      = db.Column(JSONB, nullable=False, default=list)
    persons    = db.Column(db.Integer, nullable=False, default=1)
    split_mode = db.Column(db.Text, nullable=False, default='NONE')
    payments   = db.Column(JSONB, nullable=False, default=list)
    paid       = db.Column(db.Boolean, nullable=False, default=False)
    paid_at    = db.Column(db.DateTime(timezone=True))
    channel    = db.Column(db.Text)
    store      = db.Column(JSONB, default=dict)
    subtotal   = db.Column(db.Numeric(12,2), nullable=False, default=0)
    discount   = db.Column(db.Numeric(12,2), nullable=False, default=0)
    service    = db.Column(db.Numeric(12,2), nullable=False, default=0)
    vat        = db.Column(db.Numeric(12,2), nullable=False, default=0)
    total      = db.Column(db.Numeric(12,2), nullable=False)

class Payment(db.Model):
    __tablename__ = "payments"
    id        = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    order_id  = db.Column(db.BigInteger, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    method    = db.Column(db.Text, nullable=False)   # cash / qr / card / other
    amount    = db.Column(db.Numeric(12,2), nullable=False)
    received  = db.Column(db.Numeric(12,2), nullable=False)
    change    = db.Column(db.Numeric(12,2), nullable=False)
    time      = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    ref       = db.Column(db.Text)  # เก็บ reference string หรือ JSON string ของสลิป

class TransferSlip(db.Model):
    __tablename__ = "transfer_slips"
    id         = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    order_id   = db.Column(db.BigInteger, db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    payment_id = db.Column(db.BigInteger, db.ForeignKey("payments.id", ondelete="CASCADE"), nullable=True)
    filename   = db.Column(db.Text, nullable=False)
    file_path  = db.Column(db.Text, nullable=False)
    file_size  = db.Column(db.Integer, nullable=False)
    mime_type  = db.Column(db.Text, nullable=False)
    upload_time = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

class Announcement(db.Model):
    __tablename__ = "announcements"
    id           = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    title        = db.Column(db.Text, nullable=False)
    body         = db.Column(db.Text)
    image        = db.Column(db.Text)
    created_at   = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    published_at = db.Column(db.DateTime(timezone=True))
    active       = db.Column(db.Boolean, nullable=False, default=True)

# ✅ ADD: bootstrap DB (สร้างตาราง + seed admin + seed color)
if DATABASE_ENABLED and db:
    try:
        with app.app_context():
            if os.getenv("AUTO_CREATE_DB","0") == "1":
                print("🚀 Creating database tables...")
                db.create_all()
            if os.getenv("SEED_ADMIN","0") == "1":
                if not User.query.filter(db.func.lower(User.username)=="admin").first():
                    db.session.add(User(
                        username="admin", password=make_password_hash("admin123"), role="ADMIN",
                        name="ผู้ดูแลระบบ", active=True, perms=["pos","products","users","announcements","reports"]
                    ))
                    print("👤 Created admin user with hashed password")
                # เพิ่ม STAFF user หรือ update ถ้ามีอยู่แล้ว
                staff_user = User.query.filter(db.func.lower(User.username)=="staff").first()
                if not staff_user:
                    db.session.add(User(
                        username="staff", password=make_password_hash("123456"), role="STAFF",
                        name="พนักงานหน้าร้าน", active=True, perms=["pos","products"]
                    ))
                    print("👤 Created staff user with hashed password")
                else:
                    # update ข้อมูล staff ที่มีอยู่แล้ว - hash password ใหม่
                    staff_user.password = make_password_hash("123456")
                    staff_user.role = "STAFF"
                    staff_user.name = "พนักงานหน้าร้าน"
                    staff_user.perms = ["pos","products"]
                # seed สีพื้นฐานถ้ายังไม่มี
                for c,price in {"red":5,"green":9,"blue":12,"pink":18,"purple":22}.items():
                    if not db.session.get(ColorPrice, c):
                        db.session.add(ColorPrice(color=c, price=price))
                db.session.commit()
                print("✅ Database initialized successfully")
    except Exception as e:
        print(f"⚠️ Database initialization failed: {e}")
        print("📝 Continuing with in-memory storage...")
else:
    print("💾 Using in-memory storage (no database configured)")

# Seed announcements in database if enabled
if DATABASE_ENABLED and db:
    try:
        with app.app_context():
            if os.getenv("SEED_ADMIN","0") == "1":
                # seed ตัวอย่างประกาศ (ถ้ายังไม่มี)
                if Announcement.query.count() == 0:
                    db.session.add_all([
                        Announcement(
                            title="โปรโมชันเปิดร้าน ลด 10%",
                            body="เฉพาะสัปดาห์นี้เท่านั้น!",
                            image=None,
                            published_at=datetime.utcnow(),
                            active=True,
                        ),
                        Announcement(
                            title="แจ้งวันหยุด",
                            body="หยุดทุกวันพุธต้นเดือน",
                            image=None,
                            published_at=datetime.utcnow(),
                            active=True,
                        ),
                    ])
                    db.session.commit()
                    print("📢 Announcements seeded")
    except Exception as e:
        print(f"⚠️ Announcement seeding failed: {e}")


try:
    model = YOLO(MODEL_PATH)
    print(f"[OK] Loaded model: {MODEL_PATH}")
except Exception as e:
    print("[ERROR] Load model:", e)
    model = None

# ✅ ADD: helpers
def json_user_safe(u: User):
    return {"id":u.id,"username":u.username,"role":u.role,"name":u.name,"active":u.active,"perms":u.perms or []}

def json_product(p: Product):
    return {
        "id":p.id,"name":p.name,"price":float(p.price or 0),"category":p.category,
        "stock":p.stock,"active":p.active,"color":p.color,"image":p.image
    }
def json_announcement(a: Announcement):
    return {
        "id": a.id,
        "title": a.title,
        "body": a.body or "",
        "image": a.image,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
        "publishedAt": a.published_at.isoformat() if a.published_at else None,
        "active": bool(a.active),
    }
    
# ✅ ADD: login
@app.post("/api/login")
def api_login():
    d = request.get_json(force=True)
    username = (d.get("username") or "").strip().lower()
    password = (d.get("password") or "").strip()
    u = User.query.filter(db.func.lower(User.username)==username).first()
    if not u:            return jsonify({"error":"ไม่พบบัญชีผู้ใช้"}), 404
    if not u.active:     return jsonify({"error":"บัญชีถูกปิดใช้งาน"}), 403
    
    # ใช้ verify_password แทนการเปรียบเทียบ plain text
    if not verify_password(password, u.password):
        return jsonify({"error":"รหัสผ่านไม่ถูกต้อง"}), 400
    return jsonify(json_user_safe(u))

# ✅ Helper functions for file upload
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_type(filename):
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or 'application/octet-stream'

# ✅ Upload product image endpoint
@app.post("/api/upload/image")
def api_upload_product_image():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "ไม่พบไฟล์รูปภาพ"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "ไม่ได้เลือกไฟล์"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "ประเภทไฟล์ไม่รองรับ (รองรับ: PNG, JPG, JPEG, GIF, WebP)"}), 400
        
        # ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
        file.seek(0, 2)  # เลื่อนไปท้ายไฟล์
        file_size = file.tell()
        file.seek(0)  # กลับไปต้นไฟล์
        
        max_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_size:
            return jsonify({"error": "ไฟล์ใหญ่เกินไป (สูงสุด 5MB)"}), 400
        
        # สร้างชื่อไฟล์ใหม่เพื่อป้องกันการซ้ำกัน
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        filename = f"product_{timestamp}_{secure_filename(file.filename)}"
        
        # บันทึกไฟล์ในโฟลเดอร์ products
        file_path = PRODUCTS_UPLOAD_DIR / filename
        file.save(str(file_path))
        
        # สร้าง URL สำหรับเข้าถึงไฟล์
        image_url = f"/api/products/images/{filename}"
        
        print(f"✅ Product image uploaded: {filename} ({file_size} bytes)")
        
        return jsonify({
            "success": True,
            "imageUrl": image_url,
            "filename": filename,
            "size": file_size
        })
        
    except Exception as e:
        print(f"❌ Error uploading product image: {e}")
        return jsonify({"error": f"เกิดข้อผิดพลาดในการอัพโหลด: {str(e)}"}), 500

@app.route("/api/payment-settings", methods=["GET", "POST"])
def api_payment_settings():
    if request.method == "GET":
        settings = PaymentSettings.query.first()
        return jsonify({
            "qr_image": settings.qr_image if settings else "",
            "qr_label": settings.qr_label if settings else ""
        })
    else:
        data = request.json
        settings = PaymentSettings.query.first()
        if not settings:
            settings = PaymentSettings()
            db.session.add(settings)
        settings.qr_image = data.get("qr_image", "")
        settings.qr_label = data.get("qr_label", "")
        db.session.commit()
        return jsonify({"success": True})
# ✅ Serve product images
@app.route("/api/products/images/<filename>")
def serve_product_image(filename):
    try:
        return send_from_directory(str(PRODUCTS_UPLOAD_DIR), filename)
    except Exception as e:
        print(f"❌ Error serving product image: {e}")
        return jsonify({"error": "ไม่พบไฟล์รูปภาพ"}), 404

# ✅ Alternative route for uploads folder
@app.route("/uploads/products/<filename>")
def serve_uploads_product(filename):
    try:
        return send_from_directory(str(PRODUCTS_UPLOAD_DIR), filename)
    except Exception as e:
        print(f"❌ Error serving uploads image: {e}")
        return jsonify({"error": "ไม่พบไฟล์รูปภาพ"}), 404

# ✅ Upload QR Code endpoint
@app.post("/api/upload/qr")
def api_upload_qr_code():
    try:
        if 'image' not in request.files:
            return jsonify({"error": "ไม่พบไฟล์รูปภาพ"}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({"error": "ไม่ได้เลือกไฟล์"}), 400
        
        if not allowed_file(file.filename):
            return jsonify({"error": "ประเภทไฟล์ไม่รองรับ (รองรับ: PNG, JPG, JPEG, GIF, WebP)"}), 400
        
        # ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)
        
        max_size = 5 * 1024 * 1024  # 5MB
        if file_size > max_size:
            return jsonify({"error": "ไฟล์ใหญ่เกินไป (สูงสุด 5MB)"}), 400
        
        # สร้างชื่อไฟล์ใหม่เพื่อป้องกันการซ้ำกัน
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        filename = f"qr_{timestamp}_{secure_filename(file.filename)}"
        
        # บันทึกไฟล์ในโฟลเดอร์ qr_codes
        file_path = QR_UPLOAD_DIR / filename
        file.save(str(file_path))
        
        # สร้าง URL สำหรับเข้าถึงไฟล์
        image_url = f"/api/qr/images/{filename}"
        
        print(f"✅ QR Code uploaded: {filename} ({file_size} bytes)")
        
        return jsonify({
            "success": True,
            "imageUrl": image_url,
            "filename": filename,
            "size": file_size
        })
        
    except Exception as e:
        print(f"❌ Error uploading QR code: {e}")
        return jsonify({"error": f"เกิดข้อผิดพลาดในการอัพโหลด: {str(e)}"}), 500

# ✅ Serve QR Code images
@app.get("/api/qr/images/<filename>")
def serve_qr_image(filename):
    try:
        return send_from_directory(str(QR_UPLOAD_DIR), filename)
    except Exception as e:
        print(f"❌ Error serving QR image: {e}")
        return jsonify({"error": "ไม่พบไฟล์ QR Code"}), 404

# ✅ Upload slip endpoint
@app.post("/api/upload-slip")
def api_upload_slip():
    try:
        # สร้างชื่อไฟล์ใหม่
        order_id_raw = request.form.get('orderId', '0')
        try:
            order_id = int(order_id_raw)
        except ValueError:
            order_id = None
        # ตรวจสอบ order_id ต้องไม่เป็น None
        if order_id is None:
            return jsonify({"error": "order_id ห้ามว่าง"}), 400
        if 'slip' not in request.files:
            return jsonify({"error": "ไม่พบไฟล์สลิป"}), 400

        file = request.files['slip']
        if file.filename == '':
            return jsonify({"error": "ไม่ได้เลือกไฟล์"}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "ประเภทไฟล์ไม่รองรับ"}), 400

        # สร้างชื่อไฟล์ใหม่
        order_id_raw = request.form.get('orderId', '0')
        try:
            order_id = int(order_id_raw)
        except ValueError:
            order_id = None
        payment_id = request.form.get('paymentId')
        timestamp = request.form.get('timestamp', str(int(datetime.now().timestamp())))
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"slip_{order_id}_{timestamp}_{uuid.uuid4().hex[:8]}.{file_ext}"

        # บันทึกไฟล์
        filepath = UPLOAD_FOLDER / filename
        file.save(str(filepath))

        # Query payment ถ้ามี payment_id
        payment = None
        if payment_id:
            payment = Payment.query.get(int(payment_id)) if payment_id else None

        # เก็บข้อมูลในฐานข้อมูล
        slip = TransferSlip(
            order_id=order_id if order_id != 'temp' else None,
            payment_id=payment.id if payment else None,
            filename=filename,
            file_path=str(filepath),
            file_size=filepath.stat().st_size,
            mime_type=get_file_type(file.filename)
        )
        db.session.add(slip)
        db.session.commit()

        # สร้าง URL สำหรับสลิป (absolute)
        slip_url = abs_url_for('serve_slip', filename=filename)

        # เพิ่ม URL สลิปใน ref ของ Payment (ถ้ามี payment)
        if payment:
            payment.ref = json.dumps({"slipUrl": slip_url, "slipId": slip.id})
            db.session.commit()

        # ส่ง URL กลับ
        return jsonify({
            "success": True,
            "slipUrl": slip_url,
            "slipId": slip.id,
            "filename": filename
        })

    except Exception as e:
        print(f"Upload error: {e}")
        return jsonify({"error": f"เกิดข้อผิดพลาด: {str(e)}"}), 500

# ✅ Serve slip files
@app.get("/api/slips/<filename>")
def serve_slip(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({"error": "ไม่พบไฟล์"}), 404

# ✅ ADD: endpoint สำหรับดู users (เพื่อ debug)
@app.get("/api/users/debug")
def api_users_debug():
    users = User.query.all()
    return jsonify([{
        "id": u.id,
        "username": u.username,
        "password": u.password,  # แสดงรหัสผ่านเพื่อ debug (ไม่ควรใช้ใน production)
        "role": u.role,
        "name": u.name,
        "active": u.active
    } for u in users])

# ✅ ADD: Users CRUD API endpoints
@app.get("/api/users")
def api_users_list():
    if DATABASE_ENABLED and db:
        try:
            users = User.query.all()
            return jsonify([{
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "name": u.name,
                "active": u.active,
                "phone": u.phone,
                "email": u.email,
                "perms": u.perms or []
            } for u in users])
        except Exception as e:
            print(f"Database error: {e}")
    
    # Fallback to memory storage
    return jsonify(MEMORY_STORAGE["users"])

@app.post("/api/users")
def api_users_create():
    data = request.get_json()
    
    if DATABASE_ENABLED and db:
        try:
            # ตรวจสอบ username ซ้ำ
            existing = User.query.filter_by(username=data['username']).first()
            if existing:
                return jsonify({"error": "ชื่อผู้ใช้นี้มีอยู่แล้ว"}), 400
            
            # จัดการ password - ถ้าส่ง passwordHash มาให้ใช้ตรงๆ ถ้าส่ง password มาให้ hash
            password_data = data.get('passwordHash') or data.get('password', '')
            if password_data and not password_data.startswith('sha256:'):
                # ถ้าเป็น plain text ให้ hash
                password_data = make_password_hash(password_data)
            
            user = User(
                username=data['username'],
                password=password_data,
                role=data.get('role', 'STAFF'),
                name=data['name'],
                active=data.get('active', True),
                phone=data.get('phone', ''),
                email=data.get('email', ''),
                perms=data.get('perms', [])
            )
            
            db.session.add(user)
            db.session.commit()
            
            return jsonify({
                "success": True,
                "id": user.id,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": user.role,
                    "name": user.name,
                    "active": user.active,
                    "phone": user.phone,
                    "email": user.email,
                    "perms": user.perms or []
                }
            })
        except Exception as e:
            print(f"Database error: {e}")
    
    # Fallback to memory storage
    # ตรวจสอบ username ซ้ำ
    if any(u['username'] == data['username'] for u in MEMORY_STORAGE["users"]):
        return jsonify({"error": "ชื่อผู้ใช้นี้มีอยู่แล้ว"}), 400
    
    new_user = {
        "id": MEMORY_STORAGE["next_ids"]["user"],
        "username": data['username'],
        "password": data.get('passwordHash', data.get('password', '')),
        "role": data.get('role', 'STAFF'),
        "name": data['name'],
        "active": data.get('active', True),
        "phone": data.get('phone', ''),
        "email": data.get('email', ''),
        "perms": data.get('perms', [])
    }
    
    MEMORY_STORAGE["users"].append(new_user)
    MEMORY_STORAGE["next_ids"]["user"] += 1
    
    return jsonify({
        "success": True,
        "id": new_user["id"],
        "user": new_user
    })

@app.put("/api/users/<int:uid>")
def api_users_update(uid):
    data = request.get_json()
    
    if DATABASE_ENABLED and db:
        try:
            user = User.query.get_or_404(uid)
            
            # ตรวจสอบ username ซ้ำ (ยกเว้นตัวเอง)
            if 'username' in data:
                existing = User.query.filter(User.username == data['username'], User.id != uid).first()
                if existing:
                    return jsonify({"error": "ชื่อผู้ใช้นี้มีอยู่แล้ว"}), 400
                user.username = data['username']
            
            # จัดการ password update
            if 'passwordHash' in data and data['passwordHash']:
                # ถ้าส่ง passwordHash มาแล้วให้ใช้ตรงๆ
                user.password = data['passwordHash']
            elif 'password' in data and data['password']:
                # ถ้าส่ง password มาให้ hash ก่อน
                user.password = make_password_hash(data['password'])
                
            if 'role' in data:
                user.role = data['role']
            if 'name' in data:
                user.name = data['name']
            if 'active' in data:
                user.active = data['active']
            if 'phone' in data:
                user.phone = data['phone']
            if 'email' in data:
                user.email = data['email']
            if 'perms' in data:
                user.perms = data['perms']
            
            db.session.commit()
            
            return jsonify({
                "success": True,
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "role": user.role,
                    "name": user.name,
                    "active": user.active,
                    "phone": user.phone,
                    "email": user.email,
                    "perms": user.perms or []
                }
            })
        except Exception as e:
            print(f"Database error: {e}")
    
    # Fallback to memory storage
    user_index = None
    for i, u in enumerate(MEMORY_STORAGE["users"]):
        if u["id"] == uid:
            user_index = i
            break
    
    if user_index is None:
        return jsonify({"error": "ไม่พบผู้ใช้งาน"}), 404
    
    # ตรวจสอบ username ซ้ำ (ยกเว้นตัวเอง)
    if 'username' in data:
        if any(u['username'] == data['username'] and u['id'] != uid for u in MEMORY_STORAGE["users"]):
            return jsonify({"error": "ชื่อผู้ใช้นี้มีอยู่แล้ว"}), 400
    
    user = MEMORY_STORAGE["users"][user_index]
    
    # อัพเดทข้อมูล
    if 'username' in data:
        user['username'] = data['username']
    if 'passwordHash' in data and data['passwordHash']:
        user['password'] = data['passwordHash']
    elif 'password' in data and data['password']:
        user['password'] = data['password']
    if 'role' in data:
        user['role'] = data['role']
    if 'name' in data:
        user['name'] = data['name']
    if 'active' in data:
        user['active'] = data['active']
    if 'phone' in data:
        user['phone'] = data['phone']
    if 'email' in data:
        user['email'] = data['email']
    if 'perms' in data:
        user['perms'] = data['perms']
    
    return jsonify({
        "success": True,
        "user": user
    })

@app.delete("/api/users/<int:uid>")
def api_users_delete(uid):
    if DATABASE_ENABLED and db:
        try:
            user = User.query.get_or_404(uid)
            
            # ป้องกันการลบ admin สุดท้าย
            admin_count = User.query.filter_by(role='ADMIN', active=True).count()
            if user.role == 'ADMIN' and admin_count <= 1:
                return jsonify({"error": "ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้"}), 400
            
            db.session.delete(user)
            db.session.commit()
            
            return jsonify({"success": True})
        except Exception as e:
            print(f"Database error: {e}")
    
    # Fallback to memory storage
    user_index = None
    user_to_delete = None
    for i, u in enumerate(MEMORY_STORAGE["users"]):
        if u["id"] == uid:
            user_index = i
            user_to_delete = u
            break
    
    if user_index is None:
        return jsonify({"error": "ไม่พบผู้ใช้งาน"}), 404
    
    # ป้องกันการลบ admin สุดท้าย
    admin_count = sum(1 for u in MEMORY_STORAGE["users"] if u["role"] == "ADMIN" and u["active"])
    if user_to_delete["role"] == "ADMIN" and admin_count <= 1:
        return jsonify({"error": "ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้"}), 400
    
    MEMORY_STORAGE["users"].pop(user_index)
    return jsonify({"success": True})

# ✅ ADD: products
@app.get("/api/products")
def api_products_list():
    return jsonify([json_product(p) for p in Product.query.order_by(Product.id.desc()).all()])

@app.post("/api/products")
def api_products_create():
    data = request.get_json(force=True)
    existing = Product.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Product already exists'}), 400
    
    p = Product(
        name=data["name"], price=data.get("price",0), category=data["category"], stock=data.get("stock",0),
        active=bool(data.get("active",True)), color=data.get("color"), image=data.get("image")
    )
    db.session.add(p); db.session.commit()
    return jsonify(json_product(p)), 201

@app.put("/api/products/<int:pid>")
def api_products_update(pid):
    p = Product.query.get_or_404(pid)
    d = request.get_json(force=True)
    p.name = d.get("name", p.name)
    p.price = d.get("price", p.price)
    p.category = d.get("category", p.category)
    p.stock = d.get("stock", p.stock)
    p.active = d.get("active", p.active)
    p.color = d.get("color", p.color)
    p.image = d.get("image", p.image)
    db.session.commit()
    return jsonify(json_product(p))

@app.delete("/api/products/<int:pid>")
def api_products_delete(pid):
    try:
        p = Product.query.get_or_404(pid)
        
        # ลบไฟล์รูปภาพถ้ามี
        if p.image:
            try:
                # แยกชื่อไฟล์จาก path/URL
                filename = p.image.split('/')[-1] if '/' in p.image else p.image
                image_path = PRODUCTS_UPLOAD_DIR / filename
                if image_path.exists():
                    image_path.unlink()
                    print(f"✅ Deleted product image: {filename}")
            except Exception as e:
                print(f"⚠️ Error deleting product image: {e}")
        
        # ลบข้อมูลจากฐานข้อมูล
        product_name = p.name
        db.session.delete(p)
        db.session.commit()
        
        print(f"✅ Product deleted: {product_name} (ID: {pid})")
        return jsonify({"success": True, "message": f"ลบสินค้า '{product_name}' สำเร็จ"})
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error deleting product {pid}: {e}")
        return jsonify({"error": f"เกิดข้อผิดพลาดในการลบสินค้า: {str(e)}"}), 500

# ✅ ADD: color prices
@app.get("/api/color-prices")
def api_color_prices_get():
    rows = ColorPrice.query.all()
    return jsonify({r.color: float(r.price) for r in rows})

@app.put("/api/color-prices")
def api_color_prices_put():
    data = request.get_json(force=True) or {}
    for color, price in data.items():
        row = ColorPrice.query.get(color)
        if not row: row = ColorPrice(color=color, price=price); db.session.add(row)
        else: row.price = price
    db.session.commit()
    return jsonify({"ok": True})

# ✅ ADD: orders + payments (ย่อ)
@app.get("/api/orders")
def api_orders_list():
    rows = Order.query.filter_by(paid=True).order_by(Order.created_at.desc()).all()
    out = []
    for o in rows:
        # 1) ดึงการจ่ายจากตารางจริง
        pays_tbl = (Payment.query
                    .filter_by(order_id=o.id)
                    .order_by(Payment.time.asc())
                    .all())

        # 2) แนบสลิปต่อ payment_id
        slips_by_payment = {}
        slips = TransferSlip.query.filter_by(order_id=o.id).all()
        for s in slips:
            # ตรวจสอบชื่อไฟล์จริงใน uploads/slips
            fname = Path(s.file_path).name
            file_path = UPLOAD_FOLDER / fname
            if file_path.exists():
                slip_url = abs_url_for('serve_slip', filename=fname)
            else:
                slip_url = None
            slips_by_payment.setdefault(s.payment_id or 0, []).append({
                "slipUrl": slip_url,
                "name": s.filename,
                "uploadTime": s.upload_time.isoformat(),
                "size": s.file_size,
                "mimeType": s.mime_type,
                "slipId": s.id,
            })

        # 3) แปลงเป็นโครงสร้างที่ frontend ใช้
        payments_out = []
        for p in pays_tbl:
            slips_for_p = slips_by_payment.get(p.id, [])
            # เผื่อ ref เก่าที่เก็บ slipUrl ไว้ใน JSON
            if p.ref:
                try:
                    ref_data = json.loads(p.ref) if isinstance(p.ref, str) else p.ref
                    if isinstance(ref_data, dict):
                        if "slips" in ref_data:
                            for s in ref_data["slips"]:
                                if s.get("slipUrl"):
                                    slips_for_p.append(s)
                        elif "slipUrl" in ref_data:
                            slips_for_p.append({"slipUrl": ref_data["slipUrl"]})
                except Exception:
                    pass

            # เพิ่ม qrImageUrl สำหรับ payment ที่ method เป็น qr
            qr_image_url = None
            if p.method == "qr":
                # สมมติว่า ref มี qrImageUrl หรือ slipUrl
                if p.ref:
                    try:
                        ref_data = json.loads(p.ref) if isinstance(p.ref, str) else p.ref
                        if isinstance(ref_data, dict):
                            if "qrImageUrl" in ref_data:
                                qr_image_url = ref_data["qrImageUrl"]
                            elif "slipUrl" in ref_data:
                                qr_image_url = ref_data["slipUrl"]
                    except Exception:
                        pass
                # หรือแนบจาก transferSlips ตัวแรก
                if not qr_image_url and slips_for_p:
                    qr_image_url = slips_for_p[0].get("slipUrl")

            payments_out.append({
                "id": p.id,
                "method": p.method,
                "amount": float(p.amount),
                "received": float(p.received),
                "change": float(p.change),
                "time": p.time.isoformat(),
                "ref": p.ref,
                "transferSlips": slips_for_p,
                "qrImageUrl": qr_image_url,
            })

        out.append({
            "id": o.id,
            "createdAt": o.created_at.isoformat(),
            "items": o.items,
            "persons": o.persons,
            "splitMode": o.split_mode,
            "payments": payments_out,
            "paid": o.paid,
            "paidAt": o.paid_at.isoformat() if o.paid_at else None,
            "channel": o.channel,
            "store": o.store,
            "subtotal": float(o.subtotal),
            "discount": float(o.discount),
            "service": float(o.service),
            "vat": float(o.vat),
            "total": float(o.total),
            "totalPaid": sum(float(p.amount) for p in pays_tbl)
        })
    return jsonify(out)

@app.post("/api/orders")
def api_orders_create():
    d = request.get_json(force=True)
    o = Order(
      items=d["items"], persons=d.get("persons",1), split_mode=d.get("splitMode","NONE"),
      payments=d.get("payments",[]), paid=bool(d.get("paid",False)),
      paid_at=(datetime.utcnow() if d.get("paid") else None),
      channel=d.get("channel"), store=d.get("store"),
      subtotal=d.get("subtotal",0), discount=d.get("discount",0),
      service=d.get("service",0), vat=d.get("vat",0), total=d["total"]
    )
    db.session.add(o); db.session.commit()
    return jsonify({"id":o.id}), 201

@app.post("/api/orders/<int:oid>/payments")
def api_orders_add_payment(oid):
    o = Order.query.get_or_404(oid)
    d = request.get_json(force=True)
    
    # เตรียมข้อมูล ref สำหรับ QR payment
    ref_data = d.get("ref")
    if d["method"] == "qr" and d.get("transferSlips"):
        # เก็บข้อมูลสลิปใน ref เป็น JSON string
        slip_info = []
        for slip_data in d["transferSlips"]:
            slip_info.append({
                "name": slip_data.get("name"),
                "slipUrl": slip_data.get("slipUrl"),
                "uploadTime": slip_data.get("uploadTime"),
                "size": slip_data.get("size")
            })
        ref_data = json.dumps({"slips": slip_info})
    
    # บันทึกข้อมูลการชำระ
    pay = Payment(
        order_id=oid, 
        method=d["method"], 
        amount=d["amount"],
        received=d.get("received", d["amount"]), 
        change=d.get("change", 0), 
        ref=ref_data  # เก็บข้อมูลสลิปใน ref
    )
    db.session.add(pay)
    db.session.flush()  # เพื่อให้ได้ pay.id
    
    # บันทึกสลิปการโอน (ถ้ามี) - เชื่อมโยงกับ payment
    if d.get("transferSlips"):
        for slip_data in d["transferSlips"]:
            if slip_data.get("slipId"):
                # อัปเดต slip ที่มีอยู่แล้ว
                slip = TransferSlip.query.get(slip_data["slipId"])
                if slip:
                    slip.payment_id = pay.id
                    slip.order_id = oid
    
    # อัปเดตสถานะบิล - ตรวจสอบจากทั้ง payments table และ orders.payments JSONB
    pays_from_table = Payment.query.filter_by(order_id=oid).all() + [pay]
    total_from_table = sum(float(x.amount) for x in pays_from_table)
    
    # ตรวจสอบจาก JSONB field ด้วย (เป็น backup)
    existing_payments = o.payments or []
    total_from_jsonb = sum(float(p.get('amount', 0)) for p in existing_payments)
    
    # ใช้ยอดที่มากกว่าเป็นหลัก
    total_paid = max(total_from_table, total_from_jsonb)
    
    print(f"💰 Order {oid}: Table total = {total_from_table}, JSONB total = {total_from_jsonb}, Order total = {float(o.total)}")
    
    if total_paid + 1e-6 >= float(o.total):
        o.paid = True; o.paid_at = datetime.utcnow()
        print(f"✅ Order {oid} marked as PAID")
    else:
        print(f"⏳ Order {oid} still PENDING ({total_paid}/{float(o.total)})")
    
    db.session.commit()
    return jsonify({"ok": True, "paymentId": pay.id})

# ✅ Get slips for order (จากคอลัมน์ ref ของ payments)
@app.get("/api/orders/<int:oid>/slips")
def api_orders_slips(oid):
    # ดูจาก TransferSlip table (ถ้ามี)
    slips_from_table = TransferSlip.query.filter_by(order_id=oid).all()
    slip_list = [{
        "id": s.id,
        "filename": s.filename,
        "fileSize": s.file_size,
        "mimeType": s.mime_type,
        "uploadTime": s.upload_time.isoformat(),
        "url": f"/api/slips/{Path(s.file_path).name}"
    } for s in slips_from_table]
    
    # ดูจากคอลัมน์ ref ของ payments
    payments = Payment.query.filter_by(order_id=oid).all()
    for payment in payments:
        if payment.ref:
            try:
                # ลองแปลง ref เป็น JSON
                ref_data = json.loads(payment.ref)
                if isinstance(ref_data, dict) and "slips" in ref_data:
                    for slip in ref_data["slips"]:
                        slip_list.append({
                            "paymentId": payment.id,
                            "filename": slip.get("name"),
                            "fileSize": slip.get("size"),
                            "uploadTime": slip.get("uploadTime"),
                            "url": slip.get("slipUrl")
                        })
            except (json.JSONDecodeError, TypeError):
                # ถ้า ref ไม่ใช่ JSON ให้แสดงเป็น text reference
                pass
    
    return jsonify(slip_list)

# ---------- ANNOUNCEMENTS ----------
@app.get("/api/announcements")
def api_announcements_list():
    only_active = (request.args.get("active") == "1")
    q = Announcement.query
    if only_active:
        q = q.filter_by(active=True)
    rows = q.order_by(Announcement.created_at.desc()).all()
    return jsonify([json_announcement(a) for a in rows])

@app.post("/api/announcements")
def api_announcements_create():
    d = request.get_json(force=True) or {}
    if not (d.get("title") or "").strip():
        return jsonify({"error": "title required"}), 400
    a = Announcement(
        title=(d["title"]).strip(),
        body=(d.get("body") or "").strip(),
        image=(d.get("image") or None),
        published_at=(datetime.fromisoformat(d["publishedAt"]) if d.get("publishedAt") else None),
        active=bool(d.get("active", True)),
    )
    db.session.add(a)
    db.session.commit()
    return jsonify(json_announcement(a)), 201

@app.put("/api/announcements/<int:aid>")
def api_announcements_update(aid):
    a = Announcement.query.get_or_404(aid)
    d = request.get_json(force=True) or {}
    if "title" in d:        a.title = (d.get("title") or "").strip() or a.title
    if "body" in d:         a.body = (d.get("body") or "").strip()
    if "image" in d:        a.image = (d.get("image") or None)
    if "publishedAt" in d:  a.published_at = (datetime.fromisoformat(d["publishedAt"]) if d.get("publishedAt") else None)
    if "active" in d:       a.active = bool(d.get("active"))
    db.session.commit()
    return jsonify(json_announcement(a))

@app.delete("/api/announcements/<int:aid>")
def api_announcements_delete(aid):
    a = Announcement.query.get_or_404(aid)
    db.session.delete(a)
    db.session.commit()
    return jsonify({"ok": True})


# ---------- DRAW / UTILS ----------
def draw(bgr, dets):
    color_map = {
        "red": (36, 36, 255),
        "green": (58, 181, 75),
        "blue": (255, 106, 77),
        "pink": (203, 192, 255),
        "purple": (237, 130, 237),
    }
    canvas = bgr.copy()
    for d in dets:
        x1, y1, x2, y2 = map(int, d["box"])
        label = d["label"]; conf = d["confidence"]
        color = color_map.get(label, (255, 255, 255))
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)
        cv2.putText(canvas, f"{label} {conf:.2f}", (x1, max(0, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
    ok, buf = cv2.imencode(".png", canvas)
    return base64.b64encode(buf.tobytes()).decode("utf-8")

def dedupe_by_center(dets, thr=0.45):
    def center(b):
        x1,y1,x2,y2 = b
        return ((x1+x2)/2.0, (y1+y2)/2.0, max(x2-x1, y2-y1))
    out = []
    for d in sorted(dets, key=lambda x: -x["confidence"]):
        cx,cy,s = center(d["box"])
        keep = True
        for e in out:
            ex,ey,es = center(e["box"])
            dist = ((cx-ex)**2 + (cy-ey)**2) ** 0.5
            if dist < thr * min(s, es):
                keep = False
                break
        if keep:
            out.append(d)
    return out

def tighten_roi_by_dets(dets, rx1, ry1, rx2, ry2, pad_ratio=0.12, min_boxes=6):
    if len(dets) < min_boxes:
        return (rx1, ry1, rx2, ry2), False
    xs1, ys1, xs2, ys2 = [], [], [], []
    for d in dets:
        x1,y1,x2,y2 = d["box"]
        xs1.append(x1); ys1.append(y1); xs2.append(x2); ys2.append(y2)
    x1 = int(np.percentile(xs1, 5));  y1 = int(np.percentile(ys1, 5))
    x2 = int(np.percentile(xs2, 95)); y2 = int(np.percentile(ys2, 95))
    w = max(1, x2-x1); h = max(1, y2-y1)
    padx, pady = int(w*pad_ratio), int(h*pad_ratio)
    x1 -= padx; y1 -= pady; x2 += padx; y2 += pady
    x1 = max(rx1, x1); y1 = max(ry1, y1)
    x2 = min(rx2, x2); y2 = min(ry2, y2)
    area_old = (rx2-rx1)*(ry2-ry1); area_new = max(1,(x2-x1)*(y2-y1))
    changed = area_new <= area_old * 0.9
    return (x1, y1, x2, y2), changed

def refine_roi_with_color_mask(bgr, roi, sv_min=60):
    rx1, ry1, rx2, ry2 = roi
    crop = bgr[ry1:ry2, rx1:rx2]
    if crop.size == 0:
        return roi, False
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mask = np.zeros(crop.shape[:2], np.uint8)
    for ranges in RANGES.values():
        for (h1,s1,v1,h2,s2,v2) in ranges:
            m = cv2.inRange(hsv, (h1, max(s1, sv_min), max(v1, sv_min)), (h2, 255, 255))
            mask |= m
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  np.ones((7,7), np.uint8), 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9,9), np.uint8), 2)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return roi, False
    c = max(cnts, key=cv2.contourArea)
    x,y,w,h = cv2.boundingRect(c)
    pad = int(0.10 * max(w,h))
    nx1 = rx1 + max(0, x - pad); ny1 = ry1 + max(0, y - pad)
    nx2 = rx1 + min(crop.shape[1], x + w + pad)
    ny2 = ry1 + min(crop.shape[0], y + h + pad)
    area_old = (rx2-rx1)*(ry2-ry1); area_new = max(1,(nx2-nx1)*(ny2-ny1))
    changed = area_new <= area_old * 0.9
    return (nx1, ny1, nx2, ny2), changed

def _largest_color_blob_bbox(bgr):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H,S,V = hsv[...,0], hsv[...,1], hsv[...,2]
    mask = ((S>60) & (V>60)).astype(np.uint8)*255
    mask = cv2.medianBlur(mask,5)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9,9),np.uint8), 2)
    cnts,_ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        h,w = bgr.shape[:2]
        return (0,0,w,h)
    x,y,w,h = cv2.boundingRect(max(cnts, key=cv2.contourArea))
    return (x,y,x+w,y+h)

def _square_from_center(cx, cy, half, W, H):
    x1 = int(max(0, cx - half)); y1 = int(max(0, cy - half))
    x2 = int(min(W, cx + half));  y2 = int(min(H, cy + half))
    s = min(x2-x1, y2-y1)
    x2 = x1 + s; y2 = y1 + s
    return (x1,y1,x2,y2)

def pad_roi(x1, y1, x2, y2, W, H, pad_frac=0.0):
    if pad_frac <= 0: return (x1, y1, x2, y2)
    w = max(1, x2-x1); h = max(1, y2-y1)
    px, py = int(w*pad_frac), int(h*pad_frac)
    return (max(0, x1-px), max(0, y1-py), min(W, x2+px), min(H, y2+py))

def _predict_on_roi(model, arr_bgr_full, roi):
    rx1,ry1,rx2,ry2 = roi
    crop_bgr = arr_bgr_full[ry1:ry2, rx1:rx2]
    res = model.predict(
        Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)),
        conf=CONF, iou=IOU, imgsz=IMG, verbose=False
    )[0]
    dets = []
    if res.boxes is not None and len(res.boxes.xyxy)>0:
        for xyxy, cls, conf in zip(res.boxes.xyxy.cpu().numpy(),
                                   res.boxes.cls.cpu().numpy(),
                                   res.boxes.conf.cpu().numpy()):
            x1c,y1c,x2c,y2c = xyxy.tolist()
            dets.append({
                "box":[rx1+x1c, ry1+y1c, rx1+x2c, ry1+y2c],
                "cls": int(cls), "conf": float(conf)
            })
    return dets, res

def _score_dets(dets, roi):
    rx1,ry1,rx2,ry2 = roi
    w = max(1.0, rx2-rx1); h = max(1.0, ry2-ry1)
    area_roi = w*h
    if not dets: return -1e9
    sum_conf = sum(d["conf"] for d in dets)
    n = len(dets)
    area_boxes = 0.0; edge_touch = 0
    for d in dets:
        x1,y1,x2,y2 = d["box"]
        area_boxes += max(0,(x2-x1)) * max(0,(y2-y1))
        if (x1-rx1)/w < EDGE_MARGIN or (ry2-y2)/h < EDGE_MARGIN \
           or (y1-ry1)/h < EDGE_MARGIN or (rx2-x2)/w < EDGE_MARGIN:
            edge_touch += 1
    density = area_boxes / area_roi
    p_edge = 0.7 * edge_touch
    p_dense = 0.0
    if density < DENSITY_TGT_MIN: p_dense = (DENSITY_TGT_MIN - density) * 25
    if density > DENSITY_TGT_MAX: p_dense = (density - DENSITY_TGT_MAX) * 25
    return (sum_conf + 0.35*n) - (p_edge + p_dense)

def pick_best_roi(arr_bgr_full, user_roi=None):
    H,W = arr_bgr_full.shape[:2]
    if user_roi:
        x1,y1,x2,y2 = user_roi
    else:
        x1,y1,x2,y2 = _largest_color_blob_bbox(arr_bgr_full)
    cx = (x1+x2)/2.0; cy = (y1+y2)/2.0
    base_half = max(x2-x1, y2-y1) / 2.0
    candidates = [_square_from_center(cx, cy, base_half*s, W, H) for s in ROI_SCALES]
    best_roi, best_res, best_dets = None, None, None
    best_score = -1e9
    for roi in candidates:
        dets, res = _predict_on_roi(model, arr_bgr_full, roi)
        score = _score_dets(dets, roi)
        if score > best_score:
            best_score, best_roi, best_res, best_dets = score, roi, res, dets
    return best_roi, best_res, best_dets

# ---------- COLOR CLASSIFY ----------
def gray_world_wb(bgr):
    b,g,r = cv2.split(bgr.astype(np.float32))
    kb,kg,kr = b.mean(), g.mean(), r.mean()
    k = (kb+kg+kr)/3.0
    b = np.clip(b * (k/(kb+1e-6)), 0, 255)
    g = np.clip(g * (k/(kg+1e-6)), 0, 255)
    r = np.clip(r * (k/(kr+1e-6)), 0, 255)
    return cv2.merge([b,g,r]).astype(np.uint8)

def enhance_l_channel(bgr):
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L,a,b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    L = clahe.apply(L)
    lab = cv2.merge([L,a,b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

def center_disc_mask(h, w, shrink=CENTER_SHRINK):
    cy, cx = h/2.0, w/2.0
    r = min(h,w) * 0.5 * float(shrink)
    yy, xx = np.ogrid[:h, :w]
    return (((xx-cx)**2 + (yy-cy)**2) <= r*r).astype(np.uint8)

RANGES = {
    "red":    [(0, SV_MIN, SV_MIN, 10, 255, 255), (170, SV_MIN, SV_MIN, 180, 255, 255)],
    "green":  [(45, SV_MIN, SV_MIN, 85, 255, 255)],
    "blue":   [(100, SV_MIN, SV_MIN, 130, 255, 255)],
    "purple": [(130, max(30,SV_MIN-10), max(30,SV_MIN-10), 155, 255, 255)],
    "pink":   [(140, SV_MIN, SV_MIN, 170, 255, 255)],
}

CENTERS_LAB = {
    "red":    np.array([60,   80,  40]),
    "green":  np.array([70,  -60,  60]),
    "blue":   np.array([35,   20, -60]),
    "purple": np.array([45,   60, -35]),
    "pink":   np.array([70,   70,  10]),
}
def classify_color(bgr_crop):
    bgr = enhance_l_channel(gray_world_wb(bgr_crop))
    h, w = bgr.shape[:2]
    mcenter = center_disc_mask(h, w, CENTER_SHRINK)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    S, V = hsv[...,1], hsv[...,2]
    good = (S >= SV_MIN) & (V >= SV_MIN) & (mcenter > 0)
    total_good = int(good.sum())
    if total_good < MIN_PIXELS:
        return None, 0.0
    hsv_frac = {}
    for name, ranges in RANGES.items():
        mm = np.zeros((h,w), np.uint8)
        for (h1,s1,v1,h2,s2,v2) in ranges:
            mm |= cv2.inRange(hsv, (h1,s1,v1), (h2,s2,v2))
        hsv_frac[name] = float((mm>0)[good].sum()) / float(total_good)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L,A,B = cv2.split(lab)
    pts = np.stack([L[good], A[good], B[good]], axis=1).astype(np.float32)
    lab_score = {}
    for name, c in CENTERS_LAB.items():
        d = np.linalg.norm(pts - c[None,:], axis=1).mean()
        lab_score[name] = float(np.exp(-d/30.0))
    scores = {k: 0.6*hsv_frac[k] + 0.4*lab_score[k] for k in RANGES.keys()}
    best = max(scores.items(), key=lambda x: x[1])
    return best[0], float(best[1])

ALIASES = {"แดง":"red", "เขียว":"green", "น้ำเงิน":"blue", "ฟ้า":"blue", "ชมพู":"pink", "ม่วง":"purple"}
def norm_label(s: str) -> str:
    return ALIASES.get(str(s).strip().lower(), str(s).strip().lower())

def filter_dets_inside(dets, roi, shrink=0.02):
    x1, y1, x2, y2 = roi
    w, h = max(1, x2-x1), max(1, y2-y1)
    ax1 = x1 + int(w*shrink); ay1 = y1 + int(h*shrink)
    ax2 = x2 - int(w*shrink); ay2 = y2 - int(h*shrink)
    out = []
    for d in dets:
        bx1, by1, bx2, by2 = d["box"]
        cx = (bx1+bx2)/2.0; cy = (by1+by2)/2.0
        if ax1 <= cx <= ax2 and ay1 <= cy <= ay2:
            out.append(d)
    return out

# ---------- HEALTH ----------
@app.get("/health")
@app.get("/api/health")
def health():
    return jsonify({"ok": model is not None, "model": MODEL_PATH, "conf": CONF, "iou": IOU, "img": IMG})

# ---------- DETECT ----------
@app.post("/detect")
@app.post("/api/detect")
def detect():
    if model is None:
        return jsonify({"error": "model not loaded"}), 500

    f = request.files.get("image") or request.files.get("file")
    if not f:
        return jsonify({"error": "file field required (image or file)"}), 400

    try:
        # แก้ EXIF (iPhone) แล้วค่อย convert RGB
        img = Image.open(f.stream)
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception:
        return jsonify({"error": "invalid image"}), 400

    arr_bgr_full = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    H, W = arr_bgr_full.shape[:2]

    # --- รับ bbox จากเว็บเป็น user_roi (ถ้ามี) ---
    user_roi = None
    bbox_raw = request.form.get("bbox") or request.args.get("bbox")
    if bbox_raw:
        try:
            if bbox_raw.strip().startswith('['):
                vals = json.loads(bbox_raw)
            else:
                vals = bbox_raw.split(',')
            x1, y1, x2, y2 = [int(float(v)) for v in vals]
            x1 = max(0, min(W-1, x1)); x2 = max(0, min(W, x2))
            y1 = max(0, min(H-1, y1)); y2 = max(0, min(H, y2))
            if x2 > x1 + 5 and y2 > y1 + 5:
                user_roi = (x1, y1, x2, y2)
        except Exception:
            user_roi = None

    # --- เลือก ROI ---
    if user_roi and RESPECT_USER_ROI:
        rx1, ry1, rx2, ry2 = pad_roi(*user_roi, W=W, H=H, pad_frac=USER_PAD)
        dets_raw, res = _predict_on_roi(model, arr_bgr_full, (rx1, ry1, rx2, ry2))
    else:
        (rx1, ry1, rx2, ry2), res, dets_raw = pick_best_roi(arr_bgr_full, user_roi=user_roi)

    # --- map ชื่อคลาสรอบแรก ---
    names = res.names if getattr(res, "names", None) else model.names
    if isinstance(names, dict):
        names = [names[k] for k in sorted(names.keys())]

    dets = []
    for d in dets_raw:
        x1, y1, x2, y2 = d["box"]
        idx = d["cls"]
        label = names[idx] if idx < len(names) else str(idx)
        dets.append({"label": norm_label(label), "confidence": d["conf"], "box": [x1, y1, x2, y2]})

    # ----- บีบ/ปรับ ROI เฉพาะเมื่อ "ไม่ได้" ล็อกกรอบผู้ใช้ -----
    if not (RESPECT_USER_ROI and user_roi):
        roi2, changed = tighten_roi_by_dets(dets, rx1, ry1, rx2, ry2, pad_ratio=0.12, min_boxes=6)
        if not changed:
            roi2, changed = refine_roi_with_color_mask(arr_bgr_full, (rx1, ry1, rx2, ry2), sv_min=SV_MIN)
        if changed:
            rx1, ry1, rx2, ry2 = roi2
            dets_raw2, res2 = _predict_on_roi(model, arr_bgr_full, (rx1, ry1, rx2, ry2))
            names2 = res2.names if getattr(res2, "names", None) else model.names
            if isinstance(names2, dict):
                names2 = [names2[k] for k in sorted(names2.keys())]
            dets = []
            for d in dets_raw2:
                x1, y1, x2, y2 = d["box"]
                idx = d["cls"]
                label = names2[idx] if idx < len(names2) else str(idx)
                dets.append({"label": norm_label(label), "confidence": d["conf"], "box": [x1, y1, x2, y2]})

    # ----- กรองให้อยู่ในกรอบผู้ใช้จริง ๆ ถ้ามีและเปิด respect -----
    if RESPECT_USER_ROI and user_roi:
        dets = filter_dets_inside(dets, (rx1, ry1, rx2, ry2), shrink=0.03)

    # ----- post-process สี + รวมกล่องซ้ำ -----
    for d in dets:
        x1, y1, x2, y2 = map(int, d["box"])
        crop = arr_bgr_full[max(0, y1):max(0, y2), max(0, x1):max(0, x2)]
        if crop.size == 0:
            continue
        best_color, score = classify_color(crop)
        if best_color and score >= COLOR_OVERRIDE_MIN and d["confidence"] < MODEL_TRUST:
            d["label"] = best_color

    dets = dedupe_by_center(dets, thr=0.45)

    # ----- นับผล/วาดภาพ -----
    counts = {}
    for d in dets:
        counts[d["label"]] = counts.get(d["label"], 0) + 1

    canvas = arr_bgr_full.copy()
    cv2.rectangle(canvas, (rx1, ry1), (rx2, ry2), (0, 200, 0), 2)
    if user_roi:
        ux1, uy1, ux2, uy2 = user_roi
        cv2.rectangle(canvas, (ux1, uy1), (ux2, uy2), (0, 255, 255), 2)

    b64 = draw(canvas, dets)

    return jsonify({
        "counts": counts,
        "total_items": sum(counts.values()),
        "detections": dets,
        "roi": {"x1": rx1, "y1": ry1, "x2": rx2, "y2": ry2},
        "annotated": b64
    })

# ---------- RUN ----------
if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("MALA_PORT", "8000")))
    print("URL Map:", app.url_map)
    print(f"Server listening on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
