# Mala AI Backend

## TL;DR
- Flask + SQLAlchemy REST API with YOLOv11 inference for the Mala Restaurant platform.
- Persists data in MySQL, stores media under `uploads/`, and loads YOLO weights from `models/`.
- Create a virtualenv, install dependencies (`pip install -r requirements.txt`), configure `.env`, then run `python server.py` or Gunicorn.

## Overview
This project is the backend that serves every data and AI workflow for Mala Restaurant. It ships as a Flask application factory (`app:create_app`) with modular blueprints for authentication, users, products, announcements, payments, uploads, and AI detection. Torch + Ultralytics deliver YOLOv11 colour detection, while Pillow/OpenCV handle post-processing.

## Requirements
- Python **3.10 or newer** (tested with 3.13)
- MySQL 8+ with an empty schema and user credentials
- Ability to install PyTorch CPU wheels (as listed in `requirements.txt`)
- Optional: `virtualenv` or Conda for isolation

## Setup
```bash
python -m venv venv
# Windows PowerShell
venv\Scripts\activate
# macOS / Linux
# source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

### Environment configuration
Create `.env` alongside `server.py` and populate values like the sample below:
```ini
# Database
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/mala_restaurant
SECRET_KEY=change-this-in-production

# YOLO model
MALA_MODEL_PATH=models/best.pt
MALA_CONF=0.35
MALA_IOU=0.50
MALA_IMG=1024

# Optional tuning
MALA_COLOR_OVERRIDE_MIN=0.60
MALA_MODEL_TRUST=0.62
MALA_RESPECT_USER_ROI=1

# Bootstrap database and seed defaults
AUTO_CREATE_DB=1
SEED_ADMIN=1

# Override dev port (defaults to 8000)
MALA_PORT=8000\n\n# Optional TLS (for managed MySQL that enforces SSL)\n# MYSQL_SSL_CA=/path/to/server-ca.pem\n# MYSQL_SSL_CERT=/path/to/client-cert.pem\n# MYSQL_SSL_KEY=/path/to/client-key.pem\n
```
Ensure the YOLO checkpoint (`best.pt`) exists at the configured path.

### Database migrations
```bash
# Tell Flask CLI which factory to use
$env:FLASK_APP = "app:create_app"      # PowerShell
# export FLASK_APP=app:create_app      # Bash/Zsh

flask db upgrade
```
`AUTO_CREATE_DB=1` triggers `db.create_all()` on start, but running migrations is recommended once you go beyond prototyping.

### Seeding sample data
With `AUTO_CREATE_DB=1` and `SEED_ADMIN=1`, the first successful start seeds:
- Admin account `admin / admin123`
- Staff account `staff / 123456`
- Colour price presets, default announcements, blank payment settings

## Running the server
```bash
# Development (debug=True, auto reload)
python server.py

# Production-style (Gunicorn)
source venv/bin/activate
pip install gunicorn
HTTP_WORKERS=2 gunicorn "app:create_app()" -b 0.0.0.0:8000
```
The API is available at `http://127.0.0.1:8000` when the service is healthy.

## API surface (selected)
| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Health & model status check |
| POST | `/api/login` | Username/password authentication (plain or `sha256:` hash) |
| GET | `/api/users` | List users (admin only) |
| POST | `/api/users` | Create user |
| PUT/DELETE | `/api/users/<id>` | Update / delete user |
| GET/POST | `/api/products` | Product & colour price CRUD |
| GET/POST | `/api/payments/settings` | Payment QR/settings CRUD |
| GET/POST | `/api/announcements` | Announcement CRUD |
| POST | `/api/detect` | Multipart image upload for YOLO detection |
| POST | `/api/upload/image` | Upload product image |
| GET | `/api/qr/images/<filename>` | Serve stored QR images |

Routes live in `app/routes/` if you need payload details.

## File storage layout
- Product images â†’ `uploads/products/`
- Payment slips â†’ `uploads/slips/`
- QR codes â†’ `uploads/qr_codes/`
These directories are created automatically by `create_app()` if missing.

## Troubleshooting
- **Torch install fails** â†’ ensure 64-bit Python and up-to-date `pip`; Windows users may need Visual C++ Build Tools.
- **MySQL connection refused** â†’ validate `DATABASE_URL`, user grants, and that MySQL allows remote/local connections.
- **CORS errors** â†’ update allowed origins in `app/__init__.py`.
- **Model not loading** â†’ confirm `MALA_MODEL_PATH` and file permissions.

## Useful commands
```bash
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/users/debug
curl -F "image=@test.png" http://127.0.0.1:8000/api/detect
```

## Contributing
- Follow Black/PEP8 style (formatter not bundled yet)
- Add new logic under `app/routes/` or dedicated services before registering blueprints
- When altering models: `flask db migrate -m "describe change"` then `flask db upgrade`

## Deployment (Production Guide)
The steps below target Ubuntu 22.04 LTS + systemd. Adjust as needed.

1. **Provision host prerequisites**
   - `sudo apt update && sudo apt install python3.11 python3.11-venv python3-pip mysql-client nginx git`
   - (Optional) `sudo adduser --system --group mala`
   - Ensure MySQL is reachable and database privileges are prepared.

2. **Clone the repository**
```bash
sudo mkdir -p /opt/mala && sudo chown mala:mala /opt/mala
sudo -u mala git clone https://<your-repo>/mala-backend-ai.git /opt/mala/backend
cd /opt/mala/backend
```

3. **Create the virtual environment & install dependencies**
```bash
sudo -u mala python3.11 -m venv .venv
sudo -u mala bash -c 'source .venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt'
```

4. **Configure environment variables**
   - Add `/opt/mala/backend/.env` (or copy a template) with the values described earlier.
   - Place the YOLO weights at the path referenced by `MALA_MODEL_PATH`.

5. **Run database migrations & (optionally) seed**
```bash
sudo -u mala bash -c 'source .venv/bin/activate && export FLASK_APP=app:create_app && flask db upgrade'
# AUTO_CREATE_DB=1 and SEED_ADMIN=1 will seed on the first boot
```

6. **Prepare upload directories**
```bash
sudo -u mala mkdir -p uploads/{products,slips,qr_codes}
```

7. **Create a systemd unit**
`/etc/systemd/system/mala-backend.service`:
```ini
[Unit]
Description=Mala Restaurant Backend
After=network.target mysql.service

[Service]
User=mala
Group=mala
WorkingDirectory=/opt/mala/backend
Environment="PYTHONUNBUFFERED=1"
EnvironmentFile=/opt/mala/backend/.env
ExecStart=/opt/mala/backend/.venv/bin/gunicorn "app:create_app()" \
          --bind 0.0.0.0:8000 \
          --workers 2 \
          --timeout 120
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
Then enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mala-backend
sudo systemctl status mala-backend
```

8. **Reverse proxy with Nginx (optional)**
`/etc/nginx/sites-available/mala-backend`:
```nginx
server {
    listen 80;
    server_name mala.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 16m;
}
```
Enable the site and reload:
```bash
sudo ln -s /etc/nginx/sites-available/mala-backend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

9. **Log rotation**
Systemd journals logs by default. For flat files, add `--access-logfile` / `--error-logfile` to Gunicorn or rely on `journalctl -u mala-backend`.

10. **Zero-downtime updates**
```bash
cd /opt/mala/backend
sudo -u mala git pull
sudo -u mala bash -c 'source .venv/bin/activate && pip install -r requirements.txt'
sudo -u mala bash -c 'source .venv/bin/activate && export FLASK_APP=app:create_app && flask db upgrade'
sudo systemctl restart mala-backend
```

> Tip: secure public traffic with HTTPS via Letâ€™s Encrypt (`certbot --nginx`).
