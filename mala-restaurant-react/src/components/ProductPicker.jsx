import React from "react";
import { FaSearch, FaUtensils } from "react-icons/fa";
import { useDataStore } from "../store/data.js";
import API from "../services/api";
import styles from "./ProductPicker.module.css";

export default function ProductPicker({ products: productsProp, onAdd }) {
  const [products, setProducts] = React.useState(productsProp || []);
  React.useEffect(() => {
    if (!productsProp) {
      API.products.list().then(setProducts);
    }
  }, [productsProp]);

  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    return products
      .filter((p) => p?.active !== false)
      .filter(
        (p) =>
          !s ||
          (p?.name || "").toLowerCase().includes(s) ||
          (p?.category || "").toLowerCase().includes(s)
      );
  }, [products, q]);

  const onImgErr = (e) => {
    e.currentTarget.onerror = null;
    // ซ่อนรูปที่โหลดไม่ได้ และให้แสดง placeholder แทน
    e.currentTarget.style.display = 'none';
    const placeholder = e.currentTarget.parentElement.querySelector('.placeholder');
    if (placeholder) {
      placeholder.style.display = 'flex';
    }
  };

  return (
    <div className={styles.picker}>
      <div className={styles.panel}>
        {/* กล่องค้นหา + ไอคอนซ้อนใน input */}
        <div className={styles.searchWrap}>
          <FaSearch className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="ค้นหาเมนู..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className={styles.grid}>
          {!filtered.length && (
            <div className={styles.empty}>ไม่พบรายการที่ค้นหา</div>
          )}

          {filtered.map((p) => {
            const isOutOfStock = (p.stock || 0) <= 0;
            
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.card} ${isOutOfStock ? styles.outOfStock : ''}`}
                onClick={() => isOutOfStock ? null : onAdd?.(p)}
                disabled={isOutOfStock}
                title={isOutOfStock ? `${p.name} - หมดสต็อก` : p.name}
              >
                <div className={styles.thumb}>
                  <img
                    src={p.image || "/images/logo.png"}
                    alt={p.name}
                    className={styles.img}
                    onError={onImgErr}
                    loading="lazy"
                  />
                  <div className={`${styles.placeholder} placeholder`} style={{ display: p.image ? 'none' : 'flex' }}>
                    <FaUtensils className={styles.placeholderIcon} />
                    <span className={styles.placeholderText}>ไม่มีรูป</span>
                  </div>
                  
                  {/* Stock overlay for out of stock items */}
                  {isOutOfStock && (
                    <div className={styles.stockOverlay}>
                      <span className={styles.stockOverlayText}>หมดสต็อก</span>
                    </div>
                  )}
                </div>
                <div className={styles.meta}>
                  <div className={styles.name}>{p.name}</div>
                  <div className={styles.priceRow}>
                    <span className={styles.price}>
                      ฿
                      {Number(p.price || 0).toLocaleString("th-TH", {
                        minimumFractionDigits: 0,
                      })}
                    </span>
                    <span className={styles.unit}>{p.category || ""}</span>
                  </div>
                  
                  {/* Stock information */}
                  <div className={styles.stockInfo}>
                    <span className={`${styles.stockText} ${isOutOfStock ? styles.stockEmpty : (p.stock || 0) <= 5 ? styles.stockLow : styles.stockNormal}`}>
                      สต็อก: {p.stock || 0} ชิ้น
                    </span>
                    {/* Stock bar visual */}
                    {typeof p.maxStock === 'number' && p.maxStock > 0 && (
                      <div className={styles.stockBar}>
                        <span style={{'--p': (p.stock || 0) / p.maxStock}} />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
