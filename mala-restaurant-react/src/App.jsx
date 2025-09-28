// src/App.jsx
import React, { Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./store/auth.js";
import { hydrateIfEmpty } from "./store/data.js";

// Components
import AppNav from "./components/AppNav.jsx";
import Protected from "./components/Protected.jsx";
import PermissionGuard from "./components/PermissionGuard.jsx";

// Pages
import Home from "./pages/public/Home.jsx";
import Menu from "./pages/public/Menu.jsx";
import News from "./pages/public/News.jsx";
import Login from "./pages/Login.jsx";

// Staff Pages
import Billing from "./pages/staff/Billing.jsx";
import Orders from "./pages/staff/Orders.jsx";
import WorkflowPOS from "./pages/staff/WorkflowPOS.jsx";

// Admin Pages
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/Dashboard.jsx";
import Users from "./pages/admin/Users.jsx";
import Products from "./pages/admin/Products.jsx";
import Permissions from "./pages/admin/Permissions.jsx";
import Announcements from "./pages/admin/Announcements.jsx";
import Payments from "./pages/admin/Payments.jsx";

import "./styles.css";
import styles from "./App.module.css";

hydrateIfEmpty();

// Helper component for page breadcrumb
function PageBreadcrumb() {
  const location = useLocation();
  const { user } = useAuthStore();
  
  const getBreadcrumbPath = () => {
    const path = location.pathname;
    if (path === '/') return 'หน้าแรก';
    if (path === '/menu') return 'เมนูอาหาร';
    if (path === '/news') return 'ข่าวสาร';
    if (path === '/login') return 'เข้าสู่ระบบ';
    if (path.startsWith('/staff')) {
      if (path === '/staff/pos') return 'Staff › ระบบขาย (เปลี่ยนเส้นทางไป Workflow)';
      if (path === '/staff/detect') return 'Staff › ตรวจจับ AI (เปลี่ยนเส้นทางไป Workflow)';
      if (path === '/staff/billing') return 'Staff › ออกบิล';
      if (path === '/staff/orders') return 'Staff › คำสั่งซื้อ';
      if (path === '/staff/workflow') return 'Staff › ระบบขายแบบครบวงจร';
    }
    if (path.startsWith('/admin')) {
      if (path === '/admin') return 'Admin › แดชบอร์ด';
      if (path === '/admin/users') return 'Admin › จัดการผู้ใช้';
      if (path === '/admin/products') return 'Admin › จัดการสินค้า';
      if (path === '/admin/permissions') return 'Admin › สิทธิ์การใช้งาน';
      if (path === '/admin/announcements') return 'Admin › ประกาศ';
      if (path === '/admin/payments') return 'Admin › การชำระเงิน';
    }
    return path;
  };

  const isHomePage = location.pathname === '/';
  
  // Don't show breadcrumb on home page since Home.jsx handles its own hero section
  if (isHomePage) {
    return null;
  }

  return (
    <nav className={styles.breadcrumb}>
      <div className={styles.breadcrumbContent}>
        <span className={styles.breadcrumbHome}>🏠</span>
        <span className={styles.breadcrumbSeparator}>›</span>
        <span className={`${styles.breadcrumbItem} ${styles.active}`}>
          {getBreadcrumbPath()}
        </span>
      </div>
    </nav>
  );
}

// Loading component
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

// Error boundary component
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

// Helper component for role-based redirects
function RoleBasedRedirect() {
  const { user, isLoading } = useAuthStore();
  const navigate = useNavigate();

  console.log('🔀 RoleBasedRedirect - user:', user?.username, 'role:', user?.role, 'isLoading:', isLoading);

  useEffect(() => {
    // ถ้ายังโหลดอยู่ ไม่ต้องทำอะไร
    if (isLoading) {
      console.log('⏳ Still loading, waiting...');
      return;
    }

    // ถ้ามี user ให้ redirect ตาม role
    if (user) {
      const redirectPath = user.role === "STAFF" ? "/staff/workflow" : "/admin";
      console.log('🎯 User found, redirecting to:', redirectPath);
      navigate(redirectPath, { replace: true });
    } else {
      console.log('👤 No user found, staying on home page');
    }
    // ถ้าไม่มี user ให้แสดงหน้า Home
  }, [user, isLoading, navigate]);

  // แสดง loading หรือ Home
  if (isLoading) {
    return (
      <LoadingSpinner 
        message="กำลังตรวจสอบสิทธิ์..." 
        subtext="กรุณารอสักครู่"
      />
    );
  }

  // ถ้าไม่มี user ให้แสดงหน้า Home
  if (!user) {
    return <Home />;
  }

  // ถ้ามี user แต่ยังไม่ redirect ให้แสดง loading
  return (
    <LoadingSpinner 
      message="กำลังเปลี่ยนหน้า..." 
      subtext="กรุณารอสักครู่"
    />
  );
}

function App() {
  const { user, isLoading: authLoading } = useAuthStore();
  const location = useLocation();
  
  console.log('🏠 App component - user:', user?.username, 'authLoading:', authLoading, 'path:', location.pathname);
  
  // Show loading spinner while initializing
  if (authLoading) {
    return (
      <div className={styles.appContainer}>
        <AppNav />
        <main className={styles.mainContent}>
          <div className={styles.contentWrapper}>
            <div className={styles.pageContent}>
              <LoadingSpinner 
                message="กำลังเตรียมระบบร้านหม่าล่า..." 
                subtext="กำลังโหลดข้อมูลและตั้งค่าระบบ"
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={styles.appContainer}>
        <AppNav />
        <main className={styles.mainContent}>
          <div className={styles.contentWrapper}>
            <div className={styles.pageContent}>
              <PageBreadcrumb />
              <div className={styles.routeContent}>
                <Suspense fallback={
                  <LoadingSpinner 
                    message="กำลังโหลดหน้า..." 
                    subtext="กรุณารอสักครู่"
                  />
                }>
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<RoleBasedRedirect />} />
                    <Route path="/menu" element={<Menu />} />
                    <Route path="/news" element={<News />} />
                    <Route path="/login" element={<Login />} />

                   // src/App.jsx (เฉพาะส่วนกำหนดเส้นทางที่ต้องมีสิทธิ์)

                    {/* Staff Routes */}
                    <Route
                      path="/staff/billing"
                      element={
                        <Protected roles={["STAFF", "ADMIN"]}>
                          <PermissionGuard permission="pos">
                            <Billing />
                          </PermissionGuard>
                        </Protected>
                      }
                    />

                    <Route
                      path="/staff/orders"
                      element={
                        <Protected roles={["STAFF", "ADMIN"]}>
                          <PermissionGuard permission="pos">
                            <Orders />
                          </PermissionGuard>
                        </Protected>
                      }
                    />

                    <Route
                      path="/staff/workflow"
                      element={
                        <Protected roles={["STAFF", "ADMIN"]}>
                          <PermissionGuard permission="pos">
                            <WorkflowPOS />
                          </PermissionGuard>
                        </Protected>
                      }
                    />

                    {/* Admin Routes (ตัวอย่างหน้าที่ล็อกตาม permission) */}
                    <Route
                      path="/admin"
                      element={
                        <Protected roles={["ADMIN", "STAFF"]}>
                          <AdminLayout />
                        </Protected>
                      }
                    >
                      <Route index element={<AdminDashboard />} />

                      <Route
                        path="users"
                        element={
                          <PermissionGuard permission="users">
                            <Users />
                          </PermissionGuard>
                        }
                      />

                      <Route
                        path="products"
                        element={
                          <PermissionGuard permission="products">
                            <Products />
                          </PermissionGuard>
                        }
                      />

                      <Route
                        path="permissions"
                        element={
                          <PermissionGuard permission="users">
                            <Permissions />
                          </PermissionGuard>
                        }
                      />

                      <Route
                        path="announcements"
                        element={
                          <PermissionGuard permission="announcements">
                            <Announcements />
                          </PermissionGuard>
                        }
                      />

                      <Route
                        path="payments"
                        element={
                          <PermissionGuard permission="reports">
                            <Payments />
                          </PermissionGuard>
                        }
                      />
                    </Route>


                    {/* 404 Fallback */}
                    <Route 
                      path="*" 
                      element={
                        <ErrorFallback 
                          error={{ message: 'ไม่พบหน้าที่คุณกำลังมองหา (404)' }}
                          resetError={() => window.location.href = '/'}
                        />
                      } 
                    />
                  </Routes>
                </Suspense>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
