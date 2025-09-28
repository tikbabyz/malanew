import os

from app import app


if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("MALA_PORT", "8000")))
    print("URL Map:", app.url_map)
    print(f"Server listening on 0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
