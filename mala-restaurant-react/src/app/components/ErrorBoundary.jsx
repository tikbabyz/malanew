import React from "react";
import styles from "@app/App.module.css";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          resetError={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

// Error fallback component
function ErrorFallback({ error, resetError }) {
  return (
    <div className={styles.errorContainer}>
      <div className={styles.errorContent}>
        <div className={styles.errorIcon}>⚠️</div>
        <h2 className={styles.errorTitle}>เกิดข้อผิดพลาด</h2>
        <p className={styles.errorMessage}>
          {error?.message || 'ระบบพบข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่อีกครั้ง'}
        </p>
        <div className={styles.errorActions}>
          <button className={styles.errorButton} onClick={resetError}>
            <span>🔄</span>
            <span>ลองใหม่</span>
          </button>
          <button 
            className={styles.errorButtonSecondary} 
            onClick={() => window.location.href = '/'}
          >
            <span>🏠</span>
            <span>กลับหน้าแรก</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export { ErrorFallback };
export default ErrorBoundary;

