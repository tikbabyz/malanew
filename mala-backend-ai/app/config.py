import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

def _resolve_ssl_path(value):
    """Resolve SSL file paths relative to BASE_DIR when needed."""
    if not value:
        return None
    candidate = Path(value)
    if candidate.is_absolute():
        return str(candidate)
    return str((BASE_DIR / candidate).resolve())


class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://root:password@localhost:3306/mala_restaurant"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    _CONNECT_ARGS = {
        'charset': 'utf8mb4',
    }

    _SSL_ARGS = {}
    _SSL_CA = _resolve_ssl_path(os.getenv('MYSQL_SSL_CA'))
    _SSL_CERT = _resolve_ssl_path(os.getenv('MYSQL_SSL_CERT'))
    _SSL_KEY = _resolve_ssl_path(os.getenv('MYSQL_SSL_KEY'))

    if _SSL_CA:
        _SSL_ARGS['ca'] = _SSL_CA
    if _SSL_CERT:
        _SSL_ARGS['cert'] = _SSL_CERT
    if _SSL_KEY:
        _SSL_ARGS['key'] = _SSL_KEY

    _SSL_DISABLED = os.getenv('MYSQL_SSL_DISABLE', '0') in {'1', 'true', 'TRUE'}
    if not _SSL_DISABLED:
        if _SSL_ARGS:
            _CONNECT_ARGS['ssl'] = _SSL_ARGS
        else:
            _CONNECT_ARGS['ssl'] = {}

    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 3600,
        'connect_args': _CONNECT_ARGS,
    }
    # Security
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    
    # Upload folders
    UPLOAD_FOLDER = BASE_DIR / "uploads" / "slips"
    PRODUCTS_UPLOAD_DIR = BASE_DIR / "uploads" / "products"
    QR_UPLOAD_DIR = BASE_DIR / "uploads" / "qr_codes"
    
    # File types
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'heif'}
    
    # AI Model
    MODEL_PATH = os.getenv("MALA_MODEL_PATH", str(BASE_DIR / "models" / "best.pt"))
    CONF = float(os.getenv("MALA_CONF", "0.35"))
    IOU = float(os.getenv("MALA_IOU", "0.50"))
    IMG_SIZE = int(os.getenv("MALA_IMG", "1024"))
    
    # Color Detection
    COLOR_OVERRIDE_MIN = float(os.getenv("MALA_COLOR_OVERRIDE_MIN", "0.60"))
    MODEL_TRUST = float(os.getenv("MALA_MODEL_TRUST", "0.62"))
    CENTER_SHRINK = float(os.getenv("MALA_CENTER_SHRINK", "0.60"))
    SV_MIN = int(os.getenv("MALA_SV_MIN", "50"))
    MIN_PIXELS = int(os.getenv("MALA_MIN_PIXELS", "60"))
    
    # ROI Settings
    RESPECT_USER_ROI = os.getenv("MALA_RESPECT_USER_ROI", "1") == "1"
    USER_PAD = float(os.getenv("MALA_USER_PAD", "0.10"))
    ROI_SCALES = [float(x.strip()) for x in os.getenv(
        "MALA_ROI_SCALES", "0.90,1.00,1.15,1.30,1.45"
    ).split(",")]
    EDGE_MARGIN = float(os.getenv("MALA_EDGE_MARGIN", "0.08"))
    DENSITY_MIN = float(os.getenv("MALA_DENSITY_MIN", "0.06"))
    DENSITY_MAX = float(os.getenv("MALA_DENSITY_MAX", "0.22"))
    
    # Database initialization
    AUTO_CREATE_DB = os.getenv("AUTO_CREATE_DB", "0") == "1"
    SEED_ADMIN = os.getenv("SEED_ADMIN", "0") == "1"
