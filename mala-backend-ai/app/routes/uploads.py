from __future__ import annotations

import json
import uuid
from datetime import datetime
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from app.database import db
from app.models import Payment, TransferSlip
from app.utils import abs_url_for, allowed_file, get_file_type


uploads_bp = Blueprint("uploads", __name__)

_MAX_SIZE = 5 * 1024 * 1024  # 5MB per file


def _validate_file(field_name: str):
    if field_name not in request.files:
        return None, jsonify({"error": "ไม่พบไฟล์"}), 400

    file = request.files[field_name]
    if file.filename == "":
        return None, jsonify({"error": "ไม่ได้เลือกไฟล์"}), 400

    allowed_exts = current_app.config.get("ALLOWED_EXTENSIONS", set())
    if not allowed_file(file.filename, allowed_exts):
        return None, jsonify({"error": "ประเภทไฟล์ไม่รองรับ"}), 400

    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > _MAX_SIZE:
        return None, jsonify({"error": "ไฟล์ใหญ่เกินไป (สูงสุด 5MB)"}), 400

    return file, size, None


@uploads_bp.post("/api/upload/image")
def upload_product_image():
    result = _validate_file("image")
    if result[0] is None:
        return result[1], result[2]
    file, size, _ = result

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"product_{timestamp}_{secure_filename(file.filename)}"

    target_dir = Path(current_app.config["PRODUCTS_UPLOAD_DIR"])
    file_path = target_dir / filename
    file.save(file_path)

    relative_url = f"/api/products/images/{filename}"
    absolute_url = abs_url_for("uploads.serve_product_image", filename=filename)
    print(f"✅ Product image uploaded: {filename} ({size} bytes)")

    return jsonify(
        {
            "success": True,
            "imageUrl": absolute_url,
            "relativeUrl": relative_url,
            "filename": filename,
            "size": size,
        }
    )


@uploads_bp.get("/api/products/images/<path:filename>")
def serve_product_image(filename: str):
    try:
        return send_from_directory(str(current_app.config["PRODUCTS_UPLOAD_DIR"]), filename)
    except Exception as exc:
        print(f"❌ Error serving product image: {exc}")
        return jsonify({"error": "ไม่พบไฟล์รูปภาพ"}), 404


@uploads_bp.get("/uploads/products/<path:filename>")
def serve_legacy_product_image(filename: str):
    return serve_product_image(filename)


@uploads_bp.post("/api/upload/qr")
def upload_qr_code():
    result = _validate_file("image")
    if result[0] is None:
        return result[1], result[2]
    file, size, _ = result

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"qr_{timestamp}_{secure_filename(file.filename)}"

    target_dir = Path(current_app.config["QR_UPLOAD_DIR"])
    file_path = target_dir / filename
    file.save(file_path)

    relative_url = f"/api/qr/images/{filename}"
    absolute_url = abs_url_for("uploads.serve_qr_image", filename=filename)
    print(f"✅ QR Code uploaded: {filename} ({size} bytes)")

    return jsonify(
        {
            "success": True,
            "imageUrl": absolute_url,
            "relativeUrl": relative_url,
            "filename": filename,
            "size": size,
        }
    )


@uploads_bp.get("/api/qr/images/<path:filename>")
def serve_qr_image(filename: str):
    try:
        return send_from_directory(str(current_app.config["QR_UPLOAD_DIR"]), filename)
    except Exception as exc:
        print(f"❌ Error serving QR image: {exc}")
        return jsonify({"error": "ไม่พบไฟล์ QR Code"}), 404


@uploads_bp.post("/api/upload-slip")
def upload_slip():
    result = _validate_file("slip")
    if result[0] is None:
        return result[1], result[2]
    file, size, _ = result

    order_id_raw = request.form.get("orderId", "0")
    try:
        order_id = int(order_id_raw)
    except ValueError:
        return jsonify({"error": "order_id ห้ามว่าง"}), 400

    payment_id = request.form.get("paymentId")
    timestamp = request.form.get("timestamp", str(int(datetime.now().timestamp())))
    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"slip_{order_id}_{timestamp}_{uuid.uuid4().hex[:8]}.{ext}"

    target_dir = Path(current_app.config["UPLOAD_FOLDER"])
    file_path = target_dir / filename
    file.save(file_path)

    payment = None
    if payment_id:
        try:
            payment = Payment.query.get(int(payment_id))
        except (TypeError, ValueError):
            payment = None

    slip = TransferSlip(
        order_id=order_id,
        payment_id=payment.id if payment else None,
        filename=filename,
        file_path=str(file_path),
        file_size=size,
        mime_type=get_file_type(file.filename),
    )
    db.session.add(slip)
    db.session.commit()

    slip_url = abs_url_for("uploads.serve_slip", filename=filename)

    if payment:
        ref_payload = {"slipUrl": slip_url, "slipId": slip.id}
        try:
            existing_ref = json.loads(payment.ref) if payment.ref else {}
        except json.JSONDecodeError:
            existing_ref = {}

        if isinstance(existing_ref, dict):
            existing_ref.update(ref_payload)
            payment.ref = json.dumps(existing_ref)
        else:
            payment.ref = json.dumps(ref_payload)
        db.session.commit()

    return jsonify(
        {
            "success": True,
            "slipUrl": slip_url,
            "slipId": slip.id,
            "filename": filename,
        }
    )


@uploads_bp.get("/api/slips/<path:filename>")
def serve_slip(filename: str):
    try:
        return send_from_directory(str(current_app.config["UPLOAD_FOLDER"]), filename)
    except FileNotFoundError:
        return jsonify({"error": "ไม่พบไฟล์"}), 404
