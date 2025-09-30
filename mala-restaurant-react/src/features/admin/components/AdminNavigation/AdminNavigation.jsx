import React from 'react';
import { Link, NavLink, useLocation, matchPath } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaBoxOpen,
  FaUsers,
  FaTags,
  FaClipboardList,
  FaChevronRight,
  FaCog,
} from 'react-icons/fa';
import styles from './AdminNavigation.module.css';
import usePermissions from "@shared/hooks/usePermissions.js";

const ADMIN_MENU_ITEMS = [
  {
    to: '/admin',
    label: 'แดชบอร์ด',
    icon: FaTachometerAlt,
    description: 'ภาพรวมยอดขาย คำสั่งซื้อ และสถานะระบบล่าสุด',
    permission: null,
  },
  {
    to: '/admin/users',
    label: 'จัดการผู้ใช้',
    icon: FaUsers,
    description: 'เพิ่ม ปรับสิทธิ์ และติดตามการใช้งานของทีมงาน',
    permission: 'users',
  },
  {
    to: '/admin/products',
    label: 'เมนูสินค้า',
    icon: FaBoxOpen,
    description: 'อัปเดตราคา สต็อก และรายละเอียดสินค้าได้ง่าย',
    permission: 'products',
  },
  {
    to: '/admin/payments',
    label: 'การชำระเงิน',
    icon: FaClipboardList,
    description: 'ติดตามสถานะการจ่ายเงิน การคืนเงิน และโปรโมชั่น',
    permission: 'payments',
  },
  {
    to: '/admin/announcements',
    label: 'ประกาศร้าน',
    icon: FaTags,
    description: 'สร้างและจัดการประกาศสำหรับพนักงานและลูกค้า',
    permission: 'announcements',
  },
  {
    to: '/admin/permissions',
    label: 'สิทธิ์การใช้งาน',
    icon: FaCog,
    description: 'กำหนดและควบคุมสิทธิ์การเข้าถึงในแต่ละบทบาท',
    permission: 'users',
  },
];

const BREADCRUMB_HOME = 'หน้าแรก';
const BREADCRUMB_ROOT = 'แดชบอร์ด';

export default function AdminNavigation({
  variant = 'sidebar',
  showDescriptions = true,
  isCompact = false,
  isMobile = false,
  className = '',
}) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const [hoverId, setHoverId] = React.useState(null);

  const visibleMenuItems = React.useMemo(
    () => ADMIN_MENU_ITEMS.filter((item) => !item.permission || hasPermission(item.permission)),
    [hasPermission]
  );

  const isActive = React.useCallback(
    (to) => {
      if (to === '/admin') {
        return !!matchPath({ path: '/admin', end: true }, location.pathname);
      }
      return !!matchPath({ path: `${to}/*`, end: false }, location.pathname);
    },
    [location.pathname]
  );

  const currentBreadcrumb = React.useMemo(() => {
    const current = visibleMenuItems.find((item) =>
      item.to === '/admin'
        ? matchPath({ path: '/admin', end: true }, location.pathname)
        : matchPath({ path: `${item.to}/*`, end: false }, location.pathname)
    );
    return current ? current.label : BREADCRUMB_ROOT;
  }, [location.pathname, visibleMenuItems]);

  const handleTooltipShow = React.useCallback(
    (itemId) => {
      if (isCompact) {
        setHoverId(itemId);
      }
    },
    [isCompact]
  );

  const handleTooltipHide = React.useCallback(() => {
    if (isCompact) {
      setHoverId(null);
    }
  }, [isCompact]);

  if (variant === 'breadcrumb') {
    return (
      <div className={`${styles.breadcrumb} ${className}`} aria-label="เส้นทางการนำทาง">
        <span className={styles.breadcrumbHome}>{BREADCRUMB_HOME}</span>
        <FaChevronRight className={styles.breadcrumbSeparator} />
        <span className={styles.breadcrumbText}>{BREADCRUMB_ROOT}</span>
        <FaChevronRight className={styles.breadcrumbSeparator} />
        <span className={`${styles.breadcrumbText} ${styles.breadcrumbActive}`}>
          {currentBreadcrumb}
        </span>
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <nav className={`${styles.horizontalNav} ${className}`} aria-label="เมนูผู้ดูแลแบบแนวนอน">
        <div className={styles.navScrollContainer}>
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${styles.horizontalLink} ${isActive ? styles.active : ''}`}
                title={item.description}
              >
                <Icon className={styles.linkIcon} />
                <span className={styles.linkText}>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      className={`${styles.sidebar} ${isCompact ? styles.compact : ''} ${isMobile ? styles.mobile : ''} ${className}`.trim()}
      role="navigation"
      aria-label="เมนูผู้ดูแลระบบ"
    >
      <div className={styles.sidebarHeader}>
        <div className={styles.adminBrand}>
          <div className={styles.brandIcon}>MA</div>
          {(!isCompact || isMobile) && (
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>Mala Admin</span>
              <span className={styles.brandSubtitle}>ศูนย์ควบคุมร้านอาหาร</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.navSection}>
        {(!isCompact || isMobile) && (
          <div className={styles.sectionTitle}>เมนูจัดการ</div>
        )}
        <div className={styles.navItems}>
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);

            return (
              <div
                key={item.to}
                className={styles.navItemWrapper}
                onMouseEnter={() => handleTooltipShow(item.to)}
                onMouseLeave={handleTooltipHide}
              >
                <Link
                  to={item.to}
                  className={`${styles.navLink} ${active ? styles.active : ''}`}
                  title={item.description}
                  aria-current={active ? 'page' : undefined}
                >
                  <div className={styles.linkIconContainer}>
                    <Icon className={styles.linkIcon} />
                  </div>
                  {(!isCompact || isMobile) && (
                    <div className={styles.linkContent}>
                      <span className={styles.linkText}>{item.label}</span>
                      {showDescriptions && (
                        <span className={styles.linkDescription}>{item.description}</span>
                      )}
                    </div>
                  )}
                  {active && <div className={styles.activeIndicator} />}
                </Link>

                {isCompact && !isMobile && hoverId === item.to && (
                  <div className={styles.tooltip} role="tooltip">
                    <div className={styles.tooltipContent}>
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export { ADMIN_MENU_ITEMS };
