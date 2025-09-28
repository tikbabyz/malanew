from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.auth import verify_password
from app.models import User


auth_bp = Blueprint("auth", __name__, url_prefix="/api")


@auth_bp.post("/login")
def login():
    data = request.get_json(force=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"error": "กรุณาระบุชื่อผู้ใช้และรหัสผ่าน"}), 400

    user = User.query.filter(func.lower(User.username) == username).first()
    if not user:
        return jsonify({"error": "ไม่พบบัญชีผู้ใช้"}), 404
    if not user.active:
        return jsonify({"error": "บัญชีถูกปิดใช้งาน"}), 403
    if not verify_password(password, user.password):
        return jsonify({"error": "รหัสผ่านไม่ถูกต้อง"}), 400

    payload = {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "name": user.name,
        "active": user.active,
        "perms": user.perms or [],
    }
    return jsonify(payload)
