import React from "react";
import { 
  FaChartLine, 
  FaShoppingCart, 
  FaMoneyBillWave, 
  FaUsers,
  FaArrowUp,
  FaArrowDown,
  FaEye,
  FaBell
} from 'react-icons/fa';
import API from "@services/api";
import styles from "./Dashboard.module.css";
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

function toArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (maybe?.data && Array.isArray(maybe.data)) return maybe.data;
  if (maybe?.items && Array.isArray(maybe.items)) return maybe.items;
  return [];
}

function coerceDate(v) {
  if (!v) return null;
  const d = typeof v === 'number' ? dayjs(v) : dayjs(v);
  return d.isValid() ? d : null;
}

function normalizeOrder(raw) {
  const createdRaw = raw.createdAt ?? raw.created_at ?? raw.created ?? raw.date;
  const created = coerceDate(createdRaw);
  const totalNum = Number(
    raw.total ?? raw.amount ?? raw.grandTotal ?? raw.price ?? 0
  );
  return {
    ...raw,
    createdAt: created ? created.toISOString() : null,
    total: Number.isFinite(totalNum) ? totalNum : 0,
  };
}

/* helpers */
function daysBetweenISO(startISO, endISO) {
  const out = [];
  let d = dayjs(startISO, "YYYY-MM-DD").startOf("day");
  const e = dayjs(endISO, "YYYY-MM-DD").endOf("day");
  while (d.isSameOrBefore(e, "day")) {
    out.push(d.format("YYYY-MM-DD"));
    d = d.add(1, "day");
  }
  return out;
}

export default function AdminDashboard() {
  // state
  const [orders, setOrders] = React.useState([]);
  const [products, setProducts] = React.useState([]);
  const [users, setUsers] = React.useState([]);
  const [payments, setPayments] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // fixed ช่วงวันที่ (คงไว้ 7 วันล่าสุด สำหรับคำนวณสถิติ)
  const startDate = dayjs().subtract(7, "day").format("YYYY-MM-DD");
  const endDate = dayjs().format("YYYY-MM-DD");

  const [safeStart, safeEnd] = React.useMemo(() => {
    const s = dayjs(startDate, "YYYY-MM-DD");
    const e = dayjs(endDate, "YYYY-MM-DD");
    return s.isAfter(e)
      ? [e.format("YYYY-MM-DD"), s.format("YYYY-MM-DD")]
      : [s.format("YYYY-MM-DD"), e.format("YYYY-MM-DD")];
  }, [startDate, endDate]);

  // load data
  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [ordersRes, productsRes, usersRes, paymentsRes] = await Promise.allSettled([
        API.orders.list({ startDate: safeStart, endDate: safeEnd }),
        API.products.list(),
        API.users.list(),
        API.payments ? API.payments.list({ startDate: safeStart, endDate: safeEnd }) : Promise.resolve([])
      ]);

      if (ordersRes.status === 'fulfilled') {
        const arr = toArray(ordersRes.value);
        setOrders(arr.map(normalizeOrder));
      } else {
        console.warn('Failed to load orders:', ordersRes.reason);
        setOrders([]);
      }

      setProducts(productsRes.status === 'fulfilled' ? toArray(productsRes.value) : []);
      setUsers(usersRes.status === 'fulfilled' ? toArray(usersRes.value) : []);
      setPayments(paymentsRes.status === 'fulfilled' ? toArray(paymentsRes.value) : []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [safeStart, safeEnd]);

  React.useEffect(() => { loadData(); }, [loadData]);

  // filter orders
  const filteredOrders = React.useMemo(() => {
    const start = dayjs(safeStart, "YYYY-MM-DD").startOf("day");
    const end = dayjs(safeEnd, "YYYY-MM-DD").endOf("day");
    return (orders || []).filter((o) => {
      if (!o.createdAt) return false;
      const dt = dayjs(o.createdAt);
      return dt.isValid() && dt.isSameOrAfter(start) && dt.isSameOrBefore(end);
    });
  }, [orders, safeStart, safeEnd]);

  // daily stats (ใช้แค่คำนวณสรุป ไม่ได้แสดงกราฟ)
  const dailyStats = React.useMemo(() => {
    const days = daysBetweenISO(safeStart, safeEnd);
    const base = Object.fromEntries(days.map((iso) => [iso, { dateISO: iso, orders: 0, revenue: 0 }]));
    for (const o of filteredOrders) {
      const iso = dayjs(o.createdAt).format("YYYY-MM-DD");
      if (!base[iso]) continue;
      base[iso].orders += 1;
      base[iso].revenue += Number(o.total || 0);
    }
    return Object.values(base);
  }, [filteredOrders, safeStart, safeEnd]);

  // summary
  const totalOrders = filteredOrders.length;
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const lastDay = dailyStats[dailyStats.length - 1];
  const prevDay = dailyStats[dailyStats.length - 2];
  const orderChange = lastDay && prevDay
    ? (((lastDay.orders - prevDay.orders) / (prevDay.orders || 1)) * 100).toFixed(1) + "%"
    : "0%";
  const revenueChange = lastDay && prevDay
    ? (((lastDay.revenue - prevDay.revenue) / (prevDay.revenue || 1)) * 100).toFixed(1) + "%"
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
      value: `฿${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: revenueChange,
      isUp: lastDay && prevDay ? lastDay.revenue >= prevDay.revenue : null,
    },
  ];



  // activity
  const activityFeed = React.useMemo(() => {
    const activities = [];

    const recentOrders = filteredOrders
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
      .slice(0, 3);

    recentOrders.forEach(order => {
      activities.push({
        id: `order-${order.id}`,
        type: 'order',
        icon: FaShoppingCart,
        message: `ออเดอร์ใหม่ #${order.id} ${order.customerName ? `จาก ${order.customerName}` : 'จากลูกค้าทั่วไป'}`,
        time: dayjs(order.createdAt),
        color: '#10b981'
      });
    });

    const completedOrders = filteredOrders
      .filter(o => o.status === 'completed')
      .sort((a, b) => dayjs(b.updatedAt || b.createdAt).valueOf() - dayjs(a.updatedAt || a.createdAt).valueOf())
      .slice(0, 2);

    completedOrders.forEach(order => {
      activities.push({
        id: `completed-${order.id}`,
        type: 'payment',
        icon: FaMoneyBillWave,
        message: `ออเดอร์ #${order.id} เสร็จสิ้น ยอดรวม ฿${Number(order.total || 0).toLocaleString()}`,
        time: dayjs(order.updatedAt || order.createdAt),
        color: '#f59e0b'
      });
    });

    const recentUsers = users
      .filter(u => u.createdAt)
      .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
      .slice(0, 2);

    recentUsers.forEach(user => {
      activities.push({
        id: `user-${user.id}`,
        type: 'user',
        icon: FaUsers,
        message: `ผู้ใช้ใหม่ลงทะเบียน: ${user.name || user.username}`,
        time: dayjs(user.createdAt),
        color: '#3b82f6'
      });
    });

    const lowStockProducts = products
      .filter(p => p.stock !== undefined && p.stock < 10)
      .slice(0, 2);

    lowStockProducts.forEach(product => {
      activities.push({
        id: `stock-${product.id}`,
        type: 'alert',
        icon: FaBell,
        message: `สินค้า "${product.name}" เหลือน้อย (${product.stock} ชิ้น)`,
        time: dayjs().subtract(Math.random() * 60, 'minutes'),
        color: '#ef4444'
      });
    });

    return activities
      .sort((a, b) => b.time.valueOf() - a.time.valueOf())
      .slice(0, 5);
  }, [filteredOrders, users, products]);

  return (
    <div className={styles.dashboardContainer}>
      {/* Statistics Section */}
      {loading ? (
        <div className={styles.loadingSection}>
          <div className={styles.loadingSpinner} />
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <>
          <div className={styles.statsSection}>
            <h2 className={styles.sectionTitle}>
              <FaChartLine className={styles.sectionIcon} />
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
                          <FaArrowUp /> : <FaArrowDown />
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

          {/* Recent Orders */}
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

          {/* Activity */}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
}

