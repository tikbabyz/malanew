from flask import Blueprint, jsonify, request

from app.database import db
from app.models import PaymentSettings
from app.utils import build_qr_image_info, normalize_qr_image


payments_bp = Blueprint("payments", __name__, url_prefix="/api")


@payments_bp.route("/payment-settings", methods=["GET", "POST"])
def payment_settings():
    if request.method == "GET":
        settings = PaymentSettings.query.first()
        image_value = settings.qr_image if settings else ""
        image_info = build_qr_image_info(image_value)
        return jsonify(
            {
                "qr_image": image_info["absolute"],
                "qr_image_path": image_info["path"],
                "qr_image_relative": image_info["relative"],
                "qr_label": settings.qr_label if settings else "",
            }
        )

    data = request.get_json(force=True) or {}
    settings = PaymentSettings.query.first()
    if not settings:
        settings = PaymentSettings()
        db.session.add(settings)

    raw_image = data.get("qr_image_path") or data.get("qr_image")
    settings.qr_image = normalize_qr_image(raw_image, request.host)
    settings.qr_label = data.get("qr_label", "")

    db.session.commit()
    return jsonify({"success": True})
