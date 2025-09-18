// src/pages/staff/POS.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ProductPicker from "../../components/ProductPicker.jsx";
import { calcTotals } from "../../utils/billing.js";
import styles from "./POS.module.css";
import { useAuthStore } from "../../store/auth.js";
import { useDataStore } from "../../store/data.js";
import { effectiveUnitPrice, baseUnitPrice } from "../../utils/price.js";
import API from "../../services/api"; // ✅ ใช้ API จริง

// โปรไฟล์ร้าน (จะย้ายไป config ก็ได้)
const STORE_PROFILE = {
  name: "ร้านหม่าล่า",
  address: "…",
  phone: "044444444",
  taxId: "…",
  branch: "00000",
};

// --- helpers ---------------------------------------------------
function safeReadArray(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}


export default function POS() {
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore?.() || {};
  const { products, colorPrices } = useDataStore(); // ✅ ใช้ข้อมูลจาก store แทน API
  const currentUserName =
    user?.displayName || user?.name || user?.username || "พนักงาน";

  // ตรวจสอบว่าเป็น STAFF หรือไม่
  React.useEffect(() => {
    if (!user) {
      nav("/login", { replace: true });
      return;
    }
    if (user.role !== "STAFF") {
      nav("/", { replace: true });
      return;
    }
  }, [user, nav]);

  // ใช้ข้อมูลจาก store ทันที ไม่ต้องโหลดจาก API
  const [loading, setLoading] = React.useState(false); // เปลี่ยนเป็น false
  const [loadErr, setLoadErr] = React.useState("");

  // แสดง loading หรือ error ถ้ายังไม่มี user หรือข้อมูล
  if (!user || user.role !== "STAFF") {
    return (
      <div className={`container ${styles.pos}`}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h3>กำลังตรวจสอบสิทธิ์...</h3>
        </div>
      </div>
    );
  }

  // ตรวจสอบว่ามีข้อมูลสินค้าหรือไม่
  if (!products || products.length === 0) {
    return (
      <div className={`container ${styles.pos}`}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h3>ไม่พบข้อมูลสินค้า</h3>
          <p>กรุณาติดต่อผู้ดูแลระบบ</p>
        </div>
      </div>
    );
  }

  // รถเข็น
  const [items, setItems] = React.useState(() => safeReadArray("posCart", []));
  const mergedOnce = React.useRef(false);

  // จำนวนคนที่โต๊ะ
  const [persons, setPersons] = React.useState(
    () => parseInt(localStorage.getItem("posPersons") || "1", 10)
  );
  React.useEffect(() => {
    localStorage.setItem("posPersons", String(persons));
  }, [persons]);

  // รับรายการจาก Detect ครั้งเดียว
  React.useEffect(() => {
    const incoming = location.state?.pendingItems;
    if (!incoming?.length || mergedOnce.current) return;
    setItems(incoming);
    mergedOnce.current = true;
    nav(".", { replace: true, state: null });
  }, [location.state, nav]);

  // เซฟรถเข็นทุกครั้งที่รายการเปลี่ยน
  React.useEffect(() => {
    localStorage.setItem("posCart", JSON.stringify(items));
  }, [items]);

  const totals = React.useMemo(() => calcTotals(items), [items]);

  const add = (p) => {
    if (!p) return;
    const base = baseUnitPrice(p, colorPrices);
    const unit = effectiveUnitPrice(p, colorPrices);

    setItems((prev) => {
      const i = prev.findIndex((x) => String(x.id) === String(p.id));
      if (i > -1) {
        const cp = [...prev];
        cp[i] = { ...cp[i], qty: Number(cp[i].qty || 0) + 1 };
        return cp;
      }
      return [
        ...prev,
        {
          id: p.id,
          name: p.name,
          price: unit, // ใช้คิดเงินจริง
          basePrice: base, // เพื่อโชว์ราคาเดิม
          qty: 1,
        },
      ];
    });
  };

  const changeQty = (id, d) =>
    setItems((prev) =>
      prev.map((x) =>
        String(x.id) === String(id)
          ? { ...x, qty: Math.max(1, Number(x.qty || 1) + d) }
          : x
      )
    );

  const remove = (id) =>
    setItems((prev) => prev.filter((x) => String(x.id) !== String(id)));

  const backToDetect = () => {
    localStorage.setItem("posCart", JSON.stringify(items));
    nav("/staff/detect");
  };

  // ✅ สร้างออเดอร์ผ่าน backend
  const [saving, setSaving] = React.useState(false);
  const proceed = async () => {
    if (!items.length || saving) return;
    setSaving(true);
    try {
      const payload = {
        items,
        splitMode: "NONE",
        total: totals.total,
        payments: [],
        paid: false,
        persons,
        staffName: currentUserName,
        store: STORE_PROFILE,
        channel: "หน้าร้าน",
        // tableNo: "A1",
      };
      const res = await API.orders.create(payload);
      nav("/staff/billing", { state: { orderId: res.id } });
    } catch (e) {
      alert(`บันทึกออเดอร์ไม่สำเร็จ: ${String(e.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`container ${styles.pos}`}>
      {/* ข้อความต้อนรับ */}
      <div style={{ 
        background: "#f0f9ff", 
        border: "1px solid #0ea5e9", 
        borderRadius: "8px", 
        padding: "1rem", 
        marginBottom: "1rem",
        textAlign: "center"
      }}>
        <h3 style={{ margin: "0 0 0.5rem 0", color: "#0369a1" }}>
          ยินดีต้อนรับ {currentUserName}
        </h3>
        <p style={{ margin: 0, color: "#075985" }}>
          ระบบขายหน้าร้าน (POS) - พร้อมให้บริการ
        </p>
      </div>

      {/* เลือกสินค้า */}
      <div className={styles.panel}>
        <div className={styles.headerBar}>
          <h3 className={styles.sectionTitle}>เลือกสินค้า</h3>
          <button className={styles.ghostBtn} onClick={backToDetect}>
            นับไม้
          </button>
        </div>

        {loading ? (
          <div style={{ opacity: 0.7 }}>กำลังโหลดสินค้า…</div>
        ) : loadErr ? (
          <div style={{ color: "#f43f5e" }}>โหลดสินค้าไม่สำเร็จ: {loadErr}</div>
        ) : (
          <ProductPicker products={products} onAdd={add} />
        )}
      </div>

      {/* ตะกร้าสินค้า */}
      <div className={styles.panel}>
        <div className={styles.cartHead}>
          <h3 className={styles.sectionTitle}>ตะกร้าสินค้า</h3>

          {/* จำนวนคนที่โต๊ะ */}
          <div className={styles.peopleBar}>
            <span>จำนวนคน</span>
            <div className={styles.qtyGroup}>
              <button
                className={styles.qtyBtn}
                onClick={() => setPersons((n) => Math.max(1, n - 1))}
              >
                -
              </button>
              <span className={`${styles.qtyNum} number`}>{persons}</span>
              <button
                className={styles.qtyBtn}
                onClick={() => setPersons((n) => Math.min(20, n + 1))}
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.posTable}>
            <thead>
              <tr>
                <th>รายการ</th>
                <th className="number">ราคา</th>
                <th className="number">จำนวน</th>
                <th className="number">รวม</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.length ? (
                items.map((it) => (
                  <tr key={String(it.id)}>
                    <td>{it.name}</td>
                    <td className="number">
                      {it.basePrice > it.price ? (
                        <>
                          <span className={styles.priceOld}>
                            {Number(it.basePrice || 0).toFixed(2)}
                          </span>
                          <span className={styles.priceNew}>
                            {Number(it.price || 0).toFixed(2)}
                          </span>
                        </>
                      ) : (
                        Number(it.price || 0).toFixed(2)
                      )}
                    </td>
                    <td>
                      <div className={styles.qtyGroup}>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => changeQty(it.id, -1)}
                        >
                          -
                        </button>
                        <span className={`${styles.qtyNum} number`}>
                          {Number(it.qty || 0)}
                        </span>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => changeQty(it.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="number">
                      {(Number(it.price || 0) * Number(it.qty || 0)).toFixed(2)}
                    </td>
                    <td>
                      <button
                        className={styles.removeBtn}
                        onClick={() => remove(it.id)}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ opacity: 0.7 }}>
                    ยังไม่มีสินค้าในตะกร้า
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.totalBar}>
          <div className={styles.totalText}>
            รวมทั้งหมด:{" "}
            <strong className={`${styles.totalValue} number`}>
              {Number(totals.total || 0).toFixed(2)} ฿
            </strong>
          </div>
          <button
            className={styles.payButton}
            disabled={!items.length || saving}
            onClick={proceed}
          >
            {saving ? "กำลังบันทึก…" : "ไปหน้าชำระเงิน"}
          </button>
        </div>
      </div>
    </div>
  );
}
