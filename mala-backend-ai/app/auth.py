import hashlib
import base64
from functools import wraps
from flask import jsonify, request

def make_password_hash(plain_password):
    """Create password hash in same format as frontend: sha256:base64"""
    if not plain_password:
        return ""
    sha256_hash = hashlib.sha256(plain_password.encode('utf-8')).digest()
    b64_hash = base64.b64encode(sha256_hash).decode('ascii')
    return f"sha256:{b64_hash}"

def verify_password(plain_password, stored_hash):
    """Verify password against stored hash"""
    if not stored_hash:
        return (stored_hash or "") == (plain_password or "")
    
    if stored_hash.startswith("sha256:"):
        expected_hash = make_password_hash(plain_password)
        return stored_hash == expected_hash
    else:
        return stored_hash == plain_password

def require_auth(role=None):
    """Decorator for routes that require authentication"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # In production, implement proper JWT or session-based auth
            # This is a simplified example
            auth_header = request.headers.get('Authorization')
            if not auth_header:
                return jsonify({"error": "Unauthorized"}), 401
            
            # Verify token and role here
            # ...
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator