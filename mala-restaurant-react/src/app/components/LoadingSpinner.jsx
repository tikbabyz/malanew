import React from "react";
import styles from "@app/App.module.css";

function LoadingSpinner({ message = "กำลังโหลด...", subtext = "กรุณารอสักครู่..." }) {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingAnimation}>
        <div className={styles.loadingSpinner}></div>
        <div className={styles.loadingDots}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
      <div className={styles.loadingContent}>
        <div className={styles.loadingText}>{message}</div>
        <div className={styles.loadingSubtext}>{subtext}</div>
      </div>
    </div>
  );
}

export default LoadingSpinner;

