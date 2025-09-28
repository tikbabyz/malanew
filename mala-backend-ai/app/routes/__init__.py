from flask import Flask

from .ai_detect import ai_bp
from .announcements import announcements_bp
from .auth import auth_bp
from .orders import orders_bp
from .payments import payments_bp
from .products import products_bp
from .uploads import uploads_bp
from .users import users_bp


def register_routes(app: Flask) -> None:
    app.register_blueprint(ai_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(announcements_bp)
    app.register_blueprint(uploads_bp)
