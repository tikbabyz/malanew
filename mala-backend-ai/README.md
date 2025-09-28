# Mala AI Backend (Flask + YOLOv11)

## Setup

```bash
python -m venv venv
# Windows PowerShell
venv\Scripts\activate
# macOS / Linux
# source venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Create a `.env` file (or update the existing one) with a MySQL connection string:

```
DATABASE_URL=mysql+pymysql://user:password@localhost:3306/mala_restaurant
```

You can also override the defaults from `app/config.py` (model path, detection thresholds, etc.) via environment variables.

## Running

Place your trained YOLO model (e.g. `best.pt`) in the `models/` directory or set `MALA_MODEL_PATH`, then start the server:

```bash
python server.py
```

The API will be available at `http://127.0.0.1:8000` with endpoints such as:

- `GET /api/health`
- `POST /api/detect` (multipart `image` field)
- `POST /api/login`
- `GET /api/products`

CORS is enabled for `http://localhost:5173` by default; adjust in `app/__init__.py` if needed.
