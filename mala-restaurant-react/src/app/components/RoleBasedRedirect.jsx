import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@store/auth.js";
import LoadingSpinner from "@app/components/LoadingSpinner.jsx";
import { Home } from "@features/public";
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

export default RoleBasedRedirect;

