import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDataStore } from '../../store/data.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import styles from './Products.module.css';
import API, { getImageUrl } from '../../services/api';
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
} from 'react-icons/fa';

const ColorDot = ({ color }) => (
  <span
    className={styles.colorDot}
    style={{ backgroundColor: color || '#888' }}
  />
);

const FieldError = ({ children }) =>
  children ? <p className={styles.errorText}>{children}</p> : null;

const FALLBACK_COLORS = ['red', 'green', 'blue', 'pink', 'purple'];
const COLOR_PRICE_CATS = new Set(['meat', 'veg', 'seafood', 'meatball']);

const isColorPriced = (cat) => COLOR_PRICE_CATS.has(String(cat || '').toLowerCase());

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
          <span className={styles.colorPrice}>{(colorPrices?.[c] ?? 0)}฿</span>
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
    stock: 0
  });

  const categoriesList = ['meat', 'seafood', 'vegetable', 'drink'];

  // ดึงสีจากฐานข้อมูล colorPrices แทนการ hardcode และเรียงจากราคามากไปน้อย
  const colorOptions = useMemo(() => {
    const colors = Object.keys(colorPrices || {});
    if (colors.length > 0) {
      // เรียงสีตามราคาจากมากไปน้อย
      return colors.sort((a, b) => (colorPrices[b] || 0) - (colorPrices[a] || 0));
    }
    return ['red', 'green', 'blue', 'pink', 'purple']; // fallback
  }, [colorPrices]);

  // ตรวจสอบว่าสินค้าเป็นประเภทที่ใช้ราคาตามสี
  const isColorPricedCategory = (category) => {
    return ['meat', 'seafood', 'vegetable', 'meatball'].includes(String(category || '').toLowerCase());
  };

  // ตรวจสอบว่าควรใช้ราคาจากสีหรือไม่
  const shouldUseColorPrice = () => {
    return isColorPricedCategory(formData.category) && formData.color;
  };

  // ฟังก์ชันจัดการการเปลี่ยนสี
  const handleColorChange = (color) => {
    // ถ้ากดสีที่เลือกอยู่แล้ว ให้ยกเลิกการเลือก
    if (formData.color === color) {
      setFormData(prev => ({ 
        ...prev, 
        color: '', 
        price: '' // เคลียร์ราคาเพื่อให้กรอกเองได้
      }));
      return;
    }

    const newFormData = { ...formData, color };
    
    // เติมราคาจาก colorPrices ทันทีโดยไม่ต้องตรวจสอบ category
    if (colorPrices[color] !== undefined) {
      newFormData.price = colorPrices[color].toString();
    }
    
    setFormData(newFormData);
  };

  // ฟังก์ชันจัดการการเปลี่ยนหมวดหมู่
  const handleCategoryChange = (category) => {
    const newFormData = { ...formData, category };
    
    // ถ้าเป็นหมวดหมู่ที่ใช้ราคาตามสี และมีสีเลือกไว้แล้ว ให้ตั้งราคาจาก colorPrices
    if (isColorPricedCategory(category) && formData.color && colorPrices[formData.color] !== undefined) {
      newFormData.price = colorPrices[formData.color].toString();
    } else if (!isColorPricedCategory(category)) {
      // ถ้าไม่ใช่หมวดหมู่ที่ใช้ราคาตามสี ให้เคลียร์ราคา
      newFormData.price = '';
    }
    
    setFormData(newFormData);
  };

  // useEffect เพื่อเติมราคาอัตโนมัติเมื่อมีการเปลี่ยนแปลง color หรือ colorPrices
  useEffect(() => {
    // เติมราคาเมื่อมีสีและมีราคาในฐานข้อมูล โดยไม่ต้องตรวจสอบ category
    if (formData.color && colorPrices[formData.color] !== undefined) {
      setFormData(prev => ({
        ...prev,
        price: colorPrices[formData.color].toString()
      }));
    }
  }, [formData.color, colorPrices]);

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
  const [draftColorPrices, setDraftColorPrices] = useState(colorPrices || {});

  const COLORS = useMemo(
    () => (Object.keys(colorPrices || {}).length ? Object.keys(colorPrices) : FALLBACK_COLORS),
    [colorPrices]
  );

  const openColorPriceModal = () => setShowColorPriceModal(true);
  const closeColorPriceModal = () => setShowColorPriceModal(false);

  // Sync draft when opening modal
  useEffect(() => {
    if (showColorPriceModal) setDraftColorPrices(colorPrices || {});
  }, [showColorPriceModal, colorPrices]);

  // Apply color prices to all color-priced products
  const applyColorPricesToAllColorPricedProducts = useCallback(
    (prices) => {
      const priceMap = prices || colorPrices || {};
      (products || []).forEach((p) => {
        if (isColorPriced(p.category)) {
          const newPrice = Number(priceMap[(p.color || 'red').toLowerCase()] || 0);
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

  const hasInvalidPriceInModal = useMemo(
    () => (COLORS || []).some((c) => Number.isNaN(Number(draftColorPrices[c])) || Number(draftColorPrices[c]) < 0),
    [COLORS, draftColorPrices]
  );

  const clampBaht = (v) => Math.max(0, Math.round(Number(v) || 0));
  
  const nudgeDraftTHB = (delta) => {
    setDraftColorPrices((prev) => {
      const out = { ...(prev || {}) };
      (COLORS || []).forEach((c) => {
        out[c] = clampBaht((prev?.[c] ?? 0) + delta);
      });
      return out;
    });
  };

  const nudgeDraftPercent = (pct) => {
    setDraftColorPrices((prev) => {
      const out = { ...(prev || {}) };
      (COLORS || []).forEach((c) => {
        out[c] = clampBaht((prev?.[c] ?? 0) * (1 + pct / 100));
      });
      return out;
    });
  };

  const saveColorPrices = async () => {
    if (hasInvalidPriceInModal) return;
    try {
      // Save to database via API
      const cleanPrices = Object.fromEntries(
        Object.entries(draftColorPrices).map(([k, v]) => [k, Number(v) || 0])
      );
      
      await API.colorPrices.set(cleanPrices);
      
      // Update local state
      setColorPrices(draftColorPrices);
      
      // Apply color prices to products
      applyColorPricesToAllColorPricedProducts(draftColorPrices);
      
      closeColorPriceModal();
    } catch (error) {
      console.error('Error saving color prices:', error);
      alert(`บันทึกราคาสีไม้ไม่สำเร็จ: ${error.message}`);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({ name: '', price: '', category: '', image: '', color: '', stock: 0 });
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
      stock: product.stock || 0
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
      const updatedProduct = { ...selectedProduct, stock: newStock };
      
      // Update in database via API
      await API.products.update(selectedProduct.id, updatedProduct);
      // Update local state
      updateProduct(selectedProduct.id, updatedProduct);
      
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
    let finalPrice = formData.price;
    if (shouldUseColorPrice()) {
      finalPrice = colorPrices[formData.color];
      if (!finalPrice || finalPrice <= 0) {
        newErrors.price = `กรุณาตั้งราคาสำหรับสี ${formData.color} ในการตั้งค่าราคาสีก่อน`;
      }
    } else {
      if (!formData.price || formData.price <= 0) newErrors.price = 'กรุณาใส่ราคาที่ถูกต้อง';
    }
    
    if (!formData.category) newErrors.category = 'กรุณาเลือกหมวดหมู่';
    if (formData.stock < 0) newErrors.stock = 'จำนวนสต็อกต้องไม่ติดลบ';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const productData = {
        name: formData.name.trim(),
        price: parseFloat(finalPrice),
        category: formData.category,
        image: formData.image,
        color: formData.color,
        stock: parseInt(formData.stock) || 0,
        active: true
      };

      if (editingProduct) {
        // Update existing product via API
        const updatedProduct = await API.products.update(editingProduct.id, productData);
        updateProduct(editingProduct.id, updatedProduct);
      } else {
        // Create new product via API
        const newProduct = await API.products.create(productData);
        addProduct(newProduct);
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
               
              </div>
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
                  <div key={product.id} className={`${styles.productCard} ${(product.stock || 0) === 0 ? styles.outOfStock : ''}`}>
                    <div className={styles.productImage}>
                      {product.image || product.imagePath ? (
                        <div className={styles.imageContainer}>
                          <img 
                            src={getImageUrl(product.imagePath || product.image)} 
                            alt={product.name}
                            className={(product.stock || 0) === 0 ? styles.outOfStockImage : ''}
                          />
                          {(product.stock || 0) === 0 && (
                            <div className={styles.outOfStockOverlay}>
                              <span className={styles.outOfStockText}>หมดสต็อก</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className={`${styles.noImage} ${(product.stock || 0) === 0 ? styles.outOfStockNoImage : ''}`}>
                          <FaImage />
                          <span>ไม่มีรูปภาพ</span>
                          {(product.stock || 0) === 0 && (
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
                          title={`เติม Stock${(product.stock || 0) === 0 ? ' (หมดสต็อก)' : ''}`}
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
                      <div className={styles.productStock}>
                        <span className={styles.stockLabel}>สต็อก:</span>
                        <span className={`${styles.stockValue} ${(product.stock || 0) === 0 ? styles.stockEmpty : (product.stock || 0) <= 5 ? styles.stockLow : styles.stockNormal}`}>
                          {product.stock || 0} ชิ้น
                        </span>
                      </div>
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
                            value={formData.stock}
                            onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))
                            }
                            className={`${styles.formInput} ${errors.stock ? styles.inputError : ''}`}
                            placeholder="0"
                          />
                          <span className={styles.priceUnit}>ชิ้น</span>
                        </div>
                        <FieldError>{errors.stock}</FieldError>
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>
                          <FaMoneyBillWave className={styles.labelIcon} />
                          ราคา (บาท) *
                        </label>
                        {formData.color && colorPrices[formData.color] ? (
                          <div className={styles.priceDisplay}>
                            <div className={styles.autoPriceInfo}>
                              <span className={styles.autoPriceLabel}>ราคาจากสี {formData.color}:</span>
                              <span className={styles.autoPriceValue}>
                                {colorPrices[formData.color] || 0} ฿
                              </span>
                            </div>
                            <input
                              type="hidden"
                              value={colorPrices[formData.color] || 0}
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
                        {formData.color && colorPrices[formData.color] && (
                          <small className={styles.priceHint}>
                            💡 ราคาถูกกำหนดอัตโนมัติจากสี {formData.color} (กดสีอีกครั้งเพื่อยกเลิก)
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
                          {colorOptions.map(color => (
                            <button
                              key={color}
                              type="button"
                              className={`${styles.colorOption} ${formData.color === color ? styles.colorOptionActive : ''}`}
                              onClick={() => handleColorChange(color)}
                              style={{ backgroundColor: color }}
                              title={`${color} ${colorPrices[color] ? `(${colorPrices[color]} ฿)` : ''}`}
                            >
                              {formData.color === color && (
                                <span className={styles.colorCheck}>✓</span>
                              )}
                              {colorPrices[color] && (
                                <span className={styles.colorPrice}>{colorPrices[color]}฿</span>
                              )}
                            </button>
                          ))}
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
              <div className={styles.colorPricingModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.colorPricingHeader}>
                  <div className={styles.modalHeaderContent}>
                    <div className={styles.modalIcon}>
                      <span className={styles.colorLabelIcon}>🎨</span>
                    </div>
                    <div className={styles.modalTitleGroup}>
                      <h3 className={styles.colorPricingTitle}>กำหนดราคาตามสีไม้</h3>
                      <p className={styles.modalSubtitle}>ตั้งราคาสำหรับแต่ละสีของสินค้า</p>
                    </div>
                  </div>
                  <button 
                    className={styles.closeButton}
                    onClick={closeColorPriceModal}
                    title="ปิด"
                  >
                    <FaTimes />
                  </button>
                </div>

                <div className={styles.colorPricingBody}>
                  <div className={styles.colorList}>
                    {(COLORS || []).map((c) => (
                      <div key={c} className={styles.colorItem}>
                        <div className={styles.colorInfo}>
                          <div className={styles.colorItemDot} style={{ backgroundColor: c }} />
                          <span className={styles.colorName}>{c.toUpperCase()}</span>
                        </div>
                        <div className={styles.priceInputGroup}>
                          <input
                            className={styles.priceInput}
                            type="number"
                            min={0}
                            value={draftColorPrices?.[c] ?? 0}
                            onChange={(e) => setDraftColorPrices((d) => ({ ...d, [c]: e.target.value }))
                            }
                            placeholder="0"
                          />
                          <span className={styles.priceUnit}>฿</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasInvalidPriceInModal && (
                    <div className={styles.errorBanner}>
                      <FaTimes className={styles.errorIcon} />
                      กรุณากรอกราคาเป็นตัวเลขที่ไม่ติดลบ
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
