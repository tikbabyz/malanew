import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AdminNavigation from "@features/admin/components/AdminNavigation/AdminNavigation.jsx";
import { ClockWidget } from "@features/admin/components/widgets";
import styles from './AdminLayout.module.css';
import { FaChartLine, FaSync, FaBars, FaTimes } from 'react-icons/fa';
import dayjs from 'dayjs';
import 'dayjs/locale/th';

dayjs.locale('th');

const HEADER_TITLE = {
  mobile: 'แผงควบคุม',
  desktop: 'แดชบอร์ดผู้ดูแลระบบ',
};

const HEADER_SUBTITLE = {
  mobile: () => `อัปเดตรายวัน · ${dayjs().format('DD MMM YYYY')}`,
  desktop: () => `ภาพรวมสถานะระบบ · ${dayjs().format('dddd DD MMMM YYYY')}`,
};

const REFRESH_LABEL = 'รีเฟรชข้อมูลแดชบอร์ด';
const OPEN_SIDEBAR_LABEL = 'เปิดเมนูผู้ดูแลระบบ';
const CLOSE_SIDEBAR_LABEL = 'ปิดเมนูผู้ดูแลระบบ';

export default function AdminLayout() {
  const location = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
  const [screenSize, setScreenSize] = React.useState('desktop');

  React.useEffect(() => {
    const detectBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    };

    const handleResize = () => {
      const size = detectBreakpoint();
      setScreenSize(size);
      if (size !== 'mobile') {
        setIsMobileSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    const shouldLockScroll = screenSize === 'mobile' && isMobileSidebarOpen;
    document.body.style.overflow = shouldLockScroll ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [screenSize, isMobileSidebarOpen]);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen((prev) => !prev);
  };

  const titleText = screenSize === 'mobile' ? HEADER_TITLE.mobile : HEADER_TITLE.desktop;
  const subtitleText = screenSize === 'mobile'
    ? HEADER_SUBTITLE.mobile()
    : HEADER_SUBTITLE.desktop();

  const containerClassName = [styles.adminContainer, styles[screenSize]].filter(Boolean).join(' ');
  const sidebarClassName = [
    styles.sidebarContainer,
    screenSize === 'mobile' && isMobileSidebarOpen ? styles.sidebarOpen : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClassName}>
      <header className={styles.adminHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerMain}>
            {screenSize === 'mobile' && (
              <button
                type="button"
                className={styles.hamburgerButton}
                onClick={toggleMobileSidebar}
                aria-label={isMobileSidebarOpen ? CLOSE_SIDEBAR_LABEL : OPEN_SIDEBAR_LABEL}
                aria-expanded={isMobileSidebarOpen}
                aria-controls="admin-sidebar"
              >
                {isMobileSidebarOpen ? <FaTimes /> : <FaBars />}
              </button>
            )}

            <div className={styles.titleSection}>
              <h1 className={styles.adminTitle}>
                <FaChartLine className={styles.titleIcon} />
                <span className={styles.titleText}>{titleText}</span>
              </h1>
              <p className={styles.adminSubtitle}>{subtitleText}</p>
            </div>
          </div>

          {screenSize !== 'mobile' && (
            <div className={styles.headerExtras}>
              <div className={styles.headerWidgets}>
                <ClockWidget />
              </div>
              <div className={styles.headerActions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  title={REFRESH_LABEL}
                  aria-label={REFRESH_LABEL}
                >
                  <FaSync />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {screenSize !== 'mobile' && (
        <div className={styles.breadcrumbSection}>
          <AdminNavigation variant="breadcrumb" />
        </div>
      )}

      <div className={styles.adminLayout}>
        {screenSize === 'mobile' && isMobileSidebarOpen && (
          <button
            type="button"
            className={styles.sidebarOverlay}
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label={CLOSE_SIDEBAR_LABEL}
          />
        )}

        <aside
          id="admin-sidebar"
          className={sidebarClassName}
          aria-hidden={screenSize === 'mobile' ? !isMobileSidebarOpen : undefined}
        >
          <AdminNavigation
            variant="sidebar"
            showDescriptions={screenSize === 'desktop'}
            isCompact={screenSize === 'tablet'}
            isMobile={screenSize === 'mobile'}
            className={styles.navigationSidebar}
          />
        </aside>

        <main className={styles.adminContent}>
          <div className={styles.contentWrapper}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
