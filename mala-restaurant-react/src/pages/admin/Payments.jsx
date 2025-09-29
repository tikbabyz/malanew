import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// import { useDataStore } from "../../store/data.js";
import styles from './Payments.module.css';
import API, { getImageUrl } from '../../services/api';
import { 
  FaQrcode, 
  FaUpload, 
  FaSave, 
  FaTrash, 
  FaEye, 
  FaImage,
  FaCreditCard,
  FaMoneyBillWave,
  FaEdit,
  FaCheckCircle,
  FaTimes
} from 'react-icons/fa';

export default function Payments() {
  const navigate = useNavigate();
  const [preview, setPreview] = useState("");
  const [qrImagePath, setQrImagePath] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [qrLabelLocal, setQrLabelLocal] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState({});

  // โหลดข้อมูลจากฐานข้อมูลเมื่อเปิดหน้า
  useEffect(() => {
    (async () => {
      try {
        const data = await API.paymentSettings.get();
        const initialPath = data.qr_image_path || "";
        setQrImagePath(initialPath);
        setPreview(getImageUrl(initialPath || data.qr_image || "") || "");
        setQrLabelLocal(data.qr_label || "");
      } catch (error) {
        console.error('Error loading payment settings:', error);
      }
    })();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ตรวจสอบไฟล์
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setErrors({ file: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)' });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors({ file: 'ประเภทไฟล์ไม่ถูกต้อง (รองรับ JPG, PNG, GIF, WebP)' });
      return;
    }

    try {
      setIsUploading(true);
      setErrors({});
      
      // อัปโหลดไฟล์ผ่าน API สำหรับ QR Code
      const response = await API.uploadQRCode(file);
      
      if (response && (response.filename || response.relativeUrl || response.imageUrl)) {
        const nextPath = response.filename || response.relativeUrl || response.imageUrl;
        setQrImagePath(nextPath);
        setPreview(getImageUrl(nextPath) || "");
        setQrUrl('');
      } else {
        throw new Error('ไม่ได้รับ URL ของรูปภาพจากเซิร์ฟเวอร์');
      }
      
    } catch (error) {
      console.error('Error uploading QR code:', error);
      setErrors({ file: 'เกิดข้อผิดพลาดในการอัปโหลด: ' + (error.message || error) });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlChange = (e) => {
    const value = e.target.value;
    setQrUrl(value);
    if (value) {
      setPreview(value);
      setQrImagePath('');
    }
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!qrLabelLocal.trim()) {
      newErrors.label = 'กรุณาใส่ป้ายกำกับ';
    }
    if (!qrImagePath && !preview && !qrUrl) {
      newErrors.image = 'กรุณาอัปโหลดรูป QR Code หรือใส่ URL';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      const finalQR = qrImagePath || qrUrl || preview || "";
      const finalLabel = qrLabelLocal.trim() || "สแกนจ่ายด้วยพร้อมเพย์";
      await API.paymentSettings.set({
        qr_image: finalQR,
        qr_image_path: qrImagePath,
        qr_label: finalLabel,
      });
      setErrors({});
      alert("✅ บันทึก QR Code เรียบร้อยแล้ว");
      navigate("/admin");
    } catch (error) {
      console.error('Error saving QR:', error);
      setErrors({ save: 'เกิดข้อผิดพลาดในการบันทึก' });
    }
  };

  const handleClear = async () => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบ QR Code?')) {
      await API.paymentSettings.set({ qr_image: "", qr_image_path: "", qr_label: "สแกนจ่ายด้วยพร้อมเพย์" });
      setPreview("");
      setQrImagePath("");
      setQrUrl("");
      setQrLabelLocal("สแกนจ่ายด้วยพร้อมเพย์");
      setErrors({});
    }
  };

  return (
    <>
      <div className="pageBg">
        <div className={styles.container}>
          {/* Header Section */}
          <div className={styles.paymentsHeader}>
            <div className={styles.headerContent}>
              <div className={styles.headerMain}>
                <h1 className={styles.pageTitle}>
                  <FaCreditCard className={styles.titleIcon} />
                  จัดการการชำระเงิน
                </h1>
                <p className={styles.pageSubtitle}>
                  อัปโหลดและจัดการ QR Code สำหรับการชำระเงินของลูกค้า
                </p>
              </div>
              <div className={styles.headerActions}>
                <button 
                  className={styles.previewButton}
                  onClick={() => setShowPreview(true)}
                  disabled={!qrImagePath && !preview && !qrUrl}
                >
                  <FaEye />
                  ดูตัวอย่าง
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className={styles.paymentsContent}>
            <div className={styles.qrSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleGroup}>
                  <h2 className={styles.sectionTitle}>
                    <FaQrcode className={styles.sectionIcon} />
                    QR Code พร้อมเพย์
                  </h2>
                  <p className={styles.sectionSubtitle}>
                    อัปโหลด QR Code ที่จะแสดงในหน้าชำระเงินของพนักงาน
                  </p>
                </div>
              </div>

              <div className={styles.formGrid}>
                {/* Label Input */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    <FaEdit className={styles.labelIcon} />
                    ป้ายกำกับ QR Code
                  </label>
                  <input
                    type="text"
                    value={qrLabelLocal}
                    onChange={(e) => setQrLabelLocal(e.target.value)}
                    className={`${styles.formInput} ${errors.label ? styles.inputError : ''}`}
                    placeholder="เช่น สแกนจ่ายด้วยพร้อมเพย์"
                  />
                  {errors.label && <p className={styles.errorText}>{errors.label}</p>}
                </div>

                {/* File Upload */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    <FaUpload className={styles.labelIcon} />
                    อัปโหลดไฟล์ QR Code
                  </label>
                  <div className={`${styles.uploadArea} ${isUploading ? styles.uploading : ''}`}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className={styles.fileInput}
                      id="qrUpload"
                      disabled={isUploading}
                    />
                    <label htmlFor="qrUpload" className={styles.uploadLabel}>
                      <div className={styles.uploadIcon}>
                        {isUploading ? (
                          <div className={styles.loadingSpinner}></div>
                        ) : (
                          <FaQrcode />
                        )}
                      </div>
                      <div className={styles.uploadText}>
                        <span className={styles.uploadTitle}>
                          {isUploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่อเลือก QR Code'}
                        </span>
                        <span className={styles.uploadSubtext}>
                          รองรับ JPG, PNG ขนาดไม่เกิน 5MB
                        </span>
                      </div>
                    </label>
                  </div>
                  {errors.file && <p className={styles.errorText}>{errors.file}</p>}
                </div>

                {/* URL Input */}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    <FaImage className={styles.labelIcon} />
                    หรือใส่ URL รูปภาพ
                  </label>
                  <input
                    type="url"
                    value={qrUrl}
                    onChange={handleUrlChange}
                    className={styles.formInput}
                    placeholder="https://example.com/qr-code.png"
                  />
                  <p className={styles.helpText}>
                    ใส่ลิงก์รูป QR Code จากเว็บไซต์อื่น
                  </p>
                </div>
              </div>

              {/* QR Preview */}
              <div className={styles.previewSection}>
                <h3 className={styles.previewTitle}>ตัวอย่าง QR Code</h3>
                <div className={styles.qrPreview}>
                  {(qrImagePath || preview || qrUrl) ? (
                    <div className={styles.qrContainer}>
                      <img
                        src={preview || getImageUrl(qrImagePath) || qrUrl}
                        alt="QR Code Preview"
                        className={styles.qrImage}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className={styles.qrError} style={{ display: 'none' }}>
                        <FaTimes />
                        <span>ไม่สามารถโหลดรูปภาพได้</span>
                      </div>
                      <div className={styles.qrLabel}>
                        {qrLabelLocal || 'สแกนจ่ายด้วยพร้อมเพย์'}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.qrPlaceholder}>
                      <FaQrcode className={styles.placeholderIcon} />
                      <span>ยังไม่มี QR Code</span>
                      <small>อัปโหลดไฟล์หรือใส่ URL เพื่อดูตัวอย่าง</small>
                    </div>
                  )}
                </div>
                {errors.image && <p className={styles.errorText}>{errors.image}</p>}
              </div>

              {/* Action Buttons */}
              <div className={styles.actionButtons}>
                <button 
                  onClick={handleSave}
                  className={styles.saveButton}
                  disabled={isUploading}
                >
                  <FaSave />
                  บันทึก QR Code
                </button>
                <button 
                  onClick={handleClear}
                  className={styles.clearButton}
      disabled={isUploading || (!qrImagePath && !preview && !qrUrl)}
                >
                  <FaTrash />
                  ลบ QR Code
                </button>
              </div>
              
              {errors.save && <p className={styles.errorText}>{errors.save}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (qrImagePath || preview || qrUrl) && (
        <div className={styles.modalBackdrop} onClick={() => setShowPreview(false)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>ตัวอย่างหน้าชำระเงิน</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowPreview(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.paymentPreview}>
                <div className={styles.paymentCard}>
                  <h4><FaMoneyBillWave /> ชำระเงิน</h4>
                  <div className={styles.qrSection}>
                    <img 
                      src={preview || getImageUrl(qrImagePath) || qrUrl} 
                      alt="QR Code" 
                      className={styles.previewQrImage}
                    />
                    <p className={styles.previewQrLabel}>
                      {qrLabelLocal || 'สแกนจ่ายด้วยพร้อมเพย์'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
