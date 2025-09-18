import React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/th';
import relativeTime from 'dayjs/plugin/relativeTime';
import styles from './News.module.css';
import API from '../../services/api';
import {
  FaBullhorn,
  FaCalendarAlt,
  FaSpinner,
  FaExclamationTriangle,
  FaImage,
  FaTag,
  FaExternalLinkAlt,
  FaNewspaper,
  FaClock
} from 'react-icons/fa';

// Configure dayjs
dayjs.extend(relativeTime);
dayjs.locale('th');

export default function News() {
  const [announcements, setAnnouncements] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [imageErrors, setImageErrors] = React.useState(new Set());

  // ดึงข้อมูลประกาศจาก API
  React.useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await API.announcements.list();
        // กรองเฉพาะประกาศที่เปิดใช้งานและเรียงตามวันที่
        const activeAnnouncements = (data || [])
          .filter(announcement => announcement.active)
          .sort((a, b) => {
            const dateA = new Date(a.publishedAt || a.createdAt);
            const dateB = new Date(b.publishedAt || b.createdAt);
            return dateB - dateA; // เรียงใหม่ไปเก่า
          });
        setAnnouncements(activeAnnouncements);
      } catch (err) {
        console.error('Error fetching announcements:', err);
        setError('ไม่สามารถโหลดข้อมูลประกาศได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  // จัดการข้อผิดพลาดของรูปภาพ
  const handleImageError = (announcementId) => {
    setImageErrors(prev => new Set([...prev, announcementId]));
  };

  // ฟอร์แมตวันที่
  const formatDate = (date) => {
    if (!date) return '';
    const now = dayjs();
    const target = dayjs(date);
    const diffDays = now.diff(target, 'day');
    
    if (diffDays === 0) {
      return `วันนี้ ${target.format('HH:mm')}`;
    } else if (diffDays === 1) {
      return `เมื่อวาน ${target.format('HH:mm')}`;
    } else if (diffDays <= 7) {
      return `${diffDays} วันที่แล้ว`;
    } else {
      return target.format('DD MMMM YYYY');
    }
  };

  // ตรวจสอบว่าประกาศใหม่หรือไม่ (ใน 3 วัน)
  const isNewAnnouncement = (date) => {
    if (!date) return false;
    const now = dayjs();
    const target = dayjs(date);
    return now.diff(target, 'day') <= 3;
  };

  if (loading) {
    return (
      <div className="pageBg">
        <div className={styles.container}>
          <div className={styles.loadingContainer}>
            <FaSpinner className={styles.loadingSpinner} />
            <p className={styles.loadingText}>กำลังโหลดประกาศ...</p>
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
              <FaNewspaper className={styles.titleIcon} />
              ประกาศและโปรโมชั่น
            </h1>
            <p className={styles.subtitle}>
              อัปเดตข่าวสารและโปรโมชั่นล่าสุดจากร้านหมาล่า
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className={styles.statsSection}>
          <div className={styles.statsContainer}>
            <div className={styles.statCard}>
              <FaBullhorn className={styles.statIcon} />
              <div className={styles.statInfo}>
                <span className={styles.statNumber}>{announcements.length}</span>
                <span className={styles.statLabel}>ประกาศทั้งหมด</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <FaClock className={styles.statIcon} />
              <div className={styles.statInfo}>
                <span className={styles.statNumber}>
                  {announcements.filter(a => isNewAnnouncement(a.publishedAt || a.createdAt)).length}
                </span>
                <span className={styles.statLabel}>ประกาศใหม่</span>
              </div>
            </div>
          </div>
        </div>

        {/* Announcements Section */}
        <div className={styles.announcementsSection}>
          {announcements.length === 0 ? (
            <div className={styles.emptyState}>
              <FaBullhorn className={styles.emptyIcon} />
              <h3 className={styles.emptyTitle}>ยังไม่มีประกาศ</h3>
              <p className={styles.emptyMessage}>
                ติดตามข่าวสารและโปรโมชั่นใหม่ๆ ได้ที่นี่
              </p>
            </div>
          ) : (
            <div className={styles.announcementsGrid}>
              {announcements.map(announcement => {
                const publishDate = announcement.publishedAt || announcement.createdAt;
                const hasImageError = imageErrors.has(announcement.id);
                const isNew = isNewAnnouncement(publishDate);
                
                return (
                  <article key={announcement.id} className={styles.announcementCard}>
                    {/* New Badge */}
                    {isNew && (
                      <div className={styles.newBadge}>
                        <FaTag className={styles.badgeIcon} />
                        ใหม่
                      </div>
                    )}

                    {/* Image Container */}
                    <div className={styles.imageContainer}>
                      {!hasImageError && announcement.image ? (
                        <img
                          src={announcement.image}
                          alt={announcement.title}
                          className={styles.announcementImage}
                          loading="lazy"
                          onError={() => handleImageError(announcement.id)}
                        />
                      ) : (
                        <div className={styles.placeholderImage}>
                          <FaBullhorn className={styles.placeholderIcon} />
                          <span className={styles.placeholderText}>ประกาศ</span>
                        </div>
                      )}
                      <div className={styles.imageOverlay}></div>
                    </div>

                    {/* Content */}
                    <div className={styles.cardContent}>
                      <div className={styles.cardHeader}>
                        <h3 className={styles.announcementTitle}>
                          {announcement.title}
                        </h3>
                        <div className={styles.dateContainer}>
                          <FaCalendarAlt className={styles.dateIcon} />
                          <time 
                            className={styles.announcementDate}
                            dateTime={dayjs(publishDate).toISOString()}
                          >
                            {formatDate(publishDate)}
                          </time>
                        </div>
                      </div>

                      {announcement.body && (
                        <div className={styles.cardBody}>
                          <p className={styles.announcementBody}>
                            {announcement.body.length > 150 
                              ? `${announcement.body.substring(0, 150)}...` 
                              : announcement.body
                            }
                          </p>
                        </div>
                      )}

                      <div className={styles.cardFooter}>
                        {announcement.link ? (
                          <a
                            href={announcement.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.readMoreLink}
                            aria-label="อ่านเพิ่มเติม (ลิงก์ภายนอก)"
                          >
                            อ่านเพิ่มเติม
                            <FaExternalLinkAlt className={styles.linkIcon} />
                          </a>
                        ) : (
                          <button 
                            className={styles.readMoreButton}
                            onClick={() => {
                              // TODO: เปิด modal หรือ expand content
                              alert(`${announcement.title}\n\n${announcement.body}`);
                            }}
                          >
                            อ่านเพิ่มเติม
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className={styles.footerNote}>
          <p className={styles.noteText}>
            <FaBullhorn className={styles.noteIcon} />
            ประกาศและโปรโมชั่นอาจมีการเปลี่ยนแปลง กรุณาติดตามอัปเดตเป็นประจำ
          </p>
        </div>
      </div>
    </div>
  );
}
