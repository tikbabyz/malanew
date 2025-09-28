from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.auth import make_password_hash
from app.database import db
from app.models import User
from app.utils import serialize_user


users_bp = Blueprint("users", __name__, url_prefix="/api")


@users_bp.get("/users/debug")
def debug_users():
    users = User.query.order_by(User.id.asc()).all()
    return jsonify(
        [
            {
                "id": u.id,
                "username": u.username,
                "password": u.password,
                "role": u.role,
                "name": u.name,
                "active": u.active,
            }
            for u in users
        ]
    )


@users_bp.get("/users")
def list_users():
    users = User.query.order_by(User.id.asc()).all()
    return jsonify([serialize_user(u) for u in users])


@users_bp.post("/users")
def create_user():
    data = request.get_json(force=True) or {}

    required = {"username", "name"}
    if not required.issubset(data):
        return jsonify({"error": "กรุณาระบุ username และ name"}), 400

    username = (data.get("username") or "").strip()
    if not username:
        return jsonify({"error": "ชื่อผู้ใช้ห้ามว่าง"}), 400

    existing = User.query.filter(func.lower(User.username) == username.lower()).first()
    if existing:
        return jsonify({"error": "ชื่อผู้ใช้นี้มีอยู่แล้ว"}), 400

    password_data = data.get("passwordHash") or data.get("password") or ""
    if password_data and not password_data.startswith("sha256:"):
        password_data = make_password_hash(password_data)

    user = User(
        username=username,
        password=password_data,
        role=data.get("role", "STAFF"),
        name=data.get("name"),
        active=bool(data.get("active", True)),
        phone=data.get("phone", ""),
        email=data.get("email", ""),
        perms=data.get("perms", []),
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({"success": True, "id": user.id, "user": serialize_user(user)})


@users_bp.put("/users/<int:user_id>")
def update_user(user_id: int):
    data = request.get_json(force=True) or {}
    user = User.query.get_or_404(user_id)

    if "username" in data:
        username = (data.get("username") or "").strip()
        if not username:
            return jsonify({"error": "ชื่อผู้ใช้ห้ามว่าง"}), 400
        duplicate = (
            User.query.filter(func.lower(User.username) == username.lower(), User.id != user_id)
            .first()
        )
        if duplicate:
            return jsonify({"error": "ชื่อผู้ใช้นี้มีอยู่แล้ว"}), 400
        user.username = username

    if data.get("passwordHash"):
        user.password = data["passwordHash"]
    elif data.get("password"):
        user.password = make_password_hash(data["password"])

    if "role" in data:
        user.role = data["role"]
    if "name" in data:
        user.name = data["name"]
    if "active" in data:
        user.active = bool(data["active"])
    if "phone" in data:
        user.phone = data.get("phone")
    if "email" in data:
        user.email = data.get("email")
    if "perms" in data:
        user.perms = data.get("perms")

    db.session.commit()
    return jsonify({"success": True, "user": serialize_user(user)})


@users_bp.delete("/users/<int:user_id>")
def delete_user(user_id: int):
    user = User.query.get_or_404(user_id)

    if user.role == "ADMIN":
        active_admins = User.query.filter_by(role="ADMIN", active=True).count()
        if active_admins <= 1:
            return jsonify({"error": "ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้"}), 400

    db.session.delete(user)
    db.session.commit()
    return jsonify({"success": True})
