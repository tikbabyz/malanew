from __future__ import annotations

import base64
import json
from typing import Any, Dict, List, Optional, Tuple

from flask import Blueprint, current_app, jsonify, request


ai_bp = Blueprint("ai", __name__, url_prefix="/api")

ALIASES = {
    "แดง": "red",
    "เขียว": "green",
    "น้ำเงิน": "blue",
    "ฟ้า": "blue",
    "ชมพู": "pink",
    "ม่วง": "purple",
}

COLOR_MAP = {
    "red": (36, 36, 255),
    "green": (58, 181, 75),
    "blue": (255, 106, 77),
    "pink": (203, 192, 255),
    "purple": (237, 130, 237),
}


def build_context() -> Dict[str, Any]:
    cfg = current_app.config
    ai_state = current_app.extensions.get("ai", {})

    sv_min = int(cfg.get("SV_MIN", 50))

    ranges = {
        "red": [(0, sv_min, sv_min, 10, 255, 255), (170, sv_min, sv_min, 180, 255, 255)],
        "green": [(45, sv_min, sv_min, 85, 255, 255)],
        "blue": [(100, sv_min, sv_min, 130, 255, 255)],
        "purple": [(130, max(30, sv_min - 10), max(30, sv_min - 10), 155, 255, 255)],
        "pink": [(140, sv_min, sv_min, 170, 255, 255)],
    }

    context = {
        "model": ai_state.get("model"),
        "cv2": ai_state.get("cv2"),
        "np": ai_state.get("np"),
        "Image": ai_state.get("Image"),
        "ImageOps": ai_state.get("ImageOps"),
        "conf": float(cfg.get("CONF", 0.35)),
        "iou": float(cfg.get("IOU", 0.50)),
        "img": int(cfg.get("IMG_SIZE", cfg.get("IMG", 1024))),
        "color_override_min": float(cfg.get("COLOR_OVERRIDE_MIN", 0.60)),
        "model_trust": float(cfg.get("MODEL_TRUST", 0.62)),
        "center_shrink": float(cfg.get("CENTER_SHRINK", 0.60)),
        "sv_min": sv_min,
        "min_pixels": int(cfg.get("MIN_PIXELS", 60)),
        "roi_scales": list(cfg.get("ROI_SCALES", [0.90, 1.00, 1.15, 1.30, 1.45])),
        "respect_user_roi": bool(cfg.get("RESPECT_USER_ROI", True)),
        "user_pad": float(cfg.get("USER_PAD", 0.10)),
        "edge_margin": float(cfg.get("EDGE_MARGIN", 0.08)),
        "density_min": float(cfg.get("DENSITY_MIN", 0.06)),
        "density_max": float(cfg.get("DENSITY_MAX", 0.22)),
        "ranges": ranges,
        "centers_lab": {
            "red": ai_state.get("np").array([60, 80, 40]) if ai_state.get("np") else None,
            "green": ai_state.get("np").array([70, -60, 60]) if ai_state.get("np") else None,
            "blue": ai_state.get("np").array([35, 20, -60]) if ai_state.get("np") else None,
            "purple": ai_state.get("np").array([45, 60, -35]) if ai_state.get("np") else None,
            "pink": ai_state.get("np").array([70, 70, 10]) if ai_state.get("np") else None,
        },
        "model_path": cfg.get("MODEL_PATH"),
    }
    return context


def _missing_components(ctx: Dict[str, Any]) -> Optional[str]:
    required = ["model", "cv2", "np", "Image", "ImageOps"]
    for key in required:
        if ctx.get(key) is None:
            return key
    return None


def norm_label(label: str) -> str:
    return ALIASES.get(str(label).strip().lower(), str(label).strip().lower())


def draw(ctx: Dict[str, Any], bgr, detections: List[Dict[str, Any]]) -> str:
    cv2 = ctx["cv2"]
    canvas = bgr.copy()
    for det in detections:
        x1, y1, x2, y2 = map(int, det["box"])
        label = det["label"]
        conf = det["confidence"]
        color = COLOR_MAP.get(label, (255, 255, 255))
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            canvas,
            f"{label} {conf:.2f}",
            (x1, max(0, y1 - 6)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2,
            cv2.LINE_AA,
        )
    ok, buf = cv2.imencode(".png", canvas)
    return base64.b64encode(buf.tobytes()).decode("utf-8")


def dedupe_by_center(detections: List[Dict[str, Any]], threshold: float = 0.45) -> List[Dict[str, Any]]:
    def center(box):
        x1, y1, x2, y2 = box
        return ((x1 + x2) / 2.0, (y1 + y2) / 2.0, max(x2 - x1, y2 - y1))

    output: List[Dict[str, Any]] = []
    for det in sorted(detections, key=lambda item: -item["confidence"]):
        cx, cy, size = center(det["box"])
        keep = True
        for existing in output:
            ex, ey, esize = center(existing["box"])
            dist = ((cx - ex) ** 2 + (cy - ey) ** 2) ** 0.5
            if dist < threshold * min(size, esize):
                keep = False
                break
        if keep:
            output.append(det)
    return output


def tighten_roi_by_dets(ctx: Dict[str, Any], detections, rx1, ry1, rx2, ry2, pad_ratio=0.12, min_boxes=6):
    np_mod = ctx["np"]
    if len(detections) < min_boxes:
        return (rx1, ry1, rx2, ry2), False

    xs1, ys1, xs2, ys2 = [], [], [], []
    for det in detections:
        x1, y1, x2, y2 = det["box"]
        xs1.append(x1)
        ys1.append(y1)
        xs2.append(x2)
        ys2.append(y2)

    x1 = int(np_mod.percentile(xs1, 5))
    y1 = int(np_mod.percentile(ys1, 5))
    x2 = int(np_mod.percentile(xs2, 95))
    y2 = int(np_mod.percentile(ys2, 95))
    w = max(1, x2 - x1)
    h = max(1, y2 - y1)
    padx, pady = int(w * pad_ratio), int(h * pad_ratio)
    x1 -= padx
    y1 -= pady
    x2 += padx
    y2 += pady
    x1 = max(rx1, x1)
    y1 = max(ry1, y1)
    x2 = min(rx2, x2)
    y2 = min(ry2, y2)
    area_old = (rx2 - rx1) * (ry2 - ry1)
    area_new = max(1, (x2 - x1) * (y2 - y1))
    changed = area_new <= area_old * 0.9
    return (x1, y1, x2, y2), changed


def refine_roi_with_color_mask(ctx: Dict[str, Any], bgr, roi, sv_min=60):
    cv2 = ctx["cv2"]
    np_mod = ctx["np"]
    ranges = ctx["ranges"]
    rx1, ry1, rx2, ry2 = roi
    crop = bgr[ry1:ry2, rx1:rx2]
    if crop.size == 0:
        return roi, False
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mask = np_mod.zeros(crop.shape[:2], np.uint8)
    for bounds in ranges.values():
        for h1, s1, v1, h2, s2, v2 in bounds:
            mask |= cv2.inRange(
                hsv,
                (h1, max(s1, sv_min), max(v1, sv_min)),
                (h2, 255, 255),
            )
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np_mod.ones((7, 7), np_mod.uint8), 1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np_mod.ones((9, 9), np_mod.uint8), 2)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return roi, False
    c = max(cnts, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(c)
    pad = int(0.10 * max(w, h))
    nx1 = rx1 + max(0, x - pad)
    ny1 = ry1 + max(0, y - pad)
    nx2 = rx1 + min(crop.shape[1], x + w + pad)
    ny2 = ry1 + min(crop.shape[0], y + h + pad)
    area_old = (rx2 - rx1) * (ry2 - ry1)
    area_new = max(1, (nx2 - nx1) * (ny2 - ny1))
    changed = area_new <= area_old * 0.9
    return (nx1, ny1, nx2, ny2), changed


def largest_color_blob_bbox(ctx: Dict[str, Any], bgr):
    cv2 = ctx["cv2"]
    np_mod = ctx["np"]
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    mask = ((S > 60) & (V > 60)).astype(np_mod.uint8) * 255
    mask = cv2.medianBlur(mask, 5)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np_mod.ones((9, 9), np_mod.uint8), 2)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        h, w = bgr.shape[:2]
        return (0, 0, w, h)
    x, y, w, h = cv2.boundingRect(max(cnts, key=cv2.contourArea))
    return (x, y, x + w, y + h)


def square_from_center(cx, cy, half, width, height):
    x1 = int(max(0, cx - half))
    y1 = int(max(0, cy - half))
    x2 = int(min(width, cx + half))
    y2 = int(min(height, cy + half))
    size = min(x2 - x1, y2 - y1)
    x2 = x1 + size
    y2 = y1 + size
    return (x1, y1, x2, y2)


def pad_roi(x1, y1, x2, y2, width, height, pad_frac=0.0):
    if pad_frac <= 0:
        return (x1, y1, x2, y2)
    w = max(1, x2 - x1)
    h = max(1, y2 - y1)
    px, py = int(w * pad_frac), int(h * pad_frac)
    return (
        max(0, x1 - px),
        max(0, y1 - py),
        min(width, x2 + px),
        min(height, y2 + py),
    )


def predict_on_roi(ctx: Dict[str, Any], arr_bgr_full, roi):
    cv2 = ctx["cv2"]
    Image = ctx["Image"]
    model = ctx["model"]
    rx1, ry1, rx2, ry2 = roi
    crop_bgr = arr_bgr_full[ry1:ry2, rx1:rx2]
    result = model.predict(
        Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB)),
        conf=ctx["conf"],
        iou=ctx["iou"],
        imgsz=ctx["img"],
        verbose=False,
    )[0]
    detections: List[Dict[str, Any]] = []
    if result.boxes is not None and len(result.boxes.xyxy) > 0:
        for xyxy, cls_idx, conf in zip(
            result.boxes.xyxy.cpu().numpy(),
            result.boxes.cls.cpu().numpy(),
            result.boxes.conf.cpu().numpy(),
        ):
            x1c, y1c, x2c, y2c = xyxy.tolist()
            detections.append(
                {
                    "box": [rx1 + x1c, ry1 + y1c, rx1 + x2c, ry1 + y2c],
                    "cls": int(cls_idx),
                    "conf": float(conf),
                }
            )
    return detections, result


def score_dets(ctx: Dict[str, Any], detections, roi):
    rx1, ry1, rx2, ry2 = roi
    w = max(1.0, rx2 - rx1)
    h = max(1.0, ry2 - ry1)
    area_roi = w * h
    if not detections:
        return -1e9

    edge_margin = ctx["edge_margin"]
    density_min = ctx["density_min"]
    density_max = ctx["density_max"]

    sum_conf = sum(det["conf"] for det in detections)
    count = len(detections)
    area_boxes = 0.0
    edge_touch = 0
    for det in detections:
        x1, y1, x2, y2 = det["box"]
        area_boxes += max(0, (x2 - x1)) * max(0, (y2 - y1))
        if (
            (x1 - rx1) / w < edge_margin
            or (ry2 - y2) / h < edge_margin
            or (y1 - ry1) / h < edge_margin
            or (rx2 - x2) / w < edge_margin
        ):
            edge_touch += 1
    density = area_boxes / area_roi
    penalty_edge = 0.7 * edge_touch
    penalty_density = 0.0
    if density < density_min:
        penalty_density = (density_min - density) * 25
    if density > density_max:
        penalty_density = (density - density_max) * 25
    return (sum_conf + 0.35 * count) - (penalty_edge + penalty_density)


def pick_best_roi(ctx: Dict[str, Any], arr_bgr_full, user_roi=None):
    np_mod = ctx["np"]
    model = ctx["model"]
    if user_roi:
        x1, y1, x2, y2 = user_roi
    else:
        x1, y1, x2, y2 = largest_color_blob_bbox(ctx, arr_bgr_full)
    H, W = arr_bgr_full.shape[:2]
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    base_half = max(x2 - x1, y2 - y1) / 2.0
    candidates = [square_from_center(cx, cy, base_half * scale, W, H) for scale in ctx["roi_scales"]]
    best_roi = None
    best_result = None
    best_dets = None
    best_score = -1e9
    for roi in candidates:
        dets, result = predict_on_roi(ctx, arr_bgr_full, roi)
        score = score_dets(ctx, dets, roi)
        if score > best_score:
            best_score = score
            best_roi, best_result, best_dets = roi, result, dets
    return best_roi, best_result, best_dets


def gray_world_wb(ctx: Dict[str, Any], bgr):
    cv2 = ctx["cv2"]
    np_mod = ctx["np"]
    b, g, r = cv2.split(bgr.astype(np_mod.float32))
    kb, kg, kr = b.mean(), g.mean(), r.mean()
    k = (kb + kg + kr) / 3.0
    b = np_mod.clip(b * (k / (kb + 1e-6)), 0, 255)
    g = np_mod.clip(g * (k / (kg + 1e-6)), 0, 255)
    r = np_mod.clip(r * (k / (kr + 1e-6)), 0, 255)
    return cv2.merge([b, g, r]).astype(np_mod.uint8)


def enhance_l_channel(ctx: Dict[str, Any], bgr):
    cv2 = ctx["cv2"]
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    L = clahe.apply(L)
    lab = cv2.merge([L, a, b])
    return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)


def center_disc_mask(ctx: Dict[str, Any], h, w):
    np_mod = ctx["np"]
    cy, cx = h / 2.0, w / 2.0
    r = min(h, w) * 0.5 * float(ctx["center_shrink"])
    yy, xx = np_mod.ogrid[:h, :w]
    return (((xx - cx) ** 2 + (yy - cy) ** 2) <= r * r).astype(np_mod.uint8)


def classify_color(ctx: Dict[str, Any], bgr_crop):
    cv2 = ctx["cv2"]
    np_mod = ctx["np"]
    centers = ctx["centers_lab"]
    bgr = enhance_l_channel(ctx, gray_world_wb(ctx, bgr_crop))
    h, w = bgr.shape[:2]
    mcenter = center_disc_mask(ctx, h, w)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    S, V = hsv[..., 1], hsv[..., 2]
    good = (S >= ctx["sv_min"]) & (V >= ctx["sv_min"]) & (mcenter > 0)
    total_good = int(good.sum())
    if total_good < ctx["min_pixels"]:
        return None, 0.0

    hsv_frac: Dict[str, float] = {}
    for name, ranges in ctx["ranges"].items():
        mask = np_mod.zeros((h, w), np_mod.uint8)
        for bounds in ranges:
            h1, s1, v1, h2, s2, v2 = bounds
            mask |= cv2.inRange(hsv, (h1, s1, v1), (h2, s2, v2))
        hsv_frac[name] = float((mask > 0)[good].sum()) / float(total_good)

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)
    L, A, B = cv2.split(lab)
    pts = np_mod.stack([L[good], A[good], B[good]], axis=1).astype(np_mod.float32)
    lab_score: Dict[str, float] = {}
    for name, center in centers.items():
        if center is None:
            continue
        d = np_mod.linalg.norm(pts - center[None, :], axis=1).mean()
        lab_score[name] = float(np_mod.exp(-d / 30.0))

    scores = {k: 0.6 * hsv_frac.get(k, 0.0) + 0.4 * lab_score.get(k, 0.0) for k in ctx["ranges"].keys()}
    best = max(scores.items(), key=lambda item: item[1])
    return best[0], float(best[1])


def filter_dets_inside(detections, roi, shrink=0.02):
    x1, y1, x2, y2 = roi
    w, h = max(1, x2 - x1), max(1, y2 - y1)
    ax1 = x1 + int(w * shrink)
    ay1 = y1 + int(h * shrink)
    ax2 = x2 - int(w * shrink)
    ay2 = y2 - int(h * shrink)
    output = []
    for det in detections:
        bx1, by1, bx2, by2 = det["box"]
        cx = (bx1 + bx2) / 2.0
        cy = (by1 + by2) / 2.0
        if ax1 <= cx <= ax2 and ay1 <= cy <= ay2:
            output.append(det)
    return output


@ai_bp.get("/health")
@ai_bp.get("/api/health")
def health():
    ctx = build_context()
    ok = ctx["model"] is not None
    return jsonify(
        {
            "ok": ok,
            "model": ctx.get("model_path"),
            "conf": ctx.get("conf"),
            "iou": ctx.get("iou"),
            "img": ctx.get("img"),
        }
    )


@ai_bp.post("/detect")
def detect():
    ctx = build_context()
    missing = _missing_components(ctx)
    if missing:
        return jsonify({"error": f"AI component '{missing}' not available"}), 503

    model = ctx["model"]
    cv2 = ctx["cv2"]
    np_mod = ctx["np"]
    Image = ctx["Image"]
    ImageOps = ctx["ImageOps"]

    file = request.files.get("image") or request.files.get("file")
    if not file:
        return jsonify({"error": "file field required (image or file)"}), 400

    try:
        img = Image.open(file.stream)
        img = ImageOps.exif_transpose(img).convert("RGB")
    except Exception:
        return jsonify({"error": "invalid image"}), 400

    arr_bgr_full = cv2.cvtColor(np_mod.array(img), cv2.COLOR_RGB2BGR)
    H, W = arr_bgr_full.shape[:2]

    user_roi = None
    bbox_raw = request.form.get("bbox") or request.args.get("bbox")
    if bbox_raw:
        try:
            if bbox_raw.strip().startswith("["):
                vals = json.loads(bbox_raw)
            else:
                vals = bbox_raw.split(",")
            x1, y1, x2, y2 = [int(float(v)) for v in vals]
            x1 = max(0, min(W - 1, x1))
            x2 = max(0, min(W, x2))
            y1 = max(0, min(H - 1, y1))
            y2 = max(0, min(H, y2))
            if x2 > x1 + 5 and y2 > y1 + 5:
                user_roi = (x1, y1, x2, y2)
        except Exception:
            user_roi = None

    if user_roi and ctx["respect_user_roi"]:
        rx1, ry1, rx2, ry2 = pad_roi(*user_roi, width=W, height=H, pad_frac=ctx["user_pad"])
        dets_raw, result = predict_on_roi(ctx, arr_bgr_full, (rx1, ry1, rx2, ry2))
    else:
        (rx1, ry1, rx2, ry2), result, dets_raw = pick_best_roi(ctx, arr_bgr_full, user_roi=user_roi)

    names = result.names if getattr(result, "names", None) else model.names
    if isinstance(names, dict):
        names = [names[k] for k in sorted(names.keys())]

    detections = []
    for det in dets_raw:
        x1, y1, x2, y2 = det["box"]
        idx = det["cls"]
        label = names[idx] if idx < len(names) else str(idx)
        detections.append(
            {
                "label": norm_label(label),
                "confidence": det["conf"],
                "box": [x1, y1, x2, y2],
            }
        )

    if not (ctx["respect_user_roi"] and user_roi):
        roi2, changed = tighten_roi_by_dets(ctx, detections, rx1, ry1, rx2, ry2, pad_ratio=0.12, min_boxes=6)
        if not changed:
            roi2, changed = refine_roi_with_color_mask(ctx, arr_bgr_full, (rx1, ry1, rx2, ry2), sv_min=ctx["sv_min"])
        if changed:
            rx1, ry1, rx2, ry2 = roi2
            dets_raw2, result2 = predict_on_roi(ctx, arr_bgr_full, (rx1, ry1, rx2, ry2))
            names2 = result2.names if getattr(result2, "names", None) else model.names
            if isinstance(names2, dict):
                names2 = [names2[k] for k in sorted(names2.keys())]
            detections = []
            for det in dets_raw2:
                x1, y1, x2, y2 = det["box"]
                idx = det["cls"]
                label = names2[idx] if idx < len(names2) else str(idx)
                detections.append(
                    {
                        "label": norm_label(label),
                        "confidence": det["conf"],
                        "box": [x1, y1, x2, y2],
                    }
                )

    if ctx["respect_user_roi"] and user_roi:
        detections = filter_dets_inside(detections, (rx1, ry1, rx2, ry2), shrink=0.03)

    for det in detections:
        x1, y1, x2, y2 = map(int, det["box"])
        crop = arr_bgr_full[max(0, y1) : max(0, y2), max(0, x1) : max(0, x2)]
        if crop.size == 0:
            continue
        best_color, score = classify_color(ctx, crop)
        if best_color and score >= ctx["color_override_min"] and det["confidence"] < ctx["model_trust"]:
            det["label"] = best_color

    detections = dedupe_by_center(detections, threshold=0.45)

    counts: Dict[str, int] = {}
    for det in detections:
        counts[det["label"]] = counts.get(det["label"], 0) + 1

    canvas = arr_bgr_full.copy()
    cv2.rectangle(canvas, (rx1, ry1), (rx2, ry2), (0, 200, 0), 2)
    if user_roi:
        ux1, uy1, ux2, uy2 = user_roi
        cv2.rectangle(canvas, (ux1, uy1), (ux2, uy2), (0, 255, 255), 2)

    annotated = draw(ctx, canvas, detections)

    return jsonify(
        {
            "counts": counts,
            "total_items": sum(counts.values()),
            "detections": detections,
            "roi": {"x1": rx1, "y1": ry1, "x2": rx2, "y2": ry2},
            "annotated": annotated,
        }
    )
