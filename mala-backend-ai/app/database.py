from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()

def init_db(app):
    """Initialize database with app"""
    db.init_app(app)
    migrate.init_app(app, db)
    
    with app.app_context():
        if app.config.get('AUTO_CREATE_DB'):
            try:
                db.create_all()
                print("✅ Database tables created")
                
                if app.config.get('SEED_ADMIN'):
                    seed_initial_data()
                    
            except Exception as e:
                print(f"⚠️ Database initialization failed: {e}")

def seed_initial_data():
    """Seed initial data to database"""
    from app.models import User, ColorPrice, Announcement, PaymentSettings
    from app.auth import make_password_hash
    from datetime import datetime
    
    try:
        # Create admin user
        if not User.query.filter(db.func.lower(User.username) == "admin").first():
            admin = User(
                username="admin",
                password=make_password_hash("admin123"),
                role="ADMIN",
                name="ผู้ดูแลระบบ",
                active=True,
                perms=["pos", "products", "users", "announcements", "reports"]
            )
            db.session.add(admin)
            print("👤 Created admin user")
        
        # Create staff user
        if not User.query.filter(db.func.lower(User.username) == "staff").first():
            staff = User(
                username="staff",
                password=make_password_hash("123456"),
                role="STAFF",
                name="พนักงานหน้าร้าน",
                active=True,
                perms=["pos", "products"]
            )
            db.session.add(staff)
            print("👤 Created staff user")
        
        # Seed color prices
        colors = {"red": 5, "green": 9, "blue": 12, "pink": 18, "purple": 22}
        for color, price in colors.items():
            if not ColorPrice.query.filter_by(color=color).first():
                cp = ColorPrice(color=color, price=price)
                db.session.add(cp)
        
        # Seed sample announcements
        if Announcement.query.count() == 0:
            announcements = [
                Announcement(
                    title="โปรโมชันเปิดร้าน ลด 10%",
                    body="เฉพาะสัปดาห์นี้เท่านั้น!",
                    published_at=datetime.utcnow(),
                    active=True
                ),
                Announcement(
                    title="แจ้งวันหยุด",
                    body="หยุดทุกวันพุธต้นเดือน",
                    published_at=datetime.utcnow(),
                    active=True
                )
            ]
            db.session.add_all(announcements)
            print("📢 Announcements seeded")
        
        # Initialize payment settings
        if not PaymentSettings.query.first():
            settings = PaymentSettings(qr_image="", qr_label="")
            db.session.add(settings)
            print("💳 Payment settings initialized")
        
        db.session.commit()
        print("✅ Initial data seeded successfully")
        
    except Exception as e:
        db.session.rollback()
        print(f"⚠️ Error seeding data: {e}")