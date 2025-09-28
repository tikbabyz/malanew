// AdminNavigation.jsx - Modern Navigation Component for Admin Section
import React from 'react';
import { Link, NavLink, useLocation, matchPath } from 'react-router-dom';

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
import usePermissions from '../hooks/usePermissions.js';

const ADMIN_MENU_ITEMS = [
  { 
    to: '/admin', 
    label: 'แดชบอร์ด', 
    icon: FaTachometerAlt,
    description: 'ภาพรวมและสถิติ',
    permission: null // ทุกคนเข้าได้
  },
  { 
    to: '/admin/users', 
    label: 'จัดการผู้ใช้', 
    icon: FaUsers,
    description: 'ผู้ใช้งานและสิทธิ์',
    permission: 'users'
  },
  { 
    to: '/admin/products', 
    label: 'จัดการสินค้า', 
    icon: FaBoxOpen,
    description: 'สินค้าและราคา',
    permission: 'products'
  },
  { 
    to: '/admin/payments', 
    label: 'การชำระเงิน', 
    icon: FaClipboardList,
    description: 'รายการชำระเงิน',
    permission: 'payments'
  },
  { 
    to: '/admin/announcements', 
    label: 'ประกาศ', 
    icon: FaTags,
    description: 'ข่าวสารและโปรโมชั่น',
    permission: 'announcements'
  },
  { 
    to: '/admin/permissions', 
    label: 'สิทธิ์การใช้งาน', 
    icon: FaCog,
    description: 'จัดการสิทธิ์',
    permission: 'users'
  }
];

export default function AdminNavigation({ 
  variant = 'sidebar', // 'sidebar', 'horizontal', 'compact'
  showDescriptions = true,
  isCompact = false,
  isMobile = false,
  className = ''
}) {
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const [hoverId, setHoverId] = React.useState(null);
  // Filter menu items based on permissions
 const visibleMenuItems = React.useMemo(
   () => ADMIN_MENU_ITEMS.filter(item => !item.permission || hasPermission(item.permission)),
   [hasPermission]
 );

 const isActive = (to) => {
   if (to === '/admin') {
     return !!matchPath({ path: '/admin', end: true }, location.pathname);
   }
   // ให้ active กับเส้นทางย่อยทั้งหมดของเมนูนั้น
   return !!matchPath({ path: `${to}/*`, end: false }, location.pathname);
 };

 const getBreadcrumb = () => {
   const current = visibleMenuItems.find(item =>
     item.to === '/admin'
       ? matchPath({ path: '/admin', end: true }, location.pathname)
       : matchPath({ path: `${item.to}/*`, end: false }, location.pathname)
   );
   return current ? current.label : 'Admin';
 };

  const handleTooltipShow = (itemId) => isCompact && setHoverId(itemId);
 const handleTooltipHide = () => isCompact && setHoverId(null);

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
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${styles.horizontalLink} ${isActive ? styles.active : ''}`}
                title={item.description}
                aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
              >
                <Icon className={styles.linkIcon} />
                <span className={styles.linkText}>{item.label}</span>
               aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
              </NavLink>
            );
          })}
        </div>
      </nav>
    );
  }

  // Default sidebar variant
  return (
   <nav
   className={`${styles.sidebar} ${isCompact ? styles.compact : ''} ${isMobile ? styles.mobile : ''} ${className}`}
   role="navigation"
   aria-label="Admin navigation"
>
      <div className={styles.sidebarHeader}>
        <div className={styles.adminBrand}>
          <div className={styles.brandIcon}>⚙️</div>
          {(!isCompact || isMobile) && (
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>ผู้ดูแลระบบ</span>
              <span className={styles.brandSubtitle}>Mala Admin</span>
            </div>
          )}
        </div>
      </div>

      <div className={styles.navSection}>
        {(!isCompact || isMobile) && (
          <div className={styles.sectionTitle}>เมนูหลัก</div>
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
                onMouseLeave={() => handleTooltipHide(item.to)}
              >
                <Link
                  to={item.to}
                  className={`${styles.navLink} ${active ? styles.active : ''}`}
                  title={item.description}
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
                
                {/* Tooltip for compact mode */}
                {isCompact && !isMobile && hoverId === item.to && (
                  <div className={styles.tooltip}>
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

// Export menu items for use in other components
export { ADMIN_MENU_ITEMS };