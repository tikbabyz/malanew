// AdminNavigation.jsx - Modern Navigation Component for Admin Section
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FaTachometerAlt, 
  FaBoxOpen, 
  FaUsers, 
  FaTags, 
  FaClipboardList,
  FaChevronRight,
  FaBell,
  FaCog
} from 'react-icons/fa';
import styles from './AdminNavigation.module.css';

const ADMIN_MENU_ITEMS = [
  { 
    to: '/admin', 
    label: 'แดชบอร์ด', 
    icon: FaTachometerAlt,
    description: 'ภาพรวมและสถิติ'
  },
  { 
    to: '/admin/users', 
    label: 'จัดการผู้ใช้', 
    icon: FaUsers,
    description: 'ผู้ใช้งานและสิทธิ์'
  },
  { 
    to: '/admin/products', 
    label: 'จัดการสินค้า', 
    icon: FaBoxOpen,
    description: 'สินค้าและราคา'
  },
  { 
    to: '/admin/payments', 
    label: 'การชำระเงิน', 
    icon: FaClipboardList,
    description: 'รายการชำระเงิน'
  },
  { 
    to: '/admin/announcements', 
    label: 'ประกาศ', 
    icon: FaTags,
    description: 'ข่าวสารและโปรโมชั่น'
  },
  { 
    to: '/admin/permissions', 
    label: 'สิทธิ์การใช้งาน', 
    icon: FaCog,
    description: 'จัดการสิทธิ์'
  }
];

export default function AdminNavigation({ 
  variant = 'sidebar', // 'sidebar', 'horizontal', 'compact'
  showDescriptions = true,
  className = ''
}) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const getBreadcrumb = () => {
    const currentItem = ADMIN_MENU_ITEMS.find(item => 
      item.to === '/admin' 
        ? location.pathname === '/admin'
        : location.pathname.startsWith(item.to)
    );
    return currentItem ? currentItem.label : 'Admin';
  };

  if (variant === 'breadcrumb') {
    return (
      <div className={`${styles.breadcrumb} ${className}`}>
        <span className={styles.breadcrumbHome}>🏠</span>
        <FaChevronRight className={styles.breadcrumbSeparator} />
        <span className={styles.breadcrumbText}>Admin</span>
        <FaChevronRight className={styles.breadcrumbSeparator} />
        <span className={`${styles.breadcrumbText} ${styles.breadcrumbActive}`}>
          {getBreadcrumb()}
        </span>
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <nav className={`${styles.horizontalNav} ${className}`}>
        <div className={styles.navScrollContainer}>
          {ADMIN_MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`${styles.horizontalLink} ${active ? styles.active : ''}`}
                title={item.description}
              >
                <Icon className={styles.linkIcon} />
                <span className={styles.linkText}>{item.label}</span>
                {active && <div className={styles.activeIndicator} />}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  // Default sidebar variant
  return (
    <nav className={`${styles.sidebar} ${variant === 'compact' ? styles.compact : ''} ${className}`}>
      <div className={styles.sidebarHeader}>
        <div className={styles.adminBrand}>
          <div className={styles.brandIcon}>⚙️</div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>ผู้ดูแลระบบ</span>
            <span className={styles.brandSubtitle}>Mala Admin</span>
          </div>
        </div>
      </div>

      <div className={styles.navSection}>
        <div className={styles.sectionTitle}>เมนูหลัก</div>
        <div className={styles.navItems}>
          {ADMIN_MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`${styles.navLink} ${active ? styles.active : ''}`}
                title={item.description}
              >
                <div className={styles.linkIconContainer}>
                  <Icon className={styles.linkIcon} />
                </div>
                <div className={styles.linkContent}>
                  <span className={styles.linkText}>{item.label}</span>
                  {showDescriptions && variant !== 'compact' && (
                    <span className={styles.linkDescription}>{item.description}</span>
                  )}
                </div>
                <FaChevronRight className={styles.linkArrow} />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Export menu items for use in other components
export { ADMIN_MENU_ITEMS };