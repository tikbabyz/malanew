from app.database import db
from datetime import datetime, timezone
from sqlalchemy.dialects.mysql import JSON, BIGINT, DECIMAL, TEXT, VARCHAR, BOOLEAN, DATETIME

class User(db.Model):
    __tablename__ = "users"
    
    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    username = db.Column(VARCHAR(100), unique=True, nullable=False, index=True)
    password = db.Column(TEXT)
    role = db.Column(VARCHAR(50), nullable=False)
    name = db.Column(VARCHAR(200))
    active = db.Column(BOOLEAN, nullable=False, default=True)
    phone = db.Column(VARCHAR(20))
    email = db.Column(VARCHAR(200))
    perms = db.Column(JSON, default=list)
    created_at = db.Column(DATETIME, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(DATETIME, onupdate=lambda: datetime.now(timezone.utc))

class Product(db.Model):
    __tablename__ = "products"
    
    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    name = db.Column(VARCHAR(200), nullable=False, index=True)
    price = db.Column(DECIMAL(12, 2), nullable=False, default=0)
    category = db.Column(VARCHAR(100), nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    active = db.Column(BOOLEAN, nullable=False, default=True)
    color = db.Column(VARCHAR(50))
    image = db.Column(TEXT)
    created_at = db.Column(DATETIME, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(DATETIME, onupdate=lambda: datetime.now(timezone.utc))

class ColorPrice(db.Model):
    __tablename__ = "color_prices"
    
    color = db.Column(VARCHAR(50), primary_key=True)
    price = db.Column(DECIMAL(12, 2), nullable=False)
    updated_at = db.Column(DATETIME, onupdate=lambda: datetime.now(timezone.utc))

class Order(db.Model):
    __tablename__ = "orders"
    
    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    created_at = db.Column(DATETIME, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    items = db.Column(JSON, nullable=False, default=list)
    persons = db.Column(db.Integer, nullable=False, default=1)
    split_mode = db.Column(VARCHAR(50), nullable=False, default='NONE')
    payments = db.Column(JSON, nullable=False, default=list)
    paid = db.Column(BOOLEAN, nullable=False, default=False, index=True)
    paid_at = db.Column(DATETIME)
    channel = db.Column(VARCHAR(50))
    store = db.Column(JSON, default=dict)
    subtotal = db.Column(DECIMAL(12, 2), nullable=False, default=0)
    discount = db.Column(DECIMAL(12, 2), nullable=False, default=0)
    service = db.Column(DECIMAL(12, 2), nullable=False, default=0)
    vat = db.Column(DECIMAL(12, 2), nullable=False, default=0)
    total = db.Column(DECIMAL(12, 2), nullable=False)
    
    # Relationships
    order_payments = db.relationship('Payment', backref='order', cascade='all, delete-orphan')
    slips = db.relationship('TransferSlip', backref='order', cascade='all, delete-orphan')

class Payment(db.Model):
    __tablename__ = "payments"
    
    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    order_id = db.Column(BIGINT(unsigned=True), db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    method = db.Column(VARCHAR(50), nullable=False)
    amount = db.Column(DECIMAL(12, 2), nullable=False)
    received = db.Column(DECIMAL(12, 2), nullable=False)
    change = db.Column(DECIMAL(12, 2), nullable=False)
    time = db.Column(DATETIME, nullable=False, default=lambda: datetime.now(timezone.utc))
    ref = db.Column(TEXT)

class TransferSlip(db.Model):
    __tablename__ = "transfer_slips"
    
    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    order_id = db.Column(BIGINT(unsigned=True), db.ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_id = db.Column(BIGINT(unsigned=True), db.ForeignKey("payments.id", ondelete="CASCADE"), nullable=True)
    filename = db.Column(VARCHAR(255), nullable=False)
    file_path = db.Column(TEXT, nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    mime_type = db.Column(VARCHAR(100), nullable=False)
    upload_time = db.Column(DATETIME, nullable=False, default=lambda: datetime.now(timezone.utc))

class Announcement(db.Model):
    __tablename__ = "announcements"
    
    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    title = db.Column(VARCHAR(200), nullable=False)
    body = db.Column(TEXT)
    image = db.Column(TEXT)
    created_at = db.Column(DATETIME, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    published_at = db.Column(DATETIME)
    active = db.Column(BOOLEAN, nullable=False, default=True, index=True)

class PaymentSettings(db.Model):
    __tablename__ = "payment_settings"
    
    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    qr_image = db.Column(TEXT)
    qr_label = db.Column(TEXT)
    updated_at = db.Column(DATETIME, onupdate=lambda: datetime.now(timezone.utc))