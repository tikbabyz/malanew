// src/pages/Login.jsx
import React, { useEffect, useReducer } from "react";
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
  FaShieldAlt,
  FaInfoCircle,
  FaCheckCircle
} from "react-icons/fa";
import styles from "./Login.module.css";
import { useAuthStore } from "@store/auth.js";
import ConfirmModal from "@shared/components/ConfirmModal/ConfirmModal.jsx";

const TEXT = Object.freeze({
  layout: {
    title: "เข้าสู่ระบบ",
    subtitle: "ระบบจัดการร้านหมาล่า",
    badge: "ระบบปลอดภัย",
    footer: "© 2025 ร้านหมาล่า - ระบบจัดการร้านอาหาร",
  },
  alert: {
    defaultTitle: "แจ้งเตือน",
    failureTitle: "เข้าสู่ระบบไม่สำเร็จ",
    networkTitle: "เชื่อมต่อไม่สำเร็จ",
    confirmText: "ปิด",
  },
  validation: {
    usernameRequired: "กรุณากรอกชื่อผู้ใช้",
    usernameTooShort: "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร",
    passwordRequired: "กรุณากรอกรหัสผ่าน",
    passwordTooShort: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร",
  },
  notice: {
    warning: "กรุณาตรวจสอบข้อมูลให้ครบถ้วนก่อนเข้าสู่ระบบ",
    info: "กำลังตรวจสอบข้อมูลเข้าสู่ระบบ...",
    success: "เข้าสู่ระบบสำเร็จ กำลังนำทางไปยังหน้าถัดไป",
    passwordError: "รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง",
    usernameError: "ไม่พบบัญชีผู้ใช้ กรุณาตรวจสอบชื่อผู้ใช้",
    networkError: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่",
    fallbackError: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
  },
  errorField: {
    password: "รหัสผ่านไม่ถูกต้อง",
    username: "ไม่พบบัญชีผู้ใช้",
  },
  includes: {
    password: "รหัสผ่าน",
    userMissing1: "ไม่พบ",
    userMissing2: "ผู้ใช้",
    userMissing3: "บัญชี",
  },
  form: {
    usernameLabel: "ชื่อผู้ใช้",
    usernamePlaceholder: "กรอกชื่อผู้ใช้",
    passwordLabel: "รหัสผ่าน",
    passwordPlaceholder: "กรอกรหัสผ่าน",
    showPassword: "ซ่อนรหัสผ่าน",
    hidePassword: "แสดงรหัสผ่าน",
    submitLoading: "กำลังเข้าสู่ระบบ...",
    submitIdle: "เข้าสู่ระบบ",
  },
});

const createInitialModalState = () => ({
  open: false,
  title: "",
  message: "",
  icon: "warning",
  danger: true,
});

const initialState = {
  username: "",
  password: "",
  showPassword: false,
  errors: {},
  loading: false,
  notice: null,
  modal: createInitialModalState(),
};

const shouldResetNotice = (notice) =>
  notice && (notice.type === "warning" || notice.type === "error");

const resolveRedirect = (role) =>
  role === "ADMIN" ? "/admin" :
  role === "STAFF" ? "/staff/workflow" : "/";

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_ERRORS":
      return { ...state, errors: action.payload };
    case "CLEAR_FIELD_ERROR": {
      if (!state.errors[action.field]) {
        return state;
      }
      const nextErrors = { ...state.errors };
      delete nextErrors[action.field];
      return { ...state, errors: nextErrors };
    }
    case "SET_NOTICE":
      return { ...state, notice: action.payload };
    case "CLEAR_NOTICE":
      if (!state.notice) {
        return state;
      }
      return { ...state, notice: null };
    case "SET_LOADING":
      return { ...state, loading: action.value };
    case "TOGGLE_PASSWORD":
      return { ...state, showPassword: !state.showPassword };
    case "OPEN_MODAL":
      return {
        ...state,
        modal: {
          open: true,
          title: action.payload?.title || TEXT.alert.defaultTitle,
          message: action.payload?.message || "",
          icon: action.payload?.icon || "warning",
          danger: action.payload?.danger ?? true,
        },
      };
    case "CLOSE_MODAL":
      if (!state.modal.open) {
        return state;
      }
      return {
        ...state,
        modal: { ...state.modal, open: false },
      };
    default:
      return state;
  }
};

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const { login: loginStore, user } = useAuthStore();

  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    username,
    password,
    showPassword,
    errors,
    loading,
    notice,
    modal,
  } = state;

  const setLoadingState = (value) => dispatch({ type: "SET_LOADING", value });
  const setErrorsState = (payload) => dispatch({ type: "SET_ERRORS", payload });
  const clearFieldErrorState = (field) => dispatch({ type: "CLEAR_FIELD_ERROR", field });
  const setNoticeState = (payload) => dispatch({ type: "SET_NOTICE", payload });
  const clearNoticeState = () => dispatch({ type: "CLEAR_NOTICE" });
  const openAlertModal = (payload = {}) => dispatch({ type: "OPEN_MODAL", payload });
  const closeAlertModal = () => dispatch({ type: "CLOSE_MODAL" });

  const handleFieldChange = (field) => (event) => {
    dispatch({ type: "SET_FIELD", field, value: event.target.value });
    if (errors[field]) {
      clearFieldErrorState(field);
    }
    if (shouldResetNotice(notice)) {
      clearNoticeState();
    }
  };

  const assignFieldError = (field, message) => {
    setErrorsState({ ...errors, [field]: message });
  };

  const togglePasswordVisibility = () => dispatch({ type: "TOGGLE_PASSWORD" });

  const getTrimmedCredentials = () => ({
    username: username.trim(),
    password: password.trim(),
  });

  const validateForm = (credentials) => {
    const validationErrors = {};
    const { username: trimmedUsername, password: trimmedPassword } = credentials;

    if (!trimmedUsername) {
      validationErrors.username = TEXT.validation.usernameRequired;
    } else if (trimmedUsername.length < 3) {
      validationErrors.username = TEXT.validation.usernameTooShort;
    }

    if (!trimmedPassword) {
      validationErrors.password = TEXT.validation.passwordRequired;
    } else if (trimmedPassword.length < 6) {
      validationErrors.password = TEXT.validation.passwordTooShort;
    }

    setErrorsState(validationErrors);
    const isValid = Object.keys(validationErrors).length === 0;

    if (!isValid) {
      setNoticeState({
        type: "warning",
        message: TEXT.notice.warning,
      });
    }

    return isValid;
  };

  const handleLogin = async (event) => {
    event?.preventDefault();
    clearNoticeState();
    closeAlertModal();
    if (loading) {
      return;
    }

    const credentials = getTrimmedCredentials();
    if (!validateForm(credentials)) {
      return;
    }

    setLoadingState(true);
    setNoticeState({
      type: "info",
      message: TEXT.notice.info,
    });

    try {
      const userProfile = await loginStore(credentials);
      setNoticeState({
        type: "success",
        message: TEXT.notice.success,
      });
      const target = resolveRedirect(userProfile.role);
      nav(target, { replace: true });
    } catch (err) {
      console.warn("⚠️ Login failed:", err);
      const raw = String(err?.message || "").toLowerCase();

      if (raw.includes(TEXT.includes.password) || raw.includes("password")) {
        const message = TEXT.notice.passwordError;
        assignFieldError("password", TEXT.errorField.password);
        setNoticeState({ type: "error", message });
        openAlertModal({ title: TEXT.alert.failureTitle, message });
      } else if (
        raw.includes(TEXT.includes.userMissing1) ||
        raw.includes(TEXT.includes.userMissing2) ||
        raw.includes(TEXT.includes.userMissing3) ||
        raw.includes("user not found")
      ) {
        const message = TEXT.notice.usernameError;
        assignFieldError("username", TEXT.errorField.username);
        setNoticeState({ type: "error", message });
        openAlertModal({ title: TEXT.alert.failureTitle, message });
      } else if (raw.includes("network") || raw.includes("failed to fetch")) {
        const message = TEXT.notice.networkError;
        setNoticeState({ type: "error", message });
        openAlertModal({
          title: TEXT.alert.networkTitle,
          message,
          icon: "question",
          danger: false,
        });
      } else {
        const message = err?.message || TEXT.notice.fallbackError;
        setNoticeState({ type: "error", message });
        openAlertModal({ title: TEXT.alert.failureTitle, message });
      }
    } finally {
      setLoadingState(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    const redirectTo = resolveRedirect(user.role);
    nav(loc.state?.from || redirectTo, { replace: true });
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
                <h1 className={styles.title}>{TEXT.layout.title}</h1>
                <p className={styles.subtitle}>{TEXT.layout.subtitle}</p>
              </div>
            </div>
            <div className={styles.securityBadge}>
              <FaShieldAlt className={styles.securityIcon} />
              <span>{TEXT.layout.badge}</span>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleLogin} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <FaUser className={styles.labelIcon} />
                {TEXT.form.usernameLabel}
              </label>
              <div className={styles.inputContainer}>
                <input
                  type="text"
                  value={username}
                  onChange={handleFieldChange("username")}
                  className={`${styles.input} ${errors.username ? styles.inputError : ""}`}
                  placeholder={TEXT.form.usernamePlaceholder}
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

            <div className={styles.formGroup}>
              <label className={styles.label}>
                <FaLock className={styles.labelIcon} />
                {TEXT.form.passwordLabel}
              </label>
              <div className={styles.inputContainer}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handleFieldChange("password")}
                  className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
                  placeholder={TEXT.form.passwordPlaceholder}
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
                  aria-label={showPassword ? TEXT.form.showPassword : TEXT.form.hidePassword}
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

            {notice && (
              <div
                className={`${styles.formNotice} ${styles[notice.type]}`}
                role="status"
                aria-live="polite"
              >
                {notice.type === "success" ? (
                  <FaCheckCircle className={styles.noticeIcon} />
                ) : notice.type === "info" ? (
                  <FaInfoCircle className={styles.noticeIcon} />
                ) : (
                  <FaExclamationTriangle className={styles.noticeIcon} />
                )}
                {notice.message}
              </div>
            )}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? (
                <>
                  <FaSpinner className={styles.spinnerIcon} />
                  {TEXT.form.submitLoading}
                </>
              ) : (
                <>
                  <FaSignInAlt className={styles.buttonIcon} />
                  {TEXT.form.submitIdle}
                </>
              )}
            </button>
          </form>

          <div className={styles.footer}>
            <p className={styles.footerText}>{TEXT.layout.footer}</p>
          </div>
          <ConfirmModal
            open={modal.open}
            title={modal.title || TEXT.alert.defaultTitle}
            message={modal.message}
            confirmText={TEXT.alert.confirmText}
            cancelText={null}
            icon={modal.icon}
            danger={modal.danger}
            onCancel={closeAlertModal}
            onConfirm={closeAlertModal}
          />
        </div>
      </div>
    </div>
  );
}
