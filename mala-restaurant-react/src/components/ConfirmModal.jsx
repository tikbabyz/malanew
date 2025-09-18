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

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className={styles.backdrop} onClick={onCancel} role="dialog" aria-modal="true">
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
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={`${styles.btnConfirm} ${danger ? styles.btnDanger : ''}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
