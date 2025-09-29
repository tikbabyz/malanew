import React from "react";
import { useDataStore } from "../../store/data.js";
import { getImageUrl } from "../../services/api.js";  // ✅ เพิ่ม import สำหรับ image URL
import styles from "./Menu.module.css";
import { Link } from "react-router-dom";
import {
  FaHome,
  FaUtensils,
  FaNewspaper,
  FaSearch,
  FaTags,
  FaSpinner,
  FaExclamationTriangle,
  FaImage,
  FaFilter,
  FaStar,
  FaCheckCircle,
  FaExclamationCircle
} from "react-icons/fa";
import API from '../../services/api';

export default function Menu() {
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [imageErrors, setImageErrors] = React.useState(new Set());

  // ดึงข้อมูลสินค้าจาก API
  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await API.products.list();
        setProducts(data || []);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('ไม่สามารถโหลดข้อมูลเมนูได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // ดึงหมวดหมู่ทั้งหมด
  const categories = React.useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    return ['all', ...cats];
  }, [products]);

  // กรองสินค้าตามคำค้นหาและหมวดหมู่
  const filteredProducts = React.useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return products.filter(product => {
      if (!product.active) return false; // แสดงเฉพาะสินค้าที่เปิดใช้งาน
      
      const matchesSearch = !searchTerm || 
        (product.name || "").toLowerCase().includes(searchTerm) ||
        (product.category || "").toLowerCase().includes(searchTerm);
      
      const matchesCategory = selectedCategory === "all" || 
        product.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  // จัดการข้อผิดพลาดของรูปภาพ
  const handleImageError = (productId) => {
    setImageErrors(prev => new Set([...prev, productId]));
  };

  // คำนวณราคาหลังส่วนลด
  const calculatePrice = (product) => {
    if (!product.promoType || !product.promoValue) {
      return { original: product.price, final: product.price, hasDiscount: false };
    }

    const now = new Date();
    const promoUntil = product.promoUntil ? new Date(product.promoUntil) : null;
    
    if (promoUntil && now > promoUntil) {
      return { original: product.price, final: product.price, hasDiscount: false };
    }

    let finalPrice = product.price;
    if (product.promoType === 'PCT') {
      finalPrice = product.price * (1 - product.promoValue / 100);
    } else if (product.promoType === 'AMT') {
      finalPrice = Math.max(0, product.price - product.promoValue);
    }

    return {
      original: product.price,
      final: finalPrice,
      hasDiscount: finalPrice < product.price
    };
  };

  if (loading) {
    return (
      <div className="pageBg">
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <FaSpinner className={styles.loadingSpinner} />
            <p className={styles.loadingText}>กำลังโหลดเมนู...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pageBg">
        <div className={styles.container}>
          <div className={styles.errorContainer}>
            <FaExclamationTriangle className={styles.errorIcon} />
            <h3 className={styles.errorTitle}>เกิดข้อผิดพลาด</h3>
            <p className={styles.errorMessage}>{error}</p>
            <button 
              className={styles.retryButton}
              onClick={() => window.location.reload()}
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageBg">
      <div className={styles.container}>
        {/* Header Section */}
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>
              <FaUtensils className={styles.titleIcon} />
              เมนูหม่าล่า
            </h1>
            <p className={styles.subtitle}>
              สำรวจเมนูอาหารหม่าล่าต้นตำรับจากเสฉวน
            </p>
          </div>
        </div>

        {/* Filters Section */}
        <div className={styles.filtersSection}>
          <div className={styles.filtersContainer}>
            {/* Search Bar */}
            <div className={styles.searchContainer}>
              <FaSearch className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="text"
                placeholder="ค้นหาชื่อเมนูหรือหมวดหมู่..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div className={styles.categoryContainer}>
              <FaFilter className={styles.filterIcon} />
              <select
                className={styles.categorySelect}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">ทุกหมวดหมู่</option>
                {categories.slice(1).map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Counter */}
          <div className={styles.resultsCounter}>
            พบ {filteredProducts.length} รายการ
            {search && ` จากการค้นหา "${search}"`}
            {selectedCategory !== "all" && ` ในหมวดหมู่ "${selectedCategory}"`}
          </div>
        </div>

        {/* Products Grid */}
        <div className={styles.productsSection}>
          {filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <FaImage className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>ไม่พบเมนูที่ต้องการ</h3>
              <p className={styles.emptyMessage}>
                ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น
              </p>
            </div>
          ) : (
            <div className={styles.productsGrid}>
              {filteredProducts.map((product) => {
                const priceInfo = calculatePrice(product);
                const hasImageError = imageErrors.has(product.id);
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= 5;
                
                return (
                  <div 
                    key={product.id} 
                    className={`${styles.productCard} ${isOutOfStock ? styles.outOfStock : ''} ${isLowStock ? styles.lowStock : ''}`}
                  >
                    {/* Product Image */}
                    <div className={styles.productImageContainer}>
                      {!hasImageError && (product.image || product.imagePath) ? (
                        <img
                          src={getImageUrl(product.imagePath || product.image)}  // ✅ ใช้ getImageUrl แทน
                          alt={product.name}
                          className={styles.productImage}
                          loading="lazy"
                          onError={() => handleImageError(product.id)}
                        />
                      ) : (
                        <div className={styles.placeholderImage}>
                          <FaUtensils className={styles.placeholderIcon} />
                          <span className={styles.placeholderText}>ไม่มีรูปภาพ</span>
                        </div>
                      )}
                      
                      {/* Discount Badge */}
                      {priceInfo.hasDiscount && !isOutOfStock && (
                        <div className={styles.discountBadge}>
                          <FaStar className={styles.badgeIcon} />
                          โปรโมชั่น
                        </div>
                      )}
                      
                      {/* Stock Status */}
                      {isOutOfStock && (
                        <div className={styles.outOfStockBadge}>
                          สินค้าหมด
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className={`${styles.productInfo} ${isOutOfStock ? styles.outOfStock : ''}`}>
                      <div className={styles.productHeader}>
                        <h3 className={`${styles.productName} ${isOutOfStock ? styles.outOfStock : ''}`}>
                          {product.name}
                        </h3>
                        <span className={styles.productCategory}>
                          <FaTags className={styles.categoryIcon} />
                          {product.category}
                        </span>
                      </div>

                      <div className={styles.productPricing}>
                        {priceInfo.hasDiscount && !isOutOfStock ? (
                          <div className={styles.discountPricing}>
                            <span className={styles.originalPrice}>
                              ฿{Number(priceInfo.original).toLocaleString("th-TH")}
                            </span>
                            <span className={styles.finalPrice}>
                              ฿{Number(priceInfo.final).toLocaleString("th-TH")}
                            </span>
                          </div>
                        ) : priceInfo.hasDiscount && isOutOfStock ? (
                          <div className={styles.discountPricing}>
                            <span className={`${styles.originalPrice} ${styles.outOfStock}`}>
                              ฿{Number(priceInfo.original).toLocaleString("th-TH")}
                            </span>
                            <span className={`${styles.finalPrice} ${styles.outOfStock}`}>
                              ฿{Number(priceInfo.final).toLocaleString("th-TH")}
                            </span>
                          </div>
                        ) : (
                          <span className={`${styles.regularPrice} ${isOutOfStock ? styles.outOfStock : ''}`}>
                            ฿{Number(product.price).toLocaleString("th-TH")}
                          </span>
                        )}
                      </div>

                      <div className={styles.productMeta}>
                        <span className={`${styles.stockInfo} ${isOutOfStock ? styles.outOfStock : ''} ${isLowStock ? styles.lowStock : ''}`}>
                          {isOutOfStock ? (
                            <>
                              <FaExclamationTriangle className={styles.stockIcon} />
                              สินค้าหมด
                            </>
                          ) : isLowStock ? (
                            <>
                              <FaExclamationCircle className={styles.stockIcon} />
                              เหลือน้อย: {product.stock} ชิ้น
                            </>
                          ) : (
                            <>
                              <FaCheckCircle className={styles.stockIcon} />
                              คงเหลือ: {product.stock} ชิ้น
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className={styles.footerNote}>
          <p className={styles.noteText}>
            <FaUtensils className={styles.noteIcon} />
            หมายเหตุ: ราคาอาจมีการเปลี่ยนแปลง กรุณาสอบถามพนักงานก่อนสั่ง
          </p>
        </div>
      </div>
    </div>
  );
}
