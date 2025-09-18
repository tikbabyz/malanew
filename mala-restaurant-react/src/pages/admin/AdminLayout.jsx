import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AdminNavigation from '../../components/AdminNavigation.jsx'
import { ClockWidget, WeatherWidget, StatsCard } from '../../components/dashboard'
import { useDashboardData } from '../../hooks/useDashboard'
import styles from './AdminLayout.module.css'
import { 
  FaChartLine, 
  FaShoppingCart, 
  FaMoneyBillWave, 
  FaUsers,
  FaArrowUp,
  FaBell,
  FaFire,
  FaSync,
  FaEye
} from 'react-icons/fa'
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import 'dayjs/locale/th'

dayjs.extend(relativeTime)
dayjs.locale('th')

export default function AdminLayout() {
  const location = useLocation()
  
  // Use comprehensive dashboard data from API
  const { orders, users, products, loading, refetchAll } = useDashboardData()

  // Quick actions for dashboard with real data
  const quickActions = [
    { 
      icon: FaUsers, 
      label: 'จัดการผู้ใช้', 
      path: '/admin/users',
      color: '#3b82f6',
      count: users.metrics.totalUsers
    },
    { 
      icon: FaShoppingCart, 
      label: 'จัดการสินค้า', 
      path: '/admin/products',
      color: '#10b981',
      count: products.metrics.totalProducts
    },
    { 
      icon: FaMoneyBillWave, 
      label: 'การชำระเงิน', 
      path: '/admin/payments',
      color: '#f59e0b',
      count: orders.metrics.totalRevenue > 999999 
        ? `฿${(orders.metrics.totalRevenue / 1000000).toFixed(1)}M`
        : orders.metrics.totalRevenue > 999 
          ? `฿${(orders.metrics.totalRevenue / 1000).toFixed(0)}K`
          : `฿${orders.metrics.totalRevenue.toLocaleString()}`
    }
  ]

  // Check if on dashboard route
  const isDashboardRoute = location.pathname === '/admin' || location.pathname === '/admin/'
  
  return (
    <div className={styles.adminContainer}>
      {/* Enhanced Header with Dashboard Widgets */}
      <div className={styles.adminHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerMain}>
            <h1 className={styles.adminTitle}>
              <FaChartLine className={styles.titleIcon} />
              ระบบจัดการร้านหม่าล่า
            </h1>
            <p className={styles.adminSubtitle}>
              ยินดีต้อนรับ, Admin • {dayjs().format("dddd, DD MMMM YYYY")}
            </p>
          </div>
          
          {/* Header Widgets */}
          <div className={styles.headerWidgets}>
            <ClockWidget />
            <WeatherWidget />
          </div>
          
          {/* Header Actions */}
          <div className={styles.headerActions}>
            <button className={styles.actionButton} onClick={refetchAll}>
              <FaSync />
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className={styles.breadcrumbSection}>
        <AdminNavigation variant="breadcrumb" />
      </div>
      
      {/* Main Layout */}
      <div className={styles.adminLayout}>
        {/* Sidebar Navigation */}
        <AdminNavigation 
          variant="sidebar" 
          showDescriptions={true}
          className={styles.navigationSidebar}
        />
        
        {/* Main Content */}
        <main className={styles.adminContent}>
          {isDashboardRoute ? (
            /* Dashboard Content */
            <div className={styles.dashboardContent}>
              {/* Quick Actions */}
              <div className={styles.quickActionsSection}>
                <h2 className={styles.sectionTitle}>
                  <FaFire className={styles.sectionIcon} />
                  การดำเนินการด่วน
                </h2>
                <div className={styles.quickActionsGrid}>
                  {quickActions.map((action, idx) => {
                    const Icon = action.icon
                    return (
                      <a
                        key={idx}
                        href={action.path}
                        className={styles.quickActionCard}
                        style={{ '--action-color': action.color }}
                      >
                        <div className={styles.actionIcon}>
                          <Icon />
                        </div>
                        <div className={styles.actionContent}>
                          <span className={styles.actionLabel}>{action.label}</span>
                          <span className={styles.actionCount}>{action.count}</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>

              {/* Stats Overview */}
              <div className={styles.statsSection}>
                <h2 className={styles.sectionTitle}>
                  <FaArrowUp className={styles.sectionIcon} />
                  สถิติวันนี้
                </h2>
                <div className={styles.statsGrid}>
                  <StatsCard
                    icon={FaShoppingCart}
                    title="ออเดอร์วันนี้"
                    value={orders.metrics.todayOrders}
                    change={`จาก ${orders.metrics.totalOrders} ออเดอร์ทั้งหมด`}
                    color="#3b82f6"
                  />
                  
                  <StatsCard
                    icon={FaMoneyBillWave}
                    title="ค่าเฉลี่ยต่อออเดอร์"
                    value={`฿${orders.metrics.avgOrderValue.toFixed(0)}`}
                    change={`รายรับรวม ฿${orders.metrics.totalRevenue.toLocaleString()}`}
                    color="#10b981"
                  />
                  
                  <StatsCard
                    icon={FaUsers}
                    title="ผู้ใช้ทั้งหมด"
                    value={users.metrics.totalUsers}
                    change={`ใหม่วันนี้ ${users.metrics.newUsersToday} คน`}
                    color="#f59e0b"
                  />
                  
                  <StatsCard
                    icon={FaArrowUp}
                    title="สินค้าคงเหลือ"
                    value={products.metrics.totalProducts}
                    change={`สต็อกต่ำ ${products.metrics.lowStock} รายการ`}
                    color="#ef4444"
                  />
                </div>
              </div>

              {/* Sales Chart */}
              <div className={styles.activitySection}>
                <h2 className={styles.sectionTitle}>
                  <FaChartLine className={styles.sectionIcon} />
                  กราฟการขาย 7 วันล่าสุด
                </h2>
                <div className={styles.chartContainer}>
                  {loading ? (
                    <div className={styles.loadingText}>กำลังโหลดข้อมูล...</div>
                  ) : (
                    <div className={styles.salesChart}>
                      {/* Generate 7 days of sales data */}
                      {Array.from({ length: 7 }, (_, i) => {
                        const date = dayjs().subtract(6 - i, 'day');
                        const dayOrders = orders.orders.filter(order => 
                          dayjs(order.createdAt).isSame(date, 'day')
                        );
                        const dayRevenue = dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
                        const maxRevenue = Math.max(...Array.from({ length: 7 }, (_, j) => {
                          const checkDate = dayjs().subtract(6 - j, 'day');
                          const checkOrders = orders.orders.filter(order => 
                            dayjs(order.createdAt).isSame(checkDate, 'day')
                          );
                          return checkOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
                        }));
                        const height = maxRevenue > 0 ? (dayRevenue / maxRevenue) * 100 : 0;
                        
                        return (
                          <div key={i} className={styles.chartBar}>
                            <div className={styles.barContainer}>
                              <div 
                                className={styles.bar}
                                style={{ 
                                  height: `${Math.max(height, 5)}%`,
                                  backgroundColor: i === 6 ? '#10b981' : '#3b82f6'
                                }}
                              >
                                <div className={styles.barValue}>
                                  ฿{dayRevenue.toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className={styles.barLabel}>
                              {date.format('DD/MM')}
                            </div>
                            <div className={styles.barDay}>
                              {date.format('ddd')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Chart Summary */}
                  <div className={styles.chartSummary}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>รายรับรวม 7 วัน:</span>
                      <span className={styles.summaryValue}>
                        ฿{orders.orders
                          .filter(order => dayjs(order.createdAt).isAfter(dayjs().subtract(7, 'day')))
                          .reduce((sum, order) => sum + Number(order.total || 0), 0)
                          .toLocaleString()}
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>ออเดอร์รวม 7 วัน:</span>
                      <span className={styles.summaryValue}>
                        {orders.orders
                          .filter(order => dayjs(order.createdAt).isAfter(dayjs().subtract(7, 'day')))
                          .length} ออเดอร์
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Other Pages Content */
            <div className={styles.contentWrapper}>
              <Outlet />
            </div>
          )}
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
