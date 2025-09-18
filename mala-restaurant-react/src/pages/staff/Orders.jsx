// src/pages/staff/Orders.jsx
import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';
import { 
  FaReceipt, 
  FaSync, 
  FaDownload, 
  FaSearch, 
  FaFilter, 
  FaExclamationTriangle,
  FaFileInvoice,
  FaMoneyBillWave,
  FaClock,
  FaUsers
} from 'react-icons/fa';
import API from '../../services/api.js';
import styles from './Orders.module.css';

const fmt = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const methodLabel = (m) =>
  ({ cash: 'เงินสด', qr: 'QR พร้อมเพย์' }[m] || m || '-');

const safe = (v, d = '-') => (v == null || v === '' ? d : v);
const fmt2 = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // คำนวณสถิติ
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.paid).length;
    const pendingOrders = totalOrders - paidOrders;
    const totalRevenue = orders.filter(o => o.paid).reduce((sum, o) => sum + (o.total || 0), 0);
    
    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      totalRevenue
    };
  }, [orders]);

  // ฟิลเตอร์และการค้นหา
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // ค้นหา
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.id.toString().includes(searchTerm) ||
        (order.items || []).some(item => 
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // ฟิลเตอร์สถานะ
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => 
        statusFilter === 'paid' ? order.paid : !order.paid
      );
    }

    // เรียงลำดับ
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'amount-high':
          return (b.total || 0) - (a.total || 0);
        case 'amount-low':
          return (a.total || 0) - (b.total || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [orders, searchTerm, statusFilter, sortBy]);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await API.orders.list();
      setOrders(list || []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const downloadBillImage = async (order) => {
    const items = order?.items || [];

    // ถ้ามี store ในออเดอร์จะใช้เลย (แนะนำแนบมาเมื่อ createOrder)
    const store = {
      name: safe(order?.store?.name, 'ร้านหม่าล่า'),
      address: order?.store?.address || '',
      phone: order?.store?.phone || '',
      taxId: order?.store?.taxId || '',
      branch: order?.store?.branch || '',
    };
    const meta = {
      id: order?.id ?? '-',
      createdAt: order?.createdAt ? dayjs(order.createdAt).format('DD/MM/YYYY HH:mm') : '-',
      tableNo: safe(order?.tableNo, '-'),
      persons: order?.persons || 1,
      channel: order?.channel || 'หน้าร้าน',
      cashier: order?.staffName || order?.createdBy?.name || '-',
    };

    const subtotal = items.reduce(
      (s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 0),
      0
    );
    const discount = Number(order?.discount || 0);
    const serviceRate = Number(order?.serviceRate || 0);
    const service = +(subtotal * serviceRate).toFixed(2);
    const vatRate = Number(order?.vatRate || 0);
    const vatable = Math.max(0, subtotal - discount + service);
    const vat = +(vatable * vatRate).toFixed(2);
    const grandCalc = +(vatable + vat).toFixed(2);
    const total = typeof order?.total === 'number' ? order.total : grandCalc;

    const allowed = new Set(['cash', 'qr']);
    const pays = Array.isArray(order?.payments)
      ? order.payments.filter((p) => allowed.has(p.method))
      : [];
    const paid = pays.reduce((s, p) => s + Number(p.amount || 0), 0);

    const lastPay = pays[pays.length - 1] || null;
    const cashReceived = lastPay?.received ?? paid;
    const change = lastPay?.change ?? Math.max(0, (cashReceived || 0) - total);

    // สร้าง DOM offscreen สำหรับแคปเป็น PNG
    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-10000px';
    holder.style.top = '-10000px';
    holder.style.width = '640px';
    holder.style.zIndex = '-1';
    holder.style.background = '#fff';

    holder.innerHTML = `
      <div style="padding:24px 28px; background:#ffffff; color:#111; font-family: system-ui, -apple-system, 'Segoe UI', 'Noto Sans Thai', sans-serif;">
        <div style="text-align:center">
          <h2 style="margin:0 0 4px; color:#ef4444; font-weight:900;">${store.name}</h2>
          ${store.address ? `<div style="font-size:12px; color:#555;">${store.address}</div>` : ''}
          ${(store.phone || store.taxId) ? `
            <div style="font-size:12px; color:#555;">
              ${store.phone ? `โทร: ${store.phone}` : ''} 
              ${store.taxId ? `• เลขผู้เสียภาษี: ${store.taxId}${store.branch ? ` (สาขา ${store.branch})` : ''}` : ''}
            </div>` : ''}
        </div>

        <div style="border-top:1px dashed #ddd; margin:12px 0;"></div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; font-size:13px; color:#333;">
          <div>เลขที่บิล: #${meta.id}</div>
          <div style="text-align:right">วันที่: ${meta.createdAt}</div>
          <div>โต๊ะ: ${meta.tableNo}</div>
          <div style="text-align:right">จำนวนคน: ${meta.persons}</div>
          <div>แชนเนล: ${meta.channel}</div>
          <div style="text-align:right">แคชเชียร์: ${meta.cashier}</div>
        </div>

        <h3 style="margin:12px 0 6px; font-size:16px;">รายการ</h3>
        <div>
          ${
            items.length
              ? items.map((it) => `
                <div style="display:flex; justify-content:space-between; gap:12px; margin:6px 0;">
                  <span>${it.name} x ${it.qty}</span>
                  <span>${fmt((Number(it.price)||0) * (Number(it.qty)||0))} ฿</span>
                </div>`
              ).join('')
              : `<div style="color:#777;">(ไม่มีรายการ)</div>`
          }
        </div>

        <div style="border-top:1px solid #000; margin-top:12px;"></div>

        <div style="margin-top:8px; display:grid; gap:6px; font-size:14px;">
          <div style="display:flex; justify-content:space-between;">
            <span>Subtotal</span><span>${fmt2(subtotal)} บาท</span>
          </div>
          ${
            discount > 0
              ? `<div style="display:flex; justify-content:space-between;">
                   <span>ส่วนลดทั้งบิล</span>
                   <span>- ${fmt(discount)} บาท</span>
                 </div>`
              : ''
          }
          ${
            service
              ? `<div style="display:flex; justify-content:space-between;">
                   <span>ค่าบริการ ${Math.round(serviceRate * 100)}%</span><span>${fmt2(service)} บาท</span>
                 </div>`
              : ''
          }
          ${
            vat
              ? `<div style="display:flex; justify-content:space-between;">
                   <span>ภาษีมูลค่าเพิ่ม (VAT ${Math.round(vatRate * 100)}%)</span><span>${fmt2(vat)} บาท</span>
                 </div>`
              : ''
          }
          <div style="display:flex; justify-content:space-between; font-weight:900; font-size:16px; border-top:1px dashed #ddd; padding-top:6px;">
            <span>ยอดสุทธิ</span><span>${fmt2(total)} บาท</span>
          </div>
        </div>

        <h3 style="margin:12px 0 6px; font-size:16px;">การชำระเงิน</h3>
        <div style="display:grid; gap:4px; font-size:14px;">
          ${
            pays.length
              ? pays.map((p, i) => `
                <div style="display:flex; justify-content:space-between;">
                  <span>ครั้งที่ ${i + 1} • ${methodLabel(p.method)}${p.ref ? ` • Ref: ${p.ref}` : ''}</span>
                  <span>${fmt2(p.amount)} บาท</span>
                </div>`
              ).join('')
              : `<div style="color:#777;">* ยังไม่มีข้อมูลการชำระ (บันทึกบิลอย่างเดียว)</div>`
          }
          ${
            pays.some(p => p.method === "cash")
              ? `<div style="display:flex; justify-content:space-between; margin-top:6px; font-weight:900; font-size:15px; color:#ef4444;">
                   <span>เงินสดรับ</span><span>${fmt2(cashReceived)} บาท</span>
                 </div>
                 <div style="display:flex; justify-content:space-between; margin-top:2px; font-weight:900; font-size:15px; color:#22c55e;">
                   <span>เงินทอน</span><span>${fmt2(change)} บาท</span>
                 </div>`
              : ''
          }
        </div>

        <div style="margin-top:14px; text-align:center; color:#666; font-size:12px;">
          ขอบคุณที่อุดหนุน • เก็บใบเสร็จไว้เป็นหลักฐาน
        </div>
      </div>
    `;

    document.body.appendChild(holder);

    try {
      const canvas = await html2canvas(holder, {
        backgroundColor: '#ffffff',
        scale: Math.min(3, (window.devicePixelRatio || 1) * 2),
        useCORS: true,
        logging: false,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `bill-${meta.id}.png`;
      link.click();
    } catch (err) {
      console.error('Error generating bill image:', err);
      alert('สร้างรูปบิลไม่สำเร็จ');
    } finally {
      document.body.removeChild(holder);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header with Stats */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>
            <FaReceipt className={styles.titleIcon} />
            จัดการบิลทั้งหมด
          </h1>
          <div className={styles.headerActions}>
            <button 
              className={styles.refreshButton} 
              onClick={fetchOrders} 
              disabled={loading}
            >
              <FaSync />
              {loading ? 'กำลังโหลด...' : 'รีเฟรช'}
            </button>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.totalOrders}</span>
            <span className={styles.statLabel}>บิลทั้งหมด</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.paidOrders}</span>
            <span className={styles.statLabel}>ชำระแล้ว</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{stats.pendingOrders}</span>
            <span className={styles.statLabel}>ค้างชำระ</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statNumber}>{fmt(stats.totalRevenue)} ฿</span>
            <span className={styles.statLabel}>ยอดขายรวม</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersGrid}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>
              <FaSearch /> ค้นหาบิล
            </label>
            <input
              type="text"
              placeholder="ค้นหาด้วยเลขบิลหรือชื่อเมนู..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.input}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>
              <FaFilter /> สถานะ
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.select}
            >
              <option value="all">ทั้งหมด</option>
              <option value="paid">ชำระแล้ว</option>
              <option value="pending">ค้างชำระ</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>เรียงตาม</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.select}
            >
              <option value="newest">ล่าสุด</option>
              <option value="oldest">เก่าสุด</option>
              <option value="amount-high">ยอดสูง-ต่ำ</option>
              <option value="amount-low">ยอดต่ำ-สูง</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className={styles.errorAlert}>
          <FaExclamationTriangle className={styles.errorIcon} />
          <span>{error}</span>
        </div>
      )}

      {/* Orders Table */}
      <div className={styles.ordersCard}>
        <div className={styles.ordersHeader}>
          <h3 className={styles.ordersTitle}>
            รายการบิล ({filteredOrders.length} รายการ)
          </h3>
        </div>

        <div className={styles.tableContainer}>
          {loading && (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner}></div>
              <div>กำลังโหลดข้อมูล...</div>
            </div>
          )}

          {!loading && filteredOrders.length === 0 && (
            <div className={styles.emptyState}>
              <FaFileInvoice className={styles.emptyIcon} />
              <div className={styles.emptyText}>ไม่พบบิล</div>
              <div className={styles.emptySubtext}>
                {searchTerm || statusFilter !== 'all' 
                  ? 'ลองเปลี่ยนเงื่อนไขการค้นหา' 
                  : 'ยังไม่มีบิลในระบบ'}
              </div>
            </div>
          )}

          {!loading && filteredOrders.length > 0 && (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>เลขที่บิล</th>
                  <th>รายการ</th>
                  <th>ยอดรวม</th>
                  <th>โหมด</th>
                  <th>สถานะ</th>
                  <th>เวลา</th>
                  <th>สลิป QR</th>
                  <th>ดาวน์โหลด</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className={styles.orderRow}>
                    <td>
                      <span className={styles.orderNumber}>#{order.id}</span>
                    </td>
                    <td>
                      <div className={styles.orderItems}>
                        {(order.items || []).map((i) => `${i.name}×${i.qty}`).join(', ')}
                      </div>
                    </td>
                    <td>
                      <span className={styles.orderTotal}>
                        {fmt(order.total)} ฿
                        {order.totalPaid !== undefined && order.totalPaid > 0 && (
                          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                            ชำระแล้ว: {fmt(order.totalPaid)} ฿
                          </div>
                        )}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.modeBadge} ${order.splitMode === 'SPLIT' ? styles.modeSplit : styles.modeNormal}`}>
                        {order.splitMode === 'SPLIT' ? 'แยกบิล' : 'ปกติ'}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${order.paid ? styles.statusPaid : styles.statusPending}`}>
                        {order.paid ? 'ชำระแล้ว' : 'ค้างชำระ'}
                      </span>
                      {!order.paid && order.totalPaid !== undefined && order.totalPaid > 0 && (
                        <div style={{ fontSize: '10px', color: '#f59e0b', marginTop: '4px' }}>
                          ค้าง: {fmt(order.total - order.totalPaid)} ฿
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <FaClock style={{ color: '#64748b' }} />
                        {order.createdAt ? dayjs(order.createdAt).format('DD/MM HH:mm') : '-'}
                      </div>
                    </td>
                    <td>
                      {/* ใช้ slipUrl absolute ที่ backend คืนมาโดยตรง */}
                      {Array.isArray(order.payments) && order.payments.some(p => p.method === 'qr' && Array.isArray(p.transferSlips) && p.transferSlips.length > 0) ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {order.payments.filter(p => p.method === 'qr').flatMap(p => p.transferSlips).map((slip, idx) => (
                            <a key={slip.slipUrl || idx} href={slip.slipUrl} target="_blank" rel="noopener noreferrer">
                              <img src={slip.slipUrl} alt={slip.name || 'สลิป'} style={{ width: '38px', height: '38px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #eee' }} />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#aaa', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => downloadBillImage(order)}
                        className={styles.actionButton}
                        title="ดาวน์โหลดบิล"
                      >
                        <FaDownload />
                        ดาวน์โหลด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
