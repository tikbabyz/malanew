import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaSignOutAlt, 
  FaExclamationTriangle, 
  FaTimes, 
  FaCheck 
} from 'react-icons/fa';
import { useAuthStore } from "@store/auth.js";
import styles from "./LogoutButton.module.css";

export default function LogoutButton({ 
  className = "", 
  variant = "default", // default, ghost, small, large
  showIcon = true,
  children = "ออกจากระบบ"
}) {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      console.log('🚪 LogoutButton logout triggered');
      // ใช้ logout function จาก auth store
      logout();
      
      // ล้างข้อมูลใน localStorage และ sessionStorage
      localStorage.removeItem("authUser");
      localStorage.removeItem("authToken");
      localStorage.removeItem("posCart");
      sessionStorage.removeItem("detectLast");
      
      setIsDialogOpen(false);
      
      console.log('🔄 Navigating to login page after logout');
      // นำทางไปหน้า login
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("❌ Logout error:", error);
      // ถึงแม้จะ error ก็ให้ออกจากระบบ
      navigate("/login", { replace: true });
    }
  };

  const getButtonClasses = () => {
    let classes = styles.logoutButton;
    
    if (variant === "ghost") classes += ` ${styles.ghost}`;
    if (variant === "small") classes += ` ${styles.small}`;
    if (variant === "large") classes += ` ${styles.large}`;
    if (className) classes += ` ${className}`;
    
    return classes;
  };

  return (
    <>
      <button 
        className={getButtonClasses()}
        onClick={() => setIsDialogOpen(true)}
        title="ออกจากระบบ"
      >
        {showIcon && <FaSignOutAlt className={styles.icon} />}
        {children}
      </button>

      {isDialogOpen && (
        <div className={styles.confirmDialog} onClick={() => setIsDialogOpen(false)}>
          <div 
            className={styles.dialogContent} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <FaExclamationTriangle className={styles.dialogIcon} />
              <h3 className={styles.dialogTitle}>ยืนยันการออกจากระบบ</h3>
              <p className={styles.dialogMessage}>
                คุณต้องการออกจากระบบตอนนี้หรือไม่?
              </p>
            </div>
            
            <div className={styles.dialogActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => setIsDialogOpen(false)}
              >
                ยกเลิก
              </button>
              <button 
                className={styles.confirmButton}
                onClick={handleLogout}
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

