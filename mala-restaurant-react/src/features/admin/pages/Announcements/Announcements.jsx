// src/pages/admin/Announcements.jsx
import React, { useState, useEffect } from 'react';
import API, { API_BASE } from '@services/api';
import styles from './Announcements.module.css';
import { 
  FaBullhorn, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaSave,
  FaTimes,
  FaEye,
  FaEyeSlash,
  FaImage,
  FaUpload,
  FaCalendar,
  FaFileAlt,
  FaCheckCircle,
  FaExclamationTriangle
} from 'react-icons/fa';


export default function Announcements() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    image: '',
    active: true,
    publishedAt: '',
  });
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // โหลดประกาศจาก backend
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await API.announcements.list(); // GET /api/announcements
        setList(data);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startCreate = () => {
    setEditId(null);
    setForm({
      title: '',
      body: '',
      image: '',
      active: true,
      publishedAt: new Date().toISOString().slice(0, 16), // Format for datetime-local input
    });
    setPreviewImage('');
  };

  const startEdit = (a) => {
    setEditId(a.id);
    setForm({
      title: a.title || '',
      body: a.body || '',
      image: a.image || '',
      active: !!a.active,
      publishedAt: a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 16) : '',
    });
    setPreviewImage(a.image || '');
  };

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    
    // Update preview image when URL changes
    if (name === 'image') {
      setPreviewImage(value);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ตรวจสอบไฟล์
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      alert('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('ประเภทไฟล์ไม่ถูกต้อง (รองรับ JPG, PNG, GIF, WebP)');
      return;
    }

    try {
      setIsUploading(true);
      
      // อัปโหลดไฟล์ผ่าน API
      const response = await API.uploadProductImage(file);
      
      if (response && response.imageUrl) {
        const fullImageUrl = response.imageUrl.startsWith('http') 
          ? response.imageUrl 
          : `${API_BASE}${response.imageUrl}`;
        setForm(f => ({ ...f, image: fullImageUrl }));
        setPreviewImage(fullImageUrl);
      } else {
        throw new Error('ไม่ได้รับ URL ของรูปภาพจากเซิร์ฟเวอร์');
      }
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('เกิดข้อผิดพลาดในการอัปโหลด: ' + (error.message || error));
    } finally {
      setIsUploading(false);
    }
  };

  const save = async () => {
    try {
      if (!form.title.trim()) {
        alert('กรุณากรอกหัวข้อประกาศ');
        return;
      }
      if (!form.body.trim()) {
        alert('กรุณากรอกรายละเอียดประกาศ');
        return;
      }

      const payload = { 
        ...form,
        publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : new Date().toISOString()
      };

      if (editId == null) {
        // CREATE
        const created = await API.announcements.create(payload); // POST /api/announcements
        setList((ls) => [created, ...ls]);
        alert('✅ เพิ่มประกาศสำเร็จ');
      } else {
        // UPDATE
        const updated = await API.announcements.update(editId, payload); // PUT /api/announcements/:id
        setList((ls) => ls.map((x) => (x.id === editId ? updated : x)));
        alert('✅ อัปเดตประกาศสำเร็จ');
      }

      startCreate(); // Reset form
    } catch (e) {
      alert('❌ เกิดข้อผิดพลาด: ' + String(e.message || e));
    }
  };

  const removeItem = async (id) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบประกาศนี้?')) return;
    try {
      await API.announcements.delete(id); // DELETE /api/announcements/:id
      setList((ls) => ls.filter((x) => x.id !== id));
      if (editId === id) {
        startCreate();
      }
      alert('✅ ลบประกาศสำเร็จ');
    } catch (e) {
      alert('❌ เกิดข้อผิดพลาดในการลบ: ' + String(e.message || e));
    }
  };

  const toggleActive = async (id, currentActive) => {
    try {
      const announcement = list.find(a => a.id === id);
      const updated = await API.announcements.update(id, { 
        ...announcement, 
        active: !currentActive 
      });
      setList((ls) => ls.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      alert('❌ เกิดข้อผิดพลาดในการเปลี่ยนสถานะ: ' + String(e.message || e));
    }
  };

  return (
    <>
      <div className="pageBg">
        <div className={styles.container}>
          {/* Header Section */}
          <div className={styles.announcementsHeader}>
            <div className={styles.headerContent}>
              <div className={styles.headerMain}>
                <h1 className={styles.pageTitle}>
                  <FaBullhorn className={styles.titleIcon} />
                  จัดการประกาศ
                </h1>
                <p className={styles.pageSubtitle}>
                  เพิ่ม แก้ไข และจัดการประกาศสำหรับลูกค้า
                </p>
              </div>
              <div className={styles.headerActions}>
                <button 
                  className={styles.createButton}
                  onClick={startCreate}
                >
                  <FaPlus />
                  เพิ่มประกาศใหม่
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className={styles.announcementsContent}>
            {loading && (
              <div className={styles.loadingState}>
                <div className={styles.spinner}></div>
                <p>กำลังโหลดประกาศ...</p>
              </div>
            )}
            
            {error && (
              <div className={styles.errorState}>
                <FaExclamationTriangle />
                <p>เกิดข้อผิดพลาด: {error}</p>
              </div>
            )}

            {!loading && !error && (
              <div className={styles.contentGrid}>
                {/* รายการประกาศ */}
                <div className={styles.announcementsList}>
                  <div className={styles.listHeader}>
                    <h2 className={styles.listTitle}>
                      <FaFileAlt className={styles.listIcon} />
                      รายการประกาศ ({list.length})
                    </h2>
                  </div>
                  
                  {list.length === 0 ? (
                    <div className={styles.emptyState}>
                      <FaBullhorn className={styles.emptyIcon} />
                      <h3>ยังไม่มีประกาศ</h3>
                      <p>เริ่มต้นสร้างประกาศแรกของคุณ</p>
                      <button className={styles.emptyButton} onClick={startCreate}>
                        <FaPlus />
                        เพิ่มประกาศใหม่
                      </button>
                    </div>
                  ) : (
                    <div className={styles.announcementsGrid}>
                      {list.map((a) => (
                        <div key={a.id} className={styles.announcementCard}>
                          <div className={styles.cardHeader}>
                            <div className={styles.cardTitle}>
                              <h3>{a.title}</h3>
                              <div className={styles.cardStatus}>
                                <button
                                  className={`${styles.statusBadge} ${a.active ? styles.active : styles.inactive}`}
                                  onClick={() => toggleActive(a.id, a.active)}
                                  title={a.active ? 'คลิกเพื่อซ่อน' : 'คลิกเพื่อแสดง'}
                                >
                                  {a.active ? <FaEye /> : <FaEyeSlash />}
                                  {a.active ? 'แสดง' : 'ซ่อน'}
                                </button>
                              </div>
                            </div>
                            <div className={styles.cardActions}>
                              <button 
                                className={styles.editButton}
                                onClick={() => startEdit(a)}
                                title="แก้ไข"
                              >
                                <FaEdit />
                              </button>
                              <button 
                                className={styles.deleteButton}
                                onClick={() => removeItem(a.id)}
                                title="ลบ"
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                          
                          {a.image && (
                            <div className={styles.cardImage}>
                              <img src={a.image} alt={a.title} />
                            </div>
                          )}
                          
                          <div className={styles.cardBody}>
                            <p className={styles.cardDescription}>{a.body}</p>
                          </div>
                          
                          <div className={styles.cardFooter}>
                            <div className={styles.cardMeta}>
                              <FaCalendar className={styles.metaIcon} />
                              <span>
                                {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('th-TH', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'ไม่ระบุวันที่'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ฟอร์มแก้ไข */}
                <div className={styles.editorPanel}>
                  <div className={styles.editorHeader}>
                    <h2 className={styles.editorTitle}>
                      {editId == null ? (
                        <>
                          <FaPlus className={styles.editorIcon} />
                          เพิ่มประกาศใหม่
                        </>
                      ) : (
                        <>
                          <FaEdit className={styles.editorIcon} />
                          แก้ไขประกาศ #{editId}
                        </>
                      )}
                    </h2>
                  </div>

                  <div className={styles.editorForm}>
                    {/* Title Input */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <FaFileAlt className={styles.labelIcon} />
                        หัวข้อประกาศ *
                      </label>
                      <input 
                        className={styles.formInput}
                        name="title" 
                        value={form.title} 
                        onChange={onChange}
                        placeholder="กรุณากรอกหัวข้อประกาศ"
                        maxLength={100}
                      />
                    </div>

                    {/* Body Input */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <FaFileAlt className={styles.labelIcon} />
                        รายละเอียด *
                      </label>
                      <textarea 
                        className={styles.formTextarea}
                        name="body" 
                        rows={4} 
                        value={form.body} 
                        onChange={onChange}
                        placeholder="กรุณากรอกรายละเอียดประกาศ"
                        maxLength={500}
                      />
                    </div>

                    {/* Image Upload */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <FaImage className={styles.labelIcon} />
                        รูปภาพประกอบ
                      </label>
                      
                      <div className={styles.imageUploadSection}>
                        <div className={styles.uploadArea}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className={styles.fileInput}
                            id="imageUpload"
                            disabled={isUploading}
                          />
                          <label htmlFor="imageUpload" className={styles.uploadLabel}>
                            <div className={styles.uploadIcon}>
                              {isUploading ? (
                                <div className={styles.uploadSpinner}></div>
                              ) : (
                                <FaUpload />
                              )}
                            </div>
                            <div className={styles.uploadText}>
                              <span className={styles.uploadTitle}>
                                {isUploading ? 'กำลังอัปโหลด...' : 'คลิกเพื่อเลือกรูปภาพ'}
                              </span>
                              <span className={styles.uploadSubtext}>
                                รองรับ JPG, PNG, GIF, WebP ขนาดไม่เกิน 5MB
                              </span>
                            </div>
                          </label>
                        </div>

                        {/* URL Input */}
                        <div className={styles.urlInputGroup}>
                          <label className={styles.urlLabel}>หรือใส่ URL รูปภาพ:</label>
                          <input 
                            className={styles.urlInput}
                            name="image" 
                            value={form.image || ''} 
                            onChange={onChange}
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>

                        {/* Image Preview */}
                        {previewImage && (
                          <div className={styles.imagePreview}>
                            <img src={previewImage} alt="ตัวอย่างรูปภาพ" />
                            <button 
                              className={styles.removeImageButton}
                              onClick={() => {
                                setForm(f => ({ ...f, image: '' }));
                                setPreviewImage('');
                              }}
                            >
                              <FaTimes />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Active Checkbox */}
                    <div className={styles.formGroup}>
                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          name="active"
                          checked={!!form.active}
                          onChange={onChange}
                          className={styles.checkbox}
                        />
                        <span className={styles.checkboxText}>
                          <FaEye className={styles.checkboxIcon} />
                          แสดงประกาศนี้ให้ลูกค้าเห็น
                        </span>
                      </label>
                    </div>

                    {/* Published Date */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        <FaCalendar className={styles.labelIcon} />
                        วันที่เผยแพร่
                      </label>
                      <input
                        type="datetime-local"
                        className={styles.formInput}
                        name="publishedAt"
                        value={form.publishedAt || ''}
                        onChange={onChange}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className={styles.formActions}>
                      <button 
                        className={styles.saveButton} 
                        onClick={save}
                        disabled={isUploading}
                      >
                        <FaSave />
                        {editId == null ? 'บันทึกประกาศ' : 'อัปเดตประกาศ'}
                      </button>
                      
                      {editId != null && (
                        <button 
                          className={styles.cancelButton}
                          onClick={startCreate}
                        >
                          <FaTimes />
                          ยกเลิก
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewImage && (
        <div className={styles.modalBackdrop} onClick={() => setShowPreview(false)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>ตัวอย่างรูปภาพ</h3>
              <button 
                className={styles.closeButton}
                onClick={() => setShowPreview(false)}
              >
                <FaTimes />
              </button>
            </div>
            <div className={styles.modalBody}>
              <img src={previewImage} alt="ตัวอย่างรูปภาพ" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

