// src/pages/staff/Billing.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { calcTotals, splitEqual } from "@utils/billing.js";
import styles from "./Billing.module.css";
import API from "@services/api"; // ✅ ใช้ API จริง

export default function Billing() {
  const nav = useNavigate();
  const location = useLocation();

  // รับ orderId จาก POS (หรือ fallback จาก sessionStorage)
  const initialOrderId =
    location.state?.orderId ??
    (sessionStorage.getItem("lastOrderId")
      ? Number(sessionStorage.getItem("lastOrderId"))
      : null);

  const [orderId] = React.useState(initialOrderId);
  const [order, setOrder] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  // UI states
  const [mode, setMode] = React.useState("NONE");
  const [persons, setPersons] = React.useState(1);
  const [pay, setPay] = React.useState({ method: "cash", received: 0 });
  const [saving, setSaving] = React.useState(false);

  // โหลดออเดอร์จาก backend (ถ้ายังไม่มี GET /orders/:id ใช้ list แล้ว find)
  const loadOrder = React.useCallback(async () => {
    console.log('💰 Loading order:', orderId);
    
    try {
      setLoading(true);
      setErr("");

      console.log('📡 Fetching orders from API...');
      // พยายามดึงจาก backend
      const list = await API.orders.list();
      console.log('📋 Orders list:', list);
      
      const found = list.find((o) => Number(o.id) === Number(orderId));
      console.log('🔍 Found order:', found);

      // ถ้าไม่เจอใน list ให้ fallback จาก payload ที่เก็บไว้หลังสร้าง
      if (!found) {
        console.log('⚠️ Order not found in API, checking cache...');
        const cached = sessionStorage.getItem("lastOrderPayload");
        if (cached) {
          const cachedData = JSON.parse(cached);
          console.log('💾 Found cached order:', cachedData);
          setOrder({ id: orderId, ...cachedData });
          setMode(cachedData.splitMode || "NONE");
          setPersons(cachedData.persons || 1);
          return;
        }
      }

      if (!found) {
        console.error('❌ No order found');
        setErr("ไม่พบออเดอร์ที่ต้องชำระ");
        setOrder(null);
      } else {
        console.log('✅ Order loaded successfully');
        setOrder(found);
        setMode(found.splitMode || "NONE");
        setPersons(found.persons || 1);
      }
    } catch (e) {
      console.error('❌ Error loading order:', e);
      setErr(`เกิดข้อผิดพลาด: ${String(e.message || e)}`);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  React.useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setErr("ไม่พบเลขที่ออเดอร์");
      return;
    }
    loadOrder();
  }, [orderId, loadOrder]);

  // คิดยอดรวมจากรายการ (ย้ายไว้ก่อน early returns เพื่อหลีกเลี่ยง hooks order error)
  const items = order?.items || [];
  const totals = React.useMemo(() => calcTotals(items), [items]);

  // โหมดแยกบิลแบบหารเท่ากัน
  const parts = mode === "SPLIT" ? splitEqual(totals.total, persons) : [totals.total];
  const amountToPay = mode === "SPLIT" ? parts[0] : totals.total;

  if (loading) return <div className={styles.summary}>กำลังโหลด…</div>;
  if (err) {
    return (
      <div className={styles.summary}>
        <div style={{ color: "#ef4444", marginBottom: 12 }}>{err}</div>
        <button className={styles.backButton} onClick={() => nav("/staff/pos")}>
          กลับไปหน้า POS
        </button>
      </div>
    );
  }
  if (!order) return <div className={styles.summary}>ไม่มีออเดอร์</div>;

  // ปุ่มยืนยันชำระ → ยิง API สร้าง payment
  const confirm = async () => {
    const amt = Math.round(amountToPay * 100) / 100;

    console.log('💳 Starting payment confirmation...');
    console.log('Payment method:', pay.method);
    console.log('Amount to pay:', amt);
    console.log('Order ID:', order.id);

    try {
      setSaving(true);

      if (pay.method === "cash") {
        const rec = Number(pay.received || 0);
        console.log('💰 Cash payment - Received:', rec);
        
        if (rec < amt) {
          console.warn('⚠️ Insufficient cash received');
          alert("รับเงินมาไม่พอ");
          setSaving(false);
          return;
        }
        const change = +(rec - amt).toFixed(2);
        console.log('💰 Change to give:', change);

        const cashPayload = {
          method: "cash",
          amount: amt,
          received: rec,
          change,
        };
        console.log('📡 Sending cash payment payload:', cashPayload);

        await API.orders.addPayment(order.id, cashPayload);
        console.log('✅ Cash payment successful');

        alert(`รับเงิน ${rec.toFixed(2)} บาท • เงินทอน ${change.toFixed(2)} บาท`);
      } else {
        console.log('📱 Processing QR payment...');
        const qrPayload = {
          method: "qr",
          amount: amt,
          received: amt,
          change: 0,
        };
        console.log('📡 Sending QR payment payload:', qrPayload);

        await API.orders.addPayment(order.id, qrPayload);
        console.log('✅ QR payment successful');

        alert("รับชำระ QR สำเร็จ");
      }

      console.log('🛒 Clearing cart and navigating...');
      // เคลียร์รถเข็นหน้า POS แล้วไปหน้า Orders
      localStorage.removeItem("posCart");
      nav("/staff/orders");
    } catch (e) {
      console.error('❌ Payment failed:', e);
      alert(`ชำระเงินไม่สำเร็จ: ${String(e.message || e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.summary}>
        <div className={styles.title}>
          <h3>สรุปรายการ</h3>
          <span className={styles.orderNumber}>เลขที่ #{order.id}</span>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>สินค้า</th>
              <th className={styles.number}>ราคา</th>
              <th className={styles.number}>จำนวน</th>
              <th className={styles.number}>รวม</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((it) => (
              <tr key={`${it.id}-${it.name}`}>
                <td>{it.name}</td>
                <td className={styles.number}>{Number(it.price).toFixed(2)}</td>
                <td className={styles.number}>{it.qty}</td>
                <td className={styles.number}>
                  {(Number(it.price) * Number(it.qty)).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.totalRow}>
          <div className={styles.totalLabel}>ยอดรวมทั้งสิ้น</div>
          <div className={styles.totalAmount}>{totals.total.toFixed(2)} ฿</div>
        </div>

        <div className={styles.modeSelect}>
          <label
            className={`${styles.modeOption} ${
              mode === "NONE" ? styles.active : ""
            }`}
          >
            <input
              type="radio"
              name="mode"
              checked={mode === "NONE"}
              onChange={() => setMode("NONE")}
            />
            จ่ายรวม
          </label>
          <label
            className={`${styles.modeOption} ${
              mode === "SPLIT" ? styles.active : ""
            }`}
          >
            <input
              type="radio"
              name="mode"
              checked={mode === "SPLIT"}
              onChange={() => setMode("SPLIT")}
            />
            แยกบิลเท่ากัน
          </label>
        </div>

        {mode === "SPLIT" && (
          <div className={styles.peopleBar}>
            <span className={styles.peopleLabel}>จำนวนคน</span>
            <div className={styles.stepper}>
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => setPersons((n) => Math.max(1, n - 1))}
                aria-label="ลดจำนวนคน"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={20}
                value={persons}
                onChange={(e) =>
                  setPersons(
                    Math.max(
                      1,
                      Math.min(20, parseInt(e.target.value || "1", 10))
                    )
                  )
                }
                className={styles.stepperInput}
              />
              <button
                type="button"
                className={styles.stepperBtn}
                onClick={() => setPersons((n) => Math.min(20, n + 1))}
                aria-label="เพิ่มจำนวนคน"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.paymentSection}>
        <h3 className={styles.paymentTitle}>การชำระเงิน</h3>

        <div className={styles.formGroup}>
          <label className={styles.label}>วิธีชำระ</label>
          <select
            className={styles.select}
            value={pay.method}
            onChange={(e) => setPay({ ...pay, method: e.target.value })}
          >
            <option value="cash">เงินสด</option>
            <option value="qr">QR พร้อมเพย์</option>
          </select>

          {pay.method === "cash" && (
            <>
              <label className={styles.label}>รับเงินมา (บาท)</label>
              <input
                type="number"
                className={styles.input}
                value={pay.received}
                onChange={(e) =>
                  setPay({ ...pay, received: parseFloat(e.target.value) || 0 })
                }
              />
              <div className={styles.quickAmount}>
                {[20, 50, 100, 500, 1000].map((v) => (
                  <button
                    key={v}
                    className={styles.amountButton}
                    onClick={() => setPay({ ...pay, received: v })}
                    type="button"
                  >
                    {v}
                  </button>
                ))}
                <button
                  className={`${styles.amountButton} ${styles.clearButton}`}
                  onClick={() => setPay({ ...pay, received: 0 })}
                  type="button"
                >
                  ล้าง
                </button>
              </div>

              <div className={styles.changeRow}>
                ต้องชำระ: <b className="number">{amountToPay.toFixed(2)}</b> ฿
                &nbsp;&nbsp;|&nbsp;&nbsp; เงินทอน:{" "}
                <b className="number">
                  {Math.max(0, Number(pay.received || 0) - amountToPay).toFixed(2)}
                </b>{" "}
                ฿
              </div>
            </>
          )}

          {pay.method === "qr" && (
            <div className={styles.qrSection}>
              <div className={styles.qrIcon}>📱</div>
              <div className={styles.qrNote}>
                * ให้ลูกค้าสแกน QR เพื่อชำระ {amountToPay.toFixed(2)} ฿
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.backButton} onClick={() => nav("/staff/pos")}>
            กลับไปหน้า POS
          </button>
          <button
            className={styles.confirmButton}
            onClick={confirm}
            disabled={saving}
          >
            {saving ? "กำลังบันทึก…" : "ยืนยันการชำระเงิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

