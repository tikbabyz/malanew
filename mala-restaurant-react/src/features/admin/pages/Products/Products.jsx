import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDataStore } from '@store/data.js';
import ConfirmModal from "@shared/components/ConfirmModal/ConfirmModal.jsx";
import styles from './Products.module.css';
import colorStyles from './ColorPricing.module.css';
import API, { getImageUrl } from '@services/api';
import { 
  FaEdit, 
  FaTrash, 
  FaPlus,
  FaSave, 
  FaTimes,
  FaUpload,
  FaBoxOpen,
  FaTag,
  FaImage,
  FaMoneyBillWave,
  FaDownload,
  FaSearch,
  FaFilter,
  FaPlusCircle,
  FaPalette,
} from 'react-icons/fa';

const ColorDot = ({ color }) => (
  <span
    className={styles.colorDot}
    style={{ backgroundColor: color || '#888' }}
  />
);

const FieldError = ({ children }) =>
  children ? <p className={styles.errorText}>{children}</p> : null;

const COLOR_PRICE_CATS = new Set(['meat', 'veg', 'seafood', 'meatball']);

const isColorPriced = (cat) => COLOR_PRICE_CATS.has(String(cat || '').toLowerCase());

const normalizeColorMap = (source) => {
  const entries = Object.entries(source || {});
  return entries.reduce((acc, [color, value]) => {
    const key = String(color || '').toLowerCase();
    const entry = typeof value === 'object' && value !== null ? value : { price: value, stock: 0 };
    acc[key] = {
      price: Number(entry?.price ?? 0) || 0,
      stock: Number(entry?.stock ?? 0) || 0,
    };
    return acc;
  }, {});
};

// ColorPicker component
function ColorPicker({ value, onChange, colors = [], colorPrices = {} }) {
  return (
    <div className={styles.colorGrid} role="radiogroup" aria-label="สีไม้">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`${styles.colorChip} ${value === c ? styles.colorChipActive : ''}`}
          onClick={() => onChange(c)}
          aria-pressed={value === c}
        >
          <span className={styles.colorDot} style={{ background: c }} />
          <span className={styles.colorName}>{c}</span>
          <span className={styles.colorPrice}>{(colorPrices?.[c]?.price ?? colorPrices?.[String(c).toLowerCase()]?.price ?? 0)}฿</span>
        </button>
      ))}
    </div>
  );
}

export default function Products() {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    colorPrices,
    setColorPrices,
    setProducts,
    categories
  } = useDataStore();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [errors, setErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockInput, setStockInput] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: '',
    image: '',
    color: '', // ไม่ตั้งค่าเริ่มต้น ให้ผู้ใช้เลือกเอง
    stock: '0'
  });

  const categoriesList = ['meat', 'seafood', 'vegetable', 'drink'];

  // ดึงสีจากฐานข้อมูล colorPrices แทนการ hardcode และเรียงจากราคามากไปน้อย
  const colorOptions = useMemo(() => {
    const entries = Object.entries(colorPrices || {});
    return entries
      .sort((a, b) => Number(b[1]?.price ?? 0) - Number(a[1]?.price ?? 0))
      .map(([color]) => color);
  }, [colorPrices]);

  const colorSummaryEntries = useMemo(() => {
    if (!colorPrices || !Object.keys(colorPrices).length) return [];
    return colorOptions
      .map((color) => {
        const entry = colorPrices?.[color] ?? colorPrices?.[String(color).toLowerCase()];
        return entry ? [color, entry] : null;
      })
      .filter(Boolean);
  }, [colorOptions, colorPrices]);

  const getColorData = useCallback(
    (color) => {
      if (!color) return null;
      const key = String(color || '').toLowerCase();
      return colorPrices?.[key] ?? null;
    },
    [colorPrices]
  );

  // ตรวจสอบว่าสินค้าเป็นประเภทที่ใช้ราคาตามสี
  const isColorPricedCategory = (category) => {
    return ['meat', 'seafood', 'vegetable', 'meatball'].includes(String(category || '').toLowerCase());
  };

  // ตรวจสอบว่าควรใช้ราคาจากสีหรือไม่
  const shouldUseColorPrice = () => {
    return isColorPricedCategory(formData.category) && !!getColorData(formData.color);
  };

  // ฟังก์ชันจัดการการเปลี่ยนสี
  const handleColorChange = (color) => {
    // ถ้ากดสีที่เลือกอยู่แล้ว ให้ยกเลิกการเลือก
    if (formData.color === color) {
      setFormData(prev => ({ 
        ...prev, 
        color: '', 
        price: '',
        stock: prev.stock || ''
      }));
      return;
    }

    const newFormData = { ...formData, color };
    
    // เติมราคาจาก colorPrices ทันทีโดยไม่ต้องตรวจสอบ category
    const colorData = getColorData(color);
    if (colorData) {
      newFormData.price = (colorData.price ?? 0).toString();
    }
    newFormData.stock = '0';
    
    setFormData(newFormData);
  };

  // ฟังก์ชันจัดการการเปลี่ยนหมวดหมู่
  const handleCategoryChange = (category) => {
    const newFormData = { ...formData, category };
    
    // ถ้าเป็นหมวดหมู่ที่ใช้ราคาตามสี และมีสีเลือกไว้แล้ว ให้ตั้งราคาจาก colorPrices
    if (isColorPricedCategory(category) && formData.color) {
      const colorData = getColorData(formData.color);
      if (colorData) {
        newFormData.price = (colorData.price ?? 0).toString();
      }
    } else if (!isColorPricedCategory(category)) {
      // ถ้าไม่ใช่หมวดหมู่ที่ใช้ราคาตามสี ให้เคลียร์ราคา
      newFormData.price = '';
    }
    
    setFormData(newFormData);
  };

  // useEffect เพื่อเติมราคาอัตโนมัติเมื่อมีการเปลี่ยนแปลง color หรือ colorPrices
  useEffect(() => {
    // เติมราคาเมื่อมีสีและมีราคาในฐานข้อมูล โดยไม่ต้องตรวจสอบ category
    const colorData = getColorData(formData.color);
    if (formData.color && colorData) {
      setFormData(prev => ({
        ...prev,
        price: (colorData.price ?? 0).toString()
      }));
    }
  }, [formData.color, getColorData]);

  // Filter products based on search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Load data from backend only
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setLoadError('');

        // Load color prices from database
        const colorMap = await API.colorPrices.get();
        setColorPrices(colorMap);

        // Load products from database
        const list = await API.products.list();
        
        // Clear local storage and use database data only
        if (typeof setProducts === 'function') {
          setProducts(list);
        } else {
          // Clear existing products from store
          for (const p of (products || [])) {
            deleteProduct(p.id);
          }
          // Add products from database
          for (const p of (list || [])) {
            addProduct(p);
          }
        }
        
        console.log('✅ Data loaded from database:', { 
          products: list?.length || 0, 
          colorPrices: Object.keys(colorMap || {}).length 
        });
        
      } catch (e) {
        console.error('❌ Failed to load data from database:', e);
        setLoadError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []); // Empty dependency array - load once on mount

  const fileRef = useRef(null);
  const triggerFile = () => fileRef.current?.click();

  // Color price modal
  const [showColorPriceModal, setShowColorPriceModal] = useState(false);
  const [draftColorPrices, setDraftColorPrices] = useState(() => normalizeColorMap(colorPrices));
  const [newColorName, setNewColorName] = useState('');
  const [newColorPrice, setNewColorPrice] = useState('0');
  const [newColorStock, setNewColorStock] = useState('0');

  const openColorPriceModal = () => setShowColorPriceModal(true);
  const closeColorPriceModal = () => setShowColorPriceModal(false);

  // Sync draft when opening modal
  useEffect(() => {
    if (showColorPriceModal) {
      setDraftColorPrices(normalizeColorMap(colorPrices));
      setNewColorName('');
      setNewColorPrice('0');
      setNewColorStock('0');
    }
  }, [showColorPriceModal, colorPrices]);

  // Apply color prices to all color-priced products
  const applyColorPricesToAllColorPricedProducts = useCallback(
    (prices) => {
      const priceMap = prices || colorPrices || {};
      (products || []).forEach((p) => {
        if (isColorPriced(p.category)) {
          const colorKey = String(p.color || '').toLowerCase();
          const entry = priceMap[colorKey] || priceMap[p.color];
          const newPrice = Number(entry?.price ?? 0);
          if (p.price !== newPrice) {
            API.products.update(p.id, { ...p, price: newPrice })
              .then((saved) => updateProduct(saved))
              .catch(() => {
                updateProduct({ ...p, price: newPrice });
              });
          }
        }
      });
    },
    [products, colorPrices, updateProduct]
  );

  const draftColorKeys = useMemo(() => Object.keys(draftColorPrices || {}), [draftColorPrices]);

  const hasInvalidPriceInModal = useMemo(() => {
    return draftColorKeys.some((c) => {
      const entry = draftColorPrices?.[c] || {};
      const priceNum = Number(entry.price);
      const stockNum = Number(entry.stock);
      return (
        Number.isNaN(priceNum) ||
        priceNum < 0 ||
        Number.isNaN(stockNum) ||
        stockNum < 0 ||
        !Number.isInteger(stockNum)
      );
    });
  }, [draftColorKeys, draftColorPrices]);

  const clampBaht = (v) => Math.max(0, Math.round(Number(v) || 0));
  const clampStock = (v) => Math.max(0, Math.round(Number(v) || 0));
  
  const nudgeDraftTHB = (delta) => {
    setDraftColorPrices((prev) => {
      const out = { ...(prev || {}) };
      Object.entries(out).forEach(([color, entry]) => {
        const next = { ...(entry || { price: 0, stock: 0 }) };
        next.price = clampBaht((Number(next.price) || 0) + delta);
        out[color] = next;
      });
      return out;
    });
  };
  
  const nudgeDraftPercent = (pct) => {
    setDraftColorPrices((prev) => {
      const out = { ...(prev || {}) };
      Object.entries(out).forEach(([color, entry]) => {
        const next = { ...(entry || { price: 0, stock: 0 }) };
        next.price = clampBaht((Number(next.price) || 0) * (1 + pct / 100));
        out[color] = next;
      });
      return out;
    });
  };

  const handleDraftPriceChange = (color, value) => {
    const key = String(color || '').toLowerCase();
    setDraftColorPrices((prev) => ({
      ...(prev || {}),
      [key]: {
        ...(prev?.[key] || { price: '', stock: '0' }),
        price: value,
      },
    }));
  };

  const handleDraftStockChange = (color, value) => {
    const key = String(color || '').toLowerCase();
    setDraftColorPrices((prev) => ({
      ...(prev || {}),
      [key]: {
        ...(prev?.[key] || { price: '', stock: '0' }),
        stock: value,
      },
    }));
  };

  const handleRemoveDraftColor = (color) => {
    const key = String(color || '').toLowerCase();
    setDraftColorPrices((prev) => {
      const next = { ...(prev || {}) };
      delete next[key];
      if (Object.keys(next).length === 0) {
        return normalizeColorMap({});
      }
      return next;
    });
  };

  const handleAddDraftColor = () => {
    const name = newColorName.trim().toLowerCase();
    if (!name) return;
    setDraftColorPrices((prev) => ({
      ...(prev || {}),
      [name]: {
        price: newColorPrice,
        stock: newColorStock,
      },
    }));
    setNewColorName('');
    setNewColorPrice('0');
    setNewColorStock('0');
  };

  const saveColorPrices = async () => {
    if (hasInvalidPriceInModal) return;
    try {
      // Save to database via API
      const cleanPrices = Object.fromEntries(
        Object.entries(draftColorPrices || {}).map(([color, entry]) => [
          color,
          {
            price: clampBaht(entry?.price ?? 0),
            stock: clampStock(entry?.stock ?? 0),
          },
        ])
      );

      await setColorPrices(cleanPrices);

      // Apply color prices to products
      applyColorPricesToAllColorPricedProducts(cleanPrices);
      
      closeColorPriceModal();
    } catch (error) {
      console.error('Error saving color prices:', error);
      alert(`บันทึกราคาสีไม้ไม่สำเร็จ: ${error.message}`);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({ name: '', price: '', category: '', image: '', color: '', stock: '0' });
    setErrors({});
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      price: product.price || '',
      category: product.category || '',
      image: product.imagePath || product.image || '',
      color: product.color || '',
      stock: String(product.stock ?? 0)
    });
    setShowForm(true);
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleStockClick = (product) => {
    setSelectedProduct(product);
    setStockInput('');
    setShowStockModal(true);
  };

  const handleStockUpdate = async () => {
    if (!selectedProduct || !stockInput.trim()) return;
    
    const addAmount = parseInt(stockInput);
    if (isNaN(addAmount) || addAmount <= 0) {
      alert('กรุณาใส่จำนวนที่ถูกต้อง');
      return;
    }

    try {
      const newStock = (selectedProduct.stock || 0) + addAmount;

      await updateProduct(selectedProduct.id, { stock: newStock });
      setShowStockModal(false);
      setSelectedProduct(null);
      setStockInput('');
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดทสต็อก: ' + error.message);
    }
  };

  const handleDeleteConfirm = async () => {
    if (productToDelete) {
      try {
        await deleteProduct(productToDelete.id);
        // โหลดสินค้าใหม่หลังลบ เพื่อให้ UI อัปเดตทันที
        if (typeof loadProducts === 'function') {
          await loadProducts();
        }
        setShowDeleteModal(false);
        setProductToDelete(null);
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('เกิดข้อผิดพลาดในการลบสินค้า: ' + error.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = 'กรุณาใส่ชื่อสินค้า';
    
    // ตรวจสอบราคา - ถ้าเป็นประเภทที่ใช้ราคาตามสี ให้ใช้ราคาจาก colorPrices
    let finalPrice = 0;
    if (shouldUseColorPrice()) {
      const colorEntry = getColorData(formData.color);
      finalPrice = Number(colorEntry?.price ?? 0);
      if (!finalPrice || finalPrice <= 0) {
        newErrors.price = `กรุณาตั้งราคาสำหรับสี ${formData.color} ในการตั้งค่าราคาสีก่อน`;
      }
    } else {
      finalPrice = Number(formData.price || 0);
      if (!finalPrice || finalPrice <= 0) newErrors.price = 'กรุณาใส่ราคาที่ถูกต้อง';
    }

    if (!formData.category) newErrors.category = 'กรุณาเลือกหมวดหมู่';
    const stockValue = Number(formData.stock || 0);
    if (!shouldUseColorPrice() && stockValue < 0) newErrors.stock = 'จำนวนสต็อกต้องไม่ติดลบ';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const productData = {
        name: formData.name.trim(),
        price: Number(finalPrice) || 0,
        category: formData.category,
        image: formData.image,
        color: formData.color,
        stock: shouldUseColorPrice() ? 0 : Math.max(0, parseInt(formData.stock, 10) || 0),
        active: true
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
      } else {
        await addProduct(productData);
      }

      handleCloseForm();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกสินค้า: ' + error.message);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // ตรวจสอบขนาดไฟล์ (ไม่เกิน 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('ไฟล์รูปภาพใหญ่เกินไป กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 5MB');
      return;
    }

    // ตรวจสอบประเภทไฟล์
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('ประเภทไฟล์ไม่ถูกต้อง กรุณาเลือกไฟล์ JPG, PNG, GIF หรือ WebP');
      return;
    }

    try {
      setIsUploading(true);

      // Upload to server via API
      const response = await API.uploadProductImage(file);

      if (response && (response.filename || response.relativeUrl || response.imageUrl)) {
        const nextPath = response.filename || response.relativeUrl || response.imageUrl;

        setFormData(prev => ({
          ...prev,
          image: nextPath
        }));
        console.log('✅ Image uploaded successfully:', nextPath);
      } else {
        throw new Error('ไม่สามารถรับข้อมูลไฟล์จากเซิร์ฟเวอร์ได้');
      }

    } catch (error) {
      console.error('Error uploading image:', error);
      alert('เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ: ' + (error.message || error));
    } finally {
      setIsUploading(false);
    }
  };

  // Separate products into color-priced and others
  const colorPricedProducts = products.filter((p) => isColorPriced(p.category));
  const otherProducts = products.filter((p) => !isColorPriced(p.category));

  const selectedColorData = getColorData(formData.color);

  const uniqueProducts = products.filter(
    (product, index, self) =>
      index === self.findIndex((p) => p.id === product.id)
  );

  return (
    <>
      <div className="pageBg">
        <div className={styles.container}>
          {/* Header Section */}
          <div className={styles.productsHeader}>
            <div className={styles.headerContent}>
              <div className={styles.headerMain}>
                <h1 className={styles.pageTitle}>
                  <FaBoxOpen className={styles.titleIcon} />
                  จัดการสินค้า
                </h1>
                <p className={styles.pageSubtitle}>
                  เพิ่ม แก้ไข และจัดการสินค้าทั้งหมดในระบบ ({filteredProducts.length} รายการ)
                </p>
              </div>
              <div className={styles.headerActions}>
                <button 
                  className={styles.primaryButton}
                  onClick={() => setShowForm(true)}
                >
                  <FaPlus />
                  เพิ่มสินค้าใหม่
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={openColorPriceModal}
                  type="button"
                >
                  <FaPalette />
                  จัดการสีไม้
                </button>
              </div>
          </div>
        </div>

        <div className={styles.colorSummarySection}>
          <div className={styles.colorSummaryHeader}>
            <span className={styles.colorSummaryTitle}>สีไม้ในคลัง</span>
            <button type="button" className={styles.linkButton} onClick={openColorPriceModal}>
              จัดการสีไม้ทั้งหมด
            </button>
          </div>
          <div className={styles.colorSummaryList}>
            {colorSummaryEntries.length ? (
              colorSummaryEntries.map(([color, entry]) => (
                <div key={color} className={styles.colorSummaryItem}>
                  <span className={styles.colorSummaryDot} style={{ backgroundColor: color }} />
                  <div className={styles.colorSummaryInfo}>
                    <span className={styles.colorSummaryName}>{color.toUpperCase()}</span>
                    <span className={styles.colorSummaryMeta}>
                      ราคา {Number(entry?.price ?? 0)} ฿ • สต็อก {Number(entry?.stock ?? 0)} ไม้
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.colorSummaryEmpty}>
                <p>ยังไม่มีข้อมูลสีไม้ กรุณาเพิ่มผ่านปุ่ม “จัดการสีไม้”</p>
              </div>
            )}
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className={styles.filtersSection}>
            <div className={styles.filtersContainer}>
              <div className={styles.searchBox}>
                <FaSearch className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="ค้นหาสินค้า..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.filterBox}>
                <FaFilter className={styles.filterIcon} />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">ทุกหมวดหมู่</option>
                  <option value="meat">เนื้อ</option>
                  <option value="seafood">อาหารทะเล</option>
                  <option value="vegetable">ผัก</option>
                  <option value="drink">เครื่องดื่ม</option>
                </select>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className={styles.productsContent}>
            {filteredProducts.length === 0 ? (
              <div className={styles.emptyState}>
                <FaBoxOpen className={styles.emptyIcon} />
                <h3>ไม่พบสินค้า</h3>
                <p>ลองค้นหาด้วยคำอื่น หรือเพิ่มสินค้าใหม่</p>
              </div>
            ) : (
              <div className={styles.productsGrid}>
                {filteredProducts.map(product => (
                  <div key={product.id} className={`${styles.productCard} ${!product.color && (product.stock || 0) === 0 ? styles.outOfStock : ''}`}>
                    <div className={styles.productImage}>
                      {product.image || product.imagePath ? (
                        <div className={styles.imageContainer}>
                          <img 
                            src={getImageUrl(product.imagePath || product.image)} 
                            alt={product.name}
                            className={!product.color && (product.stock || 0) === 0 ? styles.outOfStockImage : ''}
                          />
                          {!product.color && (product.stock || 0) === 0 && (
                            <div className={styles.outOfStockOverlay}>
                              <span className={styles.outOfStockText}>หมดสต็อก</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`${styles.noImage} ${!product.color && (product.stock || 0) === 0 ? styles.outOfStockNoImage : ''}`}>
                          <FaImage />
                          <span>ไม่มีรูปภาพ</span>
                          {!product.color && (product.stock || 0) === 0 && (
                            <div className={styles.outOfStockOverlay}>
                              <span className={styles.outOfStockText}>หมดสต็อก</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className={styles.productActions}>
                        <button
                          className={`${styles.stockButton} ${(product.stock || 0) === 0 ? styles.priorityButton : ''}`}
                          onClick={() => handleStockClick(product)}
                          title={product.color ? 'จัดการสต็อกผ่านสีไม้' : `เติม Stock${(product.stock || 0) === 0 ? ' (หมดสต็อก)' : ''}`}
                          disabled={!!product.color}
                        >
                          <FaPlusCircle />
                        </button>
                        <button
                          className={styles.editButton}
                          onClick={() => handleEditProduct(product)}
                          title="แก้ไข"
                        >
                          <FaEdit />
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDeleteClick(product)}
                          title="ลบ"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </div>
                    <div className={styles.productInfo}>
                      <h3 className={styles.productName}>{product.name}</h3>
                      <div className={styles.productMeta}>
                        <span className={styles.productCategory}>
                          <FaTag />
                          {product.category}
                        </span>
                        <span className={styles.productColor}>
                          <ColorDot color={product.color} />
                          {product.color}
                        </span>
                      </div>
                      <div className={styles.productPrice}>
                        <FaMoneyBillWave />
                        {product.price}฿
                      </div>
                      {!product.color && (
                        <div className={styles.productStock}>
                          <span className={styles.stockLabel}>สต็อก:</span>
                          <span className={`${styles.stockValue} ${(product.stock || 0) === 0 ? styles.stockEmpty : (product.stock || 0) <= 5 ? styles.stockLow : styles.stockNormal}`}>
                            {product.stock || 0} ชิ้น
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Form Modal */}
          {showForm && (
            <div className={styles.modalBackdrop}>
              <div className={styles.modal}>
                <div className={styles.modalHeader}>
                  <div className={styles.modalHeaderContent}>
                    <div className={styles.modalIcon}>
                      {editingProduct ? <FaEdit /> : <FaPlus />}
                    </div>
                    <div className={styles.modalTitleGroup}>
                      <h2 className={styles.modalTitle}>
                        {editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
                      </h2>
                      <p className={styles.modalSubtitle}>
                        {editingProduct ? 'ปรับปรุงข้อมูลสินค้าของคุณ' : 'เพิ่มสินค้าใหม่เข้าสู่ระบบ'}
                      </p>
                    </div>
                  </div>
                  <button 
                    className={styles.closeButton}
                    onClick={handleCloseForm}
                    title="ปิด"
                  >
                    <FaTimes />
                  </button>
                </div>
                
                <div className={styles.modalBody}>
                  <form onSubmit={handleSubmit} className={styles.modalForm}>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          <FaTag className={styles.labelIcon} />
                          ชื่อสินค้า *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))
                          }
                          className={`${styles.formInput} ${errors.name ? styles.inputError : ''}`}
                          placeholder="เช่น หมูสามชั้น, ลูกชิ้นปลา"
                        />
                        <FieldError>{errors.name}</FieldError>
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          <FaBoxOpen className={styles.labelIcon} />
                          จำนวนสต็อก
                        </label>
                        <div className={styles.priceInputGroup}>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.color ? '0' : formData.stock}
                            onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))
                            }
                            className={`${styles.formInput} ${errors.stock ? styles.inputError : ''}`}
                            placeholder="0"
                            disabled={!!formData.color}
                          />
                          <span className={styles.priceUnit}>ชิ้น</span>
                        </div>
                        <FieldError>{errors.stock}</FieldError>
                        {formData.color && (
                          <small className={styles.priceHint}>
                            💡 สินค้าที่เลือกสีไม้จะใช้สต็อกจากสีโดยอัตโนมัติ ไม่ต้องกำหนดสต็อกที่ตัวสินค้า
                          </small>
                        )}
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          <FaMoneyBillWave className={styles.labelIcon} />
                          ราคา (บาท) *
                        </label>
                        {formData.color && selectedColorData ? (
                          <div className={styles.priceDisplay}>
                            <div className={styles.autoPriceInfo}>
                              <span className={styles.autoPriceLabel}>ราคาจากสี {formData.color}:</span>
                              <span className={styles.autoPriceValue}>
                                {selectedColorData.price ?? 0} ฿
                              </span>
                            </div>
                            <input
                              type="hidden"
                              value={selectedColorData.price ?? 0}
                            />
                          </div>
                        ) : (
                          <div className={styles.priceInputGroup}>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={formData.price}
                              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))
                              }
                              className={`${styles.formInput} ${errors.price ? styles.inputError : ''}`}
                              placeholder="0.00"
                            />
                            <span className={styles.priceUnit}>฿</span>
                          </div>
                        )}
                        <FieldError>{errors.price}</FieldError>
                        {formData.color && selectedColorData && (
                          <small className={styles.priceHint}>
                            💡 ราคาถูกกำหนดอัตโนมัติจากสี {formData.color} (กดสีอีกครั้งเพื่อยกเลิก) — สต็อกสีนี้ {selectedColorData.stock ?? 0} ไม้
                          </small>
                        )}
                        {!formData.color && (
                          <small className={styles.priceHint}>
                            💡 เลือกสีเพื่อใช้ราคาอัตโนมัติ หรือกรอกราคาเอง
                          </small>
                        )}
                      </div>

                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          <span className={styles.colorLabelIcon}>🎨</span>
                          สีไม้
                        </label>
                        <div className={styles.colorGrid}>
                          {colorOptions.map((color) => {
                            const colorData = getColorData(color);
                            return (
                              <button
                                key={color}
                                type="button"
                                className={`${styles.colorOption} ${formData.color === color ? styles.colorOptionActive : ''}`}
                                onClick={() => handleColorChange(color)}
                                style={{ backgroundColor: color }}
                                title={colorData ? `${color} (${colorData.price ?? 0} ฿ · สต็อก ${colorData.stock ?? 0})` : color}
                              >
                                {formData.color === color && (
                                  <span className={styles.colorCheck}>✓</span>
                                )}
                                {colorData && (
                                  <span className={styles.colorPrice}>{colorData.price ?? 0}฿</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <small className={styles.colorHint}>
                          💡 เลือกสีเพื่อใช้ราคาอัตโนมัติ กดสีซ้ำเพื่อยกเลิก
                        </small>
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          <FaBoxOpen className={styles.labelIcon} />
                          หมวดหมู่ *
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                          className={`${styles.formSelect} ${errors.category ? styles.inputError : ''}`}
                        >
                          <option value="">เลือกหมวดหมู่สินค้า</option>
                          <option value="meat">🥩 เนื้อ</option>
                          <option value="seafood">🦐 อาหารทะเล</option>
                          <option value="vegetable">🥬 ผัก</option>
                          <option value="drink">🥤 เครื่องดื่ม</option>
                        </select>
                        <FieldError>{errors.category}</FieldError>
                      </div>

                      <div className={styles.formGroup}>
                        {/* Empty space for layout balance */}
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <FaImage className={styles.labelIcon} />
                        รูปภาพสินค้า
                      </label>
                      <div className={`${styles.imageUpload} ${isUploading ? styles.imageUploadLoading : ''}`}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className={styles.fileInput}
                          id="imageUpload"
                        />
                        {!formData.image ? (
                          <label htmlFor="imageUpload" className={styles.uploadArea}>
                            <div className={styles.uploadIcon}>
                              {isUploading ? (
                                <div className={styles.loadingSpinner}></div>
                              ) : (
                                <FaUpload />
                              )}
                            </div>
                            <div className={styles.uploadText}>
                              <span className={styles.uploadTitle}>
                                {isUploading ? 'กำลังอัพโหลด...' : 'คลิกเพื่อเลือกรูปภาพ'}
                              </span>
                              <span className={styles.uploadSubtext}>
                                หรือลากและวางไฟล์มาที่นี่
                              </span>
                              <span className={styles.uploadHint}>
                                รองรับ JPG, PNG ขนาดไม่เกิน 5MB
                              </span>
                            </div>
                          </label>
                        ) : (
                          <div className={styles.imagePreview}>
                            <img
                              src={getImageUrl(formData.image)} 
                              alt="รูปสินค้า" 
                              className={styles.previewImage}
                              onError={(e) => {
                                console.error('Image load error:', e.target.src);
                                e.target.style.display = 'none';
                                // แสดง fallback message
                                const parent = e.target.parentNode;
                                if (!parent.querySelector('.image-error')) {
                                  const errorDiv = document.createElement('div');
                                  errorDiv.className = 'image-error';
                                  errorDiv.style.cssText = `
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    width: 100%;
                                    height: 200px;
                                    background: #f3f4f6;
                                    color: #6b7280;
                                    flex-direction: column;
                                    gap: 0.5rem;
                                  `;
                                  errorDiv.innerHTML = `
                                    <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                    </svg>
                                    <span>ไม่สามารถโหลดรูปภาพได้</span>
                                  `;
                                  parent.appendChild(errorDiv);
                                }
                              }}
                            />
                            <div className={styles.imageOverlay}>
                              <button
                                type="button"
                                className={styles.changeImageButton}
                                onClick={() => document.getElementById('imageUpload').click()}
                              >
                                <FaEdit />
                                เปลี่ยนรูป
                              </button>
                              <button
                                type="button"
                                className={styles.removeImageButton}
                                onClick={() => setFormData(prev => ({ ...prev, image: '' }))
                                }
                              >
                                <FaTrash />
                                ลบรูป
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                </div>

                <div className={styles.modalFooter}>
                  <button 
                    type="button" 
                    onClick={handleCloseForm} 
                    className={styles.cancelButton}
                  >
                    <FaTimes />
                    ยกเลิก
                  </button>
                  <button 
                    type="submit" 
                    onClick={handleSubmit}
                    className={styles.submitButton}
                    disabled={isUploading}
                  >
                    <FaSave />
                    {editingProduct ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          <ConfirmModal
            open={showDeleteModal}
            onCancel={() => {
              setShowDeleteModal(false);
              setProductToDelete(null);
            }}
            onConfirm={handleDeleteConfirm}
            title="ยืนยันการลบสินค้า"
            message={`คุณแน่ใจหรือไม่ที่จะลบสินค้า "${productToDelete?.name}"?`}
            variant="warning"
          />

          {/* Color Price Modal */}
          {showColorPriceModal && (
            <div className={styles.modalBackdrop} onClick={closeColorPriceModal}>
              <div className={colorStyles.colorPricingModal} onClick={(e) => e.stopPropagation()}>
                <div className={colorStyles.modalHeader}>
                  <div>
                    <h3 className={colorStyles.modalTitle}>กำหนดราคาตามสีไม้</h3>
                    <p className={colorStyles.modalSubtitle}>ตั้งค่าราคาและสต็อกสำหรับแต่ละสีไม้</p>
                  </div>
                  <button 
                    className={styles.closeButton}
                    onClick={closeColorPriceModal}
                  >
                    <FaTimes />
                  </button>
                </div>

                <div className={styles.colorPricingBody}>
                  <div className={styles.colorList}>
                    {draftColorKeys.length ? draftColorKeys.map((color) => {
                      const entry = draftColorPrices?.[color] || { price: '', stock: '' };
                      return (
                        <div key={color} className={styles.colorItem}>
                          <div className={styles.colorInfo}>
                            <div className={styles.colorItemDot} style={{ backgroundColor: color }} />
                            <div className={styles.colorTextGroup}>
                              <span className={styles.colorName}>{color.toUpperCase()}</span>
                              <span className={styles.colorMeta}>ราคา {entry.price ?? 0} ฿ • สต็อก {entry.stock ?? 0} ไม้</span>
                            </div>
                          </div>
                          <div className={styles.colorControls}>
                            <div className={styles.colorControlGroup}>
                              <label>สต็อก</label>
                              <div className={styles.stockInputGroup}>
                                <input
                                  className={styles.stockInput}
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={entry.stock ?? 0}
                                  onChange={(e) => handleDraftStockChange(color, e.target.value)}
                                />
                                <span className={styles.stockUnit}>ไม้</span>
                              </div>
                            </div>
                            <div className={styles.colorControlGroup}>
                              <label>ราคา</label>
                              <div className={styles.priceInputGroup}>
                                <input
                                  className={styles.priceInput}
                                  type="number"
                                  min={0}
                                  value={entry.price ?? 0}
                                  onChange={(e) => handleDraftPriceChange(color, e.target.value)}
                                />
                                <span className={styles.priceUnit}>฿</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className={styles.removeColorButton}
                              onClick={() => handleRemoveDraftColor(color)}
                              title="ลบสีนี้"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className={styles.colorSummaryEmpty}>
                        <p>ยังไม่มีข้อมูลสีไม้ กรุณาเพิ่มจากฟอร์มด้านล่าง</p>
                      </div>
                    )}
                  </div>

                  <div className={colorStyles.addColorForm}>
                    <h4 className={colorStyles.formTitle}>เพิ่มสีใหม่</h4>
                    <div className={colorStyles.formGrid}>
                      <div className={colorStyles.formGroup}>
                        <label className={colorStyles.formLabel}>ชื่อสี</label>
                        <input
                          type="text"
                          className={colorStyles.formInput}
                          placeholder="เช่น blue, green, pink"
                          value={newColorName}
                          onChange={(e) => setNewColorName(e.target.value)}
                        />
                      </div>
                      <div className={colorStyles.formGroup}>
                        <label className={colorStyles.formLabel}>สต็อก</label>
                        <div className={colorStyles.inputGroup}>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            className={colorStyles.formInput}
                            value={newColorStock}
                            onChange={(e) => setNewColorStock(e.target.value)}
                            placeholder="0"
                          />
                          <span className={colorStyles.inputUnit}>ไม้</span>
                        </div>
                      </div>
                      <div className={colorStyles.formGroup}>
                        <label className={colorStyles.formLabel}>ราคา</label>
                        <div className={colorStyles.inputGroup}>
                          <input
                            type="number"
                            min={0}
                            className={colorStyles.formInput}
                            value={newColorPrice}
                            onChange={(e) => setNewColorPrice(e.target.value)}
                            placeholder="0"
                          />
                          <span className={colorStyles.inputUnit}>฿</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={colorStyles.addButton}
                        onClick={handleAddDraftColor}
                        disabled={!newColorName.trim()}
                      >
                        <FaPlus />
                        เพิ่มสี
                      </button>
                    </div>
                  </div>

                  {hasInvalidPriceInModal && (
                    <div className={styles.errorBanner}>
                      <FaTimes className={styles.errorIcon} />
                      กรุณากรอกราคาและสต็อกเป็นตัวเลขที่ไม่ติดลบ (สต็อกต้องเป็นจำนวนเต็ม)
                    </div>
                  )}

                  <div className={styles.quickActions}>
                    <div className={styles.quickActionsHeader}>
                      <span className={styles.quickLabel}>⚡ ปรับราคาอย่างรวดเร็ว</span>
                    </div>
                    <div className={styles.quickButtonGroups}>
                      <div className={styles.quickButtonGroup}>
                        <span className={styles.groupLabel}>จำนวนเงิน:</span>
                        <button className={styles.quickButton} onClick={() => nudgeDraftTHB(-5)}>-5฿</button>
                        <button className={styles.quickButton} onClick={() => nudgeDraftTHB(-1)}>-1฿</button>
                        <button className={styles.quickButton} onClick={() => nudgeDraftTHB(+1)}>+1฿</button>
                        <button className={styles.quickButton} onClick={() => nudgeDraftTHB(+5)}>+5฿</button>
                      </div>
                      <div className={styles.quickButtonGroup}>
                        <span className={styles.groupLabel}>เปอร์เซ็นต์:</span>
                        <button className={styles.quickButton} onClick={() => nudgeDraftPercent(-10)}>-10%</button>
                        <button className={styles.quickButton} onClick={() => nudgeDraftPercent(-5)}>-5%</button>
                        <button className={styles.quickButton} onClick={() => nudgeDraftPercent(+5)}>+5%</button>
                        <button className={styles.quickButton} onClick={() => nudgeDraftPercent(+10)}>+10%</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button 
                    className={styles.cancelButton} 
                    onClick={closeColorPriceModal}
                  >
                    <FaTimes />
                    ยกเลิก
                  </button>
                  <button 
                    className={styles.submitButton} 
                    disabled={hasInvalidPriceInModal} 
                    onClick={saveColorPrices}
                  >
                    <FaSave />
                    บันทึกราคา
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stock Modal */}
          {showStockModal && selectedProduct && (
            <div className={styles.modalOverlay} onClick={() => setShowStockModal(false)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h3>เติมสต็อก - {selectedProduct.name}</h3>
                  <button 
                    className={styles.closeButton}
                    onClick={() => setShowStockModal(false)}
                  >
                    <FaTimes />
                  </button>
                </div>

                <div className={styles.modalBody}>
                  <div className={styles.stockInfo}>
                    <div className={styles.currentStock}>
                      <span className={styles.stockLabel}>สต็อกปัจจุบัน:</span>
                      <span className={`${styles.stockValue} ${(selectedProduct.stock || 0) === 0 ? styles.stockEmpty : (selectedProduct.stock || 0) <= 5 ? styles.stockLow : styles.stockNormal}`}>
                        {selectedProduct.stock || 0} ชิ้น
                      </span>
                    </div>
                    
                    <div className={styles.stockInput}>
                      <label className={styles.inputLabel}>จำนวนที่ต้องการเติม:</label>
                      <input
                        type="number"
                        value={stockInput}
                        onChange={(e) => setStockInput(e.target.value)}
                        placeholder="ใส่จำนวนที่ต้องการเติม"
                        className={styles.input}
                        min="1"
                        autoFocus
                      />
                    </div>

                    {stockInput && !isNaN(parseInt(stockInput)) && parseInt(stockInput) > 0 && (
                      <div className={styles.newStock}>
                        <span className={styles.stockLabel}>สต็อกใหม่จะเป็น:</span>
                        <span className={styles.stockValue}>
                          {(selectedProduct.stock || 0) + parseInt(stockInput)} ชิ้น
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button 
                    className={styles.cancelButton} 
                    onClick={() => setShowStockModal(false)}
                  >
                    <FaTimes />
                    ยกเลิก
                  </button>
                  <button 
                    className={styles.submitButton} 
                    onClick={handleStockUpdate}
                    disabled={!stockInput.trim() || isNaN(parseInt(stockInput)) || parseInt(stockInput) <= 0}
                  >
                    <FaPlusCircle />
                    เติมสต็อก
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


