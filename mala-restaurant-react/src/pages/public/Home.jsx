// src/pages/public/Home.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import styles from '../public/Home.module.css';
import API from '../../services/api';

export default function Home() {
  const [products, setProducts] = React.useState([]);
  const [announcements, setAnnouncements] = React.useState([]);

  React.useEffect(() => {
    API.products.list()
      .then(setProducts)
      .catch(err => console.error('products:', err));

    // backend ยังไม่มี ก็จะได้ [] จาก fallback ด้านบน
    API.announcements.list()
      .then(setAnnouncements)
      .catch(err => {
        console.warn('announcements fallback:', err);
        setAnnouncements([]); // safety
      });
  }, []);

  return (
    <div className={styles.container}>
      {/* Header Section */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>ร้านหมาล่า</h1>
          <p className={styles.subtitle}>สัมผัสรสชาติต้นตำรับจากเสฉวน</p>
        </div>
      </div>

      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroBackground}>
          <img 
            src="./images/aboutus2.jpg" 
            alt="Mala Hot Pot"
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay}></div>
        </div>
        <div className={styles.heroContent}>
          <h2 className={styles.heroTitle}>ยินดีต้อนรับสู่ร้านหมาล่า</h2>
          <p className={styles.heroDescription}>
            ลิ้มลองรสชาติแท้จริงของอาหารจีนสไตล์เสฉวน พร้อมความเผ็ดร้อนที่ทำให้คุณหลงใหล
            ด้วยการปรุงแต่งจากเชฟชาวจีนที่มีประสบการณ์มากกว่า 20 ปี
          </p>
          <div className={styles.heroButtons}>
            <Link to="/menu" className={styles.ctaButton}>
              🍜 เมนูอาหาร
            </Link>
            <Link to="/news" className={styles.ctaButton + ' ' + styles.secondaryButton}>
              🔥 โปรโมชั่น
            </Link>
          </div>
        </div>
      </div>

      {/* Menu Preview Section */}
      <div className={styles.menuPreview}>
        <div className={styles.menuContent}>
          <h2 className={styles.sectionTitle}>เมนูยอดนิยม</h2>
          <div className={styles.menuGrid}>
            {(products || []).slice(0, 4).map((product, index) => {
              // Default images for each menu slot if no product image
              const defaultImages = [
                '/images/picmeat2kai.png',
                '/images/seafood1.png', 
                '/images/vetandmeat1.png',
                '/images/picmeat5.png'
              ];
              
              return (
                <div key={product.id || index} className={styles.menuItem}>
                  <img
                    src={product.image || defaultImages[index] || '/images/placeholder.png'}
                    alt={product.name || `เมนูหม่าล่า ${index + 1}`}
                    className={styles.menuItemImage}
                    onError={e => { e.currentTarget.src = '/images/placeholder.png'; }}
                  />
                  <div className={styles.menuItemContent}>
                    <h3 className={styles.menuItemTitle}>
                      {product.name || `เมนูพิเศษ ${index + 1}`}
                    </h3>
                    <p className={styles.menuItemDescription}>
                      {product.description || 'เมนูยอดนิยมจากครัวของเรา ปรุงด้วยส่วนผสมคุณภาพสูง รสชาติแท้จริงของหม่าล่าแบบเสฉวน'}
                    </p>
                    <p className={styles.menuItemPrice}>
                      {product.price ? `${product.price} บาท` : 'ราคาพิเศษ'}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {/* Show default menu items if no products loaded */}
            {(!products || products.length === 0) && (
              <>
                <div className={styles.menuItem}>
                  <img src="/images/picmeat2kai.png" alt="หม่าล่าหมู" className={styles.menuItemImage} />
                  <div className={styles.menuItemContent}>
                    <h3 className={styles.menuItemTitle}>หม่าล่าหมูสไลด์</h3>
                    <p className={styles.menuItemDescription}>หมูสไลด์คุณภาพพรีเมียม จิ้มกับน้ำจิ้มหม่าล่าเผ็ดร้อน</p>
                    <p className={styles.menuItemPrice}>189 บาท</p>
                  </div>
                </div>
                <div className={styles.menuItem}>
                  <img src="/images/seafood1.png" alt="ซีฟู้ดหม่าล่า" className={styles.menuItemImage} />
                  <div className={styles.menuItemContent}>
                    <h3 className={styles.menuItemTitle}>ซีฟู้ดหม่าล่า</h3>
                    <p className={styles.menuItemDescription}>อาหารทะเลสดใหม่ ปรุงรสตามแบบฉบับเสฉวน</p>
                    <p className={styles.menuItemPrice}>289 บาท</p>
                  </div>
                </div>
                <div className={styles.menuItem}>
                  <img src="/images/vetandmeat1.png" alt="ผักและเนื้อ" className={styles.menuItemImage} />
                  <div className={styles.menuItemContent}>
                    <h3 className={styles.menuItemTitle}>ผักสดและเนื้อ</h3>
                    <p className={styles.menuItemDescription}>ผักสดหลากหลายชิ้น พร้อมเนื้อวัวคุณภาพดี</p>
                    <p className={styles.menuItemPrice}>219 บาท</p>
                  </div>
                </div>
                <div className={styles.menuItem}>
                  <img src="/images/picmeat5.png" alt="เนื้อพิเศษ" className={styles.menuItemImage} />
                  <div className={styles.menuItemContent}>
                    <h3 className={styles.menuItemTitle}>เนื้อสไลด์พิเศษ</h3>
                    <p className={styles.menuItemDescription}>เนื้อวัวหั่นบางพิเศษ รสชาติเข้มข้น</p>
                    <p className={styles.menuItemPrice}>249 บาท</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/menu" className={styles.ctaButton}>
              ดูเมนูทั้งหมด
            </Link>
          </div>
        </div>
      </div>

      {/* Announcements Section */}
      <div className={styles.announcements}>
        <div className={styles.announcementsContent}>
          <h2 className={styles.sectionTitle}>ประกาศและโปรโมชั่น</h2>
          <div className={styles.announcementsGrid}>
            {(announcements || []).slice(0, 3).map(a => {
              const d = a.publishedAt || a.createdAt;
              return (
                <div key={a.id} className={styles.announcementCard}>
                  {a.image && (
                    <img
                      src={a.image}
                      alt={a.title}
                      style={{ 
                        width: '100%', 
                        maxHeight: 140, 
                        objectFit: 'cover', 
                        borderRadius: '8px 8px 0 0', 
                        marginBottom: 8 
                      }}
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <h3 className={styles.announcementTitle}>{a.title}</h3>
                  <p className={styles.announcementContent}>{a.body}</p>
                  <p className={styles.announcementDate}>
                    {d ? new Date(d).toLocaleDateString('th-TH') : ''}
                  </p>
                </div>
              );
            })}
            {!announcements?.length && (
              <div className={styles.announcementCard}>
                <h3 className={styles.announcementTitle}>ยังไม่มีประกาศ</h3>
                <p className={styles.announcementContent}>
                  กรุณาติดตามประกาศและโปรโมชั่นใหม่ๆ ได้ที่นี่
                </p>
              </div>
            )}
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <Link to="/news" className={styles.ctaButton}>
              ดูประกาศทั้งหมด
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
