from datetime import datetime

from flask import Blueprint, jsonify, request

from app.database import db
from app.models import Announcement
from app.utils import serialize_announcement


announcements_bp = Blueprint("announcements", __name__, url_prefix="/api")


def _parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@announcements_bp.get("/announcements")
def list_announcements():
    only_active = request.args.get("active") == "1"
    query = Announcement.query
    if only_active:
        query = query.filter_by(active=True)
    rows = query.order_by(Announcement.created_at.desc()).all()
    return jsonify([serialize_announcement(row) for row in rows])


@announcements_bp.post("/announcements")
def create_announcement():
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400

    announcement = Announcement(
        title=title,
        body=(data.get("body") or "").strip(),
        image=data.get("image") or None,
        published_at=_parse_datetime(data.get("publishedAt")),
        active=bool(data.get("active", True)),
    )
    db.session.add(announcement)
    db.session.commit()
    return jsonify(serialize_announcement(announcement)), 201


@announcements_bp.put("/announcements/<int:announcement_id>")
def update_announcement(announcement_id: int):
    announcement = Announcement.query.get_or_404(announcement_id)
    data = request.get_json(force=True) or {}

    if "title" in data:
        candidate = (data.get("title") or "").strip()
        if candidate:
            announcement.title = candidate
    if "body" in data:
        announcement.body = (data.get("body") or "").strip()
    if "image" in data:
        announcement.image = data.get("image") or None
    if "publishedAt" in data:
        announcement.published_at = _parse_datetime(data.get("publishedAt"))
    if "active" in data:
        announcement.active = bool(data.get("active"))

    db.session.commit()
    return jsonify(serialize_announcement(announcement))


@announcements_bp.delete("/announcements/<int:announcement_id>")
def delete_announcement(announcement_id: int):
    announcement = Announcement.query.get_or_404(announcement_id)
    db.session.delete(announcement)
    db.session.commit()
    return jsonify({"ok": True})
