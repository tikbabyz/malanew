// src/app/layout/AppNav.jsx
import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@store/auth.js";
import ConfirmModal from "@shared/components/ConfirmModal/ConfirmModal.jsx";
import styles from "./AppNav.module.css";

function AppNav() {
  const [open, setOpen] = React.useState(false);
  const [showLogout, setShowLogout] = React.useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const close = () => setOpen(false);
  const toggle = () => setOpen((o) => !o);
  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    console.log('🚪 AppNav logout triggered');
    setShowLogout(false);
    logout();
    // Navigate ไปหน้า login โดยไม่ส่ง state เพื่อป้องกันการ redirect กลับ
    console.log('🔄 Navigating to login page after logout');
    navigate("/login", { replace: true });
  };

  const renderNavLinks = () => {
    if (user?.role === "STAFF") {
      return (
        <>
          <Link to="/staff/workflow" onClick={close} className={`${styles.navLink} ${styles.staffLink}`}>
            <span className={styles.navIcon}>🔄</span>
            <span className={styles.navText}>ระบบขายครบวงจร</span>
          </Link>
          <Link to="/staff/orders" onClick={close} className={`${styles.navLink} ${styles.staffLink}`}>
            <span className={styles.navIcon}>📄</span>
            <span className={styles.navText}>ใบเสร็จ</span>
          </Link>
        </>
      );
    }
    
    if (location.pathname.startsWith("/admin") && user?.role === "ADMIN") {
      return (
        <Link to="/admin" onClick={close} className={`${styles.navLink} ${styles.adminLink}`}>
          <span className={styles.navIcon}>⚙️</span>
          <span className={styles.navText}>ผู้ดูแลระบบ</span>
        </Link>
      );
    }
    
    // Default public links
    return (
      <>
        <Link
          to="/"
          onClick={close}
          className={`${styles.navLink} ${isActive("/") ? styles.active : ""}`}
        >
          <span className={styles.navIcon}>🏠</span>
          <span className={styles.navText}>หน้าแรก</span>
        </Link>
        <Link
          to="/menu"
          onClick={close}
          className={`${styles.navLink} ${isActive("/menu") ? styles.active : ""}`}
        >
          <span className={styles.navIcon}>🍜</span>
          <span className={styles.navText}>เมนูอาหาร</span>
        </Link>
        <Link
          to="/news"
          onClick={close}
          className={`${styles.navLink} ${isActive("/news") ? styles.active : ""}`}
        >
          <span className={styles.navIcon}>📢</span>
          <span className={styles.navText}>ประกาศ & โปรโมชั่น</span>
        </Link>
      </>
    );
  };

  return (
    <nav className={styles.modernNavbar}>
      <div className={styles.navbarContainer}>
        {/* Brand Logo */}
        <div className={styles.brandSection}>
          <Link className={styles.brandLogo} to="/" onClick={close}>
            <div className={styles.logoIcon}>🌶️</div>
            <div className={styles.brandText}>
              <span className={styles.brandMain}>หม่าล่า</span>
              <span className={styles.brandSub}>RESTAURANT</span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className={styles.navCenter}>
          <div className={styles.navMenuDesktop}>
            {renderNavLinks()}
          </div>
        </div>

        {/* Right Section */}
        <div className={styles.navRight}>
          {!user ? (
            <Link to="/login" onClick={close} className={styles.loginButton}>
              <span className={styles.loginIcon}>👤</span>
              เข้าสู่ระบบ
            </Link>
          ) : (
            <div className={styles.userSection}>
              <div className={styles.userProfile}>
                <div className={styles.userAvatar}>
                  {(user.username || "U").slice(0, 1).toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.username}</span>
                  <span className={styles.userRole}>
                    {user.role === "ADMIN" ? "ผู้ดูแล" : "พนักงาน"}
                  </span>
                </div>
              </div>
              <button
                className={styles.logoutButton}
                onClick={() => {
                  close();
                  setShowLogout(true);
                }}
                title="ออกจากระบบ"
              >
                <span className={styles.logoutIcon}>🚪</span>
              </button>
            </div>
          )}

          {/* Mobile Hamburger */}
          <button
            className={`${styles.mobileHamburger} ${open ? styles.active : ""}`}
            aria-label="เมนู"
            onClick={toggle}
          >
            <span className={styles.hamburgerLine}></span>
            <span className={styles.hamburgerLine}></span>
            <span className={styles.hamburgerLine}></span>
          </button>
        </div>

        {/* Mobile Navigation Overlay */}
        <div className={`${styles.mobileNavOverlay} ${open ? styles.open : ""}`}>
          <div className={styles.mobileNavContent}>
            <div className={styles.mobileNavHeader}>
              <div className={styles.mobileBrand}>
                <span className={styles.mobileLogo}>🌶️</span>
                <span>หม่าล่า เรสเทอรอง</span>
              </div>
              <button className={styles.mobileClose} onClick={close}>✕</button>
            </div>
            <div className={styles.mobileNavMenu}>
              {renderNavLinks()}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showLogout}
        title="ยืนยันการออกจากระบบ"
        message="คุณต้องการออกจากระบบตอนนี้หรือไม่?"
        confirmText="ออกจากระบบ"
        cancelText="ยกเลิก"
        danger
        icon="warning"
        onCancel={() => setShowLogout(false)}
        onConfirm={handleLogout}
      />
    </nav>
  );
}

export default AppNav;

