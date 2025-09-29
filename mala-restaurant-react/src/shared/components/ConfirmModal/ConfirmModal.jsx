import React from "react";
import ReactDOM from "react-dom";
import { FaExclamationTriangle, FaCheckCircle, FaQuestionCircle } from 'react-icons/fa';
import styles from "./ConfirmModal.module.css";


export default function ConfirmModal({
  open,
  title = "ยืนยัน",
  message = "ต้องการดำเนินการต่อหรือไม่?",
  confirmText = "ยืนยัน",
  cancelText = "ยกเลิก",
  onConfirm,
  onCancel,
  danger = false,
  icon = null, // 'warning', 'success', 'question', or custom
}) {
  React.useEffect(() => {
    const onKey = (e) => {
      if (!open) return;
      if (e.key === "Escape") onCancel?.();
      if (e.key === "Enter") onConfirm?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel, onConfirm]);

  const getIcon = () => {
    if (icon === 'warning' || danger) return <FaExclamationTriangle className={styles.iconWarning} />;
    if (icon === 'success') return <FaCheckCircle className={styles.iconSuccess} />;
    if (icon === 'question') return <FaQuestionCircle className={styles.iconQuestion} />;
    if (icon) return icon; // Custom icon
    return <FaQuestionCircle className={styles.iconQuestion} />; // Default
  };

  const showCancel = cancelText !== null && cancelText !== undefined;
  const showConfirm = confirmText !== null && confirmText !== undefined;

  React.useEffect(() => {
    if (open) {
      try {
        const target = typeof document !== 'undefined' ? document.body : null;
        console.log('🪟 ConfirmModal render', { title, message, danger, icon, targetAvailable: !!target });
      } catch (error) {
        console.warn('ConfirmModal: unable to access document.body', error);
      }
    }
  }, [open, title, message, danger, icon]);

  if (!open) return null;

  const modalContent = (
    <div className={styles.backdrop} onClick={onCancel} role="dialog" aria-modal="true" data-modal="confirm-modal">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.iconContainer}>
            {getIcon()}
          </div>
          <div className={styles.headerContent}>
            <h3 className={`${styles.title} ${danger ? styles.titleDanger : ''}`}>{title}</h3>
            <p className={styles.message}>{message}</p>
          </div>
        </div>
        {(showCancel || showConfirm) && (
          <div className={styles.actions}>
            {showCancel && (
              <button className={styles.btnCancel} onClick={onCancel}>
                {cancelText}
              </button>
            )}
            {showConfirm && (
              <button
                className={`${styles.btnConfirm} ${danger ? styles.btnDanger : ''}`}
                onClick={onConfirm}
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (portalTarget) {
    return ReactDOM.createPortal(modalContent, portalTarget);
  }

  console.warn('ConfirmModal: document.body unavailable, rendering inline');
  return modalContent;
}
