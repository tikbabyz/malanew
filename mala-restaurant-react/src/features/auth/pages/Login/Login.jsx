// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  FaUser, FaLock, FaSignInAlt, FaSpinner, FaExclamationTriangle,
  FaEye, FaEyeSlash, FaUtensils, FaShieldAlt
} from "react-icons/fa";
import styles from "./Login.module.css";
import { useAuthStore } from "@store/auth.js";
// import ConfirmModal from "../components/ConfirmModal.jsx";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login: loginStore, user } = useAuthStore();
  // const [showError, setshowError] = React.useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // errors.username / errors.password = ข้อความใต้ช่อง
  const [errors, setErrors] = useState({}); // { username?: string, password?: string }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateForm = () => {
    const e = {};
    if (!username.trim()) e.username = "กรุณากรอกชื่อผู้ใช้";
    if (!password) e.password = "กรุณากรอกรหัสผ่าน";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    setError("");
    if (!validateForm() || loading) return;

    setLoading(true);
    // ไม่ล้าง errors ที่นี่ ปล่อย validate จัดการไปแล้ว

    try {
      const userProfile = await loginStore({
        username: username.trim(),
        password: password.trim(),
      });
      const to =
        userProfile.role === "ADMIN" ? "/admin" :
        userProfile.role === "STAFF" ? "/staff/workflow" : "/";
      nav(to, { replace: true });
    }  catch (err) {
  console.warn("⚠️ Login failed:", err);
  const raw = String(err?.message || "").toLowerCase();

  // เคลียร์ global error เพื่อให้โชว์รายช่อง
  setError("");

  if (raw.includes("รหัสผ่าน") || raw.includes("password")) {
    setErrors(prev => ({ ...prev, password: "รหัสผ่านไม่ถูกต้อง" }));
    console.log('[DEBUG] setErrors(password): รหัสผ่านไม่ถูกต้อง');
  } else if (
    raw.includes("ไม่พบ") || raw.includes("ผู้ใช้") || raw.includes("บัญชี") ||
    raw.includes("user not found")
  ) {
    setErrors(prev => ({ ...prev, username: "ไม่พบบัญชีผู้ใช้" }));
    console.log('[DEBUG] setErrors(username): ไม่พบบัญชีผู้ใช้');
  } else {
    setError(err?.message || "เข้าสู่ระบบไม่สำเร็จ");
    console.log('[DEBUG] setError(global):', err?.message || "เข้าสู่ระบบไม่สำเร็จ");
  }
} finally {
  setLoading(false);
}

  };

  const onKeyDown = (e) => e.key === "Enter" && handleLogin(e);
  const togglePasswordVisibility = () => setShowPassword((v) => !v);

  // เคลียร์ error รายช่องเมื่อพิมพ์ใหม่
  const onChangeUsername = (e) => {
    setUsername(e.target.value);
    if (errors.username) setErrors((p) => ({ ...p, username: undefined }));
  };
  const onChangePassword = (e) => {
    setPassword(e.target.value);
    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
  };

  useEffect(() => {
    if (user) {
      const redirectTo =
        user.role === "ADMIN" ? "/admin" :
        user.role === "STAFF" ? "/staff/workflow" : "/";
      nav(loc.state?.from || redirectTo, { replace: true });
    }
  }, [user, nav, loc.state]);

  return (
    <div className="pageBg">
      <div className={styles.container}>
        <div className={styles.backgroundElements}>
          <div className={styles.backgroundShape1} />
          <div className={styles.backgroundShape2} />
          <div className={styles.backgroundShape3} />
        </div>

        <div className={styles.loginCard}>
          <div className={styles.header}>
            <div className={styles.logoContainer}>
              <FaUtensils className={styles.logoIcon} />
              <div className={styles.logoText}>
                <h1 className={styles.title}>เข้าสู่ระบบ</h1>
                <p className={styles.subtitle}>ระบบจัดการร้านหมาล่า</p>
              </div>
            </div>
            <div className={styles.securityBadge}>
              <FaShieldAlt className={styles.securityIcon} />
              <span>ระบบปลอดภัย</span>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleLogin} noValidate>
            {/* Username */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <FaUser className={styles.labelIcon} />
                ชื่อผู้ใช้
              </label>
              <div className={styles.inputContainer}>
                <input
                  type="text"
                  value={username}
                  onChange={onChangeUsername}
                  className={`${styles.input} ${errors.username ? styles.inputError : ""}`}
                  placeholder="กรอกชื่อผู้ใช้"
                  disabled={loading}
                  autoComplete="username"
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? "user-error" : undefined}
                />
                <FaUser className={styles.inputIcon} />
              </div>
              {errors.username && (
                <div id="user-error" className={styles.errorMessage} aria-live="polite">
                  <FaExclamationTriangle className={styles.errorIcon} />
                  {errors.username}
                </div>
              )}
            </div>

            {/* Password */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <FaLock className={styles.labelIcon} />
                รหัสผ่าน
              </label>
              <div className={styles.inputContainer}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={onChangePassword}
                  className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
                  placeholder="กรอกรหัสผ่าน"
                  disabled={loading}
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "pass-error" : undefined}
                />
                <FaLock className={styles.inputIcon} />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={togglePasswordVisibility}
                  disabled={loading}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {errors.password && (
                <div id="pass-error" className={styles.errorMessage} aria-live="polite">
                  <FaExclamationTriangle className={styles.errorIcon} />
                  {errors.password}
                </div>
              )}
            </div>

            {/* Global error (อื่น ๆ) */}
            {error && (
              <div className={styles.submitError} aria-live="polite">
                <FaExclamationTriangle className={styles.errorIcon} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? (
                <>
                  <FaSpinner className={styles.spinnerIcon} />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                <>
                  <FaSignInAlt className={styles.buttonIcon} />
                  เข้าสู่ระบบ
                </>
              )}
            </button>
          </form>

          <div className={styles.footer}>
            <p className={styles.footerText}>© 2025 ร้านหมาล่า - ระบบจัดการร้านอาหาร</p>
          </div>
          {/* <ConfirmModal
            open={showError}
            title={errors.password}
            message="asdasd?"
            confirmText="asd"
            cancelText="ยกเลิก"
            danger
            icon="warning"
            onCancel={() => setshowError(false)}
            onConfirm={() => setshowError(false)}
          /> */}
        </div>
      </div>
    </div>
  );
}

