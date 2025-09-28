from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request

from app.database import db
from app.models import Order, Payment, TransferSlip
from app.utils import abs_url_for


orders_bp = Blueprint("orders", __name__, url_prefix="/api")


@orders_bp.get("/orders")
def list_orders():
    orders = Order.query.filter_by(paid=True).order_by(Order.created_at.desc()).all()
    uploads_dir = Path(current_app.config["UPLOAD_FOLDER"])
    response: list[dict] = []

    for order in orders:
        payments = (
            Payment.query.filter_by(order_id=order.id)
            .order_by(Payment.time.asc())
            .all()
        )

        slips_by_payment: dict[int, list[dict]] = {}
        slips = TransferSlip.query.filter_by(order_id=order.id).all()
        for slip in slips:
            filename = Path(slip.file_path).name
            file_path = uploads_dir / filename
            slip_url = abs_url_for("uploads.serve_slip", filename=filename) if file_path.exists() else None
            slips_by_payment.setdefault(slip.payment_id or 0, []).append(
                {
                    "slipUrl": slip_url,
                    "name": slip.filename,
                    "uploadTime": slip.upload_time.isoformat() if slip.upload_time else None,
                    "size": slip.file_size,
                    "mimeType": slip.mime_type,
                    "slipId": slip.id,
                }
            )

        payments_payload = []
        for payment in payments:
            slips_for_payment = slips_by_payment.get(payment.id, [])
            qr_image_url = None

            if payment.ref:
                try:
                    ref_data = json.loads(payment.ref) if isinstance(payment.ref, str) else payment.ref
                except json.JSONDecodeError:
                    ref_data = None

                if isinstance(ref_data, dict):
                    if "slips" in ref_data:
                        for slip in ref_data["slips"]:
                            slips_for_payment.append(slip)
                    if "qrImageUrl" in ref_data:
                        qr_image_url = ref_data.get("qrImageUrl")
                    elif "slipUrl" in ref_data:
                        qr_image_url = ref_data.get("slipUrl")

            if not qr_image_url and slips_for_payment:
                qr_image_url = slips_for_payment[0].get("slipUrl")

            payments_payload.append(
                {
                    "id": payment.id,
                    "method": payment.method,
                    "amount": float(payment.amount),
                    "received": float(payment.received),
                    "change": float(payment.change),
                    "time": payment.time.isoformat() if payment.time else None,
                    "ref": payment.ref,
                    "transferSlips": slips_for_payment,
                    "qrImageUrl": qr_image_url,
                }
            )

        total_paid = sum(float(payment.amount) for payment in payments)
        response.append(
            {
                "id": order.id,
                "createdAt": order.created_at.isoformat() if order.created_at else None,
                "items": order.items,
                "persons": order.persons,
                "splitMode": order.split_mode,
                "payments": payments_payload,
                "paid": order.paid,
                "paidAt": order.paid_at.isoformat() if order.paid_at else None,
                "channel": order.channel,
                "store": order.store,
                "subtotal": float(order.subtotal),
                "discount": float(order.discount),
                "service": float(order.service),
                "vat": float(order.vat),
                "total": float(order.total),
                "totalPaid": total_paid,
            }
        )

    return jsonify(response)


@orders_bp.post("/orders")
def create_order():
    data = request.get_json(force=True) or {}

    order = Order(
        items=data.get("items", []),
        persons=data.get("persons", 1),
        split_mode=data.get("splitMode", "NONE"),
        payments=data.get("payments", []),
        paid=bool(data.get("paid", False)),
        paid_at=datetime.utcnow() if data.get("paid") else None,
        channel=data.get("channel"),
        store=data.get("store"),
        subtotal=data.get("subtotal", 0),
        discount=data.get("discount", 0),
        service=data.get("service", 0),
        vat=data.get("vat", 0),
        total=data.get("total", 0),
    )
    db.session.add(order)
    db.session.commit()
    return jsonify({"id": order.id}), 201


@orders_bp.post("/orders/<int:order_id>/payments")
def add_payment(order_id: int):
    order = Order.query.get_or_404(order_id)
    data = request.get_json(force=True) or {}

    ref_data = data.get("ref")
    if data.get("method") == "qr" and data.get("transferSlips"):
        slip_payload = [
            {
                "name": slip.get("name"),
                "slipUrl": slip.get("slipUrl"),
                "uploadTime": slip.get("uploadTime"),
                "size": slip.get("size"),
            }
            for slip in data["transferSlips"]
        ]
        ref_data = json.dumps({"slips": slip_payload})

    payment = Payment(
        order_id=order_id,
        method=data["method"],
        amount=data["amount"],
        received=data.get("received", data["amount"]),
        change=data.get("change", 0),
        ref=ref_data,
    )
    db.session.add(payment)
    db.session.flush()

    for slip_data in data.get("transferSlips", []):
        slip_id = slip_data.get("slipId")
        if not slip_id:
            continue
        slip = TransferSlip.query.get(slip_id)
        if slip:
            slip.payment_id = payment.id
            slip.order_id = order_id

    pays_from_table = Payment.query.filter_by(order_id=order_id).all()
    total_from_table = sum(float(entry.amount) for entry in pays_from_table)
    total_from_json = sum(float(entry.get("amount", 0)) for entry in (order.payments or []))
    total_paid = max(total_from_table, total_from_json)

    if total_paid + 1e-6 >= float(order.total or 0):
        order.paid = True
        order.paid_at = datetime.utcnow()

    db.session.commit()
    return jsonify({"ok": True, "paymentId": payment.id})


@orders_bp.get("/orders/<int:order_id>/slips")
def list_slips(order_id: int):
    slips = TransferSlip.query.filter_by(order_id=order_id).all()
    slip_list = [
        {
            "id": slip.id,
            "filename": slip.filename,
            "fileSize": slip.file_size,
            "mimeType": slip.mime_type,
            "uploadTime": slip.upload_time.isoformat() if slip.upload_time else None,
            "url": f"/api/slips/{Path(slip.file_path).name}",
        }
        for slip in slips
    ]

    payments = Payment.query.filter_by(order_id=order_id).all()
    for payment in payments:
        if not payment.ref:
            continue
        try:
            ref_data = json.loads(payment.ref)
        except (json.JSONDecodeError, TypeError):
            ref_data = None
        if isinstance(ref_data, dict) and "slips" in ref_data:
            for slip in ref_data["slips"]:
                slip_list.append(
                    {
                        "paymentId": payment.id,
                        "filename": slip.get("name"),
                        "fileSize": slip.get("size"),
                        "uploadTime": slip.get("uploadTime"),
                        "url": slip.get("slipUrl"),
                    }
                )

    return jsonify(slip_list)
