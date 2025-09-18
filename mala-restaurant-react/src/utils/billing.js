// src/utils/billing.js

// แบ่งเงินเท่า ๆ กัน (ไว้ใช้กรณีหารเฉลี่ย)
export function splitEqual(total, persons) {
  const each = Math.ceil((total / Math.max(1, persons)) * 100) / 100;
  const arr = Array.from({ length: persons }, () => each);
  const adj = parseFloat((each * persons - total).toFixed(2));
  if (adj !== 0) arr[0] = parseFloat((each - adj).toFixed(2));
  return arr;
}

// คำนวณยอดรวมแบบ "ไม่มีส่วนลด"
export function calcTotals(items = []) {
  const subtotal = (items || []).reduce(
    (s, it) => s + Number(it.price || 0) * Number(it.qty || 0),
    0
  );
  const total = +subtotal.toFixed(2);
  return { subtotal: total, discount: 0, total };
}
