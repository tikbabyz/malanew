import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AdminNavigation from '../../components/AdminNavigation.jsx'
import { ClockWidget, WeatherWidget } from '../../components/dashboard'
import styles from './AdminLayout.module.css'
import { 
  FaChartLine, 
  FaSync,
  FaMoon,
  FaSun,
  FaDownload,
  FaBars,
  FaTimes
} from 'react-icons/fa'
import dayjs from "dayjs"
import 'dayjs/locale/th'

dayjs.locale('th')

export default function AdminLayout() {
  const location = useLocation()
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = React.useState(false)
  
  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false)
  
  // Screen size detection
  const [screenSize, setScreenSize] = React.useState('desktop')
  
  // Detect screen size
  React.useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 768) {
        setScreenSize('mobile')
        setIsMobileSidebarOpen(false) // Auto-close sidebar on mobile
      } else if (width < 1024) {
        setScreenSize('tablet')
        setIsMobileSidebarOpen(false)
      } else {
        setScreenSize('desktop')
        setIsMobileSidebarOpen(false)
      }
    }
    
    handleResize() // Initial check
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Close mobile sidebar when route changes
  React.useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [location.pathname])
  
  // Handle mobile sidebar toggle
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen)
  }
  
  // Lock scroll when mobile sidebar is open
  React.useEffect(() => {
    if (screenSize === 'mobile' && isMobileSidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isMobileSidebarOpen, screenSize])
  
  // Apply dark mode class to document body
  React.useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('darkMode')
    } else {
      document.body.classList.remove('darkMode')
    }
    
    // Cleanup when component unmounts
    return () => {
      document.body.classList.remove('darkMode')
    }
  }, [isDarkMode])
  
  return (
    <div className={`${styles.adminContainer} ${isDarkMode ? styles.darkMode : ''} ${styles[screenSize]}`}>
      {/* Enhanced Header with Dashboard Widgets */}
      <div className={styles.adminHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerMain}>
            {/* Mobile Hamburger Menu */}
            {screenSize === 'mobile' && (
              <button 
                className={styles.hamburgerButton}
                onClick={toggleMobileSidebar}
                aria-label="เปิด/ปิดเมนู"
              >
                {isMobileSidebarOpen ? <FaTimes /> : <FaBars />}
              </button>
            )}
            
            <div className={styles.titleSection}>
              <h1 className={styles.adminTitle}>
                <FaChartLine className={styles.titleIcon} />
                <span className={styles.titleText}>
                  {screenSize === 'mobile' ? 'หม่าล่า' : 'ระบบจัดการร้านหม่าล่า'}
                </span>
              </h1>
              <p className={styles.adminSubtitle}>
                {screenSize === 'mobile' 
                  ? `Admin • ${dayjs().format("DD/MM/YYYY")}`
                  : `ยินดีต้อนรับ, Admin • ${dayjs().format("dddd, DD MMMM YYYY")}`
                }
              </p>
            </div>
          </div>
          
          {/* Header Widgets - Hidden on Mobile */}
          {screenSize !== 'mobile' && (
            <div className={styles.headerWidgets}>
              <ClockWidget />
              <WeatherWidget />
            </div>
          )}
          
          {/* Header Actions */}
          <div className={styles.headerActions}>
            <button 
              className={styles.themeToggle}
              onClick={() => setIsDarkMode(!isDarkMode)}
              title="สลับธีม"
            >
              {isDarkMode ? <FaSun /> : <FaMoon />}
            </button>
            {screenSize !== 'mobile' && (
              <>
                <button className={styles.actionButton} title="รีเฟรชข้อมูล">
                  <FaSync />
                </button>
                
              </>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumb - Hidden on Mobile */}
      {screenSize !== 'mobile' && (
        <div className={styles.breadcrumbSection}>
          <AdminNavigation variant="breadcrumb" />
        </div>
      )}
      
      {/* Main Layout */}
      <div className={styles.adminLayout}>
        {/* Mobile Sidebar Overlay */}
        {screenSize === 'mobile' && isMobileSidebarOpen && (
          <div 
            className={styles.sidebarOverlay}
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-label="ปิดเมนู"
          />
        )}
        
        {/* Sidebar Navigation */}
        <div className={`${styles.sidebarContainer} ${
          screenSize === 'mobile' && isMobileSidebarOpen ? styles.sidebarOpen : ''
        }`}>
          <AdminNavigation 
            variant="sidebar" 
            showDescriptions={screenSize === 'desktop'}
            isCompact={screenSize === 'tablet'}
            isMobile={screenSize === 'mobile'}
            className={styles.navigationSidebar}
          />
        </div>
        
        {/* Main Content */}
        <main className={styles.adminContent}>
          <div className={styles.contentWrapper}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

// ตัวอย่างในทุกหน้า
export function SomePage() {
  return (
    <div className="pageBg">
      <div className={styles.container}>
        {/* ...content... */}
      </div>
    </div>
  );
}
