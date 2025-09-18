import React from "react";
import { 
  FaChartLine, 
  FaShoppingCart, 
  FaMoneyBillWave, 
  FaUsers,
  FaTrendingUp,
  FaTrendingDown,
  FaCalendarAlt,
  FaSearch,
  FaRefresh,
  FaDownload,
  FaEye,
  FaClock,
  FaThermometerHalf,
  FaCloudSun,
  FaWind,
  FaTint,
  FaBell,
  FaFire,
  FaMoon,
  FaSun
} from 'react-icons/fa';
import API from "../../services/api";
import styles from "./Dashboard.module.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import minMax from "dayjs/plugin/minMax";
import relativeTime from "dayjs/plugin/relativeTime";
import 'dayjs/locale/th';

dayjs.extend(minMax);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(relativeTime);
dayjs.locale('th');

/* ===== helpers ===== */
function daysBetweenISO(startISO, endISO) {
  const out = [];
  let d = dayjs(startISO, "YYYY-MM-DD").startOf("day");
  const e = dayjs(endISO, "YYYY-MM-DD").endOf("day");
  while (d.isSameOrBefore(e, "day")) {
    out.push(d.format("YYYY-MM-DD")); // เก็บ ISO
    d = d.add(1, "day");
  }
  return out;
}

export default function AdminDashboard() {
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  
  // Real-time clock state
  const [currentTime, setCurrentTime] = React.useState(dayjs());
  
  // Weather state (mock data for demo)
  const [weather, setWeather] = React.useState({
    temp: 32,
    condition: 'sunny',
    humidity: 65,
    windSpeed: 8,
    location: 'กรุงเทพฯ'
  });
  
  // Update time every second
  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate weather updates every 30 seconds
  React.useEffect(() => {
    const timer = setInterval(() => {
      setWeather(prev => ({
        ...prev,
        temp: Math.floor(Math.random() * 10) + 28, // 28-37°C
        humidity: Math.floor(Math.random() * 30) + 50, // 50-80%
        windSpeed: Math.floor(Math.random() * 15) + 5 // 5-20 km/h
      }));
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ดึง orders จาก API
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const [startDate, setStartDate] = React.useState(
    dayjs().subtract(7, "day").format("YYYY-MM-DD")
  );
  const [endDate, setEndDate] = React.useState(dayjs().format("YYYY-MM-DD"));

  // โหลด orders เมื่อช่วงวันที่เปลี่ยน
  React.useEffect(() => {
    setLoading(true);
    API.orders.list({ startDate, endDate })
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  // คัดกรองออเดอร์ตามช่วงวันที่ (ถ้า API ไม่รองรับ filter ให้ใช้ตรงนี้)
  const filteredOrders = React.useMemo(() => {
    const start = dayjs(startDate, "YYYY-MM-DD").startOf("day");
    const end = dayjs(endDate, "YYYY-MM-DD").endOf("day");
    return (orders || []).filter((o) => {
      const dt = dayjs(o.createdAt);
      return dt.isSameOrAfter(start) && dt.isSameOrBefore(end);
    });
  }, [orders, startDate, endDate]);

  // รายชื่อเดือนภาษาไทย (ตัวย่อ)
  const TH_MONTHS = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];

  // ====== ทำ dailyStats ด้วย key = ISO แล้วค่อยฟอร์แมตตอนแสดง ======
  const dailyStats = React.useMemo(() => {
    const days = daysBetweenISO(startDate, endDate);
    const base = Object.fromEntries(
      days.map((iso) => [iso, { dateISO: iso, orders: 0, revenue: 0 }])
    );
    for (const o of filteredOrders) {
      const iso = dayjs(o.createdAt).format("YYYY-MM-DD");
      if (!base[iso]) continue;
      base[iso].orders += 1;
      base[iso].revenue += Number(o.total || 0);
    }
    return Object.values(base);
  }, [filteredOrders, startDate, endDate]);

  // สรุปยอดรวม
  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce(
    (sum, o) => sum + Number(o.total || 0),
    0
  );

  // เปอร์เซ็นต์เปลี่ยนแปลง: วันล่าสุด vs ก่อนหน้า
  const lastDay = dailyStats[dailyStats.length - 1];
  const prevDay = dailyStats[dailyStats.length - 2];
  const orderChange =
    lastDay && prevDay
      ? (
          ((lastDay.orders - prevDay.orders) / (prevDay.orders || 1)) *
          100
        ).toFixed(1) + "%"
      : "0%";
  const revenueChange =
    lastDay && prevDay
      ? (
          ((lastDay.revenue - prevDay.revenue) / (prevDay.revenue || 1)) *
          100
        ).toFixed(1) + "%"
      : "0%";

  const stats = [
    {
      title: "จำนวนออเดอร์ทั้งหมด",
      value: totalOrders,
      change: orderChange,
      isUp: lastDay && prevDay ? lastDay.orders >= prevDay.orders : null,
    },
    {
      title: "รายรับ",
      value: `฿${totalRevenue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      change: revenueChange,
      isUp: lastDay && prevDay ? lastDay.revenue >= prevDay.revenue : null,
    },
  ];

  /* ===== Responsive tick: ถ้ากว้าง ≤ 480px ให้สั้นเป็น “D ม.ค.” ไม่งั้น “DD/MM” ===== */
  const chartWrapRef = React.useRef(null);
  const [chartW, setChartW] = React.useState(0);
  React.useEffect(() => {
    const el = chartWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartW(el.clientWidth));
    ro.observe(el);
    setChartW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const compact = chartW <= 480;
  const fmtTick = React.useCallback(
    (iso) => {
      const d = dayjs(iso);
      return compact
        ? `${d.date()} ${TH_MONTHS[d.month()]}`
        : d.format("DD/MM");
    },
    [compact]
  );
  const fmtTooltipLabel = (iso) => dayjs(iso).format("DD/MM/YYYY");

  // Quick actions data
  const quickActions = [
    { 
      icon: FaUsers, 
      label: 'จัดการผู้ใช้', 
      path: '/admin/users',
      color: '#3b82f6'
    },
    { 
      icon: FaShoppingCart, 
      label: 'จัดการสินค้า', 
      path: '/admin/products',
      color: '#10b981'
    },
    { 
      icon: FaMoneyBillWave, 
      label: 'การชำระเงิน', 
      path: '/admin/payments',
      color: '#f59e0b'
    },
    { 
      icon: FaEye, 
      label: 'ดูคำสั่งซื้อ', 
      path: '/staff/orders',
      color: '#ef4444'
    }
  ];

  // Mock top products data
  const topProducts = React.useMemo(() => {
    const products = [
      { name: 'หม่าล่าต้นตำรับ', sales: 145, revenue: 72500, color: '#ef4444' },
      { name: 'หม่าล่าพิเศษ', sales: 98, revenue: 58800, color: '#f59e0b' },
      { name: 'เนื้อหม่าล่า', sales: 87, revenue: 52200, color: '#10b981' },
      { name: 'ทะเลหม่าล่า', sales: 65, revenue: 45500, color: '#3b82f6' },
      { name: 'ผักหม่าล่า', sales: 43, revenue: 25800, color: '#8b5cf6' }
    ];
    return products;
  }, []);

  // Performance metrics
  const performanceMetrics = React.useMemo(() => {
    const avgOrderValue = totalRevenue / (totalOrders || 1);
    const todayOrders = filteredOrders.filter(o => 
      dayjs(o.createdAt).isSame(dayjs(), 'day')
    ).length;
    
    return [
      {
        title: 'ค่าเฉลี่ยต่อออเดอร์',
        value: `฿${avgOrderValue.toFixed(0)}`,
        icon: FaMoneyBillWave,
        color: '#10b981',
        change: '+5.2%'
      },
      {
        title: 'ออเดอร์วันนี้',
        value: todayOrders,
        icon: FaShoppingCart,
        color: '#3b82f6',
        change: '+12.1%'
      },
      {
        title: 'อัตราการแปลง',
        value: '73.5%',
        icon: FaTrendingUp,
        color: '#f59e0b',
        change: '+2.8%'
      },
      {
        title: 'ผู้ใช้ออนไลน์',
        value: '24',
        icon: FaUsers,
        color: '#ef4444',
        change: 'แบบเรียลไทม์'
      }
    ];
  }, [totalRevenue, totalOrders, filteredOrders]);

  // Activity feed data
  const activityFeed = React.useMemo(() => {
    const activities = [
      {
        id: 1,
        type: 'order',
        icon: FaShoppingCart,
        message: 'ออเดอร์ใหม่ #1234 จากลูกค้า นายสมชาย',
        time: dayjs().subtract(5, 'minutes'),
        color: '#10b981'
      },
      {
        id: 2,
        type: 'payment',
        icon: FaMoneyBillWave,
        message: 'ชำระเงินสำเร็จ ออเดอร์ #1233 จำนวน ฿480',
        time: dayjs().subtract(12, 'minutes'),
        color: '#f59e0b'
      },
      {
        id: 3,
        type: 'user',
        icon: FaUsers,
        message: 'ผู้ใช้ใหม่ลงทะเบียน: นางสาวมารี',
        time: dayjs().subtract(25, 'minutes'),
        color: '#3b82f6'
      },
      {
        id: 4,
        type: 'order',
        icon: FaShoppingCart,
        message: 'ออเดอร์ #1232 เสร็จสิ้น รอการส่งมอบ',
        time: dayjs().subtract(38, 'minutes'),
        color: '#10b981'
      },
      {
        id: 5,
        type: 'alert',
        icon: FaBell,
        message: 'สินค้า "หม่าล่าต้นตำรับ" เหลือน้อย (5 ชิ้น)',
        time: dayjs().subtract(45, 'minutes'),
        color: '#ef4444'
      }
    ];
    return activities;
  }, []);

  return (
    <div className={`${styles.dashboardContainer} ${isDarkMode ? styles.darkMode : ''}`}>
      {/* Dashboard Header */}
      <div className={styles.dashboardHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerMain}>
            <h1 className={styles.dashboardTitle}>
              <FaChartLine className={styles.titleIcon} />
              ภาพรวมร้านหม่าล่า
            </h1>
            <p className={styles.dashboardSubtitle}>
              ยินดีต้อนรับกลับมา, Admin • {currentTime.format("dddd, DD MMMM YYYY")}
            </p>
          </div>
          <div className={styles.widgetsContainer}>
            {/* Clock Widget */}
            <div className={styles.clockWidget}>
              <div className={styles.widgetIcon}>
                <FaClock />
              </div>
              <div className={styles.digitalClock}>
                <div className={styles.timeDisplay}>
                  {currentTime.format("HH:mm:ss")}
                </div>
                <div className={styles.dateDisplay}>
                  {currentTime.format("DD/MM/YYYY")}
                </div>
              </div>
            </div>
            
            {/* Weather Widget */}
            <div className={styles.weatherWidget}>
              <div className={styles.widgetIcon}>
                <FaCloudSun />
              </div>
              <div className={styles.weatherInfo}>
                <div className={styles.tempDisplay}>
                  {weather.temp}°C
                </div>
                <div className={styles.locationDisplay}>
                  {weather.location}
                </div>
                <div className={styles.weatherDetails}>
                  <span className={styles.weatherDetail}>
                    <FaTint /> {weather.humidity}%
                  </span>
                  <span className={styles.weatherDetail}>
                    <FaWind /> {weather.windSpeed} km/h
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.themeToggle}
            onClick={() => setIsDarkMode(!isDarkMode)}
            title="สลับธีม"
          >
            {isDarkMode ? <FaSun /> : <FaMoon />}
          </button>
          <button className={styles.actionButton} onClick={() => window.location.reload()}>
            <FaRefresh />
            รีเฟรช
          </button>
          <button className={styles.actionButton}>
            <FaDownload />
            ส่งออกรายงาน
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.quickActionsSection}>
        <h2 className={styles.sectionTitle}>การดำเนินการด่วน</h2>
        <div className={styles.quickActionsGrid}>
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
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
                <span className={styles.actionLabel}>{action.label}</span>
              </a>
            );
          })}
        </div>
      </div>
      <div className={styles.filtersSection}>
        <h2 className={styles.sectionTitle}>
          <FaCalendarAlt className={styles.sectionIcon} />
          ช่วงวันที่
        </h2>
        <div className={styles.filtersCard}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>
              <span>ตั้งแต่</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={styles.dateInput}
              />
            </label>

            <label className={styles.filterLabel}>
              <span>ถึง</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={styles.dateInput}
              />
            </label>

            <button 
              className={styles.searchButton}
              onClick={() => {}}
              disabled={loading}
            >
              <FaSearch />
              ค้นหา
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      {loading ? (
        <div className={styles.loadingSection}>
          <div className={styles.loadingSpinner}>
            <FaRefresh className={styles.spinningIcon} />
          </div>
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <>
          <div className={styles.statsSection}>
            <h2 className={styles.sectionTitle}>
              <FaTrendingUp className={styles.sectionIcon} />
              สถิติสำคัญ
            </h2>
            <div className={styles.statsGrid}>
              {stats.map((stat, idx) => (
                <div key={idx} className={styles.statsCard}>
                  <div className={styles.statsHeader}>
                    <div className={styles.statsTitle}>{stat.title}</div>
                    {stat.change && (
                      <div
                        className={`${styles.statsChange} ${
                          stat.isUp ? styles.statsUp : styles.statsDown
                        }`}
                      >
                        {stat.isUp === null ? "" : stat.isUp ? 
                          <FaTrendingUp /> : <FaTrendingDown />
                        }
                        {stat.change}
                      </div>
                    )}
                  </div>
                  <div className={styles.statsValue}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Chart Section */}
          <div className={styles.chartSection}>
            <h2 className={styles.sectionTitle}>
              <FaChartLine className={styles.sectionIcon} />
              แผนภูมิรายรับ
            </h2>
            <div className={styles.chartCard} ref={chartWrapRef}>
              {dailyStats.length === 0 ? (
                <div className={styles.noDataMessage}>
                  <p>ไม่มีข้อมูลในช่วงวันที่ที่เลือก</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dateISO"
                      tickFormatter={fmtTick}
                      interval="preserveStartEnd"
                      minTickGap={compact ? 12 : 6}
                    />
                    <YAxis yAxisId="left" allowDecimals={false} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(v) => `฿${v.toLocaleString()}`}
                    />
                    <Tooltip
                      labelFormatter={fmtTooltipLabel}
                      formatter={(value, name) => {
                        if (name === "รายรับ (บาท)") {
                          return [`฿${Number(value).toLocaleString()}`, name];
                        }
                        return [value, name];
                      }}
                    />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="orders"
                      stroke="#dc2626"
                      strokeWidth={3}
                      name="จำนวนออเดอร์"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#16a34a"
                      strokeWidth={3}
                      name="รายรับ (บาท)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className={styles.performanceSection}>
            <h2 className={styles.sectionTitle}>
              <FaFire className={styles.sectionIcon} />
              เมตริกส์ประสิทธิภาพ
            </h2>
            <div className={styles.metricsGrid}>
              {performanceMetrics.map((metric, idx) => {
                const Icon = metric.icon;
                return (
                  <div key={idx} className={styles.metricCard}>
                    <div className={styles.metricIcon} style={{ backgroundColor: metric.color }}>
                      <Icon />
                    </div>
                    <div className={styles.metricContent}>
                      <div className={styles.metricTitle}>{metric.title}</div>
                      <div className={styles.metricValue}>{metric.value}</div>
                      <div className={styles.metricChange}>{metric.change}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Products Chart */}
          <div className={styles.topProductsSection}>
            <h2 className={styles.sectionTitle}>
              <FaFire className={styles.sectionIcon} />
              สินค้าขายดี
            </h2>
            <div className={styles.chartsContainer}>
              <div className={styles.pieChartContainer}>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={topProducts}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={5}
                      dataKey="sales"
                    >
                      {topProducts.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [`${value} ออเดอร์`, 'ยอดขาย']}
                      labelFormatter={(label) => topProducts[label]?.name}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.productsList}>
                {topProducts.map((product, idx) => (
                  <div key={idx} className={styles.productItem}>
                    <div 
                      className={styles.productColor}
                      style={{ backgroundColor: product.color }}
                    ></div>
                    <div className={styles.productInfo}>
                      <div className={styles.productName}>{product.name}</div>
                      <div className={styles.productStats}>
                        {product.sales} ออเดอร์ • ฿{product.revenue.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className={styles.recentOrdersSection}>
            <h2 className={styles.sectionTitle}>
              <FaShoppingCart className={styles.sectionIcon} />
              ออเดอร์ล่าสุด
            </h2>
            <div className={styles.tableCard}>
              {filteredOrders.length === 0 ? (
                <div className={styles.noDataMessage}>
                  <p>ไม่มีออเดอร์ในช่วงวันที่ที่เลือก</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.ordersTable}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>วันที่</th>
                        <th>ลูกค้า</th>
                        <th>รายการ</th>
                        <th>ยอดรวม</th>
                        <th>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.slice(0, 10).map((order) => (
                        <tr key={order.id}>
                          <td className={styles.orderId}>#{order.id}</td>
                          <td className={styles.orderDate}>
                            {dayjs(order.createdAt).format("DD/MM/YY HH:mm")}
                          </td>
                          <td className={styles.customerName}>
                            {order.customerName || 'ลูกค้าทั่วไป'}
                          </td>
                          <td className={styles.orderItems}>
                            {(order.items || []).length} รายการ
                          </td>
                          <td className={styles.orderTotal}>
                            ฿{Number(order.total || 0).toLocaleString()}
                          </td>
                          <td className={styles.orderStatus}>
                            <span className={`${styles.statusBadge} ${styles[`status${order.status || 'pending'}`]}`}>
                              {order.status === 'completed' ? 'เสร็จสิ้น' : 
                               order.status === 'pending' ? 'รอดำเนินการ' : 
                               order.status === 'processing' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className={styles.activitySection}>
            <h2 className={styles.sectionTitle}>
              <FaBell className={styles.sectionIcon} />
              กิจกรรมล่าสุด
            </h2>
            <div className={styles.activityCard}>
              <div className={styles.activityList}>
                {activityFeed.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <div key={activity.id} className={styles.activityItem}>
                      <div 
                        className={styles.activityIcon}
                        style={{ backgroundColor: activity.color }}
                      >
                        <Icon />
                      </div>
                      <div className={styles.activityContent}>
                        <div className={styles.activityMessage}>
                          {activity.message}
                        </div>
                        <div className={styles.activityTime}>
                          {activity.time.fromNow()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.activityFooter}>
                <button className={styles.viewAllButton}>
                  ดูทั้งหมด
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
