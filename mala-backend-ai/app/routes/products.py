from pathlib import Path
from urllib.parse import urlparse

from flask import Blueprint, current_app, jsonify, request

from app.database import db
from app.models import ColorPrice, Product
from flask import request

from app.utils import normalize_product_image, serialize_product


products_bp = Blueprint("products", __name__, url_prefix="/api")


@products_bp.get("/products")
def list_products():
    products = Product.query.order_by(Product.id.desc()).all()
    return jsonify([serialize_product(p) for p in products])


@products_bp.post("/products")
def create_product():
    data = request.get_json(force=True) or {}

    if not data.get("name"):
        return jsonify({"error": "ต้องระบุชื่อสินค้า"}), 400
    if not data.get("category"):
        return jsonify({"error": "ต้องระบุหมวดหมู่"}), 400

    existing = Product.query.filter_by(name=data["name"]).first()
    if existing:
        return jsonify({"error": "มีสินค้านี้อยู่แล้ว"}), 400

    image_value = normalize_product_image(data.get("image"), request.host)

    product = Product(
        name=data["name"],
        price=data.get("price", 0),
        category=data["category"],
        stock=data.get("stock", 0),
        active=bool(data.get("active", True)),
        color=data.get("color"),
        image=image_value,
    )

    db.session.add(product)
    db.session.commit()
    return jsonify(serialize_product(product)), 201


@products_bp.put("/products/<int:product_id>")
def update_product(product_id: int):
    product = Product.query.get_or_404(product_id)
    data = request.get_json(force=True) or {}

    if "name" in data:
        product.name = data.get("name") or product.name
    if "price" in data:
        product.price = data.get("price", product.price)
    if "category" in data:
        product.category = data.get("category") or product.category
    if "stock" in data:
        product.stock = data.get("stock", product.stock)
    if "active" in data:
        product.active = bool(data.get("active"))
    if "color" in data:
        product.color = data.get("color")
    if "image" in data:
        product.image = normalize_product_image(data.get("image"), request.host)

    db.session.commit()
    return jsonify(serialize_product(product))


@products_bp.delete("/products/<int:product_id>")
def delete_product(product_id: int):
    product = Product.query.get_or_404(product_id)

    if product.image:
        filename = ""
        image_value = product.image
        if not image_value.startswith(("http://", "https://")):
            filename = image_value.split("/")[-1]
        else:
            parsed = urlparse(image_value)
            if parsed.scheme in ("http", "https") and parsed.netloc == request.host:
                filename = parsed.path.rsplit("/", 1)[-1]

        if filename:
            image_path = Path(current_app.config["PRODUCTS_UPLOAD_DIR"]) / filename
            if image_path.exists():
                try:
                    image_path.unlink()
                    print(f"✅ Deleted product image: {filename}")
                except Exception as exc:
                    print(f"⚠️ Error deleting product image {filename}: {exc}")

    product_name = product.name
    db.session.delete(product)
    db.session.commit()
    return jsonify({"success": True, "message": f"ลบสินค้า '{product_name}' สำเร็จ"})


@products_bp.get("/color-prices")
def get_color_prices():
    rows = ColorPrice.query.order_by(ColorPrice.color.asc()).all()
    return jsonify({
        row.color: {
            "price": float(row.price),
            "stock": int(row.stock or 0)
        }
        for row in rows
    })


@products_bp.put("/color-prices")
def update_color_prices():
    data = request.get_json(force=True) or {}
    updated = {}
    for color, payload in data.items():
        price = None
        stock = None

        if isinstance(payload, dict):
            price = payload.get("price")
            stock = payload.get("stock")
        else:
            price = payload

        try:
            price = float(price) if price is not None else None
        except (TypeError, ValueError):
            price = None

        try:
            stock = int(stock) if stock is not None else None
        except (TypeError, ValueError):
            stock = None

        row = ColorPrice.query.get(color)
        if not row:
            row = ColorPrice(
                color=color,
                price=price or 0,
                stock=stock if stock is not None else 0,
            )
            db.session.add(row)
        else:
            if price is not None:
                row.price = price
            if stock is not None:
                row.stock = stock

        updated[color] = {
            "price": float(row.price),
            "stock": int(row.stock or 0)
        }

    db.session.commit()
    return jsonify(updated)
