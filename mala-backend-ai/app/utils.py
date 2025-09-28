from __future__ import annotations

import mimetypes
import os
from pathlib import Path
from typing import Iterable

from flask import current_app, request, url_for


def init_upload_dirs(app) -> None:
    """Ensure upload directories exist and store them as Path objects."""
    keys = ["UPLOAD_FOLDER", "PRODUCTS_UPLOAD_DIR", "QR_UPLOAD_DIR"]
    for key in keys:
        if key not in app.config:
            continue
        path = Path(app.config[key])
        path.mkdir(parents=True, exist_ok=True)
        app.config[key] = path


def allowed_file(filename: str, allowed_extensions: Iterable[str]) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in set(allowed_extensions)


def get_file_type(filename: str) -> str:
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


def abs_url_for(endpoint: str, **values) -> str:
    rel = url_for(endpoint, **values)
    host = request.host_url.rstrip("/")
    return f"{host}{rel}"


def init_ai_model(app) -> None:
    ai_state: dict[str, object | None] = {
        "model": None,
        "cv2": None,
        "np": None,
        "Image": None,
        "ImageOps": None,
    }

    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        ai_state["cv2"] = cv2
        ai_state["np"] = np
    except ImportError:
        print("⚠️ AI libraries (cv2/numpy) not available - vision features disabled")

    YOLO = None
    try:
        from ultralytics import YOLO  # type: ignore
        from PIL import Image, ImageOps  # type: ignore

        ai_state["Image"] = Image
        ai_state["ImageOps"] = ImageOps
    except ImportError:
        print("⚠️ Ultralytics/Pillow not available - detection endpoint disabled")

    try:
        import pillow_heif  # type: ignore

        pillow_heif.register_heif_opener()
    except Exception:
        pass

    model_path = str(app.config.get("MODEL_PATH") or "")
    if model_path and not os.path.isabs(model_path):
        model_path = str((Path(app.root_path).parent / model_path).resolve())

    if YOLO and model_path:
        try:
            model = YOLO(model_path)
            ai_state["model"] = model
            app.config["MODEL_PATH"] = model_path
            print(f"✅ Loaded model: {model_path}")
        except Exception as exc:
            print(f"⚠️ Failed to load model ({model_path}): {exc}")
    elif YOLO:
        print("⚠️ MODEL_PATH not set - skipping model load")

    app.extensions["ai"] = ai_state


def serialize_user(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "name": user.name,
        "active": user.active,
        "phone": getattr(user, "phone", ""),
        "email": getattr(user, "email", ""),
        "perms": user.perms or [],
    }


def serialize_product(product) -> dict:
    price = product.price or 0
    return {
        "id": product.id,
        "name": product.name,
        "price": float(price),
        "category": product.category,
        "stock": product.stock,
        "active": product.active,
        "color": product.color,
        "image": product.image,
    }


def serialize_announcement(announcement) -> dict:
    return {
        "id": announcement.id,
        "title": announcement.title,
        "body": announcement.body or "",
        "image": announcement.image,
        "createdAt": announcement.created_at.isoformat() if announcement.created_at else None,
        "publishedAt": announcement.published_at.isoformat() if announcement.published_at else None,
        "active": bool(announcement.active),
    }
