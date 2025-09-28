from flask import Blueprint, jsonify, request

from app.database import db
from app.models import PaymentSettings


payments_bp = Blueprint("payments", __name__, url_prefix="/api")


@payments_bp.route("/payment-settings", methods=["GET", "POST"])
def payment_settings():
    if request.method == "GET":
        settings = PaymentSettings.query.first()
        return jsonify(
            {
                "qr_image": settings.qr_image if settings else "",
                "qr_label": settings.qr_label if settings else "",
            }
        )

    data = request.get_json(force=True) or {}
    settings = PaymentSettings.query.first()
    if not settings:
        settings = PaymentSettings()
        db.session.add(settings)

    settings.qr_image = data.get("qr_image", "")
    settings.qr_label = data.get("qr_label", "")

    db.session.commit()
    return jsonify({"success": True})
