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
import API from '@services/api';
import styles from './Orders.module.css';

const fmt = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const methodLabel = (m) =>
  ({ cash: 'เงินสด', qr: 'โอนผ่าน QR' }[m] || m || '-');

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
    const cashierName =
      order?.store?.cashier ||
      order?.cashier ||
      order?.staffName ||
      order?.createdBy?.displayName ||
      order?.createdBy?.name ||
      '';
    const meta = {
      id: order?.id ?? '-',
      createdAt: order?.createdAt ? dayjs(order.createdAt).format('DD/MM/YYYY HH:mm') : '-',
      persons: order?.persons || 1,
      channel: safe(order?.channel, 'หน้าร้าน'),
      cashier: safe(cashierName, '-'),
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

    const storeAddressLine = store.address
      ? `<div style="margin-top:6px; font-size:12px; color:#64748b;">${store.address}</div>`
      : '';
    const contactParts = [];
    if (store.phone) {
      contactParts.push(`โทร: ${store.phone}`);
    }
    if (store.taxId) {
      const branchSuffix = store.branch ? ` (สาขา ${store.branch})` : '';
      contactParts.push(`เลขประจำตัวผู้เสียภาษี: ${store.taxId}${branchSuffix}`);
    }
    const storeContactLine = contactParts.length
      ? `<div style="margin-top:4px; font-size:12px; color:#94a3b8;">${contactParts.join(' | ')}</div>`
      : '';

    const infoCells = [];
    infoCells.push(`
      <div>
        <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;">เลขที่ใบเสร็จ</div>
        <div style="margin-top:4px; font-size:15px; font-weight:700; color:#0f172a;">#${meta.id}</div>
      </div>
    `);
    infoCells.push(`
      <div style="text-align:right;">
        <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;">วันที่-เวลา</div>
        <div style="margin-top:4px; font-size:15px; font-weight:700; color:#0f172a;">${meta.createdAt}</div>
      </div>
    `);
    infoCells.push(`
      <div>
        <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;">ช่องทางขาย</div>
        <div style="margin-top:4px; font-size:15px; font-weight:700; color:#0f172a;">${meta.channel}</div>
      </div>
    `);
    infoCells.push(`
      <div style="text-align:right;">
        <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;">พนักงาน</div>
        <div style="margin-top:4px; font-size:15px; font-weight:700; color:#0f172a;">${meta.cashier}</div>
      </div>
    `);
    if (meta.persons) {
      infoCells.push(`
        <div>
          <div style="font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#94a3b8;">จำนวนลูกค้า</div>
          <div style="margin-top:4px; font-size:15px; font-weight:700; color:#0f172a;">${meta.persons} ท่าน</div>
        </div>
      `);
    }

    const infoSection = `
      <div style="margin-top:24px; background:#f1f5f9; border-radius:12px; padding:16px 18px;">
        <div style="display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px;">
          ${infoCells.join('')}
        </div>
      </div>
    `;

    const itemRows = items.length
      ? items.map((it) => `
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <div style="flex:1;">
              <div style="font-weight:600; color:#0f172a;">${it.name}</div>
              <div style="font-size:12px; color:#94a3b8; margin-top:2px;">${fmt(Number(it.price) || 0)} บาท x ${Number(it.qty) || 0}</div>
            </div>
            <div style="width:120px; text-align:right; font-weight:700; color:#0f172a;">${fmt((Number(it.price) || 0) * (Number(it.qty) || 0))} บาท</div>
          </div>
        `).join('')
      : `<div style="color:#94a3b8; font-size:13px;">ไม่มีรายการสินค้า</div>`;

    const itemsSection = `
      <div style="margin-top:24px;">
        <div style="font-size:15px; font-weight:700; color:#0f172a;">รายการสินค้า</div>
        <div style="margin-top:12px; display:flex; flex-direction:column; gap:12px;">
          ${itemRows}
        </div>
      </div>
    `;

    const totalsRows = [
      `<div style="display:flex; justify-content:space-between; align-items:center;"><span>ยอดก่อนส่วนลด</span><span>${fmt2(subtotal)} บาท</span></div>`,
      discount > 0 ? `<div style="display:flex; justify-content:space-between; align-items:center;"><span>ส่วนลด</span><span>- ${fmt(discount)} บาท</span></div>` : '',
      service ? `<div style="display:flex; justify-content:space-between; align-items:center;"><span>ค่าบริการ ${Math.round(serviceRate * 100)}%</span><span>${fmt2(service)} บาท</span></div>` : '',
      vat ? `<div style="display:flex; justify-content:space-between; align-items:center;"><span>ภาษีมูลค่าเพิ่ม ${Math.round(vatRate * 100)}%</span><span>${fmt2(vat)} บาท</span></div>` : '',
    ].filter(Boolean).join('');

    const totalsSection = `
      <div style="margin-top:24px; background:#0f172a; color:#e2e8f0; border-radius:12px; padding:18px 20px;">
        <div style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
          ${totalsRows}
          <div style="margin-top:6px; padding-top:12px; border-top:1px dashed rgba(226,232,240,0.4); display:flex; justify-content:space-between; font-size:16px; font-weight:800; color:#f8fafc;">
            <span>ยอดสุทธิ</span>
            <span>${fmt2(total)} บาท</span>
          </div>
        </div>
      </div>
    `;

    const paymentRows = pays.length
      ? pays.map((p, index) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 16px; border:1px solid #e2e8f0; border-radius:10px; background:#ffffff; box-shadow:0 4px 12px rgba(15,23,42,0.04);">
            <div>
              <div style="font-weight:600; color:#0f172a;">ชำระครั้งที่ ${index + 1}</div>
              <div style="font-size:12px; color:#64748b; margin-top:2px;">${methodLabel(p.method)}${p.ref ? ` · Ref: ${p.ref}` : ''}</div>
            </div>
            <div style="font-weight:700; color:#0f172a;">${fmt2(p.amount)} บาท</div>
          </div>
        `).join('')
      : `<div style="padding:12px 16px; border-radius:10px; background:#f8fafc; color:#94a3b8; font-size:13px;">ไม่มีข้อมูลการชำระเงิน</div>`;

    const cashRows = pays.some((p) => p.method === 'cash')
      ? `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#ecfdf5; border:1px solid #bbf7d0; border-radius:10px; font-weight:700; color:#047857;">
            <span>รับเงินสด</span>
            <span>${fmt2(cashReceived)} บาท</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 16px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; font-weight:700; color:#0369a1;">
            <span>เงินทอน</span>
            <span>${fmt2(change)} บาท</span>
          </div>
        `
      : '';

    const paymentSection = `
      <div style="margin-top:24px;">
        <div style="font-size:15px; font-weight:700; color:#0f172a;">การชำระเงิน</div>
        <div style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
          ${paymentRows}
          ${cashRows}
        </div>
      </div>
    `;

    holder.innerHTML = `
      <div style="padding:24px; background:#e2e8f0; color:#0f172a; font-family: 'Noto Sans Thai', 'Prompt', system-ui, -apple-system, 'Segoe UI', sans-serif;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:18px; box-shadow:0 18px 45px rgba(15,23,42,0.08); overflow:hidden;">
          <div style="padding:32px 36px;">
            <div style="text-align:center;">
              <div style="font-size:22px; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; color:#ef4444;">${store.name}</div>
              ${storeAddressLine}
              ${storeContactLine}
            </div>
            <div style="margin:20px auto 0; width:64px; height:4px; background:linear-gradient(90deg, #ef4444, #f97316); border-radius:999px;"></div>
            ${infoSection}
            ${itemsSection}
            ${totalsSection}
            ${paymentSection}
            <div style="margin-top:32px; text-align:center; color:#64748b; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">ขอบคุณที่อุดหนุน</div>
          </div>
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

