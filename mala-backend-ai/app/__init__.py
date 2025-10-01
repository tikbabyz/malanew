from flask import Flask
from flask_cors import CORS

from .config import Config
from .database import init_db
from .utils import init_upload_dirs, init_ai_model


def create_app(config_class: type[Config] = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Ensure upload directories exist and normalize paths
    init_upload_dirs(app)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "https://mala-restaurant.vercel.app",
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ],
            }
        },
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
    )

    init_db(app)
    init_ai_model(app)

    from .routes import register_routes

    register_routes(app)
    return app


app = create_app()

__all__ = ["app", "create_app"]
