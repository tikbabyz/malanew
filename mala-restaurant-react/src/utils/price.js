// src/utils/price.js

// ราคาตั้งต้นของแต่ละชิ้น (รองรับหมวดไม้ที่อิง "สี")
export function baseUnitPrice(p, colorPrices) {
  const isMeatball = String(p?.category || '').toLowerCase() === 'meatball';
  if (isMeatball) {
    const key = String(p?.color || 'red').toLowerCase();
    return Number((colorPrices || {})[key] || 0);
  }
  return Number(p?.price || 0);
}

// ราคาจริงที่ใช้คิดเงิน = base เท่านั้น (ไม่มีส่วนลด)
export function effectiveUnitPrice(p, colorPrices) {
  return baseUnitPrice(p, colorPrices);
}
