import React from "react";
import { useLocation } from "react-router-dom";
import styles from "@app/App.module.css";

function PageBreadcrumb() {
  const location = useLocation();
  const getBreadcrumbPath = () => {
    const path = location.pathname;
    if (path === '/') return 'หน้าแรก';
    if (path === '/menu') return 'เมนูอาหาร';
    if (path === '/news') return 'ข่าวสาร';
    if (path === '/login') return 'เข้าสู่ระบบ';
    if (path.startsWith('/staff')) {
      if (path === '/staff/pos') return 'Staff › ระบบขาย (เปลี่ยนเส้นทางไป Workflow)';
      if (path === '/staff/detect') return 'Staff › ตรวจจับ AI (เปลี่ยนเส้นทางไป Workflow)';
      if (path === '/staff/billing') return 'Staff › ออกบิล';
      if (path === '/staff/orders') return 'Staff › คำสั่งซื้อ';
      if (path === '/staff/workflow') return 'Staff › ระบบขายแบบครบวงจร';
    }
    if (path.startsWith('/admin')) {
      if (path === '/admin') return 'Admin › แดชบอร์ด';
      if (path === '/admin/users') return 'Admin › จัดการผู้ใช้';
      if (path === '/admin/products') return 'Admin › จัดการสินค้า';
      if (path === '/admin/permissions') return 'Admin › สิทธิ์การใช้งาน';
      if (path === '/admin/announcements') return 'Admin › ประกาศ';
      if (path === '/admin/payments') return 'Admin › การชำระเงิน';
    }
    return path;
  };

  const isHomePage = location.pathname === '/';
  
  // Don't show breadcrumb on home page since Home.jsx handles its own hero section
  if (isHomePage) {
    return null;
  }

  return (
    <nav className={styles.breadcrumb}>
      <div className={styles.breadcrumbContent}>
        <span className={styles.breadcrumbHome}>🏠</span>
        <span className={styles.breadcrumbSeparator}>›</span>
        <span className={`${styles.breadcrumbItem} ${styles.active}`}>
          {getBreadcrumbPath()}
        </span>
      </div>
    </nav>
  );
}

export default PageBreadcrumb;


