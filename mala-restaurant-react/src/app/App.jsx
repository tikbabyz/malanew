// src/app/App.jsx
import React, { Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useAuthStore } from "@store/auth.js";
import { hydrateIfEmpty } from "@store/data.js";

import AppNav from "@app/layout/AppNav.jsx";
import Protected from "@shared/components/auth/Protected.jsx";
import PermissionGuard from "@shared/components/auth/PermissionGuard.jsx";

import { Home, Menu, News } from "@features/public";
import { Login } from "@features/auth";
import { Billing, Orders, WorkflowPOS } from "@features/staff";
import {
  AdminLayout,
  AdminDashboard,
  Users,
  Products,
  Permissions,
  Announcements,
  Payments,
} from "@features/admin";

import ErrorBoundary, { ErrorFallback } from "@app/components/ErrorBoundary.jsx";
import PageBreadcrumb from "@app/components/PageBreadcrumb.jsx";
import LoadingSpinner from "@app/components/LoadingSpinner.jsx";
import RoleBasedRedirect from "@app/components/RoleBasedRedirect.jsx";
import styles from "./App.module.css";
hydrateIfEmpty();

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
                        path="workflowpos"
                        element={
                          <PermissionGuard permission="pos">
                            <WorkflowPOS />
                          </PermissionGuard>
                        }
                      />

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




