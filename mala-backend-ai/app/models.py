from datetime import datetime

from sqlalchemy.dialects.mysql import (
    BIGINT,
    BOOLEAN,
    DATETIME,
    DECIMAL,
    JSON,
    TEXT,
    VARCHAR,
)

from app.database import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    username = db.Column(VARCHAR(255), unique=True, nullable=False, index=True)
    password = db.Column(TEXT)
    role = db.Column(VARCHAR(100), nullable=False)
    name = db.Column(TEXT)
    active = db.Column(BOOLEAN, nullable=False, default=True)
    phone = db.Column(TEXT)
    email = db.Column(TEXT)
    perms = db.Column(JSON, default=list)


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    name = db.Column(VARCHAR(255), nullable=False, index=True)
    price = db.Column(DECIMAL(12, 2), nullable=False, default=0)
    category = db.Column(VARCHAR(100), nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    active = db.Column(BOOLEAN, nullable=False, default=True)
    color = db.Column(VARCHAR(50))
    image = db.Column(TEXT)


class ColorPrice(db.Model):
    __tablename__ = "color_prices"

    color = db.Column(VARCHAR(50), primary_key=True)
    price = db.Column(DECIMAL(12, 2), nullable=False)


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    created_at = db.Column(DATETIME, nullable=False, default=datetime.utcnow, index=True)
    items = db.Column(JSON, nullable=False, default=list)
    persons = db.Column(db.Integer, nullable=False, default=1)
    split_mode = db.Column(VARCHAR(50), nullable=False, default="NONE")
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

    order_payments = db.relationship("Payment", backref="order", cascade="all, delete-orphan")
    slips = db.relationship("TransferSlip", backref="order", cascade="all, delete-orphan")


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    order_id = db.Column(
        BIGINT(unsigned=True),
        db.ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    method = db.Column(VARCHAR(50), nullable=False)
    amount = db.Column(DECIMAL(12, 2), nullable=False)
    received = db.Column(DECIMAL(12, 2), nullable=False)
    change = db.Column(DECIMAL(12, 2), nullable=False)
    time = db.Column(DATETIME, nullable=False, default=datetime.utcnow)
    ref = db.Column(TEXT)


class TransferSlip(db.Model):
    __tablename__ = "transfer_slips"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    order_id = db.Column(
        BIGINT(unsigned=True),
        db.ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    payment_id = db.Column(BIGINT(unsigned=True), db.ForeignKey("payments.id", ondelete="CASCADE"))
    filename = db.Column(TEXT, nullable=False)
    file_path = db.Column(TEXT, nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    mime_type = db.Column(TEXT, nullable=False)
    upload_time = db.Column(DATETIME, nullable=False, default=datetime.utcnow)


class Announcement(db.Model):
    __tablename__ = "announcements"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    title = db.Column(TEXT, nullable=False)
    body = db.Column(TEXT)
    image = db.Column(TEXT)
    created_at = db.Column(DATETIME, nullable=False, default=datetime.utcnow, index=True)
    published_at = db.Column(DATETIME)
    active = db.Column(BOOLEAN, nullable=False, default=True, index=True)


class PaymentSettings(db.Model):
    __tablename__ = "payment_settings"

    id = db.Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    qr_image = db.Column(TEXT)
    qr_label = db.Column(TEXT)
