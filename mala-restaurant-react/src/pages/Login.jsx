// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  FaUser, 
  FaLock, 
  FaSignInAlt, 
  FaSpinner, 
  FaExclamationTriangle, 
  FaEye, 
  FaEyeSlash,
  FaUtensils,
  FaShieldAlt
} from 'react-icons/fa';
import styles from "./Login.module.css";
import { useAuthStore } from "../store/auth.js";

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login: loginStore, user } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // ถ้า user login อยู่แล้ว ให้ redirect ไปยังหน้าที่เหมาะสมตาม role
  useEffect(() => {
    if (user) {
      let redirectTo;
      if (user.role === "ADMIN") {
        redirectTo = "/admin";
      } else if (user.role === "STAFF") {
        redirectTo = "/staff/pos";
      } else {
        redirectTo = "/";
      }
      
      const to = loc.state?.from || redirectTo;
      nav(to, { replace: true });
    }
  }, [user, nav, loc.state]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!username.trim()) {
      newErrors.username = "กรุณากรอกชื่อผู้ใช้";
    } else if (username.trim().length < 3) {
      newErrors.username = "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร";
    }
    
    if (!password) {
      newErrors.password = "กรุณากรอกรหัสผ่าน";
    } else if (password.length < 4) {
      newErrors.password = "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!validateForm() || loading) return;
    
    console.log('🔐 Starting login process...');
    console.log('Username:', username.trim());
    console.log('Password length:', password.trim().length);
    
    setLoading(true);
    setErrors({});
    
    try {
      console.log('📡 Calling loginStore...');
      
      const userProfile = await loginStore({ 
        username: username.trim(), 
        password: password.trim() 
      });

      console.log('✅ Login successful, user profile:', userProfile);

      // ล้าง route state เก่าออก
      console.log('🧹 Clearing location state...');

      const roleRedirects = {
        "ADMIN": "/admin",
        "STAFF": "/staff/workflow",
        "admin": "/admin",
        "staff": "/staff/workflow"
      };
      
      const redirectTo = roleRedirects[userProfile.role] || "/";
      
      console.log('🎯 User role:', userProfile.role);
      console.log('🔄 Redirecting to:', redirectTo);
      
      // ใช้ replace: true เพื่อไม่ให้กลับมาหน้า login ได้
      nav(redirectTo, { replace: true });
      
    } catch (error) {
      console.error("❌ Login error:", error);
      
      const errorMessage = error.message || "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
      setErrors({ submit: errorMessage });
    } finally {
      console.log('🔚 Login process finished');
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      handleLogin(e);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="pageBg">
      <div className={styles.container}>
        
        {/* Background Elements */}
        <div className={styles.backgroundElements}>
          <div className={styles.backgroundShape1}></div>
          <div className={styles.backgroundShape2}></div>
          <div className={styles.backgroundShape3}></div>
        </div>

        {/* Login Card */}
        <div className={styles.loginCard}>
          {/* Header */}
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

          {/* Login Form */}
          <form className={styles.form} onSubmit={handleLogin}>
            {/* Username Field */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <FaUser className={styles.labelIcon} />
                ชื่อผู้ใช้
              </label>
              <div className={styles.inputContainer}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`${styles.input} ${errors.username ? styles.inputError : ''}`}
                  placeholder="กรอกชื่อผู้ใช้"
                  onKeyDown={onKeyDown}
                  disabled={loading}
                  autoComplete="username"
                />
                <FaUser className={styles.inputIcon} />
              </div>
              {errors.username && (
                <div className={styles.errorMessage}>
                  <FaExclamationTriangle className={styles.errorIcon} />
                  {errors.username}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <FaLock className={styles.labelIcon} />
                รหัสผ่าน
              </label>
              <div className={styles.inputContainer}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                  placeholder="กรอกรหัสผ่าน"
                  onKeyDown={onKeyDown}
                  disabled={loading}
                  autoComplete="current-password"
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
                <div className={styles.errorMessage}>
                  <FaExclamationTriangle className={styles.errorIcon} />
                  {errors.password}
                </div>
              )}
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className={styles.submitError}>
                <FaExclamationTriangle className={styles.errorIcon} />
                {errors.submit}
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit"
              className={styles.submitButton} 
              disabled={loading}
            >
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

          {/* Footer */}
          <div className={styles.footer}>
            <p className={styles.footerText}>
              © 2024 ร้านหมาล่า - ระบบจัดการร้านอาหาร
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
